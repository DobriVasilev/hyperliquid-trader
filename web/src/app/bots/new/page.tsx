"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

interface Wallet {
  id: string;
  nickname: string;
  address: string;
  isDefault: boolean;
}

const STRATEGIES = [
  {
    id: "simple-breakout",
    name: "Simple Breakout",
    description: "Enters long when price breaks above resistance, short when breaks below support",
    params: [
      { key: "resistance", label: "Resistance Price", type: "number", placeholder: "Auto-calculated if empty" },
      { key: "support", label: "Support Price", type: "number", placeholder: "Auto-calculated if empty" },
      { key: "stopLossPercent", label: "Stop Loss %", type: "number", default: 2 },
      { key: "takeProfitPercent", label: "Take Profit %", type: "number", default: 4 },
    ],
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    description: "Buys when price deviates significantly below average, sells when above",
    params: [
      { key: "avgPrice", label: "Average Price", type: "number", placeholder: "Current price if empty" },
      { key: "deviationPercent", label: "Deviation %", type: "number", default: 3 },
      { key: "stopLossPercent", label: "Stop Loss %", type: "number", default: 2 },
    ],
  },
];

const POPULAR_SYMBOLS = ["BTC", "ETH", "SOL", "DOGE", "WIF", "PEPE", "ARB", "OP"];

export default function NewBotPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [walletId, setWalletId] = useState("");
  const [symbol, setSymbol] = useState("BTC");
  const [strategyType, setStrategyType] = useState("simple-breakout");
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [riskPerTrade, setRiskPerTrade] = useState("1");
  const [maxDailyLoss, setMaxDailyLoss] = useState("5");
  const [leverage, setLeverage] = useState("10");
  const [maxPositions, setMaxPositions] = useState("3");

  useEffect(() => {
    if (status === "authenticated") {
      fetchWallets();
    }
  }, [status]);

  async function fetchWallets() {
    try {
      const res = await fetch("/api/wallets");
      const data = await res.json();
      if (data.success) {
        setWallets(data.wallets);
        // Auto-select default wallet
        const defaultWallet = data.wallets.find((w: Wallet) => w.isDefault);
        if (defaultWallet) {
          setWalletId(defaultWallet.id);
        } else if (data.wallets.length > 0) {
          setWalletId(data.wallets[0].id);
        }
      }
    } catch (err) {
      setError("Failed to load wallets");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // Build parameters object with only filled values
    const strategyParams: Record<string, number> = {};
    const selectedStrategy = STRATEGIES.find((s) => s.id === strategyType);
    if (selectedStrategy) {
      for (const param of selectedStrategy.params) {
        const value = parameters[param.key];
        if (value) {
          strategyParams[param.key] = parseFloat(value);
        } else if (param.default !== undefined) {
          strategyParams[param.key] = param.default;
        }
      }
    }

    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          walletId,
          symbol,
          strategyType,
          parameters: strategyParams,
          riskSettings: {
            riskPerTrade: parseFloat(riskPerTrade),
            maxDailyLoss: parseFloat(maxDailyLoss),
            leverage: parseInt(leverage),
            maxPositions: parseInt(maxPositions),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create bot");
        return;
      }

      router.push(`/bots/${data.bot.id}`);
    } catch (err) {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
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

  const selectedStrategy = STRATEGIES.find((s) => s.id === strategyType);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/bots" className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold">Create New Bot</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {wallets.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 mb-4">No wallets found</div>
            <p className="text-gray-600 mb-6">
              You need to add a wallet before creating a bot
            </p>
            <Link
              href="/trading"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Add Wallet
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="font-semibold mb-4">Basic Info</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bot Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My BTC Breakout Bot"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Wallet</label>
                  <select
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                    required
                  >
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.nickname} ({wallet.address.slice(0, 6)}...{wallet.address.slice(-4)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Symbol</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {POPULAR_SYMBOLS.map((s) => (
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
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="Custom symbol"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                  />
                </div>
              </div>
            </section>

            {/* Strategy Selection */}
            <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="font-semibold mb-4">Strategy</h2>
              <div className="space-y-3">
                {STRATEGIES.map((strategy) => (
                  <label
                    key={strategy.id}
                    className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
                      strategyType === strategy.id
                        ? "bg-blue-900/20 border-blue-600"
                        : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="strategy"
                        value={strategy.id}
                        checked={strategyType === strategy.id}
                        onChange={(e) => setStrategyType(e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{strategy.name}</div>
                        <div className="text-sm text-gray-400">{strategy.description}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* Strategy Parameters */}
            {selectedStrategy && selectedStrategy.params.length > 0 && (
              <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h2 className="font-semibold mb-4">Strategy Parameters</h2>
                <div className="grid grid-cols-2 gap-4">
                  {selectedStrategy.params.map((param) => (
                    <div key={param.key}>
                      <label className="block text-sm text-gray-400 mb-1">
                        {param.label}
                      </label>
                      <input
                        type="number"
                        value={parameters[param.key] || ""}
                        onChange={(e) =>
                          setParameters({ ...parameters, [param.key]: e.target.value })
                        }
                        placeholder={param.placeholder || (param.default !== undefined ? String(param.default) : "")}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                        step="any"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Risk Settings */}
            <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="font-semibold mb-4">Risk Management</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Risk Per Trade (%)
                  </label>
                  <input
                    type="number"
                    value={riskPerTrade}
                    onChange={(e) => setRiskPerTrade(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                    min="0.1"
                    max="10"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Max Daily Loss (%)
                  </label>
                  <input
                    type="number"
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                    min="1"
                    max="50"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Leverage</label>
                  <select
                    value={leverage}
                    onChange={(e) => setLeverage(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                  >
                    {[1, 2, 3, 5, 10, 20, 50].map((l) => (
                      <option key={l} value={l}>
                        {l}x
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Max Positions
                  </label>
                  <input
                    type="number"
                    value={maxPositions}
                    onChange={(e) => setMaxPositions(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                    min="1"
                    max="10"
                    step="1"
                  />
                </div>
              </div>
            </section>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !name || !walletId || !symbol}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Creating..." : "Create Bot"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
