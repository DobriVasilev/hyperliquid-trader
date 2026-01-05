import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch all user data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Fetch all user sessions with related data
    const sessions = await prisma.patternSession.findMany({
      where: { createdById: session.user.id },
      include: {
        detections: true,
        corrections: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        shares: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    // Fetch corrections made by the user on other sessions
    const userCorrections = await prisma.patternCorrection.findMany({
      where: { userId: session.user.id },
      include: {
        session: {
          select: { id: true, name: true, symbol: true, timeframe: true },
        },
      },
    });

    // Fetch comments made by the user
    const userComments = await prisma.patternComment.findMany({
      where: { userId: session.user.id },
      include: {
        session: {
          select: { id: true, name: true, symbol: true, timeframe: true },
        },
      },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      sessions,
      corrections: userCorrections,
      comments: userComments,
    };

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="systems-trader-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Error exporting user data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export data" },
      { status: 500 }
    );
  }
}
