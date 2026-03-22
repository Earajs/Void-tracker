import { WalletPool } from '../config/wallet-pool'
import { BANNED_WALLETS } from '../constants/banned-wallets'
import { RpcConnectionManager } from '../providers/solana'
import { PrismaWalletRepository } from '../repositories/prisma/wallet'
import { SetupWalletWatcherProps } from '../types/general-interfaces'
import { WalletWithUsers } from '../types/swap-types'
import { WatchTransaction } from './watch-transactions'

export class TrackWallets {
  private prismaWalletRepository: PrismaWalletRepository
  private walletWatcher: WatchTransaction

  constructor() {
    this.prismaWalletRepository = new PrismaWalletRepository()
    this.walletWatcher = new WatchTransaction()
  }

  public async setupWalletWatcher({ event, walletId }: SetupWalletWatcherProps): Promise<void> {
    if (event === 'delete' && walletId) {
      const refetchedWallet = await this.prismaWalletRepository.getWalletByIdForArray(walletId)

      if (refetchedWallet) {
        const existingWalletIndex = WalletPool.wallets.findIndex((wallet) => wallet.address === refetchedWallet.address)

        if (existingWalletIndex !== -1) {
          const subscriptionId = WalletPool.subscriptions.get(refetchedWallet.address)
          if (subscriptionId) {
            await RpcConnectionManager.logConnection.removeOnLogsListener(subscriptionId)
            WalletPool.subscriptions.delete(refetchedWallet.address)
          }

          if (refetchedWallet.userWallets.length === 0) {
            WalletPool.wallets.splice(existingWalletIndex, 1)
          } else {
            WalletPool.wallets[existingWalletIndex] = refetchedWallet
          }

          await this.walletWatcher.refreshPausedUsersCache()
          return await this.updateWallets(WalletPool.wallets)
        }
      }
    } else if (event === 'create' && walletId) {
      const refetchedWallet = await this.prismaWalletRepository.getWalletByIdForArray(walletId)

      if (refetchedWallet) {
        const existingWalletIndex = WalletPool.wallets.findIndex((wallet) => wallet.address === refetchedWallet.address)

        if (existingWalletIndex !== -1) {
          WalletPool.wallets[existingWalletIndex] = refetchedWallet
          const subscriptionId = WalletPool.subscriptions.get(refetchedWallet.address)
          if (subscriptionId) {
            await RpcConnectionManager.logConnection.removeOnLogsListener(subscriptionId)
          }
          WalletPool.subscriptions.delete(refetchedWallet.address)
        } else {
          WalletPool.wallets.push(refetchedWallet)
        }
      }

      return await this.updateWallets(WalletPool.wallets)
    } else if (event === 'update' && walletId) {
      const bannedWallet = await this.prismaWalletRepository.getWalletById(walletId)
      if (!bannedWallet?.address) return
      const subscriptionId = WalletPool.subscriptions.get(bannedWallet.address)

      if (subscriptionId) {
        await RpcConnectionManager.logConnection.removeOnLogsListener(subscriptionId)
        WalletPool.subscriptions.delete(bannedWallet.address)
        BANNED_WALLETS.add(bannedWallet.address)
      }
    } else if (event === 'initial') {
      const allWallets = await this.prismaWalletRepository.getAllWalletsWithUserIds()

      if (!allWallets) return

      const pausedWallets = allWallets.filter((wallet) =>
        wallet.userWallets.some((userWallet) => userWallet.status === 'SPAM_PAUSED'),
      )

      if (pausedWallets.length > 0) {
        for (const wallet of pausedWallets) {
          for (const userWallet of wallet.userWallets) {
            if (userWallet.status === 'SPAM_PAUSED') {
              await this.prismaWalletRepository.resumeUserWallet(userWallet.userId, userWallet.walletId)
            }
          }
        }
      }

      WalletPool.wallets.push(...allWallets)
      return await this.walletWatcher.watchSocket(WalletPool.wallets)
    }
  }

  public async stopWatching(): Promise<void> {
    for (const [wallet, subscriptionId] of WalletPool.subscriptions) {
      RpcConnectionManager.logConnection.removeOnLogsListener(subscriptionId)
    }
    WalletPool.subscriptions.clear()
  }

  public async updateWallets(newWallets: WalletWithUsers[]): Promise<void> {
    await this.walletWatcher.watchSocket(newWallets)
  }

  public async stopWatchingWallet(walletId: string): Promise<void> {
    const walletAddress = await this.prismaWalletRepository.getWalletById(walletId)
    if (!walletAddress) return
    const subscriptionId = WalletPool.subscriptions.get(walletAddress.address)
    if (subscriptionId && walletAddress.userWallets.length < 1) {
      RpcConnectionManager.logConnection.removeOnLogsListener(subscriptionId)
      WalletPool.subscriptions.delete(walletAddress.address)
    }
  }
}
