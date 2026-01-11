/**
 * Trade Execution API
 *
 * POST /api/trade - Execute a trade (market or limit order)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWalletClient, recordTrade } from '@/lib/trading-client';

interface TradeRequest {
  walletId?: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  leverage?: number;
  orderType: 'market' | 'limit';
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: TradeRequest = await request.json();
    const {
      walletId,
      symbol,
      side,
      size,
      leverage = 1,
      orderType,
      limitPrice,
      stopLoss,
      takeProfit,
    } = body;

    // Validate inputs
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }
    if (!side || !['long', 'short'].includes(side)) {
      return NextResponse.json({ error: 'Side must be "long" or "short"' }, { status: 400 });
    }
    if (!size || size <= 0) {
      return NextResponse.json({ error: 'Size must be positive' }, { status: 400 });
    }
    if (!orderType || !['market', 'limit'].includes(orderType)) {
      return NextResponse.json({ error: 'Order type must be "market" or "limit"' }, { status: 400 });
    }
    if (orderType === 'limit' && !limitPrice) {
      return NextResponse.json({ error: 'Limit price required for limit orders' }, { status: 400 });
    }

    // Get wallet and client (uses server-side encryption, no password needed)
    const { wallet, client } = await getWalletClient(
      session.user.id,
      walletId || null
    );

    // Set leverage first
    if (leverage > 1) {
      await client.setLeverage(symbol, leverage);
    }

    // Execute the order
    const isBuy = side === 'long';
    let result;

    if (orderType === 'market') {
      result = await client.placeMarketOrder(symbol, isBuy, size);
    } else {
      result = await client.placeOrder({
        asset: symbol,
        isBuy,
        size,
        price: limitPrice!,
        reduceOnly: false,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Order failed' },
        { status: 400 }
      );
    }

    // Get fill price (for market orders, use mid price estimate)
    const prices = await client.getMarketPrices();
    const entryPrice = prices[symbol] || 0;

    // Place stop loss if specified
    let slOrderId: number | undefined;
    if (stopLoss && result.success) {
      const slResult = await client.placeStopLoss(symbol, isBuy, size, stopLoss);
      if (slResult.success) {
        slOrderId = slResult.orderId;
      }
    }

    // Place take profit if specified
    let tpOrderId: number | undefined;
    if (takeProfit && result.success) {
      const tpResult = await client.placeTakeProfit(symbol, isBuy, size, takeProfit);
      if (tpResult.success) {
        tpOrderId = tpResult.orderId;
      }
    }

    // Record trade in database
    const trade = await recordTrade({
      userId: session.user.id,
      walletId: wallet.id,
      symbol,
      side,
      size,
      leverage,
      entryPrice,
      stopLoss,
      takeProfit,
      status: 'open',
      entryOrderId: result.orderId?.toString(),
      slOrderId: slOrderId?.toString(),
      tpOrderId: tpOrderId?.toString(),
    });

    return NextResponse.json({
      success: true,
      trade: {
        id: trade.id,
        symbol,
        side,
        size,
        leverage,
        entryPrice,
        stopLoss,
        takeProfit,
        orderId: result.orderId,
        slOrderId,
        tpOrderId,
      },
      wallet: {
        id: wallet.id,
        address: wallet.address,
        nickname: wallet.nickname,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error('Error executing trade:', error);
    return NextResponse.json(
      { error: 'Failed to execute trade' },
      { status: 500 }
    );
  }
}
