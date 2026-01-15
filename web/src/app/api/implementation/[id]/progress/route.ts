import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const implementation = await prisma.implementationSession.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        phase: true,
        status: true,
        progress: true,
        phases: true,
        checkpoints: true,
        currentTask: true,
        log: true,
        filesChanged: true,
        commitHash: true,
        pullRequestUrl: true,
        deploymentUrl: true,
        errors: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!implementation) {
      return NextResponse.json({ error: "Implementation session not found" }, { status: 404 });
    }

    // Format the response
    const formattedPhases = formatPhases(implementation);

    return NextResponse.json({
      success: true,
      implementation,
      phases: formattedPhases,
      currentTask: implementation.currentTask,
      log: implementation.log || [],
    });
  } catch (error) {
    console.error("Error fetching implementation progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch implementation progress" },
      { status: 500 }
    );
  }
}

// Helper function to format phases from stored JSON
function formatPhases(implementation: any) {
  const phaseDefinitions = [
    { id: "planning", name: "Planning & Analysis", icon: "Lightbulb" },
    { id: "implementing", name: "Implementation", icon: "Code" },
    { id: "testing", name: "Testing & Verification", icon: "TestTube" },
    { id: "refining", name: "Refinement & Polish", icon: "Wrench" },
  ];

  const phasesData = implementation.phases || {};
  const checkpointsData = (implementation.checkpoints as any[]) || [];

  return phaseDefinitions.map((phaseDef) => {
    const phaseData = phasesData[phaseDef.id] || {};
    const phaseCheckpoints = checkpointsData.filter(cp => cp.phase === phaseDef.id);

    // Determine phase status
    let status = "pending";
    if (implementation.phase === phaseDef.id) {
      status = "in_progress";
    } else if (phaseData.completedAt) {
      status = "completed";
    }

    return {
      ...phaseDef,
      status,
      startedAt: phaseData.startedAt,
      completedAt: phaseData.completedAt,
      checkpoints: phaseCheckpoints,
    };
  });
}
