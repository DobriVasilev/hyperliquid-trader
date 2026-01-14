import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TauriSettings {
  executeBulgarian: boolean;
  executeTauri: boolean;
  executeVercel: boolean;
}

export interface UserSettings {
  // Tauri trading execution settings
  tauri: TauriSettings;

  // Display preferences
  theme: "light" | "dark" | "system";
  compactMode: boolean;
  showTimestamps: boolean;

  // Notification preferences
  enableNotifications: boolean;
  notifyOnFeedbackResponse: boolean;
  notifyOnMentions: boolean;

  // Trading page preferences
  defaultTimeframe: string;
  defaultSymbol: string;
  autoRefresh: boolean;
  refreshInterval: number; // in seconds

  // Chat preferences
  chatAutoOpen: boolean;
  chatSoundEnabled: boolean;
}

interface UserSettingsState extends UserSettings {
  // Actions
  updateTauriSettings: (settings: Partial<TauriSettings>) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  resetSettings: () => void;
  loadSettingsFromServer: () => Promise<void>;
  saveSettingsToServer: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  // Tauri settings - default to Vercel only
  tauri: {
    executeBulgarian: false,
    executeTauri: false,
    executeVercel: true,
  },

  // Display
  theme: "dark",
  compactMode: false,
  showTimestamps: true,

  // Notifications
  enableNotifications: true,
  notifyOnFeedbackResponse: true,
  notifyOnMentions: true,

  // Trading
  defaultTimeframe: "1h",
  defaultSymbol: "BTCUSDT",
  autoRefresh: true,
  refreshInterval: 60,

  // Chat
  chatAutoOpen: false,
  chatSoundEnabled: true,
};

export const useUserSettingsStore = create<UserSettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      updateTauriSettings: (settings: Partial<TauriSettings>) =>
        set((state) => ({
          tauri: { ...state.tauri, ...settings },
        })),

      updateSettings: (settings: Partial<UserSettings>) =>
        set((state) => ({ ...state, ...settings })),

      resetSettings: () => set(defaultSettings),

      loadSettingsFromServer: async () => {
        try {
          const response = await fetch("/api/user/settings");
          const data = await response.json();

          if (data.success && data.data) {
            set((state) => ({
              ...state,
              ...data.data,
            }));
          }
        } catch (error) {
          console.error("Failed to load settings from server:", error);
        }
      },

      saveSettingsToServer: async () => {
        try {
          const settings = get();
          const response = await fetch("/api/user/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tauri: settings.tauri,
              theme: settings.theme,
              compactMode: settings.compactMode,
              showTimestamps: settings.showTimestamps,
              enableNotifications: settings.enableNotifications,
              notifyOnFeedbackResponse: settings.notifyOnFeedbackResponse,
              notifyOnMentions: settings.notifyOnMentions,
              defaultTimeframe: settings.defaultTimeframe,
              defaultSymbol: settings.defaultSymbol,
              autoRefresh: settings.autoRefresh,
              refreshInterval: settings.refreshInterval,
              chatAutoOpen: settings.chatAutoOpen,
              chatSoundEnabled: settings.chatSoundEnabled,
            }),
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || "Failed to save settings");
          }
        } catch (error) {
          console.error("Failed to save settings to server:", error);
          throw error;
        }
      },
    }),
    {
      name: "user-settings",
    }
  )
);
