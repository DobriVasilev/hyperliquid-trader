"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

export interface UserPreferences {
  defaultSymbol: string;
  defaultTimeframe: string;
  swingDetectionMode: "wicks" | "closes";
  emailNotifications: boolean;
  collaborationAlerts: boolean;
  chartTheme: "dark" | "light";
  showVolume: boolean;
  favoriteSymbols: string[];
  favoriteTimeframes: string[];
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultSymbol: "BTC",
  defaultTimeframe: "15m",
  swingDetectionMode: "wicks",
  emailNotifications: false,
  collaborationAlerts: true,
  chartTheme: "dark",
  showVolume: true,
  favoriteSymbols: [],
  favoriteTimeframes: [],
};

export function usePreferences() {
  const { data: session, status } = useSession();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch preferences on mount
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      // Use localStorage for unauthenticated users
      const saved = localStorage.getItem("userPreferences");
      if (saved) {
        try {
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(saved) });
        } catch {
          // Ignore parse errors
        }
      }
      setIsLoading(false);
      return;
    }

    // Fetch from API for authenticated users
    async function fetchPreferences() {
      try {
        const response = await fetch("/api/user/preferences");
        const data = await response.json();

        if (data.success) {
          setPreferences(data.data);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError("Failed to load preferences");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreferences();
  }, [status]);

  // Update a single preference
  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setIsSaving(true);
      setError(null);

      // Optimistic update
      const previousPreferences = preferences;
      setPreferences((prev) => ({ ...prev, [key]: value }));

      try {
        if (status === "unauthenticated") {
          // Save to localStorage for unauthenticated users
          const newPrefs = { ...preferences, [key]: value };
          localStorage.setItem("userPreferences", JSON.stringify(newPrefs));
        } else {
          // Save to API for authenticated users
          const response = await fetch("/api/user/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value }),
          });

          const data = await response.json();

          if (!data.success) {
            // Revert on error
            setPreferences(previousPreferences);
            setError(data.error);
            return false;
          }
        }

        return true;
      } catch (err) {
        // Revert on error
        setPreferences(previousPreferences);
        setError("Failed to save preference");
        console.error(err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [preferences, status]
  );

  // Update multiple preferences at once
  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      setIsSaving(true);
      setError(null);

      // Optimistic update
      const previousPreferences = preferences;
      setPreferences((prev) => ({ ...prev, ...updates }));

      try {
        if (status === "unauthenticated") {
          // Save to localStorage
          const newPrefs = { ...preferences, ...updates };
          localStorage.setItem("userPreferences", JSON.stringify(newPrefs));
        } else {
          // Save to API
          const response = await fetch("/api/user/preferences", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });

          const data = await response.json();

          if (!data.success) {
            setPreferences(previousPreferences);
            setError(data.error);
            return false;
          }
        }

        return true;
      } catch (err) {
        setPreferences(previousPreferences);
        setError("Failed to save preferences");
        console.error(err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [preferences, status]
  );

  // Reset to defaults
  const resetPreferences = useCallback(async () => {
    setIsSaving(true);

    try {
      if (status === "unauthenticated") {
        localStorage.removeItem("userPreferences");
        setPreferences(DEFAULT_PREFERENCES);
      } else {
        const response = await fetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(DEFAULT_PREFERENCES),
        });

        const data = await response.json();

        if (data.success) {
          setPreferences(DEFAULT_PREFERENCES);
        } else {
          setError(data.error);
          return false;
        }
      }

      return true;
    } catch (err) {
      setError("Failed to reset preferences");
      console.error(err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [status]);

  return {
    preferences,
    isLoading,
    error,
    isSaving,
    updatePreference,
    updatePreferences,
    resetPreferences,
    isAuthenticated: status === "authenticated",
  };
}
