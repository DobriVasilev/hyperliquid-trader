import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Delete all user data in the correct order (respecting foreign keys)
    await prisma.$transaction(async (tx) => {
      // 1. Delete all comments by user
      await tx.patternComment.deleteMany({
        where: { userId },
      });

      // 2. Delete all corrections by user
      await tx.patternCorrection.deleteMany({
        where: { userId },
      });

      // 3. Delete all events by user
      await tx.patternEvent.deleteMany({
        where: { userId },
      });

      // 4. Delete all session shares for user
      await tx.sessionShare.deleteMany({
        where: { userId },
      });

      // 5. Get all sessions created by user
      const userSessions = await tx.patternSession.findMany({
        where: { createdById: userId },
        select: { id: true },
      });

      const sessionIds = userSessions.map((s) => s.id);

      if (sessionIds.length > 0) {
        // 6. Delete all comments on user's sessions
        await tx.patternComment.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });

        // 7. Delete all corrections on user's sessions
        await tx.patternCorrection.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });

        // 8. Delete all events on user's sessions
        await tx.patternEvent.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });

        // 9. Delete all shares on user's sessions
        await tx.sessionShare.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });

        // 10. Delete all detections on user's sessions
        await tx.patternDetection.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });

        // 11. Delete all user's sessions
        await tx.patternSession.deleteMany({
          where: { createdById: userId },
        });
      }

      // 12. Delete auth sessions
      await tx.session.deleteMany({
        where: { userId },
      });

      // 13. Delete accounts
      await tx.account.deleteMany({
        where: { userId },
      });

      // 14. Finally delete the user
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
