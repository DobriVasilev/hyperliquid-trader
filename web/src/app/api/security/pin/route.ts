/**
 * Security PIN API
 *
 * POST /api/security/pin - Set up or verify PIN
 * GET /api/security/pin - Check PIN status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  setupPin,
  verifyPin,
  hasPinSetup,
  validatePinFormat,
  isUserLockedOut,
  getLockoutRemaining,
} from '@/lib/security';
import { prisma } from '@/lib/db';

// GET - Check if user has PIN set up
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        securityPin: true,
        pinLockedUntil: true,
        pinSetAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hasPin = !!user.securityPin;
    const isLocked = isUserLockedOut(user.pinLockedUntil);
    const lockoutRemaining = getLockoutRemaining(user.pinLockedUntil);

    return NextResponse.json({
      success: true,
      hasPin,
      isLocked,
      lockoutRemaining,
      pinSetAt: user.pinSetAt,
    });
  } catch (error) {
    console.error('Error checking PIN status:', error);
    return NextResponse.json(
      { error: 'Failed to check PIN status' },
      { status: 500 }
    );
  }
}

// POST - Set up or verify PIN
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, pin, newPin } = body;

    if (!action || !['setup', 'verify', 'change'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "setup", "verify", or "change".' },
        { status: 400 }
      );
    }

    // Setup new PIN
    if (action === 'setup') {
      if (!pin) {
        return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
      }

      // Check if already has PIN
      const hasExisting = await hasPinSetup(session.user.id);
      if (hasExisting) {
        return NextResponse.json(
          { error: 'PIN already set up. Use "change" action to update.' },
          { status: 400 }
        );
      }

      const result = await setupPin(session.user.id, pin);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'PIN set up successfully',
      });
    }

    // Verify PIN
    if (action === 'verify') {
      if (!pin) {
        return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
      }

      const result = await verifyPin(session.user.id, pin);

      if (!result.success) {
        return NextResponse.json(
          {
            error: result.error,
            attemptsRemaining: result.attemptsRemaining,
            lockedUntil: result.lockedUntil,
          },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'PIN verified',
      });
    }

    // Change PIN
    if (action === 'change') {
      if (!pin || !newPin) {
        return NextResponse.json(
          { error: 'Current PIN and new PIN are required' },
          { status: 400 }
        );
      }

      // Verify current PIN first
      const verifyResult = await verifyPin(session.user.id, pin);
      if (!verifyResult.success) {
        return NextResponse.json(
          {
            error: verifyResult.error,
            attemptsRemaining: verifyResult.attemptsRemaining,
            lockedUntil: verifyResult.lockedUntil,
          },
          { status: 401 }
        );
      }

      // Validate new PIN format
      const validation = validatePinFormat(newPin);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Set new PIN
      const result = await setupPin(session.user.id, newPin);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'PIN changed successfully',
      });
    }
  } catch (error) {
    console.error('Error with PIN operation:', error);
    return NextResponse.json(
      { error: 'Failed to process PIN operation' },
      { status: 500 }
    );
  }
}
