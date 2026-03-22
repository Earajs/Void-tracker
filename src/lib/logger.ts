type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const activeLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info'

function log(level: LogLevel, tag: string, ...args: unknown[]): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[activeLevel]) return
  const ts = new Date().toISOString()
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(`[${ts}] [${level.toUpperCase()}] ${tag}`, ...args)
}

export const logger = {
  debug: (tag: string, ...args: unknown[]) => log('debug', tag, ...args),
  info: (tag: string, ...args: unknown[]) => log('info', tag, ...args),
  warn: (tag: string, ...args: unknown[]) => log('warn', tag, ...args),
  error: (tag: string, ...args: unknown[]) => log('error', tag, ...args),
}
