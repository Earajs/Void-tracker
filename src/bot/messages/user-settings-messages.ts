export class UserSettingsMessages {
  constructor() {}

  static settingsMessage: string = `
<b>⚙️ Settings</b>

You can pause or resume Void at anytime just by clicking the button below ✨

If you pause Void, you will no longer get more messages until you resume the bot from this same menu
`

  static txFiltersMessage: string = `
<b>🔔 Transaction Filters</b>

Choose which transactions you want to receive notifications for.
`

  static txFilterUpdatedMessage = (type: 'buy' | 'sell' | 'transfer', enabled: boolean): string => {
    const action = enabled ? 'enabled' : 'disabled'
    return `<b>${type.charAt(0).toUpperCase() + type.slice(1)} notifications ${action}</b>`
  }
}
