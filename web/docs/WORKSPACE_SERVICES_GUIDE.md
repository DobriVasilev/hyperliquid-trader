# Workspace Services Guide

This guide explains how to run and use the workspace autonomous feedback system.

## Overview

The workspace system consists of three autonomous services that work together:

1. **Feedback Watcher** - Polls for pattern sessions with corrections and triggers Claude
2. **Status Watcher** - Monitors Claude execution progress and updates the database
3. **Deploy Monitor** - Tracks Vercel deployments and implements auto-retry on failure

## Prerequisites

1. Database migrations applied: `npm run db:push`
2. Workspace infrastructure setup: `./scripts/setup-claude-workspace.sh`
3. Environment variables configured:
   - `DATABASE_URL` - PostgreSQL connection string
   - `VERCEL_TOKEN` - Vercel API token (for deploy monitoring)
   - `VERCEL_PROJECT_ID` - Your Vercel project ID
   - `ADMIN_EMAIL` - Email for failure notifications

## Running the Services

### Development Mode

Run each service in a separate terminal:

```bash
# Terminal 1: Feedback watcher
npm run watch:workspace-feedback

# Terminal 2: Status watcher
npm run watch:workspace-status

# Terminal 3: Deploy monitor
npm run monitor:workspace-deploy
```

### Production Mode (with systemd)

1. Copy service files to systemd:
```bash
sudo cp scripts/deploy/systemd/workspace-*.service /etc/systemd/system/
sudo systemctl daemon-reload
```

2. Enable and start services:
```bash
sudo systemctl enable workspace-feedback-watcher
sudo systemctl enable workspace-status-watcher
sudo systemctl enable workspace-deploy-monitor

sudo systemctl start workspace-feedback-watcher
sudo systemctl start workspace-status-watcher
sudo systemctl start workspace-deploy-monitor
```

3. Check status:
```bash
sudo systemctl status workspace-feedback-watcher
sudo systemctl status workspace-status-watcher
sudo systemctl status workspace-deploy-monitor
```

## How It Works

### 1. Feedback Watcher Flow

```
1. Polls database every 10 seconds
2. Finds PatternWorkspaces with status: implementing, beta, or in_review
3. Looks for sessions with:
   - status = "submitted_for_review"
   - implementedAt = null
   - corrections.length > 0
4. Creates ClaudeExecution record
5. Generates prompt from session corrections
6. Writes to /tmp/claude-workspace/feedback-queue/
7. Creates WorkspaceMessage timeline entry
8. Exits to trigger Claude Code activation
```

### 2. Status Watcher Flow

```
1. Watches /tmp/claude-workspace/status/ directory
2. Reads status JSON files written by Claude
3. Updates ClaudeExecution records:
   - status (pending → running → completed/failed)
   - phase (planning → implementing → testing → deploying)
   - progress (0-100%)
4. Creates WorkspaceMessage timeline entries
5. On completion:
   - Sets PatternSession.implementedAt
   - Sets PatternSession.implementedBy
   - Changes status to "implemented"
6. Archives processed status files
```

### 3. Deploy Monitor Flow

```
1. Polls Vercel API every 30 seconds
2. Finds ClaudeExecutions with:
   - status = "completed"
   - commitHash != null
   - deployStatus = null or "building"
3. Matches commit to Vercel deployment
4. Updates deployStatus:
   - "building" → "ready" (success)
   - "building" → "error" (failure)
5. On failure:
   - Fetches deployment logs
   - Creates retry ClaudeExecution (if retries < maxRetries)
   - Generates prompt with error logs
   - Writes to feedback queue
6. After maxRetries (default 10):
   - Sends admin email notification
   - Requires manual intervention
```

## Workspace Directory Structure

```
/tmp/claude-workspace/
├── feedback-queue/      # JSON files trigger Claude
├── status/              # Claude writes progress here
│   ├── processed/       # Archived status files
│   └── errors/          # Failed status files
├── prompts/             # Generated prompts
└── logs/                # Service logs
```

## Feedback Queue File Format

```json
{
  "executionId": "clxxx123",
  "workspaceId": "clxxx456",
  "patternType": "swings",
  "patternName": "Swing Detection",
  "version": "1.0.0",
  "sessionIds": ["session1", "session2"],
  "sessionCount": 2,
  "promptFile": "/tmp/claude-workspace/prompts/clxxx123.md",
  "timestamp": "2026-01-15T10:30:00Z"
}
```

## Status File Format (Written by Claude)

```json
{
  "executionId": "clxxx123",
  "status": "running",
  "phase": "implementing",
  "progress": 45,
  "data": {
    "message": "Updating pattern detection logic...",
    "filesChanged": ["src/patterns/swings.ts"]
  }
}
```

## Monitoring

### Check Service Health

```bash
# View logs
journalctl -u workspace-feedback-watcher -f
journalctl -u workspace-status-watcher -f
journalctl -u workspace-deploy-monitor -f

# Check heartbeat
cat /tmp/feedback-watcher-heartbeat.txt
# Should show recent timestamp

# Check workspace directory
ls -la /tmp/claude-workspace/feedback-queue/
ls -la /tmp/claude-workspace/status/
```

### Common Issues

**Feedback watcher not finding sessions:**
- Check that PatternWorkspace exists with correct status
- Verify sessions have status="submitted_for_review"
- Ensure sessions have corrections
- Check that implementedAt is null

**Status watcher not processing:**
- Verify /tmp/claude-workspace/status directory exists
- Check file permissions
- Look for files in status/errors/ directory

**Deploy monitor errors:**
- Verify VERCEL_TOKEN is set correctly
- Check VERCEL_PROJECT_ID matches your project
- Ensure commit hash exists in Vercel

## Database Queries

### Find pending feedback
```sql
SELECT 
  w.name, 
  w.patternType,
  w.status,
  COUNT(s.id) as sessions_with_corrections
FROM "PatternWorkspace" w
LEFT JOIN "PatternSession" s ON s."workspaceId" = w.id
WHERE 
  w.status IN ('implementing', 'beta', 'in_review')
  AND s.status = 'submitted_for_review'
  AND s."implementedAt" IS NULL
GROUP BY w.id;
```

### Check recent executions
```sql
SELECT 
  e.id,
  e.status,
  e.phase,
  e.progress,
  e."triggeredAt",
  w.name as workspace_name
FROM "ClaudeExecution" e
JOIN "PatternWorkspace" w ON e."workspaceId" = w.id
ORDER BY e."triggeredAt" DESC
LIMIT 10;
```

### View workspace timeline
```sql
SELECT 
  m.type,
  m.title,
  m.content,
  m."createdAt",
  m."authorType"
FROM "WorkspaceMessage" m
WHERE m."workspaceId" = 'your-workspace-id'
ORDER BY m."createdAt" DESC
LIMIT 20;
```

## Next Steps

After services are running:

1. Create a PatternWorkspace (status: "implementing")
2. Create test sessions with corrections
3. Submit sessions for review (status: "submitted_for_review")
4. Watch services pick up and process the feedback
5. Monitor execution in WorkspaceMessage timeline
6. Verify deployment success/retry flow

## Troubleshooting

### Freeze Detection

If heartbeat file timestamp is > 60 seconds old:
```bash
# Restart services
sudo systemctl restart workspace-feedback-watcher
sudo systemctl restart workspace-status-watcher
```

### Clear Stuck Executions

```sql
-- Reset stuck executions
UPDATE "ClaudeExecution" 
SET status = 'failed', error = 'Manual reset'
WHERE status IN ('pending', 'running')
AND "triggeredAt" < NOW() - INTERVAL '1 hour';
```

### Reset Failed Sessions

```sql
-- Allow failed sessions to be retried
UPDATE "PatternSession"
SET "implementedAt" = NULL
WHERE status = 'submitted_for_review'
AND id IN ('session-id-1', 'session-id-2');
```

## Configuration

All services use these configurable values:

### Feedback Watcher
- `POLL_INTERVAL`: 10000ms (10 seconds)
- `MAX_RUNTIME`: 1800000ms (30 minutes)
- `HEARTBEAT_FILE`: `/tmp/feedback-watcher-heartbeat.txt`

### Status Watcher
- `POLL_INTERVAL`: 2000ms (2 seconds)
- Also uses fs.watch() for immediate updates

### Deploy Monitor
- `POLL_INTERVAL`: 30000ms (30 seconds)
- `MAX_RETRIES`: 10 (per execution)

Edit the script files to adjust these values.
