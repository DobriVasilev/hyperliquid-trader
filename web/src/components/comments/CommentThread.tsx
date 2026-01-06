"use client";

import { useState } from "react";
import { CommentInput } from "./CommentInput";
import { PatternComment } from "@/hooks/useSession";

interface CommentThreadProps {
  comment: PatternComment;
  onReply: (content: string, parentId: string) => Promise<void>;
  onResolve: (commentId: string, resolved: boolean) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onNavigateToDetection?: (detectionId: string) => void;
  currentUserId?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function CommentThread({
  comment,
  onReply,
  onResolve,
  onDelete,
  onNavigateToDetection,
  currentUserId,
}: CommentThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleReply = async (content: string) => {
    await onReply(content, comment.id);
    setShowReplyInput(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this comment?")) return;
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const isOwner = currentUserId === comment.user.id;

  return (
    <div className={`${comment.resolved ? "opacity-60" : ""}`}>
      {/* Main comment */}
      <div className="flex gap-2">
        {comment.user.image ? (
          <img
            src={comment.user.image}
            alt={comment.user.name || ""}
            className="w-6 h-6 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-700 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-200">
              {comment.user.name || "Anonymous"}
            </span>
            <span className="text-xs text-gray-500">
              {formatDate(comment.createdAt)}
            </span>
            {comment.detectionId && onNavigateToDetection && (
              <button
                onClick={() => onNavigateToDetection(comment.detectionId!)}
                className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800/50 transition-colors flex items-center gap-1"
                title="Go to detection on chart"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Go to
              </button>
            )}
            {comment.resolved && (
              <span className="text-xs px-1.5 py-0.5 bg-green-900 text-green-300 rounded">
                resolved
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2 text-xs">
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              Reply
            </button>
            {!comment.resolved && (
              <button
                onClick={() => onResolve(comment.id, true)}
                className="text-gray-500 hover:text-green-400 transition-colors"
              >
                Resolve
              </button>
            )}
            {comment.resolved && (
              <button
                onClick={() => onResolve(comment.id, false)}
                className="text-gray-500 hover:text-yellow-400 transition-colors"
              >
                Unresolve
              </button>
            )}
            {isOwner && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>

          {/* Reply input */}
          {showReplyInput && (
            <div className="mt-3">
              <CommentInput
                onSubmit={handleReply}
                placeholder="Write a reply..."
                autoFocus
                showCancel
                onCancel={() => setShowReplyInput(false)}
              />
            </div>
          )}

          {/* Replies - Note: This would need replies data from the API */}
        </div>
      </div>
    </div>
  );
}
