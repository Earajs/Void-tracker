import { Connection, PublicKey } from '@solana/web3.js'

import { SubscriptionPlan } from '@prisma/client'

import { RateLimitMessages } from '../bot/messages/rate-limit-messages'
import { TxPerSecondCapInterface } from '../types/general-interfaces'
import { MAX_5_MIN_TXS_ALLOWED, MAX_TPS_ALLOWED, MAX_TPS_FOR_BAN, WALLET_SLEEP_TIME } from '../constants/bot-config'
import { PrismaWalletRepository } from '../repositories/prisma/wallet'
import { BANNED_WALLETS } from '../constants/banned-wallets'
import { RpcConnectionManager } from '../providers/solana'
import { planConfigService } from '../services/plan-config-service'
import { logger } from '../lib/logger'

export class RateLimit {
  private prismaWalletRepository: PrismaWalletRepository
  private resumeTimeouts: Map<string, ReturnType<typeof setTimeout>>

  constructor(private subscriptions: Map<string, number>) {
    this.prismaWalletRepository = new PrismaWalletRepository()
    this.resumeTimeouts = new Map()
  }

  public async last5MinutesTxs(walletAddress: string) {
    const currentTime = Date.now()

    const fiveMinutesAgo = currentTime - 5 * 60 * 1000

    const signatures = await RpcConnectionManager.getRandomConnection().getSignaturesForAddress(
      new PublicKey(walletAddress),
      {
        limit: MAX_5_MIN_TXS_ALLOWED,
      },
    )

    const recentTransactions = signatures.filter((signatureInfo) => {
      const transactionTime = signatureInfo.blockTime! * 1000
      return transactionTime >= fiveMinutesAgo
    })

    return recentTransactions.length
  }

  public async txPerSecondCap({ bot, excludedWallets, wallet, walletData }: TxPerSecondCapInterface): Promise<boolean> {
    walletData.count++
    const elapsedTime = (Date.now() - walletData.startTime) / 1000

    if (elapsedTime >= 1) {
      const tps = walletData.count / elapsedTime
      logger.info(`TPS for wallet ${wallet.address}: ${tps.toFixed(2)}`)

      if (tps >= MAX_TPS_FOR_BAN) {
        excludedWallets.set(wallet.address, true)
        logger.info(`Wallet ${wallet.address} has been banned.`)
        BANNED_WALLETS.add(wallet.address)
        for (const user of wallet.userWallets) {
          this.prismaWalletRepository.pauseUserWalletSpam(wallet.id, 'BANNED')
          bot.sendMessage(user.userId, RateLimitMessages.walletWasBanned(wallet.address), { parse_mode: 'HTML' })
        }
      }

      if (tps >= MAX_TPS_ALLOWED) {
        excludedWallets.set(wallet.address, true)
        logger.info(`Wallet ${wallet.address} excluded for 2 hours due to high TPS.`)

        if (this.resumeTimeouts.has(wallet.address)) {
          clearTimeout(this.resumeTimeouts.get(wallet.address))
        }

        const userWalletsSnapshot = wallet.userWallets.slice()
        const walletId = wallet.id
        const walletAddress = wallet.address

        for (const user of userWalletsSnapshot) {
          this.prismaWalletRepository.pauseUserWalletSpam(walletId, 'SPAM_PAUSED')
          bot.sendMessage(user.userId, RateLimitMessages.walletWasPaused(walletAddress), { parse_mode: 'HTML' })
        }

        const timeoutId = setTimeout(async () => {
          this.resumeTimeouts.delete(walletAddress)
          excludedWallets.delete(walletAddress)

          for (const user of userWalletsSnapshot) {
            const walletUpdated = await this.prismaWalletRepository.resumeUserWallet(user.userId, walletId)
            if (!walletUpdated) return
            bot.sendMessage(user.userId, RateLimitMessages.walletWasResumed(walletAddress), {
              parse_mode: 'HTML',
            })
          }

          logger.info(`Wallet ${walletAddress} re-included after 2 hours.`)
        }, WALLET_SLEEP_TIME)

        this.resumeTimeouts.set(wallet.address, timeoutId)

        return true
      }

      walletData.count = 0
      walletData.startTime = Date.now()
    }

    return false
  }

  public async dailyMessageLimit(messagesToday: number, userPlan: SubscriptionPlan) {
    const limit = planConfigService.getLimits(userPlan).maxDailyMessages
    if (limit > 0 && messagesToday >= limit) {
      return { dailyLimitReached: true }
    }
  }

  public clearResumeTimeout(walletAddress: string): void {
    const timeout = this.resumeTimeouts.get(walletAddress)
    if (timeout) {
      clearTimeout(timeout)
      this.resumeTimeouts.delete(walletAddress)
    }
  }
}
