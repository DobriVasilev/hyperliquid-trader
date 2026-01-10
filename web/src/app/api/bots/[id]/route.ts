/**
 * Individual Bot API
 *
 * GET /api/bots/[id] - Get bot details
 * PATCH /api/bots/[id] - Update bot configuration
 * DELETE /api/bots/[id] - Delete bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Get bot details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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
          },
        },
        trades: {
          take: 20,
          orderBy: { openedAt: 'desc' },
        },
      },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      bot,
    });
  } catch (error) {
    console.error('Error getting bot:', error);
    return NextResponse.json(
      { error: 'Failed to get bot' },
      { status: 500 }
    );
  }
}

// Update bot configuration
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, symbol, strategyType, parameters, riskSettings, status } = body;

    // Verify bot belongs to user
    const bot = await prisma.botConfig.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Can't modify running bot (except status)
    if (bot.status === 'running' && Object.keys(body).some(k => k !== 'status')) {
      return NextResponse.json(
        { error: 'Cannot modify running bot. Stop it first.' },
        { status: 400 }
      );
    }

    // Update bot
    const updatedBot = await prisma.botConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(symbol !== undefined && { symbol: symbol.toUpperCase() }),
        ...(strategyType !== undefined && { strategyType }),
        ...(parameters !== undefined && { parameters }),
        ...(riskSettings !== undefined && { riskSettings }),
        ...(status !== undefined && { status }),
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
      bot: updatedBot,
    });
  } catch (error) {
    console.error('Error updating bot:', error);
    return NextResponse.json(
      { error: 'Failed to update bot' },
      { status: 500 }
    );
  }
}

// Delete bot
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify bot belongs to user
    const bot = await prisma.botConfig.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Can't delete running bot
    if (bot.status === 'running') {
      return NextResponse.json(
        { error: 'Cannot delete running bot. Stop it first.' },
        { status: 400 }
      );
    }

    // Delete bot (trades are preserved via onDelete: SetNull)
    await prisma.botConfig.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Bot deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting bot:', error);
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    );
  }
}
