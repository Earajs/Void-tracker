import TelegramBot, { InlineKeyboardMarkup } from 'node-telegram-bot-api'
import { AddCommand } from '../commands/add-command'
import { START_MENU, SUB_MENU, SETLIMIT_FIELD_MENU } from '../../config/bot-menus'
import { ManageCommand } from '../commands/manage-command'
import { DeleteCommand } from '../commands/delete-command'
import {
  adminExpectingBannedWallet,
  adminExpectingGrantUserId,
  adminGrantUserId,
  adminExpectingSetlimitValue,
  adminSetlimitPlan,
  adminSetlimitField,
  userExpectingDonation,
  userExpectingGroupId,
  userExpectingWalletAddress,
} from '../../constants/flags'
import { MyWalletCommand } from '../commands/mywallet-command'
import { GeneralMessages } from '../messages/general-messages'
import { UpgradePlanCommand } from '../commands/upgrade-plan-command'
import { UpgradePlanHandler } from './upgrade-plan-handler'
import { DonateCommand } from '../commands/donate-command'
import { DonateHandler } from './donate-handler'
import { SettingsCommand } from '../commands/settings-command'
import { TX_FILTER_MENU } from '../../config/bot-menus'
import { UserSettingsMessages } from '../messages/user-settings-messages'
import { UpdateBotStatusHandler } from './update-bot-status-handler'
import { PromotionHandler } from './promotion-handler'
import { GET_50_WALLETS_PROMOTION } from '../../constants/promotions'
import { PrismaUserRepository } from '../../repositories/prisma/user'
import { GroupsCommand } from '../commands/groups-command'
import { HelpCommand } from '../commands/help-command'
import { AdminCommand } from '../commands/admin-command'
import { SubscriptionPlan } from '@prisma/client'
import { planConfigService } from '../../services/plan-config-service'
import { logger } from '../../lib/logger'

export class CallbackQueryHandler {
  private addCommand: AddCommand
  private manageCommand: ManageCommand
  private deleteCommand: DeleteCommand
  private myWalletCommand: MyWalletCommand
  private upgradePlanCommand: UpgradePlanCommand
  private donateCommand: DonateCommand
  private settingsCommand: SettingsCommand
  private groupsCommand: GroupsCommand
  private helpCommand: HelpCommand
  private adminCommand: AdminCommand

  private updateBotStatusHandler: UpdateBotStatusHandler

  private prismaUserRepository: PrismaUserRepository

  private upgradePlanHandler: UpgradePlanHandler
  private donateHandler: DonateHandler
  private promotionHandler: PromotionHandler
  constructor(private bot: TelegramBot) {
    this.bot = bot

    this.addCommand = new AddCommand(this.bot)
    this.manageCommand = new ManageCommand(this.bot)
    this.deleteCommand = new DeleteCommand(this.bot)
    this.myWalletCommand = new MyWalletCommand(this.bot)
    this.upgradePlanCommand = new UpgradePlanCommand(this.bot)
    this.donateCommand = new DonateCommand(this.bot)
    this.settingsCommand = new SettingsCommand(this.bot)
    this.groupsCommand = new GroupsCommand(this.bot)
    this.helpCommand = new HelpCommand(this.bot)
    this.adminCommand = new AdminCommand(this.bot)

    this.updateBotStatusHandler = new UpdateBotStatusHandler(this.bot)

    this.prismaUserRepository = new PrismaUserRepository()

    this.upgradePlanHandler = new UpgradePlanHandler(this.bot)
    this.donateHandler = new DonateHandler(this.bot)
    this.promotionHandler = new PromotionHandler(this.bot)
  }

  public call() {
    this.bot.on('callback_query', async (callbackQuery) => {
      try {
        const message = callbackQuery.message
        const chatId = message?.chat.id
        const data = callbackQuery.data

        const userId = message?.chat.id.toString()

        if (!chatId || !userId) {
          return
        }

        // handle donations
        if (data?.startsWith('donate_action')) {
          const donationAmount = data.split('_')[2]
          logger.info(`User wants to donate ${donationAmount} SOL`)
          await this.donateHandler.makeDonation(message, Number(donationAmount))
          return
        }

        switch (data) {
          case 'add':
            this.addCommand.addButtonHandler(message)
            break
          case 'manage':
            await this.manageCommand.manageButtonHandler(message)
            break
          case 'delete':
            this.deleteCommand.deleteButtonHandler(message)
            break
          case 'settings':
            this.settingsCommand.settingsCommandHandler(message)
            break
          case 'pause-resume-bot':
            await this.updateBotStatusHandler.pauseResumeBot(message)
            break
          case 'tx_filters': {
            const prefs = await this.prismaUserRepository.getNotificationPrefs(userId)
            const messageText = UserSettingsMessages.txFiltersMessage
            this.bot.editMessageText(messageText, {
              chat_id: chatId,
              message_id: message.message_id,
              reply_markup: TX_FILTER_MENU(
                prefs?.notifyBuys ?? true,
                prefs?.notifySells ?? true,
                prefs?.notifyTransfers ?? true,
              ),
              parse_mode: 'HTML',
            })
            break
          }
          case 'tx_filter_buy': {
            const newValue = await this.prismaUserRepository.updateNotificationPref(userId, 'notifyBuys')
            const prefs = await this.prismaUserRepository.getNotificationPrefs(userId)
            const messageText = UserSettingsMessages.txFilterUpdatedMessage('buy', newValue ?? true)
            this.bot.editMessageText(messageText, {
              chat_id: chatId,
              message_id: message.message_id,
              reply_markup: TX_FILTER_MENU(
                prefs?.notifyBuys ?? true,
                prefs?.notifySells ?? true,
                prefs?.notifyTransfers ?? true,
              ),
              parse_mode: 'HTML',
            })
            break
          }
          case 'tx_filter_sell': {
            const newValue = await this.prismaUserRepository.updateNotificationPref(userId, 'notifySells')
            const prefs = await this.prismaUserRepository.getNotificationPrefs(userId)
            const messageText = UserSettingsMessages.txFilterUpdatedMessage('sell', newValue ?? true)
            this.bot.editMessageText(messageText, {
              chat_id: chatId,
              message_id: message.message_id,
              reply_markup: TX_FILTER_MENU(
                prefs?.notifyBuys ?? true,
                prefs?.notifySells ?? true,
                prefs?.notifyTransfers ?? true,
              ),
              parse_mode: 'HTML',
            })
            break
          }
          case 'tx_filter_transfer': {
            const newValue = await this.prismaUserRepository.updateNotificationPref(userId, 'notifyTransfers')
            const prefs = await this.prismaUserRepository.getNotificationPrefs(userId)
            const messageText = UserSettingsMessages.txFilterUpdatedMessage('transfer', newValue ?? true)
            this.bot.editMessageText(messageText, {
              chat_id: chatId,
              message_id: message.message_id,
              reply_markup: TX_FILTER_MENU(
                prefs?.notifyBuys ?? true,
                prefs?.notifySells ?? true,
                prefs?.notifyTransfers ?? true,
              ),
              parse_mode: 'HTML',
            })
            break
          }
          case 'upgrade':
            this.upgradePlanCommand.upgradePlanButtonHandler(message)
            break
          case 'upgrade_hobby':
            await this.upgradePlanHandler.upgradePlan(message, 'HOBBY')
            break
          case 'upgrade_pro':
            await this.upgradePlanHandler.upgradePlan(message, 'PRO')
            break
          case 'upgrade_whale':
            await this.upgradePlanHandler.upgradePlan(message, 'WHALE')
            break
          case 'donate':
            await this.donateCommand.donateCommandHandler(message)
            break
          case 'groups':
            await this.groupsCommand.groupsButtonHandler(message)
            break
          case 'delete_group':
            await this.groupsCommand.deleteGroupButtonHandler(message)
            break
          case 'help':
            this.helpCommand.helpButtonHandler(message)
            break
          case 'my_wallet':
            this.myWalletCommand.myWalletCommandHandler(message)
            break
          case 'show_private_key':
            this.myWalletCommand.showPrivateKeyHandler(message)
            break
          case 'buy_promotion':
            this.promotionHandler.buyPromotion(message, GET_50_WALLETS_PROMOTION.price, GET_50_WALLETS_PROMOTION.type)
            break
          case 'grant_hobby':
            await this.adminCommand.grantPremiumByPlan(chatId, 'HOBBY')
            break
          case 'grant_pro':
            await this.adminCommand.grantPremiumByPlan(chatId, 'PRO')
            break
          case 'grant_whale':
            await this.adminCommand.grantPremiumByPlan(chatId, 'WHALE')
            break
          case 'grant_cancel':
            delete adminGrantUserId[chatId]
            this.bot.sendMessage(chatId, `Operation cancelled.`, { reply_markup: SUB_MENU })
            break
          case 'setlimit_cancel':
            adminExpectingSetlimitValue[chatId] = false
            delete adminSetlimitPlan[chatId]
            delete adminSetlimitField[chatId]
            this.bot.sendMessage(chatId, `Operation cancelled.`, { reply_markup: SUB_MENU })
            break
          case 'setlimit_plan_HOBBY':
          case 'setlimit_plan_PRO':
          case 'setlimit_plan_WHALE': {
            const plan = data!.replace('setlimit_plan_', '') as SubscriptionPlan
            adminSetlimitPlan[chatId] = plan
            const limits = planConfigService.getLimits(plan)
            this.bot.sendMessage(
              chatId,
              `Editing <b>${plan}</b>\nCurrent: ${limits.maxWallets} wallets | ${limits.maxDailyMessages} msgs | ${limits.feeSol} SOL\n\nSelect a field to change:`,
              { reply_markup: SETLIMIT_FIELD_MENU, parse_mode: 'HTML' },
            )
            break
          }
          case 'setlimit_field_maxWallets': {
            const plan = (adminSetlimitPlan[chatId] || 'HOBBY') as SubscriptionPlan
            await this.adminCommand.setLimitByField(chatId, plan, 'maxWallets')
            break
          }
          case 'setlimit_field_maxDailyMessages': {
            const plan = (adminSetlimitPlan[chatId] || 'HOBBY') as SubscriptionPlan
            await this.adminCommand.setLimitByField(chatId, plan, 'maxDailyMessages')
            break
          }
          case 'setlimit_field_maxGroups': {
            const plan = (adminSetlimitPlan[chatId] || 'HOBBY') as SubscriptionPlan
            await this.adminCommand.setLimitByField(chatId, plan, 'maxGroups')
            break
          }
          case 'setlimit_field_feeSol': {
            const plan = (adminSetlimitPlan[chatId] || 'HOBBY') as SubscriptionPlan
            await this.adminCommand.setLimitByField(chatId, plan, 'feeSol')
            break
          }
          case 'back_to_main_menu':
            const user = await this.prismaUserRepository.getById(userId)
            const messageText = GeneralMessages.startMessage(user)

            // reset any flags
            userExpectingWalletAddress[chatId] = false
            userExpectingDonation[chatId] = false
            userExpectingGroupId[chatId] = false

            adminExpectingBannedWallet[chatId] = false
            adminExpectingGrantUserId[chatId] = false
            delete adminGrantUserId[chatId]
            adminExpectingSetlimitValue[chatId] = false
            delete adminSetlimitPlan[chatId]
            delete adminSetlimitField[chatId]

            this.bot.editMessageText(messageText, {
              chat_id: chatId,
              message_id: message.message_id,
              reply_markup: START_MENU,
              parse_mode: 'HTML',
            })
            break
          default:
            break
        }
      } catch (error) {
        logger.error('CALLBACK_QUERY_ERROR', error)
      }
    })
  }
}
