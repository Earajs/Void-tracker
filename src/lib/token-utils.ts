import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js'
// @ts-expect-error
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token'

import { Metadata, deprecated } from '@metaplex-foundation/mpl-token-metadata'

import axios from 'axios'
import { PoolInfoLayout, SqrtPriceMath } from '@raydium-io/raydium-sdk'
import dotenv from 'dotenv'

import { RpcConnectionManager } from '../providers/solana'
import { FormatNumbers } from './format-numbers'
import { ParsedTokenInfo } from '../types/general-interfaces'
import { logger } from '../lib/logger'

dotenv.config()

export class TokenUtils {
  constructor(private connection: Connection) {
    this.connection = connection
  }
  public async getTokenMintAddress(tokenAddress: string) {
    try {
      const tokenPublicKey = new PublicKey(tokenAddress)
      const accountInfo = await getAccount(this.connection, tokenPublicKey)
      return accountInfo.mint.toBase58()
    } catch (error) {
      logger.info(`Error fetching mint address for token ${tokenAddress}:`, error)
      return null
    }
  }

  public async getTokenMintAddressWithFallback(transactions: any) {
    let tokenOutMint = null

    if (transactions[0]?.info?.destination) {
      tokenOutMint = await this.getTokenMintAddress(transactions[0].info.destination)
    }

    if (!tokenOutMint && transactions[0]?.info?.source) {
      tokenOutMint = await this.getTokenMintAddress(transactions[0].info.source)
    }

    return tokenOutMint
  }

  public calculateNativeBalanceChanges(transactionDetails: (ParsedTransactionWithMeta | null)[]) {
    const meta = transactionDetails[0] && transactionDetails[0].meta

    if (!meta) {
      logger.info('No meta information available')
      return
    }

    const preBalances = meta.preBalances
    const postBalances = meta.postBalances

    if (!preBalances || !postBalances) {
      logger.info('No balance information available')
      return
    }

    const balanceChanges = []

    // Calculate SOL balance changes for each account
    for (let i = 0; i < preBalances.length; i++) {
      const preBalance = preBalances[i]
      const postBalance = postBalances[i]
      const solDifference = (postBalance! - preBalance!) / 1e9 // Convert lamports to SOL

      if (solDifference !== 0) {
        balanceChanges.push({
          accountIndex: i,
          preBalance: preBalance! / 1e9, // Convert to SOL
          postBalance: postBalance! / 1e9, // Convert to SOL
          change: solDifference,
        })
      }
    }

    if (balanceChanges.length > 0) {
      const firstChange = balanceChanges[0]
      const type = firstChange!.change > 0 ? 'sell' : 'buy'
      return {
        type,
        balanceChange: firstChange!.change,
      }
    } else {
      logger.info('No balance changes found')
      return {
        type: '',
        balanceChange: '',
      }
    }
  }

  public async getParsedTokenInfo(tokenMint: string): Promise<ParsedTokenInfo | null> {
    try {
      const mintPublicKey = new PublicKey(tokenMint)
      // const [tokenmetaPubkey, bump] = PublicKey.findProgramAddressSync([], mintPublicKey)
      const tokenmetaPubkey = await deprecated.Metadata.getPDA(mintPublicKey)

      const tokenContent = await Metadata.fromAccountAddress(this.connection, tokenmetaPubkey)

      const token = tokenContent.pretty()

      return token
    } catch (error) {
      logger.error(`Error fetching token info for ${tokenMint}:`, error)
      return null
    }
  }

  static async getSolPriceGecko(): Promise<string | undefined> {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')

      const data = await response.data

      const solanaPrice = data.solana.usd

      return String(solanaPrice)
    } catch (error) {
      logger.error('GET_SOL_PRICE_ERROR', error)
      return
    }
  }

  static async getSolPriceRpc(): Promise<string | undefined> {
    try {
      const id = new PublicKey('8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj')

      const accountInfo = await RpcConnectionManager.getRandomConnection().getAccountInfo(id)

      if (accountInfo === null) {
        logger.info('get pool info error')
        return
      }

      const poolData = PoolInfoLayout.decode(accountInfo.data)

      const solPrice = SqrtPriceMath.sqrtPriceX64ToPrice(
        poolData.sqrtPriceX64,
        poolData.mintDecimalsA,
        poolData.mintDecimalsB,
      ).toFixed(2)

      return solPrice
    } catch (error) {
      logger.error('FETCH_SOL_PRICE_ERROR', error)
      return
    }
  }

  public async getTokenHoldings(
    walletAddress: string,
    tokenMintAddress: string,
    tokenSupply: number,
    isPump: boolean,
  ): Promise<{ balance: string; percentage: string }> {
    try {
      const walletPublicKey = new PublicKey(walletAddress)
      const tokenMintPublicKey = new PublicKey(tokenMintAddress)

      const associatedTokenAddress = await getAssociatedTokenAddress(tokenMintPublicKey, walletPublicKey)
      const tokenAccountInfo = await getAccount(this.connection, associatedTokenAddress)

      const percentage = isPump
        ? Number(tokenAccountInfo.amount) / Number(tokenSupply) / 10000
        : (Number(tokenAccountInfo.amount) / Number(tokenSupply)) * 100
      const fixedPercentage = percentage > 0 ? `${percentage.toFixed(2)}` : '0'

      const balance = FormatNumbers.formatTokenAmount(Number(tokenAccountInfo.amount))

      return {
        balance: balance,
        percentage: fixedPercentage,
      }
    } catch (error) {
      logger.info('Error fetching token holdings, wallet:', walletAddress)

      return { balance: '0', percentage: '0' }
    }
  }
}
