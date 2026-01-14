"use client";

import { useState, useEffect } from "react";

export function TradingSettingsPanel() {
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Trading settings
  const [leverage, setLeverage] = useState(25);
  const [risk, setRisk] = useState(1.0);
  const [defaultAsset, setDefaultAsset] = useState("BTC");

  // Google Sheets OAuth state
  const [sheetsAuthorized, setSheetsAuthorized] = useState(false);
  const [sheetsEmail, setSheetsEmail] = useState("");
  const [authorizingSheets, setAuthorizingSheets] = useState(false);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/user/settings");
        const data = await res.json();
        if (data.success && data.data) {
          setLeverage(data.data.defaultLeverage || 25);
          setRisk(data.data.defaultRisk || 1.0);
          setDefaultAsset(data.data.defaultAsset || "BTC");
          // Google Sheets is nested under googleSheets
          const googleSheets = data.data.googleSheets || {};
          setSheetsAuthorized(!!googleSheets.refreshToken);
          setSheetsEmail(googleSheets.email || "");
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSaveTrading = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultLeverage: leverage,
          defaultRisk: risk,
          defaultAsset: defaultAsset,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      } else {
        throw new Error(data.error || "Failed to save");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorizeSheets = async () => {
    setAuthorizingSheets(true);
    try {
      const res = await fetch("/api/user/google-sheets/authorize");
      const data = await res.json();

      if (data.success && data.data?.authUrl) {
        // Open OAuth in new window
        window.open(data.data.authUrl, "_blank", "width=600,height=700");
        // Reload after a delay to check connection status
        setTimeout(() => window.location.reload(), 3000);
      } else {
        throw new Error(data.error || "Failed to get authorization URL");
      }
    } catch (error) {
      console.error("Authorization error:", error);
      alert("Failed to start authorization. Please try again.");
      setAuthorizingSheets(false);
    }
  };

  const handleDisconnectSheets = async () => {
    if (!confirm("Disconnect Google Sheets integration?")) return;

    setSaving(true);
    try {
      const res = await fetch("/api/user/google-sheets", {
        method: "DELETE",
      });

      if (res.ok) {
        setSheetsAuthorized(false);
        setSheetsEmail("");
        alert("Google Sheets disconnected");
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
      alert("Failed to disconnect Google Sheets");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-800 rounded w-32"></div>
          <div className="h-24 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trading Settings */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Trading Settings
          </h3>
          {showSuccess && (
            <span className="text-xs text-green-400">Saved!</span>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Leverage */}
          <div>
            <label className="block text-xs text-gray-400 uppercase font-medium mb-2">
              Default Leverage
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="100"
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex items-center gap-1 bg-gray-800 px-3 py-2 rounded-lg min-w-[80px]">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
                  className="w-12 bg-transparent text-white font-semibold text-right outline-none"
                />
                <span className="text-gray-400 text-sm">x</span>
              </div>
            </div>
          </div>

          {/* Risk (PNL) */}
          <div>
            <label className="block text-xs text-gray-400 uppercase font-medium mb-2">
              Default Risk (Max Loss Per Trade)
            </label>
            <div className="flex items-center gap-1 bg-gray-800 px-3 py-2 rounded-lg w-full">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={risk}
                onChange={(e) => setRisk(parseFloat(e.target.value) || 0.1)}
                className="flex-1 bg-transparent text-white font-semibold outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Amount you're willing to lose per trade</p>
          </div>

          {/* Default Asset */}
          <div>
            <label className="block text-xs text-gray-400 uppercase font-medium mb-2">
              Default Asset
            </label>
            <div className="flex gap-2">
              {['BTC', 'ETH', 'SOL', 'DOGE'].map((asset) => (
                <button
                  key={asset}
                  onClick={() => setDefaultAsset(asset)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    defaultAsset === asset
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveTrading}
            disabled={saving}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save Trading Settings"}
          </button>
        </div>
      </div>

      {/* Google Sheets Export */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Google Sheets Export
          </h3>
        </div>

        <div className="p-4">
          {sheetsAuthorized ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400">Connected</p>
                  <p className="text-xs text-gray-400">{sheetsEmail}</p>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                All trades are automatically exported to your Google Sheet
              </p>

              <button
                onClick={handleDisconnectSheets}
                disabled={saving}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                {saving ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Automatically export all your trades to a Google Spreadsheet
              </p>

              <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-xs text-blue-300">
                    <p className="font-medium mb-1">One-click setup:</p>
                    <ul className="space-y-1 text-blue-400/80">
                      <li>• We create a spreadsheet for you</li>
                      <li>• Trades sync automatically</li>
                      <li>• Full trade history with PNL</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAuthorizeSheets}
                disabled={authorizingSheets}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {authorizingSheets ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Authorizing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                    Authorize Google Sheets
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
