import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or dev_team
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "admin" && user?.role !== "dev_team") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      sessionId,
      indicatorId,
      feedbackIds,
      title,
      description,
      type,
    } = body;

    // Validate inputs
    if (!title || !type) {
      return NextResponse.json(
        { error: "Title and type are required" },
        { status: 400 }
      );
    }

    // Create implementation session
    const implementation = await prisma.implementationSession.create({
      data: {
        sessionId: sessionId || undefined,
        indicatorId: indicatorId || undefined,
        feedbackIds: feedbackIds || [],
        title,
        description: description || undefined,
        type,
        phase: "planning",
        status: "active",
        progress: 0,
        createdById: session.user.id,
        startedAt: new Date(),
        // Initialize phases structure
        phases: {
          planning: { startedAt: new Date().toISOString(), checkpoints: [] },
          implementing: { checkpoints: [] },
          testing: { checkpoints: [] },
          refining: { checkpoints: [] },
        },
        checkpoints: [],
        log: [
          {
            timestamp: new Date().toISOString(),
            message: `Implementation session created by ${session.user.name || session.user.email}`,
            level: "info",
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      implementation: {
        id: implementation.id,
        title: implementation.title,
        type: implementation.type,
        phase: implementation.phase,
        status: implementation.status,
      },
    });
  } catch (error) {
    console.error("Error creating implementation session:", error);
    return NextResponse.json(
      { error: "Failed to create implementation session" },
      { status: 500 }
    );
  }
}
