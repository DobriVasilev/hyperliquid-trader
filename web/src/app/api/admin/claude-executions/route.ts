import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/claude-executions - Get Claude Code execution analytics
 * Admin only
 *
 * Returns:
 * - Execution statistics (pending, running, completed, failed)
 * - Recent execution history (last 10)
 * - Current running executions
 * - Performance metrics
 * - Pending corrections count
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    // Get execution statistics
    const [total, pending, running, completed, failed] = await Promise.all([
      prisma.claudeExecution.count(),
      prisma.claudeExecution.count({ where: { status: "pending" } }),
      prisma.claudeExecution.count({ where: { status: "running" } }),
      prisma.claudeExecution.count({ where: { status: "completed" } }),
      prisma.claudeExecution.count({ where: { status: "failed" } }),
    ]);

    const successRate = total > 0 ? Math.round((completed / (completed + failed)) * 100) : 0;

    // Get pending corrections count (sessions with pending corrections)
    const sessionsWithCorrections = await prisma.patternSession.count({
      where: {
        status: "submitted_for_review",
        corrections: {
          some: {
            status: "pending",
          },
        },
      },
    });

    // Get current running executions with details
    const runningExecutions = await prisma.claudeExecution.findMany({
      where: {
        status: "running",
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            patternType: true,
          },
        },
      },
      orderBy: {
        triggeredAt: "desc",
      },
    });

    // Get recent execution history (last 10)
    const recentExecutions = await prisma.claudeExecution.findMany({
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            patternType: true,
            category: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        triggeredAt: "desc",
      },
      take: 10,
    });

    // Calculate performance metrics
    const completedExecutions = await prisma.claudeExecution.findMany({
      where: {
        status: "completed",
        completedAt: { not: null },
      },
      select: {
        triggeredAt: true,
        completedAt: true,
      },
      take: 50,
    });

    let avgExecutionTimeMinutes = 0;
    if (completedExecutions.length > 0) {
      const totalTime = completedExecutions.reduce((sum, exec) => {
        const diff = exec.completedAt!.getTime() - exec.triggeredAt.getTime();
        return sum + diff;
      }, 0);
      avgExecutionTimeMinutes = Math.round(totalTime / completedExecutions.length / 1000 / 60);
    }

    // Get recent failures (last 5)
    const recentFailures = await prisma.claudeExecution.findMany({
      where: {
        status: "failed",
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            patternType: true,
          },
        },
      },
      orderBy: {
        erroredAt: "desc",
      },
      take: 5,
    });

    // Get activity metrics
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [last24h, last7d] = await Promise.all([
      prisma.claudeExecution.count({
        where: {
          triggeredAt: { gte: yesterday },
        },
      }),
      prisma.claudeExecution.count({
        where: {
          triggeredAt: { gte: weekAgo },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total,
          pending,
          running,
          completed,
          failed,
          successRate,
          pendingCorrections: sessionsWithCorrections,
        },
        runningExecutions: runningExecutions.map((exec) => ({
          id: exec.id,
          workspaceId: exec.workspaceId,
          workspaceName: exec.workspace.name,
          patternType: exec.workspace.patternType,
          status: exec.status,
          phase: exec.phase,
          progress: exec.progress,
          triggeredAt: exec.triggeredAt.toISOString(),
          sessionCount: exec.sessionIds.length,
        })),
        recentExecutions: recentExecutions.map((exec) => ({
          id: exec.id,
          workspaceId: exec.workspaceId,
          workspaceName: exec.workspace.name,
          patternType: exec.workspace.patternType,
          category: exec.workspace.category,
          status: exec.status,
          phase: exec.phase,
          progress: exec.progress,
          triggeredAt: exec.triggeredAt.toISOString(),
          completedAt: exec.completedAt?.toISOString() || null,
          erroredAt: exec.erroredAt?.toISOString() || null,
          sessionCount: exec.sessionIds.length,
          filesChanged: exec.filesChanged,
          commitHash: exec.commitHash,
          deployStatus: exec.deployStatus,
          triggeredBy: {
            id: exec.user.id,
            name: exec.user.name,
            email: exec.user.email,
          },
        })),
        recentFailures: recentFailures.map((exec) => ({
          id: exec.id,
          workspaceId: exec.workspaceId,
          workspaceName: exec.workspace.name,
          patternType: exec.workspace.patternType,
          error: exec.error,
          retryCount: exec.retryCount,
          erroredAt: exec.erroredAt?.toISOString() || null,
        })),
        performance: {
          avgExecutionTimeMinutes,
          last24h,
          last7d,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching Claude executions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Claude executions" },
      { status: 500 }
    );
  }
}
