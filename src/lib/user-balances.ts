import { PublicKey } from '@solana/web3.js'
import { RpcConnectionManager } from '../providers/solana'
import { logger } from '../lib/logger'

export class UserBalances {
  constructor() {}

  public async userPersonalSolBalance(walletAddress: string): Promise<number | undefined> {
    try {
      const publicKey = new PublicKey(walletAddress)

      const balance = await RpcConnectionManager.getRandomConnection().getBalance(publicKey)

      // Convert lamports to SOL
      const solBalance = balance / 1_000_000_000

      // logger.info(`Balance: ${solBalance} SOL`);

      return balance
    } catch (error) {
      logger.error('USER_FETCH_BALANCE_ERROR', error)
      return
    }
  }
}
