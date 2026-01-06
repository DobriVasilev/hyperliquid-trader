import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chat/keys?userId=xxx - Get a user's public key bundle
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
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID required" },
        { status: 400 }
      );
    }

    // Get user's key bundle
    const keyBundle = await prisma.userKeyBundle.findUnique({
      where: { userId },
      include: {
        oneTimePrekeys: {
          where: { used: false },
          take: 1, // Only return one unused prekey
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!keyBundle) {
      return NextResponse.json(
        { success: false, error: "User has no encryption keys" },
        { status: 404 }
      );
    }

    const oneTimePrekey = keyBundle.oneTimePrekeys[0] || null;

    // Mark the one-time prekey as used
    if (oneTimePrekey) {
      await prisma.userOneTimePrekey.update({
        where: { id: oneTimePrekey.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: keyBundle.userId,
        identityPublicKey: keyBundle.identityPublicKey,
        signedPrekeyId: keyBundle.signedPrekeyId,
        signedPrekeyPublic: keyBundle.signedPrekeyPublic,
        signedPrekeySignature: keyBundle.signedPrekeySignature,
        oneTimePrekeyId: oneTimePrekey?.keyId || null,
        oneTimePrekeyPublic: oneTimePrekey?.publicKey || null,
      },
    });
  } catch (error) {
    console.error("Error fetching key bundle:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch keys" },
      { status: 500 }
    );
  }
}

// POST /api/chat/keys - Register or update key bundle
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
    const {
      identityPublicKey,
      signedPrekeyId,
      signedPrekeyPublic,
      signedPrekeySignature,
      oneTimePrekeys, // Array of { id: number, publicKey: string }
    } = body;

    // Validate required fields
    if (
      !identityPublicKey ||
      !signedPrekeyId ||
      !signedPrekeyPublic ||
      !signedPrekeySignature
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required key fields" },
        { status: 400 }
      );
    }

    // Upsert key bundle
    const keyBundle = await prisma.userKeyBundle.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        identityPublicKey,
        signedPrekeyId,
        signedPrekeyPublic,
        signedPrekeySignature,
      },
      update: {
        signedPrekeyId,
        signedPrekeyPublic,
        signedPrekeySignature,
        // Don't update identity key - that would break existing sessions
      },
    });

    // Add one-time prekeys if provided
    if (oneTimePrekeys && Array.isArray(oneTimePrekeys)) {
      await prisma.userOneTimePrekey.createMany({
        data: oneTimePrekeys.map(
          (key: { id: number; publicKey: string }) => ({
            keyBundleId: keyBundle.id,
            keyId: key.id,
            publicKey: key.publicKey,
          })
        ),
        skipDuplicates: true,
      });
    }

    // Count remaining unused prekeys
    const unusedCount = await prisma.userOneTimePrekey.count({
      where: {
        keyBundleId: keyBundle.id,
        used: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        keyBundleId: keyBundle.id,
        unusedPrekeyCount: unusedCount,
      },
    });
  } catch (error) {
    console.error("Error registering keys:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register keys" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/keys - Remove all encryption keys (dangerous!)
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // This is a destructive operation - should require confirmation
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get("confirm");

    if (confirm !== "true") {
      return NextResponse.json(
        {
          success: false,
          error: "Confirmation required. Add ?confirm=true to proceed.",
        },
        { status: 400 }
      );
    }

    // Delete all encrypted sessions
    await prisma.encryptedSession.deleteMany({
      where: { userId: session.user.id },
    });

    // Delete key bundle (cascades to prekeys)
    await prisma.userKeyBundle.delete({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting keys:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete keys" },
      { status: 500 }
    );
  }
}
