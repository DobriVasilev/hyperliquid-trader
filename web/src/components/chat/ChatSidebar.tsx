"use client";

import { useChat } from "@/contexts/ChatContext";
import { ChatCore } from "./ChatCore";
import { useEffect } from "react";

export function ChatSidebar() {
  const { isOpen, isPinned, setIsOpen, toggleChat, togglePin } = useChat();

  // Keyboard shortcut: Cmd/Ctrl + K to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleChat]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - only show when unpinned */}
      {!isPinned && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full z-50 bg-gray-950 shadow-2xl border-l border-gray-800 flex flex-col transition-all duration-300 ease-out ${
          isPinned
            ? "w-[400px] lg:w-[500px]"
            : "w-[90vw] sm:w-[500px] animate-in slide-in-from-right duration-300"
        }`}
      >
        {/* Header with pin/unpin and close buttons */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white">AI Assistant</h2>
              <p className="text-xs text-gray-400">Cmd/Ctrl + K to toggle</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pin/Unpin button */}
            <button
              onClick={togglePin}
              className={`p-2 rounded-lg transition-colors ${
                isPinned
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-800 text-gray-400"
              }`}
              title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isPinned ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                )}
              </svg>
            </button>

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Close chat"
            >
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat content */}
        <div className="flex-1 overflow-hidden">
          <ChatCore showHeader={false} className="h-full" />
        </div>
      </div>

      {/* Push content when pinned */}
      {isPinned && (
        <div className="fixed inset-0 right-[400px] lg:right-[500px] pointer-events-none" />
      )}
    </>
  );
}
