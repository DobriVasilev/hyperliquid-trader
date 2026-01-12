/**
 * Extension Bridge - Execute Trade API
 *
 * POST /api/extension/execute
 *
 * Executes a trade from the TradingView extension.
 * Authentication via API key header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deserializeEncryptedData, decryptPrivateKeyServerSide } from '@/lib/wallet-encryption';
import { HyperliquidClient } from '@/lib/hyperliquid';
import { isUsingTradingApi, tradingApi } from '@/lib/trading-client';
import {
  calculatePositionSize,
  verifyAndAdjustPnl,
} from '@/lib/position-sizing';

interface ExecuteTradeRequest {
  direction: 'long' | 'short';
  entry: number;
  stopLoss: number;
  takeProfit?: number;
  risk: number;
  leverage: number;
  timeframe?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    // Find extension key with wallet
    const extensionKey = await prisma.extensionKey.findUnique({
      where: { key: apiKey },
      include: {
        user: true,
        wallet: {
          select: {
            id: true,
            address: true,
            nickname: true,
            encryptedKey: true,
          },
        },
      },
    });

    if (!extensionKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (!extensionKey.wallet) {
      return NextResponse.json({ error: 'No wallet configured for this key' }, { status: 400 });
    }

    const body: ExecuteTradeRequest = await request.json();
    const { direction, entry, stopLoss, takeProfit, risk, leverage, timeframe } = body;

    // Validate inputs
    if (!direction || !['long', 'short'].includes(direction)) {
      return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
    }
    if (!entry || entry <= 0) {
      return NextResponse.json({ error: 'Invalid entry price' }, { status: 400 });
    }
    if (!stopLoss || stopLoss <= 0) {
      return NextResponse.json({ error: 'Invalid stop loss' }, { status: 400 });
    }
    if (!risk || risk <= 0) {
      return NextResponse.json({ error: 'Invalid risk amount' }, { status: 400 });
    }
    if (!leverage || leverage < 1) {
      return NextResponse.json({ error: 'Invalid leverage' }, { status: 400 });
    }

    // Validate direction vs SL placement
    if (direction === 'long' && stopLoss >= entry) {
      return NextResponse.json({ error: 'Stop loss must be below entry for long positions' }, { status: 400 });
    }
    if (direction === 'short' && stopLoss <= entry) {
      return NextResponse.json({ error: 'Stop loss must be above entry for short positions' }, { status: 400 });
    }

    // Calculate position size using PNL-based sizing
    const sizingResult = calculatePositionSize({
      entryPrice: entry,
      stopLoss,
      riskAmount: risk,
      leverage,
      takeProfit,
    });

    // Verify and adjust PNL
    const { adjustedQty, verified } = verifyAndAdjustPnl(
      sizingResult.qty,
      entry,
      stopLoss,
      risk,
      0.10 // 10% tolerance
    );

    const finalQty = verified ? adjustedQty : sizingResult.qty;
    const isBuy = direction === 'long';
    const encryptedKey = extensionKey.wallet.encryptedKey;

    let result: { success: boolean; orderId?: number; error?: string };
    let slOrderId: number | undefined;
    let tpOrderId: number | undefined;

    if (isUsingTradingApi()) {
      // Remote mode: Use Trading API
      // Set leverage first
      if (leverage > 1) {
        await tradingApi.setLeverage(encryptedKey, extensionKey.asset, leverage);
      }

      // Execute market order
      const marketResult = await tradingApi.placeMarketOrder(encryptedKey, extensionKey.asset, isBuy, finalQty);
      if (!marketResult.success || !marketResult.data?.success) {
        return NextResponse.json(
          { error: marketResult.error || marketResult.data?.error || 'Order failed' },
          { status: 400 }
        );
      }
      result = marketResult.data;

      // Place stop loss
      const slResult = await tradingApi.placeStopLoss(encryptedKey, extensionKey.asset, isBuy, finalQty, stopLoss);
      if (slResult.success && slResult.data?.success) {
        slOrderId = slResult.data.orderId;
      }

      // Place take profit if specified
      if (takeProfit) {
        const tpResult = await tradingApi.placeTakeProfit(encryptedKey, extensionKey.asset, isBuy, finalQty, takeProfit);
        if (tpResult.success && tpResult.data?.success) {
          tpOrderId = tpResult.data.orderId;
        }
      }
    } else {
      // Local mode: Use Hyperliquid client directly
      const encryptedData = deserializeEncryptedData(encryptedKey);
      let privateKey: string;

      try {
        privateKey = await decryptPrivateKeyServerSide(encryptedData);
      } catch {
        return NextResponse.json({ error: 'Failed to decrypt wallet' }, { status: 500 });
      }

      const client = new HyperliquidClient(privateKey);
      await client.initialize();

      // Set leverage first
      if (leverage > 1) {
        await client.setLeverage(extensionKey.asset, leverage);
      }

      // Execute market order
      result = await client.placeMarketOrder(extensionKey.asset, isBuy, finalQty);

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Order failed' }, { status: 400 });
      }

      // Place stop loss
      const slResult = await client.placeStopLoss(extensionKey.asset, isBuy, finalQty, stopLoss);
      if (slResult.success) {
        slOrderId = slResult.orderId;
      }

      // Place take profit if specified
      if (takeProfit) {
        const tpResult = await client.placeTakeProfit(extensionKey.asset, isBuy, finalQty, takeProfit);
        if (tpResult.success) {
          tpOrderId = tpResult.orderId;
        }
      }
    }

    // Record trade in database
    await prisma.trade.create({
      data: {
        userId: extensionKey.userId,
        walletId: extensionKey.wallet.id,
        symbol: extensionKey.asset,
        side: direction,
        size: finalQty,
        leverage,
        entryPrice: entry,
        stopLoss,
        takeProfit,
        status: 'open',
        entryOrderId: result.orderId?.toString(),
        slOrderId: slOrderId?.toString(),
        tpOrderId: tpOrderId?.toString(),
        notes: timeframe ? `TF: ${timeframe}` : undefined,
      },
    });

    // Update extension key last used
    await prisma.extensionKey.update({
      where: { id: extensionKey.id },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      trade: {
        symbol: extensionKey.asset,
        direction,
        qty: finalQty,
        entry,
        stopLoss,
        takeProfit,
        leverage,
        orderId: result.orderId,
        slOrderId,
        tpOrderId,
      },
    });
  } catch (error) {
    console.error('Extension execute error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
