// Drift Exchange Implementation (Solana) - On-Chain Transactions
// Uses DriftClient SDK for real on-chain order placement
import {
  Exchange,
  ExchangeConfig,
  EXCHANGE_CONFIGS,
  AccountInfo,
  Position,
  OpenOrder,
  AssetInfo,
  MarketPrices,
  OrderParams,
  OrderResult,
  CancelOrderParams,
  DriftCredentials,
  ExchangeCredentials,
} from "./types";
import { invoke } from "@tauri-apps/api/core";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import {
  DriftClient,
  Wallet,
  BN,
  OrderType,
  PositionDirection,
  OrderTriggerCondition,
  PostOnlyParams,
  BASE_PRECISION,
  PRICE_PRECISION,
  initialize,
} from "@drift-labs/sdk";
import bs58 from "bs58";

// Tauri HTTP proxy response type
interface HttpResponse {
  success: boolean;
  data?: string;
  error?: string;
  status: number;
}

// Helper to make HTTP requests via Tauri (bypasses CORS)
async function httpGet(url: string): Promise<any> {
  const response = await invoke<HttpResponse>("http_get", { url });
  if (!response.success || !response.data) {
    throw new Error(response.error || `HTTP ${response.status}`);
  }
  return JSON.parse(response.data);
}

// Helper to make HTTP POST requests via Tauri (bypasses CORS)
async function httpPost(url: string, body: string): Promise<any> {
  const response = await invoke<HttpResponse>("http_post", { url, body });
  if (!response.success || !response.data) {
    throw new Error(response.error || `HTTP ${response.status}`);
  }
  return JSON.parse(response.data);
}

// Cloudflare Worker proxy with Helius key rotation (3 free accounts)
const SOLANA_RPC_URL = "https://solana-rpc.dobrilab.workers.dev";
// WebSocket disabled - using HTTP polling for reliability

// Custom fetch function that routes through Tauri (bypasses CORS)
async function tauriFetch(url: string | URL | Request, options?: RequestInit): Promise<Response> {
  const urlString = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

  // Check if this is a JSON-RPC request
  if (options?.method === "POST" && options.body) {
    const bodyString = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    try {
      const response = await invoke<HttpResponse>("http_post", { url: urlString, body: bodyString });
      return new Response(response.data || "", {
        status: response.status || (response.success ? 200 : 500),
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("[Drift] Tauri fetch error:", e);
      throw e;
    }
  }

  // GET requests
  try {
    const response = await invoke<HttpResponse>("http_get", { url: urlString });
    return new Response(response.data || "", {
      status: response.status || (response.success ? 200 : 500),
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Drift] Tauri fetch error:", e);
    throw e;
  }
}

// Drift API for price data
const DRIFT_DLOB_API = "https://dlob.drift.trade";

// Market symbol to index mapping (perp markets)
const DRIFT_MARKETS: Record<string, { index: number; name: string; minOrderSize: number }> = {
  "SOL": { index: 0, name: "SOL-PERP", minOrderSize: 0.1 },
  "BTC": { index: 1, name: "BTC-PERP", minOrderSize: 0.0001 },
  "ETH": { index: 2, name: "ETH-PERP", minOrderSize: 0.001 },
  "APT": { index: 3, name: "APT-PERP", minOrderSize: 1 },
  "ARB": { index: 5, name: "ARB-PERP", minOrderSize: 10 },
  "DOGE": { index: 6, name: "DOGE-PERP", minOrderSize: 100 },
  "BNB": { index: 7, name: "BNB-PERP", minOrderSize: 0.01 },
  "SUI": { index: 8, name: "SUI-PERP", minOrderSize: 1 },
  "WIF": { index: 10, name: "WIF-PERP", minOrderSize: 1 },
  "LINK": { index: 12, name: "LINK-PERP", minOrderSize: 0.1 },
  "INJ": { index: 19, name: "INJ-PERP", minOrderSize: 0.1 },
};

// Simple wallet adapter for DriftClient
class SimpleWallet implements Wallet {
  constructor(private keypair: Keypair) {}

  get publicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  get payer(): Keypair {
    return this.keypair;
  }

  async signTransaction<T>(tx: T): Promise<T> {
    // @ts-ignore - Transaction has partialSign method
    if ((tx as any).partialSign) {
      (tx as any).partialSign(this.keypair);
    }
    return tx;
  }

  async signAllTransactions<T>(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map(tx => this.signTransaction(tx)));
  }

  async signVersionedTransaction<T>(tx: T): Promise<T> {
    // @ts-ignore - VersionedTransaction has sign method
    if ((tx as any).sign) {
      (tx as any).sign([this.keypair]);
    }
    return tx;
  }

  async signAllVersionedTransactions<T>(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map(tx => this.signVersionedTransaction(tx)));
  }
}

export class DriftExchange implements Exchange {
  readonly type = "drift" as const;
  readonly config: ExchangeConfig = EXCHANGE_CONFIGS.drift;

  private keypair: Keypair | null = null;
  private walletAddress: string = "";
  private initialized: boolean = false;
  private connection: Connection | null = null;
  private driftClient: DriftClient | null = null;
  private cachedPrices: MarketPrices = {};
  private lastPriceUpdate: number = 0;

  constructor(_isTestnet: boolean = false) {
    // Testnet not supported yet
  }

  async initialize(credentials: ExchangeCredentials): Promise<void> {
    const creds = credentials as DriftCredentials;

    try {
      // Decode the private key from base58
      const privateKeyBytes = bs58.decode(creds.privateKey);

      if (privateKeyBytes.length === 64) {
        this.keypair = Keypair.fromSecretKey(privateKeyBytes);
      } else if (privateKeyBytes.length === 32) {
        this.keypair = Keypair.fromSeed(privateKeyBytes);
      } else {
        throw new Error(`Invalid private key length: ${privateKeyBytes.length} bytes. Expected 32 or 64.`);
      }

      this.walletAddress = this.keypair.publicKey.toBase58();
      console.log("[Drift] Wallet address:", this.walletAddress);

      // Create Solana connection (HTTP only via Cloudflare Worker)
      this.connection = new Connection(SOLANA_RPC_URL, {
        commitment: "processed",
        confirmTransactionInitialTimeout: 5000,
        fetch: tauriFetch,
        // No WebSocket - using HTTP polling
      });

      // Initialize Drift SDK
      const sdkConfig = initialize({ env: "mainnet-beta" });

      // Create wallet adapter
      const wallet = new SimpleWallet(this.keypair);

      // Only subscribe to markets we actually use (reduces RPC calls)
      // BTC=1, ETH=2, SOL=0
      const perpMarketIndexes = [0, 1, 2];
      const spotMarketIndexes = [0, 1]; // USDC=0, SOL=1

      // Create DriftClient with HTTP polling (no WebSocket - Helius free tier)
      this.driftClient = new DriftClient({
        connection: this.connection,
        wallet,
        programID: new PublicKey(sdkConfig.DRIFT_PROGRAM_ID),
        env: "mainnet-beta",
        userStats: false,
        perpMarketIndexes,
        spotMarketIndexes,
        accountSubscription: {
          type: "polling",
          accountLoader: undefined,
        },
        // Speed up transactions
        txSenderConfig: {
          skipPreflight: true,
          preflightCommitment: "processed",
        },
        opts: {
          skipPreflight: true,
          preflightCommitment: "processed",
          commitment: "processed",
        },
      });

      // Helper function to add timeout to promises
      const withTimeout = <T>(promise: Promise<T>, ms: number, name: string): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
          ),
        ]);
      };

      // Subscribe to account data (required for placing orders)
      // Using HTTP polling via Cloudflare Worker
      console.log("[Drift] Starting HTTP polling subscription...");
      this.driftClient.subscribe()
        .then(() => {
          console.log("[Drift] Polling subscription active");
        })
        .catch((err) => {
          console.warn("[Drift] Subscription error (may still work):", err.message);
        });

      // Explicitly add user with subAccountId 0 (with 10 second timeout)
      console.log("[Drift] Adding user account...");
      try {
        // Add the user with subAccountId 0 (default account)
        await withTimeout(this.driftClient.addUser(0), 10000, "Add user");
        console.log("[Drift] User added successfully");

        // Now check if user account exists on-chain
        const user = this.driftClient.getUser();
        const userAccountExists = await user.exists();
        console.log("[Drift] User account exists on-chain:", userAccountExists);

        if (!userAccountExists) {
          console.log("[Drift] User account does not exist - initializing on-chain...");
          try {
            // Initialize the user account on-chain (requires SOL for rent)
            const [txSig] = await this.driftClient.initializeUserAccount(0);
            console.log("[Drift] User account initialized! Tx:", txSig);
          } catch (initError) {
            console.warn("[Drift] User account initialization warning:", initError);
            // May fail if account already exists or other reason - continue anyway
          }
        }
      } catch (e) {
        console.warn("[Drift] User add warning:", e);
        // Try to continue - user might already be added or will be created on first order
      }

      this.initialized = true;
      console.log("[Drift] On-chain client initialized successfully");
    } catch (e) {
      console.error("[Drift] Initialization failed:", e);
      throw e;
    }
  }

  isConnected(): boolean {
    return this.initialized && this.keypair !== null && this.driftClient !== null;
  }

  getWalletAddress(): string {
    return this.walletAddress;
  }

  async getMinOrderSize(asset: string): Promise<number> {
    const marketInfo = DRIFT_MARKETS[asset];
    return marketInfo?.minOrderSize || 0;
  }

  async disconnect(): Promise<void> {
    if (this.driftClient) {
      await this.driftClient.unsubscribe();
    }
    this.keypair = null;
    this.walletAddress = "";
    this.initialized = false;
    this.connection = null;
    this.driftClient = null;
  }

  async getAccountInfo(): Promise<AccountInfo> {
    if (!this.driftClient) {
      return {
        balance: "N/A",
        available: "N/A",
        totalMarginUsed: "0",
        totalPositionValue: "0"
      };
    }

    try {
      const user = this.driftClient.getUser();
      // Check if user data is loaded before accessing
      if (!user || !user.isSubscribed) {
        return {
          balance: "Loading...",
          available: "Loading...",
          totalMarginUsed: "0",
          totalPositionValue: "0"
        };
      }
      const freeCollateral = user.getFreeCollateral();
      const totalCollateral = user.getTotalCollateral();

      return {
        balance: (totalCollateral.toNumber() / 1e6).toFixed(2),
        available: (freeCollateral.toNumber() / 1e6).toFixed(2),
        totalMarginUsed: "0",
        totalPositionValue: "0"
      };
    } catch (e) {
      // Subscription may not be complete - return loading state instead of error
      return {
        balance: "Loading...",
        available: "Loading...",
        totalMarginUsed: "0",
        totalPositionValue: "0"
      };
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.driftClient) return [];

    try {
      const user = this.driftClient.getUser();
      const perpPositions = user.getActivePerpPositions();

      return perpPositions.map(pos => {
        const marketIndex = pos.marketIndex;
        const symbol = Object.entries(DRIFT_MARKETS).find(
          ([_, info]) => info.index === marketIndex
        )?.[0] || `PERP-${marketIndex}`;

        const baseAssetAmount = pos.baseAssetAmount.toNumber() / BASE_PRECISION.toNumber();
        const isLong = baseAssetAmount > 0;

        return {
          symbol,
          size: Math.abs(baseAssetAmount).toString(),
          entryPrice: "0", // Would need to calculate from position value
          unrealizedPnl: "0",
          leverage: "1",
          liquidationPrice: "0",
          side: isLong ? "long" as const : "short" as const,
        };
      });
    } catch (e) {
      console.error("[Drift] Failed to get positions:", e);
      return [];
    }
  }

  async getOpenOrders(): Promise<OpenOrder[]> {
    if (!this.driftClient) return [];

    try {
      const user = this.driftClient.getUser();
      const orders = user.getOpenOrders();

      return orders.map(order => {
        const marketIndex = order.marketIndex;
        const symbol = Object.entries(DRIFT_MARKETS).find(
          ([_, info]) => info.index === marketIndex
        )?.[0] || `PERP-${marketIndex}`;

        // Check direction using enum comparison
        const isLong = JSON.stringify(order.direction) === JSON.stringify(PositionDirection.LONG);
        // Check order type using enum comparison
        const isLimit = JSON.stringify(order.orderType) === JSON.stringify(OrderType.LIMIT);

        return {
          symbol,
          side: isLong ? "buy" as const : "sell" as const,
          size: (order.baseAssetAmount.toNumber() / BASE_PRECISION.toNumber()).toString(),
          price: (order.price.toNumber() / PRICE_PRECISION.toNumber()).toString(),
          orderType: isLimit ? "limit" : "market",
          timestamp: Date.now(),
          oid: order.orderId,
        };
      });
    } catch (e) {
      console.error("[Drift] Failed to get open orders:", e);
      return [];
    }
  }

  async getAssets(): Promise<AssetInfo[]> {
    return Object.entries(DRIFT_MARKETS).map(([symbol, info]) => ({
      name: symbol,
      szDecimals: 4,
      maxLeverage: symbol === "SOL" || symbol === "BTC" || symbol === "ETH" ? 20 : 10,
      assetId: info.index,
    }));
  }

  async getMarketPrices(): Promise<MarketPrices> {
    // Cache prices for 5 seconds
    if (Date.now() - this.lastPriceUpdate < 5000 && Object.keys(this.cachedPrices).length > 0) {
      return this.cachedPrices;
    }

    try {
      const prices: MarketPrices = {};
      const marketsToFetch = ["SOL-PERP", "BTC-PERP", "ETH-PERP"];

      for (const marketName of marketsToFetch) {
        try {
          const data = await httpGet(`${DRIFT_DLOB_API}/l2?marketName=${marketName}&depth=1&includeOracle=true`);
          if (data && data.oracle) {
            const symbol = marketName.replace("-PERP", "");
            prices[symbol] = data.oracle / 1e6;
          }
        } catch (e) {
          // Continue with other markets
        }
      }

      if (Object.keys(prices).length > 0) {
        this.cachedPrices = { ...this.cachedPrices, ...prices };
        this.lastPriceUpdate = Date.now();
        return this.cachedPrices;
      }

      return this.getFallbackPrices();
    } catch (e) {
      console.error("[Drift] Failed to get market prices:", e);
      return this.getFallbackPrices();
    }
  }

  private async getFallbackPrices(): Promise<MarketPrices> {
    try {
      const ids = "solana,bitcoin,ethereum";
      const data = await httpGet(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);

      const prices: MarketPrices = {
        "SOL": data.solana?.usd || 0,
        "BTC": data.bitcoin?.usd || 0,
        "ETH": data.ethereum?.usd || 0,
      };

      this.cachedPrices = prices;
      this.lastPriceUpdate = Date.now();
      return prices;
    } catch {
      return this.cachedPrices;
    }
  }

  async getAssetPrice(asset: string): Promise<number> {
    const prices = await this.getMarketPrices();
    return prices[asset] || 0;
  }

  async placeOrder(params: OrderParams): Promise<OrderResult> {
    if (!this.initialized || !this.driftClient) {
      return { success: false, error: "Not connected" };
    }

    const marketInfo = DRIFT_MARKETS[params.asset];
    if (!marketInfo) {
      return { success: false, error: `Asset ${params.asset} not found on Drift` };
    }

    try {
      // Check minimum order size
      if (marketInfo.minOrderSize > 0 && params.size < marketInfo.minOrderSize) {
        return {
          success: false,
          error: `Order size ${params.size} ${params.asset} is below minimum ${marketInfo.minOrderSize} ${params.asset}`,
        };
      }

      // Ensure user is loaded before placing order
      await this.ensureUserLoaded();

      // Convert to Drift's precision
      const baseAssetAmount = new BN(Math.floor(params.size * BASE_PRECISION.toNumber()));
      const price = new BN(Math.floor(params.price * PRICE_PRECISION.toNumber()));

      console.log("[Drift] Placing on-chain order:", {
        asset: params.asset,
        marketIndex: marketInfo.index,
        isBuy: params.isBuy,
        size: params.size,
        price: params.price,
        baseAssetAmount: baseAssetAmount.toString(),
        priceScaled: price.toString(),
      });

      // Place the order on-chain
      const txSig = await this.driftClient.placePerpOrder({
        marketIndex: marketInfo.index,
        direction: params.isBuy ? PositionDirection.LONG : PositionDirection.SHORT,
        orderType: params.price > 0 ? OrderType.LIMIT : OrderType.MARKET,
        baseAssetAmount,
        price,
        reduceOnly: params.reduceOnly || false,
        postOnly: params.postOnly ? PostOnlyParams.MUST_POST_ONLY : PostOnlyParams.NONE,
      });

      console.log("[Drift] Order placed on-chain! Tx:", txSig);

      return {
        success: true,
        orderId: txSig,
      };
    } catch (e) {
      console.error("[Drift] On-chain order failed:", e);
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // Helper to ensure user account is loaded
  private async ensureUserLoaded(): Promise<void> {
    if (!this.driftClient) {
      throw new Error("DriftClient not initialized");
    }

    try {
      // Try to get user - if this throws, we need to add/init the user
      const user = this.driftClient.getUser();
      if (user) {
        console.log("[Drift] User already loaded");
        return;
      }
    } catch (e) {
      console.log("[Drift] User not loaded, attempting to add...");
    }

    // Add user with subAccountId 0
    try {
      await this.driftClient.addUser(0);
      console.log("[Drift] User added");
    } catch (e) {
      console.warn("[Drift] addUser failed, trying to initialize account...", e);
    }

    // Check if account exists on-chain, if not initialize it
    try {
      const user = this.driftClient.getUser();
      const exists = await user.exists();
      if (!exists) {
        console.log("[Drift] User account doesn't exist, initializing...");
        const [txSig] = await this.driftClient.initializeUserAccount(0);
        console.log("[Drift] User account initialized! Tx:", txSig);
        // Re-add user after initialization
        await this.driftClient.addUser(0);
      }
    } catch (initError) {
      console.warn("[Drift] User init check failed:", initError);
      // Continue anyway - maybe the account exists but subscription failed
    }
  }

  async cancelOrder(params: CancelOrderParams): Promise<boolean> {
    if (!this.initialized || !this.driftClient) return false;

    try {
      const orderId = typeof params.orderId === "string"
        ? parseInt(params.orderId, 10)
        : params.orderId;

      await this.driftClient.cancelOrder(orderId);
      return true;
    } catch (e) {
      console.error("[Drift] Cancel order failed:", e);
      return false;
    }
  }

  async cancelAllOrders(_asset?: string): Promise<boolean> {
    if (!this.initialized || !this.driftClient) return false;

    try {
      await this.driftClient.cancelOrders();
      return true;
    } catch (e) {
      console.error("[Drift] Cancel all orders failed:", e);
      return false;
    }
  }

  async closePosition(asset: string): Promise<OrderResult> {
    if (!this.initialized || !this.driftClient) {
      return { success: false, error: "Not connected" };
    }

    const marketInfo = DRIFT_MARKETS[asset];
    if (!marketInfo) {
      return { success: false, error: `Asset ${asset} not found on Drift` };
    }

    try {
      // Get current position
      const user = this.driftClient.getUser();
      const perpPositions = user.getActivePerpPositions();
      const position = perpPositions.find(p => p.marketIndex === marketInfo.index);

      if (!position) {
        return { success: false, error: "No position found for " + asset };
      }

      const baseAssetAmount = position.baseAssetAmount.toNumber();
      if (baseAssetAmount === 0) {
        return { success: false, error: "Position size is zero" };
      }

      const isLong = baseAssetAmount > 0;
      const absSize = Math.abs(baseAssetAmount);

      console.log("[Drift] Closing position:", {
        asset,
        marketIndex: marketInfo.index,
        isLong,
        size: absSize / BASE_PRECISION.toNumber(),
      });

      // First cancel all orders for this market (SL/TP etc)
      try {
        const orders = user.getOpenOrders();
        const marketOrders = orders.filter(o => o.marketIndex === marketInfo.index);
        if (marketOrders.length > 0) {
          console.log("[Drift] Cancelling", marketOrders.length, "open orders for", asset);
          await this.driftClient.cancelOrders(marketInfo.index);
        }
      } catch (cancelErr) {
        console.warn("[Drift] Failed to cancel orders:", cancelErr);
        // Continue with closing position even if cancel fails
      }

      // Place market order in opposite direction to close
      const txSig = await this.driftClient.placePerpOrder({
        marketIndex: marketInfo.index,
        direction: isLong ? PositionDirection.SHORT : PositionDirection.LONG,
        orderType: OrderType.MARKET,
        baseAssetAmount: new BN(absSize),
        reduceOnly: true,
      });

      console.log("[Drift] Position closed! Tx:", txSig);

      return {
        success: true,
        orderId: txSig,
      };
    } catch (e) {
      console.error("[Drift] Close position failed:", e);
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async setLeverage(_asset: string, _leverage: number): Promise<boolean> {
    // Drift uses cross-margin by default
    return true;
  }

  async placeStopLoss(asset: string, isBuy: boolean, size: number, triggerPrice: number): Promise<OrderResult> {
    if (!this.initialized || !this.driftClient) {
      return { success: false, error: "Not connected" };
    }

    const marketInfo = DRIFT_MARKETS[asset];
    if (!marketInfo) {
      return { success: false, error: `Asset ${asset} not found on Drift` };
    }

    try {
      // Ensure user is loaded before placing order
      await this.ensureUserLoaded();

      const baseAssetAmount = new BN(Math.floor(size * BASE_PRECISION.toNumber()));
      const triggerPriceBN = new BN(Math.floor(triggerPrice * PRICE_PRECISION.toNumber()));

      console.log("[Drift] Placing on-chain stop loss:", {
        asset,
        marketIndex: marketInfo.index,
        isBuy,
        size,
        triggerPrice,
      });

      // Stop loss: triggerMarket order that executes when price hits trigger
      // For a LONG position, SL is a SELL order triggered when price goes BELOW trigger
      // For a SHORT position, SL is a BUY order triggered when price goes ABOVE trigger
      // Direction is OPPOSITE of position (we're closing)
      const txSig = await this.driftClient.placePerpOrder({
        marketIndex: marketInfo.index,
        direction: isBuy ? PositionDirection.SHORT : PositionDirection.LONG, // Opposite to close
        orderType: OrderType.TRIGGER_MARKET,
        baseAssetAmount,
        triggerPrice: triggerPriceBN,
        triggerCondition: isBuy ? OrderTriggerCondition.BELOW : OrderTriggerCondition.ABOVE, // LONG SL triggers below, SHORT SL triggers above
        reduceOnly: true,
      });

      console.log("[Drift] Stop loss placed on-chain! Tx:", txSig);

      return {
        success: true,
        orderId: txSig,
      };
    } catch (e) {
      console.error("[Drift] Stop loss failed:", e);
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async placeTakeProfit(asset: string, isBuy: boolean, size: number, triggerPrice: number): Promise<OrderResult> {
    if (!this.initialized || !this.driftClient) {
      return { success: false, error: "Not connected" };
    }

    const marketInfo = DRIFT_MARKETS[asset];
    if (!marketInfo) {
      return { success: false, error: `Asset ${asset} not found on Drift` };
    }

    try {
      // Ensure user is loaded before placing order
      await this.ensureUserLoaded();

      const baseAssetAmount = new BN(Math.floor(size * BASE_PRECISION.toNumber()));
      const triggerPriceBN = new BN(Math.floor(triggerPrice * PRICE_PRECISION.toNumber()));

      console.log("[Drift] Placing on-chain take profit:", {
        asset,
        marketIndex: marketInfo.index,
        isBuy,
        size,
        triggerPrice,
      });

      // Take profit: triggerLimit order for maker fees
      // For a LONG position, TP is a SELL order triggered when price goes ABOVE trigger
      // For a SHORT position, TP is a BUY order triggered when price goes BELOW trigger
      // Direction is OPPOSITE of position (we're closing)
      const txSig = await this.driftClient.placePerpOrder({
        marketIndex: marketInfo.index,
        direction: isBuy ? PositionDirection.SHORT : PositionDirection.LONG, // Opposite to close
        orderType: OrderType.TRIGGER_LIMIT,
        baseAssetAmount,
        price: triggerPriceBN, // Limit price = trigger price
        triggerPrice: triggerPriceBN,
        triggerCondition: isBuy ? OrderTriggerCondition.ABOVE : OrderTriggerCondition.BELOW, // LONG TP triggers above, SHORT TP triggers below
        reduceOnly: true,
      });

      console.log("[Drift] Take profit placed on-chain! Tx:", txSig);

      return {
        success: true,
        orderId: txSig,
      };
    } catch (e) {
      console.error("[Drift] Take profit failed:", e);
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

// Factory function
export function createDriftExchange(isTestnet: boolean = false): DriftExchange {
  return new DriftExchange(isTestnet);
}
