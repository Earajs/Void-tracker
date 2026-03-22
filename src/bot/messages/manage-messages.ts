import { WalletDetails } from '../../lib/wallet-details'
import { UserWallet } from '../../types/prisma-types'

export class ManageMessages {
  static manageMessage(userWallets: UserWallet[], walletsAmt: number) {
    const messageText = `
<b>Your wallets: ${userWallets.length} / ${walletsAmt}</b>

✅ - Wallet is active
⏳ - Wallet was sending too many txs and is paused
🛑 - Wallet was banned

${userWallets
  .map((wallet, i) => {
    const icon =
      wallet.status === 'ACTIVE'
        ? '✅'
        : wallet.status === 'USER_PAUSED'
          ? '⏸️'
          : wallet.status === 'SPAM_PAUSED'
            ? '⏳'
            : wallet.status === 'BANNED'
              ? '🛑'
              : ''
    return `${icon} ${i + 1}. <code>${wallet.wallet.address}</code> ${wallet.name ? `(${wallet.name})` : ''}`
  })
  .join('\n\n')}
`

    return messageText
  }
}
