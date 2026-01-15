#!/usr/bin/env tsx

/**
 * Workspace Deploy Monitor
 *
 * Polls Vercel API for deployment status after Claude commits changes
 * Tracks deployment progress and handles failures with retry logic
 *
 * Run with: npm run monitor:workspace-deploy
 */

import { PrismaClient } from "@prisma/client";
import { writeFile } from "fs/promises";

const prisma = new PrismaClient();

// Configuration
const POLL_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_FILE = "/tmp/workspace-deploy-monitor-heartbeat.txt";
const MAX_RUNTIME = 30 * 60 * 1000; // 30 minutes
const MAX_RETRIES = 10;

// Vercel API configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
  console.error("[ERROR] Missing Vercel configuration:");
  console.error("- VERCEL_TOKEN:", VERCEL_TOKEN ? "✓" : "✗");
  console.error("- VERCEL_PROJECT_ID:", VERCEL_PROJECT_ID ? "✓" : "✗");
  process.exit(1);
}

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
  if (now - lastHeartbeat > 60000) {
    console.error(`[FREEZE DETECTED] No heartbeat for ${now - lastHeartbeat}ms`);
    process.exit(1);
  }
  if (now - startTime > MAX_RUNTIME) {
    console.log(`[MAX RUNTIME] Monitor has run for ${MAX_RUNTIME}ms. Exiting.`);
    process.exit(0);
  }
}

// Fetch deployments from Vercel
async function fetchVercelDeployments(): Promise<any[]> {
  try {
    const url = new URL(
      `https://api.vercel.com/v6/deployments`
    );
    url.searchParams.set("projectId", VERCEL_PROJECT_ID!);
    if (VERCEL_TEAM_ID) {
      url.searchParams.set("teamId", VERCEL_TEAM_ID);
    }
    url.searchParams.set("limit", "20");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Vercel API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.deployments || [];
  } catch (error) {
    console.error("[ERROR] Failed to fetch deployments:", error);
    return [];
  }
}

// Fetch deployment logs from Vercel
async function fetchDeploymentLogs(deploymentId: string): Promise<string> {
  try {
    const url = new URL(
      `https://api.vercel.com/v2/deployments/${deploymentId}/events`
    );
    if (VERCEL_TEAM_ID) {
      url.searchParams.set("teamId", VERCEL_TEAM_ID);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      return `Failed to fetch logs: ${response.status} ${response.statusText}`;
    }

    const logs = await response.text();

    // Parse and extract error messages
    const lines = logs.split("\n").filter(Boolean);
    const errorLines = lines.filter(
      (line) =>
        line.includes("Error") ||
        line.includes("error") ||
        line.includes("Failed") ||
        line.includes("failed")
    );

    return errorLines.length > 0
      ? errorLines.slice(-50).join("\n") // Last 50 error lines
      : lines.slice(-100).join("\n"); // Last 100 lines if no errors
  } catch (error) {
    return `Failed to fetch logs: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Process deployment status
async function processDeployment(deployment: any) {
  try {
    const commitHash = deployment.meta?.githubCommitSha || deployment.meta?.gitSource?.sha;

    if (!commitHash) {
      return; // Skip deployments without commit info
    }

    // Find execution by commit hash
    const execution = await prisma.claudeExecution.findFirst({
      where: {
        commitHash: commitHash,
        status: "completed",
      },
      include: {
        workspace: true,
      },
    });

    if (!execution) {
      return; // Not a Claude execution
    }

    const deploymentStatus = deployment.state || deployment.status;
    const deploymentUrl = deployment.url ? `https://${deployment.url}` : null;

    console.log(
      `[DEPLOYMENT] Execution: ${execution.id}, Status: ${deploymentStatus}`
    );

    // Check if status changed
    if (execution.deployStatus === deploymentStatus) {
      return; // No change
    }

    // Update execution
    const updateData: any = {
      deployStatus: deploymentStatus,
    };

    // Handle deployment start
    if (
      deploymentStatus === "QUEUED" ||
      deploymentStatus === "BUILDING"
    ) {
      if (!execution.deployStartedAt) {
        updateData.deployStartedAt = new Date();

        // Create timeline message
        await prisma.workspaceMessage.create({
          data: {
            workspaceId: execution.workspaceId,
            type: "deploy_started",
            content: "Deployment started",
            authorType: "system",
            executionId: execution.id,
            status: "in_progress",
            data: {
              executionId: execution.id,
              commitHash: commitHash,
              deploymentId: deployment.id,
            },
          },
        });
      }

      if (deploymentStatus === "BUILDING") {
        await prisma.workspaceMessage.create({
          data: {
            workspaceId: execution.workspaceId,
            type: "deploy_building",
            content: "Deployment building...",
            authorType: "system",
            executionId: execution.id,
            status: "in_progress",
            data: {
              executionId: execution.id,
              deploymentId: deployment.id,
            },
          },
        });
      }
    }

    // Handle deployment success
    if (deploymentStatus === "READY") {
      updateData.deployCompletedAt = new Date();
      updateData.deployUrl = deploymentUrl;

      await prisma.workspaceMessage.create({
        data: {
          workspaceId: execution.workspaceId,
          type: "deploy_success",
          content: "Deployment successful",
          authorType: "system",
          executionId: execution.id,
          status: "completed",
          data: {
            executionId: execution.id,
            deploymentId: deployment.id,
            deployUrl: deploymentUrl,
            version: execution.workspace.version,
            duration: execution.deployStartedAt
              ? Math.floor(
                  (new Date().getTime() - execution.deployStartedAt.getTime()) /
                    1000
                )
              : 0,
          },
        },
      });

      // Update workspace version on successful deploy
      const versionParts = execution.workspace.version.split(".");
      const newPatch = parseInt(versionParts[2] || "0") + 1;
      const newVersion = `${versionParts[0]}.${versionParts[1]}.${newPatch}`;

      await prisma.patternWorkspace.update({
        where: { id: execution.workspaceId },
        data: {
          version: newVersion,
          lastTestedAt: new Date(),
        },
      });

      console.log(`[SUCCESS] Deployment completed for execution ${execution.id}`);
    }

    // Handle deployment failure
    if (deploymentStatus === "ERROR" || deploymentStatus === "CANCELED") {
      // Fetch logs
      const logs = await fetchDeploymentLogs(deployment.id);
      updateData.deployLogs = logs;

      // Check retry count
      const willRetry = execution.retryCount < MAX_RETRIES;

      if (willRetry) {
        // Increment retry count
        updateData.retryCount = execution.retryCount + 1;
        updateData.retryReason = `Deploy failed: ${deploymentStatus}`;

        // Create retry message
        await prisma.workspaceMessage.create({
          data: {
            workspaceId: execution.workspaceId,
            type: "deploy_retry",
            content: `Deployment failed, retrying (${execution.retryCount + 1}/${MAX_RETRIES})`,
            authorType: "system",
            executionId: execution.id,
            status: "in_progress",
            data: {
              executionId: execution.id,
              retryNumber: execution.retryCount + 1,
              maxRetries: MAX_RETRIES,
              previousError: `Deploy ${deploymentStatus}`,
            },
          },
        });

        // Create new feedback file with error context
        // This will trigger Claude to fix the deploy error
        const errorContext = `
# Deployment Error - Retry ${execution.retryCount + 1}/${MAX_RETRIES}

The previous deployment failed with status: ${deploymentStatus}

## Error Logs
\`\`\`
${logs}
\`\`\`

## Your Task
1. Analyze the deployment error logs above
2. Identify the root cause
3. Fix the issue
4. Commit the fix
5. The deployment will be automatically triggered

Focus on fixing the build/deployment error, not the original pattern implementation.
`;

        console.log(`[RETRY] Triggering retry ${execution.retryCount + 1}/${MAX_RETRIES}`);

        // In a real implementation, you would trigger Claude here
        // For now, just log it
        console.log("[TODO] Trigger Claude with error context");
      } else {
        // Max retries reached
        updateData.status = "failed";
        updateData.error = `Deployment failed after ${MAX_RETRIES} retries`;

        await prisma.workspaceMessage.create({
          data: {
            workspaceId: execution.workspaceId,
            type: "deploy_failed",
            content: `Deployment failed after ${MAX_RETRIES} retries`,
            authorType: "system",
            executionId: execution.id,
            status: "failed",
            data: {
              executionId: execution.id,
              deploymentId: deployment.id,
              error: `Deploy ${deploymentStatus}`,
              logs: logs.substring(0, 5000), // Limit log size
              retryCount: execution.retryCount,
              willRetry: false,
            },
          },
        });

        console.log(`[FAILED] Max retries reached for execution ${execution.id}`);

        // TODO: Send email to admin
        console.log("[TODO] Send email notification to admin");
      }
    }

    await prisma.claudeExecution.update({
      where: { id: execution.id },
      data: updateData,
    });

    await updateHeartbeat();
  } catch (error) {
    console.error("[ERROR] Failed to process deployment:", error);
  }
}

// Main polling loop
async function pollDeployments() {
  try {
    await updateHeartbeat();

    console.log(`[${new Date().toISOString()}] Polling Vercel deployments...`);

    const deployments = await fetchVercelDeployments();
    console.log(`[DEPLOYMENTS] Found ${deployments.length} recent deployments`);

    for (const deployment of deployments) {
      await processDeployment(deployment);
    }
  } catch (error) {
    console.error("[ERROR] Polling error:", error);
  }
}

// Main loop
async function main() {
  console.log("[WORKSPACE DEPLOY MONITOR STARTED]");
  console.log(`Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`Max runtime: ${MAX_RUNTIME}ms`);
  console.log(`Heartbeat file: ${HEARTBEAT_FILE}`);
  console.log(`Max retries: ${MAX_RETRIES}\n`);

  // Initial heartbeat
  await updateHeartbeat();

  // Set up freeze detection
  const freezeCheckInterval = setInterval(checkForFreeze, 10000);

  // Set up polling
  const pollInterval = setInterval(async () => {
    await pollDeployments();
  }, POLL_INTERVAL);

  // Initial poll
  await pollDeployments();

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("\n[SIGTERM] Shutting down gracefully...");
    clearInterval(pollInterval);
    clearInterval(freezeCheckInterval);
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\n[SIGINT] Shutting down gracefully...");
    clearInterval(pollInterval);
    clearInterval(freezeCheckInterval);
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Start monitor
main().catch(async (error) => {
  console.error("[FATAL ERROR]", error);
  await prisma.$disconnect();
  process.exit(1);
});
