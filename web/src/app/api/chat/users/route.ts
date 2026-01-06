import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chat/users - Search users for @mentions and sharing
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
    // Support both 'q' (for mentions) and 'search' (for sharing modal)
    const query = searchParams.get("q") || searchParams.get("search") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    // Search users by name or email
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
        // Exclude current user
        id: { not: session.user.id },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      take: limit,
      orderBy: { name: "asc" },
    });

    // Add online status
    const userIds = users.map(u => u.id);
    const presences = await prisma.chatPresence.findMany({
      where: {
        userId: { in: userIds },
        lastSeen: { gte: new Date(Date.now() - 2 * 60 * 1000) }, // 2 min timeout
      },
      select: { userId: true, status: true },
    });

    const presenceMap = new Map(presences.map(p => [p.userId, p.status]));

    // Get DM history counts for each user
    // Users with whom we've exchanged messages
    const dmCounts = await prisma.directMessage.groupBy({
      by: ["senderId", "receiverId"],
      where: {
        OR: [
          { senderId: session.user.id, receiverId: { in: userIds } },
          { receiverId: session.user.id, senderId: { in: userIds } },
        ],
      },
      _count: true,
    });

    // Build a map of userId -> message count
    const dmCountMap = new Map<string, number>();
    for (const dm of dmCounts) {
      const otherUserId = dm.senderId === session.user.id ? dm.receiverId : dm.senderId;
      dmCountMap.set(otherUserId, (dmCountMap.get(otherUserId) || 0) + dm._count);
    }

    const usersWithStatus = users.map(user => {
      const messageCount = dmCountMap.get(user.id) || 0;
      return {
        ...user,
        status: presenceMap.get(user.id) || "offline",
        hasDM: messageCount > 0,
        isFriend: messageCount >= 5, // Consider "friend" if 5+ messages exchanged
      };
    });

    return NextResponse.json({
      success: true,
      data: usersWithStatus,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search users" },
      { status: 500 }
    );
  }
}
