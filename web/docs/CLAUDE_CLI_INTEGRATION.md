# Claude CLI Integration Design

## Overview

Option B: Long-running Claude Code process that stays idle, monitoring a feedback file. When new feedback is written, Claude wakes up, processes it, makes code changes, commits, and reports progress back.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Web Application                              │
│                                                                  │
│  User gives feedback → Aggregate → Write to feedback file      │
│                                          ↓                       │
│                                    feedback-queue/              │
│                                    workspace-{id}.json          │
└─────────────────────────────────────────────────────────────────┘
                                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Feedback Watcher (Node.js process)                 │
│                                                                  │
│  - Watches feedback-queue/ directory                           │
│  - Detects new/modified files                                  │
│  - Reads feedback JSON                                         │
│  - Triggers Claude CLI with feedback                           │
└─────────────────────────────────────────────────────────────────┘
                                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Claude Code (Long-running process)                 │
│                                                                  │
│  - Runs continuously in background                             │
│  - Executes: tail -f feedback-pipe                             │
│  - Claude stays idle until new line appears                    │
│  - When feedback arrives → Process it                          │
│  - Make code changes                                           │
│  - Git commit & push                                           │
│  - Write progress updates to status file                       │
└─────────────────────────────────────────────────────────────────┘
                                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Status Watcher (Node.js process)                   │
│                                                                  │
│  - Watches status/ directory                                   │
│  - Detects progress updates from Claude                        │
│  - Creates WorkspaceMessage entries                            │
│  - Updates ClaudeExecution record                              │
└─────────────────────────────────────────────────────────────────┘
                                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Deploy Monitor (Node.js/cron)                      │
│                                                                  │
│  - Polls Vercel API for deployment status                      │
│  - On success → Create DEPLOY_SUCCESS message                  │
│  - On failure → Extract logs → Send back to Claude             │
│  - Retry up to 10 times                                        │
│  - If all fail → Email admin                                   │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
/tmp/claude-workspace/
├── feedback-queue/
│   ├── workspace-swings.json
│   ├── workspace-bos.json
│   └── workspace-choch.json
│
├── feedback-pipe              # Named pipe for Claude to monitor
│
├── status/
│   ├── execution-{id}.json    # Progress updates from Claude
│   └── execution-{id}.json
│
├── prompts/
│   ├── workspace-swings-prompt.md
│   └── workspace-bos-prompt.md
│
└── logs/
    ├── feedback-watcher.log
    ├── status-watcher.log
    ├── claude-output.log
    └── deploy-monitor.log
```

## Feedback File Format

```json
{
  "workspaceId": "clx123abc",
  "executionId": "clx456def",
  "patternType": "swings",
  "version": "1.2.3",

  "timestamp": "2026-01-15T10:30:00Z",

  "context": {
    "patternName": "Swing Detection",
    "category": "Price Action",
    "currentStatus": "beta",
    "description": "Identifies swing highs and lows in price action"
  },

  "session": {
    "id": "session123",
    "name": "BTC 4h - Testing swings",
    "symbol": "BTC",
    "timeframe": "4h",
    "dateRange": {
      "start": "2026-01-01T00:00:00Z",
      "end": "2026-01-10T00:00:00Z"
    },
    "candleCount": 720
  },

  "feedback": [
    {
      "id": "fb1",
      "type": "false_positive",
      "timestamp": "2026-01-15T10:25:00Z",
      "candleTime": "2026-01-05T08:00:00Z",
      "candleIndex": 240,
      "reasoning": "This swing high is detected but price immediately broke through it, indicating it's not a valid swing point.",
      "attachments": [
        "https://example.com/image1.png"
      ],
      "metadata": {
        "price": 42350.5,
        "swingType": "high"
      }
    },
    {
      "id": "fb2",
      "type": "false_negative",
      "timestamp": "2026-01-15T10:27:00Z",
      "candleTime": "2026-01-06T12:00:00Z",
      "candleIndex": 312,
      "reasoning": "Clear swing low here with strong bounce, but algorithm missed it. Should look for at least 3 candles on each side.",
      "attachments": [],
      "metadata": {
        "price": 41200.0,
        "expectedSwingType": "low"
      }
    },
    {
      "id": "fb3",
      "type": "adjustment",
      "timestamp": "2026-01-15T10:28:00Z",
      "reasoning": "Consider increasing the swing strength threshold to filter out minor swings. Maybe use ATR-based threshold instead of fixed percentage.",
      "attachments": []
    }
  ],

  "aggregatedSummary": {
    "totalFeedback": 3,
    "falsePositives": 1,
    "falseNegatives": 1,
    "adjustments": 1,
    "commonThemes": [
      "Swing detection too sensitive",
      "Need better confirmation criteria",
      "Consider ATR-based thresholds"
    ]
  },

  "instructions": {
    "task": "Fix the swing detection algorithm based on the feedback provided.",
    "goals": [
      "Reduce false positives by adding stronger confirmation",
      "Catch missed swing lows with proper lookback",
      "Consider ATR-based dynamic thresholds"
    ],
    "constraints": [
      "Maintain backward compatibility with existing sessions",
      "Don't change the API response format",
      "Keep performance under 100ms per detection"
    ],
    "files": [
      "src/lib/detectors/swings.ts",
      "src/lib/detectors/utils/swing-confirmation.ts"
    ]
  },

  "standards": {
    "templatePath": "CLAUDE_STANDARDS_TEMPLATE.md",
    "qualityChecklist": [
      "Read CLAUDE_STANDARDS_TEMPLATE.md first",
      "Deep analysis before implementation",
      "Industry-standard code quality",
      "Comprehensive error handling",
      "Performance optimization",
      "Security review",
      "Testing coverage",
      "Documentation updates"
    ]
  }
}
```

## Claude CLI Command

The Claude Code process runs continuously with:

```bash
#!/bin/bash

# Navigate to project directory
cd /Users/dobri/Scripts/systems-trader/web

# Start Claude Code in continuous monitoring mode
# Claude will stay idle, monitoring the feedback pipe
# When a new line appears in the pipe, Claude processes it

while true; do
  # Read from the named pipe (blocks until data available)
  if read -r feedback_file < /tmp/claude-workspace/feedback-pipe; then
    echo "[$(date)] Received feedback file: $feedback_file"

    # Read the feedback JSON
    feedback_path="/tmp/claude-workspace/feedback-queue/$feedback_file"

    if [ -f "$feedback_path" ]; then
      # Extract execution ID for status tracking
      execution_id=$(jq -r '.executionId' "$feedback_path")

      # Write status: Started
      echo "{\"status\":\"started\",\"phase\":\"planning\",\"timestamp\":\"$(date -Iseconds)\"}" > \
        "/tmp/claude-workspace/status/execution-${execution_id}.json"

      # Call Claude Code with the feedback
      claude code --prompt "$(cat <<EOF
You are an expert trading algorithm developer. You have received feedback about the pattern detection algorithm.

# CRITICAL: Read Standards First
Before proceeding, read and internalize the standards in CLAUDE_STANDARDS_TEMPLATE.md.
This defines the quality bar for ALL implementations.

# Feedback Context
$(cat "$feedback_path")

# Your Task
1. Analyze the feedback carefully
2. Identify the root causes of the issues
3. Plan the necessary changes
4. Implement the fixes in the relevant files
5. Test the changes
6. Commit with a clear message
7. Report progress to the status file

# Progress Reporting
After each major step, update the status file at:
/tmp/claude-workspace/status/execution-${execution_id}.json

Format: {"status":"running","phase":"implementing","progress":45,"currentTask":"Updating swing detection logic","timestamp":"..."}

# When Complete
Final status: {"status":"completed","phase":"deploying","progress":100,"filesChanged":[...],"commitHash":"...","timestamp":"..."}

# On Error
Error status: {"status":"failed","error":"description","phase":"...","timestamp":"..."}

Begin.
EOF
      )" 2>&1 | tee "/tmp/claude-workspace/logs/claude-execution-${execution_id}.log"

      # Check exit code
      if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo "[$(date)] Claude completed successfully for execution ${execution_id}"
      else
        echo "[$(date)] Claude failed for execution ${execution_id}"
        echo "{\"status\":\"failed\",\"error\":\"Claude process exited with error\",\"timestamp\":\"$(date -Iseconds)\"}" > \
          "/tmp/claude-workspace/status/execution-${execution_id}.json"
      fi

      # Clean up processed feedback file
      rm "$feedback_path"
    else
      echo "[$(date)] Feedback file not found: $feedback_path"
    fi
  fi
done
```

## Feedback Watcher (Node.js)

```typescript
// scripts/feedback-watcher.ts
import { watch } from 'fs';
import { readFile, appendFile } from 'fs/promises';
import path from 'path';

const FEEDBACK_DIR = '/tmp/claude-workspace/feedback-queue';
const FEEDBACK_PIPE = '/tmp/claude-workspace/feedback-pipe';

console.log('[Feedback Watcher] Starting...');
console.log('[Feedback Watcher] Watching:', FEEDBACK_DIR);

// Watch for new feedback files
watch(FEEDBACK_DIR, async (eventType, filename) => {
  if (eventType === 'rename' && filename?.endsWith('.json')) {
    console.log(`[Feedback Watcher] New feedback detected: ${filename}`);

    try {
      const feedbackPath = path.join(FEEDBACK_DIR, filename);

      // Verify file exists and is readable
      const content = await readFile(feedbackPath, 'utf-8');
      const feedback = JSON.parse(content);

      console.log(`[Feedback Watcher] Triggering Claude for workspace: ${feedback.patternType}`);
      console.log(`[Feedback Watcher] Execution ID: ${feedback.executionId}`);
      console.log(`[Feedback Watcher] Feedback items: ${feedback.feedback.length}`);

      // Write filename to the pipe (wakes up Claude)
      await appendFile(FEEDBACK_PIPE, filename + '\n');

      console.log('[Feedback Watcher] Claude triggered successfully');

    } catch (error) {
      console.error('[Feedback Watcher] Error processing feedback:', error);
    }
  }
});

console.log('[Feedback Watcher] Ready. Waiting for feedback...');

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n[Feedback Watcher] Shutting down...');
  process.exit(0);
});
```

## Status Watcher (Node.js)

```typescript
// scripts/status-watcher.ts
import { watch } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '../src/lib/db';

const STATUS_DIR = '/tmp/claude-workspace/status';

console.log('[Status Watcher] Starting...');
console.log('[Status Watcher] Watching:', STATUS_DIR);

// Watch for status updates from Claude
watch(STATUS_DIR, async (eventType, filename) => {
  if (eventType === 'change' && filename?.startsWith('execution-')) {
    const executionId = filename.replace('execution-', '').replace('.json', '');

    try {
      const statusPath = path.join(STATUS_DIR, filename);
      const content = await readFile(statusPath, 'utf-8');
      const status = JSON.parse(content);

      console.log(`[Status Watcher] Update for ${executionId}: ${status.phase} (${status.progress}%)`);

      // Update database
      await prisma.claudeExecution.update({
        where: { id: executionId },
        data: {
          status: status.status,
          phase: status.phase,
          progress: status.progress,
          error: status.error,
          filesChanged: status.filesChanged,
          commitHash: status.commitHash,
          completedAt: status.status === 'completed' ? new Date() : undefined,
          erroredAt: status.status === 'failed' ? new Date() : undefined,
        },
      });

      // Create timeline message
      const messageType = getMessageType(status);
      if (messageType) {
        const execution = await prisma.claudeExecution.findUnique({
          where: { id: executionId },
          select: { workspaceId: true },
        });

        await prisma.workspaceMessage.create({
          data: {
            workspaceId: execution.workspaceId,
            executionId,
            type: messageType,
            authorType: 'claude',
            title: getMessageTitle(status),
            content: status.currentTask || status.error,
            status: status.status,
            progress: status.progress,
            data: status,
          },
        });
      }

    } catch (error) {
      console.error('[Status Watcher] Error processing status update:', error);
    }
  }
});

function getMessageType(status: any): string | null {
  if (status.status === 'started') return 'claude_started';
  if (status.phase) return 'claude_phase_update';
  if (status.status === 'completed') return 'claude_completed';
  if (status.status === 'failed') return 'claude_failed';
  return null;
}

function getMessageTitle(status: any): string {
  if (status.status === 'started') return 'Claude started processing feedback';
  if (status.status === 'completed') return 'Implementation completed successfully';
  if (status.status === 'failed') return 'Implementation failed';
  return `${status.phase} in progress`;
}

console.log('[Status Watcher] Ready. Waiting for status updates...');
```

## Deploy Monitor

```typescript
// scripts/deploy-monitor.ts
import { prisma } from '../src/lib/db';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const CHECK_INTERVAL = 10000; // 10 seconds

async function checkDeployments() {
  // Find executions with commits but no deploy status
  const executions = await prisma.claudeExecution.findMany({
    where: {
      commitHash: { not: null },
      deployStatus: null,
      status: 'completed',
    },
  });

  for (const execution of executions) {
    await monitorDeploy(execution);
  }
}

async function monitorDeploy(execution: any) {
  const response = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=1`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
  );

  const data = await response.json();
  const deployment = data.deployments[0];

  if (deployment.meta.githubCommitSha === execution.commitHash) {
    // Update execution with deploy info
    await prisma.claudeExecution.update({
      where: { id: execution.id },
      data: {
        deployStatus: deployment.state,
        deployUrl: deployment.url,
        deployStartedAt: new Date(deployment.createdAt),
      },
    });

    // Check if deploy failed
    if (deployment.state === 'ERROR') {
      await handleDeployFailure(execution, deployment);
    } else if (deployment.state === 'READY') {
      await handleDeploySuccess(execution, deployment);
    }
  }
}

async function handleDeployFailure(execution: any, deployment: any) {
  // Get logs
  const logs = await getDeploymentLogs(deployment.id);

  // Check retry count
  if (execution.retryCount < execution.maxRetries) {
    // Create new feedback with logs for Claude to fix
    const feedback = {
      workspaceId: execution.workspaceId,
      executionId: `${execution.id}-retry-${execution.retryCount + 1}`,
      patternType: execution.workspace.patternType,
      retryAttempt: execution.retryCount + 1,
      previousError: logs,
      task: 'Fix deployment errors and retry',
    };

    // Write to feedback queue
    await writeFeedbackFile(feedback);

    // Increment retry count
    await prisma.claudeExecution.update({
      where: { id: execution.id },
      data: { retryCount: execution.retryCount + 1 },
    });
  } else {
    // Max retries reached - email admin
    await emailAdmin(execution, logs);
  }
}

setInterval(checkDeployments, CHECK_INTERVAL);
```

## Systemd Service Files

```ini
# /etc/systemd/system/feedback-watcher.service
[Unit]
Description=Claude Feedback Watcher
After=network.target

[Service]
Type=simple
User=dobri
WorkingDirectory=/Users/dobri/Scripts/systems-trader/web
ExecStart=/usr/bin/node scripts/feedback-watcher.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/claude-worker.service
[Unit]
Description=Claude Code Worker
After=network.target

[Service]
Type=simple
User=dobri
WorkingDirectory=/Users/dobri/Scripts/systems-trader/web
ExecStart=/bin/bash scripts/claude-worker.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Setup Script

```bash
#!/bin/bash
# scripts/setup-claude-workspace.sh

echo "Setting up Claude workspace..."

# Create directory structure
mkdir -p /tmp/claude-workspace/{feedback-queue,status,prompts,logs}

# Create named pipe
mkfifo /tmp/claude-workspace/feedback-pipe || echo "Pipe already exists"

# Copy standards template
cp CLAUDE_STANDARDS_TEMPLATE.md /tmp/claude-workspace/

# Set permissions
chmod 755 /tmp/claude-workspace
chmod 777 /tmp/claude-workspace/feedback-queue
chmod 777 /tmp/claude-workspace/status

echo "Claude workspace ready at /tmp/claude-workspace"
```
