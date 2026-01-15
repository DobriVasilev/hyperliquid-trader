#!/usr/bin/env tsx

/**
 * End-to-End Test for Autonomous Feedback Workflow
 *
 * This script tests the complete Phase 2 implementation:
 * 1. Creates test workspace and session with corrections
 * 2. Feedback watcher detects pending corrections
 * 3. Creates feedback queue file
 * 4. Claude worker processes feedback
 * 5. Status updates written
 * 6. Deploy monitor tracks deployment
 *
 * Usage: npx tsx scripts/test-autonomous-workflow.ts
 */

import { PrismaClient } from "@prisma/client";
import { ulid } from "ulid";

const prisma = new PrismaClient();

async function createTestWorkspace() {
  console.log("\n=".repeat(60));
  console.log("PHASE 2.6: End-to-End Workflow Test");
  console.log("=".repeat(60));

  // Get admin user (or first user)
  let user = await prisma.user.findFirst({
    where: { role: "admin" },
  });

  if (!user) {
    user = await prisma.user.findFirst();
  }

  if (!user) {
    console.error("❌ No users found in database. Please create a user first.");
    process.exit(1);
  }

  console.log(`\n✅ Using user: ${user.email} (${user.role})`);

  // Check if test workspace already exists
  let workspace = await prisma.patternWorkspace.findUnique({
    where: { patternType: "TEST_AUTO" },
  });

  if (workspace) {
    console.log("\n⚠️  Test workspace already exists. Cleaning up...");

    // Delete existing sessions and executions
    await prisma.patternSession.deleteMany({
      where: { workspaceId: workspace.id },
    });

    await prisma.claudeExecution.deleteMany({
      where: { workspaceId: workspace.id },
    });

    await prisma.workspaceMessage.deleteMany({
      where: { workspaceId: workspace.id },
    });

    await prisma.patternWorkspace.delete({
      where: { id: workspace.id },
    });

    console.log("✅ Cleaned up old test data");
  }

  // Create test workspace
  console.log("\n📝 Creating test workspace...");
  workspace = await prisma.patternWorkspace.create({
    data: {
      patternType: "TEST_AUTO",
      name: "Test Autonomous Workflow",
      category: "test",
      status: "implementing",
      version: "1.0.0",
      description: "This is a test workspace for validating the autonomous feedback system.",
      userReasoning: "Testing end-to-end workflow from feedback submission to Claude Code execution.",
      createdById: user.id,
    },
  });

  console.log(`✅ Workspace created: ${workspace.id}`);

  // Create test session with corrections
  console.log("\n📊 Creating test session with corrections...");

  // Generate ULIDs for session and corrections
  const sessionId = ulid();
  const correction1Id = ulid();
  const correction2Id = ulid();

  const session = await prisma.patternSession.create({
    data: {
      id: sessionId,
      name: "Test Autonomous Workflow Session",
      workspaceId: workspace.id,
      patternType: "TEST_AUTO",
      symbol: "BTCUSDT",
      timeframe: "1h",
      startTime: new Date("2024-01-01"),
      endTime: new Date("2024-01-31"),
      status: "submitted_for_review",
      createdById: user.id,
      corrections: {
        create: [
          {
            id: correction1Id,
            correctionType: "missing_detection",
            reason: "Pattern should have been detected at this candle but was missed",
            originalTime: new Date("2024-01-15T10:00:00Z"),
            originalPrice: 42500.00,
            correctedTime: new Date("2024-01-15T10:00:00Z"),
            correctedPrice: 42500.00,
            correctedType: "bullish",
            userId: user.id,
          },
          {
            id: correction2Id,
            correctionType: "false_positive",
            reason: "This detection is incorrect - no valid pattern exists here",
            originalTime: new Date("2024-01-20T14:30:00Z"),
            originalPrice: 43200.00,
            correctedTime: new Date("2024-01-20T14:30:00Z"),
            correctedPrice: 43200.00,
            userId: user.id,
          },
        ],
      },
    },
    include: {
      corrections: true,
    },
  });

  console.log(`✅ Session created with ${session.corrections.length} corrections`);

  // Display test data summary
  console.log("\n" + "=".repeat(60));
  console.log("TEST DATA CREATED");
  console.log("=".repeat(60));
  console.log(`Workspace ID: ${workspace.id}`);
  console.log(`Pattern Type: ${workspace.patternType}`);
  console.log(`Session ID: ${session.id}`);
  console.log(`Corrections: ${session.corrections.length}`);
  console.log(`Status: ${session.status}`);

  // Instructions for monitoring
  console.log("\n" + "=".repeat(60));
  console.log("MONITORING THE WORKFLOW");
  console.log("=".repeat(60));
  console.log("\nOn your server, run these commands to watch the workflow:\n");
  console.log("# Terminal 1: Watch feedback watcher");
  console.log("pm2 logs workspace-feedback\n");
  console.log("# Terminal 2: Watch Claude worker");
  console.log("pm2 logs claude-worker\n");
  console.log("# Terminal 3: Watch status updates");
  console.log("ls -la /tmp/claude-workspace/status/\n");
  console.log("# Terminal 4: Watch feedback queue");
  console.log("ls -la /tmp/claude-workspace/feedback-queue/\n");

  console.log("\n" + "=".repeat(60));
  console.log("EXPECTED WORKFLOW");
  console.log("=".repeat(60));
  console.log("\n1. ⏰ Feedback watcher polls every 10s");
  console.log("2. 🔍 Detects session with corrections");
  console.log("3. 📝 Creates execution record in database");
  console.log("4. 📄 Generates prompt file");
  console.log("5. 📦 Creates feedback queue JSON file");
  console.log("6. 🤖 Claude worker detects queue file");
  console.log("7. 🚀 Launches Claude Code with prompt");
  console.log("8. 📊 Status updates written during execution");
  console.log("9. ✅ Claude makes changes and commits");
  console.log("10. 🚢 Deploy monitor tracks deployment");

  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION QUERIES");
  console.log("=".repeat(60));
  console.log("\nYou can check the database for execution records:\n");
  console.log(`SELECT * FROM "ClaudeExecution" WHERE "workspaceId" = '${workspace.id}';`);
  console.log(`SELECT * FROM "WorkspaceMessage" WHERE "workspaceId" = '${workspace.id}';`);

  console.log("\n✅ Test setup complete! The feedback watcher should detect this within 10 seconds.");
  console.log("⏰ Watch the logs on your server to see the workflow in action.\n");

  await prisma.$disconnect();
}

// Run the test
createTestWorkspace().catch((error) => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
