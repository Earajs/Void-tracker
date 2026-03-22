import { Connection, clusterApiUrl } from '@solana/web3.js'
import chalk from 'chalk'
import dotenv from 'dotenv'
import { logger } from '../lib/logger'

dotenv.config()

const HELIUS_NETWORK = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`

const RPC_ENDPOINTS =
  process.env.RPC_ENDPOINTS?.split(',')
    .map((url) => url.trim())
    .filter(Boolean) ?? []

logger.info(chalk.bold.greenBright(`LOADED ${RPC_ENDPOINTS.length} RPC ENDPOINTS`))

const FALLBACK_CONNECTION = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed')

export class RpcConnectionManager {
  static connections: Connection[] =
    RPC_ENDPOINTS.length > 0 ? RPC_ENDPOINTS.map((url) => new Connection(url, 'confirmed')) : [FALLBACK_CONNECTION]

  static logConnection = new Connection(HELIUS_NETWORK, 'processed')

  static getRandomConnection(): Connection {
    const randomIndex = Math.floor(Math.random() * RpcConnectionManager.connections.length)
    return RpcConnectionManager.connections[randomIndex]
  }

  static resetLogConnection() {
    RpcConnectionManager.logConnection = new Connection(HELIUS_NETWORK, 'processed')
  }
}
