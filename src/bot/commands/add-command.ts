import TelegramBot from 'node-telegram-bot-api'
import { SUB_MENU, getUpgradePlanSubMenu } from '../../config/bot-menus'
import { PublicKey } from '@solana/web3.js'
import { PrismaWalletRepository } from '../../repositories/prisma/wallet'
import { userExpectingWalletAddress } from '../../constants/flags'
import { TrackWallets } from '../../lib/track-wallets'
import { WalletMessages } from '../messages/wallet-messages'
import { UserPlan } from '../../lib/user-plan'
import { GeneralMessages } from '../messages/general-messages'
import { BANNED_WALLETS } from '../../constants/banned-wallets'
import { BotMiddleware } from '../../config/bot-middleware'
import { SubscriptionMessages } from '../messages/subscription-messages'

export class AddCommand {
  private prismaWalletRepository: PrismaWalletRepository
  private trackWallets: TrackWallets
  private userPlan: UserPlan
  constructor(private bot: TelegramBot) {
    this.bot = bot
    this.prismaWalletRepository = new PrismaWalletRepository()
    this.trackWallets = new TrackWallets()
    this.userPlan = new UserPlan()
  }

  public addCommandHandler() {
    this.bot.onText(/\/add/, async (msg) => {
      const chatId = msg.chat.id
      const userId = String(msg.from?.id)

      const groupValidationResult = await BotMiddleware.checkGroupChatRequirements(chatId, userId)

      if (!groupValidationResult.isValid) {
        return this.bot.sendMessage(chatId, groupValidationResult.message, { parse_mode: 'HTML' })
      }

      this.add({ message: msg, isButton: false })
    })
  }

  public addButtonHandler(msg: TelegramBot.Message) {
    this.add({ message: msg, isButton: true })
  }

  private add({ message, isButton }: { message: TelegramBot.Message; isButton: boolean }) {
    try {
      const userId = message.chat.id.toString()
      const chatId = message.chat.id
      const isGroup = BotMiddleware.isGroup(chatId)
      const replyMarkup = isGroup ? undefined : SUB_MENU

      const addMessage = WalletMessages.addWalletMessage
      if (isButton) {
        this.bot.editMessageText(addMessage, {
          chat_id: chatId,
          message_id: message.message_id,
          reply_markup: replyMarkup,
          parse_mode: 'HTML',
        })
      } else {
        this.bot.sendMessage(chatId, addMessage, { reply_markup: replyMarkup, parse_mode: 'HTML' })
      }

      userExpectingWalletAddress[Number(userId)] = true

      const listener = async (responseMsg: TelegramBot.Message) => {
        // Only handle messages from this specific chat
        if (responseMsg.chat.id !== chatId) return
        if (!userExpectingWalletAddress[Number(userId)]) return

        const text = responseMsg.text

        if (text?.startsWith('/')) {
          userExpectingWalletAddress[Number(userId)] = false
          this.bot.removeListener('message', listener)
          return
        }

        const walletEntries = text
          ?.split('\n')
          .map((entry) => entry.trim())
          .filter(Boolean)

        if (!walletEntries || walletEntries.length === 0) {
          this.bot.sendMessage(chatId, 'No wallet addresses provided.')
          return
        }

        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

        const [planWallets, userWallets] = await Promise.all([
          this.userPlan.getUserPlanWallets(userId),
          this.prismaWalletRepository.getUserWallets(userId),
        ])

        for (const entry of walletEntries) {
          const [walletAddress, walletName] = entry.split(' ')

          if (BANNED_WALLETS.has(walletAddress)) {
            this.bot.sendMessage(chatId, GeneralMessages.botWalletError, {
              parse_mode: 'HTML',
              reply_markup: isGroup ? undefined : SUB_MENU,
            })
            this.bot.removeListener('message', listener)
            userExpectingWalletAddress[Number(userId)] = false
            return
          }

          if (userWallets && userWallets.length >= planWallets) {
            this.bot.sendMessage(
              chatId,
              GeneralMessages.walletLimitMessageError(walletName, walletAddress, planWallets),
              {
                parse_mode: 'HTML',
                reply_markup: isGroup ? undefined : getUpgradePlanSubMenu(),
              },
            )
            this.bot.removeListener('message', listener)
            userExpectingWalletAddress[Number(userId)] = false
            return
          }

          if (!base58Regex.test(walletAddress)) {
            this.bot.sendMessage(chatId, `😾 Address provided is not a valid Solana wallet`)
            continue
          }

          const publicKeyWallet = new PublicKey(walletAddress)
          if (!PublicKey.isOnCurve(publicKeyWallet.toBytes())) {
            this.bot.sendMessage(chatId, `😾 Address provided is not a valid Solana wallet`)
            continue
          }

          const isWalletAlready = await this.prismaWalletRepository.getUserWalletById(userId, walletAddress)

          if (isWalletAlready) {
            this.bot.sendMessage(chatId, `🙀 You already follow the wallet: ${walletAddress}`)
            continue
          }

          const createdWallet = await this.prismaWalletRepository.create(userId, walletAddress, walletName)
          const createdWalletId = createdWallet?.id

          this.bot.sendMessage(chatId, `🎉 Wallet ${walletAddress} has been added.`)

          await this.trackWallets.setupWalletWatcher({ event: 'create', walletId: createdWalletId })
        }

        this.bot.removeListener('message', listener)
        userExpectingWalletAddress[Number(userId)] = false
      }

      this.bot.on('message', listener)
    } catch (error) {
      this.bot.sendMessage(
        message.chat.id,
        `😾 Something went wrong when adding this wallet! please try with another address`,
      )
    }
  }
}
