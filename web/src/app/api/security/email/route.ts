/**
 * Security Email Verification API
 *
 * POST /api/security/email - Send or verify email code
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  createSecurityCode,
  verifySecurityCode,
  maskEmail,
  type SecurityAction,
  SECURITY_LEVELS,
} from '@/lib/security';
import { prisma } from '@/lib/db';

// Simple email sending function (uses existing auth email infrastructure)
async function sendSecurityEmail(
  email: string,
  code: string,
  action: SecurityAction
): Promise<boolean> {
  // Map action to human-readable description
  const actionDescriptions: Record<SecurityAction, string> = {
    withdraw: 'withdraw funds',
    emergency_withdraw: 'emergency withdrawal',
    delete_wallet: 'delete a wallet',
    change_settings: 'change security settings',
    add_wallet: 'add a wallet',
  };

  const actionText = actionDescriptions[action] || action;

  try {
    // Use the same email provider as auth (Resend)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return false;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'security@dobri.org',
        to: email,
        subject: `Security Code: ${code}`,
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">Security Verification</h2>
            <p style="color: #4a4a4a; margin-bottom: 20px;">
              You requested to <strong>${actionText}</strong>. Use this code to verify your identity:
            </p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1a1a1a;">${code}</span>
            </div>
            <p style="color: #888; font-size: 14px; margin-bottom: 10px;">
              This code expires in 10 minutes.
            </p>
            <p style="color: #888; font-size: 14px;">
              If you didn't request this, please ignore this email or contact support if you're concerned about your account security.
            </p>
          </div>
        `,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send security email:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action: reqAction, code } = body;

    // Validate action type
    const validActions: SecurityAction[] = [
      'withdraw',
      'emergency_withdraw',
      'delete_wallet',
      'change_settings',
      'add_wallet',
    ];

    if (!reqAction || !validActions.includes(reqAction as SecurityAction)) {
      return NextResponse.json(
        { error: 'Invalid action type' },
        { status: 400 }
      );
    }

    const securityAction = reqAction as SecurityAction;

    // Check if this action requires email verification
    const requirements = SECURITY_LEVELS[securityAction];
    if (!requirements?.email) {
      return NextResponse.json(
        { error: 'This action does not require email verification' },
        { status: 400 }
      );
    }

    // If code provided, verify it
    if (code) {
      const result = await verifySecurityCode(session.user.id, securityAction, code);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        message: 'Email verified',
      });
    }

    // Otherwise, send a new code
    const result = await createSecurityCode(session.user.id, securityAction);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }

    // Send email
    const emailSent = await sendSecurityEmail(
      session.user.email,
      result.code!,
      securityAction
    );

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      maskedEmail: maskEmail(session.user.email),
    });
  } catch (error) {
    console.error('Error with email verification:', error);
    return NextResponse.json(
      { error: 'Failed to process email verification' },
      { status: 500 }
    );
  }
}
