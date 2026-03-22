import SolanaWeb3 from '@solana/web3.js'
import { CryptoUtil } from './crypto-utils'
import { logger } from '../lib/logger'

export class CreateWallet {
  constructor() {}

  public create() {
    const keypair = SolanaWeb3.Keypair.generate()

    const publicKey = keypair.publicKey.toString()
    const privateKey = Buffer.from(keypair.secretKey).toString('base64')

    const encryptedPrivateKey = CryptoUtil.encrypt(privateKey)

    logger.info('Public Key (wallet Address):', publicKey)

    return { publicKey, privateKey: encryptedPrivateKey }
  }
}
