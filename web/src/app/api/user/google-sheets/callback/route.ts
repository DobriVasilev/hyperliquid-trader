import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { google } from "googleapis";

/**
 * GET /api/user/google-sheets/callback
 * OAuth callback for Google Sheets authorization
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // User ID
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<html><body><script>window.close();</script><p>Authorization cancelled. You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code || !state) {
    return new NextResponse(
      `<html><body><script>window.close();</script><p>Invalid authorization response. You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/user/google-sheets/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user's email from Google
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email || "";

    // Create a new spreadsheet with the trading template
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `Trading Log - ${new Date().toLocaleDateString()}`,
        },
        sheets: [
          {
            properties: {
              title: "Trades",
              gridProperties: {
                frozenRowCount: 1, // Freeze header row
              },
            },
          },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId!;
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl!;

    // Set up the header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Trades!A1:R1",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            "#",
            "DATE",
            "TIME",
            "COIN",
            "DIRECTION ",
            "ENTRY ORDER TYPE",
            "AVG ENTRY",
            "STOP LOSS",
            "AVG EXIT",
            "RISK",
            "EXPECTED LOSS",
            "REALISED LOSS",
            "REALISED WIN",
            "DEVIATION",
            "POSITION SIZE",
            "R+/-",
            "EARLY EXIT REASON",
            "RULES?",
          ],
        ],
      },
    });

    // Set up the subheader row (row 2) with descriptions
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Trades!A2:R2",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            "Nr.",
            "Date Format: d/m",
            "Time Format: h:m",
            "eg. BTC",
            "Long or Short\nAuto formula (DO NOT EDIT)",
            "Market or Limit",
            "Entry price",
            "Stop loss price",
            "Final exit price",
            "Risk (with fees)",
            "Expected Loss (no fees)",
            "PnL if loss",
            "PnL if win",
            "Deviation %\nAuto formula (DO NOT EDIT)",
            "Position size",
            "Profit/Loss in R\nAuto formula (DO NOT EDIT)",
            "Early exit reason",
            "Rules followed?",
          ],
        ],
      },
    });

    // Add formulas to row 3 and beyond (template for data rows)
    // The formulas will auto-fill when users add data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Trades!A3:R3",
      valueInputOption: "USER_ENTERED", // Important: USER_ENTERED to process formulas
      requestBody: {
        values: [
          [
            1, // Nr.
            "", // DATE
            "", // TIME
            "", // COIN
            '=IF(COUNTA(G3)=1,IF(COUNTA(H3)=1,IF(G3>H3,"Long",IF(H3>G3,"Short","")),""),"")', // DIRECTION formula
            "", // ENTRY ORDER TYPE
            "", // AVG ENTRY
            "", // STOP LOSS
            "", // AVG EXIT
            "", // RISK
            "", // EXPECTED LOSS
            "", // REALISED LOSS
            "", // REALISED WIN
            "=IF(COUNTA(J3)=1,IF(COUNTA(L3)=1,ABS(L3-J3)/J3,IF(COUNTA(M3)=1,ABS(M3-J3)/J3,\"\"))," + '"")', // DEVIATION formula
            "", // POSITION SIZE
            '=IF(COUNTA(J3)=1,IF(AND(COUNTA(L3)=1,L3<>""),IFERROR(-L3/J3,""),IF(AND(COUNTA(M3)=1,M3<>""),IFERROR(M3/J3,""),"")),"")' , // R+/- formula
            "", // EARLY EXIT REASON
            "", // RULES?
          ],
        ],
      },
    });

    // Format the header row (bold, dark background)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                  },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            },
          },
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 1,
                endRowIndex: 2,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                  textFormat: {
                    italic: true,
                    fontSize: 9,
                  },
                  wrapStrategy: "WRAP",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy)",
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                gridProperties: {
                  frozenRowCount: 2, // Freeze header and subheader
                },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: 18,
              },
            },
          },
        ],
      },
    });

    // Store tokens in user preferences
    const userId = state;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const currentPrefs = (user?.preferences || {}) as Record<string, unknown>;
    const updatedPrefs = {
      ...currentPrefs,
      googleSheets: {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date,
        spreadsheetId,
        spreadsheetUrl,
        email: userEmail,
      },
    };

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: updatedPrefs },
    });

    return new NextResponse(
      `<html><body><script>window.close();</script><h2>Successfully connected to Google Sheets!</h2><p>Your trading log has been created. You can close this window and return to the trading page.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Error in Google Sheets callback:", error);
    return new NextResponse(
      `<html><body><script>window.close();</script><p>Failed to connect to Google Sheets. Please try again.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
}
