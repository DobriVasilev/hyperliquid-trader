"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isVoice?: boolean;
  voiceUrl?: string;
  transcription?: string;
}

interface ChatContextType {
  // State
  messages: Message[];
  isOpen: boolean;
  isPinned: boolean;
  isLoading: boolean;
  inputValue: string;

  // Actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setIsOpen: (isOpen: boolean) => void;
  setIsPinned: (isPinned: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setInputValue: (value: string) => void;
  toggleChat: () => void;
  togglePin: () => void;
  clearChat: () => void;
  sendMessage: (content: string, isVoice?: boolean, voiceUrl?: string, transcription?: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chat-isOpen");
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chat-isPinned");
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Persist isOpen state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chat-isOpen", JSON.stringify(isOpen));
    }
  }, [isOpen]);

  // Persist isPinned state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chat-isPinned", JSON.stringify(isPinned));
    }
  }, [isPinned]);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev: boolean) => !prev);
  }, []);

  const togglePin = useCallback(() => {
    setIsPinned((prev: boolean) => !prev);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setInputValue("");
  }, []);

  const sendMessage = useCallback(
    async (content: string, isVoice = false, voiceUrl?: string, transcription?: string) => {
      // Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
        isVoice,
        voiceUrl,
        transcription,
      };
      addMessage(userMessage);

      // Clear input
      setInputValue("");
      setIsLoading(true);

      try {
        // Call chat API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            history: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        const data = await response.json();

        if (data.success) {
          // Add assistant response
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.data.response,
            timestamp: new Date(),
          };
          addMessage(assistantMessage);
        } else {
          throw new Error(data.error || "Failed to send message");
        }
      } catch (error) {
        console.error("Error sending message:", error);
        // Add error message
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        };
        addMessage(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, addMessage]
  );

  const value: ChatContextType = {
    // State
    messages,
    isOpen,
    isPinned,
    isLoading,
    inputValue,

    // Actions
    setMessages,
    addMessage,
    setIsOpen,
    setIsPinned,
    setIsLoading,
    setInputValue,
    toggleChat,
    togglePin,
    clearChat,
    sendMessage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
