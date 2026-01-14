import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { google } from "googleapis";

/**
 * POST /api/user/google-sheets/export
 * Export trading data to Google Sheets via API
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
    // Get user's Google Sheets credentials
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

    if (!googleSheets?.refreshToken || !googleSheets?.spreadsheetId) {
      return NextResponse.json(
        { success: false, error: "Google Sheets not connected" },
        { status: 400 }
      );
    }

    // Setup OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/user/google-sheets/callback`
    );

    oauth2Client.setCredentials({
      refresh_token: googleSheets.refreshToken as string,
      access_token: googleSheets.accessToken as string,
      expiry_date: googleSheets.expiryDate as number,
    });

    // Refresh access token if needed
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    // Update stored tokens if refreshed
    if (credentials.access_token !== googleSheets.accessToken) {
      const updatedPrefs = {
        ...preferences,
        googleSheets: {
          ...googleSheets,
          accessToken: credentials.access_token,
          expiryDate: credentials.expiry_date,
        },
      };

      await prisma.user.update({
        where: { id: session.user.id },
        data: { preferences: updatedPrefs },
      });
    }

    // Fetch user's trades
    const trades = await prisma.trade.findMany({
      where: { userId: session.user.id },
      orderBy: { openedAt: "desc" },
      take: 1000, // Export last 1000 trades
      select: {
        openedAt: true,
        closedAt: true,
        symbol: true,
        side: true,
        size: true,
        entryPrice: true,
        exitPrice: true,
        stopLoss: true,
        takeProfit: true,
        leverage: true,
        pnl: true,
        status: true,
      },
    });

    // Format trades for sheets (matching the column order)
    const rows = trades.map((trade, index) => {
      const date = new Date(trade.openedAt);
      const risk = 100; // Default risk value
      const expectedLoss = -100; // Default expected loss
      const rowNum = index + 3; // Row number in sheet (data starts at row 3)

      return [
        index + 1, // # (Nr.)
        date.toLocaleDateString(), // DATE
        date.toLocaleTimeString(), // TIME
        trade.symbol, // COIN
        `=IF(COUNTA(G${rowNum})=1,IF(COUNTA(H${rowNum})=1,IF(G${rowNum}>H${rowNum},"Long",IF(H${rowNum}>G${rowNum},"Short","")),""),"")`, // DIRECTION (formula)
        "Market", // ENTRY ORDER TYPE
        trade.entryPrice || "", // AVG ENTRY
        trade.stopLoss || "", // STOP LOSS
        trade.exitPrice || "", // AVG EXIT
        risk, // RISK
        expectedLoss, // EXPECTED LOSS
        trade.pnl && trade.pnl < 0 ? trade.pnl : "", // REALISED LOSS
        trade.pnl && trade.pnl > 0 ? trade.pnl : "", // REALISED WIN
        `=IF(COUNTA(J${rowNum})=1,IF(COUNTA(L${rowNum})=1,ABS(L${rowNum}-J${rowNum})/J${rowNum},IF(COUNTA(M${rowNum})=1,ABS(M${rowNum}-J${rowNum})/J${rowNum},"")),"")`, // DEVIATION (formula)
        trade.size, // POSITION SIZE
        `=IF(COUNTA(J${rowNum})=1,IF(AND(COUNTA(L${rowNum})=1,L${rowNum}<>""),IFERROR(-L${rowNum}/J${rowNum},""),IF(AND(COUNTA(M${rowNum})=1,M${rowNum}<>""),IFERROR(M${rowNum}/J${rowNum},""),"")),"")`, // R+/- (formula)
        "", // EARLY EXIT REASON
        "", // RULES?
      ];
    });

    // Clear existing data (except header rows 1-2)
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    await sheets.spreadsheets.values.clear({
      spreadsheetId: googleSheets.spreadsheetId as string,
      range: "Trades!A3:R",
    });

    // Write new data with formulas
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: googleSheets.spreadsheetId as string,
        range: `Trades!A3:R${rows.length + 2}`, // +2 because we start from row 3
        valueInputOption: "USER_ENTERED", // Important: USER_ENTERED to process formulas
        requestBody: {
          values: rows,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        tradesExported: trades.length,
        spreadsheetUrl: googleSheets.spreadsheetUrl,
      },
    });
  } catch (error) {
    console.error("Error exporting to Google Sheets:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export to Google Sheets" },
      { status: 500 }
    );
  }
}
