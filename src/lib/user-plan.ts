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
    const hasUpgradePromo = userData?.userPromotions?.some((promo: any) => promo.promotion.type === 'UPGRADE_TO_50_WALLETS')
    return hasUpgradePromo ? 50 : planConfigService.getLimits(plan).maxWallets
  }
}
