import { create } from "zustand";
import { TVPositionData, TradeHistoryItem } from "./types";

// Web app states (simplified from Tauri - no biometric, no local password)
type AppState = "loading" | "ready" | "trading";

interface AppStoreState {
  // App state
  appState: AppState;
  loading: boolean;
  tradingLoading: boolean;
  error: string;
  success: string;

  // Selected wallet (from user's wallets in DB)
  selectedWalletId: string | null;
  walletAddress: string;
  tradingEnabled: boolean;

  // UI
  activeTab: "positions" | "orders" | "history";
  showSettings: boolean;

  // TradingView Bridge (for extension communication)
  tvPosition: TVPositionData | null;
  tvOverlayVisible: boolean;
  pendingExtensionTrade: boolean;

  // Trade History (loaded from DB, cached in memory)
  tradeHistory: TradeHistoryItem[];

  // Emergency Withdraw
  showWithdrawModal: boolean;
  withdrawDestination: string;
  withdrawing: boolean;

  // Actions
  setAppState: (state: AppState) => void;
  setLoading: (loading: boolean) => void;
  setTradingLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  clearMessages: () => void;

  setSelectedWalletId: (id: string | null) => void;
  setWalletAddress: (address: string) => void;
  setTradingEnabled: (enabled: boolean) => void;

  setActiveTab: (tab: "positions" | "orders" | "history") => void;
  setShowSettings: (show: boolean) => void;

  setTvPosition: (position: TVPositionData | null) => void;
  setTvOverlayVisible: (visible: boolean) => void;
  setPendingExtensionTrade: (pending: boolean) => void;

  setTradeHistory: (historyOrUpdater: TradeHistoryItem[] | ((prev: TradeHistoryItem[]) => TradeHistoryItem[])) => void;
  addTradeToHistory: (trade: TradeHistoryItem) => void;
  updateTradeInHistory: (id: string, updates: Partial<TradeHistoryItem>) => void;

  setShowWithdrawModal: (show: boolean) => void;
  setWithdrawDestination: (destination: string) => void;
  setWithdrawing: (withdrawing: boolean) => void;

  // Reset state (on logout/wallet change)
  resetTradingState: () => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  // Initial state
  appState: "loading",
  loading: false,
  tradingLoading: false,
  error: "",
  success: "",

  selectedWalletId: null,
  walletAddress: "",
  tradingEnabled: false,

  activeTab: "positions",
  showSettings: false,

  tvPosition: null,
  tvOverlayVisible: false,
  pendingExtensionTrade: false,

  tradeHistory: [],

  showWithdrawModal: false,
  withdrawDestination: "",
  withdrawing: false,

  // Actions
  setAppState: (appState) => set({ appState }),
  setLoading: (loading) => set({ loading }),
  setTradingLoading: (tradingLoading) => set({ tradingLoading }),
  setError: (error) => set({ error, success: "" }),
  setSuccess: (success) => set({ success, error: "" }),
  clearMessages: () => set({ error: "", success: "" }),

  setSelectedWalletId: (selectedWalletId) => set({ selectedWalletId }),
  setWalletAddress: (walletAddress) => set({ walletAddress }),
  setTradingEnabled: (tradingEnabled) => set({ tradingEnabled }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setShowSettings: (showSettings) => set({ showSettings }),

  setTvPosition: (tvPosition) => set({ tvPosition }),
  setTvOverlayVisible: (tvOverlayVisible) => set({ tvOverlayVisible }),
  setPendingExtensionTrade: (pendingExtensionTrade) => set({ pendingExtensionTrade }),

  setTradeHistory: (historyOrUpdater) => set((state) => ({
    tradeHistory: typeof historyOrUpdater === 'function'
      ? historyOrUpdater(state.tradeHistory)
      : historyOrUpdater,
  })),
  addTradeToHistory: (trade) => set((state) => ({
    tradeHistory: [trade, ...state.tradeHistory],
  })),
  updateTradeInHistory: (id, updates) => set((state) => ({
    tradeHistory: state.tradeHistory.map((trade) =>
      trade.id === id ? { ...trade, ...updates } : trade
    ),
  })),

  setShowWithdrawModal: (showWithdrawModal) => set({ showWithdrawModal }),
  setWithdrawDestination: (withdrawDestination) => set({ withdrawDestination }),
  setWithdrawing: (withdrawing) => set({ withdrawing }),

  resetTradingState: () => set({
    selectedWalletId: null,
    walletAddress: "",
    tradingEnabled: false,
    tradeHistory: [],
    tvPosition: null,
    tvOverlayVisible: false,
    pendingExtensionTrade: false,
  }),
}));

// Re-export types
export type { TVPositionData, TradeHistoryItem };
