import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/user/google-sheets/test
 * Test Google Sheets webhook with sample data
 */
export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Get user's webhook URL
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
    const webhookUrl = preferences.googleSheetsWebhookUrl as string | undefined;

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: "Webhook URL not configured" },
        { status: 400 }
      );
    }

    // Send test trade data
    const testData = {
      action: "open",
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      coin: "BTC",
      orderType: "Market",
      entry: 50000.00,
      sl: 49000.00,
      risk: 100,
      expectedLoss: -100,
      positionSize: 0.002,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Webhook returned error");
    }

    return NextResponse.json({
      success: true,
      data: { message: "Test successful", row: result.row },
    });
  } catch (error) {
    console.error("Error testing webhook:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to test webhook" },
      { status: 500 }
    );
  }
}
