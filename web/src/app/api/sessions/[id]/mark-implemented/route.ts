/**
 * Mark Implemented API
 *
 * POST /api/sessions/[id]/mark-implemented - Mark session feedback as implemented
 * Admin only - sends email notification to user
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function verifyAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'admin';
}

async function sendImplementedEmail(
  userEmail: string,
  userName: string | null,
  sessionName: string,
  indicator: string,
  sessionUrl: string
): Promise<boolean> {
  try {
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
        from: process.env.EMAIL_FROM || 'noreply@dobri.org',
        to: userEmail,
        subject: `Your feedback has been implemented!`,
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">Your Feedback Has Been Implemented!</h2>

            <p style="color: #4a4a4a; margin-bottom: 20px;">
              Hi ${userName || 'there'},
            </p>

            <p style="color: #4a4a4a; margin-bottom: 20px;">
              Great news! Your feedback about the <strong>${indicator}</strong> indicator has been implemented.
            </p>

            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #666; font-size: 14px; margin-bottom: 8px;">Your Session:</p>
              <p style="margin: 0; color: #1a1a1a; font-weight: 500; font-size: 16px;">${sessionName}</p>
            </div>

            <p style="color: #4a4a4a; margin-bottom: 20px;">
              The improvements are now live on the platform. Thank you for helping us make the indicators better!
            </p>

            <a href="${sessionUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-bottom: 20px;">
              View Your Session
            </a>

            <p style="color: #888; font-size: 14px; margin-top: 20px;">
              Keep the feedback coming! Your insights help improve the trading experience for everyone.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

            <p style="color: #999; font-size: 12px;">
              The Trading Team
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send implemented email:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send implemented email:', error);
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    const isAdmin = await verifyAdmin(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: sessionId } = await params;

    // Get session with user info
    const patternSession = await prisma.patternSession.findUnique({
      where: { id: sessionId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!patternSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if already implemented
    if (patternSession.status === 'implemented') {
      return NextResponse.json(
        { error: 'Session already marked as implemented' },
        { status: 400 }
      );
    }

    // Update session status
    const updatedSession = await prisma.patternSession.update({
      where: { id: sessionId },
      data: {
        status: 'implemented',
        implementedAt: new Date(),
        implementedBy: session.user.id,
      },
    });

    // Send email notification
    if (patternSession.createdBy.email) {
      const sessionUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://dobri.org'}/sessions/${sessionId}`;

      const emailSent = await sendImplementedEmail(
        patternSession.createdBy.email,
        patternSession.createdBy.name,
        patternSession.name,
        patternSession.patternType,
        sessionUrl
      );

      if (!emailSent) {
        console.warn('Failed to send email notification, but session was marked as implemented');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Session marked as implemented',
      session: updatedSession,
    });
  } catch (error) {
    console.error('Error marking session as implemented:', error);
    return NextResponse.json(
      { error: 'Failed to mark session as implemented' },
      { status: 500 }
    );
  }
}
