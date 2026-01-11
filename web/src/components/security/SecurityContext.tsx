"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type SecurityAction =
  | "withdraw"
  | "emergency_withdraw"
  | "delete_wallet"
  | "change_settings";

interface SecurityRequirement {
  pin: boolean;
  email: boolean;
}

const SECURITY_LEVELS: Record<SecurityAction, SecurityRequirement> = {
  withdraw: { pin: true, email: true },
  emergency_withdraw: { pin: true, email: true },
  delete_wallet: { pin: true, email: false },
  change_settings: { pin: true, email: false },
};

interface SecurityState {
  hasPin: boolean;
  isLocked: boolean;
  lockoutRemaining: number;
}

interface SecurityContextType {
  state: SecurityState;
  refreshState: () => Promise<void>;
  requireSecurity: (
    action: SecurityAction,
    onSuccess: () => void | Promise<void>
  ) => void;
  isVerifying: boolean;
  currentAction: SecurityAction | null;
  onVerificationComplete: () => void;
  onVerificationCancel: () => void;
  pendingCallback: (() => void | Promise<void>) | null;
  getRequirements: (action: SecurityAction) => SecurityRequirement;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function useSecurityContext() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error("useSecurityContext must be used within SecurityProvider");
  }
  return context;
}

interface SecurityProviderProps {
  children: ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  const [state, setState] = useState<SecurityState>({
    hasPin: false,
    isLocked: false,
    lockoutRemaining: 0,
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [currentAction, setCurrentAction] = useState<SecurityAction | null>(null);
  const [pendingCallback, setPendingCallback] = useState<(() => void | Promise<void>) | null>(null);

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch("/api/security/pin");
      const data = await res.json();
      if (data.success) {
        setState({
          hasPin: data.hasPin,
          isLocked: data.isLocked,
          lockoutRemaining: data.lockoutRemaining,
        });
      }
    } catch (error) {
      console.error("Failed to fetch security state:", error);
    }
  }, []);

  const requireSecurity = useCallback(
    (action: SecurityAction, onSuccess: () => void | Promise<void>) => {
      const requirements = SECURITY_LEVELS[action];

      // If no security required, execute immediately
      if (!requirements.pin && !requirements.email) {
        onSuccess();
        return;
      }

      // Store callback and show verification UI
      setPendingCallback(() => onSuccess);
      setCurrentAction(action);
      setIsVerifying(true);
    },
    []
  );

  const onVerificationComplete = useCallback(async () => {
    if (pendingCallback) {
      await pendingCallback();
    }
    setIsVerifying(false);
    setCurrentAction(null);
    setPendingCallback(null);
  }, [pendingCallback]);

  const onVerificationCancel = useCallback(() => {
    setIsVerifying(false);
    setCurrentAction(null);
    setPendingCallback(null);
  }, []);

  const getRequirements = useCallback((action: SecurityAction) => {
    return SECURITY_LEVELS[action] || { pin: false, email: false };
  }, []);

  return (
    <SecurityContext.Provider
      value={{
        state,
        refreshState,
        requireSecurity,
        isVerifying,
        currentAction,
        onVerificationComplete,
        onVerificationCancel,
        pendingCallback,
        getRequirements,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}
