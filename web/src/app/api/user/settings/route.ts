import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/user/settings
 * Retrieves the authenticated user's settings
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

    return NextResponse.json({
      success: true,
      data: user.preferences || {},
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/settings
 * Updates the authenticated user's settings
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

    // Validate that body is an object
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid settings format" },
        { status: 400 }
      );
    }

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: body },
      select: { preferences: true },
    });

    return NextResponse.json({
      success: true,
      data: updatedUser.preferences,
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/settings
 * Partially updates the authenticated user's settings (merges with existing)
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Validate that body is an object
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid settings format" },
        { status: 400 }
      );
    }

    // Get current preferences
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

    // Merge with existing preferences
    const currentPrefs = (user.preferences || {}) as Record<string, unknown>;
    const mergedPrefs = { ...currentPrefs, ...body };

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: mergedPrefs },
      select: { preferences: true },
    });

    return NextResponse.json({
      success: true,
      data: updatedUser.preferences,
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
