/**
 * Market Prices API
 *
 * GET /api/prices - Get current market prices (public endpoint)
 */

import { NextResponse } from 'next/server';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

export async function GET() {
  try {
    // Get all mids (mid prices)
    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch prices');
    }

    const mids: Record<string, string> = await response.json();

    // Convert to numbers
    const prices: Record<string, number> = {};
    for (const [symbol, price] of Object.entries(mids)) {
      prices[symbol] = parseFloat(price);
    }

    return NextResponse.json({
      success: true,
      prices,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}
