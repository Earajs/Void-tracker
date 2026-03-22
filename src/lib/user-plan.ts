import { SubscriptionPlan } from '@prisma/client'
import { PrismaSubscriptionRepository } from '../repositories/prisma/subscription'
import { planConfigService } from '../services/plan-config-service'

export class UserPlan {
  private prismaSubscriptionRepository: PrismaSubscriptionRepository
  constructor() {
    this.prismaSubscriptionRepository = new PrismaSubscriptionRepository()
  }

  public async getUserPlanWallets(userId: string): Promise<number> {
    const userData = await this.prismaSubscriptionRepository.getUserPlanWallets(userId)

    const plan = (userData?.userSubscription?.plan || 'FREE') as SubscriptionPlan

    const getPromotionWallets = (userPromotions: any[] | undefined): number | null => {
      if (userPromotions && userPromotions.some((promo) => promo.promotion.type === 'UPGRADE_TO_50_WALLETS')) {
        return 50
      }
      return null
    }

    const planWallets = getPromotionWallets(userData?.userPromotions) ?? planConfigService.getLimits(plan).maxWallets

    return planWallets
  }
}
