"use client";

import { useState, useRef, useEffect } from "react";

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PinSetupModal({ isOpen, onClose, onSuccess }: PinSetupModalProps) {
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep("enter");
      setPin("");
      setConfirmPin("");
      setError("");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  const handleDigit = (digit: string, isConfirm: boolean) => {
    const currentPin = isConfirm ? confirmPin : pin;
    const setCurrentPin = isConfirm ? setConfirmPin : setPin;

    if (currentPin.length < 6) {
      const newPin = currentPin + digit;
      setCurrentPin(newPin);
      setError("");

      // Move to confirm step or verify
      if (newPin.length === 6) {
        if (!isConfirm) {
          setTimeout(() => {
            setStep("confirm");
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
          }, 200);
        } else {
          handleSubmit(newPin);
        }
      }
    }
  };

  const handleBackspace = (isConfirm: boolean) => {
    const currentPin = isConfirm ? confirmPin : pin;
    const setCurrentPin = isConfirm ? setConfirmPin : setPin;
    if (currentPin.length > 0) {
      setCurrentPin(currentPin.slice(0, -1));
    }
  };

  const handleSubmit = async (confirmedPin: string) => {
    if (pin !== confirmedPin) {
      setError("PINs don't match. Try again.");
      setStep("enter");
      setPin("");
      setConfirmPin("");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/security/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup", pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to set up PIN");
        setStep("enter");
        setPin("");
        setConfirmPin("");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentPin = step === "enter" ? pin : confirmPin;
  const isConfirm = step === "confirm";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-600/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">
            {step === "enter" ? "Create Security PIN" : "Confirm Your PIN"}
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            {step === "enter"
              ? "Choose a 6-digit PIN for sensitive actions"
              : "Enter your PIN again to confirm"}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-center">
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* PIN Dots */}
        <div className="flex justify-center gap-3 mb-8">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all ${
                i < currentPin.length
                  ? "bg-blue-500 scale-110"
                  : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num.toString(), isConfirm)}
              disabled={isLoading}
              className="h-14 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-xl font-medium transition-colors disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="h-14 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleDigit("0", isConfirm)}
            disabled={isLoading}
            className="h-14 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-xl font-medium transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleBackspace(isConfirm)}
            disabled={isLoading}
            className="h-14 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 transition-colors"
          >
            <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
            </svg>
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center text-gray-400 text-sm">
            Setting up PIN...
          </div>
        )}

        {/* Security Tips */}
        <div className="text-center text-xs text-gray-500 mt-4">
          <p>Avoid simple patterns like 123456 or 111111</p>
        </div>
      </div>
    </div>
  );
}
