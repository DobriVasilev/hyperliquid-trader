import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chat/safety-number?userId=xxx - Get safety number for a conversation
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get("userId");

    if (!otherUserId) {
      return NextResponse.json(
        { success: false, error: "User ID required" },
        { status: 400 }
      );
    }

    // Sort user IDs for consistent lookup
    const [user1Id, user2Id] =
      session.user.id < otherUserId
        ? [session.user.id, otherUserId]
        : [otherUserId, session.user.id];

    // Get existing safety number
    const safetyNumber = await prisma.safetyNumber.findUnique({
      where: {
        user1Id_user2Id: { user1Id, user2Id },
      },
    });

    if (!safetyNumber) {
      // Get both users' identity keys to generate safety number
      const [myKeys, theirKeys] = await Promise.all([
        prisma.userKeyBundle.findUnique({ where: { userId: session.user.id } }),
        prisma.userKeyBundle.findUnique({ where: { userId: otherUserId } }),
      ]);

      if (!myKeys || !theirKeys) {
        return NextResponse.json(
          { success: false, error: "Both users must have encryption keys" },
          { status: 404 }
        );
      }

      // Return the keys for client-side fingerprint generation
      return NextResponse.json({
        success: true,
        data: {
          exists: false,
          myIdentityKey: myKeys.identityPublicKey,
          theirIdentityKey: theirKeys.identityPublicKey,
          myUserId: session.user.id,
          theirUserId: otherUserId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        exists: true,
        fingerprint: safetyNumber.fingerprint,
        verifiedByMe:
          session.user.id === user1Id
            ? safetyNumber.verifiedByUser1
            : safetyNumber.verifiedByUser2,
        verifiedByThem:
          session.user.id === user1Id
            ? safetyNumber.verifiedByUser2
            : safetyNumber.verifiedByUser1,
        verifiedAt: safetyNumber.verifiedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching safety number:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch safety number" },
      { status: 500 }
    );
  }
}

// POST /api/chat/safety-number - Save and optionally verify safety number
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { userId: otherUserId, fingerprint, verify } = body;

    if (!otherUserId || !fingerprint) {
      return NextResponse.json(
        { success: false, error: "User ID and fingerprint required" },
        { status: 400 }
      );
    }

    // Sort user IDs
    const [user1Id, user2Id] =
      session.user.id < otherUserId
        ? [session.user.id, otherUserId]
        : [otherUserId, session.user.id];

    const isUser1 = session.user.id === user1Id;

    // Upsert safety number
    const safetyNumber = await prisma.safetyNumber.upsert({
      where: {
        user1Id_user2Id: { user1Id, user2Id },
      },
      create: {
        user1Id,
        user2Id,
        fingerprint,
        verifiedByUser1: isUser1 && verify,
        verifiedByUser2: !isUser1 && verify,
        verifiedAt: verify ? new Date() : null,
      },
      update: {
        fingerprint,
        ...(verify && {
          [isUser1 ? "verifiedByUser1" : "verifiedByUser2"]: true,
          verifiedAt: new Date(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        fingerprint: safetyNumber.fingerprint,
        verifiedByMe: isUser1
          ? safetyNumber.verifiedByUser1
          : safetyNumber.verifiedByUser2,
        verifiedByThem: isUser1
          ? safetyNumber.verifiedByUser2
          : safetyNumber.verifiedByUser1,
      },
    });
  } catch (error) {
    console.error("Error saving safety number:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save safety number" },
      { status: 500 }
    );
  }
}
