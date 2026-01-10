/**
 * Account API
 *
 * GET /api/account - Get account info (balance, equity, margin)
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
    const { walletId, password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Get wallet and client
    const { wallet, client } = await getWalletClient(
      session.user.id,
      walletId || null,
      password
    );

    // Get account info
    const accountInfo = await client.getAccountInfo();

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        nickname: wallet.nickname,
      },
      account: accountInfo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Invalid password') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error('Error getting account:', error);
    return NextResponse.json(
      { error: 'Failed to get account info' },
      { status: 500 }
    );
  }
}
