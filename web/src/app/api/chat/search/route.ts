import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chat/search - Search messages
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
    const query = searchParams.get("q");
    const channelId = searchParams.get("channelId");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const hasAttachments = searchParams.get("hasAttachments") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!query?.trim()) {
      return NextResponse.json(
        { success: false, error: "Search query is required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      deleted: false,
      content: { contains: query, mode: "insensitive" },
    };

    if (channelId) {
      where.channelId = channelId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate) {
      where.createdAt = { ...((where.createdAt as object) || {}), gte: new Date(startDate) };
    }

    if (endDate) {
      where.createdAt = { ...((where.createdAt as object) || {}), lte: new Date(endDate) };
    }

    if (hasAttachments) {
      where.attachments = { not: null };
    }

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where,
        include: {
          channel: {
            select: { id: true, name: true, icon: true },
          },
          replyTo: {
            select: { id: true, userName: true, content: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.chatMessage.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        messages,
        total,
        hasMore: offset + messages.length < total,
      },
    });
  } catch (error) {
    console.error("Error searching messages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search messages" },
      { status: 500 }
    );
  }
}
