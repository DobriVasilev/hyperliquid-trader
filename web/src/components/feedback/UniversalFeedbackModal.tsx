"use client";

import { useState } from "react";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  Zap,
  HelpCircle,
  MoreHorizontal,
  X,
  Upload,
  Mic,
  Send,
} from "lucide-react";

interface UniversalFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  initialType?: string;
  initialContext?: {
    pageUrl?: string;
    pagePath?: string;
  };
}

type FeedbackType =
  | "BUG_REPORT"
  | "FEATURE_REQUEST"
  | "UI_UX_ISSUE"
  | "PERFORMANCE_ISSUE"
  | "QUESTION"
  | "OTHER";

const FEEDBACK_TYPES: Array<{
  type: FeedbackType;
  label: string;
  icon: any;
  description: string;
}> = [
  {
    type: "BUG_REPORT",
    label: "Bug Report",
    icon: Bug,
    description: "Something isn't working correctly",
  },
  {
    type: "FEATURE_REQUEST",
    label: "Feature Request",
    icon: Lightbulb,
    description: "Suggest a new feature or improvement",
  },
  {
    type: "UI_UX_ISSUE",
    label: "UI/UX Issue",
    icon: MessageSquare,
    description: "Interface design or usability problem",
  },
  {
    type: "PERFORMANCE_ISSUE",
    label: "Performance",
    icon: Zap,
    description: "Something is slow or laggy",
  },
  {
    type: "QUESTION",
    label: "Question",
    icon: HelpCircle,
    description: "Ask a question or get help",
  },
  {
    type: "OTHER",
    label: "Other",
    icon: MoreHorizontal,
    description: "Anything else",
  },
];

export function UniversalFeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  initialType,
  initialContext,
}: UniversalFeedbackModalProps) {
  const [step, setStep] = useState<"type" | "details">("type");
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(
    (initialType as FeedbackType) || null
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Additional fields for bug reports
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!selectedType || !description) return;

    setSubmitting(true);

    try {
      // Get current context
      const context = {
        pageUrl: initialContext?.pageUrl || window.location.href,
        pagePath: initialContext?.pagePath || window.location.pathname,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      };

      // Create feedback
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          title,
          textContent: description,
          priority,
          stepsToReproduce:
            selectedType === "BUG_REPORT" ? stepsToReproduce : null,
          expectedBehavior:
            selectedType === "BUG_REPORT" ? expectedBehavior : null,
          actualBehavior:
            selectedType === "BUG_REPORT" ? actualBehavior : null,
          ...context,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Upload attachments if any
        if (attachments.length > 0) {
          const formData = new FormData();
          attachments.forEach((file) => formData.append("files", file));

          await fetch(`/api/feedback/${data.id}/attachments`, {
            method: "POST",
            body: formData,
          });
        }

        // Reset form
        setTitle("");
        setDescription("");
        setPriority(0);
        setStepsToReproduce("");
        setExpectedBehavior("");
        setActualBehavior("");
        setAttachments([]);
        setStep("type");
        setSelectedType(null);

        onSubmit?.();
        onClose();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Submit Feedback</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "type" && (
            <div className="space-y-3">
              <p className="text-gray-400 mb-6">
                What would you like to share with us?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {FEEDBACK_TYPES.map((feedbackType) => {
                  const Icon = feedbackType.icon;
                  return (
                    <button
                      key={feedbackType.type}
                      onClick={() => {
                        setSelectedType(feedbackType.type);
                        setStep("details");
                      }}
                      className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-left transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-white group-hover:text-blue-400 transition-colors">
                            {feedbackType.label}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {feedbackType.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "details" && selectedType && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("type")}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                ← Change type
              </button>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue or request"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide detailed information..."
                  rows={6}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Bug Report specific fields */}
              {selectedType === "BUG_REPORT" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Steps to Reproduce
                    </label>
                    <textarea
                      value={stepsToReproduce}
                      onChange={(e) => setStepsToReproduce(e.target.value)}
                      placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                      rows={4}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Expected Behavior
                      </label>
                      <textarea
                        value={expectedBehavior}
                        onChange={(e) => setExpectedBehavior(e.target.value)}
                        placeholder="What should happen?"
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Actual Behavior
                      </label>
                      <textarea
                        value={actualBehavior}
                        onChange={(e) => setActualBehavior(e.target.value)}
                        placeholder="What actually happens?"
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Normal</option>
                  <option value={1}>High</option>
                  <option value={2}>Urgent</option>
                </select>
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Attachments (optional)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-400 hover:bg-gray-700 transition-colors cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">
                      {attachments.length > 0
                        ? `${attachments.length} file(s) selected`
                        : "Upload screenshots or files"}
                    </span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,video/*,.pdf,.doc,.docx"
                    />
                  </label>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!description || submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
