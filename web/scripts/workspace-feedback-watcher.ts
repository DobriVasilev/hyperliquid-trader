#!/usr/bin/env tsx

/**
 * Workspace Feedback Watcher
 *
 * Watches /tmp/claude-workspace/feedback-queue/ for new feedback JSON files
 * Writes filename to feedback-pipe to trigger Claude Code worker
 *
 * Run with: npm run watch:workspace-feedback
 */

import { watch } from "fs";
import { writeFile, access } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Configuration
const FEEDBACK_DIR = "/tmp/claude-workspace/feedback-queue";
const FEEDBACK_PIPE = "/tmp/claude-workspace/feedback-pipe";
const HEARTBEAT_FILE = "/tmp/workspace-feedback-watcher-heartbeat.txt";
const MAX_RUNTIME = 30 * 60 * 1000; // 30 minutes max runtime (safety)

// Track health
let lastHeartbeat = Date.now();
let startTime = Date.now();
let isProcessing = false;

// Write heartbeat to file for monitoring
async function updateHeartbeat() {
  try {
    await writeFile(HEARTBEAT_FILE, Date.now().toString());
    lastHeartbeat = Date.now();
  } catch (error) {
    console.error("[ERROR] Failed to write heartbeat:", error);
  }
}

// Freeze detection
function checkForFreeze() {
  const now = Date.now();
  const timeSinceLastHeartbeat = now - lastHeartbeat;

  if (timeSinceLastHeartbeat > 60000) {
    // 60 seconds
    console.error(
      `[FREEZE DETECTED] No heartbeat for ${timeSinceLastHeartbeat}ms`
    );
    console.error(
      "[ACTION REQUIRED] Watcher may be frozen. Restart recommended."
    );
    process.exit(1);
  }

  // Safety: Kill after max runtime to prevent runaway processes
  if (now - startTime > MAX_RUNTIME) {
    console.log(
      `[MAX RUNTIME] Watcher has run for ${MAX_RUNTIME}ms. Exiting for restart.`
    );
    process.exit(0);
  }
}

// Trigger Claude Code by writing to named pipe
async function triggerClaude(filename: string) {
  if (isProcessing) {
    console.log(`[BUSY] Already processing. Skipping: ${filename}`);
    return;
  }

  try {
    isProcessing = true;
    console.log(`[TRIGGER] Writing to pipe: ${filename}`);

    // Check if file still exists
    const feedbackPath = path.join(FEEDBACK_DIR, filename);
    try {
      await access(feedbackPath);
    } catch {
      console.log(`[SKIPPED] File no longer exists: ${filename}`);
      isProcessing = false;
      return;
    }

    // Write filename to named pipe (this will wake up the Claude worker)
    await writeFile(FEEDBACK_PIPE, filename + "\n");
    console.log(`[SUCCESS] Triggered Claude for: ${filename}`);

    await updateHeartbeat();
  } catch (error) {
    console.error(`[ERROR] Failed to trigger Claude:`, error);
  } finally {
    // Reset after a short delay to allow worker to pick up the file
    setTimeout(() => {
      isProcessing = false;
    }, 2000);
  }
}

// Main watcher
async function main() {
  console.log("[WORKSPACE FEEDBACK WATCHER STARTED]");
  console.log(`Watching directory: ${FEEDBACK_DIR}`);
  console.log(`Feedback pipe: ${FEEDBACK_PIPE}`);
  console.log(`Heartbeat file: ${HEARTBEAT_FILE}`);
  console.log(`Max runtime: ${MAX_RUNTIME}ms\n`);

  // Verify directories exist
  if (!existsSync(FEEDBACK_DIR)) {
    console.error(`[ERROR] Feedback directory does not exist: ${FEEDBACK_DIR}`);
    console.error(
      "Run setup script: ./scripts/setup-claude-workspace.sh"
    );
    process.exit(1);
  }

  if (!existsSync(FEEDBACK_PIPE)) {
    console.error(`[ERROR] Feedback pipe does not exist: ${FEEDBACK_PIPE}`);
    console.error(
      "Run setup script: ./scripts/setup-claude-workspace.sh"
    );
    process.exit(1);
  }

  // Initial heartbeat
  await updateHeartbeat();

  // Set up freeze detection check
  const freezeCheckInterval = setInterval(checkForFreeze, 10000);

  // Watch for new files in feedback directory
  const watcher = watch(
    FEEDBACK_DIR,
    { persistent: true },
    async (eventType, filename) => {
      if (!filename) return;

      // Only process JSON files
      if (!filename.endsWith(".json")) {
        return;
      }

      // Ignore example files
      if (filename.includes(".example")) {
        return;
      }

      console.log(`[FILE EVENT] ${eventType}: ${filename}`);
      await updateHeartbeat();

      // On file creation or change, trigger Claude
      if (eventType === "rename" || eventType === "change") {
        // Small delay to ensure file is fully written
        setTimeout(() => {
          triggerClaude(filename);
        }, 500);
      }
    }
  );

  console.log("[WATCHING] Waiting for feedback files...\n");

  // Periodic heartbeat update
  const heartbeatInterval = setInterval(async () => {
    await updateHeartbeat();
  }, 5000);

  // Keep process alive
  process.on("SIGTERM", async () => {
    console.log("\n[SIGTERM] Shutting down gracefully...");
    clearInterval(freezeCheckInterval);
    clearInterval(heartbeatInterval);
    watcher.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\n[SIGINT] Shutting down gracefully...");
    clearInterval(freezeCheckInterval);
    clearInterval(heartbeatInterval);
    watcher.close();
    process.exit(0);
  });

  // Handle watcher errors
  watcher.on("error", (error) => {
    console.error("[WATCHER ERROR]", error);
  });
}

// Start watcher
main().catch((error) => {
  console.error("[FATAL ERROR]", error);
  process.exit(1);
});
