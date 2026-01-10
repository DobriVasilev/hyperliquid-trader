/**
 * Individual Wallet API
 *
 * GET /api/wallets/[id] - Get wallet details
 * PATCH /api/wallets/[id] - Update wallet (nickname, default status)
 * DELETE /api/wallets/[id] - Remove wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Get wallet details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const wallet = await prisma.userWallet.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        nickname: true,
        address: true,
        isDefault: true,
        lastUsedAt: true,
        createdAt: true,
        _count: {
          select: {
            bots: true,
            trades: true,
          },
        },
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      wallet,
    });
  } catch (error) {
    console.error('Error getting wallet:', error);
    return NextResponse.json(
      { error: 'Failed to get wallet' },
      { status: 500 }
    );
  }
}

// Update wallet
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { nickname, isDefault } = body;

    // Verify wallet belongs to user
    const wallet = await prisma.userWallet.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await prisma.userWallet.updateMany({
        where: {
          userId: session.user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Update wallet
    const updatedWallet = await prisma.userWallet.update({
      where: { id },
      data: {
        ...(nickname !== undefined && { nickname }),
        ...(isDefault !== undefined && { isDefault }),
      },
      select: {
        id: true,
        nickname: true,
        address: true,
        isDefault: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      wallet: updatedWallet,
    });
  } catch (error) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to update wallet' },
      { status: 500 }
    );
  }
}

// Delete wallet
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify wallet belongs to user
    const wallet = await prisma.userWallet.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        _count: {
          select: {
            bots: true,
          },
        },
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Check if wallet has active bots
    if (wallet._count.bots > 0) {
      return NextResponse.json(
        { error: 'Cannot delete wallet with active bots. Please stop and remove all bots first.' },
        { status: 400 }
      );
    }

    // Delete wallet
    await prisma.userWallet.delete({
      where: { id },
    });

    // If this was the default wallet, set another one as default
    if (wallet.isDefault) {
      const anotherWallet = await prisma.userWallet.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (anotherWallet) {
        await prisma.userWallet.update({
          where: { id: anotherWallet.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Wallet deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting wallet:', error);
    return NextResponse.json(
      { error: 'Failed to delete wallet' },
      { status: 500 }
    );
  }
}
