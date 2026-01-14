"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@/contexts/ChatContext";
import { VoiceRecorder } from "./VoiceRecorder";
import ReactMarkdown from "react-markdown";

interface ChatCoreProps {
  className?: string;
  showHeader?: boolean;
}

export function ChatCore({ className = "", showHeader = true }: ChatCoreProps) {
  const {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
  } = useChat();

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    await sendMessage(inputValue.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceComplete = async (audioBlob: Blob, duration: number) => {
    setIsRecordingVoice(false);

    try {
      // Upload audio file
      const formData = new FormData();
      formData.append("file", audioBlob, "voice-message.webm");

      const uploadResponse = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error || "Failed to upload audio");
      }

      const audioUrl = uploadData.data.url;

      // Transcribe audio
      const transcribeResponse = await fetch("/api/chat/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl }),
      });

      const transcribeData = await transcribeResponse.json();

      if (!transcribeData.success) {
        throw new Error(transcribeData.error || "Failed to transcribe audio");
      }

      const transcription = transcribeData.data.transcription;

      // Send message with transcription
      await sendMessage(transcription, true, audioUrl, transcription);
    } catch (error) {
      console.error("Error processing voice message:", error);
      alert("Failed to process voice message. Please try again.");
    }
  };

  return (
    <div className={`flex flex-col h-full bg-gray-950 ${className}`}>
      {/* Header */}
      {showHeader && (
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
              <p className="text-xs text-gray-400">Always here to help</p>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Clear chat"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-white"
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
            <h3 className="text-lg font-semibold text-white mb-2">
              Hi! I'm your AI assistant
            </h3>
            <p className="text-sm text-gray-400 max-w-sm">
              Ask me anything about your trading system, or just chat! I can help with
              analysis, explanations, and general questions.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-100"
                  }`}
                >
                  {message.isVoice && message.voiceUrl && (
                    <div className="mb-2">
                      <audio controls src={message.voiceUrl} className="w-full" />
                      {message.transcription && (
                        <p className="text-xs opacity-70 mt-1 italic">
                          "{message.transcription}"
                        </p>
                      )}
                    </div>
                  )}
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  <div className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900">
        {isRecordingVoice ? (
          <VoiceRecorder
            onSend={handleVoiceComplete}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <div className="flex items-end gap-2">
            <button
              onClick={() => setIsRecordingVoice(true)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              title="Voice message"
            >
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Shift+Enter for new line)"
              className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
              rows={1}
              disabled={isLoading}
            />

            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors flex-shrink-0"
              title="Send message"
            >
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
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
