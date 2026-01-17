"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  PlayCircle,
} from "lucide-react";

interface QueueItem {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  executionId?: string;
  workspaceId?: string;
  patternType?: string;
  patternName?: string;
  sessionCount?: number;
  retryCount?: number;
}

interface QueueData {
  stats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retry: number;
  };
  items: {
    pending: QueueItem[];
    processing: QueueItem[];
    completed: QueueItem[];
    failed: QueueItem[];
    retry: QueueItem[];
  };
}

export function QueueManagementPanel() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "pending" | "processing" | "failed" | "retry" | "completed"
  >("pending");

  async function fetchQueue() {
    try {
      const res = await fetch("/api/admin/queue");
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch queue:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  async function handleRetry(executionId: string) {
    try {
      const res = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", executionId }),
      });

      const result = await res.json();
      if (result.success) {
        fetchQueue(); // Refresh
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to retry:", error);
      alert("Failed to retry execution");
    }
  }

  async function handleCancel(executionId: string) {
    if (!confirm("Are you sure you want to cancel this queue item?")) {
      return;
    }

    try {
      const res = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", executionId }),
      });

      const result = await res.json();
      if (result.success) {
        fetchQueue(); // Refresh
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to cancel:", error);
      alert("Failed to cancel execution");
    }
  }

  async function handleClearCompleted() {
    if (!confirm("Clear all completed queue items?")) {
      return;
    }

    try {
      const res = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_completed" }),
      });

      const result = await res.json();
      if (result.success) {
        alert(result.message);
        fetchQueue(); // Refresh
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to clear completed:", error);
      alert("Failed to clear completed items");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-400 py-8">
        Failed to load queue data
      </div>
    );
  }

  const tabs = [
    {
      key: "pending" as const,
      label: "Pending",
      count: data.stats.pending,
      icon: Clock,
      color: "text-blue-400",
    },
    {
      key: "processing" as const,
      label: "Processing",
      count: data.stats.processing,
      icon: PlayCircle,
      color: "text-yellow-400",
    },
    {
      key: "failed" as const,
      label: "Failed",
      count: data.stats.failed,
      icon: XCircle,
      color: "text-red-400",
    },
    {
      key: "retry" as const,
      label: "Retry",
      count: data.stats.retry,
      icon: AlertTriangle,
      color: "text-orange-400",
    },
    {
      key: "completed" as const,
      label: "Completed",
      count: data.stats.completed,
      icon: CheckCircle,
      color: "text-green-400",
    },
  ];

  const activeItems = data.items[activeTab] || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Queue Management</h3>
        <div className="flex gap-2">
          <button
            onClick={() => fetchQueue()}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {activeTab === "completed" && data.stats.completed > 0 && (
            <button
              onClick={handleClearCompleted}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`p-4 rounded-lg border transition-all ${
                activeTab === tab.key
                  ? "bg-gray-800 border-gray-600"
                  : "bg-gray-900 border-gray-800 hover:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${tab.color}`} />
                <span className="text-2xl font-bold text-white">
                  {tab.count}
                </span>
              </div>
              <div className="text-sm text-gray-400">{tab.label}</div>
            </button>
          );
        })}
      </div>

      {/* Queue Items */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        <div className="p-4 border-b border-gray-800">
          <h4 className="font-medium text-white">
            {tabs.find((t) => t.key === activeTab)?.label} Items
          </h4>
        </div>

        <div className="divide-y divide-gray-800">
          {activeItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No {activeTab} items
            </div>
          ) : (
            activeItems.map((item, index) => (
              <div
                key={item.filename || index}
                className="p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h5 className="font-medium text-white">
                        {item.patternName || item.executionId || "Unknown"}
                      </h5>
                      {item.retryCount !== undefined && (
                        <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">
                          Retry {item.retryCount + 1}/3
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-400">
                      {item.patternType && (
                        <div>
                          <span className="text-gray-500">Pattern:</span>{" "}
                          {item.patternType}
                        </div>
                      )}
                      {item.sessionCount !== undefined && (
                        <div>
                          <span className="text-gray-500">Sessions:</span>{" "}
                          {item.sessionCount}
                        </div>
                      )}
                      {item.executionId && (
                        <div>
                          <span className="text-gray-500">Execution ID:</span>{" "}
                          <code className="text-xs">{item.executionId}</code>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Created:</span>{" "}
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {activeTab === "failed" && item.executionId && (
                      <button
                        onClick={() => handleRetry(item.executionId!)}
                        className="px-3 py-1.5 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded flex items-center gap-2 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry
                      </button>
                    )}
                    {(activeTab === "pending" || activeTab === "retry") &&
                      item.executionId && (
                        <button
                          onClick={() => handleCancel(item.executionId!)}
                          className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
