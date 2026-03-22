<div align="center">
  <a href="https://github.com/DracoR22/handi-cat_wallet-tracker">
    <img src="showcase/logo.jpg" alt="Handi Cat Logo" width="80" height="80">
  </a>

  <h3>🐱 Handi Cat | Solana Wallet Tracker</h3>
  <p>Real-time Solana wallet tracking via Telegram</p>
</div>

---

[![Bot Screenshot][product-screenshot]](https://t.me/handi_cat_bot)

## About

Handi Cat is a self-hosted Telegram bot that monitors Solana wallets in real time. It detects swaps on **Raydium**, **Jupiter**, **Pump.fun**, and **PumpSwap (Pump AMM)**, and sends rich transaction notifications including token prices, market cap, supply ownership, and quick-buy links to popular trading bots.

Each user gets an auto-generated Solana wallet used for subscription payments — no external payment processor needed.

---

## Features

- 📡 Real-time tracking via Helius `onLogs` WebSocket
- 🔍 Detects swaps on Raydium, Jupiter, Pump.fun, PumpSwap
- 💰 SOL price of swapped token (via CoinGecko + RPC fallback)
- 📊 Token market cap at time of swap
- 🏦 Token amount + supply % owned by tracked wallet
- 🤖 Quick-buy links to Photon, GMGN, Dex Screener
- 👥 Group chat support (PRO/WHALE plans)
- 🔐 Subscription plans with on-chain SOL payments
- 🛡️ Rate limiting, spam detection, wallet banning
- ⚙️ Admin commands for plan management and wallet banning
- 🔄 Auto-renewal with daily cron jobs

---

## Subscription Plans

| Plan  | Max Wallets | Groups | Monthly Fee |
| ----- | ----------- | ------ | ----------- |
| FREE  | 10          | 0      | Free        |
| HOBBY | 50          | 0      | 0.1 SOL     |
| PRO   | 100         | 5      | 0.4 SOL     |
| WHALE | 220         | 5      | 0.8 SOL     |

Plan limits are configurable at runtime via the `/set_limit` admin command.

---

## Bot Commands

| Command          | Description                               | Access    |
| ---------------- | ----------------------------------------- | --------- |
| `/start`         | Open the main menu                        | All users |
| `/add`           | Add a wallet to track                     | All users |
| `/delete`        | Remove a tracked wallet                   | All users |
| `/manage`        | Manage existing wallets                   | All users |
| `/upgrade`       | View and purchase subscription plans      | All users |
| `/help_notify`   | Learn how notifications work              | All users |
| `/help_group`    | Instructions for adding bot to a group    | All users |
| `/ban_wallet`    | Ban a wallet and remove it from the pool  | Admin     |
| `/grant_premium` | Grant a user a premium plan               | Admin     |
| `/set_limit`     | Update plan limits (wallets, groups, fee) | Admin     |

---

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Telegram:** `node-telegram-bot-api` (polling or webhook)
- **Blockchain:** `@solana/web3.js`, Helius WebSocket
- **ORM:** Prisma + PostgreSQL
- **Scheduler:** `node-cron`
- **Markets:** Raydium SDK, Pump.fun curve, GMGN AI API

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm i -g pnpm`)
- PostgreSQL database
- [Helius API key](https://www.helius.dev) (for `onLogs` WebSocket)
- Telegram bot token from [@BotFather](https://t.me/BotFather)

### Setup

1. **Clone the repo**

   ```sh
   git clone https://github.com/DracoR22/handi-cat_wallet-tracker.git
   cd handi-cat_wallet-tracker
   ```

2. **Install dependencies**

   ```sh
   pnpm install
   ```

3. **Configure environment**

   ```sh
   cp .env.example .env
   ```

   Fill in all required values (see [Environment Variables](#environment-variables) below).

4. **Run database migrations**

   ```sh
   pnpm db:migrate
   ```

5. **Start the bot**
   ```sh
   pnpm start
   ```

<p align="center">
  <img src="./showcase/cli-pic.png" width="95%" alt="Bot running in terminal"/>
</p>

---

## Environment Variables

```env
# AES-256 encryption key for private keys at rest
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=

# Helius API key for onLogs WebSocket connection
# Get from: https://www.helius.dev
HELIUS_API_KEY=

# Comma-separated RPC endpoints (more = more wallets trackable)
# e.g. https://rpc1.com,https://rpc2.com
RPC_ENDPOINTS=https://api.mainnet-beta.solana.com

# Telegram bot token from @BotFather
BOT_TOKEN=

# Your Telegram chat ID for admin commands
ADMIN_CHAT_ID=

# PostgreSQL connection string
DATABASE_URL=

# Your Solana wallet address to receive subscription fees
HANDICAT_WALLET_ADDRESS=

# Set to "production" to use webhook, "development" for polling
ENVIRONMENT=development

# Required when ENVIRONMENT=production (no trailing slash)
APP_URL=https://your-domain.com
```

### Webhook Mode (Production)

When `ENVIRONMENT=production`, the bot registers a webhook at `APP_URL/webhook/telegram`. Your server must be publicly accessible over HTTPS.

---

## Utility Scripts

```sh
pnpm db:studio          # Open Prisma Studio (DB browser)
pnpm db:seed            # Seed the database with initial data
pnpm db:backup          # Backup the database
pnpm wallets:cleanup    # Remove stale wallet entries
pnpm send:alert         # Send a broadcast message to all users
```

---

## Project Structure

```
src/
├── main.ts                    # Entry point, wires all services
├── bot/
│   ├── commands/              # /start, /add, /delete, /manage, /upgrade, /admin, ...
│   ├── handlers/              # Callback queries, donations, promotions, tx messages
│   └── messages/              # Message templates (HTML)
├── lib/
│   ├── track-wallets.ts       # Wallet pool setup and watcher orchestration
│   ├── watch-transactions.ts  # Helius onLogs subscription
│   ├── payments.ts            # On-chain SOL subscription charging
│   ├── cron-jobs.ts           # Daily billing, SOL price cache, renewal reminders
│   ├── rate-limit.ts          # Per-wallet spam/rate detection
│   └── ...
├── parsers/
│   └── transaction-parser.ts  # Decodes raw Solana txs into swap events
├── markets/
│   ├── token-market-price.ts  # Token price + market cap fetching
│   └── pump-market-curve.ts   # Pump.fun bonding curve price calc
├── repositories/prisma/       # DB access layer (user, wallet, subscription, group)
├── services/
│   └── plan-config-service.ts # Plan limits cache + runtime updates
├── providers/
│   ├── solana.ts              # RPC connection pool manager
│   ├── telegram.ts            # Bot instance
│   └── prisma.ts              # Prisma client singleton
├── config/
│   ├── bot-menus.ts           # Inline keyboard definitions
│   ├── bot-middleware.ts      # Auth + admin checks
│   └── program-ids.ts         # Raydium/Jupiter/Pump program IDs
└── types/                     # TypeScript interfaces and enums
prisma/
└── schema.prisma              # DB schema (User, Wallet, Subscription, Group, Plan)
scripts/                       # Maintenance and admin scripts
```

---

## Showcase

<p align="center">
  <img src="./showcase/notifications-new.png" width="48%" alt="Transaction notifications"/>
  <img src="./showcase/transfers.png" width="48%" alt="Transfer notifications"/>
</p>

---

## Contact

- Email: rdraco039@gmail.com
- Project: [github.com/DracoR22/handi-cat_wallet-tracker](https://github.com/DracoR22/handi-cat_wallet-tracker)
- Solana tip jar: `5EVQsbVErvJruJvi3v8i3sDSy58GUnGfewwRb8pJk8N1`

[product-screenshot]: showcase/notifications-new.png
