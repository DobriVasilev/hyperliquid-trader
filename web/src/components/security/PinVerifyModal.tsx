"use client";

import { useState, useEffect } from "react";

interface PinVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionDescription?: string;
}

export function PinVerifyModal({
  isOpen,
  onClose,
  onSuccess,
  actionDescription = "continue",
}: PinVerifyModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError("");
      setAttemptsRemaining(null);
    }
  }, [isOpen]);

  // Lockout countdown
  useEffect(() => {
    if (lockoutRemaining > 0) {
      const timer = setTimeout(() => {
        setLockoutRemaining((prev) => prev - 1);
        if (lockoutRemaining <= 1) {
          setIsLocked(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutRemaining]);

  const handleDigit = (digit: string) => {
    if (pin.length < 6 && !isLocked) {
      const newPin = pin + digit;
      setPin(newPin);
      setError("");

      if (newPin.length === 6) {
        verifyPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const verifyPin = async (pinToVerify: string) => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/security/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", pin: pinToVerify }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        setPin("");

        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining);
        }

        if (data.lockedUntil) {
          setIsLocked(true);
          const remaining = Math.ceil(
            (new Date(data.lockedUntil).getTime() - Date.now()) / 1000
          );
          setLockoutRemaining(remaining);
        }
        return;
      }

      onSuccess();
    } catch {
      setError("Network error. Please try again.");
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isLocked ? "bg-red-600/20" : "bg-blue-600/20"
          }`}>
            {isLocked ? (
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <h2 className="text-xl font-semibold text-white">
            {isLocked ? "Account Locked" : "Enter PIN"}
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            {isLocked
              ? `Too many attempts. Try again in ${Math.ceil(lockoutRemaining / 60)} minutes.`
              : `Enter your PIN to ${actionDescription}`}
          </p>
        </div>

        {/* Error */}
        {error && !isLocked && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-center">
            <span className="text-red-400 text-sm">{error}</span>
            {attemptsRemaining !== null && attemptsRemaining > 0 && (
              <span className="block text-red-400/70 text-xs mt-1">
                {attemptsRemaining} attempts remaining
              </span>
            )}
          </div>
        )}

        {/* Locked Countdown */}
        {isLocked && (
          <div className="mb-6 text-center">
            <div className="text-4xl font-mono text-red-400 mb-2">
              {Math.floor(lockoutRemaining / 60)}:{(lockoutRemaining % 60).toString().padStart(2, "0")}
            </div>
            <p className="text-gray-500 text-sm">until unlock</p>
          </div>
        )}

        {/* PIN Dots */}
        {!isLocked && (
          <>
            <div className="flex justify-center gap-3 mb-8">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all ${
                    i < pin.length
                      ? error
                        ? "bg-red-500"
                        : "bg-blue-500 scale-110"
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
                  onClick={() => handleDigit(num.toString())}
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
                onClick={() => handleDigit("0")}
                disabled={isLoading}
                className="h-14 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-xl font-medium transition-colors disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={isLoading}
                className="h-14 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 transition-colors"
              >
                <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                </svg>
              </button>
            </div>
          </>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center text-gray-400 text-sm">
            Verifying...
          </div>
        )}

        {/* Locked - Cancel Button */}
        {isLocked && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-medium transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
