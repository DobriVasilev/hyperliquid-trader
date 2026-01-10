# Systems Trader - Project Vision & Context

## Core Concept

A **PNL/risk-focused trading platform** where:
- **Budget = Risk** - When you set a budget, you're setting the max PNL you're willing to lose, NOT the position size
- This approach enables fast trade entry because the system calculates position sizing from your risk tolerance

## Architecture Overview

### Tauri App (MVP)
- Built first as proof-of-concept for manual trading
- Works with Hyperliquid API
- Includes TradingView extension for quick trade entry via position tool
- Tested and functional - fast, clean, modern UI
- One user reported laptop slowdown → motivation to move processing to server

### Web App
- Same functionality as Tauri, but web-accessible
- Easier access than desktop app installation
- Currently deployed on Dell server in Bulgaria

### Dell Server (Bulgaria)
- Routes all requests through Bulgarian IP (whitelisted on Hyperliquid)
- Handles processing load (not user's machine)
- Enables US users to trade on Hyperliquid legally

## User Flow

### US Users
1. Use free VPN to create Hyperliquid account and API key (one-time setup)
2. Access web platform at dobri.org
3. All trading requests route through Bulgaria server
4. Hyperliquid sees Bulgarian IP → no geo-restrictions

### Manual Trading
- Quick PNL-based trade entry
- TradingView extension shows modal for instant orders
- Position tool integration on TradingView/Hyperliquid

### Automated Systems (In Development)
1. **Indicators/Pattern Recognition** (currently building):
   - Swing highs/lows detection
   - BOS (Break of Structure)
   - MSB (Market Structure Break)
   - Other technical patterns

2. **Backtesting** (future):
   - Test systems against historical data
   - Runs on server, not user's machine

3. **Live Automated Trading** (future):
   - Systems execute based on indicator signals
   - 24/7 operation on Dell server
   - Multiple users, multiple wallets

## Integration Goal

Tauri app and web app should be **fully integrated**:
- Same dashboard for manual AND automated trading
- Same account manages both
- User can:
  - Manually trade (quick PNL-based entry)
  - Backtest automated systems
  - Run live automated systems
  - Manage all from one place

## Why Server-Side Processing

1. **Lightweight for users** - No laptop slowdown
2. **US compliance** - Bulgarian IP for Hyperliquid
3. **24/7 operation** - Bots run continuously
4. **Reliability** - Dedicated hardware, not user's flaky connection

## Current State (January 2026)

### Completed
- Tauri manual trading app (works)
- TradingView extension (works)
- Web app with trading UI
- Dell server setup in Bulgaria
- Cloudflare CDN/protection
- Database schema for users/wallets/bots
- Encrypted wallet storage
- OAuth login (Google/GitHub)
- R2 backups with encryption

### In Progress
- Indicator algorithms (swing detection, BOS, MSB)
- Server-side trade routing

### Pending
- Bot engine as 24/7 systemd service
- Backtesting engine
- Full Tauri ↔ Web integration
- End-to-end testing
