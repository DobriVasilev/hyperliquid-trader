"use client";

import { useRef, useEffect, useCallback, useState, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface Message {
  id: string;
  content: string;
  userName: string;
  userAvatar?: string | null;
  userId: string;
  isVip?: boolean;
  createdAt: string | Date;
  attachments?: Array<{
    url: string;
    type: string;
    name: string;
    size?: number;
  }> | null;
  reactions?: Record<string, string[]>;
  replyTo?: {
    id: string;
    content: string;
    userName: string;
  } | null;
  edited?: boolean;
  pinned?: boolean;
  deleted?: boolean;
}

interface VirtualizedMessageListProps {
  messages: Message[];
  currentUserId?: string;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  renderMessage: (message: Message, index: number) => React.ReactNode;
  estimateSize?: number;
}

// Memoized message wrapper
const MessageWrapper = memo(function MessageWrapper({
  message,
  index,
  renderMessage,
}: {
  message: Message;
  index: number;
  renderMessage: (message: Message, index: number) => React.ReactNode;
}) {
  return <>{renderMessage(message, index)}</>;
});

export function VirtualizedMessageList({
  messages,
  currentUserId,
  onLoadMore,
  hasMore,
  isLoading,
  renderMessage,
  estimateSize = 80,
}: VirtualizedMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevMessageCountRef = useRef(messages.length);
  const loadingRef = useRef(false);

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 10, // Render 10 extra items above/below viewport
    getItemKey: (index) => messages[index].id,
  });

  const items = virtualizer.getVirtualItems();

  // Handle scroll to detect if at bottom and trigger load more
  const handleScroll = useCallback(() => {
    const container = parentRef.current;
    if (!container) return;

    // Check if at bottom (with 100px threshold)
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setIsAtBottom(isNearBottom);

    // Check if at top for loading more (reverse infinite scroll)
    if (container.scrollTop < 200 && hasMore && !isLoading && !loadingRef.current) {
      loadingRef.current = true;
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore]);

  // Reset loading ref when loading completes
  useEffect(() => {
    if (!isLoading) {
      loadingRef.current = false;
    }
  }, [isLoading]);

  // Scroll to bottom on new messages if already at bottom
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && isAtBottom) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isAtBottom, virtualizer]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom function for external use
  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "smooth" });
  }, [virtualizer, messages.length]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {/* Loading indicator at top */}
      {isLoading && hasMore && (
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center py-2 bg-gradient-to-b from-gray-900 to-transparent">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading more messages...
          </div>
        </div>
      )}

      {/* Virtualized scroll container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {items.map((virtualItem) => {
            const message = messages[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <MessageWrapper
                  message={message}
                  index={virtualItem.index}
                  renderMessage={renderMessage}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg transition-all transform hover:scale-105"
          title="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Hook for managing paginated messages
export function usePaginatedMessages(channelId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchMessages = useCallback(
    async (loadMore = false) => {
      if (isLoading) return;

      setIsLoading(true);

      try {
        const params = new URLSearchParams({
          limit: "50",
          ...(channelId && { channelId }),
          ...(loadMore && cursor && { cursor }),
        });

        const response = await fetch(`/api/chat/messages?${params}`);
        if (!response.ok) throw new Error("Failed to fetch messages");

        const data = await response.json();

        if (loadMore) {
          // Prepend older messages
          setMessages((prev) => [...data.data.messages, ...prev]);
        } else {
          // Initial load - reverse to show oldest first
          setMessages(data.data.messages.reverse());
        }

        setHasMore(data.data.hasMore);
        if (data.data.messages.length > 0) {
          // Use the oldest message as cursor for next load
          setCursor(data.data.messages[data.data.messages.length - 1].id);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [channelId, cursor, isLoading]
  );

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchMessages(true);
    }
  }, [fetchMessages, hasMore, isLoading]);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  return {
    messages,
    hasMore,
    isLoading,
    loadMore,
    addMessage,
    updateMessage,
    removeMessage,
    refetch: () => {
      setMessages([]);
      setCursor(null);
      setHasMore(true);
      fetchMessages();
    },
  };
}

// Utility to group messages by date
export function groupMessagesByDate(messages: Message[]): Map<string, Message[]> {
  const groups = new Map<string, Message[]>();

  messages.forEach((message) => {
    const date = new Date(message.createdAt);
    const dateKey = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(message);
  });

  return groups;
}

// Utility to check if messages should be grouped (same user, within 5 minutes)
export function shouldGroupMessages(current: Message, previous: Message | undefined): boolean {
  if (!previous) return false;
  if (current.userId !== previous.userId) return false;

  const currentTime = new Date(current.createdAt).getTime();
  const previousTime = new Date(previous.createdAt).getTime();

  return currentTime - previousTime < 5 * 60 * 1000; // 5 minutes
}
