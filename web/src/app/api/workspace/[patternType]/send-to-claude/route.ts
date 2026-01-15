import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { triggerWorkspaceExecution } from "@/lib/services/workspace-prompt-generator";

const prisma = new PrismaClient();

/**
 * POST /api/workspace/[patternType]/send-to-claude
 *
 * Aggregates feedback and triggers Claude Code execution
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ patternType: string }> }
) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only dev_team and admin can trigger Claude
    if (session.user.role !== "dev_team" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { patternType } = await params;
    const body = await request.json();
    const { sessionIds } = body;

    // Find or create workspace
    let workspace = await prisma.patternWorkspace.findUnique({
      where: { patternType },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found. Create a workspace first." },
        { status: 404 }
      );
    }

    // Trigger execution
    const executionId = await triggerWorkspaceExecution(
      workspace.id,
      session.user.id,
      sessionIds
    );

    return NextResponse.json({
      success: true,
      executionId,
      message: "Claude execution triggered successfully",
    });
  } catch (error) {
    console.error("[API] Send to Claude error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to trigger Claude",
      },
      { status: 500 }
    );
  }
}
