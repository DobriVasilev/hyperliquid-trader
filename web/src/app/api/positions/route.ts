/**
 * Positions API
 *
 * POST /api/positions - Get open positions for a wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWalletClient } from '@/lib/trading-client';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { walletId } = body;

    // Get wallet and client (uses server-side encryption, no password needed)
    const { wallet, client } = await getWalletClient(
      session.user.id,
      walletId || null
    );

    // Get positions and orders in parallel
    const [positions, openOrders] = await Promise.all([
      client.getPositions(),
      client.getOpenOrders(),
    ]);

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        nickname: wallet.nickname,
      },
      positions,
      openOrders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error('Error getting positions:', error);
    return NextResponse.json(
      { error: 'Failed to get positions' },
      { status: 500 }
    );
  }
}
