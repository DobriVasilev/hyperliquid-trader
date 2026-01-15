import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/workspace/[patternType]/status
 *
 * Get current workspace status and active execution
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

    // Find workspace
    const workspace = await prisma.patternWorkspace.findUnique({
      where: { patternType },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get current execution (if any)
    const currentExecution = await prisma.claudeExecution.findFirst({
      where: {
        workspaceId: workspace.id,
        status: { in: ["pending", "running"] },
      },
      orderBy: { triggeredAt: "desc" },
    });

    // Get recent messages
    const recentMessages = await prisma.workspaceMessage.findMany({
      where: { workspaceId: workspace.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Build workspace summary
    const workspaceSummary = {
      patternType: workspace.patternType,
      name: workspace.name,
      category: workspace.category,
      status: workspace.status,
      version: workspace.version,
      sessionCount: workspace.sessionCount,
      feedbackCount: workspace.feedbackCount,
      successRate: workspace.successRate,
      lastActivity: workspace.updatedAt,
      description: workspace.description,
      createdBy: workspace.createdBy,
    };

    // Build execution summary
    const executionSummary = currentExecution
      ? {
          id: currentExecution.id,
          status: currentExecution.status,
          phase: currentExecution.phase,
          progress: currentExecution.progress,
          startedAt: currentExecution.triggeredAt,
          completedAt: currentExecution.completedAt,
          deployStatus: currentExecution.deployStatus,
          error: currentExecution.error,
        }
      : null;

    return NextResponse.json({
      workspace: workspaceSummary,
      currentExecution: executionSummary,
      recentMessages,
    });
  } catch (error) {
    console.error("[API] Status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}
