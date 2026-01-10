"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, use } from "react";

interface Trade {
  id: string;
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
}

interface Bot {
  id: string;
  name: string;
  symbol: string;
  strategyType: string;
  parameters: Record<string, number>;
  riskSettings: {
    riskPerTrade: number;
    maxDailyLoss: number;
    leverage: number;
    maxPositions: number;
  };
  status: string;
  statusMessage: string | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  lastRunAt: string | null;
  lastTradeAt: string | null;
  createdAt: string;
  wallet: {
    id: string;
    nickname: string;
    address: string;
  };
  trades: Trade[];
}

const STRATEGY_LABELS: Record<string, string> = {
  "simple-breakout": "Simple Breakout",
  "mean-reversion": "Mean Reversion",
};

export default function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [bot, setBot] = useState<Bot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      fetchBot();
    }
  }, [status, id]);

  async function fetchBot() {
    try {
      const res = await fetch(`/api/bots/${id}`);
      const data = await res.json();
      if (data.success) {
        setBot(data.bot);
      } else {
        setError(data.error || "Failed to load bot");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStart() {
    setShowPasswordModal(true);
  }

  async function handleStartWithPassword() {
    if (!bot) return;
    setActionLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/bots/${bot.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchBot();
        setShowPasswordModal(false);
        setPassword("");
      } else {
        setError(data.error || "Failed to start bot");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    if (!bot) return;
    setActionLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/bots/${bot.id}/stop`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        await fetchBot();
      } else {
        setError(data.error || "Failed to stop bot");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!bot) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/bots/${bot.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        router.push("/bots");
      } else {
        setError(data.error || "Failed to delete bot");
        setShowDeleteModal(false);
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    redirect("/auth/login");
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Bot not found</div>
          <Link href="/bots" className="text-blue-400 hover:underline">
            Back to bots
          </Link>
        </div>
      </div>
    );
  }

  const winRate = bot.totalTrades > 0
    ? ((bot.winningTrades / bot.totalTrades) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/bots" className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold">{bot.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{bot.symbol}</span>
                <span className="text-gray-600">•</span>
                <span>{STRATEGY_LABELS[bot.strategyType] || bot.strategyType}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                bot.status === "running"
                  ? "bg-green-900/30 text-green-400"
                  : bot.status === "error"
                  ? "bg-red-900/30 text-red-400"
                  : "bg-gray-800 text-gray-400"
              }`}
            >
              {bot.status}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 text-red-300 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-sm text-gray-500">Total Trades</div>
            <div className="text-2xl font-bold font-mono">{bot.totalTrades}</div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-sm text-gray-500">Win Rate</div>
            <div className="text-2xl font-bold font-mono">{winRate}%</div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-sm text-gray-500">W / L</div>
            <div className="text-2xl font-bold font-mono">
              <span className="text-green-400">{bot.winningTrades}</span>
              <span className="text-gray-600"> / </span>
              <span className="text-red-400">{bot.losingTrades}</span>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-sm text-gray-500">Total PnL</div>
            <div className={`text-2xl font-bold font-mono ${bot.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {bot.totalPnl >= 0 ? "+" : ""}{bot.totalPnl.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            {bot.status === "running" ? (
              <button
                onClick={handleStop}
                disabled={actionLoading}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Stopping..." : "Stop Bot"}
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Starting..." : "Start Bot"}
              </button>
            )}
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={bot.status === "running" || actionLoading}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-red-400 rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              Delete Bot
            </button>
          </div>
          {bot.status === "running" && (
            <p className="text-xs text-gray-500 mt-2">Stop the bot before deleting</p>
          )}
        </div>

        {/* Configuration */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="font-semibold mb-4">Strategy Parameters</h2>
            <div className="space-y-2">
              {Object.entries(bot.parameters).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-400">{key}</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
              {Object.keys(bot.parameters).length === 0 && (
                <div className="text-gray-500 text-sm">Using default parameters</div>
              )}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="font-semibold mb-4">Risk Settings</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Risk Per Trade</span>
                <span className="font-mono">{bot.riskSettings.riskPerTrade}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Daily Loss</span>
                <span className="font-mono">{bot.riskSettings.maxDailyLoss}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Leverage</span>
                <span className="font-mono">{bot.riskSettings.leverage}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Positions</span>
                <span className="font-mono">{bot.riskSettings.maxPositions}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Info */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="font-semibold mb-4">Wallet</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{bot.wallet.nickname}</div>
              <div className="text-sm text-gray-500 font-mono">
                {bot.wallet.address.slice(0, 10)}...{bot.wallet.address.slice(-8)}
              </div>
            </div>
            <Link
              href="/trading"
              className="text-sm text-blue-400 hover:underline"
            >
              View in Trading
            </Link>
          </div>
        </div>

        {/* Trade History */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-5 border-b border-gray-800">
            <h2 className="font-semibold">Recent Trades</h2>
          </div>
          {bot.trades.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No trades yet</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {bot.trades.map((trade) => (
                <div key={trade.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        trade.side === "long"
                          ? "bg-green-900/30 text-green-400"
                          : "bg-red-900/30 text-red-400"
                      }`}
                    >
                      {trade.side.toUpperCase()}
                    </span>
                    <div>
                      <div className="font-medium">{trade.symbol}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(trade.openedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">
                      ${trade.entryPrice.toFixed(2)}
                      {trade.exitPrice && (
                        <span className="text-gray-500"> → ${trade.exitPrice.toFixed(2)}</span>
                      )}
                    </div>
                    {trade.pnl !== null && (
                      <div
                        className={`text-sm font-mono ${
                          trade.pnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}%
                      </div>
                    )}
                    <div className="text-xs text-gray-500">{trade.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="text-xs text-gray-600 space-y-1">
          <div>Created: {new Date(bot.createdAt).toLocaleString()}</div>
          {bot.lastRunAt && <div>Last run: {new Date(bot.lastRunAt).toLocaleString()}</div>}
          {bot.lastTradeAt && <div>Last trade: {new Date(bot.lastTradeAt).toLocaleString()}</div>}
        </div>
      </main>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Enter Wallet Password</h3>
            <p className="text-gray-400 text-sm mb-4">
              Your wallet password is needed to start the bot and sign transactions.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wallet encryption password"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg mb-4"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleStartWithPassword()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                }}
                className="flex-1 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartWithPassword}
                disabled={!password || actionLoading}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Starting..." : "Start Bot"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Delete Bot</h3>
            <p className="text-gray-400 mb-4">
              Are you sure you want to delete <span className="text-white font-medium">{bot.name}</span>?
              Trade history will be preserved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
