/**
 * Bot Stop API
 *
 * POST /api/bots/[id]/stop - Stop a bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
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

    // Get bot
    const bot = await prisma.botConfig.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    if (bot.status !== 'running') {
      return NextResponse.json(
        { error: 'Bot is not running' },
        { status: 400 }
      );
    }

    // Unregister bot from runner
    botRunner.unregister(id);

    // Update bot status
    const updatedBot = await prisma.botConfig.update({
      where: { id },
      data: {
        status: 'stopped',
        statusMessage: 'Stopped by user',
      },
    });

    return NextResponse.json({
      success: true,
      bot: {
        id: updatedBot.id,
        status: updatedBot.status,
        name: updatedBot.name,
        symbol: updatedBot.symbol,
      },
      message: 'Bot stopped successfully',
    });
  } catch (error) {
    console.error('Error stopping bot:', error);
    return NextResponse.json(
      { error: 'Failed to stop bot' },
      { status: 500 }
    );
  }
}
