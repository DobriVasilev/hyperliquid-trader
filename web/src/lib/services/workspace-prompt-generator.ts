/**
 * Workspace Prompt Generator
 *
 * Aggregates feedback from a workspace and generates comprehensive prompts for Claude Code
 */

import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

const FEEDBACK_QUEUE_DIR = "/tmp/claude-workspace/feedback-queue";

export interface FeedbackAggregation {
  workspaceId: string;
  executionId: string;
  sessionIds: string[];
  totalCorrections: number;
  byType: {
    move: number;
    delete: number;
    add: number;
    confirm: number;
  };
  corrections: any[];
  sessions: any[];
}

/**
 * Aggregate feedback from a workspace
 */
export async function aggregateWorkspaceFeedback(
  workspaceId: string,
  sessionIds?: string[]
): Promise<FeedbackAggregation> {
  // Get workspace
  const workspace = await prisma.patternWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  // Get sessions to process
  const sessionsQuery = sessionIds
    ? { id: { in: sessionIds }, workspaceId }
    : { workspaceId };

  const sessions = await prisma.patternSession.findMany({
    where: sessionsQuery,
    include: {
      corrections: {
        where: {
          status: "pending", // Only process pending corrections
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          detection: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Aggregate corrections
  const allCorrections: any[] = [];
  const byType = { move: 0, delete: 0, add: 0, confirm: 0 };

  sessions.forEach((session) => {
    session.corrections.forEach((correction) => {
      allCorrections.push(correction);
      const type = correction.correctionType as keyof typeof byType;
      if (type in byType) {
        byType[type]++;
      }
    });
  });

  return {
    workspaceId,
    executionId: "", // Will be set when creating execution
    sessionIds: sessions.map((s) => s.id),
    totalCorrections: allCorrections.length,
    byType,
    corrections: allCorrections,
    sessions: sessions.map((s) => ({
      id: s.id,
      name: s.name,
      symbol: s.symbol,
      timeframe: s.timeframe,
      patternType: s.patternType,
      correctionCount: s.corrections.length,
    })),
  };
}

/**
 * Generate feedback prompt for Claude
 */
export function generateWorkspacePrompt(
  workspace: any,
  aggregation: FeedbackAggregation
): string {
  const { corrections, sessions, byType } = aggregation;

  let prompt = `# Pattern Implementation Feedback

## Workspace Information
- **Pattern Type**: ${workspace.patternType}
- **Pattern Name**: ${workspace.name}
- **Category**: ${workspace.category}
- **Current Status**: ${workspace.status}
- **Version**: ${workspace.version}

## Pattern Description
${workspace.description || "No description provided"}

${workspace.identificationSteps ? `### Identification Steps\n${JSON.parse(workspace.identificationSteps as string).map((step: string, i: number) => `${i + 1}. ${step}`).join("\n")}` : ""}

## Feedback Summary
- **Total Corrections**: ${aggregation.totalCorrections}
- **Move Corrections**: ${byType.move}
- **Delete Corrections**: ${byType.delete}
- **Add Corrections**: ${byType.add}
- **Confirm Corrections**: ${byType.confirm}
- **Sessions Analyzed**: ${sessions.length}

## Test Sessions

`;

  sessions.forEach((session, idx) => {
    prompt += `### Session ${idx + 1}: ${session.name}
- **Symbol**: ${session.symbol}
- **Timeframe**: ${session.timeframe}
- **Corrections**: ${session.correctionCount}

`;
  });

  prompt += `## Detailed Corrections

`;

  corrections.forEach((correction, idx) => {
    prompt += `### Correction ${idx + 1}: ${correction.correctionType.toUpperCase()}
- **User**: ${correction.user.name || correction.user.email} (${correction.user.role})
- **Created**: ${correction.createdAt.toISOString()}
- **Type**: ${correction.correctionType}

`;

    if (correction.correctionType === "move") {
      prompt += `#### Original Position
- Index: ${correction.originalIndex}
- Time: ${correction.originalTime}
- Price: ${correction.originalPrice}
- Type: ${correction.originalType}

#### Corrected Position
- Index: ${correction.correctedIndex}
- Time: ${correction.correctedTime}
- Price: ${correction.correctedPrice}
${correction.correctedType ? `- Type: ${correction.correctedType}` : ""}
${correction.correctedStructure ? `- Structure: ${correction.correctedStructure}` : ""}

`;
    } else if (correction.correctionType === "delete") {
      prompt += `#### Detection to Delete
- Index: ${correction.originalIndex}
- Time: ${correction.originalTime}
- Price: ${correction.originalPrice}
- Type: ${correction.originalType}

`;
    } else if (correction.correctionType === "add") {
      prompt += `#### New Detection to Add
- Index: ${correction.correctedIndex}
- Time: ${correction.correctedTime}
- Price: ${correction.correctedPrice}
${correction.correctedType ? `- Type: ${correction.correctedType}` : ""}
${correction.correctedStructure ? `- Structure: ${correction.correctedStructure}` : ""}

`;
    }

    prompt += `#### Reasoning
${correction.reason}

`;

    if (correction.attachments) {
      const attachments = JSON.parse(correction.attachments as string);
      if (attachments && attachments.length > 0) {
        prompt += `#### Attachments
${attachments.map((a: any) => `- ${a.name}: ${a.url}`).join("\n")}

`;
      }
    }

    prompt += `---

`;
  });

  prompt += `## Implementation Instructions

### Your Task
1. **Analyze** all corrections above carefully
2. **Identify** the root causes and patterns in the feedback
3. **Plan** the necessary algorithmic changes
4. **Implement** the fixes in the pattern detection files
5. **Test** the changes against the provided test cases
6. **Commit** with a clear, descriptive message
7. **Report** progress to the status file

### Files to Focus On
Based on the pattern type "${workspace.patternType}", you should focus on:
- Pattern detection algorithm files
- Pattern configuration files
- Test files related to this pattern

### Quality Standards
- Follow the coding standards in CLAUDE_STANDARDS_TEMPLATE.md
- Ensure changes are minimal and focused
- Add comments explaining the reasoning behind algorithmic changes
- Update tests if needed
- Ensure backward compatibility with existing data

### Progress Reporting
Update status file at: /tmp/claude-workspace/status/execution-${aggregation.executionId}.json

**Format**:
\`\`\`json
{
  "status": "running",
  "phase": "implementing",
  "progress": 45,
  "currentTask": "Updating swing detection logic",
  "timestamp": "..."
}
\`\`\`

**Phases**: planning, implementing, testing, refining, deploying

### When Complete
Final status:
\`\`\`json
{
  "status": "completed",
  "phase": "deploying",
  "progress": 100,
  "filesChanged": ["path/to/file1.ts", "path/to/file2.ts"],
  "commitHash": "abc123...",
  "commitMessage": "Fix swing detection based on user feedback",
  "timestamp": "..."
}
\`\`\`

### On Error
Error status:
\`\`\`json
{
  "status": "failed",
  "error": "description of what went wrong",
  "phase": "current phase",
  "timestamp": "..."
}
\`\`\`

Begin implementation now.
`;

  return prompt;
}

/**
 * Create feedback file for Claude processing
 */
export async function createWorkspaceFeedbackFile(
  workspaceId: string,
  executionId: string,
  sessionIds?: string[]
): Promise<string> {
  // Ensure feedback queue directory exists
  if (!existsSync(FEEDBACK_QUEUE_DIR)) {
    await mkdir(FEEDBACK_QUEUE_DIR, { recursive: true });
  }

  // Get workspace with full details
  const workspace = await prisma.patternWorkspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  // Aggregate feedback
  const aggregation = await aggregateWorkspaceFeedback(workspaceId, sessionIds);
  aggregation.executionId = executionId;

  // Generate prompt
  const prompt = generateWorkspacePrompt(workspace, aggregation);

  // Create feedback JSON structure
  const feedbackData = {
    workspaceId,
    executionId,
    patternType: workspace.patternType,
    version: workspace.version,
    timestamp: new Date().toISOString(),
    context: {
      patternName: workspace.name,
      category: workspace.category,
      currentStatus: workspace.status,
      description: workspace.description,
    },
    sessions: aggregation.sessions,
    corrections: aggregation.corrections.map((c) => ({
      id: c.id,
      type: c.correctionType,
      originalIndex: c.originalIndex,
      originalTime: c.originalTime,
      originalPrice: c.originalPrice,
      correctedIndex: c.correctedIndex,
      correctedTime: c.correctedTime,
      correctedPrice: c.correctedPrice,
      reason: c.reason,
      attachments: c.attachments,
      user: {
        name: c.user.name || c.user.email,
        role: c.user.role,
      },
    })),
    aggregatedSummary: {
      totalCorrections: aggregation.totalCorrections,
      byType: aggregation.byType,
    },
    prompt,
  };

  // Write to feedback queue
  const filename = `execution-${executionId}.json`;
  const filepath = path.join(FEEDBACK_QUEUE_DIR, filename);

  await writeFile(filepath, JSON.stringify(feedbackData, null, 2));

  console.log(`[WORKSPACE] Created feedback file: ${filename}`);

  return filename;
}

/**
 * Create Claude execution record and feedback file
 */
export async function triggerWorkspaceExecution(
  workspaceId: string,
  userId: string,
  sessionIds?: string[]
): Promise<string> {
  // Aggregate feedback first to validate
  const aggregation = await aggregateWorkspaceFeedback(workspaceId, sessionIds);

  if (aggregation.totalCorrections === 0) {
    throw new Error("No pending corrections found to process");
  }

  // Create execution record
  const execution = await prisma.claudeExecution.create({
    data: {
      workspaceId,
      triggeredBy: userId,
      status: "pending",
      phase: "planning",
      progress: 0,
      sessionIds: aggregation.sessionIds,
      feedbackType: "pattern_corrections",
    },
  });

  // Create feedback file
  const filename = await createWorkspaceFeedbackFile(
    workspaceId,
    execution.id,
    sessionIds
  );

  // Create timeline messages
  await prisma.workspaceMessage.create({
    data: {
      workspaceId,
      type: "feedback_batch_sent",
      content: `Sent ${aggregation.totalCorrections} corrections to Claude`,
      authorId: userId,
      authorType: "user",
      executionId: execution.id,
      data: {
        sessionId: sessionIds?.[0],
        feedbackIds: aggregation.corrections.map((c) => c.id),
        feedbackCount: aggregation.totalCorrections,
        totalComments: aggregation.totalCorrections,
      },
    },
  });

  await prisma.workspaceMessage.create({
    data: {
      workspaceId,
      type: "claude_started",
      content: "Claude started processing feedback",
      authorType: "claude",
      executionId: execution.id,
      status: "in_progress",
      progress: 0,
      data: {
        executionId: execution.id,
        feedbackCount: aggregation.totalCorrections,
      },
    },
  });

  // Update workspace status to implementing
  await prisma.patternWorkspace.update({
    where: { id: workspaceId },
    data: {
      status: "implementing",
    },
  });

  console.log(`[WORKSPACE] Created execution: ${execution.id}`);
  console.log(`[WORKSPACE] Feedback file: ${filename}`);

  return execution.id;
}
