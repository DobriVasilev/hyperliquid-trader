#!/usr/bin/env tsx

/**
 * Workspace Status Watcher
 *
 * Watches /tmp/claude-workspace/status/ for Claude execution status updates
 * Updates ClaudeExecution records and creates WorkspaceMessage timeline entries
 *
 * Run with: npm run watch:workspace-status
 */

import { watch } from "fs";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Configuration
const STATUS_DIR = "/tmp/claude-workspace/status";
const HEARTBEAT_FILE = "/tmp/workspace-status-watcher-heartbeat.txt";
const MAX_RUNTIME = 30 * 60 * 1000; // 30 minutes max runtime

// Track health
let lastHeartbeat = Date.now();
let startTime = Date.now();

// Write heartbeat
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
    console.error(
      `[FREEZE DETECTED] No heartbeat for ${timeSinceLastHeartbeat}ms`
    );
    process.exit(1);
  }

  if (now - startTime > MAX_RUNTIME) {
    console.log(
      `[MAX RUNTIME] Watcher has run for ${MAX_RUNTIME}ms. Exiting for restart.`
    );
    process.exit(0);
  }
}

// Process status update
async function processStatusUpdate(filename: string) {
  try {
    const statusPath = path.join(STATUS_DIR, filename);

    // Parse execution ID from filename: execution-{id}.json
    const match = filename.match(/^execution-(.+)\.json$/);
    if (!match) {
      console.log(`[SKIP] Invalid filename format: ${filename}`);
      return;
    }

    const executionId = match[1];
    console.log(`[STATUS UPDATE] Execution: ${executionId}`);

    // Read status file
    const statusData = JSON.parse(await readFile(statusPath, "utf-8"));
    console.log(
      `[DATA] Status: ${statusData.status}, Phase: ${statusData.phase || "N/A"}, Progress: ${statusData.progress || 0}%`
    );

    // Find existing execution
    const execution = await prisma.claudeExecution.findUnique({
      where: { id: executionId },
      include: { workspace: true },
    });

    if (!execution) {
      console.error(`[ERROR] Execution not found: ${executionId}`);
      return;
    }

    // Update execution record
    const updateData: any = {
      status: statusData.status,
      phase: statusData.phase || execution.phase,
      progress: statusData.progress || execution.progress,
    };

    // Handle completed status
    if (statusData.status === "completed") {
      updateData.completedAt = new Date();
      if (statusData.filesChanged) {
        updateData.filesChanged = statusData.filesChanged;
      }
      if (statusData.commitHash) {
        updateData.commitHash = statusData.commitHash;
      }
      if (statusData.commitMessage) {
        updateData.commitMessage = statusData.commitMessage;
      }
    }

    // Handle failed status
    if (statusData.status === "failed") {
      updateData.error = statusData.error || "Unknown error";
      updateData.erroredAt = new Date();
    }

    // Handle deploy status
    if (statusData.deployStatus) {
      updateData.deployStatus = statusData.deployStatus;
      if (statusData.deployStatus === "ready") {
        updateData.deployCompletedAt = new Date();
        updateData.deployUrl = statusData.deployUrl;
      }
    }

    await prisma.claudeExecution.update({
      where: { id: executionId },
      data: updateData,
    });

    console.log(`[DATABASE] Updated execution: ${executionId}`);

    // Create timeline message based on status
    let messageType: string | null = null;
    let messageContent: string | null = null;
    let messageData: any = {};

    if (statusData.status === "running" && statusData.phase) {
      // Phase update
      messageType = "claude_phase_update";
      messageContent = `Claude is ${statusData.phase}`;
      messageData = {
        executionId,
        phase: statusData.phase,
        phaseStartedAt: new Date(),
        currentTask: statusData.currentTask,
      };
    } else if (statusData.status === "completed") {
      // Completion
      messageType = "claude_completed";
      messageContent = "Claude completed the implementation";
      messageData = {
        executionId,
        duration: Math.floor(
          (new Date().getTime() - execution.triggeredAt.getTime()) / 1000
        ),
        filesChanged: statusData.filesChanged || [],
        commitHash: statusData.commitHash,
        commitMessage: statusData.commitMessage,
      };
    } else if (statusData.status === "failed") {
      // Failure
      messageType = "claude_failed";
      messageContent = `Claude failed: ${statusData.error || "Unknown error"}`;
      messageData = {
        executionId,
        error: statusData.error || "Unknown error",
        phase: execution.phase || "unknown",
        willRetry: execution.retryCount < execution.maxRetries,
        retryCount: execution.retryCount,
      };
    }

    // Create workspace message if needed
    if (messageType && execution.workspace) {
      await prisma.workspaceMessage.create({
        data: {
          workspaceId: execution.workspaceId,
          type: messageType,
          content: messageContent,
          authorType: "claude",
          executionId: executionId,
          data: messageData,
          status: statusData.status,
          progress: statusData.progress,
        },
      });

      console.log(`[TIMELINE] Created message: ${messageType}`);
    }

    await updateHeartbeat();
  } catch (error) {
    console.error(`[ERROR] Failed to process status update:`, error);
  }
}

// Main watcher
async function main() {
  console.log("[WORKSPACE STATUS WATCHER STARTED]");
  console.log(`Watching directory: ${STATUS_DIR}`);
  console.log(`Heartbeat file: ${HEARTBEAT_FILE}`);
  console.log(`Max runtime: ${MAX_RUNTIME}ms\n`);

  // Verify directory exists
  if (!existsSync(STATUS_DIR)) {
    console.error(`[ERROR] Status directory does not exist: ${STATUS_DIR}`);
    console.error("Run setup script: ./scripts/setup-claude-workspace.sh");
    process.exit(1);
  }

  // Initial heartbeat
  await updateHeartbeat();

  // Set up freeze detection
  const freezeCheckInterval = setInterval(checkForFreeze, 10000);

  // Watch for status file changes
  const watcher = watch(
    STATUS_DIR,
    { persistent: true },
    async (eventType, filename) => {
      if (!filename) return;

      // Only process JSON files
      if (!filename.endsWith(".json")) {
        return;
      }

      console.log(`[FILE EVENT] ${eventType}: ${filename}`);
      await updateHeartbeat();

      // Process status update
      if (eventType === "change" || eventType === "rename") {
        // Small delay to ensure file is fully written
        setTimeout(() => {
          processStatusUpdate(filename);
        }, 500);
      }
    }
  );

  console.log("[WATCHING] Waiting for status updates...\n");

  // Periodic heartbeat
  const heartbeatInterval = setInterval(async () => {
    await updateHeartbeat();
  }, 5000);

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("\n[SIGTERM] Shutting down gracefully...");
    clearInterval(freezeCheckInterval);
    clearInterval(heartbeatInterval);
    watcher.close();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\n[SIGINT] Shutting down gracefully...");
    clearInterval(freezeCheckInterval);
    clearInterval(heartbeatInterval);
    watcher.close();
    await prisma.$disconnect();
    process.exit(0);
  });

  // Handle watcher errors
  watcher.on("error", (error) => {
    console.error("[WATCHER ERROR]", error);
  });
}

// Start watcher
main().catch(async (error) => {
  console.error("[FATAL ERROR]", error);
  await prisma.$disconnect();
  process.exit(1);
});
