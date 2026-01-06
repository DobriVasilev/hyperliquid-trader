"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ShareUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface SearchUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  hasDM: boolean; // Has direct message history
  isFriend: boolean; // Added as friend/contact
}

interface Share {
  id: string;
  userId: string;
  permission: string;
  user: ShareUser;
  createdAt: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  isOwner: boolean;
  isPublic: boolean;
}

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  view: { label: "View", description: "Can view the session and detections" },
  comment: { label: "Comment", description: "Can view and add comments" },
  edit: { label: "Edit", description: "Can make corrections and changes" },
  admin: { label: "Admin", description: "Full access, can share with others" },
};

export function ShareModal({
  isOpen,
  onClose,
  sessionId,
  isOwner,
  isPublic: initialIsPublic,
}: ShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [permission, setPermission] = useState("view");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [copySuccess, setCopySuccess] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchShares = useCallback(async () => {
    if (!isOwner) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`);
      const data = await response.json();

      if (data.success) {
        setShares(data.data);
      }
    } catch (err) {
      console.error("Error fetching shares:", err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isOwner]);

  useEffect(() => {
    if (isOpen) {
      fetchShares();
      setSearchQuery("");
      setSelectedUser(null);
      setSearchResults([]);
    }
  }, [isOpen, fetchShares]);

  // Search for users
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/chat/users?search=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();

      if (data.success) {
        // Filter out already shared users
        const sharedUserIds = new Set(shares.map(s => s.userId));
        const filtered = data.data.filter((u: SearchUser) => !sharedUserIds.has(u.id));

        // Sort: DM history first, then friends, then alphabetically
        filtered.sort((a: SearchUser, b: SearchUser) => {
          if (a.hasDM && !b.hasDM) return -1;
          if (!a.hasDM && b.hasDM) return 1;
          if (a.isFriend && !b.isFriend) return -1;
          if (!a.isFriend && b.isFriend) return 1;
          return (a.name || a.email).localeCompare(b.name || b.email);
        });

        setSearchResults(filtered);
        setShowSearchResults(true);
      }
    } catch (err) {
      console.error("Error searching users:", err);
    } finally {
      setIsSearching(false);
    }
  }, [shares]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedUser(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  const handleUserSelect = (user: SearchUser) => {
    setSelectedUser(user);
    setSearchQuery(user.name || user.email);
    setShowSearchResults(false);
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();

    // If we have a selected user, share with them
    // Otherwise, try to share by email
    const shareTarget = selectedUser
      ? { userId: selectedUser.id }
      : { email: searchQuery.trim() };

    if (!selectedUser && !searchQuery.trim()) return;

    setIsSharing(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...shareTarget, permission }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      setSearchQuery("");
      setSelectedUser(null);
      setSearchResults([]);
      fetchShares();
    } catch (err) {
      setError("Failed to share session");
      console.error(err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/share?userId=${userId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (data.success) {
        setShares((prev) => prev.filter((s) => s.userId !== userId));
      }
    } catch (err) {
      console.error("Error removing share:", err);
    }
  };

  const handleTogglePublic = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !isPublic }),
      });

      const data = await response.json();

      if (data.success) {
        setIsPublic(data.data.isPublic);
      }
    } catch (err) {
      console.error("Error toggling public status:", err);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/sessions/${sessionId}`;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Share Session</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Copy Link */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/sessions/${sessionId}`}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
            />
            <button
              onClick={copyLink}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              {copySuccess ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Public Toggle */}
          {isOwner && (
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div>
                <div className="text-sm font-medium">Public Access</div>
                <div className="text-xs text-gray-500">
                  Anyone with the link can view
                </div>
              </div>
              <button
                onClick={handleTogglePublic}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isPublic ? "bg-green-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isPublic ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Share Form */}
          {isOwner && (
            <form onSubmit={handleShare} className="space-y-3">
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search users or enter email..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {selectedUser && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <select
                    value={permission}
                    onChange={(e) => setPermission(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(PERMISSION_LABELS).map(([value, { label }]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleUserSelect(user)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-700/50 transition-colors text-left"
                      >
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name || ""}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm font-medium">
                            {(user.name || user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {user.name || user.email}
                            </span>
                            {user.hasDM && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                Recent
                              </span>
                            )}
                            {user.isFriend && !user.hasDM && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                                Contact
                              </span>
                            )}
                          </div>
                          {user.name && (
                            <div className="text-xs text-gray-500 truncate">{user.email}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-3">
                    <p className="text-sm text-gray-400">
                      No users found. You can still share by entering their email address.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSharing || (!selectedUser && !searchQuery.trim())}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                         hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSharing ? "Sharing..." : selectedUser ? `Share with ${selectedUser.name || selectedUser.email}` : "Share"}
              </button>
            </form>
          )}

          {/* Current Shares */}
          {isOwner && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Shared with ({shares.length})
              </h3>
              {isLoading ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Loading...
                </div>
              ) : shares.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Not shared with anyone yet
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {share.user.image ? (
                          <img
                            src={share.user.image}
                            alt={share.user.name || ""}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm">
                            {(share.user.name || share.user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium">
                            {share.user.name || share.user.email}
                          </div>
                          <div className="text-xs text-gray-500">
                            {PERMISSION_LABELS[share.permission]?.label || share.permission}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveShare(share.userId)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
