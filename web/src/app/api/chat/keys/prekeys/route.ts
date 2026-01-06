import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/chat/keys/prekeys - Add more one-time prekeys
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
    const { prekeys } = body; // Array of { id: number, publicKey: string }

    if (!prekeys || !Array.isArray(prekeys) || prekeys.length === 0) {
      return NextResponse.json(
        { success: false, error: "Prekeys array required" },
        { status: 400 }
      );
    }

    // Get user's key bundle
    const keyBundle = await prisma.userKeyBundle.findUnique({
      where: { userId: session.user.id },
    });

    if (!keyBundle) {
      return NextResponse.json(
        { success: false, error: "No key bundle found. Register keys first." },
        { status: 404 }
      );
    }

    // Add prekeys
    await prisma.userOneTimePrekey.createMany({
      data: prekeys.map((key: { id: number; publicKey: string }) => ({
        keyBundleId: keyBundle.id,
        keyId: key.id,
        publicKey: key.publicKey,
      })),
      skipDuplicates: true,
    });

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
        added: prekeys.length,
        unusedPrekeyCount: unusedCount,
      },
    });
  } catch (error) {
    console.error("Error adding prekeys:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add prekeys" },
      { status: 500 }
    );
  }
}

// GET /api/chat/keys/prekeys - Get prekey count
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const keyBundle = await prisma.userKeyBundle.findUnique({
      where: { userId: session.user.id },
    });

    if (!keyBundle) {
      return NextResponse.json({
        success: true,
        data: {
          hasKeyBundle: false,
          unusedPrekeyCount: 0,
        },
      });
    }

    const unusedCount = await prisma.userOneTimePrekey.count({
      where: {
        keyBundleId: keyBundle.id,
        used: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        hasKeyBundle: true,
        unusedPrekeyCount: unusedCount,
        needsMorePrekeys: unusedCount < 5,
      },
    });
  } catch (error) {
    console.error("Error getting prekey count:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get prekey count" },
      { status: 500 }
    );
  }
}
