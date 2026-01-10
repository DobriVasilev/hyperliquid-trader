/**
 * Close Position API
 *
 * POST /api/trade/close - Close a position (single or all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getWalletClient } from '@/lib/trading-client';

interface CloseRequest {
  walletId?: string;
  password: string;
  symbol?: string; // If not provided, closes all positions
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CloseRequest = await request.json();
    const { walletId, password, symbol } = body;

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Get wallet and client
    const { wallet, client } = await getWalletClient(
      session.user.id,
      walletId || null,
      password
    );

    let result;
    if (symbol) {
      // Close single position
      result = await client.closePosition(symbol);
    } else {
      // Close all positions
      result = await client.closeAllPositions();
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to close position' },
        { status: 400 }
      );
    }

    // Update trades in database
    const updateWhere = symbol
      ? { walletId: wallet.id, symbol, status: 'open' }
      : { walletId: wallet.id, status: 'open' };

    await prisma.trade.updateMany({
      where: updateWhere,
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });

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

    if (message === 'Invalid password') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
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
