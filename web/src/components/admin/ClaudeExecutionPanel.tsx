"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  TrendingUp,
  Play,
  Eye,
  GitCommit,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface ExecutionStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  successRate: number;
  pendingCorrections: number;
}

interface RunningExecution {
  id: string;
  workspaceId: string;
  workspaceName: string;
  patternType: string;
  status: string;
  phase: string | null;
  progress: number;
  triggeredAt: string;
  sessionCount: number;
}

interface RecentExecution {
  id: string;
  workspaceId: string;
  workspaceName: string;
  patternType: string;
  category: string;
  status: string;
  phase: string | null;
  progress: number;
  triggeredAt: string;
  completedAt: string | null;
  erroredAt: string | null;
  sessionCount: number;
  filesChanged: string[];
  commitHash: string | null;
  deployStatus: string | null;
  triggeredBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface RecentFailure {
  id: string;
  workspaceId: string;
  workspaceName: string;
  patternType: string;
  error: string | null;
  retryCount: number;
  erroredAt: string | null;
}

interface Performance {
  avgExecutionTimeMinutes: number;
  last24h: number;
  last7d: number;
}

interface ClaudeExecutionData {
  stats: ExecutionStats;
  runningExecutions: RunningExecution[];
  recentExecutions: RecentExecution[];
  recentFailures: RecentFailure[];
  performance: Performance;
}

export function ClaudeExecutionPanel() {
  const [data, setData] = useState<ClaudeExecutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/admin/claude-executions");
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || "Failed to load execution data");
        }
      } catch (err) {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
        {error || "Failed to load execution data"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-purple-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">Claude Code Executions</h2>
            <p className="text-sm text-gray-400">Autonomous pattern implementation workflow</p>
          </div>
        </div>
        {data.stats.pendingCorrections > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-400" />
            <span className="text-white font-medium">{data.stats.pendingCorrections} pending corrections</span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <div className="text-3xl font-bold text-white">{data.stats.pending}</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <Activity className="w-5 h-5 animate-pulse" />
            <span className="text-sm font-medium">Running</span>
          </div>
          <div className="text-3xl font-bold text-white">{data.stats.running}</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Completed</span>
          </div>
          <div className="text-3xl font-bold text-white">{data.stats.completed}</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Failed</span>
          </div>
          <div className="text-3xl font-bold text-white">{data.stats.failed}</div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Last 24 Hours</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.performance.last24h}</div>
          <div className="text-xs text-gray-500 mt-1">Executions</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Last 7 Days</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.performance.last7d}</div>
          <div className="text-xs text-gray-500 mt-1">Executions</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Avg Time</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.performance.avgExecutionTimeMinutes}m</div>
          <div className="text-xs text-gray-500 mt-1">Per execution</div>
        </div>
      </div>

      {/* Success Rate */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="font-semibold text-white mb-4">Success Rate</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all duration-500"
              style={{ width: `${data.stats.successRate}%` }}
            />
          </div>
          <span className="text-2xl font-bold text-white">{data.stats.successRate}%</span>
        </div>
        <div className="text-sm text-gray-400 mt-2">
          {data.stats.completed} completed, {data.stats.failed} failed
        </div>
      </div>

      {/* Running Executions */}
      {data.runningExecutions.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-yellow-400 animate-pulse" />
            Currently Running ({data.runningExecutions.length})
          </h3>
          <div className="space-y-3">
            {data.runningExecutions.map((exec) => (
              <div key={exec.id} className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-white text-sm">{exec.workspaceName}</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      {exec.patternType} · {exec.sessionCount} session{exec.sessionCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Link
                    href={`/workspace/${exec.workspaceId}`}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </Link>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{exec.phase || "initializing"}</span>
                    <span className="text-white font-medium">{exec.progress}%</span>
                  </div>
                  <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-yellow-500 h-full transition-all duration-500"
                      style={{ width: `${exec.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Executions */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="font-semibold text-white mb-4">Recent Executions</h3>
        <div className="space-y-3">
          {data.recentExecutions.map((exec) => {
            const statusColor =
              exec.status === "completed"
                ? "text-green-400"
                : exec.status === "failed"
                ? "text-red-400"
                : exec.status === "running"
                ? "text-yellow-400"
                : "text-gray-400";

            const statusBg =
              exec.status === "completed"
                ? "bg-green-900/10 border-green-800/30"
                : exec.status === "failed"
                ? "bg-red-900/10 border-red-800/30"
                : exec.status === "running"
                ? "bg-yellow-900/10 border-yellow-800/30"
                : "bg-gray-800/50 border-gray-700/30";

            return (
              <div key={exec.id} className={`border rounded-lg p-4 ${statusBg}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white text-sm">{exec.workspaceName}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColor} bg-gray-800/50`}>
                        {exec.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {exec.category} · {exec.sessionCount} session{exec.sessionCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {exec.commitHash && (
                      <Link
                        href={`https://github.com/DobriVasilev/systems-trader/commit/${exec.commitHash}`}
                        target="_blank"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <GitCommit className="w-3 h-3" />
                        {exec.commitHash.slice(0, 7)}
                      </Link>
                    )}
                    <Link
                      href={`/workspace/${exec.workspaceId}/execution/${exec.id}`}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Link>
                  </div>
                </div>

                {exec.filesChanged.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    Changed {exec.filesChanged.length} file{exec.filesChanged.length !== 1 ? "s" : ""}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Triggered {new Date(exec.triggeredAt).toLocaleString()}</span>
                  {exec.completedAt && (
                    <span>
                      Completed in{" "}
                      {Math.round(
                        (new Date(exec.completedAt).getTime() - new Date(exec.triggeredAt).getTime()) / 1000 / 60
                      )}
                      m
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Failures */}
      {data.recentFailures.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            Recent Failures
          </h3>
          <div className="space-y-3">
            {data.recentFailures.map((failure) => (
              <div key={failure.id} className="bg-red-900/10 border border-red-800/30 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-white text-sm">{failure.workspaceName}</h4>
                  <span className="text-xs text-gray-500">
                    {failure.erroredAt && new Date(failure.erroredAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-red-400 mb-2">{failure.error || "Unknown error"}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Retry count: {failure.retryCount}</span>
                  <Link
                    href={`/workspace/${failure.workspaceId}/execution/${failure.id}`}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View details <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
