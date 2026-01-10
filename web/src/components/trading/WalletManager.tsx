"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Wallet {
  id: string;
  nickname: string;
  address: string;
  isDefault: boolean;
  lastUsedAt: string | null;
  _count: {
    bots: number;
    trades: number;
  };
}

interface WalletManagerProps {
  selectedWallet: Wallet | null;
  onSelectWallet: (wallet: Wallet) => void;
}

export function WalletManager({ selectedWallet, onSelectWallet }: WalletManagerProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState("");

  // Add wallet form state
  const [nickname, setNickname] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [password, setPassword] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, []);

  async function fetchWallets() {
    try {
      const res = await fetch("/api/wallets");
      const data = await res.json();
      if (data.success) {
        setWallets(data.wallets);
        // Auto-select default wallet
        const defaultWallet = data.wallets.find((w: Wallet) => w.isDefault);
        if (defaultWallet && !selectedWallet) {
          onSelectWallet(defaultWallet);
        }
      }
    } catch (err) {
      setError("Failed to load wallets");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddWallet(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsAdding(true);

    try {
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, privateKey, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add wallet");
        return;
      }

      // Refresh wallets
      await fetchWallets();
      setShowAddForm(false);
      setNickname("");
      setPrivateKey("");
      setPassword("");
    } catch (err) {
      setError("Network error");
    } finally {
      setIsAdding(false);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-800 rounded w-24 mb-4"></div>
          <div className="h-10 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-200">Wallets</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          {showAddForm ? "Cancel" : "+ Add Wallet"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddWallet} className="mb-4 space-y-3 p-3 bg-gray-800 rounded-lg">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm"
              placeholder="Main Trading"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Private Key</label>
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm font-mono"
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Encryption Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm"
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-50"
          >
            {isAdding ? "Adding..." : "Add Wallet"}
          </button>
        </form>
      )}

      {wallets.length === 0 ? (
        <div className="text-center py-2">
          <p className="text-gray-500 text-sm mb-2">No wallets added yet</p>
          <Link href="/setup-guide" className="text-xs text-blue-400 hover:underline">
            New to Hyperliquid? See setup guide
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => onSelectWallet(wallet)}
              className={`w-full p-3 rounded-lg text-left transition-colors ${
                selectedWallet?.id === wallet.id
                  ? "bg-blue-900/30 border border-blue-700"
                  : "bg-gray-800 hover:bg-gray-750 border border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{wallet.nickname}</span>
                {wallet.isDefault && (
                  <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded">
                    Default
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 font-mono mt-1">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {wallet._count.trades} trades | {wallet._count.bots} bots
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
