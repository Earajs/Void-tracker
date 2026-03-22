import { SubscriptionPlan } from '@prisma/client'
import { UserPrisma } from '../../types/prisma-types'
import { UserGroup } from '../../types/general-interfaces'
import { planConfigService } from '../../services/plan-config-service'

export class GeneralMessages {
  constructor() {}

  static startMessage(user: UserPrisma): string {
    const plan = (user?.userSubscription?.plan || 'FREE') as SubscriptionPlan
    const limits = planConfigService.getLimits(plan)

    const messageText = `
🐱 Void | Wallet Tracker

Get real time activity notifications for any wallet you add!

You are currently tracking <b>${user?._count.userWallets || 0} / ${limits.maxWallets} wallets</b> ✨

🆙 Click the <b>Upgrade</b> button to unlock more wallet slots and retain your tracked wallets! 

🚨 <b>Note for Free Users:</b>  
To ensure smooth performance for everyone, free wallets may be cleaned up periodically. Consider upgrading to retain all your tracked wallets! 🚀
`

    return messageText
  }

  static startMessageGroup = `
🐱 Void | Wallet Tracker

Get real time activity notifications for any wallet you add!

You must have a Void <b>PRO</b> or <b>WHALE</b> subscription to use this bot in a group

<b>These are the commands available:</b>
- /add Add a new wallet
- /delete Delete a wallet
- /manage View all wallets
`

  static planUpgradedMessage(plan: SubscriptionPlan, subscriptionEnd: string): string {
    const limits = planConfigService.getLimits(plan)

    const messageText = `
 😸 Success! Your plan has been upgraded to <b>${plan}</b>.
 Your subscription will renew at ${subscriptionEnd}

 You can now track up to <b>${limits.maxWallets}</b> wallets at the time!
 `

    return messageText
  }

  static insufficientBalanceMessage: string = `
😿 Ooops it seems that you don't have sufficient balance to perform this transaction.

You can try by adding some <b>SOL</b> to your Void personal wallet 😺
`

  static userAlreadyPaidMessage(action: 'CODE' | 'PLAN'): string {
    const messageText = `
🤝 You already purchased this ${action.toLowerCase()} 
`

    return messageText
  }

  static walletLimitMessageError(walletName: string | undefined, walletAddress: string, planWallets: number): string {
    const messageText = `
😾 Could not add wallet: <code>${walletName ? walletName : walletAddress}</code>, 

Wallet limit reached: <b>${planWallets}</b>

You can try by upgrading your <b>plan</b> for more wallets 💎
`

    return messageText
  }

  static generalMessageError: string = `
😿 Ooops it seems that something went wrong while processing the transaction.

You probaly don't have sufficient balance in your wallet or it can't cover the transaction fees.

Maybe try adding some <b>SOL</b> to your Void personal wallet 😺
`

  static botWalletError: string = `
😿 Oops! it seems that this wallet is spamming to many tps, Please enter another wallet or try again later.
`

  static groupsMessage(userGroups: UserGroup[], maxGroups?: number) {
    const limits = planConfigService.getLimits('PRO')
    const groupLimit = maxGroups ?? limits.maxGroups

    const groupsContent =
      userGroups.length === 0
        ? `     
 <i>You do not have any groups yet.</i>
 `
        : userGroups
            .map(
              (group, i) => `
 ✅ Group Name: <b>${group.name}</b>
 🔗 Group ID: <code>${group.id}</code>

 `,
            )
            .join('\n\n')

    const messageText = `
 You can now use <b>Void</b> in any group chat!

 Your groups: (${userGroups.length} / ${groupLimit})
 ${groupsContent}
 Learn how to add <b>Void</b> to a group chat: /help_group
 `
    return messageText
  }

  static groupChatNotStarted = `
🚫 You cannot change Void settings in this group

Bot is not initiated. Send /start
`

  static groupChatNotActivated = `
🚫 You cannot change Void settings in this group

Bot is not activated. Send /activate
`

  static userNotAuthorizedInGroup = `
🚫 You cannot change Void settings in this group

you are not authorized to perform this action.
`

  static deleteGroupMessage = `
To <b>remove</b> a group from your list, simply send me the <u>Group ID</u> of the group you'd like to delete.
`

  static groupDeletedMessage = `
This group has been deleted from your list!
`
  static failedToDeleteGroupMessage = `
Failed to delete group, make sure you provided a valid <b>Group ID</b>
`
}
