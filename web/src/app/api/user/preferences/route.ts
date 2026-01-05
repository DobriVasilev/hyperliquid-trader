import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface UserPreferences {
  defaultSymbol: string;
  defaultTimeframe: string;
  swingDetectionMode: "wicks" | "closes";
  emailNotifications: boolean;
  collaborationAlerts: boolean;
  chartTheme: "dark" | "light";
  showVolume: boolean;
  favoriteSymbols: string[];
  favoriteTimeframes: string[];
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultSymbol: "BTC",
  defaultTimeframe: "15m",
  swingDetectionMode: "wicks",
  emailNotifications: false,
  collaborationAlerts: true,
  chartTheme: "dark",
  showVolume: true,
  favoriteSymbols: [],
  favoriteTimeframes: [],
};

// GET - Fetch user preferences
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    // Merge with defaults to ensure all fields exist
    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...(user.preferences as Partial<UserPreferences> || {}),
    };

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// PUT - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate the preferences
    const validKeys = Object.keys(DEFAULT_PREFERENCES);
    const updates: Partial<UserPreferences> = {};

    for (const key of validKeys) {
      if (key in body) {
        updates[key as keyof UserPreferences] = body[key];
      }
    }

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    // Merge with existing preferences
    const newPreferences = {
      ...DEFAULT_PREFERENCES,
      ...(user?.preferences as Partial<UserPreferences> || {}),
      ...updates,
    };

    // Update user
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: newPreferences },
    });

    return NextResponse.json({
      success: true,
      data: newPreferences,
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}

// PATCH - Update single preference
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { key, value } = await request.json();

    if (!key || !(key in DEFAULT_PREFERENCES)) {
      return NextResponse.json(
        { success: false, error: "Invalid preference key" },
        { status: 400 }
      );
    }

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPreferences = {
      ...DEFAULT_PREFERENCES,
      ...(user?.preferences as Partial<UserPreferences> || {}),
    };

    // Update single preference
    const newPreferences = {
      ...currentPreferences,
      [key]: value,
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: newPreferences },
    });

    return NextResponse.json({
      success: true,
      data: newPreferences,
    });
  } catch (error) {
    console.error("Error updating preference:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update preference" },
      { status: 500 }
    );
  }
}
