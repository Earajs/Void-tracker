import { InlineKeyboardMarkup } from 'node-telegram-bot-api'
import { HandiCatStatus } from '@prisma/client'
import { planConfigService } from '../services/plan-config-service'

export const START_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    // [{ text: '🌟 Buy Limited-Time Offer', callback_data: 'buy_promotion' }],
    [
      { text: '🔮 Add', callback_data: 'add' },
      { text: '👀 Manage', callback_data: 'manage' },
    ],
    [
      { text: '👛 My Wallet', callback_data: 'my_wallet' },
      { text: '❤️ Donate', callback_data: 'donate' },
      { text: '⚙️ Settings', callback_data: 'settings' },
    ],
    [
      { text: '🆕 Groups', callback_data: 'groups' },
      { text: '🔎 Help', callback_data: 'help' },
    ],
    [{ text: '👑 Upgrade', callback_data: 'upgrade' }],
  ],
}

export const SUB_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_to_main_menu' }]],
}

export const createTxSubMenu = (tokenSymbol: string, tokenMint: string) => {
  const txSubMenu: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: `🐴 Buy on Trojan: ${tokenSymbol}`,
          url: `https://t.me/solana_trojanbot?start=r-handicatbt-${tokenMint}`,
        },
      ],
      [
        { text: `🐶 BonkBot: ${tokenSymbol}`, url: `https://t.me/bonkbot_bot?start=ref_3au54_ca_${tokenMint}` },
        {
          text: `⭐ Axiom: ${tokenSymbol}`,
          url: `https://axiom.trade/t/${tokenMint}/@handi`,
        },
      ],
      [
        {
          text: `🦖 GMGN: ${tokenSymbol}`,
          url: `https://t.me/GMGN_sol_bot?start=i_kxPdcLKf_c_${tokenMint}`,
        },
      ],
    ],
  }

  return txSubMenu
}

export const MANAGE_SUB_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '🔮 Add', callback_data: 'add' },
      { text: '🗑️ Delete', callback_data: 'delete' },
    ],

    [{ text: '🔙 Back', callback_data: 'back_to_main_menu' }],
  ],
}

export function getUpgradePlanSubMenu(): InlineKeyboardMarkup {
  const hobby = planConfigService.getLimits('HOBBY')
  const pro = planConfigService.getLimits('PRO')
  const whale = planConfigService.getLimits('WHALE')

  return {
    inline_keyboard: [
      [
        {
          text: `BUY HOBBY ${hobby.feeSol} SOL/m`,
          callback_data: 'upgrade_hobby',
        },
      ],
      [
        {
          text: `BUY PRO ${pro.feeSol} SOL/m`,
          callback_data: 'upgrade_pro',
        },
      ],
      [
        {
          text: `BUY WHALE ${whale.feeSol} SOL/m`,
          callback_data: 'upgrade_whale',
        },
      ],

      [{ text: '🔙 Back', callback_data: 'back_to_main_menu' }],
    ],
  }
}

export const DONATE_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: `❤️ ${0.1} SOL`, callback_data: 'donate_action_0.1' }],
    [{ text: `✨ ${0.5} SOL`, callback_data: 'donate_action_0.5' }],
    [{ text: `💪 ${1.0} SOL`, callback_data: 'donate_action_1.0' }],
    [{ text: `🗿 ${5.0} SOL`, callback_data: 'donate_action_5.0' }],
    [{ text: `🔥 ${10.0} SOL`, callback_data: 'donate_action_10.0' }],
    [{ text: '🔙 Back', callback_data: 'back_to_main_menu' }],
  ],
}

export const SUGGEST_UPGRADE_SUBMENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: '👑 Upgrade', callback_data: 'upgrade' }],
    [{ text: '🔙 Back', callback_data: 'back_to_main_menu' }],
  ],
}

export const INSUFFICIENT_BALANCE_SUB_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: '😺 Your Void Wallet', callback_data: 'my_wallet' }],
    [{ text: '🔙 Back', callback_data: 'back_to_main_menu' }],
  ],
}

export const USER_SETTINGS_MENU = (botStatus: HandiCatStatus): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [
        {
          text: `${botStatus === 'ACTIVE' ? '⏸️ Pause Void' : '▶️ Resume Void'}`,
          callback_data: 'pause-resume-bot',
        },
      ],
      [{ text: '🔔 Transaction Filters', callback_data: 'tx_filters' }],
      [{ text: '🔙 Back', callback_data: 'back_to_main_menu' }],
    ],
  }
}

export const TX_FILTER_MENU = (
  notifyBuys: boolean,
  notifySells: boolean,
  notifyTransfers: boolean,
): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [
        { text: `📈 Buy ${notifyBuys ? 'ON' : 'OFF'}`, callback_data: 'tx_filter_buy' },
        { text: `📉 Sell ${notifySells ? 'ON' : 'OFF'}`, callback_data: 'tx_filter_sell' },
        { text: `💸 Transfer ${notifyTransfers ? 'ON' : 'OFF'}`, callback_data: 'tx_filter_transfer' },
      ],
      [{ text: '🔙 Back', callback_data: 'settings' }],
    ],
  }
}

export const USER_WALLET_SUB_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      {
        text: '🔑 Show private key',
        callback_data: 'show_private_key',
      },
    ],
    [{ text: '🔙 Back', callback_data: 'back_to_main_menu' }],
  ],
}

export const GROUPS_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      {
        text: '🗑️ Delete Group',
        callback_data: 'delete_group',
      },
    ],
    [{ text: '🔙 Back', callback_data: 'back_to_main_menu' }],
  ],
}

export const GRANT_PREMIUM_PLAN_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      {
        text: '🐣 HOBBY',
        callback_data: 'grant_hobby',
      },
      {
        text: '🚀 PRO',
        callback_data: 'grant_pro',
      },
      {
        text: '🐋 WHALE',
        callback_data: 'grant_whale',
      },
    ],
    [{ text: '❌ Cancel', callback_data: 'grant_cancel' }],
  ],
}

export const SETLIMIT_PLAN_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '🐣 HOBBY', callback_data: 'setlimit_plan_HOBBY' },
      { text: '🚀 PRO', callback_data: 'setlimit_plan_PRO' },
      { text: '🐋 WHALE', callback_data: 'setlimit_plan_WHALE' },
    ],
    [{ text: '❌ Cancel', callback_data: 'setlimit_cancel' }],
  ],
}

export const SETLIMIT_FIELD_MENU: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '💼 Max Wallets', callback_data: 'setlimit_field_maxWallets' },
      { text: '💬 Daily Messages', callback_data: 'setlimit_field_maxDailyMessages' },
    ],
    [
      { text: '👥 Max Groups', callback_data: 'setlimit_field_maxGroups' },
      { text: '💰 Fee (SOL)', callback_data: 'setlimit_field_feeSol' },
    ],
    [{ text: '❌ Cancel', callback_data: 'setlimit_cancel' }],
  ],
}
