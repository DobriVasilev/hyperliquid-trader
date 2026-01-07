"use client";

import { useState, useEffect } from "react";

interface RuleEvaluation {
  rule: string;
  passed: boolean;
  details: string;
  comparedValue?: number;
  currentValue?: number;
  comparedIndex?: number;
}

interface SwingEvaluation {
  isPivot: boolean;
  rules: RuleEvaluation[];
  summary: string;
  wouldBeConfirmed?: boolean;
  confirmationDetails?: string;
}

interface EvaluationResult {
  candleIndex: number;
  candle: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  };
  swingHighEvaluation: SwingEvaluation;
  swingLowEvaluation: SwingEvaluation;
  existingDetection?: {
    type: string;
    price: number;
  } | null;
}

interface WhyNoDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  candleIndex: number;
  mode?: "wicks" | "closes";
}

export function WhyNoDetectionModal({
  isOpen,
  onClose,
  sessionId,
  candleIndex,
  mode = "wicks",
}: WhyNoDetectionModalProps) {
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"high" | "low">("high");

  useEffect(() => {
    if (!isOpen) return;

    const fetchEvaluation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/detections/evaluate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candleIndex, mode }),
          }
        );

        const data = await response.json();

        if (data.success) {
          setEvaluation(data.data);
          // Auto-select the tab that's more interesting
          if (data.data.swingLowEvaluation.isPivot && !data.data.swingHighEvaluation.isPivot) {
            setActiveTab("low");
          }
        } else {
          setError(data.error || "Failed to evaluate candle");
        }
      } catch (err) {
        setError("Network error");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvaluation();
  }, [isOpen, sessionId, candleIndex, mode]);

  if (!isOpen) return null;

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderRules = (rules: RuleEvaluation[]) => {
    return (
      <div className="space-y-2">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 p-2 rounded ${
              rule.passed ? "bg-green-900/20" : "bg-red-900/20"
            }`}
          >
            <span className={`text-lg ${rule.passed ? "text-green-400" : "text-red-400"}`}>
              {rule.passed ? "✓" : "✗"}
            </span>
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-sm ${rule.passed ? "text-green-300" : "text-red-300"}`}>
                {rule.rule}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{rule.details}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEvaluation = (eval_: SwingEvaluation, type: "high" | "low") => {
    const isPivot = eval_.isPivot;
    const isConfirmed = eval_.wouldBeConfirmed;
    const typeLabel = type === "high" ? "Swing High" : "Swing Low";
    const typeColor = type === "high" ? "text-red-400" : "text-green-400";

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div
          className={`p-4 rounded-lg border ${
            isPivot
              ? isConfirmed
                ? "bg-yellow-900/20 border-yellow-700"
                : "bg-blue-900/20 border-blue-700"
              : "bg-gray-800/50 border-gray-700"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-lg ${
                isPivot
                  ? isConfirmed
                    ? "text-yellow-400"
                    : "text-blue-400"
                  : "text-gray-400"
              }`}
            >
              {isPivot ? (isConfirmed ? "⚡" : "⏳") : "✗"}
            </span>
            <span className={`font-semibold ${typeColor}`}>{typeLabel}</span>
          </div>
          <p className="text-sm text-gray-300">{eval_.summary}</p>
          {eval_.confirmationDetails && (
            <p className="text-xs text-gray-400 mt-2 italic">
              {eval_.confirmationDetails}
            </p>
          )}
        </div>

        {/* Rule breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Rule Evaluation ({eval_.rules.filter((r) => r.passed).length}/{eval_.rules.length} passed)
          </h4>
          {renderRules(eval_.rules)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Slide-out sidebar on right side - no backdrop to allow chart interaction */}
      {/* top-[105px] accounts for header (52px) + info bar (53px), bottom-[37px] for footer */}
      <div className="fixed top-[105px] right-0 bottom-[37px] z-40 w-[380px] bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 shadow-2xl flex flex-col animate-slide-in-right pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 className="text-sm font-semibold">Why No Detection?</h2>
              {evaluation && (
                <p className="text-xs text-gray-400">
                  Candle #{candleIndex} • {formatTime(evaluation.candle.time)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full" />
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {evaluation && !isLoading && (
            <>
              {/* Existing detection notice */}
              {evaluation.existingDetection && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-green-300 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Detection Exists</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1">
                    This candle has a {evaluation.existingDetection.type.replace("_", " ")} detection at ${evaluation.existingDetection.price.toFixed(2)}
                  </p>
                </div>
              )}

              {/* Candle info - compact grid */}
              <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                <h3 className="text-xs font-medium text-gray-400 mb-2">Candle Data</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Open:</span>
                    <span className="font-mono">${evaluation.candle.open.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">High:</span>
                    <span className="font-mono text-red-400">${evaluation.candle.high.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Low:</span>
                    <span className="font-mono text-green-400">${evaluation.candle.low.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Close:</span>
                    <span className="font-mono">${evaluation.candle.close.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-700 mb-3">
                <button
                  onClick={() => setActiveTab("high")}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab === "high"
                      ? "text-red-400 border-b-2 border-red-400"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Swing High
                  {evaluation.swingHighEvaluation.isPivot && (
                    <span className="ml-1.5 text-[10px] bg-red-900/50 text-red-300 px-1 py-0.5 rounded">
                      PIVOT
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("low")}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab === "low"
                      ? "text-green-400 border-b-2 border-green-400"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Swing Low
                  {evaluation.swingLowEvaluation.isPivot && (
                    <span className="ml-1.5 text-[10px] bg-green-900/50 text-green-300 px-1 py-0.5 rounded">
                      PIVOT
                    </span>
                  )}
                </button>
              </div>

              {/* Evaluation content */}
              {activeTab === "high"
                ? renderEvaluation(evaluation.swingHighEvaluation, "high")
                : renderEvaluation(evaluation.swingLowEvaluation, "low")}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50">
          <p className="text-[10px] text-gray-500 text-center">
            Mode: {mode === "wicks" ? "Wicks" : "Closes"} • Lookback: 3 candles
          </p>
        </div>
      </div>

      {/* CSS for slide-in animation */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
