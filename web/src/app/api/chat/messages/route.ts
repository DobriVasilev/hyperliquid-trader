import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { broadcastMessage, broadcastToUser } from "../stream/route";

// Parse @mentions from content
function parseMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const userIds: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    userIds.push(match[2]); // User ID is in second capture group
  }
  return userIds;
}

// GET /api/chat/messages - Get chat messages with pagination
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
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const pinned = searchParams.get("pinned") === "true";

    const where: Record<string, unknown> = {
      deleted: false,
    };

    if (channelId) {
      where.channelId = channelId;
    } else {
      where.channelId = null; // Global chat
    }

    if (pinned) {
      where.pinned = true;
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { createdAt: "desc" },
      include: {
        replyTo: {
          select: {
            id: true,
            userName: true,
            content: true,
          },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
        editHistory: {
          select: {
            previousContent: true,
            editedAt: true,
          },
          orderBy: { editedAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            readReceipts: true,
          },
        },
      },
    });

    // Group reactions by emoji
    const messagesWithGroupedReactions = messages.map((msg) => {
      const reactionGroups: Record<string, { count: number; userReacted: boolean }> = {};
      msg.reactions.forEach((r) => {
        if (!reactionGroups[r.emoji]) {
          reactionGroups[r.emoji] = { count: 0, userReacted: false };
        }
        reactionGroups[r.emoji].count++;
        if (r.userId === session.user!.id) {
          reactionGroups[r.emoji].userReacted = true;
        }
      });

      return {
        ...msg,
        reactions: Object.entries(reactionGroups).map(([emoji, data]) => ({
          emoji,
          ...data,
        })),
      };
    });

    // Reverse to show oldest first
    const orderedMessages = messagesWithGroupedReactions.reverse();

    return NextResponse.json({
      success: true,
      data: orderedMessages,
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/chat/messages - Send a new message
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
    const { content, attachments, replyToId, channelId } = body;

    if (!content?.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { success: false, error: "Message content or attachment is required" },
        { status: 400 }
      );
    }

    // Validate content length
    if (content && content.length > 4000) {
      return NextResponse.json(
        { success: false, error: "Message too long (max 4000 characters)" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, image: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Parse mentions from content
    const mentionedUserIds = content ? parseMentions(content) : [];

    // Create message with mentions
    const message = await prisma.chatMessage.create({
      data: {
        userId: session.user.id,
        channelId: channelId || null,
        userName: user.name || "Anonymous",
        userAvatar: user.image,
        content: content?.trim() || "",
        attachments: attachments || null,
        replyToId,
        isVip: false,
        mentions: mentionedUserIds.length > 0 ? {
          createMany: {
            data: mentionedUserIds.map((userId) => ({ userId })),
          },
        } : undefined,
      },
      include: {
        replyTo: {
          select: { id: true, userName: true, content: true },
        },
      },
    });

    // Create notifications for mentions
    for (const mentionedUserId of mentionedUserIds) {
      await prisma.chatNotification.create({
        data: {
          userId: mentionedUserId,
          type: "mention",
          title: `${user.name || "Someone"} mentioned you`,
          body: content.slice(0, 100),
          messageId: message.id,
          channelId: channelId || null,
          senderId: session.user.id,
          link: `/chat${channelId ? `?channel=${channelId}` : ""}`,
        },
      });

      // Send real-time notification
      broadcastToUser(mentionedUserId, {
        type: "notification",
        notification: {
          type: "mention",
          title: `${user.name || "Someone"} mentioned you`,
          body: content.slice(0, 100),
        },
      });
    }

    // If this is a reply, notify the original author
    if (replyToId) {
      const originalMessage = await prisma.chatMessage.findUnique({
        where: { id: replyToId },
        select: { userId: true },
      });

      if (originalMessage && originalMessage.userId !== session.user.id) {
        await prisma.chatNotification.create({
          data: {
            userId: originalMessage.userId,
            type: "reply",
            title: `${user.name || "Someone"} replied to you`,
            body: content.slice(0, 100),
            messageId: message.id,
            channelId: channelId || null,
            senderId: session.user.id,
            link: `/chat${channelId ? `?channel=${channelId}` : ""}`,
          },
        });

        broadcastToUser(originalMessage.userId, {
          type: "notification",
          notification: {
            type: "reply",
            title: `${user.name || "Someone"} replied to you`,
            body: content.slice(0, 100),
          },
        });
      }
    }

    // Clear typing indicator
    await prisma.typingIndicator.deleteMany({
      where: {
        userId: session.user.id,
        channelId: channelId || null,
      },
    });

    // Update user's last active time
    await prisma.chatPresence.upsert({
      where: { userId: session.user.id },
      update: { lastActive: new Date(), lastSeen: new Date() },
      create: {
        userId: session.user.id,
        userName: user.name || "Anonymous",
        userAvatar: user.image,
        lastActive: new Date(),
      },
    });

    // Broadcast to all connected clients
    broadcastMessage({
      type: "new_message",
      message: { ...message, reactions: [] },
      channelId: channelId || null,
    }, session.user.id);

    return NextResponse.json({
      success: true,
      data: { ...message, reactions: [] },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 }
    );
  }
}

// PATCH /api/chat/messages - Edit a message
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { messageId, content } = body;

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Message ID is required" },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: "Content is required" },
        { status: 400 }
      );
    }

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    if (message.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "You can only edit your own messages" },
        { status: 403 }
      );
    }

    // Save edit history
    await prisma.messageEdit.create({
      data: {
        messageId,
        previousContent: message.content,
      },
    });

    // Update message
    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        edited: true,
        editedAt: new Date(),
      },
      include: {
        replyTo: {
          select: { id: true, userName: true, content: true },
        },
      },
    });

    // Broadcast edit
    broadcastMessage({
      type: "message_edited",
      message: updated,
      channelId: message.channelId,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error editing message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to edit message" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/messages - Delete a message (soft delete)
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
    const messageId = searchParams.get("id");

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Message ID is required" },
        { status: 400 }
      );
    }

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    if (message.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own messages" },
        { status: 403 }
      );
    }

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        deleted: true,
        deletedAt: new Date(),
      },
    });

    // Broadcast deletion
    broadcastMessage({
      type: "message_deleted",
      messageId,
      channelId: message.channelId,
    });

    return NextResponse.json({
      success: true,
      data: { id: messageId },
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
