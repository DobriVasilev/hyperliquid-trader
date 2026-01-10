"use client";

import { useState, useEffect } from "react";

interface TradingFormProps {
  walletId: string | null;
  onTradeComplete: () => void;
}

interface Price {
  symbol: string;
  price: number;
}

export function TradingForm({ walletId, onTradeComplete }: TradingFormProps) {
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<"long" | "short">("long");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [popularSymbols] = useState(["BTC", "ETH", "SOL", "DOGE", "WIF", "PEPE"]);

  // Fetch prices
  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch("/api/prices");
        const data = await res.json();
        if (data.success) {
          setPrices(data.prices);
        }
      } catch (err) {
        console.error("Failed to fetch prices");
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentPrice = prices[symbol] || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletId) {
      setError("Please select a wallet first");
      return;
    }

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId,
          password,
          symbol,
          side,
          size: parseFloat(size),
          leverage: parseInt(leverage),
          orderType,
          limitPrice: orderType === "limit" ? parseFloat(limitPrice) : undefined,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Trade failed");
        return;
      }

      setSuccess(`${side.toUpperCase()} ${size} ${symbol} @ ${currentPrice.toFixed(2)}`);
      setSize("");
      setStopLoss("");
      setTakeProfit("");
      onTradeComplete();
    } catch (err) {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="font-semibold text-gray-200 mb-4">Place Trade</h3>

      {error && (
        <div className="mb-4 p-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-2 bg-green-900/30 border border-green-800 rounded text-green-400 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Symbol Selection */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Symbol</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {popularSymbols.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSymbol(s)}
                className={`px-3 py-1.5 rounded text-sm ${
                  symbol === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              placeholder="Custom symbol"
            />
            {currentPrice > 0 && (
              <span className="text-sm text-gray-400">
                ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {/* Side Selection */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Side</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSide("long")}
              className={`py-2.5 rounded font-medium text-sm ${
                side === "long"
                  ? "bg-green-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Long
            </button>
            <button
              type="button"
              onClick={() => setSide("short")}
              className={`py-2.5 rounded font-medium text-sm ${
                side === "short"
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Short
            </button>
          </div>
        </div>

        {/* Size and Leverage */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Size (USD)</label>
            <input
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              placeholder="100"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Leverage</label>
            <select
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            >
              {[1, 2, 3, 5, 10, 20, 50].map((l) => (
                <option key={l} value={l}>
                  {l}x
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Order Type */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Order Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOrderType("market")}
              className={`py-2 rounded text-sm ${
                orderType === "market"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => setOrderType("limit")}
              className={`py-2 rounded text-sm ${
                orderType === "limit"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Limit
            </button>
          </div>
        </div>

        {/* Limit Price (if limit order) */}
        {orderType === "limit" && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Limit Price</label>
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              placeholder={currentPrice.toString()}
              step="0.01"
              required
            />
          </div>
        )}

        {/* Stop Loss / Take Profit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Stop Loss</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              placeholder="Optional"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Take Profit</label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              placeholder="Optional"
              step="0.01"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Wallet Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            placeholder="Your encryption password"
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !walletId}
          className={`w-full py-3 rounded font-medium ${
            side === "long"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting
            ? "Placing Order..."
            : `${side === "long" ? "Buy" : "Sell"} ${symbol}`}
        </button>
      </form>
    </div>
  );
}
