import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chat/channels - List all accessible channels
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Get all public channels and private channels user is a member of
    const channels = await prisma.chatChannel.findMany({
      where: {
        archived: false,
        OR: [
          { type: "public" },
          {
            members: {
              some: { userId: session.user.id },
            },
          },
        ],
      },
      include: {
        createdBy: {
          select: { id: true, name: true, image: true },
        },
        members: {
          where: { userId: session.user.id },
          select: { role: true, muted: true, lastReadAt: true },
        },
        _count: {
          select: { messages: true, members: true },
        },
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "asc" },
      ],
    });

    // Get unread counts for each channel
    const channelsWithUnread = await Promise.all(
      channels.map(async (channel) => {
        const membership = channel.members[0];
        const lastReadAt = membership?.lastReadAt || new Date(0);

        const unreadCount = await prisma.chatMessage.count({
          where: {
            channelId: channel.id,
            deleted: false,
            createdAt: { gt: lastReadAt },
            userId: { not: session.user!.id },
          },
        });

        return {
          ...channel,
          unreadCount,
          isMember: !!membership,
          role: membership?.role || null,
          muted: membership?.muted || false,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: channelsWithUnread,
    });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

// POST /api/chat/channels - Create a new channel
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
    const { name, description, type = "public", icon } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Channel name is required" },
        { status: 400 }
      );
    }

    // Create channel and add creator as admin
    const channel = await prisma.chatChannel.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        type,
        icon,
        createdById: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: "admin",
          },
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, image: true },
        },
        _count: {
          select: { messages: true, members: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: channel,
    });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create channel" },
      { status: 500 }
    );
  }
}
