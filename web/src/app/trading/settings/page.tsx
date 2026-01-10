"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

interface ExtensionKey {
  id: string;
  name: string;
  key: string; // Masked
  asset: string;
  riskAmount: number;
  leverage: number;
  lastUsedAt: string | null;
  usageCount: number;
  active: boolean;
  createdAt: string;
  wallet: {
    id: string;
    nickname: string;
    address: string;
  };
}

interface Wallet {
  id: string;
  nickname: string;
  address: string;
}

export default function TradingSettingsPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<ExtensionKey[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New key form
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyWalletId, setNewKeyWalletId] = useState("");
  const [newKeyPassword, setNewKeyPassword] = useState("");
  const [newKeyAsset, setNewKeyAsset] = useState("BTC");
  const [newKeyRisk, setNewKeyRisk] = useState("1.00");
  const [newKeyLeverage, setNewKeyLeverage] = useState("25");
  const [isCreating, setIsCreating] = useState(false);

  // Newly created key (shown only once)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    redirect("/auth/login");
  }

  // Fetch keys and wallets
  useEffect(() => {
    async function fetchData() {
      try {
        const [keysRes, walletsRes] = await Promise.all([
          fetch("/api/extension/keys"),
          fetch("/api/wallets"),
        ]);

        const keysData = await keysRes.json();
        const walletsData = await walletsRes.json();

        if (keysRes.ok) setKeys(keysData.keys || []);
        if (walletsRes.ok) setWallets(walletsData.wallets || []);
      } catch (err) {
        setError("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName || !newKeyWalletId) {
      setError("Name and wallet are required");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const res = await fetch("/api/extension/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          walletId: newKeyWalletId,
          walletPassword: newKeyPassword || undefined,
          asset: newKeyAsset,
          riskAmount: parseFloat(newKeyRisk),
          leverage: parseInt(newKeyLeverage),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create key");
        return;
      }

      // Show the new key (only shown once)
      setNewlyCreatedKey(data.key.apiKey);
      setSuccess(`API key "${newKeyName}" created`);

      // Reset form
      setShowNewKeyForm(false);
      setNewKeyName("");
      setNewKeyPassword("");

      // Refresh keys list
      const keysRes = await fetch("/api/extension/keys");
      const keysData = await keysRes.json();
      if (keysRes.ok) setKeys(keysData.keys || []);
    } catch (err) {
      setError("Network error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Delete this API key? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/extension/keys?id=${keyId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setKeys(keys.filter((k) => k.id !== keyId));
        setSuccess("API key deleted");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete key");
      }
    } catch (err) {
      setError("Network error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard");
    setTimeout(() => setSuccess(""), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/trading" className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold">Extension Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
            {error}
            <button onClick={() => setError("")} className="float-right">×</button>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-900/30 border border-green-800 rounded-lg text-green-400">
            {success}
            <button onClick={() => setSuccess("")} className="float-right">×</button>
          </div>
        )}

        {/* Newly Created Key Banner */}
        {newlyCreatedKey && (
          <div className="p-4 bg-blue-900/30 border border-blue-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-blue-400">New API Key Created</span>
              <button
                onClick={() => setNewlyCreatedKey(null)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-2">
              Copy this key now - it won't be shown again!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-gray-900 rounded font-mono text-sm break-all">
                {newlyCreatedKey}
              </code>
              <button
                onClick={() => copyToClipboard(newlyCreatedKey)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="font-semibold text-gray-200 mb-3">TradingView Extension Setup</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
            <li>Create an API key below for your trading wallet</li>
            <li>Install the TradingView Bridge extension (Chrome)</li>
            <li>Click the extension icon and paste your API key</li>
            <li>Draw Long/Short positions on TradingView charts</li>
            <li>Click "Enter" in the overlay to execute trades</li>
          </ol>
        </div>

        {/* API Keys List */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="font-semibold text-gray-200">API Keys</h2>
            <button
              onClick={() => setShowNewKeyForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
            >
              + New Key
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No API keys yet. Create one to use the TradingView extension.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {keys.map((key) => (
                <div key={key.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{key.name}</span>
                      <code className="px-2 py-0.5 bg-gray-800 rounded text-xs font-mono text-gray-400">
                        {key.key}
                      </code>
                    </div>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm text-gray-400">
                    <div>
                      <span className="text-gray-500">Wallet:</span>{" "}
                      {key.wallet.nickname}
                    </div>
                    <div>
                      <span className="text-gray-500">Asset:</span> {key.asset}
                    </div>
                    <div>
                      <span className="text-gray-500">Risk:</span> ${key.riskAmount}
                    </div>
                    <div>
                      <span className="text-gray-500">Leverage:</span> {key.leverage}x
                    </div>
                  </div>
                  {key.lastUsedAt && (
                    <div className="mt-2 text-xs text-gray-500">
                      Last used: {new Date(key.lastUsedAt).toLocaleString()} ({key.usageCount} trades)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Key Modal */}
        {showNewKeyForm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Create API Key</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                    placeholder="TradingView Extension"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Wallet</label>
                  <select
                    value={newKeyWalletId}
                    onChange={(e) => setNewKeyWalletId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                  >
                    <option value="">Select wallet...</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nickname} ({w.address.slice(0, 6)}...{w.address.slice(-4)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Wallet Password <span className="text-gray-500">(for auto-trading)</span>
                  </label>
                  <input
                    type="password"
                    value={newKeyPassword}
                    onChange={(e) => setNewKeyPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                    placeholder="Leave empty for manual unlock"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Store password to enable one-click trading from extension
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Asset</label>
                    <input
                      type="text"
                      value={newKeyAsset}
                      onChange={(e) => setNewKeyAsset(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Risk ($)</label>
                    <input
                      type="number"
                      value={newKeyRisk}
                      onChange={(e) => setNewKeyRisk(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                      step="0.01"
                      min="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Leverage</label>
                    <input
                      type="number"
                      value={newKeyLeverage}
                      onChange={(e) => setNewKeyLeverage(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewKeyForm(false)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateKey}
                  disabled={isCreating || !newKeyName || !newKeyWalletId}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Key"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
