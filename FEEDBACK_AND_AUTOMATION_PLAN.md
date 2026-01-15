# Feedback & Automation System - Implementation Plan

## Current Status ✅

**COMPLETED:**
- ✅ Unified feedback management showing session corrections (109 items)
- ✅ Grouping by session with expandable details
- ✅ Search and filtering capabilities
- ✅ Admin panel with all controls

## Remaining Tasks

### 1. Indicator Reasoning Submission System

**Problem:** Users need to submit their reasoning for how to identify new patterns that don't have algorithms yet:
- Change of Character (CHoCH)
- Trading Range
- False Breakout
- Liquidity Sweep
- Stop Hunt

**Current Indicators (Working):**
- Break of Structure (BOS)
- Order Block (OB)
- Market Structure Break (MSB)
- Swings

**Solution Design:**

```typescript
// New database model
model IndicatorReasoning {
  id            String   @id @default(cuid())
  userId        String
  indicatorType String   // "CHOCH", "TRADING_RANGE", "FALSE_BREAKOUT", etc.

  // Submission content
  title         String
  description   String   @db.Text

  // Supporting materials
  screenshots   Json?    // [{url, caption}]
  videos        Json?    // [{url, caption}]
  voiceNotes    Json?    // [{url, duration}]
  textContent   String?  @db.Text

  // Context
  symbol        String?  // Which chart they're referencing
  timeframe     String?
  candleData    Json?    // Optional: specific candle range

  // Algorithm suggestion (optional)
  algorithmIdea String?  @db.Text
  pseudocode    String?  @db.Text

  // Status
  status        String   @default("pending") // pending, reviewed, implemented
  votes         Int      @default(0)

  // Claude processing
  implementationStatus String @default("PENDING")
  processedAt         DateTime?
  implementedById     String?

  // Relationships
  user          User     @relation(fields: [userId], references: [id])
  implementedBy User?    @relation("ImplementedBy", fields: [implementedById], references: [id])

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**UI Flow:**
1. New page: `/indicators/submit-reasoning`
2. User selects indicator type from dropdown
3. Form with:
   - Title & Description
   - Upload screenshots (drag & drop)
   - Upload videos (or paste YouTube links)
   - Record voice note (or upload)
   - Optional: Symbol/timeframe context
   - Optional: Algorithm ideas in plain English
4. Submit → Goes into admin feedback queue
5. If user is dev_team → Automatically routed to Claude Code

**Admin View:**
- New tab in Unified Feedback: "Indicator Reasoning"
- Shows all submissions grouped by indicator type
- Voting system to prioritize
- Status tracking (pending → reviewed → implemented)

---

### 2. Claude Code 24/7 Server-Side Operation

**Problem:** SSH from Mac won't work 24/7 due to:
- Mac restarts
- Updates
- Sleep mode
- Network interruptions

**Your Correct Solution:** Run Claude Code directly on the Bulgarian server

**Implementation Plan:**

#### A. Server-Side Claude Code Setup

**On Bulgarian Server:**
```bash
# 1. Install Claude Code on server
cd /home/dobri
npm install -g @anthropic/claude-code

# 2. Login to Claude (one-time)
claude login
# This creates ~/.claude/config with auth token

# 3. Create systemd service
sudo nano /etc/systemd/system/claude-code-watcher.service
```

**Service Configuration:**
```ini
[Unit]
Description=Claude Code Feedback Watcher
After=network.target

[Service]
Type=simple
User=dobri
WorkingDirectory=/home/dobri/systems-trader/web
Environment="NODE_ENV=production"
Environment="PATH=/home/dobri/.nvm/versions/node/v20.11.0/bin:/usr/local/bin:/usr/bin:/bin"

# Run Claude Code with auto-restart
ExecStart=/home/dobri/.nvm/versions/node/v20.11.0/bin/npx @anthropic/claude-code --dangerously-skip-permissions --watch-mode

# Restart policy
Restart=always
RestartSec=10
StartLimitInterval=200
StartLimitBurst=5

# Email on failure (requires mailutils)
OnFailure=claude-failure-notify.service

[Install]
WantedBy=multi-user.target
```

**Failure Notification Service:**
```ini
[Unit]
Description=Notify on Claude Code Failure

[Service]
Type=oneshot
ExecStart=/home/dobri/scripts/notify-claude-failure.sh
```

**Notification Script (`/home/dobri/scripts/notify-claude-failure.sh`):**
```bash
#!/bin/bash
# Get error logs
LOGS=$(journalctl -u claude-code-watcher -n 50 --no-pager)

# Send email
echo "Subject: Claude Code Watcher Failed
From: trading-server@dobri.org
To: dobrivassi09@gmail.com

Claude Code service has failed on trading-server.

Recent logs:
$LOGS

SSH into the server to diagnose:
ssh dobri@dobri.org

Check status:
sudo systemctl status claude-code-watcher

View logs:
sudo journalctl -u claude-code-watcher -f
" | /usr/sbin/sendmail dobrivassi09@gmail.com
```

#### B. Watch Mode Implementation

**New file: `/home/dobri/systems-trader/web/scripts/claude-watch-mode.ts`**
```typescript
import { prisma } from "../src/lib/db";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);
const HEARTBEAT_FILE = "/tmp/claude-watcher-heartbeat.json";
const QUEUE_FILE = "/tmp/claude-feedback-queue.json";

async function main() {
  console.log("[CLAUDE WATCHER] Starting...");

  while (true) {
    try {
      // Update heartbeat
      fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify({
        timestamp: new Date().toISOString(),
        status: "running"
      }));

      // Check for pending feedback
      const pendingFeedback = await getPendingFeedback();

      if (pendingFeedback.length > 0) {
        // Process one at a time (queue system)
        const feedback = pendingFeedback[0];
        await processFeedback(feedback);
      }

      // Sleep for 10 seconds
      await sleep(10000);
    } catch (error) {
      console.error("[CLAUDE WATCHER] Error:", error);
      // Continue running even on errors
    }
  }
}

async function getPendingFeedback() {
  // Get all pending feedback for dev_team/admin users
  const feedback = await prisma.feedback.findMany({
    where: {
      implementationStatus: "PENDING",
      user: {
        role: { in: ["dev_team", "admin"] }
      }
    },
    include: {
      user: { select: { name: true, email: true, role: true } }
    },
    orderBy: { createdAt: "asc" }, // FIFO queue
    take: 1
  });

  return feedback;
}

async function processFeedback(feedback: any) {
  console.log(`[CLAUDE WATCHER] Processing feedback ${feedback.id}`);

  // Mark as processing
  await prisma.feedback.update({
    where: { id: feedback.id },
    data: {
      implementationStatus: "PROCESSING",
      processedAt: new Date()
    }
  });

  // Generate prompt
  const prompt = generatePrompt(feedback);

  // Write prompt to file (Claude will read it)
  const promptFile = `/tmp/claude-prompt-${feedback.id}.txt`;
  fs.writeFileSync(promptFile, prompt);

  // Signal Claude (this is where Claude Code picks it up)
  // The actual implementation depends on how we integrate with Claude Code
  console.log(`[CLAUDE WATCHER] Prompt ready at ${promptFile}`);

  // TODO: Actually trigger Claude Code here
  // For now, just mark as completed after manual processing
}

function generatePrompt(feedback: any): string {
  return `
# Feedback Implementation Request

**Type:** ${feedback.type}
**Title:** ${feedback.title || "Untitled"}
**Submitted by:** ${feedback.user.name} (${feedback.user.email})

## Description
${feedback.textContent}

${feedback.stepsToReproduce ? `
## Steps to Reproduce
${feedback.stepsToReproduce}
` : ''}

${feedback.expectedBehavior ? `
## Expected Behavior
${feedback.expectedBehavior}
` : ''}

${feedback.actualBehavior ? `
## Actual Behavior
${feedback.actualBehavior}
` : ''}

${feedback.pageUrl ? `
## Page URL
${feedback.pageUrl}
` : ''}

## Your Task
Please implement this feedback. Follow these steps:
1. Read and understand the issue
2. Locate the relevant code
3. Implement the fix or feature
4. Test your changes
5. Commit with a clear message

## Working Directory
/home/dobri/systems-trader/web

## When Done
Update the feedback status in the database:
- If successful: implementationStatus = "COMPLETED"
- If failed: implementationStatus = "FAILED", set errorMessage
`;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
```

#### C. Queue System for Concurrent Requests

**How it works:**
1. Multiple feedback items can be submitted simultaneously
2. Watcher polls database every 10s
3. Processes ONE feedback at a time (FIFO queue)
4. While processing, new feedback waits in queue
5. Each feedback gets a turn sequentially

**Queue Visualization:**
```
Feedback Queue:
┌─────────────────────┐
│ [1] Pending         │ ← Currently processing
├─────────────────────┤
│ [2] Pending         │ ← Next in queue
├─────────────────────┤
│ [3] Pending         │ ← Waiting
├─────────────────────┤
│ [4] Pending         │ ← Waiting
└─────────────────────┘
```

**Database Approach (No extra queue needed):**
- `implementationStatus = "PENDING"` = In queue
- `implementationStatus = "PROCESSING"` = Being worked on
- `implementationStatus = "COMPLETED"` = Done
- Order by `createdAt ASC` = FIFO

---

### 3. Full Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Bulgarian Server (24/7)                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Next.js App (PM2)                                    │    │
│  │ - Web interface                                      │    │
│  │ - API endpoints                                      │    │
│  │ - Database (Prisma)                                  │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Feedback Watcher (systemd service)                   │    │
│  │ - Polls database every 10s                           │    │
│  │ - Writes heartbeat file                              │    │
│  │ - FIFO queue processing                              │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Claude Code (systemd service)                        │    │
│  │ - Running in --watch-mode                            │    │
│  │ - Processes one feedback at a time                   │    │
│  │ - Updates database on completion                     │    │
│  │ - Auto-restarts on failure                           │    │
│  │ - Emails admin on errors                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

### 4. Implementation Steps

**Phase 1: Server Setup (1-2 hours)**
1. SSH into Bulgarian server
2. Install Claude Code globally: `npm install -g @anthropic/claude-code`
3. Login: `claude login`
4. Test manually: `claude --dangerously-skip-permissions`
5. Create systemd services
6. Set up email notifications
7. Enable and start services

**Phase 2: Indicator Reasoning System (3-4 hours)**
1. Add `IndicatorReasoning` model to Prisma schema
2. Run migration: `npx prisma migrate dev`
3. Create `/indicators/submit-reasoning` page
4. Create file upload handling (R2)
5. Add indicator reasoning tab to admin feedback
6. Integrate with Claude Code watcher

**Phase 3: Testing & Refinement (2-3 hours)**
1. Submit test feedback
2. Monitor Claude Code processing
3. Check email notifications
4. Test queue system with multiple submissions
5. Monitor system for 24 hours

---

### 5. Monitoring & Maintenance

**Check Service Status:**
```bash
sudo systemctl status claude-code-watcher
sudo systemctl status feedback-watcher
```

**View Logs:**
```bash
sudo journalctl -u claude-code-watcher -f
sudo journalctl -u feedback-watcher -f
```

**Restart Services:**
```bash
sudo systemctl restart claude-code-watcher
sudo systemctl restart feedback-watcher
```

**Check Heartbeat:**
```bash
cat /tmp/feedback-watcher-heartbeat.json
```

---

## Questions & Answers

**Q: What if Claude Code encounters a login error?**
A: The systemd service will fail, email you, and you SSH in to fix it. The service auto-restarts after you resolve the issue.

**Q: What happens if two people submit feedback at the exact same time?**
A: Both go into the database as "PENDING". The watcher processes them one by one in FIFO order (first submitted, first processed).

**Q: Can we prioritize certain feedback?**
A: Yes! Add a `priority` field to the Feedback model. Change the query to `orderBy: [{ priority: "desc" }, { createdAt: "asc" }]`

**Q: What if the server restarts?**
A: The systemd services are configured with `WantedBy=multi-user.target`, so they auto-start on boot.

**Q: How do we handle really long-running implementations?**
A: Add a timeout (e.g., 30 minutes). If Claude doesn't finish in time, mark as "FAILED" with timeout error, and move to next item.

---

## Next Steps

Would you like me to:
1. **Start with indicator reasoning system** (add the database model and UI)?
2. **Set up Claude Code on the server** (SSH in and configure it)?
3. **Both in sequence**?

Let me know which you'd like to tackle first!
