// Chat Theme - Using app's existing design system colors
// Matches the Linear.app / Dobri Lab inspired glass morphism design

export const CHAT_COLORS = {
  // Backgrounds (from globals.css)
  bgColor: "#0F0F10",           // --bg-0
  secondaryBg: "#151516",       // --bg-1
  sectionBg: "#1C1C1E",         // --bg-2
  headerBg: "#151516",          // --bg-1

  // Primary/Accent (green from app)
  primary: "#10B981",           // --accent
  primaryHover: "#059669",      // --accent-hover
  primaryGlow: "rgba(16, 185, 129, 0.3)", // --accent-glow

  // Text
  text: "#EEEFF1",              // --text-primary
  textSecondary: "#9CA3AF",     // --text-secondary
  hint: "#6B7280",              // --text-muted

  // Borders
  border: "rgba(255, 255, 255, 0.08)",      // --border
  borderHover: "rgba(255, 255, 255, 0.15)", // --border-hover

  // Buttons
  button: "#10B981",
  buttonText: "#ffffff",
  buttonHover: "#059669",

  // Status
  online: "#10B981",            // Same green as accent
  destructive: "#ef4444",       // Red
  warning: "#f59e0b",           // Orange

  // Message Bubbles
  outgoingBubble: "rgba(16, 185, 129, 0.15)",  // Green tinted for outgoing
  outgoingBubbleBorder: "rgba(16, 185, 129, 0.3)",
  incomingBubble: "#1C1C1E",    // --bg-2 for incoming

  // Input
  inputBg: "rgba(0, 0, 0, 0.3)",
  inputBorder: "rgba(255, 255, 255, 0.08)",
  inputFocus: "rgba(16, 185, 129, 0.3)",

  // Selection
  selection: "rgba(16, 185, 129, 0.2)",
  hover: "rgba(255, 255, 255, 0.03)",

  // Link
  link: "#10B981",
  accent: "#10B981",

  // Reactions (for emoji picker)
  reactionBg: "rgba(255, 255, 255, 0.08)",
  reactionBgSelected: "rgba(16, 185, 129, 0.2)",
} as const;

// Re-export as TELEGRAM_COLORS for backwards compatibility
export const TELEGRAM_COLORS = CHAT_COLORS;

// Default reactions
export const DEFAULT_REACTIONS = [
  { emoji: "❤️", animation: "pulse" },
  { emoji: "👍", animation: "bounce" },
  { emoji: "🔥", animation: "shake" },
  { emoji: "🎉", animation: "explode" },
  { emoji: "😢", animation: "wobble" },
  { emoji: "😱", animation: "shake" },
  { emoji: "🤔", animation: "tilt" },
  { emoji: "👎", animation: "bounce" },
];

// Emoji categories for the picker
export const EMOJI_CATEGORIES = [
  { id: "recent", icon: "🕐", label: "Recent" },
  { id: "smileys", icon: "😀", label: "Smileys" },
  { id: "people", icon: "👋", label: "People" },
  { id: "animals", icon: "🐶", label: "Animals" },
  { id: "food", icon: "🍕", label: "Food" },
  { id: "activities", icon: "⚽", label: "Activities" },
  { id: "travel", icon: "✈️", label: "Travel" },
  { id: "objects", icon: "💡", label: "Objects" },
  { id: "symbols", icon: "❤️", label: "Symbols" },
  { id: "flags", icon: "🏳️", label: "Flags" },
];

// Voice message settings
export const VOICE_MESSAGE = {
  maxDuration: 300, // 5 minutes
  waveformBars: 40,
  playbackSpeeds: [1, 1.5, 2] as const,
  slideToCancel: 100, // px to slide left to cancel
  slideToLock: 80,    // px to slide up to lock recording
};

// Animation configs
export const ANIMATIONS = {
  spring: { tension: 300, friction: 20 },
  quick: { duration: 150 },
  normal: { duration: 200 },
  slow: { duration: 300 },
  slideUp: 200, // duration in ms for slide up animation
};

// Get last seen text
export function getLastSeenText(lastSeen: Date | string | null): string {
  if (!lastSeen) return "last seen a long time ago";

  const date = typeof lastSeen === "string" ? new Date(lastSeen) : lastSeen;
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "online";
  if (minutes < 5) return "last seen just now";
  if (minutes < 60) return `last seen ${minutes} minutes ago`;
  if (hours < 24) {
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `last seen today at ${time}`;
  }
  if (days < 2) return "last seen yesterday";
  if (days < 7) return "last seen within a week";
  if (days < 30) return "last seen within a month";
  return "last seen a long time ago";
}
