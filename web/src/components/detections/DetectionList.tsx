"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PatternDetection } from "@/hooks/useSession";

interface DetectionListProps {
  detections: PatternDetection[];
  onConfirm: (detection: PatternDetection) => void;
  onModify: (detection: PatternDetection) => void;
  onDelete: (detection: PatternDetection) => void;
}

interface Filters {
  search: string;
  type: "all" | "swing_high" | "swing_low";
  status: "all" | "pending" | "confirmed" | "rejected";
  dateFrom: string;
  dateTo: string;
  priceMin: string;
  priceMax: string;
}

const INITIAL_DISPLAY = 20;
const LOAD_MORE_COUNT = 20;

export function DetectionList({ detections, onConfirm, onModify, onDelete }: DetectionListProps) {
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    type: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
    priceMin: "",
    priceMax: "",
  });

  const listRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter detections
  const filteredDetections = detections.filter((d) => {
    // Search filter (ID, type)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!d.id.toLowerCase().includes(searchLower) &&
          !d.detectionType.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Type filter
    if (filters.type !== "all" && d.detectionType !== filters.type) {
      return false;
    }

    // Status filter
    if (filters.status !== "all" && d.status !== filters.status) {
      return false;
    }

    // Date filter
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      const detectionDate = new Date(d.candleTime).getTime();
      if (detectionDate < from) return false;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86400000; // Include end date
      const detectionDate = new Date(d.candleTime).getTime();
      if (detectionDate > to) return false;
    }

    // Price filter
    if (filters.priceMin && d.price < parseFloat(filters.priceMin)) {
      return false;
    }
    if (filters.priceMax && d.price > parseFloat(filters.priceMax)) {
      return false;
    }

    return true;
  });

  const displayedDetections = filteredDetections.slice(0, displayCount);
  const hasMore = displayCount < filteredDetections.length;

  // Infinite scroll using IntersectionObserver
  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
        }
      },
      { threshold: 0.1, root: listRef.current }
    );

    const loadMoreEl = loadMoreRef.current;
    if (loadMoreEl) {
      observer.observe(loadMoreEl);
    }

    return () => {
      if (loadMoreEl) {
        observer.unobserve(loadMoreEl);
      }
    };
  }, [hasMore, displayCount]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY);
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      search: "",
      type: "all",
      status: "all",
      dateFrom: "",
      dateTo: "",
      priceMin: "",
      priceMax: "",
    });
  };

  const hasActiveFilters = filters.search || filters.type !== "all" || filters.status !== "all" ||
    filters.dateFrom || filters.dateTo || filters.priceMin || filters.priceMax;

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and filter toggle */}
      <div className="p-4 border-b border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">
            Detections ({filteredDetections.length}
            {hasActiveFilters && ` of ${detections.length}`})
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              showFilters || hasActiveFilters
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search by ID or type..."
            className="w-full px-3 py-2 pl-8 bg-gray-800 border border-gray-700 rounded-lg
                     text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <svg className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="space-y-3 pt-2">
            {/* Type and Status row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value as Filters["type"] })}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded
                           text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="swing_high">Swing High</option>
                  <option value="swing_low">Swing Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters["status"] })}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded
                           text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Date range */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded
                           text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded
                           text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Price range */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Price Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={filters.priceMin}
                  onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                  placeholder="Min"
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded
                           text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={filters.priceMax}
                  onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                  placeholder="Max"
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded
                           text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Detection list with scroll */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {displayedDetections.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {hasActiveFilters ? "No detections match filters" : "No detections"}
            </div>
          ) : (
            displayedDetections.map((d) => (
              <div
                key={d.id}
                className="text-sm p-2 rounded-lg hover:bg-gray-800/50 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        d.status === "rejected"
                          ? "bg-gray-500"
                          : d.status === "confirmed"
                          ? "bg-blue-500"
                          : d.detectionType.includes("high")
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span
                      className={`capitalize ${
                        d.status === "rejected"
                          ? "text-gray-500 line-through"
                          : "text-gray-300"
                      }`}
                    >
                      {d.detectionType.replace("_", " ")}
                    </span>
                    {d.status === "confirmed" && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-900 text-blue-300 rounded">
                        confirmed
                      </span>
                    )}
                    {d.status === "rejected" && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-900 text-red-300 rounded">
                        deleted
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs">
                    ${d.price.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {new Date(d.candleTime).toLocaleString()}
                </div>
                {/* Action buttons - show on hover */}
                {d.status === "pending" && (
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onConfirm(d)}
                      className="flex-1 px-2 py-1 text-xs bg-blue-600/20 text-blue-400
                               hover:bg-blue-600/30 rounded transition-colors"
                      title="Confirm detection"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => onModify(d)}
                      className="flex-1 px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400
                               hover:bg-yellow-600/30 rounded transition-colors"
                      title="Modify detection"
                    >
                      Modify
                    </button>
                    <button
                      onClick={() => onDelete(d)}
                      className="flex-1 px-2 py-1 text-xs bg-red-600/20 text-red-400
                               hover:bg-red-600/30 rounded transition-colors"
                      title="Delete detection"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          {hasMore && (
            <div ref={loadMoreRef} className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                Loading more... ({displayedDetections.length} of {filteredDetections.length})
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
