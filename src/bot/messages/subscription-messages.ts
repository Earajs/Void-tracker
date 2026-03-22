import { format, formatDistanceToNow } from 'date-fns'
import { BOT_USERNAME } from '../../constants/bot-config'
import { UserWithSubscriptionPlan } from '../../types/prisma-types'
import { SubscriptionPlan } from '@prisma/client'
import { planConfigService } from '../../services/plan-config-service'

export class SubscriptionMessages {
  constructor() {}

  static upgradeProMessage(user: UserWithSubscriptionPlan | null): string {
    const subscriptionExists = user?.userSubscription ? true : false

    const subscriptionPlan = subscriptionExists ? user?.userSubscription?.plan : 'FREE'

    const subscriptionEnd = user?.userSubscription?.subscriptionCurrentPeriodEnd
    const formattedDate = subscriptionEnd
      ? `${formatDistanceToNow(subscriptionEnd, { addSuffix: true })} (${format(subscriptionEnd, 'MMM d, yyyy')})`
      : 'N/A'

    const hobbyLimits = planConfigService.getLimits('HOBBY')
    const proLimits = planConfigService.getLimits('PRO')
    const whaleLimits = planConfigService.getLimits('WHALE')

    const messageText = `
 Current plan: ${subscriptionPlan === 'FREE' ? `😿 <b>${subscriptionPlan}</b>` : `😺 <b>${subscriptionPlan}</b>`}
 ${subscriptionPlan !== 'FREE' ? `<b>Your subscription will renew <u>${formattedDate}</u></b>\n` : ''}
 <b>By upgrading to any plan, you can:</b>
 ✅ Track more wallets to expand your monitoring capabilities.
 ✅ Prevent wallet cleanups.
 ✅ Get access to <b>PREMIUM</b> features.

 <b>Choose your plan:</b>
 <b>HOBBY</b>: ${hobbyLimits.maxWallets} wallets - ${hobbyLimits.feeSol} <b>SOL</b> / month 
 <b>PRO</b>: ${proLimits.maxWallets} wallets - ${proLimits.feeSol} <b>SOL</b> / month
 <b>WHALE</b>: ${whaleLimits.maxWallets} wallets - ${whaleLimits.feeSol} <b>SOL</b> / month

 <b>How to upgrade your plan?</b>
 1. Transfer the required <b>SOL</b> to your <b>Void</b> wallet: <code>${user?.personalWalletPubKey}</code>
 2. Now you can select one of the plans below!
 `

    return messageText
  }

  static groupChatNotPro = `
🚫 You can only add Void to a group if you have a <b>PRO</b> or a <b>WHALE</b> subscription.

You can upgrade your plan directly from our official bot:

@${BOT_USERNAME}
`

  static userUpgradeGroups = `
To add <b>Void</b> to Groups, you need a <b>PRO</b> or <b>WHALE</b> subscription

<b>Click the button below to upgrade your subscription and access to our exclusive features!</b>
`

  static userGroupsLimit(maxGroups: number) {
    return `
 You've reached the maximum limit of groups you can add <b>(${maxGroups}).</b> 
 To add a new group, please remove an existing one.
 `
  }

  static subscriptionRenewalMessage(userName: string, planName: SubscriptionPlan) {
    return `
🔔 <b>Subscription Renewal Reminder</b>

Hello ${userName}, 

Your <b>${planName}</b> plan is set to renew <b>Tomorrow</b>. 

To ensure a successful renewal, please make sure your <b>Void wallet</b> has the necessary funds.

Thank you for staying with us!
`
  }

  static planRenewedMessage(subscriptionEnd: string) {
    return `
🎉 Your plan has been successfully renewed! 🐱✨  
✅ Next renewal date: <b>${subscriptionEnd}</b>

Thank you for staying with us! 💖
`
  }
}
