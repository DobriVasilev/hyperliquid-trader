"use client";

import { useState, useEffect } from "react";

export function TradingSettingsPanel() {
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Google Sheets webhook URL
  const [webhookUrl, setWebhookUrl] = useState("");
  const [editingWebhook, setEditingWebhook] = useState(false);
  const [tempWebhookUrl, setTempWebhookUrl] = useState("");
  const [loadingWebhook, setLoadingWebhook] = useState(true);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Load webhook URL from preferences
  useEffect(() => {
    async function loadWebhookUrl() {
      try {
        const res = await fetch("/api/user/settings");
        const data = await res.json();
        if (data.success && data.data?.googleSheetsWebhookUrl) {
          setWebhookUrl(data.data.googleSheetsWebhookUrl);
        }
      } catch (error) {
        console.error("Failed to load webhook URL:", error);
      } finally {
        setLoadingWebhook(false);
      }
    }
    loadWebhookUrl();
  }, []);

  const handleSaveWebhook = async () => {
    if (!tempWebhookUrl.trim()) {
      alert("Please enter a webhook URL");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleSheetsWebhookUrl: tempWebhookUrl.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setWebhookUrl(tempWebhookUrl.trim());
        setEditingWebhook(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      } else {
        throw new Error(data.error || "Failed to save");
      }
    } catch (error) {
      console.error("Failed to save webhook URL:", error);
      alert("Failed to save webhook URL");
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      alert("Please save a webhook URL first");
      return;
    }

    setTestingWebhook(true);
    try {
      const res = await fetch("/api/user/google-sheets/test", {
        method: "POST",
      });

      const data = await res.json();
      if (data.success) {
        alert("✅ Test successful! Check your Google Sheet for the test entry.");
      } else {
        throw new Error(data.error || "Test failed");
      }
    } catch (error) {
      console.error("Failed to test webhook:", error);
      alert("❌ Test failed. Check your webhook URL and Apps Script deployment.");
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleRemoveWebhook = async () => {
    if (!confirm("Remove Google Sheets integration?")) return;

    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleSheetsWebhookUrl: null }),
      });

      if (res.ok) {
        setWebhookUrl("");
        setTempWebhookUrl("");
      }
    } catch (error) {
      console.error("Failed to remove webhook:", error);
      alert("Failed to remove webhook");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Google Sheets Export
        </h3>
        {showSuccess && (
          <p className="text-xs text-green-400 mt-1">Saved successfully</p>
        )}
      </div>

      {/* Google Sheets Integration */}
      <div className="p-4 space-y-3">
        <div className="text-xs text-gray-500 uppercase font-medium mb-2">Google Sheets Webhook</div>

        {loadingWebhook ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : webhookUrl && !editingWebhook ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-400">Webhook configured</span>
            </div>

            <div className="text-xs text-gray-400 font-mono truncate bg-gray-800 px-2 py-1 rounded">
              {webhookUrl}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleTestWebhook}
                disabled={testingWebhook}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                {testingWebhook ? "Testing..." : "Test"}
              </button>
              <button
                onClick={() => {
                  setTempWebhookUrl(webhookUrl);
                  setEditingWebhook(true);
                }}
                className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleRemoveWebhook}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="url"
              value={tempWebhookUrl}
              onChange={(e) => setTempWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-2">
              <button
                onClick={handleSaveWebhook}
                disabled={saving || !tempWebhookUrl.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {editingWebhook && (
                <button
                  onClick={() => {
                    setEditingWebhook(false);
                    setTempWebhookUrl("");
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-400">How to setup</summary>
          <ol className="list-decimal list-inside mt-2 space-y-1 text-gray-600">
            <li>Create a Google Sheet with your trading template</li>
            <li>Go to Extensions → Apps Script</li>
            <li>Paste the doPost() script (see docs)</li>
            <li>Deploy as Web App (Execute as: Me, Access: Anyone)</li>
            <li>Copy the deployment URL and paste it above</li>
          </ol>
        </details>
      </div>
    </div>
  );
}
