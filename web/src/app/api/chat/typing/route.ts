import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { broadcastMessage, broadcastToUser } from "../stream/route";

// Typing timeout - stop showing after 5 seconds of no updates
const TYPING_TIMEOUT_MS = 5000;

// GET /api/chat/typing - Get who's typing in a channel/DM
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
    const channelId = searchParams.get("channelId");
    const dmUserId = searchParams.get("dmUserId");

    const cutoffTime = new Date(Date.now() - TYPING_TIMEOUT_MS);

    const typingUsers = await prisma.typingIndicator.findMany({
      where: {
        startedAt: { gte: cutoffTime },
        userId: { not: session.user.id },
        ...(channelId ? { channelId } : {}),
        ...(dmUserId ? { dmUserId } : {}),
      },
      select: {
        userId: true,
        userName: true,
        userAvatar: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: typingUsers,
    });
  } catch (error) {
    console.error("Error fetching typing indicators:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch typing indicators" },
      { status: 500 }
    );
  }
}

// POST /api/chat/typing - Update typing status
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
    const { channelId, dmUserId, isTyping } = body;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, image: true },
    });

    if (isTyping) {
      // Upsert typing indicator
      await prisma.typingIndicator.upsert({
        where: {
          userId_channelId: {
            userId: session.user.id,
            channelId: channelId || "",
          },
        },
        create: {
          userId: session.user.id,
          channelId: channelId || null,
          dmUserId: dmUserId || null,
          userName: user?.name || "Anonymous",
          userAvatar: user?.image,
          startedAt: new Date(),
        },
        update: {
          startedAt: new Date(),
        },
      });

      // Broadcast typing start
      if (dmUserId) {
        broadcastToUser(dmUserId, {
          type: "typing_start",
          userId: session.user.id,
          userName: user?.name || "Anonymous",
          userAvatar: user?.image,
          channelId,
          dmUserId,
        });
      } else {
        broadcastMessage({
          type: "typing_start",
          userId: session.user.id,
          userName: user?.name || "Anonymous",
          userAvatar: user?.image,
          channelId,
        }, session.user.id);
      }
    } else {
      // Remove typing indicator
      await prisma.typingIndicator.deleteMany({
        where: {
          userId: session.user.id,
          channelId: channelId || null,
        },
      });

      // Broadcast typing stop
      if (dmUserId) {
        broadcastToUser(dmUserId, {
          type: "typing_stop",
          userId: session.user.id,
          channelId,
          dmUserId,
        });
      } else {
        broadcastMessage({
          type: "typing_stop",
          userId: session.user.id,
          channelId,
        }, session.user.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating typing indicator:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update typing indicator" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/typing - Clear typing status
export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await prisma.typingIndicator.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing typing indicators:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear typing indicators" },
      { status: 500 }
    );
  }
}
