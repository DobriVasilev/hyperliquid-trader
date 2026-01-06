import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { broadcastMessage } from "../stream/route";

const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🚀", "💯"];

// GET /api/chat/reactions?messageId=xxx - Get reactions for a message
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
    const messageId = searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Message ID is required" },
        { status: 400 }
      );
    }

    const reactions = await prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    // Group by emoji
    const grouped = reactions.reduce((acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = {
          emoji: r.emoji,
          count: 0,
          users: [],
          userReacted: false,
        };
      }
      acc[r.emoji].count++;
      acc[r.emoji].users.push({
        id: r.user.id,
        name: r.user.name,
        image: r.user.image,
      });
      if (r.userId === session.user!.id) {
        acc[r.emoji].userReacted = true;
      }
      return acc;
    }, {} as Record<string, { emoji: string; count: number; users: Array<{ id: string; name: string | null; image: string | null }>; userReacted: boolean }>);

    return NextResponse.json({
      success: true,
      data: Object.values(grouped),
    });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reactions" },
      { status: 500 }
    );
  }
}

// POST /api/chat/reactions - Add a reaction
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
    const { messageId, emoji } = body;

    if (!messageId || !emoji) {
      return NextResponse.json(
        { success: false, error: "Message ID and emoji are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json(
        { success: false, error: "Invalid emoji" },
        { status: 400 }
      );
    }

    // Check if message exists
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    // Add reaction (ignore duplicate errors)
    await prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: session.user.id,
          emoji,
        },
      },
      create: {
        messageId,
        userId: session.user.id,
        emoji,
      },
      update: {},
    });

    // Broadcast reaction add
    broadcastMessage({
      type: "reaction_add",
      messageId,
      emoji,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add reaction" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/reactions - Remove a reaction
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");
    const emoji = searchParams.get("emoji");

    if (!messageId || !emoji) {
      return NextResponse.json(
        { success: false, error: "Message ID and emoji are required" },
        { status: 400 }
      );
    }

    await prisma.messageReaction.deleteMany({
      where: {
        messageId,
        userId: session.user.id,
        emoji,
      },
    });

    // Broadcast reaction remove
    broadcastMessage({
      type: "reaction_remove",
      messageId,
      emoji,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing reaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove reaction" },
      { status: 500 }
    );
  }
}
