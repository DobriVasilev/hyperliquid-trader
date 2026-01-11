"use client";

import { useState, useEffect, useCallback } from "react";
import { PinSetupModal } from "./PinSetupModal";
import { PinVerifyModal } from "./PinVerifyModal";
import { EmailVerifyModal } from "./EmailVerifyModal";
import type { SecurityAction } from "./SecurityContext";

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

const ACTION_DESCRIPTIONS: Record<SecurityAction, string> = {
  withdraw: "withdraw funds",
  emergency_withdraw: "perform emergency withdrawal",
  delete_wallet: "delete this wallet",
  change_settings: "change security settings",
};

interface SecurityGateProps {
  action: SecurityAction;
  onSuccess: () => void | Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
}

type Step = "checking" | "pin_setup" | "pin_verify" | "email_verify" | "done";

export function SecurityGate({ action, onSuccess, onCancel, isOpen }: SecurityGateProps) {
  const [step, setStep] = useState<Step>("checking");
  const [hasPin, setHasPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const requirements = SECURITY_LEVELS[action] || { pin: false, email: false };

  // Check PIN status when opened
  useEffect(() => {
    if (isOpen) {
      setPinVerified(false);
      setEmailVerified(false);
      checkPinStatus();
    }
  }, [isOpen]);

  const checkPinStatus = async () => {
    setStep("checking");

    // If no security required, complete immediately
    if (!requirements.pin && !requirements.email) {
      handleComplete();
      return;
    }

    try {
      const res = await fetch("/api/security/pin");
      const data = await res.json();

      if (data.success) {
        setHasPin(data.hasPin);

        if (requirements.pin) {
          if (!data.hasPin) {
            setStep("pin_setup");
          } else {
            setStep("pin_verify");
          }
        } else if (requirements.email) {
          setStep("email_verify");
        }
      }
    } catch (error) {
      console.error("Failed to check PIN status:", error);
      onCancel();
    }
  };

  const handlePinSetupSuccess = () => {
    setHasPin(true);
    // After setup, verify PIN
    setStep("pin_verify");
  };

  const handlePinVerifySuccess = () => {
    setPinVerified(true);
    // Check if email verification is also needed
    if (requirements.email) {
      setStep("email_verify");
    } else {
      handleComplete();
    }
  };

  const handleEmailVerifySuccess = () => {
    setEmailVerified(true);
    handleComplete();
  };

  const handleComplete = useCallback(async () => {
    setStep("done");
    await onSuccess();
  }, [onSuccess]);

  const handleCancel = () => {
    setStep("checking");
    setPinVerified(false);
    setEmailVerified(false);
    onCancel();
  };

  if (!isOpen) return null;

  // Checking state
  if (step === "checking") {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Checking security requirements...</p>
        </div>
      </div>
    );
  }

  // PIN Setup
  if (step === "pin_setup") {
    return (
      <PinSetupModal
        isOpen={true}
        onClose={handleCancel}
        onSuccess={handlePinSetupSuccess}
      />
    );
  }

  // PIN Verify
  if (step === "pin_verify") {
    return (
      <PinVerifyModal
        isOpen={true}
        onClose={handleCancel}
        onSuccess={handlePinVerifySuccess}
        actionDescription={ACTION_DESCRIPTIONS[action]}
      />
    );
  }

  // Email Verify
  if (step === "email_verify") {
    return (
      <EmailVerifyModal
        isOpen={true}
        onClose={handleCancel}
        onSuccess={handleEmailVerifySuccess}
        action={action}
      />
    );
  }

  return null;
}

// Hook for easy use
export function useSecurityGate() {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState<SecurityAction>("delete_wallet");
  const [pendingCallback, setPendingCallback] = useState<(() => void | Promise<void>) | null>(null);

  const requireSecurity = useCallback(
    (securityAction: SecurityAction, callback: () => void | Promise<void>) => {
      const requirements = SECURITY_LEVELS[securityAction] || { pin: false, email: false };

      // If no security required, execute immediately
      if (!requirements.pin && !requirements.email) {
        callback();
        return;
      }

      setAction(securityAction);
      setPendingCallback(() => callback);
      setIsOpen(true);
    },
    []
  );

  const onSuccess = useCallback(async () => {
    if (pendingCallback) {
      await pendingCallback();
    }
    setIsOpen(false);
    setPendingCallback(null);
  }, [pendingCallback]);

  const onCancel = useCallback(() => {
    setIsOpen(false);
    setPendingCallback(null);
  }, []);

  const SecurityGateComponent = useCallback(
    () => (
      <SecurityGate
        action={action}
        onSuccess={onSuccess}
        onCancel={onCancel}
        isOpen={isOpen}
      />
    ),
    [action, onSuccess, onCancel, isOpen]
  );

  return {
    requireSecurity,
    SecurityGate: SecurityGateComponent,
  };
}
