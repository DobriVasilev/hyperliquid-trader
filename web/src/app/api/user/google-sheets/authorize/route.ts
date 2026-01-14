import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";

/**
 * GET /api/user/google-sheets/authorize
 * Generate OAuth URL for Google Sheets authorization
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
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/user/google-sheets/callback`
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/spreadsheets"],
      state: session.user.id, // Pass user ID in state for callback
      prompt: "consent", // Force consent screen to get refresh token
    });

    return NextResponse.json({
      success: true,
      data: { authUrl },
    });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate authorization URL" },
      { status: 500 }
    );
  }
}
