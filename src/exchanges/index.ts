// Exchange module - exports all exchange implementations

export * from "./types";
export { HyperliquidExchange, createHyperliquidExchange } from "./hyperliquid";
export { DriftExchange, createDriftExchange } from "./drift";

import { Exchange, ExchangeType } from "./types";
import { createHyperliquidExchange } from "./hyperliquid";
import { createDriftExchange } from "./drift";

// Factory to create exchange instance by type
export function createExchange(type: ExchangeType, isTestnet: boolean = false): Exchange {
  switch (type) {
    case "drift":
      return createDriftExchange(isTestnet);
    case "hyperliquid":
      return createHyperliquidExchange(isTestnet);
    default:
      throw new Error(`Unknown exchange type: ${type}`);
  }
}

// Default exchange (Drift for US support)
export const DEFAULT_EXCHANGE: ExchangeType = "drift";
