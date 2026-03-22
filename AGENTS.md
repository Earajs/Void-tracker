# AGENTS.md

Agentic coding instructions for the Handi Cat Wallet Tracker project.

## Project Overview

A TypeScript/Node.js Telegram bot that tracks Solana wallet activity (PumpFun, Raydium, Jupiter swaps, and SOL transfers) and notifies users in real-time. Uses Prisma with PostgreSQL, Solana Web3.js, and node-telegram-bot-api.

---

## Build / Lint / Test Commands

```bash
# Install dependencies (runs postinstall: prisma generate)
pnpm install

# Type-check (no custom script — uses tsc)
pnpm exec tsc --noEmit

# Format code (Prettier)
pnpm format:write          # Format all .ts/.tsx/.md files
pnpm format:check          # Check formatting without writing

# Build & run
pnpm start                 # Compile TypeScript + run main.ts
pnpm start:test           # Compile TypeScript + run test.ts (ad-hoc test script)

# Database (Prisma)
pnpm db:push              # Push schema changes to DB (no migration)
pnpm db:migrate           # Create and apply migrations
pnpm db:generate          # Generate Prisma client
pnpm db:seed              # Seed the database
pnpm db:studio            # Open Prisma Studio
pnpm db:backup            # Backup the database (runs scripts/backup-db.ts)

# Scripts
pnpm wallets:cleanup      # Run cleanup-wallets.ts
pnpm send:alert           # Run send-user-alerts.ts
```

> **No formal test framework exists.** The file `src/test.ts` is an ad-hoc manual test script. To run a single function from it:
>
> ```bash
> # Run specific test function (replace testFunctionName with actual name)
> npx ts-node -e "import { testFunctionName } from './src/test'; testFunctionName()"
>
> # Or edit test.ts and run the full test script
> pnpm start:test
> ```

---

## Lint & Type Checking

```bash
# Type-check only (strict mode enforced)
pnpm exec tsc --noEmit

# Format check (Prettier)
pnpm format:check
```

---

## Code Style Guidelines

### General

- **Language:** TypeScript with `strict: true` (tsconfig.json)
- **Module system:** CommonJS (`"module": "commonjs"`)
- **Target:** ES2016
- **Output:** Compiled to `dist/` directory

### Formatting (Prettier)

Configured in `.prettierrc`:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "semi": false,
  "printWidth": 120
}
```

- Always run `pnpm format:write` before committing.
- Prettier ignores files in `.gitignore`.

### Imports

- Use **named imports** for most modules.
- Use **default imports** for modules that only have a default export (e.g., `dotenv`, `chalk`, `gradient-string`).
- **Group order:** 1) Node built-ins → 2) External packages → 3) Internal modules. No blank lines between groups (see existing files for exact patterns).
- **Relative paths:** Use `../` for parent directories, `./` for same directory. Internal imports reference `src/` subdirectories directly (e.g., `'../providers/solana'`, `'../../lib/user-plan'`).

### Naming Conventions

| Element           | Convention        | Example                                          |
| ----------------- | ----------------- | ------------------------------------------------ |
| Classes           | PascalCase        | `class TrackWallets`                             |
| Methods/Functions | camelCase         | `setupWalletWatcher`                             |
| Variables         | camelCase         | `walletAddress`, `subscriptionId`                |
| Types/Interfaces  | PascalCase        | `type SwapType`, `interface Foo`                 |
| Enums             | PascalCase        | `SubscriptionPlan`, `WalletStatus`               |
| Enum members      | UPPER_SNAKE_CASE  | `FREE`, `USER_PAUSED`                            |
| Constants         | PascalCase class  | `WalletPool`, `ASCII_TEXT`                       |
| Prisma repos      | `Prisma` + Entity | `PrismaUserRepository`, `PrismaWalletRepository` |

### TypeScript

- **Strict mode is enforced.** Avoid `any` — use proper types or cast explicitly with `@ts-expect-error` if unavoidable.
- Prefer **interface** for object shapes and **type** for unions/aliases.
- Use **Prisma generated types** (e.g., `Prisma.WalletGetPayload<...>`) for database entities.
- Return types should be explicit on public methods. Private methods may omit them if obvious.
- Guard clauses (early returns) are preferred over deeply nested conditionals.

### Error Handling

- **No try/catch wrapping for simple operations.** Let errors propagate or handle at the boundary.
- When catching is necessary, log the error with a **SCREAMING_SNAKE_CASE** tag:
  ```typescript
  catch (error) {
    console.log('GET_USERS_TO_CHARGE_ERROR', error)
    return []
  }
  ```
- For API clients (axios/fetch), prefer returning `undefined` on error rather than throwing, then check at call sites.

### Classes & Architecture

- **Dependency injection via constructor.** Repositories, utilities, and services are instantiated in constructors and stored as `private` fields.
- **Service classes** (e.g., `TrackWallets`, `WatchTransaction`, `CronJobs`) own business logic.
- **Repository classes** (under `src/repositories/prisma/`) wrap all Prisma operations. One repository per model.
- **Message classes** (under `src/bot/messages/`) are static utility classes that return formatted Telegram message strings. They do not send messages.
- **Handler/Command classes** own Telegram event wiring (`.onText()`, `.on('callback_query')`, etc.).

### Database (Prisma)

- Schema is in `prisma/schema.prisma`. Models: `User`, `Wallet`, `UserWallet`, `UserSubscription`, `Promotion`, `UserPromotion`, `Group`, `PlanConfig`.
- Enums defined in schema: `SubscriptionPlan`, `WalletStatus`, `HandiCatStatus`, `PromotionType`.
- Always run `pnpm db:generate` after schema changes (handled automatically by `postinstall`).
- Use `@ts-expect-error` if Prisma-generated types conflict with strict mode.

### Telegram Bot

- Use `node-telegram-bot-api` for bot operations.
- Bot instance is exported from `src/providers/telegram.ts` and imported wherever needed.
- Messages are built in `src/bot/messages/` classes and sent from `src/bot/handlers/` or `src/bot/commands/`.
- Parse mode is `HTML` for all bot messages.

### Solana / DeFi

- Use `@solana/web3.js` for RPC calls.
- Connection management via `RpcConnectionManager` in `src/providers/solana.ts`.
- Relevant transaction detection based on program IDs defined in `src/config/program-ids.ts`.
- Supported swap types: `pumpfun`, `pumpfun_amm`, `mint_pumpfun`, `raydium`, `jupiter`, `sol_transfer`.

### Environment Variables

- Use `dotenv` (loaded in `src/main.ts`).
- All required env vars should be documented in `.env.example` (create if missing). Never commit `.env`.
- `ENCRYPTION_KEY`: AES-256-GCM key for encrypting private keys (`openssl rand -hex 32`).

### Plan Configuration (Database-Driven)

Plan limits (wallet counts, fees, daily message limits) are stored in the `PlanConfig` DB table, not hardcoded. The `PlanConfigService` (`src/services/plan-config-service.ts`) manages an in-memory cache and seeds defaults on startup. To update limits at runtime, use `/setlimit` or modify `PlanConfig` directly. Hardcoded constants in `pricing.ts` should not be used for plan limits.

### File Organization

```
src/
  bot/
    commands/       # Telegram /command handlers
    handlers/       # Callback queries, tx messages, upgrades, etc.
    messages/       # Static message builders (HTML strings)
  config/           # Bot menus, middleware, wallet pool, program IDs
  constants/        # Static config: pricing, flags, ASCII art, banned wallets
  lib/              # Core business logic: watch-transactions, cron-jobs, etc.
  markets/           # Token price / market cap utilities
  parsers/          # Transaction parsing logic
  providers/         # Telegram bot, Prisma client, Solana RPC manager
  repositories/      # Prisma repositories per model
  services/         # Business services: PlanConfigService, etc.
  types/             # Shared TypeScript types and interfaces
  main.ts           # App entry point
  test.ts           # Ad-hoc manual test script
prisma/
  schema.prisma     # Database schema
scripts/
  backup-db.ts
  cleanup-wallets.ts
  seed-db.ts
  send-user-alerts.ts
```

### Comment Policy

- **No comments** in production code unless the logic is genuinely non-obvious.
- Use `// TODO:` for deferred work.
- Use `// @ts-expect-error` with a brief reason when type suppression is necessary.
