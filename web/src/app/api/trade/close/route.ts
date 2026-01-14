/**
 * Close Position API
 *
 * POST /api/trade/close - Close a position (single or all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getWalletClient, isUsingTradingApi, tradingApi } from '@/lib/trading-client';
import { sendTradeCloseToSheets } from '@/lib/google-sheets-sync';

interface CloseRequest {
  walletId?: string;
  symbol?: string; // If not provided, closes all positions
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CloseRequest = await request.json();
    const { walletId, symbol } = body;

    // Get wallet and optionally client
    const { wallet, client } = await getWalletClient(
      session.user.id,
      walletId || null
    );

    // Fetch current positions to get mark price (exit price) before closing
    let currentPositions: any[] = [];
    try {
      if (isUsingTradingApi()) {
        const posResult = await tradingApi.getPositions(wallet.encryptedKey);
        if (posResult.success && posResult.data) {
          currentPositions = posResult.data;
        }
      } else if (client) {
        const posResult = await client.getPositions();
        currentPositions = posResult || [];
      }
    } catch (err) {
      console.error('Failed to fetch positions before close:', err);
    }

    let result: { success: boolean; error?: string };

    if (isUsingTradingApi()) {
      // Remote mode: Use Trading API
      if (symbol) {
        const apiResult = await tradingApi.closePosition(wallet.encryptedKey, symbol);
        result = {
          success: apiResult.success && (apiResult.data?.success ?? false),
          error: apiResult.error || apiResult.data?.error,
        };
      } else {
        const apiResult = await tradingApi.closeAllPositions(wallet.encryptedKey);
        result = {
          success: apiResult.success && (apiResult.data?.success ?? false),
          error: apiResult.error || apiResult.data?.error,
        };
      }
    } else {
      // Local mode: Use Hyperliquid client directly
      if (!client) {
        return NextResponse.json({ error: 'Client not initialized' }, { status: 500 });
      }
      if (symbol) {
        result = await client.closePosition(symbol);
      } else {
        result = await client.closeAllPositions();
      }
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to close position' },
        { status: 400 }
      );
    }

    // Fetch trades before closing to get data for Google Sheets
    const updateWhere = symbol
      ? { walletId: wallet.id, symbol, status: 'open', userId: session.user.id }
      : { walletId: wallet.id, status: 'open', userId: session.user.id };

    const openTrades = await prisma.trade.findMany({
      where: updateWhere,
      select: {
        id: true,
        symbol: true,
        entryPrice: true,
        stopLoss: true,
        exitPrice: true,
        pnl: true,
      },
    });

    // Update trades in database
    await prisma.trade.updateMany({
      where: updateWhere,
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });

    // Send each closed trade to Google Sheets with current mark price as exit
    for (const trade of openTrades) {
      if (trade.entryPrice && trade.stopLoss) {
        // Find the position that was just closed to get the exit price (mark price)
        const position = currentPositions.find((p: any) => p.symbol === trade.symbol);
        const exitPrice = position?.markPrice || position?.entryPrice || trade.entryPrice;

        // Calculate PnL (rough estimate if we don't have exact size)
        const pnl = trade.pnl || 0;

        sendTradeCloseToSheets({
          userId: session.user.id,
          coin: trade.symbol,
          entry: trade.entryPrice,
          sl: trade.stopLoss,
          exitPrice: exitPrice,
          realizedLoss: pnl < 0 ? pnl : null,
          realizedWin: pnl > 0 ? pnl : null,
        }).catch(err => console.error('Google Sheets close sync error:', err));
      }
    }

    return NextResponse.json({
      success: true,
      message: symbol ? `Closed ${symbol} position` : 'Closed all positions',
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

    console.error('Error closing position:', error);
    return NextResponse.json(
      { error: 'Failed to close position' },
      { status: 500 }
    );
  }
}
