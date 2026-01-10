"use client";

import Link from "next/link";

interface Bot {
  id: string;
  name: string;
  symbol: string;
  strategyType: string;
  status: string;
  statusMessage?: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  lastRunAt: string | null;
  wallet: {
    id: string;
    nickname: string;
    address: string;
  };
}

interface BotCardProps {
  bot: Bot;
  onStart: (botId: string) => void;
  onStop: (botId: string) => void;
  isLoading: boolean;
}

const STRATEGY_LABELS: Record<string, string> = {
  "simple-breakout": "Breakout",
  "mean-reversion": "Mean Reversion",
  "bos-breakout": "BOS Breakout",
  "75-retracement": "75% Retracement",
};

const STATUS_COLORS: Record<string, string> = {
  running: "bg-green-500",
  stopped: "bg-gray-500",
  error: "bg-red-500",
  paused: "bg-yellow-500",
};

export function BotCard({ bot, onStart, onStop, isLoading }: BotCardProps) {
  const winRate = bot.totalTrades > 0
    ? ((bot.winningTrades / bot.totalTrades) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <Link
            href={`/bots/${bot.id}`}
            className="text-lg font-semibold hover:text-blue-400 transition-colors"
          >
            {bot.name}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-400">{bot.symbol}</span>
            <span className="text-xs text-gray-600">•</span>
            <span className="text-sm text-gray-500">
              {STRATEGY_LABELS[bot.strategyType] || bot.strategyType}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${STATUS_COLORS[bot.status] || "bg-gray-500"}`}
          />
          <span className="text-sm text-gray-400 capitalize">{bot.status}</span>
        </div>
      </div>

      {/* Error message if any */}
      {bot.status === "error" && bot.statusMessage && (
        <div className="mb-4 p-2 bg-red-900/20 border border-red-800/50 rounded text-red-400 text-xs">
          {bot.statusMessage}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Trades</div>
          <div className="font-mono text-sm">{bot.totalTrades}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Win Rate</div>
          <div className="font-mono text-sm">{winRate}%</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">W/L</div>
          <div className="font-mono text-sm text-green-400">
            {bot.winningTrades}
            <span className="text-gray-600">/</span>
            <span className="text-red-400">{bot.losingTrades}</span>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">PnL</div>
          <div className={`font-mono text-sm ${bot.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {bot.totalPnl >= 0 ? "+" : ""}{bot.totalPnl.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Wallet info */}
      <div className="text-xs text-gray-500 mb-4">
        Wallet: {bot.wallet.nickname} ({bot.wallet.address.slice(0, 6)}...{bot.wallet.address.slice(-4)})
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {bot.status === "running" ? (
          <button
            onClick={() => onStop(bot.id)}
            disabled={isLoading}
            className="flex-1 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg text-sm font-medium hover:bg-red-600/30 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Stopping..." : "Stop Bot"}
          </button>
        ) : (
          <button
            onClick={() => onStart(bot.id)}
            disabled={isLoading}
            className="flex-1 py-2 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg text-sm font-medium hover:bg-green-600/30 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Starting..." : "Start Bot"}
          </button>
        )}
        <Link
          href={`/bots/${bot.id}`}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Details
        </Link>
      </div>

      {/* Last run */}
      {bot.lastRunAt && (
        <div className="mt-3 text-xs text-gray-600">
          Last run: {new Date(bot.lastRunAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
