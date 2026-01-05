"use client";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}

const sizes = {
  sm: { icon: "w-6 h-6", text: "text-sm" },
  md: { icon: "w-8 h-8", text: "text-lg" },
  lg: { icon: "w-10 h-10", text: "text-xl" },
  xl: { icon: "w-12 h-12", text: "text-2xl" },
};

export function Logo({ size = "md", className = "", showText = true }: LogoProps) {
  const { icon, text } = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <PrismCubeLogo className={icon} />
      {showText && (
        <span className={`font-semibold ${text}`}>
          Systems Trader
        </span>
      )}
    </div>
  );
}

// Prism Cube Logo - the official Systems Trader logo
export function PrismCubeLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cube-top" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="cube-left" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#1E40AF" />
        </linearGradient>
        <linearGradient id="cube-right" x1="1" y1="0" x2="0" y2="1">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      {/* Right face */}
      <path d="M32 6L56 20V44L32 30V6Z" fill="url(#cube-right)" />
      {/* Left face */}
      <path d="M32 6L8 20V44L32 30V6Z" fill="url(#cube-left)" />
      {/* Bottom face */}
      <path d="M8 44L32 58L56 44L32 30L8 44Z" fill="url(#cube-top)" />
    </svg>
  );
}

// For use as an img src (PNG fallback)
export const LOGO_PNG_URL = "https://pub-5cc5403568f5455a945da44f4db19f23.r2.dev/systems_trader_logo.png";
export const LOGO_SVG_URL = "https://pub-5cc5403568f5455a945da44f4db19f23.r2.dev/systems_trader_logo.svg";

// Simplified icon-only export
export const LogoIcon = PrismCubeLogo;

export default Logo;
