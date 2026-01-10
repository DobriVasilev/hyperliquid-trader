/**
 * Position Sizing Library
 * Migrated from Tauri desktop app
 *
 * Core feature: PNL-based position sizing
 * Instead of specifying position size, user specifies risk amount (max loss)
 * The system calculates the appropriate position size.
 */

import { TRADING_CONSTANTS } from "@/stores/types";

const { MAINTENANCE_MARGIN, TAKER_FEE_RATE } = TRADING_CONSTANTS;

export interface PositionSizingInput {
  entryPrice: number;
  stopLoss: number;
  riskAmount: number;
  leverage: number;
  takeProfit?: number;
  feeBuffer?: number;
  szDecimals?: number;  // Asset decimal places
}

export interface PositionSizingResult {
  // Direction inferred from entry vs SL
  direction: "long" | "short";

  // Calculated values
  qty: number;
  margin: number;
  liquidationPrice: number;

  // Distances
  slDistance: number;
  tpDistance: number | null;

  // PNL estimates
  estimatedPnl: number | null;
  riskRewardRatio: number | null;

  // Fees
  totalFees: number;

  // Position value
  positionValue: number;
}

export interface PositionWarnings {
  liqWarning: { level: "safe" | "warning" | "danger"; message: string } | null;
  minOrderWarning: string | null;
  balanceWarning: { message: string; suggestedLeverage?: number } | null;
  priceOrderError: string | null;
}

export interface PnlVerificationResult {
  adjustedQty: number;
  iterations: number;
  verified: boolean;
}

/**
 * Calculate position size from risk amount (PNL-based sizing)
 * This is the CORE algorithm of the trading system
 */
export function calculatePositionSize(input: PositionSizingInput): PositionSizingResult {
  const {
    entryPrice,
    stopLoss,
    riskAmount,
    leverage,
    takeProfit,
    feeBuffer = 0.02,  // 2% default buffer for fees/slippage
    szDecimals = 4,
  } = input;

  // Determine direction from entry vs SL
  const direction: "long" | "short" = stopLoss < entryPrice ? "long" : "short";

  // Calculate SL distance
  const slDistance = Math.abs(entryPrice - stopLoss);
  const slPercent = (slDistance / entryPrice) * 100;

  // Position value = effective risk / (SL distance %)
  // Apply fee buffer to account for fees and slippage
  const effectiveRisk = riskAmount * (1 - feeBuffer);
  const positionValue = effectiveRisk / (slPercent / 100);
  const rawQty = positionValue / entryPrice;
  const qty = parseFloat(rawQty.toFixed(szDecimals));

  // Margin required
  const margin = positionValue / leverage;

  // Liquidation price calculation
  // For long: liq = entry * (1 - 1/leverage + maintenance margin)
  // For short: liq = entry * (1 + 1/leverage - maintenance margin)
  let liquidationPrice: number;
  if (direction === "long") {
    liquidationPrice = entryPrice * (1 - (1 / leverage) + MAINTENANCE_MARGIN);
  } else {
    liquidationPrice = entryPrice * (1 + (1 / leverage) - MAINTENANCE_MARGIN);
  }

  // Fee calculations
  const entryFee = positionValue * TAKER_FEE_RATE;
  const exitFee = positionValue * TAKER_FEE_RATE;
  const totalFees = entryFee + exitFee;

  // TP calculations
  let tpDistance: number | null = null;
  let estimatedPnl: number | null = null;
  let riskRewardRatio: number | null = null;

  if (takeProfit && !isNaN(takeProfit)) {
    tpDistance = Math.abs(takeProfit - entryPrice);
    const grossPnl = (tpDistance / entryPrice) * positionValue;
    estimatedPnl = grossPnl - totalFees;  // Net PNL after fees
    riskRewardRatio = slDistance > 0 ? tpDistance / slDistance : null;
  }

  return {
    direction,
    qty,
    margin: parseFloat(margin.toFixed(2)),
    liquidationPrice: parseFloat(liquidationPrice.toFixed(2)),
    slDistance,
    tpDistance,
    estimatedPnl: estimatedPnl ? parseFloat(estimatedPnl.toFixed(2)) : null,
    riskRewardRatio: riskRewardRatio ? parseFloat(riskRewardRatio.toFixed(2)) : null,
    totalFees: parseFloat(totalFees.toFixed(4)),
    positionValue: parseFloat(positionValue.toFixed(2)),
  };
}

/**
 * Validate trade prices and generate warnings
 */
export function validateTrade(
  input: PositionSizingInput,
  result: PositionSizingResult,
  options: {
    availableBalance?: number;
    minNotional?: number;
    autoAdjustLeverage?: boolean;
    liqWarningDistance?: number;
    liqDangerDistance?: number;
  } = {}
): PositionWarnings {
  const {
    availableBalance = 0,
    minNotional = 10,
    autoAdjustLeverage = true,
    liqWarningDistance = 300,
    liqDangerDistance = 100,
  } = options;

  const { entryPrice, stopLoss, takeProfit, szDecimals = 4 } = input;
  const { direction, qty, margin, liquidationPrice, positionValue } = result;

  const warnings: PositionWarnings = {
    liqWarning: null,
    minOrderWarning: null,
    balanceWarning: null,
    priceOrderError: null,
  };

  // Price order validation - check SL is on correct side
  if (direction === "long" && stopLoss >= entryPrice) {
    warnings.priceOrderError = "Stop Loss must be BELOW entry price for LONG positions";
  } else if (direction === "short" && stopLoss <= entryPrice) {
    warnings.priceOrderError = "Stop Loss must be ABOVE entry price for SHORT positions";
  }

  // Validate TP is on correct side if set
  if (takeProfit && !isNaN(takeProfit)) {
    if (direction === "long" && takeProfit <= entryPrice) {
      warnings.priceOrderError = "Take Profit must be ABOVE entry price for LONG positions";
    } else if (direction === "short" && takeProfit >= entryPrice) {
      warnings.priceOrderError = "Take Profit must be BELOW entry price for SHORT positions";
    }
  }

  // Liquidation safety warnings
  const liqDistanceAbs = Math.abs(liquidationPrice - entryPrice);

  if (direction === "long") {
    if (liquidationPrice >= stopLoss) {
      warnings.liqWarning = {
        level: "danger",
        message: `Liquidation ($${liquidationPrice.toFixed(2)}) is ABOVE your SL! You'll get liquidated before SL hits.`
      };
    } else if (liqDistanceAbs < liqDangerDistance) {
      warnings.liqWarning = {
        level: "danger",
        message: `Liquidation only $${liqDistanceAbs.toFixed(0)} from entry! Very risky.`
      };
    } else if (liqDistanceAbs < liqWarningDistance) {
      warnings.liqWarning = {
        level: "warning",
        message: `Liquidation $${liqDistanceAbs.toFixed(0)} from entry. Consider lower leverage.`
      };
    }
  } else {
    if (liquidationPrice <= stopLoss) {
      warnings.liqWarning = {
        level: "danger",
        message: `Liquidation ($${liquidationPrice.toFixed(2)}) is BELOW your SL! You'll get liquidated before SL hits.`
      };
    } else if (liqDistanceAbs < liqDangerDistance) {
      warnings.liqWarning = {
        level: "danger",
        message: `Liquidation only $${liqDistanceAbs.toFixed(0)} from entry! Very risky.`
      };
    } else if (liqDistanceAbs < liqWarningDistance) {
      warnings.liqWarning = {
        level: "warning",
        message: `Liquidation $${liqDistanceAbs.toFixed(0)} from entry. Consider lower leverage.`
      };
    }
  }

  // Minimum order size check
  const currentPrice = entryPrice;  // Use entry price as proxy
  const minQty = currentPrice > 0 ? minNotional / currentPrice : 0;
  const minByDecimals = Math.pow(10, -szDecimals);
  const effectiveMin = Math.max(minQty, minByDecimals);

  if (qty < effectiveMin) {
    warnings.minOrderWarning = `Min order size is ${effectiveMin.toFixed(szDecimals)} ($${minNotional}). Increase risk or decrease leverage.`;
  }

  // Balance check
  if (availableBalance > 0) {
    const buffer = 1.05;
    const required = margin * buffer;

    if (availableBalance < required) {
      if (autoAdjustLeverage) {
        const suggestedLev = Math.ceil(positionValue / (availableBalance * 0.9));
        warnings.balanceWarning = {
          message: `Need $${required.toFixed(2)} margin, only $${availableBalance.toFixed(2)} available.`,
          suggestedLeverage: suggestedLev
        };
      } else {
        warnings.balanceWarning = {
          message: `Insufficient margin: need $${required.toFixed(2)}, have $${availableBalance.toFixed(2)}`
        };
      }
    }
  }

  return warnings;
}

/**
 * PNL verification with iterative adjustment
 * Verifies that the expected loss at SL matches the intended risk amount
 * Adjusts quantity if needed to match target risk within tolerance
 */
export function verifyAndAdjustPnl(
  qty: number,
  entryPrice: number,
  stopLoss: number,
  targetRisk: number,
  pnlTolerance: number = 0.10,  // 10% tolerance
  maxIterations: number = 5
): PnlVerificationResult {
  let currentQty = qty;
  let iterations = 0;

  while (iterations < maxIterations) {
    // Calculate actual loss at SL
    const slDistance = Math.abs(entryPrice - stopLoss);
    const actualLoss = (slDistance / entryPrice) * (currentQty * entryPrice);
    const diff = Math.abs(actualLoss - targetRisk);
    const diffPercent = diff / targetRisk;

    if (diffPercent <= pnlTolerance) {
      // Within tolerance, verified
      return { adjustedQty: currentQty, iterations, verified: true };
    }

    // Adjust qty to match target risk
    const adjustmentFactor = targetRisk / actualLoss;
    currentQty = currentQty * adjustmentFactor;
    iterations++;
  }

  // Max iterations reached, use best estimate
  return { adjustedQty: currentQty, iterations, verified: false };
}

/**
 * Format quantity for display/order submission based on asset decimals
 */
export function formatQuantity(qty: number, szDecimals: number = 4): string {
  return qty.toFixed(szDecimals);
}

/**
 * Calculate the actual loss at stop loss price
 */
export function calculateLossAtSL(
  qty: number,
  entryPrice: number,
  stopLoss: number
): number {
  const slDistance = Math.abs(entryPrice - stopLoss);
  return (slDistance / entryPrice) * (qty * entryPrice);
}

/**
 * Calculate leverage needed to achieve a specific margin requirement
 */
export function calculateRequiredLeverage(
  positionValue: number,
  availableMargin: number,
  safetyBuffer: number = 0.9  // Use 90% of available
): number {
  return Math.ceil(positionValue / (availableMargin * safetyBuffer));
}
