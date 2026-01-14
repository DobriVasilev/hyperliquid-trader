import { prisma } from "@/lib/db";
import { google } from "googleapis";

interface TradeOpenData {
  userId: string;
  date: string;
  time: string;
  coin: string;
  direction: string;
  orderType: string;
  entry: number;
  sl: number;
  risk: number;
  expectedLoss: number;
  positionSize: number;
}

interface TradeCloseData {
  userId: string;
  coin: string;
  entry: number;
  sl: number;
  exitPrice: number;
  realizedLoss: number | null;
  realizedWin: number | null;
}

/**
 * Send trade open event to user's Google Sheets via API
 */
export async function sendTradeOpenToSheets(data: TradeOpenData): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { preferences: true },
    });

    if (!user) return;

    const preferences = (user.preferences || {}) as Record<string, unknown>;
    const googleSheets = preferences.googleSheets as Record<string, unknown> | undefined;

    if (!googleSheets?.refreshToken || !googleSheets?.spreadsheetId) return;

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

    // Get next row number (starting from row 3, as rows 1-2 are headers)
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheets.spreadsheetId as string,
      range: "Trades!A3:A", // Start counting from row 3
    });

    const nextRow = (response.data.values?.length || 0) + 3; // +3 because we start from row 3
    const tradeNumber = nextRow - 2; // Trade number (1, 2, 3, ...)

    // Append trade data with formulas
    await sheets.spreadsheets.values.append({
      spreadsheetId: googleSheets.spreadsheetId as string,
      range: `Trades!A${nextRow}`,
      valueInputOption: "USER_ENTERED", // Important: USER_ENTERED to process formulas
      requestBody: {
        values: [
          [
            tradeNumber, // # (Nr.)
            data.date, // DATE
            data.time, // TIME
            data.coin, // COIN
            `=IF(COUNTA(G${nextRow})=1,IF(COUNTA(H${nextRow})=1,IF(G${nextRow}>H${nextRow},"Long",IF(H${nextRow}>G${nextRow},"Short","")),""),"")`, // DIRECTION (formula)
            data.orderType, // ENTRY ORDER TYPE
            data.entry, // AVG ENTRY
            data.sl, // STOP LOSS
            "", // AVG EXIT (empty on open)
            data.risk, // RISK
            data.expectedLoss, // EXPECTED LOSS
            "", // REALISED LOSS (empty on open)
            "", // REALISED WIN (empty on open)
            `=IF(COUNTA(J${nextRow})=1,IF(COUNTA(L${nextRow})=1,ABS(L${nextRow}-J${nextRow})/J${nextRow},IF(COUNTA(M${nextRow})=1,ABS(M${nextRow}-J${nextRow})/J${nextRow},"")),"")`, // DEVIATION (formula)
            data.positionSize, // POSITION SIZE
            `=IF(COUNTA(J${nextRow})=1,IF(AND(COUNTA(L${nextRow})=1,L${nextRow}<>""),IFERROR(-L${nextRow}/J${nextRow},""),IF(AND(COUNTA(M${nextRow})=1,M${nextRow}<>""),IFERROR(M${nextRow}/J${nextRow},""),"")),"")`, // R+/- (formula)
            "", // EARLY EXIT REASON
            "", // RULES?
          ],
        ],
      },
    });
  } catch (error) {
    console.error("Error in sendTradeOpenToSheets:", error);
  }
}

/**
 * Send trade close event to user's Google Sheets via API
 */
export async function sendTradeCloseToSheets(data: TradeCloseData): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { preferences: true },
    });

    if (!user) return;

    const preferences = (user.preferences || {}) as Record<string, unknown>;
    const googleSheets = preferences.googleSheets as Record<string, unknown> | undefined;

    if (!googleSheets?.refreshToken || !googleSheets?.spreadsheetId) return;

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

    // Find the row with matching coin, entry, and sl (and empty exit)
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheets.spreadsheetId as string,
      range: "Trades!A3:R", // Start from row 3 (skip header rows 1-2)
    });

    const rows = response.data.values || [];
    let targetRow = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const coin = row[3]; // COIN (D column, index 3)
      const entry = parseFloat(row[6]); // AVG ENTRY (G column, index 6)
      const sl = parseFloat(row[7]); // STOP LOSS (H column, index 7)
      const exitPrice = row[8]; // AVG EXIT (I column, index 8)

      if (
        coin === data.coin &&
        Math.abs(entry - data.entry) < 0.01 &&
        Math.abs(sl - data.sl) < 0.01 &&
        (!exitPrice || exitPrice === "")
      ) {
        targetRow = i + 3; // +3 because: +1 for 0-index, +2 for header rows
        break;
      }
    }

    if (targetRow > 0) {
      // Update the row with exit price and P&L
      // Note: formulas in columns E, N, P will auto-calculate
      await sheets.spreadsheets.values.update({
        spreadsheetId: googleSheets.spreadsheetId as string,
        range: `Trades!I${targetRow}:M${targetRow}`, // Columns I, L, M
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [
              data.exitPrice, // AVG EXIT (I)
              "", // RISK (J) - already filled
              "", // EXPECTED LOSS (K) - already filled
              data.realizedLoss || "", // REALISED LOSS (L)
              data.realizedWin || "", // REALISED WIN (M)
            ],
          ],
        },
      });
    }
  } catch (error) {
    console.error("Error in sendTradeCloseToSheets:", error);
  }
}
