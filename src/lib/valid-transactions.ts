import { Logs } from '@solana/web3.js'
import { SwapType } from '../types/swap-types'
import {
  JUPITER_PROGRAM_ID,
  PUMP_FUN_PROGRAM_ID,
  PUMP_FUN_TOKEN_MINT_AUTH,
  PUMPFUN_AMM_PROGRAM_ID,
  RAYDIUM_PROGRAM_ID,
} from '../config/program-ids'

export class ValidTransactions {
  static isRelevantTransaction(logs: Logs): { isRelevant: boolean; swap: SwapType } {
    if (!logs.logs || logs.logs.length === 0) {
      return { isRelevant: false, swap: null }
    }

    const logString = logs.logs.join(' ')

    if (logString.includes(PUMPFUN_AMM_PROGRAM_ID)) return { isRelevant: true, swap: 'pumpfun_amm' }
    if (logString.includes(PUMP_FUN_TOKEN_MINT_AUTH)) return { isRelevant: true, swap: 'mint_pumpfun' }
    if (logString.includes(PUMP_FUN_PROGRAM_ID)) return { isRelevant: true, swap: 'pumpfun' }
    if (logString.includes(JUPITER_PROGRAM_ID)) return { isRelevant: true, swap: 'jupiter' }
    if (logString.includes(RAYDIUM_PROGRAM_ID)) return { isRelevant: true, swap: 'raydium' }

    let systemProgramCount = 0
    for (const log of logs.logs) {
      if (log.includes('11111111111111111111111111111111')) {
        systemProgramCount++
        if (systemProgramCount > 2) break
      }
    }

    if (systemProgramCount > 0 && systemProgramCount <= 2) {
      return { isRelevant: true, swap: 'sol_transfer' }
    }

    return { isRelevant: false, swap: null }
  }
}
