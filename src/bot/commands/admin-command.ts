import TelegramBot from 'node-telegram-bot-api'
import { BotMiddleware } from '../../config/bot-middleware'
import { SUB_MENU, GRANT_PREMIUM_PLAN_MENU, SETLIMIT_PLAN_MENU, SETLIMIT_FIELD_MENU } from '../../config/bot-menus'
import {
  adminExpectingBannedWallet,
  adminExpectingGrantUserId,
  adminGrantUserId,
  adminExpectingSetlimitValue,
  adminSetlimitPlan,
  adminSetlimitField,
} from '../../constants/flags'
import { PublicKey } from '@solana/web3.js'
import { PrismaWalletRepository } from '../../repositories/prisma/wallet'
import { TrackWallets } from '../../lib/track-wallets'
import { PrismaSubscriptionRepository } from '../../repositories/prisma/subscription'
import { SubscriptionPlan } from '@prisma/client'
import { planConfigService, PlanLimits } from '../../services/plan-config-service'
import { logger } from '../../lib/logger'

export class AdminCommand {
  private walletRespository: PrismaWalletRepository
  private trackWallets: TrackWallets
  private subscriptionRepository: PrismaSubscriptionRepository
  constructor(private bot: TelegramBot) {
    this.bot = bot
    this.walletRespository = new PrismaWalletRepository()
    this.trackWallets = new TrackWallets()
    this.subscriptionRepository = new PrismaSubscriptionRepository()
  }

  public banWalletCommandHandler() {
    this.bot.onText(/\/ban_wallet/, async (msg) => {
      const userId = String(msg.from?.id)
      const chatId = msg.chat.id

      if (!userId) return

      const isAdmin = BotMiddleware.isUserBotAdmin(userId)
      if (!isAdmin) return

      this.bot.removeAllListeners('message')

      this.bot.sendMessage(chatId, `Enter the wallet <b>Public Key</b> you want to <b>Ban</b>`, {
        reply_markup: SUB_MENU,
        parse_mode: 'HTML',
      })

      adminExpectingBannedWallet[Number(userId)] = true
      const listener = async (responseMsg: TelegramBot.Message) => {
        if (responseMsg.text?.startsWith('/')) {
          adminExpectingBannedWallet[Number(userId)] = false
          return
        }

        if (!adminExpectingBannedWallet[Number(userId)]) return
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
        const walletAddress = responseMsg.text

        if (!walletAddress) return

        const isValid = base58Regex.test(walletAddress) && PublicKey.isOnCurve(new PublicKey(walletAddress).toBytes())
        if (!isValid) {
          adminExpectingBannedWallet[Number(userId)] = false
          this.bot.sendMessage(chatId, `Address <b>${walletAddress}</b> is not a valid Solana wallet`, {
            parse_mode: 'HTML',
          })
          return
        }

        const walletToban = await this.walletRespository.getWalletByAddress(walletAddress)
        logger.info('WALLET TO BAN:', walletToban)
        if (!walletToban?.id) {
          this.bot.sendMessage(chatId, `Wallet with address <code>${walletAddress}</code> is not in the Database!`, {
            parse_mode: 'HTML',
          })
          adminExpectingBannedWallet[Number(userId)] = false
          return
        }

        const bannedWallet = await this.walletRespository.pauseUserWalletSpam(walletToban?.id, 'BANNED')

        if (bannedWallet) {
          this.trackWallets.setupWalletWatcher({ event: 'update', walletId: walletToban.id })
          this.bot.sendMessage(chatId, `wallet with address <code>${walletAddress}</code> has been banned!`, {
            parse_mode: 'HTML',
          })
        } else {
          this.bot.sendMessage(chatId, `Failed to delete wallet with address <code>${walletAddress}</code>`)
        }

        this.bot.removeListener('message', listener)

        adminExpectingBannedWallet[Number(userId)] = false
      }

      this.bot.once('message', listener)
    })
  }

  public grantPremiumCommandHandler() {
    this.bot.onText(/\/addp/, async (msg) => {
      const adminId = String(msg.from?.id)
      const chatId = msg.chat.id

      if (!adminId) return

      const isAdmin = BotMiddleware.isUserBotAdmin(adminId)
      if (!isAdmin) return

      adminExpectingGrantUserId[chatId] = true

      this.bot.sendMessage(chatId, `Enter the <b>Telegram User ID</b> to grant premium to:`, {
        reply_markup: SUB_MENU,
        parse_mode: 'HTML',
      })

      const listener = async (responseMsg: TelegramBot.Message) => {
        if (responseMsg.text?.startsWith('/')) {
          adminExpectingGrantUserId[chatId] = false
          delete adminGrantUserId[chatId]
          return
        }

        if (!adminExpectingGrantUserId[chatId]) return

        const targetUserId = responseMsg.text?.trim()

        if (!targetUserId) {
          this.bot.sendMessage(chatId, `Invalid user ID. Operation cancelled.`)
          adminExpectingGrantUserId[chatId] = false
          delete adminGrantUserId[chatId]
          return
        }

        adminExpectingGrantUserId[chatId] = false
        adminGrantUserId[chatId] = targetUserId

        this.bot.sendMessage(chatId, `Select the plan for user <code>${targetUserId}</code>:`, {
          reply_markup: GRANT_PREMIUM_PLAN_MENU,
          parse_mode: 'HTML',
        })

        this.bot.removeListener('message', listener)
      }

      this.bot.once('message', listener)
    })
  }

  public async grantPremiumByPlan(chatId: number, plan: SubscriptionPlan) {
    const targetUserId = adminGrantUserId[chatId]

    if (!targetUserId) {
      this.bot.sendMessage(chatId, `No user ID found. Run /addp again.`, {
        parse_mode: 'HTML',
      })
      return
    }

    delete adminGrantUserId[chatId]

    const subscription = await this.subscriptionRepository.updateUserSubscription(targetUserId, plan)

    if (!subscription) {
      this.bot.sendMessage(
        chatId,
        `Failed to grant <b>${plan}</b> to user <code>${targetUserId}</code>. User may not exist.`,
        {
          reply_markup: SUB_MENU,
          parse_mode: 'HTML',
        },
      )
      return
    }

    this.bot.sendMessage(
      chatId,
      `✅ User <code>${targetUserId}</code> has been granted <b>${plan}</b> premium.\nSubscription renews: ${subscription.subscriptionCurrentPeriodEnd?.toLocaleDateString()}`,
      {
        reply_markup: SUB_MENU,
        parse_mode: 'HTML',
      },
    )

    try {
      this.bot.sendMessage(
        targetUserId,
        `🎉 Great news! An admin has granted you a <b>${plan}</b> subscription! Enjoy your premium features!`,
        { parse_mode: 'HTML' },
      )
    } catch {
      logger.info(`Could not notify user ${targetUserId}`)
    }
  }

  public setLimitCommandHandler() {
    this.bot.onText(/\/setlimit/, async (msg) => {
      const adminId = String(msg.from?.id)
      const chatId = msg.chat.id

      if (!adminId) return

      const isAdmin = BotMiddleware.isUserBotAdmin(adminId)
      if (!isAdmin) return

      const limits = planConfigService.getLimits('HOBBY')
      const info = `
<b>Plan Limit Editor</b>

Current defaults:
<b>HOBBY</b>: ${limits.maxWallets} wallets | ${limits.maxDailyMessages} msgs | ${limits.feeSol} SOL
<b>PRO</b>: ${planConfigService.getLimits('PRO').maxWallets} wallets | ${planConfigService.getLimits('PRO').feeSol} SOL
<b>WHALE</b>: ${planConfigService.getLimits('WHALE').maxWallets} wallets | ${planConfigService.getLimits('WHALE').feeSol} SOL

Select a plan to edit:
`

      this.bot.sendMessage(chatId, info, {
        reply_markup: SETLIMIT_PLAN_MENU,
        parse_mode: 'HTML',
      })
    })
  }

  public async setLimitByField(chatId: number, plan: SubscriptionPlan, field: keyof PlanLimits) {
    adminExpectingSetlimitValue[chatId] = true
    adminSetlimitPlan[chatId] = plan
    adminSetlimitField[chatId] = field

    const current = planConfigService.getLimits(plan)[field]

    const fieldLabels: Record<keyof PlanLimits, string> = {
      maxWallets: 'max wallets',
      maxDailyMessages: 'max daily messages',
      maxGroups: 'max groups',
      feeSol: 'fee (in SOL)',
    }

    this.bot.sendMessage(
      chatId,
      `Editing <b>${plan}</b> — <b>${fieldLabels[field]}</b>\nCurrent value: <code>${current}</code>\n\nSend the new value:`,
      { reply_markup: SUB_MENU, parse_mode: 'HTML' },
    )

    const listener = async (responseMsg: TelegramBot.Message) => {
      if (!adminExpectingSetlimitValue[chatId]) return

      const value = responseMsg.text?.trim()
      if (!value || responseMsg.text?.startsWith('/')) {
        adminExpectingSetlimitValue[chatId] = false
        delete adminSetlimitPlan[chatId]
        delete adminSetlimitField[chatId]
        return
      }

      const numericValue = Number(value)
      if (isNaN(numericValue) || numericValue < 0) {
        this.bot.sendMessage(chatId, `Invalid number: "${value}". Operation cancelled.`, {
          reply_markup: SUB_MENU,
        })
        adminExpectingSetlimitValue[chatId] = false
        delete adminSetlimitPlan[chatId]
        delete adminSetlimitField[chatId]
        return
      }

      adminExpectingSetlimitValue[chatId] = false

      await planConfigService.updateLimit(plan, field, numericValue)

      const newVal = planConfigService.getLimits(plan)[field]
      this.bot.sendMessage(
        chatId,
        `✅ <b>${plan}</b> ${fieldLabels[field]} updated: <code>${current}</code> → <code>${newVal}</code>`,
        { reply_markup: SUB_MENU, parse_mode: 'HTML' },
      )

      delete adminSetlimitPlan[chatId]
      delete adminSetlimitField[chatId]
      this.bot.removeListener('message', listener)
    }

    this.bot.once('message', listener)
  }
}
