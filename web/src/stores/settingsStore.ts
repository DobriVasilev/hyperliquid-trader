import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ExchangeType, DEFAULT_EXCHANGE } from "./types";

interface SettingsState {
  // Exchange
  selectedExchange: ExchangeType;

  // Trading settings
  autoAdjustLeverage: boolean;
  autoRetryUnfilled: boolean;
  unfilledWaitTime: number;
  maxRiskMultiplier: number;
  feeBuffer: number;
  updateEntryOnConfirm: boolean;
  copyReportToClipboard: boolean;

  // Risk settings
  liqWarningDistance: number;
  liqDangerDistance: number;
  pnlTolerance: number;

  // TradingView Extension settings
  extensionSkipConfirm: boolean;
  extensionEnabled: boolean;

  // Loaded flag
  settingsLoaded: boolean;

  // Actions
  setSelectedExchange: (exchange: ExchangeType) => void;
  setAutoAdjustLeverage: (enabled: boolean) => void;
  setAutoRetryUnfilled: (enabled: boolean) => void;
  setUnfilledWaitTime: (time: number) => void;
  setMaxRiskMultiplier: (multiplier: number) => void;
  setFeeBuffer: (buffer: number) => void;
  setUpdateEntryOnConfirm: (enabled: boolean) => void;
  setCopyReportToClipboard: (enabled: boolean) => void;
  setLiqWarningDistance: (distance: number) => void;
  setLiqDangerDistance: (distance: number) => void;
  setPnlTolerance: (tolerance: number) => void;
  setExtensionSkipConfirm: (enabled: boolean) => void;
  setExtensionEnabled: (enabled: boolean) => void;
  setSettingsLoaded: (loaded: boolean) => void;

  // Bulk update for loading from storage
  loadSettings: (settings: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial values
      selectedExchange: DEFAULT_EXCHANGE,
      autoAdjustLeverage: true,
      autoRetryUnfilled: false,
      unfilledWaitTime: 30000,
      maxRiskMultiplier: 2.0,
      feeBuffer: 0.05,
      updateEntryOnConfirm: false,
      copyReportToClipboard: false,
      liqWarningDistance: 300,
      liqDangerDistance: 100,
      pnlTolerance: 0.10,
      extensionSkipConfirm: true,
      extensionEnabled: true,
      settingsLoaded: false,

      // Actions
      setSelectedExchange: (selectedExchange) => set({ selectedExchange }),
      setAutoAdjustLeverage: (autoAdjustLeverage) => set({ autoAdjustLeverage }),
      setAutoRetryUnfilled: (autoRetryUnfilled) => set({ autoRetryUnfilled }),
      setUnfilledWaitTime: (unfilledWaitTime) => set({ unfilledWaitTime }),
      setMaxRiskMultiplier: (maxRiskMultiplier) => set({ maxRiskMultiplier }),
      setFeeBuffer: (feeBuffer) => set({ feeBuffer }),
      setUpdateEntryOnConfirm: (updateEntryOnConfirm) => set({ updateEntryOnConfirm }),
      setCopyReportToClipboard: (copyReportToClipboard) => set({ copyReportToClipboard }),
      setLiqWarningDistance: (liqWarningDistance) => set({ liqWarningDistance }),
      setLiqDangerDistance: (liqDangerDistance) => set({ liqDangerDistance }),
      setPnlTolerance: (pnlTolerance) => set({ pnlTolerance }),
      setExtensionSkipConfirm: (extensionSkipConfirm) => set({ extensionSkipConfirm }),
      setExtensionEnabled: (extensionEnabled) => set({ extensionEnabled }),
      setSettingsLoaded: (settingsLoaded) => set({ settingsLoaded }),

      loadSettings: (settings) => set((state) => ({ ...state, ...settings, settingsLoaded: true })),
    }),
    {
      name: "trading-settings",
      partialize: (state) => ({
        selectedExchange: state.selectedExchange,
        autoAdjustLeverage: state.autoAdjustLeverage,
        autoRetryUnfilled: state.autoRetryUnfilled,
        unfilledWaitTime: state.unfilledWaitTime,
        maxRiskMultiplier: state.maxRiskMultiplier,
        feeBuffer: state.feeBuffer,
        updateEntryOnConfirm: state.updateEntryOnConfirm,
        copyReportToClipboard: state.copyReportToClipboard,
        liqWarningDistance: state.liqWarningDistance,
        liqDangerDistance: state.liqDangerDistance,
        pnlTolerance: state.pnlTolerance,
        extensionSkipConfirm: state.extensionSkipConfirm,
        extensionEnabled: state.extensionEnabled,
      }),
    }
  )
);
