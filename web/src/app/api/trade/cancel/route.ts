/**
 * Cancel Order API
 *
 * POST /api/trade/cancel - Cancel an open order
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWalletClient } from '@/lib/trading-client';

interface CancelRequest {
  walletId?: string;
  password: string;
  symbol: string;
  orderId: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CancelRequest = await request.json();
    const { walletId, password, symbol, orderId } = body;

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }
    if (orderId === undefined) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Get wallet and client
    const { wallet, client } = await getWalletClient(
      session.user.id,
      walletId || null,
      password
    );

    // Cancel the order
    const success = await client.cancelOrder(symbol, orderId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to cancel order' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} cancelled`,
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

    console.error('Error cancelling order:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    );
  }
}
