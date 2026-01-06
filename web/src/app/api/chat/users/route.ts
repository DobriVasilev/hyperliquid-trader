import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chat/users - Search users for @mentions
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
    const query = searchParams.get("q") || "";
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

    const usersWithStatus = users.map(user => ({
      ...user,
      status: presenceMap.get(user.id) || "offline",
    }));

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
