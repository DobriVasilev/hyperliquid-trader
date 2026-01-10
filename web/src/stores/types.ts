// Exchange and trading types - adapted from Tauri desktop app

export type ExchangeType = "hyperliquid";

export type WalletType = "evm";

export interface ExchangeConfig {
  type: ExchangeType;
  name: string;
  walletType: WalletType;
  testnetAvailable: boolean;
  makerFee: number;  // negative = rebate
  takerFee: number;
}

export const EXCHANGE_CONFIGS: Record<ExchangeType, ExchangeConfig> = {
  hyperliquid: {
    type: "hyperliquid",
    name: "Hyperliquid",
    walletType: "evm",
    testnetAvailable: true,
    makerFee: 0.00015,  // 0.015%
    takerFee: 0.00045,  // 0.045%
  },
};

// Trading constants
export const TRADING_CONSTANTS = {
  MAINTENANCE_MARGIN: 0.005,  // 0.5%
  TAKER_FEE_RATE: 0.00045,    // 0.045%
  MAKER_FEE_RATE: 0.00015,    // 0.015%
  DEFAULT_FEE_BUFFER: 0.02,   // 2% buffer for slippage
};

// Account info returned by exchange
export interface AccountInfo {
  balance: string;
  available: string;
  totalMarginUsed: string;
  totalPositionValue: string;
}

// Position info
export interface Position {
  symbol: string;
  size: string;
  entryPrice: string;
  unrealizedPnl: string;
  leverage: string;
  liquidationPrice: string;
  side: "long" | "short";
}

// Open order info
export interface OpenOrder {
  symbol: string;
  side: "buy" | "sell";
  size: string;
  price: string;
  orderType: string;
  timestamp: number;
  oid: string | number;
}

// Asset/market info
export interface AssetInfo {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  assetId: number | string;
}

// Order parameters for placing orders
export interface OrderParams {
  asset: string;
  isBuy: boolean;
  size: number;
  price: number;
  reduceOnly?: boolean;
  postOnly?: boolean;
  leverage?: number;
}

// Order result
export interface OrderResult {
  success: boolean;
  orderId?: string | number;
  error?: string;
  filledSize?: number;
  avgPrice?: number;
}

// Cancel order params
export interface CancelOrderParams {
  asset: string;
  orderId: string | number;
}

// Market prices
export interface MarketPrices {
  [asset: string]: number;
}

// TradingView position data from extension
export interface TVPositionData {
  direction: "long" | "short";
  entry: number;
  stopLoss: number;
  takeProfit: number | null;
  timestamp: number;
}

// Trade history item
export interface TradeHistoryItem {
  id: string;
  timestamp: number;
  symbol: string;
  direction: "long" | "short";
  entry: number;
  sl: number;
  tp?: number;
  qty: number;
  risk: number;
  leverage: number;
  status: "pending" | "filled" | "cancelled" | "closed";
  closePrice?: number;
  closeTimestamp?: number;
  pnl?: number;
  result?: "win" | "loss" | "breakeven";
}

// Default exchange
export const DEFAULT_EXCHANGE: ExchangeType = "hyperliquid";
