import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/user/google-sheets
 * Get current Google Sheets connection status
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const preferences = (user.preferences || {}) as Record<string, unknown>;
    const googleSheets = preferences.googleSheets as Record<string, unknown> | undefined;

    return NextResponse.json({
      success: true,
      data: {
        connected: !!googleSheets?.refreshToken,
        spreadsheetUrl: googleSheets?.spreadsheetUrl || null,
        spreadsheetId: googleSheets?.spreadsheetId || null,
      },
    });
  } catch (error) {
    console.error("Error fetching Google Sheets status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Google Sheets status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/google-sheets
 * Disconnect Google Sheets
 */
export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const preferences = (user.preferences || {}) as Record<string, unknown>;
    const { googleSheets, ...restPrefs } = preferences;

    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: restPrefs },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Google Sheets disconnected" },
    });
  } catch (error) {
    console.error("Error disconnecting Google Sheets:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect Google Sheets" },
      { status: 500 }
    );
  }
}
