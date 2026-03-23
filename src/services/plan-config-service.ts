import { SubscriptionPlan } from '@prisma/client'
import prisma from '../providers/prisma'

export interface PlanLimits {
  maxWallets: number
  maxDailyMessages: number
  maxGroups: number
  feeSol: number
}

const DEFAULT_CONFIG: Record<SubscriptionPlan, PlanLimits> = {
  FREE: { maxWallets: 10, maxDailyMessages: 1000, maxGroups: 0, feeSol: 0 },
  HOBBY: { maxWallets: 50, maxDailyMessages: 1000, maxGroups: 0, feeSol: 0.1 },
  PRO: { maxWallets: 100, maxDailyMessages: 0, maxGroups: 5, feeSol: 0.4 },
  WHALE: { maxWallets: 220, maxDailyMessages: 0, maxGroups: 5, feeSol: 0.8 },
}

export class PlanConfigService {
  private cache: Map<SubscriptionPlan, PlanLimits> = new Map()
  private initialized = false

  public async initialize(): Promise<void> {
    if (this.initialized) return

    const configs = await prisma.planConfig.findMany()

    if (configs.length === 0) {
      await this.seedDefaults()
      const seeded = await prisma.planConfig.findMany()
      for (const cfg of seeded) {
        this.cache.set(cfg.plan, {
          maxWallets: cfg.maxWallets,
          maxDailyMessages: cfg.maxDailyMessages,
          maxGroups: cfg.maxGroups,
          feeSol: cfg.feeSol,
        })
      }
    } else {
      for (const cfg of configs) {
        this.cache.set(cfg.plan, {
          maxWallets: cfg.maxWallets,
          maxDailyMessages: cfg.maxDailyMessages,
          maxGroups: cfg.maxGroups,
          feeSol: cfg.feeSol,
        })
      }
    }

    this.initialized = true
  }

  public getLimits(plan: SubscriptionPlan): PlanLimits {
    return this.cache.get(plan) ?? DEFAULT_CONFIG[plan]
  }

  public async updateLimit(plan: SubscriptionPlan, field: keyof PlanLimits, value: number): Promise<void> {
    await prisma.planConfig.upsert({
      where: { plan },
      create: { plan, ...DEFAULT_CONFIG[plan], [field]: value },
      update: { [field]: value },
    })

    const current = this.cache.get(plan) ?? { ...DEFAULT_CONFIG[plan] }
    current[field] = value
    this.cache.set(plan, current)
  }

  public getFeeLamports(plan: SubscriptionPlan): number {
    return Math.round(this.getLimits(plan).feeSol * 1e9)
  }

  private async seedDefaults(): Promise<void> {
    const plans: SubscriptionPlan[] = ['FREE', 'HOBBY', 'PRO', 'WHALE']
    await prisma.$transaction(
      plans.map((plan) =>
        prisma.planConfig.create({
          data: {
            plan,
            maxWallets: DEFAULT_CONFIG[plan].maxWallets,
            maxDailyMessages: DEFAULT_CONFIG[plan].maxDailyMessages,
            maxGroups: DEFAULT_CONFIG[plan].maxGroups,
            feeSol: DEFAULT_CONFIG[plan].feeSol,
          },
        }),
      ),
    )
  }
}

export const planConfigService = new PlanConfigService()
