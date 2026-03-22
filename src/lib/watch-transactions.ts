import { PublicKey } from '@solana/web3.js'
import { ValidTransactions } from './valid-transactions'
import EventEmitter from 'events'
import { TransactionParser } from '../parsers/transaction-parser'
import { SendTransactionMsgHandler } from '../bot/handlers/send-tx-msg-handler'
import { bot } from '../providers/telegram'
import { WalletWithUsers } from '../types/swap-types'
import { RateLimit } from './rate-limit'
import chalk from 'chalk'
import { RpcConnectionManager } from '../providers/solana'
import pLimit from 'p-limit'
import { CronJobs } from './cron-jobs'
import { PrismaUserRepository } from '../repositories/prisma/user'
import { WalletPool } from '../config/wallet-pool'
import TelegramBot from 'node-telegram-bot-api'
import { logger } from '../lib/logger'

const PAUSED_USERS_CACHE_TTL_MS = 30_000

export class WatchTransaction extends EventEmitter {
  private walletTransactions: Map<string, { count: number; startTime: number }>
  private rateLimit: RateLimit
  private prismaUserRepository: PrismaUserRepository
  private pausedUsersCache: { userIds: Set<string>; timestamp: number }

  constructor() {
    super()
    this.walletTransactions = new Map()
    this.rateLimit = new RateLimit(WalletPool.subscriptions)
    this.prismaUserRepository = new PrismaUserRepository()
    this.pausedUsersCache = { userIds: new Set(), timestamp: 0 }
  }

  public async watchSocket(wallets: WalletWithUsers[]): Promise<void> {
    try {
      for (const wallet of wallets) {
        const publicKey = new PublicKey(wallet.address)
        const walletAddress = publicKey.toBase58()

        if (WalletPool.subscriptions.has(walletAddress)) {
          continue
        }

        logger.info(chalk.greenBright(`Watching transactions for wallet: `) + chalk.yellowBright.bold(walletAddress))

        this.walletTransactions.set(walletAddress, { count: 0, startTime: Date.now() })

        const subscriptionId = RpcConnectionManager.logConnection.onLogs(
          publicKey,
          async (logs, ctx) => {
            try {
              if (WalletPool.bannedWallets.has(walletAddress)) return

              const { isRelevant, swap } = ValidTransactions.isRelevantTransaction(logs)
              if (!isRelevant) return

              const walletData = this.walletTransactions.get(walletAddress)
              if (!walletData) return

              const isWalletRateLimited = await this.rateLimit.txPerSecondCap({
                wallet,
                bot,
                excludedWallets: WalletPool.bannedWallets,
                walletData,
              })
              if (isWalletRateLimited) return

              const transactionDetails = await this.getParsedTransaction(logs.signature)
              if (!transactionDetails || transactionDetails[0] === null) return

              const solPriceUsd = CronJobs.getSolPrice()
              if (!solPriceUsd) {
                logger.warn('SOL_PRICE_UNDEFINED - skipping transaction')
                return
              }
              const transactionParser = new TransactionParser(logs.signature)

              if (
                swap === 'raydium' ||
                swap === 'jupiter' ||
                swap === 'pumpfun' ||
                swap === 'mint_pumpfun' ||
                swap === 'pumpfun_amm'
              ) {
                const parsed = await transactionParser.parseDefiTransaction(
                  transactionDetails,
                  swap,
                  solPriceUsd,
                  walletAddress,
                )
                if (!parsed) return
                logger.info(parsed.description)
                const txType =
                  parsed.type === 'buy' ? 'defi_buy' : parsed.type === 'sell' ? 'defi_sell' : 'defi_unknown'
                await this.sendMessageToUsers(wallet, parsed, txType, (handler, parsedData, userId) =>
                  handler.sendTransactionMessage(parsedData, userId),
                )
              } else if (swap === 'sol_transfer') {
                const parsed = await transactionParser.parseSolTransfer(transactionDetails, solPriceUsd, walletAddress)
                if (!parsed) return
                logger.info(parsed.description)
                await this.sendMessageToUsers(wallet, parsed, 'transfer', (handler, parsedData, userId) =>
                  handler.sendTransferMessage(parsedData, userId),
                )
              }
            } catch (error) {
              logger.error('ON_LOGS_CALLBACK_ERROR', error)
            }
          },
          'processed',
        )

        WalletPool.subscriptions.set(wallet.address, subscriptionId)
        logger.info(
          chalk.greenBright(`Subscribed to logs with subscription ID: `) + chalk.yellowBright.bold(subscriptionId),
        )
      }

      await this.refreshPausedUsersCache()
    } catch (error) {
      logger.error('WATCH_SOCKET_ERROR', error)
    }
  }

  public async getParsedTransaction(transactionSignature: string, retries = 4) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const transactionDetails = await RpcConnectionManager.getRandomConnection().getParsedTransaction(
          transactionSignature,
          { maxSupportedTransactionVersion: 0 },
        )

        if (transactionDetails !== null) {
          return [transactionDetails]
        }
      } catch (error) {
        logger.error(`GET_PARSED_TX_ERROR attempt ${attempt}`, error)
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }

    logger.error(`Failed to fetch transaction after ${retries} retries:`, transactionSignature)
    return null
  }

  public async refreshPausedUsersCache(): Promise<void> {
    const allUserIds = WalletPool.wallets.flatMap((w) => w.userWallets.map((uw) => uw.userId))
    const uniqueUserIds = [...new Set(allUserIds)]

    if (uniqueUserIds.length === 0) return

    const pausedUserIds = await this.prismaUserRepository.getPausedUsers(uniqueUserIds)
    if (pausedUserIds) {
      this.pausedUsersCache = { userIds: new Set(pausedUserIds), timestamp: Date.now() }
    }
  }

  private isPausedUsersCacheStale(): boolean {
    return Date.now() - this.pausedUsersCache.timestamp > PAUSED_USERS_CACHE_TTL_MS
  }

  private async sendMessageToUsers<T>(
    wallet: WalletWithUsers,
    parsed: T,
    txType: 'defi_buy' | 'defi_sell' | 'defi_unknown' | 'transfer',
    sendMessageFn: (
      handler: SendTransactionMsgHandler,
      parsed: T,
      userId: string,
    ) => Promise<TelegramBot.Message | undefined>,
  ) {
    const sendMessageHandler = new SendTransactionMsgHandler(bot)

    if (this.isPausedUsersCacheStale()) {
      this.refreshPausedUsersCache().catch((error) => {
        logger.error('REFRESH_PAUSED_USERS_CACHE_ERROR', error)
      })
    }

    const activeUsers = wallet.userWallets.filter((w) => !this.pausedUsersCache.userIds.has(w.userId))

    const uniqueActiveUsers = Array.from(new Set(activeUsers.map((user) => user.userId))).map((userId) =>
      activeUsers.find((user) => user.userId === userId),
    )

    const limit = pLimit(20)

    const tasks = uniqueActiveUsers.map((user) =>
      limit(async () => {
        if (!user) return

        const prefs = user.user
        if (txType === 'defi_buy' && !prefs.notifyBuys) return
        if (txType === 'defi_sell' && !prefs.notifySells) return
        if (txType === 'transfer' && !prefs.notifyTransfers) return

        try {
          await sendMessageFn(sendMessageHandler, parsed, user.userId)
        } catch (error) {
          logger.error(`SEND_MESSAGE_ERROR user=${user.userId}`, error)
        }
      }),
    )

    await Promise.all(tasks)
  }
}
