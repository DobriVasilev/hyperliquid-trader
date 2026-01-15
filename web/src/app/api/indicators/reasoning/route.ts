import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/indicators/reasoning - Submit indicator reasoning
 */
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
    const {
      indicatorType,
      customName,
      title,
      description,
      symbol,
      timeframe,
      algorithmIdea,
      pseudocode,
      screenshots,
      videos,
      voiceNotes,
    } = body;

    // Validate required fields
    if (!indicatorType) {
      return NextResponse.json(
        { success: false, error: "Indicator type is required" },
        { status: 400 }
      );
    }

    if (!title || !description) {
      return NextResponse.json(
        { success: false, error: "Title and description are required" },
        { status: 400 }
      );
    }

    // Create reasoning
    const reasoning = await prisma.indicatorReasoning.create({
      data: {
        userId: session.user.id,
        indicatorType,
        customName: customName || undefined,
        title,
        description,
        symbol: symbol || undefined,
        timeframe: timeframe || undefined,
        algorithmIdea: algorithmIdea || undefined,
        pseudocode: pseudocode || undefined,
        screenshots: screenshots || undefined,
        videos: videos || undefined,
        voiceNotes: voiceNotes || undefined,
        status: "PENDING",
        implementationStatus: "PENDING",
      },
    });

    // Check if user is dev_team or admin - auto-route to Claude
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isDevOrAdmin = user?.role === "dev_team" || user?.role === "admin";

    return NextResponse.json({
      success: true,
      data: reasoning,
      message: isDevOrAdmin
        ? "Submitted! Claude Code will review and implement your reasoning."
        : "Submitted! An admin will review your reasoning.",
    });
  } catch (error) {
    console.error("Error creating indicator reasoning:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit reasoning" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/indicators/reasoning - List all reasoning submissions
 */
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
    const indicatorType = searchParams.get("indicatorType");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Check if user is admin
    const isAdmin = session.user.role === "admin";

    // Build where clause
    const where: any = {};

    // Non-admins can only see their own reasoning
    if (!isAdmin) {
      where.userId = session.user.id;
    }

    if (indicatorType) {
      where.indicatorType = indicatorType;
    }

    if (status) {
      where.status = status;
    }

    const reasoning = await prisma.indicatorReasoning.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        implementedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { votes: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      skip: offset,
    });

    const total = await prisma.indicatorReasoning.count({ where });

    return NextResponse.json({
      success: true,
      data: {
        reasoning,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error listing indicator reasoning:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list reasoning" },
      { status: 500 }
    );
  }
}
