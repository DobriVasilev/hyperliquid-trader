/**
 * Bot Start API
 *
 * POST /api/bots/[id]/start - Start a bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deserializeEncryptedData, decryptPrivateKey } from '@/lib/wallet-encryption';
import { botRunner } from '@/lib/bot-runner';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Wallet password is required' },
        { status: 400 }
      );
    }

    // Get bot with wallet
    const bot = await prisma.botConfig.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        wallet: {
          select: {
            id: true,
            nickname: true,
            address: true,
            encryptedKey: true,
          },
        },
      },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    if (bot.status === 'running') {
      return NextResponse.json(
        { error: 'Bot is already running' },
        { status: 400 }
      );
    }

    // Verify password by attempting decryption
    try {
      const encryptedData = deserializeEncryptedData(bot.wallet.encryptedKey);
      await decryptPrivateKey(encryptedData, password);
    } catch {
      return NextResponse.json(
        { error: 'Invalid wallet password' },
        { status: 401 }
      );
    }

    // Update bot status to running
    const updatedBot = await prisma.botConfig.update({
      where: { id },
      data: {
        status: 'running',
        statusMessage: null,
        lastRunAt: new Date(),
      },
    });

    // Register bot with the runner (in-memory for this instance)
    botRunner.register(id, password);

    return NextResponse.json({
      success: true,
      bot: {
        id: updatedBot.id,
        status: updatedBot.status,
        name: updatedBot.name,
        symbol: updatedBot.symbol,
      },
      message: 'Bot started successfully',
    });
  } catch (error) {
    console.error('Error starting bot:', error);
    return NextResponse.json(
      { error: 'Failed to start bot' },
      { status: 500 }
    );
  }
}
