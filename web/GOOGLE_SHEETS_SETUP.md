# Google Sheets Integration Setup

This guide explains how to set up automatic trade logging to your Google Sheets.

## Overview

When you execute trades via the TradingView extension or the trading page, they will automatically be logged to your Google Sheet in real-time.

## Setup Steps

### 1. Create Your Google Sheet

1. Create a new Google Sheet
2. Set up your columns (example structure):
   - Column B: DATE
   - Column C: TIME
   - Column D: COIN
   - Column E: DIRECTION (can be auto-calculated)
   - Column F: ENTRY ORDER TYPE
   - Column G: AVG ENTRY
   - Column H: STOP LOSS
   - Column I: AVG EXIT (filled on close)
   - Column J: RISK
   - Column K: EXPECTED LOSS
   - Column L: REALISED LOSS (filled on close)
   - Column M: REALISED WIN (filled on close)
   - Column N: DEVIATION (can be auto-calculated)
   - Column O: POSITION SIZE

### 2. Add the Apps Script

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any existing code
3. Paste the following script:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);

    if (data.action === "open") {
      // Find first row where column C (TIME) is empty
      const lastRow = sheet.getLastRow();
      let targetRow = lastRow + 1;

      const colC = sheet.getRange('C:C').getValues();
      for (let i = 1; i < colC.length; i++) {
        if (colC[i][0] === '' || colC[i][0] === null) {
          targetRow = i + 1;
          break;
        }
      }

      // Fill trade open data
      sheet.getRange(targetRow, 2).setValue(data.date);           // B: DATE
      sheet.getRange(targetRow, 3).setValue(data.time);           // C: TIME
      sheet.getRange(targetRow, 4).setValue(data.coin);           // D: COIN
      sheet.getRange(targetRow, 6).setValue(data.orderType);      // F: ENTRY ORDER TYPE
      sheet.getRange(targetRow, 7).setValue(data.entry);          // G: AVG ENTRY
      sheet.getRange(targetRow, 8).setValue(data.sl);             // H: STOP LOSS
      sheet.getRange(targetRow, 10).setValue(data.risk);          // J: RISK
      sheet.getRange(targetRow, 11).setValue(data.expectedLoss);  // K: EXPECTED LOSS
      sheet.getRange(targetRow, 15).setValue(data.positionSize);  // O: POSITION SIZE

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        action: "open",
        row: targetRow
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (data.action === "close") {
      // Find row by matching coin + entry + sl where I (exit) is empty
      const dataRange = sheet.getDataRange().getValues();
      let targetRow = -1;

      for (let i = 1; i < dataRange.length; i++) {
        const row = dataRange[i];
        const coin = row[3];      // D: COIN (0-indexed = 3)
        const entry = row[6];     // G: AVG ENTRY (0-indexed = 6)
        const sl = row[7];        // H: STOP LOSS (0-indexed = 7)
        const exitPrice = row[8]; // I: AVG EXIT (0-indexed = 8)

        if (coin === data.coin &&
            Math.abs(entry - data.entry) < 0.01 &&
            Math.abs(sl - data.sl) < 0.01 &&
            (exitPrice === '' || exitPrice === null)) {
          targetRow = i + 1;
          break;
        }
      }

      if (targetRow > 0) {
        sheet.getRange(targetRow, 9).setValue(data.exitPrice);   // I: AVG EXIT
        if (data.realizedLoss !== null) {
          sheet.getRange(targetRow, 12).setValue(data.realizedLoss); // L: REALISED LOSS
        }
        if (data.realizedWin !== null) {
          sheet.getRange(targetRow, 13).setValue(data.realizedWin);  // M: REALISED WIN
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          action: "close",
          row: targetRow
        })).setMimeType(ContentService.MimeType.JSON);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Trade not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Click **Save** (💾 icon)
5. Name your project (e.g., "Trading Logger")

### 3. Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Fill in the settings:
   - **Description**: Trading Logger
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
5. Click **Deploy**
6. **Authorize** the app when prompted (you may see a warning - click "Advanced" → "Go to [Project Name]")
7. **Copy the deployment URL** (it looks like: `https://script.google.com/macros/s/AKfycby.../exec`)

### 4. Add Webhook URL to Trading Settings

1. Go to your trading page (`/trading`)
2. Scroll to the **Trading Settings** panel in the left sidebar
3. Under **Google Sheets Webhook**, paste your deployment URL
4. Click **Save**
5. Click **Test** to verify the connection

## Testing

After setup:
1. Click the **Test** button in the Trading Settings panel
2. Check your Google Sheet - you should see a test trade entry
3. If successful, all future trades will be logged automatically!

## Troubleshooting

**Test fails with "Failed to fetch":**
- Make sure you deployed as "Anyone" access (not "Anyone with Google account")
- Re-deploy the script if you made changes
- Check that the URL is correct (no extra spaces)

**Trades not appearing:**
- Check that the webhook URL is saved in settings
- Verify column positions match the script (adjust if your sheet layout is different)
- Check browser console for any errors

**"Trade not found" on close:**
- The script matches trades by coin + entry + stop loss
- Make sure these values match exactly (within 0.01 precision)
- Verify the AVG EXIT column (I) is empty for open trades

## Customization

You can customize the script to match your sheet structure:
- Change column positions in `getRange(targetRow, X)` calls
- Modify the matching logic in the close action
- Add additional fields or calculations

## Data Logged

**On Trade Open:**
- Date & Time
- Coin/Symbol
- Order Type (Market/Limit)
- Entry Price
- Stop Loss
- Risk Amount
- Expected Loss
- Position Size

**On Trade Close:**
- Exit Price
- Realized P&L (Win or Loss)
