/**
 * Bots API
 *
 * GET /api/bots - List user's bots
 * POST /api/bots - Create a new bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Default risk settings
const DEFAULT_RISK_SETTINGS = {
  riskPerTrade: 1, // 1% of account per trade
  maxDailyLoss: 5, // 5% max daily loss
  leverage: 10,
  maxPositions: 3,
};

// List user's bots
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bots = await prisma.botConfig.findMany({
      where: { userId: session.user.id },
      include: {
        wallet: {
          select: {
            id: true,
            nickname: true,
            address: true,
          },
        },
        _count: {
          select: {
            trades: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      bots,
    });
  } catch (error) {
    console.error('Error listing bots:', error);
    return NextResponse.json(
      { error: 'Failed to list bots' },
      { status: 500 }
    );
  }
}

// Create a new bot
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      walletId,
      name,
      symbol,
      strategyType,
      parameters = {},
      riskSettings = DEFAULT_RISK_SETTINGS,
    } = body;

    // Validate required fields
    if (!walletId || !name || !symbol || !strategyType) {
      return NextResponse.json(
        { error: 'Missing required fields: walletId, name, symbol, strategyType' },
        { status: 400 }
      );
    }

    // Verify wallet belongs to user
    const wallet = await prisma.userWallet.findFirst({
      where: {
        id: walletId,
        userId: session.user.id,
      },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Create bot
    const bot = await prisma.botConfig.create({
      data: {
        userId: session.user.id,
        walletId,
        name,
        symbol: symbol.toUpperCase(),
        strategyType,
        parameters,
        riskSettings: {
          ...DEFAULT_RISK_SETTINGS,
          ...riskSettings,
        },
        status: 'stopped',
      },
      include: {
        wallet: {
          select: {
            id: true,
            nickname: true,
            address: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      bot,
    });
  } catch (error) {
    console.error('Error creating bot:', error);
    return NextResponse.json(
      { error: 'Failed to create bot' },
      { status: 500 }
    );
  }
}
