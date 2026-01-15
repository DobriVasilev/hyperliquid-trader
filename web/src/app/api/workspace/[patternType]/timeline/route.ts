import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/workspace/[patternType]/timeline
 *
 * Get workspace timeline messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patternType: string }> }
) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { patternType } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Find workspace
    const workspace = await prisma.patternWorkspace.findUnique({
      where: { patternType },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await prisma.workspaceMessage.findMany({
      where: { workspaceId: workspace.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
        execution: {
          select: {
            id: true,
            status: true,
            phase: true,
            progress: true,
          },
        },
        session: {
          select: {
            id: true,
            name: true,
            symbol: true,
            timeframe: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit + 1, // Get one extra to check if there are more
    });

    const hasMore = messages.length > limit;
    const returnMessages = hasMore ? messages.slice(0, limit) : messages;

    return NextResponse.json({
      messages: returnMessages,
      hasMore,
      total: await prisma.workspaceMessage.count({
        where: { workspaceId: workspace.id },
      }),
    });
  } catch (error) {
    console.error("[API] Timeline error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
