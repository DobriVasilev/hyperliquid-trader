"use client";

import { useState } from "react";

const logos = [
  {
    id: "hexagon-core",
    name: "Hexagon Core",
    description: "Clean hexagonal mark with inner core - like the login page",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="hex-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#60A5FA" />
          </linearGradient>
        </defs>
        <path d="M32 4L56 16V48L32 60L8 48V16L32 4Z" fill="url(#hex-grad)" />
        <path d="M32 16L44 23V37L32 44L20 37V23L32 16Z" fill="#0a0a0f" fillOpacity="0.5" />
      </svg>
    ),
  },
  {
    id: "st-monogram",
    name: "ST Monogram",
    description: "Geometric S+T letterform, minimal and bold",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="st-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <path
          d="M16 12H48V20H36V52H28V20H16V12Z"
          fill="url(#st-grad)"
        />
        <path
          d="M16 28H28V36H20C18 36 16 38 16 40V44C16 46 18 48 20 48H48V40H28V36H44C46 36 48 34 48 32V28C48 26 46 24 44 24H16V28Z"
          fill="url(#st-grad)"
          fillOpacity="0.6"
        />
      </svg>
    ),
  },
  {
    id: "delta-rise",
    name: "Delta Rise",
    description: "Upward triangle representing growth and precision",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="delta-grad" x1="32" y1="8" x2="32" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1E40AF" />
          </linearGradient>
        </defs>
        <path d="M32 8L56 56H8L32 8Z" fill="url(#delta-grad)" />
        <path d="M32 24L44 48H20L32 24Z" fill="#0a0a0f" fillOpacity="0.3" />
      </svg>
    ),
  },
  {
    id: "bars-minimal",
    name: "Bars Minimal",
    description: "Three ascending bars - ultra-clean like Binance",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="bars-grad" x1="0" y1="56" x2="0" y2="8" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E40AF" />
            <stop offset="1" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <rect x="8" y="36" width="12" height="20" rx="2" fill="url(#bars-grad)" />
        <rect x="26" y="24" width="12" height="32" rx="2" fill="url(#bars-grad)" />
        <rect x="44" y="8" width="12" height="48" rx="2" fill="url(#bars-grad)" />
      </svg>
    ),
  },
  {
    id: "circle-s",
    name: "Circle S",
    description: "Circular mark with stylized S cutout - like Coinbase",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="circle-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="url(#circle-grad)" />
        <path
          d="M40 20H24C21 20 18 23 18 26C18 29 21 32 24 32H40C43 32 46 35 46 38C46 41 43 44 40 44H24"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "prism-cube",
    name: "Prism Cube",
    description: "3D perspective cube mark - modern and technical",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
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
        <path d="M32 6L56 20V44L32 30V6Z" fill="url(#cube-right)" />
        <path d="M32 6L8 20V44L32 30V6Z" fill="url(#cube-left)" />
        <path d="M8 44L32 58L56 44L32 30L8 44Z" fill="url(#cube-top)" />
      </svg>
    ),
  },
  {
    id: "arrow-bold",
    name: "Arrow Bold",
    description: "Bold upward arrow - represents momentum and direction",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="arrow-grad" x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1E40AF" />
          </linearGradient>
        </defs>
        <path
          d="M32 4L52 28H40V60H24V28H12L32 4Z"
          fill="url(#arrow-grad)"
        />
      </svg>
    ),
  },
  {
    id: "diamond-solid",
    name: "Diamond Solid",
    description: "Solid diamond mark - simple and iconic",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="diamond-grad" x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60A5FA" />
            <stop offset="0.5" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1E40AF" />
          </linearGradient>
        </defs>
        <path d="M32 4L60 32L32 60L4 32L32 4Z" fill="url(#diamond-grad)" />
      </svg>
    ),
  },
  {
    id: "wave-flow",
    name: "Wave Flow",
    description: "Flowing S-curve like Solana - represents movement",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="wave-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60A5FA" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <path
          d="M8 16H40C48 16 56 24 56 32C56 40 48 48 40 48H24C16 48 8 40 8 32V16Z"
          fill="url(#wave-grad)"
        />
        <path
          d="M56 48H24C16 48 8 40 8 32C8 24 16 16 24 16H40C48 16 56 24 56 32V48Z"
          fill="url(#wave-grad)"
          fillOpacity="0.4"
        />
      </svg>
    ),
  },
  {
    id: "hex-outline",
    name: "Hex Outline",
    description: "Outlined hexagon with bold stroke - clean and modern",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="hex-outline-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1E40AF" />
          </linearGradient>
        </defs>
        <path
          d="M32 6L54 18V46L32 58L10 46V18L32 6Z"
          fill="none"
          stroke="url(#hex-outline-grad)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "stack-layers",
    name: "Stack Layers",
    description: "Layered squares representing data layers",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="stack-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1E40AF" />
          </linearGradient>
        </defs>
        <rect x="4" y="28" width="28" height="28" rx="4" fill="url(#stack-grad)" fillOpacity="0.4" />
        <rect x="18" y="18" width="28" height="28" rx="4" fill="url(#stack-grad)" fillOpacity="0.7" />
        <rect x="32" y="8" width="28" height="28" rx="4" fill="url(#stack-grad)" />
      </svg>
    ),
  },
  {
    id: "ring-mark",
    name: "Ring Mark",
    description: "Bold ring with gap - represents cycles and systems",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60A5FA" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <path
          d="M32 4C16.536 4 4 16.536 4 32C4 47.464 16.536 60 32 60C47.464 60 60 47.464 60 32C60 16.536 47.464 4 32 4ZM32 16C40.837 16 48 23.163 48 32C48 40.837 40.837 48 32 48C23.163 48 16 40.837 16 32C16 23.163 23.163 16 32 16Z"
          fill="url(#ring-grad)"
        />
        <rect x="28" y="0" width="8" height="16" fill="#0a0a0f" />
      </svg>
    ),
  },
];

export default function LogoPickerPage() {
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [hoveredLogo, setHoveredLogo] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-blue-500/10 via-transparent to-transparent" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-purple-500/10 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Systems Trader
          </h1>
          <p className="text-gray-400 text-lg mb-2">Choose your brand identity</p>
          <p className="text-gray-500 text-sm">Select a logo that represents your trading vision</p>
        </div>

        {/* Logo Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto mb-16">
          {logos.map((logo) => (
            <button
              key={logo.id}
              onClick={() => setSelectedLogo(logo.id)}
              onMouseEnter={() => setHoveredLogo(logo.id)}
              onMouseLeave={() => setHoveredLogo(null)}
              className={`
                group relative aspect-square rounded-2xl p-8 transition-all duration-300
                ${
                  selectedLogo === logo.id
                    ? "bg-gradient-to-br from-blue-600/30 to-purple-600/30 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20"
                    : "bg-gray-900/50 hover:bg-gray-800/70 border border-gray-800 hover:border-gray-700"
                }
              `}
            >
              {/* Logo */}
              <div
                className={`
                  w-full h-full transition-transform duration-300
                  ${hoveredLogo === logo.id || selectedLogo === logo.id ? "scale-110" : ""}
                `}
              >
                {logo.svg}
              </div>

              {/* Selection indicator */}
              {selectedLogo === logo.id && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              {/* Name overlay */}
              <div
                className={`
                  absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-gray-900 to-transparent
                  transition-opacity duration-300
                  ${hoveredLogo === logo.id || selectedLogo === logo.id ? "opacity-100" : "opacity-0"}
                `}
              >
                <p className="text-sm font-medium text-center">{logo.name}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Logo Preview */}
        {selectedLogo && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-900/50 rounded-3xl p-8 border border-gray-800">
              <h2 className="text-xl font-semibold mb-6 text-center text-gray-300">
                Preview
              </h2>

              {/* Large preview */}
              <div className="flex flex-col items-center gap-8">
                <div className="w-32 h-32">
                  {logos.find((l) => l.id === selectedLogo)?.svg}
                </div>

                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">
                    {logos.find((l) => l.id === selectedLogo)?.name}
                  </h3>
                  <p className="text-gray-400">
                    {logos.find((l) => l.id === selectedLogo)?.description}
                  </p>
                </div>

                {/* Mock header preview */}
                <div className="w-full bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="font-semibold text-lg">Systems Trader</span>
                    <div className="ml-auto flex gap-4 text-sm text-gray-400">
                      <span>Sessions</span>
                      <span>New Session</span>
                    </div>
                  </div>
                </div>

                {/* Size variants */}
                <div className="flex items-end gap-8 py-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="text-xs text-gray-500">24px</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="text-xs text-gray-500">40px</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="text-xs text-gray-500">64px</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="text-xs text-gray-500">96px</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() => {
                  alert(`Selected logo: ${selectedLogo}\n\nTo use this logo, export the SVG code from this page.`);
                }}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium
                         hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/20"
              >
                Use This Logo
              </button>
              <button
                onClick={() => setSelectedLogo(null)}
                className="px-8 py-3 bg-gray-800 text-gray-300 rounded-xl font-medium
                         hover:bg-gray-700 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="text-center mt-16 text-gray-500 text-sm">
          <p>Click on a logo to select it and preview how it looks in different contexts</p>
        </div>
      </div>
    </main>
  );
}
