import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { UserBalances } from './user-balances'
import { VOID_WALLET_ADDRESS } from '../constants/bot-config'
import { RpcConnectionManager } from '../providers/solana'
import { PrismaUserRepository } from '../repositories/prisma/user'
import { PromotionType, SubscriptionPlan, User, UserSubscription } from '@prisma/client'
import { PrismaSubscriptionRepository } from '../repositories/prisma/subscription'
import { PaymentsMessageEnum } from '../types/messages-types'
import { format } from 'date-fns'
import { GeneralMessages } from '../bot/messages/general-messages'
import { PrismaGroupRepository } from '../repositories/prisma/group'
import { CryptoUtil } from './crypto-utils'
import { planConfigService } from '../services/plan-config-service'
import { logger } from '../lib/logger'

export class Payments {
  private userBalances: UserBalances
  private voidWallet: PublicKey
  private prismaUserRepository: PrismaUserRepository
  private prismaSubscriptionRepository: PrismaSubscriptionRepository
  private prismaGroupRepository: PrismaGroupRepository

  constructor() {
    this.userBalances = new UserBalances()
    this.voidWallet = new PublicKey(VOID_WALLET_ADDRESS ?? '')

    this.prismaUserRepository = new PrismaUserRepository()
    this.prismaSubscriptionRepository = new PrismaSubscriptionRepository()
    this.prismaGroupRepository = new PrismaGroupRepository()
  }

  public async chargeSubscription(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<{ success: boolean; message: PaymentsMessageEnum; subscriptionEnd: string | null }> {
    const user = await this.prismaUserRepository.getById(userId)

    if (!user) {
      return { success: false, message: PaymentsMessageEnum.NO_USER_FOUND, subscriptionEnd: null }
    }

    if (user.userSubscription && user.userSubscription.plan === plan) {
      return { success: false, message: PaymentsMessageEnum.USER_ALREADY_PAID, subscriptionEnd: null }
    }

    const balance = await this.userBalances.userPersonalSolBalance(user.personalWalletPubKey)
    if (!balance) {
      return { success: false, message: PaymentsMessageEnum.INSUFFICIENT_BALANCE, subscriptionEnd: null }
    }

    const planFee = planConfigService.getFeeLamports(plan)

    if (planFee === 0) {
      return { success: false, message: PaymentsMessageEnum.INVALID_PLAN, subscriptionEnd: null }
    }

    if (balance >= planFee) {
      try {
        const userPublicKey = new PublicKey(user.personalWalletPubKey)
        await this.executePayment(userPublicKey, user.personalWalletPrivKey, planFee)

        const subscription = await this.prismaSubscriptionRepository.updateUserSubscription(user.id, plan)
        const parsedDate = format(subscription.subscriptionCurrentPeriodEnd!, 'MM/dd/yyyy')

        await this.prismaGroupRepository.updateUserGroupStatus(userId)

        return { success: true, message: PaymentsMessageEnum.PLAN_UPGRADED, subscriptionEnd: parsedDate }
      } catch (error) {
        logger.error('CHARGE_SUBSCRIPTION_ERROR', error)
        return { success: false, message: PaymentsMessageEnum.INTERNAL_ERROR, subscriptionEnd: null }
      }
    }

    const currentSubscription = user.userSubscription?.plan
    const subscriptionExpired = user.userSubscription?.subscriptionCurrentPeriodEnd
    const today = new Date()

    if (!currentSubscription || (subscriptionExpired && new Date(subscriptionExpired) <= today)) {
      await Promise.all([
        this.prismaSubscriptionRepository.updateUserSubscription(user.id, 'FREE'),
        this.prismaGroupRepository.updateUserGroupStatus(userId),
      ])
    }
    return { success: false, message: PaymentsMessageEnum.INSUFFICIENT_BALANCE, subscriptionEnd: null }
  }

  public async autoReChargeSubscription(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<{ success: boolean; message: PaymentsMessageEnum; subscriptionEnd: string | null }> {
    const user = await this.prismaUserRepository.getById(userId)

    if (!user) {
      return { success: false, message: PaymentsMessageEnum.NO_USER_FOUND, subscriptionEnd: null }
    }

    const balance = await this.userBalances.userPersonalSolBalance(user.personalWalletPubKey)

    if (balance === null || balance === undefined) {
      await Promise.all([
        this.prismaSubscriptionRepository.updateUserSubscription(user.id, 'FREE'),
        this.prismaGroupRepository.updateUserGroupStatus(userId),
      ])
      return { success: false, message: PaymentsMessageEnum.INSUFFICIENT_BALANCE, subscriptionEnd: null }
    }

    const planFee = planConfigService.getFeeLamports(plan)

    if (planFee === 0) {
      return { success: false, message: PaymentsMessageEnum.INVALID_PLAN, subscriptionEnd: null }
    }

    if (balance >= planFee) {
      try {
        const userPublicKey = new PublicKey(user.personalWalletPubKey)
        await this.executePayment(userPublicKey, user.personalWalletPrivKey, planFee)

        const subscription = await this.prismaSubscriptionRepository.updateUserSubscription(user.id, plan)
        const parsedDate = format(subscription.subscriptionCurrentPeriodEnd!, 'MM/dd/yyyy')

        return { success: true, message: PaymentsMessageEnum.PLAN_UPGRADED, subscriptionEnd: parsedDate }
      } catch (error) {
        logger.error('AUTO_RECHARGE_ERROR', error)
        return { success: false, message: PaymentsMessageEnum.INTERNAL_ERROR, subscriptionEnd: null }
      }
    }

    await Promise.all([
      this.prismaSubscriptionRepository.updateUserSubscription(user.id, 'FREE'),
      this.prismaGroupRepository.updateUserGroupStatus(userId),
    ])

    return { success: false, message: PaymentsMessageEnum.INSUFFICIENT_BALANCE, subscriptionEnd: null }
  }

  public async chargeDonation(
    userId: string,
    donationAmt: number,
  ): Promise<{ success: boolean; message: PaymentsMessageEnum }> {
    const user = await this.prismaUserRepository.getById(userId)

    if (!user) {
      return { success: false, message: PaymentsMessageEnum.NO_USER_FOUND }
    }

    const balance = await this.userBalances.userPersonalSolBalance(user.personalWalletPubKey)

    if (balance === undefined) {
      return { success: false, message: PaymentsMessageEnum.INSUFFICIENT_BALANCE }
    }

    if (balance >= donationAmt) {
      try {
        const userPublicKey = new PublicKey(user.personalWalletPubKey)
        await this.executePayment(userPublicKey, user.personalWalletPrivKey, donationAmt * 1e9)
        await this.prismaUserRepository.hasDonated(userId)

        return { success: true, message: PaymentsMessageEnum.DONATION_MADE }
      } catch (error) {
        logger.error('CHARGE_DONATION_ERROR', error)
        return { success: false, message: PaymentsMessageEnum.INTERNAL_ERROR }
      }
    }

    return { success: false, message: PaymentsMessageEnum.INSUFFICIENT_BALANCE }
  }

  public async chargePromotion(
    userId: string,
    promotionAmt: number,
    promotionType: PromotionType,
  ): Promise<{ success: boolean; message: PaymentsMessageEnum }> {
    const user = await this.prismaUserRepository.getById(userId)

    if (!user) {
      return { success: false, message: PaymentsMessageEnum.NO_USER_FOUND }
    }

    const balance = await this.userBalances.userPersonalSolBalance(user.personalWalletPubKey)

    if (balance === undefined) {
      return { success: false, message: PaymentsMessageEnum.INSUFFICIENT_BALANCE }
    }

    if (balance >= promotionAmt) {
      try {
        const userPublicKey = new PublicKey(user.personalWalletPubKey)
        await this.executePayment(userPublicKey, user.personalWalletPrivKey, promotionAmt * 1e9)

        const { message: promMessage } = await this.prismaSubscriptionRepository.buyPromotion(userId, promotionType)

        if (promMessage === 'Non-stackable promotion already purchased') {
          return { success: false, message: PaymentsMessageEnum.USER_ALREADY_PAID }
        }

        return { success: true, message: PaymentsMessageEnum.TRANSACTION_SUCCESS }
      } catch (error) {
        logger.error('CHARGE_PROMOTION_ERROR', error)
        return { success: false, message: PaymentsMessageEnum.INTERNAL_ERROR }
      }
    }

    return { success: false, message: PaymentsMessageEnum.INSUFFICIENT_BALANCE }
  }

  private async executePayment(userPublicKey: PublicKey, encryptedPrivKey: string, lamports: number): Promise<void> {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: this.voidWallet,
        lamports,
      }),
    )
    const keypair = this.getKeypairFromPrivateKey(encryptedPrivKey)
    const signature = await RpcConnectionManager.getRandomConnection().sendTransaction(transaction, [keypair])
    // Zero the secret key bytes after use
    keypair.secretKey.fill(0)
    logger.info('Transaction signature:', signature)
  }

  private getKeypairFromPrivateKey(encryptedPrivateKey: string): Keypair {
    const secretKey = Buffer.from(CryptoUtil.decrypt(encryptedPrivateKey), 'base64')
    return Keypair.fromSecretKey(secretKey)
  }
}
