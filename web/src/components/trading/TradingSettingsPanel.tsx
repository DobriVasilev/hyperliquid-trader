"use client";

import { useState, useEffect } from "react";

export function TradingSettingsPanel() {
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Basic Trading Settings
  const [leverage, setLeverage] = useState(25);
  const [risk, setRisk] = useState(1.0);
  const [defaultAsset, setDefaultAsset] = useState("BTC");

  // Advanced Trading Settings
  const [autoAdjustLeverage, setAutoAdjustLeverage] = useState(true);
  const [autoRetryUnfilled, setAutoRetryUnfilled] = useState(false);
  const [unfilledWaitTime, setUnfilledWaitTime] = useState(30);
  const [maxRiskMultiplier, setMaxRiskMultiplier] = useState(2.0);
  const [feeBuffer, setFeeBuffer] = useState(0.05);
  const [updateEntryOnConfirm, setUpdateEntryOnConfirm] = useState(false);
  const [copyReportToClipboard, setCopyReportToClipboard] = useState(false);

  // Risk Settings
  const [liqWarningDistance, setLiqWarningDistance] = useState(300);
  const [liqDangerDistance, setLiqDangerDistance] = useState(100);
  const [pnlTolerance, setPnlTolerance] = useState(0.10);

  // Extension Settings
  const [extensionSkipConfirm, setExtensionSkipConfirm] = useState(true);
  const [extensionEnabled, setExtensionEnabled] = useState(true);

  // Google Sheets OAuth state
  const [sheetsAuthorized, setSheetsAuthorized] = useState(false);
  const [sheetsEmail, setSheetsEmail] = useState("");
  const [authorizingSheets, setAuthorizingSheets] = useState(false);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/user/settings");
        const data = await res.json();
        if (data.success && data.data) {
          // Basic settings
          setLeverage(data.data.defaultLeverage || 25);
          setRisk(data.data.defaultRisk || 1.0);
          setDefaultAsset(data.data.defaultAsset || "BTC");

          // Advanced settings
          setAutoAdjustLeverage(data.data.autoAdjustLeverage ?? true);
          setAutoRetryUnfilled(data.data.autoRetryUnfilled ?? false);
          setUnfilledWaitTime(data.data.unfilledWaitTime || 30);
          setMaxRiskMultiplier(data.data.maxRiskMultiplier || 2.0);
          setFeeBuffer(data.data.feeBuffer || 0.05);
          setUpdateEntryOnConfirm(data.data.updateEntryOnConfirm ?? false);
          setCopyReportToClipboard(data.data.copyReportToClipboard ?? false);

          // Risk settings
          setLiqWarningDistance(data.data.liqWarningDistance || 300);
          setLiqDangerDistance(data.data.liqDangerDistance || 100);
          setPnlTolerance(data.data.pnlTolerance || 0.10);

          // Extension settings
          setExtensionSkipConfirm(data.data.extensionSkipConfirm ?? true);
          setExtensionEnabled(data.data.extensionEnabled ?? true);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultLeverage: leverage,
          defaultRisk: risk,
          defaultAsset: defaultAsset,
          autoAdjustLeverage,
          autoRetryUnfilled,
          unfilledWaitTime,
          maxRiskMultiplier,
          feeBuffer,
          updateEntryOnConfirm,
          copyReportToClipboard,
          liqWarningDistance,
          liqDangerDistance,
          pnlTolerance,
          extensionSkipConfirm,
          extensionEnabled,
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
        window.open(data.data.authUrl, "_blank", "width=600,height=700");
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
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Trading Settings</h2>
          <p className="text-sm text-gray-400 mt-1">Configure your default trading parameters and automation settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : showSuccess ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Main Grid - 2 Columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Basic Trading Settings */}
        <div className="space-y-6">
          {/* Default Leverage */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-4">
              Default Leverage
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="100"
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex items-center gap-1 bg-gray-800 px-4 py-2 rounded-lg min-w-[90px] justify-center">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
                  className="w-14 bg-transparent text-white font-semibold text-right outline-none"
                />
                <span className="text-gray-400 text-sm font-medium">x</span>
              </div>
            </div>
          </div>

          {/* Default Risk */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Default Risk (Max Loss Per Trade)
            </label>
            <div className="flex items-center gap-2 bg-gray-800 px-4 py-3 rounded-lg">
              <span className="text-gray-400 text-lg">$</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={risk}
                onChange={(e) => setRisk(parseFloat(e.target.value) || 0.1)}
                className="flex-1 bg-transparent text-white text-lg font-semibold outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Maximum amount you're willing to lose per trade</p>
          </div>

          {/* Default Asset */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-4">
              Default Asset
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['BTC', 'ETH', 'SOL', 'DOGE'].map((asset) => (
                <button
                  key={asset}
                  onClick={() => setDefaultAsset(asset)}
                  className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    defaultAsset === asset
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Google Sheets Integration */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
            <h3 className="font-semibold text-white">Google Sheets Export</h3>
          </div>

          {sheetsAuthorized ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800/50 rounded-lg">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400">Connected</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sheetsEmail}</p>
                </div>
              </div>

              <p className="text-sm text-gray-400">
                All trades are automatically exported to your Google Sheet with full trade history and PnL tracking.
              </p>

              <button
                onClick={handleDisconnectSheets}
                disabled={saving}
                className="w-full px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 border border-red-600/50 text-red-400 text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? "Disconnecting..." : "Disconnect Google Sheets"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Automatically export all your trades to a Google Spreadsheet with one click.
              </p>

              <div className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-xs text-blue-300">
                    <p className="font-medium mb-2">What you get:</p>
                    <ul className="space-y-1.5 text-blue-400/80">
                      <li className="flex items-center gap-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Auto-created trading log spreadsheet
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Real-time trade sync
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Full PnL history & analytics
                      </li>
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
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                    Connect Google Sheets
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Settings - Collapsible */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <div className="text-left">
              <h3 className="font-semibold text-white">Advanced Settings</h3>
              <p className="text-xs text-gray-500 mt-0.5">Automation, risk management, and extension settings</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="p-6 border-t border-gray-800 space-y-6">
            {/* Trading Automation */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4">Trading Automation</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800">
                  <div>
                    <p className="text-sm font-medium text-white">Auto-adjust Leverage</p>
                    <p className="text-xs text-gray-500 mt-0.5">Automatically adjust leverage to fit risk parameters</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoAdjustLeverage}
                    onChange={(e) => setAutoAdjustLeverage(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800">
                  <div>
                    <p className="text-sm font-medium text-white">Auto-retry Unfilled Orders</p>
                    <p className="text-xs text-gray-500 mt-0.5">Retry orders that don't fill within wait time</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRetryUnfilled}
                    onChange={(e) => setAutoRetryUnfilled(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                {autoRetryUnfilled && (
                  <div className="ml-4 p-3 bg-gray-800/50 rounded-lg">
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Unfilled Wait Time (seconds)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={unfilledWaitTime}
                      onChange={(e) => setUnfilledWaitTime(parseInt(e.target.value) || 30)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>
                )}

                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800">
                  <div>
                    <p className="text-sm font-medium text-white">Update Entry on Confirm</p>
                    <p className="text-xs text-gray-500 mt-0.5">Refresh entry price when confirming trade</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={updateEntryOnConfirm}
                    onChange={(e) => setUpdateEntryOnConfirm(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800">
                  <div>
                    <p className="text-sm font-medium text-white">Copy Report to Clipboard</p>
                    <p className="text-xs text-gray-500 mt-0.5">Auto-copy trade report after execution</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={copyReportToClipboard}
                    onChange={(e) => setCopyReportToClipboard(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            {/* Risk Management */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4">Risk Management</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Max Risk Multiplier
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={maxRiskMultiplier}
                    onChange={(e) => setMaxRiskMultiplier(parseFloat(e.target.value) || 2.0)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum allowed risk multiple</p>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Fee Buffer (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={feeBuffer}
                    onChange={(e) => setFeeBuffer(parseFloat(e.target.value) || 0.05)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Extra buffer for trading fees</p>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    PnL Tolerance (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={pnlTolerance}
                    onChange={(e) => setPnlTolerance(parseFloat(e.target.value) || 0.10)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Allowed PnL deviation</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Liquidation Warning Distance ($)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={liqWarningDistance}
                    onChange={(e) => setLiqWarningDistance(parseInt(e.target.value) || 300)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Show warning when liq price is close</p>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Liquidation Danger Distance ($)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={liqDangerDistance}
                    onChange={(e) => setLiqDangerDistance(parseInt(e.target.value) || 100)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Block trade when liq price is too close</p>
                </div>
              </div>
            </div>

            {/* Extension Settings */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4">TradingView Extension</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800">
                  <div>
                    <p className="text-sm font-medium text-white">Extension Enabled</p>
                    <p className="text-xs text-gray-500 mt-0.5">Allow trades from TradingView extension</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={extensionEnabled}
                    onChange={(e) => setExtensionEnabled(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800">
                  <div>
                    <p className="text-sm font-medium text-white">Skip Confirmation</p>
                    <p className="text-xs text-gray-500 mt-0.5">Execute trades immediately without confirm dialog</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={extensionSkipConfirm}
                    onChange={(e) => setExtensionSkipConfirm(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
