import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chat/notifications - Get user's notifications
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
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const notifications = await prisma.chatNotification.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const unreadCount = await prisma.chatNotification.count({
      where: {
        userId: session.user.id,
        read: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST /api/chat/notifications/mark-read - Mark notifications as read
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
    const { notificationIds, markAll } = body;

    if (markAll) {
      // Mark all as read
      await prisma.chatNotification.updateMany({
        where: {
          userId: session.user.id,
          read: false,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
    } else if (notificationIds?.length > 0) {
      // Mark specific notifications as read
      await prisma.chatNotification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/notifications - Clear all notifications
export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await prisma.chatNotification.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear notifications" },
      { status: 500 }
    );
  }
}

// Helper function to create notification (called from other routes)
export async function createNotification(params: {
  userId: string;
  type: "mention" | "reply" | "dm" | "channel_invite";
  title: string;
  body: string;
  messageId?: string;
  channelId?: string;
  senderId?: string;
  link?: string;
}) {
  try {
    const notification = await prisma.chatNotification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body.slice(0, 200), // Truncate
        messageId: params.messageId,
        channelId: params.channelId,
        senderId: params.senderId,
        link: params.link,
      },
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}
