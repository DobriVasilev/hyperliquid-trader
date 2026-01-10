# Dell Server Trading Platform - Implementation Plan

## Overview

This document outlines the complete plan for building a trading platform on the Dell Wyse 5070 server in Bulgaria (IP: 78.83.66.219) that enables:
1. US users to trade on Hyperliquid (via Bulgarian IP)
2. 24/7 automated trading bots
3. Lightweight web interface (server handles all computation)
4. Multi-user support

## Architecture

### Mode B: Server-Managed Keys (Chosen Approach)

All private keys are stored encrypted on the server. This enables:
- 24/7 bot operation (no need for user's device to be online)
- Unified experience across web and desktop
- Server handles all signing and execution

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DELL SERVER (Bulgaria)                          │
│                        server.dobri.org                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │
│  │  Encrypted      │    │  Trading        │    │  Bot Engine     │   │
│  │  Wallet Storage │───▶│  Execution API  │───▶│  (24/7)         │   │
│  │  (AES-256)      │    │                 │    │                 │   │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘   │
│           │                      │                      │             │
│           └──────────────────────┼──────────────────────┘             │
│                                  ▼                                     │
│                         ┌─────────────────┐                           │
│                         │   HYPERLIQUID   │                           │
│                         │   (sees Bulgarian IP)                       │
│                         └─────────────────┘                           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ HTTPS
                                  │
┌────────────────────────────────────────────────────────────────────────┐
│                           USER (Anywhere)                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Web Browser (server.dobri.org)                                       │
│  ├── Login with Google/GitHub                                         │
│  ├── Add wallet (one time - key encrypted on server)                  │
│  ├── Manual trading UI                                                │
│  ├── Bot configuration                                                │
│  └── Monitor positions, P&L, bot status                               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Current State (Completed)

- [x] Dell server running Ubuntu 24.04 LTS
- [x] Security hardening (UFW, Fail2ban, SSH hardening)
- [x] Caddy web server installed
- [x] Node.js 20 installed
- [x] PostgreSQL 16 installed (using Neon instead)
- [x] Next.js app deployed and running
- [x] .env configured with Neon database credentials
- [x] DNS: server.dobri.org → 78.83.66.219
- [ ] Port forwarding from router to Dell server (192.168.0.6)
- [ ] HTTPS working via Caddy

## Server Details

- **Local IP:** 192.168.0.6
- **Public IP:** 78.83.66.219 (Bulgarian)
- **Domain:** server.dobri.org
- **OS:** Ubuntu Server 24.04 LTS
- **Hardware:** Dell Wyse 5070 (Pentium J5005, 8GB RAM, 128GB SSD)

## Implementation Phases

### Phase 1: Network Setup (Required First)

1. **Port Forwarding on Router**
   - Forward port 80 → 192.168.0.6:80
   - Forward port 443 → 192.168.0.6:443
   - Forward port 22 → 192.168.0.6:22 (for SSH)

2. **Configure Caddy for HTTPS**
   - Update Caddyfile with server.dobri.org domain
   - Caddy auto-provisions SSL certificate from Let's Encrypt

### Phase 2: Database Schema (1 hour)

Add tables to Prisma schema:

```prisma
model UserWallet {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  nickname      String   // "Main Account", "Bot Account"
  address       String   // Public wallet address (for display)
  encryptedKey  String   // AES-256-GCM encrypted private key
  salt          String   // Salt for key derivation
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  bots          BotConfig[]
  trades        Trade[]
}

model BotConfig {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  walletId      String
  wallet        UserWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
  name          String   // "BOS Breakout Bot"
  strategyType  String   // "bos-breakout", "mean-reversion", etc.
  symbol        String   // "BTC", "ETH"
  parameters    Json     // Strategy-specific settings
  riskSettings  Json     // { riskPerTrade: 1, maxDailyLoss: 5, leverage: 10 }
  status        String   @default("stopped") // "running", "stopped", "error"
  lastRunAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  trades        Trade[]
}

model Trade {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  walletId      String
  wallet        UserWallet @relation(fields: [walletId], references: [id])
  botId         String?
  bot           BotConfig? @relation(fields: [botId], references: [id])
  symbol        String
  side          String   // "long" or "short"
  size          Float
  entryPrice    Float
  exitPrice     Float?
  stopLoss      Float?
  takeProfit    Float?
  pnl           Float?
  pnlPercent    Float?
  status        String   // "open", "closed", "cancelled"
  openedAt      DateTime @default(now())
  closedAt      DateTime?
  hyperliquidOrderId String?
}
```

### Phase 3: Encrypted Wallet Storage (2 hours)

**Encryption approach:**
- User provides private key + encryption password
- Derive encryption key: `encKey = Argon2id(password, salt)`
- Encrypt: `AES-256-GCM(privateKey, encKey)`
- Store: encrypted blob + salt in database
- Decrypt only when needed for signing

**Files to create:**
- `src/lib/wallet-encryption.ts` - Encryption/decryption functions
- `src/app/api/wallets/route.ts` - CRUD endpoints

### Phase 4: Trading API (3 hours)

Port Hyperliquid SDK from Tauri app (`desktop/src/src/exchanges/hyperliquid.ts`):

**Endpoints:**
- `POST /api/trade/execute` - Place order
- `POST /api/trade/close` - Close position
- `GET /api/positions` - Get open positions
- `GET /api/orders` - Get open orders
- `GET /api/balance` - Get account balance
- `DELETE /api/orders/[id]` - Cancel order

**Files to create:**
- `src/lib/hyperliquid.ts` - Trading SDK (ported from Tauri)
- `src/app/api/trade/execute/route.ts`
- `src/app/api/positions/route.ts`
- etc.

### Phase 5: Trading UI (1-2 days)

**Pages:**
- `/trading` - Main trading interface
- `/trading/wallets` - Wallet management
- `/trading/history` - Trade history

**Components:**
- `WalletManager.tsx` - Add/remove wallets
- `PositionTable.tsx` - Current positions
- `OrderForm.tsx` - Place orders
- `TradeHistory.tsx` - Past trades

### Phase 6: Bot Engine (2-3 days)

Background process that runs 24/7 on server.

**Structure:**
```
bot-engine/
├── index.ts          # Main entry point
├── runner.ts         # Bot execution loop
├── strategies/       # Trading strategies
│   ├── bos-breakout.ts
│   ├── mean-reversion.ts
│   └── index.ts
├── signals.ts        # Pattern detection
└── executor.ts       # Trade execution
```

**Process:**
1. Load all active bots from database
2. For each bot every N seconds:
   - Fetch latest price data
   - Run strategy logic
   - If signal detected → execute trade
3. Log all activity
4. Handle errors gracefully

**Run as systemd service** for auto-restart.

### Phase 7: Bot Configuration UI (1 day)

**Pages:**
- `/bots` - List all bots
- `/bots/new` - Create new bot
- `/bots/[id]` - Edit/view bot

**Components:**
- `BotCard.tsx` - Bot status display
- `BotForm.tsx` - Create/edit bot
- `BotLogs.tsx` - View bot activity

## Security Measures

### Key Storage
- AES-256-GCM encryption at rest
- Argon2id for password-based key derivation
- Keys decrypted only in memory when needed
- Never logged or exposed

### Recommendations for Users
1. **Use a separate "API wallet"** - Only keep trading funds, not main holdings
2. **Hyperliquid API wallets** - Can trade but cannot withdraw (extra safety)
3. **Strong encryption password** - Used to encrypt the key

### Server Security
- UFW firewall (only ports 22, 80, 443)
- Fail2ban for brute force protection
- SSH key authentication (disable password auth)
- Automatic security updates
- HTTPS only (Caddy)

## File Structure (Final)

```
/home/dobri/systems-trader/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── wallets/
│   │   │   │   ├── route.ts          # GET/POST wallets
│   │   │   │   └── [id]/route.ts     # DELETE wallet
│   │   │   ├── trade/
│   │   │   │   ├── execute/route.ts  # Place order
│   │   │   │   └── close/route.ts    # Close position
│   │   │   ├── positions/route.ts    # Get positions
│   │   │   ├── orders/route.ts       # Get/cancel orders
│   │   │   ├── balance/route.ts      # Get balance
│   │   │   └── bots/
│   │   │       ├── route.ts          # GET/POST bots
│   │   │       └── [id]/
│   │   │           ├── route.ts      # GET/PUT/DELETE bot
│   │   │           └── toggle/route.ts # Start/stop bot
│   │   ├── trading/
│   │   │   ├── page.tsx              # Trading dashboard
│   │   │   ├── wallets/page.tsx      # Wallet management
│   │   │   └── history/page.tsx      # Trade history
│   │   └── bots/
│   │       ├── page.tsx              # Bot list
│   │       ├── new/page.tsx          # Create bot
│   │       └── [id]/page.tsx         # Bot details
│   ├── lib/
│   │   ├── hyperliquid.ts            # Trading SDK
│   │   └── wallet-encryption.ts      # Key encryption
│   └── components/
│       └── trading/
│           ├── WalletManager.tsx
│           ├── PositionTable.tsx
│           ├── OrderForm.tsx
│           └── TradeHistory.tsx
├── bot-engine/
│   ├── index.ts
│   ├── runner.ts
│   ├── strategies/
│   └── executor.ts
└── prisma/
    └── schema.prisma                  # Updated with wallet/bot models
```

## Timeline

| Day | Phase | Tasks |
|-----|-------|-------|
| 1 | Network | Port forwarding, HTTPS setup |
| 1 | Database | Add Prisma models, run migration |
| 1 | Encryption | Build wallet encryption system |
| 2 | Trading API | Port Hyperliquid SDK, build endpoints |
| 2-3 | Trading UI | Build trading interface |
| 4-5 | Bot Engine | Build background bot process |
| 6 | Bot UI | Build bot management interface |
| 7 | Testing | End-to-end testing, bug fixes |

**Total: ~1 week**

## Commands Reference

### On Dell Server

```bash
# SSH into server
ssh dobri@192.168.0.6

# Check app status
systemctl status trading-app

# View logs
sudo journalctl -u trading-app -f

# Restart app after changes
sudo systemctl restart trading-app

# Update from git and rebuild
cd ~/systems-trader
git pull
cd web
npm install
npx prisma migrate deploy
npm run build
sudo systemctl restart trading-app
```

### Development

```bash
# Run locally
cd web
npm run dev

# Run Prisma migration
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

## Why Hyperliquid (Not Building Own Exchange)

Building an exchange requires:
- **Counterparty matching** - Billions in liquidity
- **Order book management** - Complex infrastructure
- **Settlement** - Moving actual funds
- **Regulatory compliance** - Money transmitter licenses
- **Years of development** - Millions of dollars

**Hyperliquid provides all of this.** Our app is a **front-end** to Hyperliquid, not an exchange itself. We submit orders to their exchange, they handle matching and settlement.

## Risk Disclaimer

Users should understand:
1. Private keys are stored encrypted on server
2. Use a separate "API wallet" with only trading funds
3. Never store main holdings in trading wallet
4. Platform is not responsible for trading losses
5. Only risk what you can afford to lose
