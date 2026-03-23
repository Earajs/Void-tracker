import { SubscriptionPlan } from '@prisma/client'
import { CreateWallet } from '../../lib/create-wallet'
import { CreateUserGroupInterface, CreateUserInterface } from '../../types/general-interfaces'
import prisma from '../../providers/prisma'
import { CryptoUtil } from '../../lib/crypto-utils'
import { logger } from '../../lib/logger'

export class PrismaUserRepository {
  private createWallet: CreateWallet
  constructor() {
    this.createWallet = new CreateWallet()
  }

  public async create({ firstName, id, lastName, username }: CreateUserInterface) {
    const { publicKey, privateKey } = this.createWallet.create()

    const newUser = await prisma.user.create({
      data: {
        firstName,
        id,
        lastName,
        username,
        personalWalletPubKey: publicKey,
        personalWalletPrivKey: privateKey,
      },
    })

    return newUser
  }

  public async getById(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        personalWalletPrivKey: true,
        personalWalletPubKey: true,
        hasDonated: true,
        userSubscription: {
          select: {
            plan: true,
            subscriptionCurrentPeriodEnd: true,
          },
        },
        _count: {
          select: {
            userWallets: true,
          },
        },
      },
    })

    return user
  }

  public async getUserPlan(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        personalWalletPubKey: true,
        userSubscription: {
          select: {
            plan: true,
            subscriptionCurrentPeriodEnd: true,
          },
        },
      },
    })

    return user
  }

  public async getPersonalWallet(userId: string) {
    const walletBalance = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        personalWalletPubKey: true,
      },
    })

    return walletBalance
  }

  public async hasDonated(userId: string) {
    try {
      const buyCode = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          hasDonated: true,
        },
      })

      return buyCode
    } catch (error) {
      logger.error('BUY_SOURCE_CODE_ERROR', error)
      return
    }
  }

  public async getUsersWithDue() {
    try {
      const today = new Date()
      today.setHours(23, 59, 59, 999)

      const usersToCharge = await prisma.userSubscription.findMany({
        where: {
          subscriptionCurrentPeriodEnd: {
            lte: today,
          },
          isCanceled: false,
          plan: {
            not: 'FREE',
          },
        },
      })

      return usersToCharge
    } catch (error) {
      logger.error('GET_USERS_TO_CHARGE_ERROR', error)
      return []
    }
  }

  public async getUsersWithEndingTomorrow() {
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0) // Reset time to start of day

      const usersToRenew = await prisma.userSubscription.findMany({
        where: {
          subscriptionCurrentPeriodEnd: {
            equals: tomorrow,
          },
          isCanceled: false,
          plan: {
            not: 'FREE',
          },
        },
        select: {
          plan: true,
          id: true,
          userId: true,
          user: {
            select: {
              username: true,
            },
          },
        },
      })

      return usersToRenew
    } catch (error) {
      logger.error('GET_USERS_WITH_ENDING_TOMORROW_ERROR', error)
      return []
    }
  }

  public async updateUserHandiCatStatus(
    userId: string,
  ): Promise<{ status: string; message: string; changedStatus: 'NONE' | 'ACTIVE' | 'PAUSED' }> {
    try {
      const currentStatus = await prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          botStatus: true,
        },
      })

      const newStatus = currentStatus?.botStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'

      await prisma.user.update({
        where: { id: userId },
        data: { botStatus: newStatus },
      })

      return { status: 'ok', message: 'status updated', changedStatus: newStatus }
    } catch (error) {
      logger.error('UPDATE_HANDICAT_STATUS_ERROR', error)
      return { status: 'error', message: 'An error occurred while updating bot status', changedStatus: 'NONE' }
    }
  }

  public async showUserPrivateKey(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          personalWalletPrivKey: true,
        },
      })

      if (!user) {
        logger.info('Failed to retrieve user private key')
        return
      }

      const decryptedKey = CryptoUtil.decrypt(user.personalWalletPrivKey)
      const trimmedPrivateKey = decryptedKey.replace(/=*$/, '')

      return trimmedPrivateKey
    } catch (error) {
      logger.error('SHOW_PRIVATE_KEY_ERROR', error)
      return
    }
  }

  public async getFreeUsers(take = 1000, skip = 0) {
    try {
      const freeUsers = await prisma.user.findMany({
        where: {
          AND: [
            {
              OR: [{ userSubscription: null }, { userSubscription: { plan: 'FREE' } }],
            },
            { userPromotions: { none: {} } },
          ],
        },
        take,
        skip,
      })

      return freeUsers
    } catch (error) {
      logger.error('GET_FREE_USERS_ERROR', error)
      return
    }
  }

  public async getPausedUsers(userIds: string[]): Promise<string[]> {
    try {
      const pausedUsers = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
          NOT: {
            botStatus: 'ACTIVE',
          },
        },
        select: {
          id: true,
        },
      })

      return pausedUsers.map((user) => user.id)
    } catch (error) {
      logger.error('GET_PAUSED_USERS_ERROR', error)
      return []
    }
  }

  public async getBotStatus(userId: string) {
    try {
      const botStatus = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          botStatus: true,
        },
      })

      return botStatus
    } catch (error) {
      logger.error('GET_BOT_STATUS_ERROR', error)
      return
    }
  }

  public async getNotificationPrefs(userId: string) {
    try {
      const prefs = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          notifyBuys: true,
          notifySells: true,
          notifyTransfers: true,
        },
      })

      return prefs
    } catch (error) {
      logger.error('GET_NOTIFICATION_PREFS_ERROR', error)
      return
    }
  }

  public async updateNotificationPref(userId: string, pref: 'notifyBuys' | 'notifySells' | 'notifyTransfers') {
    try {
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { [pref]: true },
      })

      if (!current) return

      await prisma.user.update({
        where: { id: userId },
        data: { [pref]: !current[pref] },
      })

      return !current[pref]
    } catch (error) {
      logger.error('UPDATE_NOTIFICATION_PREF_ERROR', error)
      return
    }
  }
}
