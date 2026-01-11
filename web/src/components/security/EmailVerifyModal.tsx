"use client";

import { useState, useEffect, useRef } from "react";
import type { SecurityAction } from "./SecurityContext";

interface EmailVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: SecurityAction;
}

export function EmailVerifyModal({
  isOpen,
  onClose,
  onSuccess,
  action,
}: EmailVerifyModalProps) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCode(["", "", "", "", "", ""]);
      setError("");
      setCodeSent(false);
      setMaskedEmail("");
      // Auto-send code when modal opens
      sendCode();
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const sendCode = async () => {
    setIsSending(true);
    setError("");

    try {
      const res = await fetch("/api/security/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send code");
        return;
      }

      setMaskedEmail(data.maskedEmail);
      setCodeSent(true);
      setResendCooldown(60);

      // Focus first input
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleInput = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError("");

    // Move to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join("");
      if (fullCode.length === 6) {
        verifyCode(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newCode = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
      setCode(newCode);

      if (pasted.length === 6) {
        verifyCode(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    }
  };

  const verifyCode = async (codeToVerify: string) => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/security/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code: codeToVerify }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
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

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-600/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Email Verification</h2>
          <p className="text-gray-400 text-sm mt-2">
            {codeSent
              ? `Enter the 6-digit code sent to ${maskedEmail}`
              : "Sending verification code..."}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-center">
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Sending State */}
        {isSending && (
          <div className="mb-6 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-gray-400 text-sm">Sending code to your email...</p>
          </div>
        )}

        {/* Code Input */}
        {codeSent && !isSending && (
          <>
            <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInput(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={isLoading}
                  className={`w-12 h-14 text-center text-xl font-mono rounded-xl border-2 bg-gray-800 focus:outline-none transition-colors ${
                    error
                      ? "border-red-500"
                      : digit
                      ? "border-purple-500"
                      : "border-gray-700 focus:border-purple-500"
                  } disabled:opacity-50`}
                />
              ))}
            </div>

            {/* Resend Button */}
            <div className="text-center mb-6">
              {resendCooldown > 0 ? (
                <p className="text-gray-500 text-sm">
                  Resend code in {resendCooldown}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={isSending}
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </div>
          </>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center text-gray-400 text-sm mb-4">
            Verifying...
          </div>
        )}

        {/* Cancel Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-medium transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
