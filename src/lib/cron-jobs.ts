import cron from 'node-cron'
import { PrismaUserRepository } from '../repositories/prisma/user'
import { Payments } from './payments'
import { TokenUtils } from './token-utils'
import { WatchTransaction } from './watch-transactions'
import { RpcConnectionManager } from '../providers/solana'
import { TrackWallets } from './track-wallets'
import { bot } from '../providers/telegram'
import { SubscriptionMessages } from '../bot/messages/subscription-messages'
import dotenv from 'dotenv'
import { WalletPool } from '../config/wallet-pool'
import { logger } from '../lib/logger'

dotenv.config()

export class CronJobs {
  private prismaUserRepository: PrismaUserRepository
  private payments: Payments
  private walletWatcher: WatchTransaction
  private trackWallets: TrackWallets

  private static cachedPrice: string | undefined = undefined
  private static lastFetched: number = 0
  private static readonly refreshInterval: number = 5 * 60 * 1000 // 5 minutes
  constructor() {
    this.prismaUserRepository = new PrismaUserRepository()
    this.payments = new Payments()
    this.walletWatcher = new WatchTransaction()
    this.trackWallets = new TrackWallets()
  }

  public async monthlySubscriptionFee() {
    cron.schedule('0 0 * * *', async () => {
      try {
        logger.info('Charging subscriptions')

        const usersToCharge = await this.prismaUserRepository.getUsersWithDue()

        if (!usersToCharge || usersToCharge.length === 0) {
          logger.info('No users to charge today')
          return
        }

        for (const user of usersToCharge) {
          try {
            logger.info(`Charging user with ID: ${user.userId}`)

            const chargeResult = await this.payments.autoReChargeSubscription(user.userId, user.plan)

            if (chargeResult.success) {
              logger.info(
                `Successfully charged user ${user.userId} and updated subscription to next period ending on ${chargeResult.subscriptionEnd}.`,
              )
              bot.sendMessage(user.userId, SubscriptionMessages.planRenewedMessage(chargeResult.subscriptionEnd || ''), {
                parse_mode: 'HTML',
              })
            } else {
              logger.info(`Failed to charge user ${user.userId}: ${chargeResult.message}`)
              bot.sendMessage(
                user.userId,
                `
⚠️ Oops! We couldn't renew your Void subscription.  

💡 <b>Please check your Void wallet balance</b> and try upgrading your plan again to keep your tracked wallets.  
                `,
                {
                  parse_mode: 'HTML',
                },
              )
            }
          } catch (userError) {
            logger.error(`CHARGE_USER_ERROR user=${user.userId}`, userError)
          }
        }

        bot.sendMessage(
          process.env.ADMIN_CHAT_ID ?? '',
          `Subscription charge complete. Processed ${usersToCharge.length} users.`,
        )
      } catch (error) {
        logger.error('MONTHLY_SUBSCRIPTION_FEE_ERROR', error)
      }
    })
  }

  public async sendRenewalReminder() {
    cron.schedule('0 0 * * *', async () => {
      logger.info('Sending renewal reminders')

      const usersToRemind = await this.prismaUserRepository.getUsersWithEndingTomorrow()

      if (!usersToRemind || usersToRemind.length === 0) {
        logger.info('No users to remind today')
        return
      }

      for (const user of usersToRemind) {
        try {
          bot.sendMessage(
            user.userId,
            SubscriptionMessages.subscriptionRenewalMessage(user.user?.username || 'there', user.plan),
            {
              parse_mode: 'HTML',
            },
          )
          logger.info(`Successfully sent renewal reminder to user ${user.userId}`)
        } catch (error) {
          logger.error(`Failed to send reminder to user ${user.userId}:`, error)
        }
      }
    })
  }

  public async updateSolPrice(): Promise<string | undefined> {
    const now = Date.now()

    if (CronJobs.cachedPrice && now - CronJobs.lastFetched < CronJobs.refreshInterval) {
      return CronJobs.cachedPrice
    }

    try {
      let solPrice = await TokenUtils.getSolPriceGecko()

      if (!solPrice) {
        solPrice = await TokenUtils.getSolPriceRpc()
      }

      if (solPrice) {
        CronJobs.cachedPrice = solPrice
        CronJobs.lastFetched = now
      }

      return CronJobs.cachedPrice!
    } catch (error) {
      logger.error('Error fetching Solana price:', error)

      // Fallback to the last cached price, if available
      if (CronJobs.cachedPrice) {
        return CronJobs.cachedPrice
      }

      return
    }
  }

  public async unsubscribeAllWallets() {
    // Resets the RPC log connection every minute to recover from stale/dropped WebSocket subscriptions.
    // All wallets are re-subscribed immediately after the reset.
    cron.schedule('*/1 * * * *', async () => {
      logger.info('Triggering resetLogConnection...')
      RpcConnectionManager.resetLogConnection()
      WalletPool.subscriptions.clear()
      WalletPool.bannedWallets.clear()
      await this.trackWallets.setupWalletWatcher({ event: 'initial' })
    })
  }

  static getSolPrice() {
    return this.cachedPrice
  }
}
