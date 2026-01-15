# Implementation Roadmap

## Phase 1: Documentation ✅ COMPLETE

**Status**: All documentation completed
**Duration**: 2-3 hours

### Deliverables
- [x] Architecture overview (WORKSPACE_ARCHITECTURE.md)
- [x] Database schema design (DATABASE_SCHEMA.md)
- [x] Message type definitions (MESSAGE_TYPES.ts)
- [x] Claude CLI integration design (CLAUDE_CLI_INTEGRATION.md)
- [x] Implementation roadmap (this file)

---

## Phase 2: Claude CLI Proof of Concept

**Goal**: Validate the critical path - ensure Claude can receive feedback, make changes, and report progress

**Duration**: 1-2 days

### 2.1 Setup Infrastructure (2-3 hours)

```bash
# Create workspace directories
./scripts/setup-claude-workspace.sh

# Verify structure
/tmp/claude-workspace/
├── feedback-queue/
├── feedback-pipe (named pipe)
├── status/
├── prompts/
└── logs/
```

**Validation**: Directories exist, pipe created, permissions correct

### 2.2 Build Feedback Watcher (2-3 hours)

**File**: `scripts/feedback-watcher.ts`

**Tasks**:
- Watch feedback-queue/ directory
- Detect new JSON files
- Parse and validate feedback format
- Write filename to feedback-pipe
- Log all activities

**Test**:
```bash
# Terminal 1: Start watcher
npm run watch:feedback

# Terminal 2: Drop test feedback
cp test/fixtures/test-feedback.json /tmp/claude-workspace/feedback-queue/
# Should see: "Triggered Claude for execution X"
```

**Validation**: Watcher detects files, writes to pipe, logs properly

### 2.3 Build Claude Worker Script (3-4 hours)

**File**: `scripts/claude-worker.sh`

**Tasks**:
- Continuous loop reading from feedback-pipe
- Extract execution ID and workspace info
- Call Claude Code with feedback prompt
- Write status updates during execution
- Handle errors and log output

**Test**:
```bash
# Terminal 1: Start Claude worker
./scripts/claude-worker.sh

# Terminal 2: Trigger with test feedback
echo "test-feedback.json" > /tmp/claude-workspace/feedback-pipe

# Should see Claude start processing
```

**Validation**:
- Claude receives feedback
- Makes code changes
- Commits to git
- Status file created with progress

### 2.4 Build Status Watcher (2-3 hours)

**File**: `scripts/status-watcher.ts`

**Tasks**:
- Watch status/ directory
- Parse status JSON updates
- Update ClaudeExecution in database
- Create WorkspaceMessage timeline entries
- Handle completion and errors

**Test**:
```bash
# Terminal 1: Start status watcher
npm run watch:status

# Terminal 2: Simulate Claude update
echo '{"status":"running","phase":"implementing","progress":50}' > \
  /tmp/claude-workspace/status/execution-test123.json

# Check database: execution and message created
```

**Validation**: Database updates, timeline messages created

### 2.5 Build Deploy Monitor (3-4 hours)

**File**: `scripts/deploy-monitor.ts`

**Tasks**:
- Poll Vercel API for deployments
- Match commits to executions
- Track deployment status
- Extract logs on failure
- Implement retry logic (max 10)
- Email admin on final failure

**Test**:
```bash
# Start monitor
npm run monitor:deploy

# Trigger a deploy via push
# Monitor should detect, track, and update database
```

**Validation**:
- Deploys detected
- Status tracked (QUEUED → BUILDING → READY/ERROR)
- On error: logs extracted, retry triggered
- After 10 failures: admin emailed

### 2.6 End-to-End Test (2-3 hours)

**Full integration test**:
1. Create test feedback JSON
2. Drop into feedback-queue/
3. Watcher triggers Claude
4. Claude processes and commits
5. Status updates appear
6. Deploy monitors and tracks
7. Timeline shows full history

**Success Criteria**:
- [ ] Feedback → Claude → Changes → Commit → Deploy
- [ ] All status updates captured
- [ ] Timeline shows complete history
- [ ] Errors handled gracefully
- [ ] Retries work on deploy failure

---

## Phase 3: Database & API Layer

**Duration**: 1 day

### 3.1 Database Migrations (2-3 hours)

**File**: `prisma/schema.prisma`

**Tasks**:
- Add PatternWorkspace model
- Add WorkspaceMessage model
- Add ClaudeExecution model
- Update PatternSession with workspaceId
- Update FeedbackItem with workspaceId
- Add User relations

**Migration**:
```bash
npx prisma migrate dev --name add_workspace_models
npx prisma generate
```

**Validation**: All models created, relations work

### 3.2 API Routes (4-5 hours)

Create the following routes:

**Pattern Workspace Routes**:
- `GET /api/workspace/[patternType]` - Get workspace with timeline
- `GET /api/workspace/[patternType]/timeline` - Get messages
- `GET /api/workspace/[patternType]/status` - Get current status
- `POST /api/workspace/[patternType]/approve` - User approves
- `POST /api/workspace/[patternType]/verify` - Admin verifies

**Session Routes** (modify existing):
- `POST /api/workspace/[patternType]/session` - Create session in workspace
- `GET /api/workspace/[patternType]/sessions` - List sessions

**Feedback Routes** (modify existing):
- `POST /api/workspace/[patternType]/feedback` - Add feedback
- `GET /api/workspace/[patternType]/feedback` - List feedback

**Claude Integration**:
- `POST /api/workspace/[patternType]/send-to-claude` - Aggregate & send
- `GET /api/workspace/[patternType]/execution/[id]` - Get execution status

**Validation**: All routes work, return proper data

### 3.3 Feedback Aggregation Service (2 hours)

**File**: `src/lib/services/feedback-aggregator.ts`

**Tasks**:
- Aggregate feedback from session
- Build complete context
- Generate feedback JSON
- Write to feedback-queue/
- Create ClaudeExecution record
- Create timeline messages

**Test**: Call service, verify file created, database updated

---

## Phase 4: UI/UX

**Duration**: 2-3 days

### 4.1 Layout Components (4-5 hours)

**Components**:
- `PatternSidebar.tsx` - Left sidebar with pattern list
- `WorkspaceTimeline.tsx` - Center chat-style timeline
- `WorkspaceSummary.tsx` - Right sidebar with progress/stats
- `WorkspaceLayout.tsx` - 3-column layout wrapper

**Design**:
```tsx
<WorkspaceLayout>
  <PatternSidebar patterns={patterns} active={current} />
  <WorkspaceTimeline messages={messages} />
  <WorkspaceSummary workspace={workspace} />
</WorkspaceLayout>
```

**Test**: Responsive, scrollable, proper spacing

### 4.2 Message Components (3-4 hours)

**Components**:
- `MessageBubble.tsx` - Base message component
- `SessionMessage.tsx` - Session created with chart preview
- `FeedbackMessage.tsx` - Feedback item with attachments
- `ClaudeProgressMessage.tsx` - Progress indicator
- `DeployMessage.tsx` - Deploy status

**Test**: All message types render correctly

### 4.3 Session Creation Inline (3-4 hours)

**Component**: `InlineSessionCreator.tsx`

**Features**:
- Symbol selector
- Timeframe picker
- Date range
- Chart preview
- Inline in timeline (not separate page)

**Test**: Create session, appears in timeline

### 4.4 Feedback Interface (4-5 hours)

**Component**: `FeedbackInterface.tsx`

**Features**:
- Chart with candle selection
- Feedback form (type, reasoning, attachments)
- Preview before sending
- Batch send button

**Test**: Add feedback, preview, send to Claude

### 4.5 Real-time Updates (2-3 hours)

**Method**: Polling (simple, no WebSocket infrastructure)

**Implementation**:
```tsx
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await fetch(`/api/workspace/${patternType}/status`);
    // Update UI
  }, 2000);
  return () => clearInterval(interval);
}, [patternType]);
```

**Test**: Progress updates appear live

### 4.6 Approval Flow (2 hours)

**Components**:
- Approve button in summary sidebar
- Admin verify button
- Status badges

**Test**: User approves, status changes, admin verifies

---

## Phase 5: Polish & Production

**Duration**: 1-2 days

### 5.1 Email Notifications (2 hours)

**Service**: `src/lib/services/email.ts`

**Triggers**:
- User approves pattern → Email admin
- Deploy fails 10 times → Email admin
- Claude fails → Email dev_team user

**Test**: All email triggers work

### 5.2 Error Handling (3 hours)

**Areas**:
- API error responses
- Claude execution failures
- Deploy failures
- File system errors
- Database errors

**Test**: Graceful degradation, proper error messages

### 5.3 Loading States (2 hours)

**Components**:
- Skeleton loaders for timeline
- Progress indicators
- Loading spinners

**Test**: No jarring blank states

### 5.4 Migration Script (2-3 hours)

**File**: `scripts/migrate-to-workspaces.ts`

**Tasks**:
- Create workspace for each existing pattern
- Link existing sessions to workspaces
- Link existing feedback to workspaces
- Create initial timeline messages
- Update statuses

**Test**: All existing data migrated correctly

### 5.5 Testing & QA (4-5 hours)

**Test scenarios**:
- [ ] Create new SOON pattern
- [ ] Submit pattern description
- [ ] Create multiple test sessions
- [ ] Add various feedback types
- [ ] Send to Claude
- [ ] Monitor progress live
- [ ] Handle deploy failure
- [ ] Verify retry logic
- [ ] Approve pattern
- [ ] Admin verify
- [ ] Check timeline history

### 5.6 Documentation (2 hours)

**User docs**:
- How to use workspace
- How to give effective feedback
- How to monitor Claude progress
- Approval process

**Developer docs**:
- Setup guide for local development
- How to debug Claude integration
- How to add new message types

---

## Deployment Checklist

### Environment Variables

```bash
# Vercel API
VERCEL_TOKEN=...
VERCEL_PROJECT_ID=...
VERCEL_TEAM_ID=...

# Email
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASSWORD=...
ADMIN_EMAIL=...

# Claude workspace
CLAUDE_WORKSPACE_PATH=/tmp/claude-workspace
```

### System Services

```bash
# Setup workspace
sudo ./scripts/setup-claude-workspace.sh

# Install systemd services
sudo cp scripts/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload

# Enable and start services
sudo systemctl enable feedback-watcher
sudo systemctl enable status-watcher
sudo systemctl enable claude-worker
sudo systemctl enable deploy-monitor

sudo systemctl start feedback-watcher
sudo systemctl start status-watcher
sudo systemctl start claude-worker
sudo systemctl start deploy-monitor

# Check status
sudo systemctl status feedback-watcher
sudo systemctl status claude-worker
```

### Monitoring

```bash
# Watch logs
tail -f /tmp/claude-workspace/logs/*.log

# Check service status
systemctl status feedback-watcher

# View recent messages
journalctl -u feedback-watcher -n 50 -f
```

---

## Success Metrics

After full implementation, we should be able to:

1. **Create Pattern Workspace**: User creates/selects pattern
2. **Test & Iterate**: User runs multiple test sessions
3. **Give Feedback**: User adds detailed corrections
4. **Autonomous Fix**: Claude receives, fixes, commits automatically
5. **Monitor Progress**: User sees live updates in timeline
6. **Handle Failures**: System auto-retries deploy failures
7. **Approve & Verify**: Clear approval workflow
8. **Audit Trail**: Complete history in timeline

**Time to Value**: From feedback to deployed fix < 10 minutes (automated)

---

## Risk Mitigation

### High Risk: Claude CLI Reliability
- **Risk**: Claude process crashes or hangs
- **Mitigation**:
  - Systemd auto-restart
  - Health check endpoint
  - Timeout on long executions
  - Manual intervention fallback

### Medium Risk: Vercel API Rate Limits
- **Risk**: Too many API calls
- **Mitigation**:
  - Poll every 10 seconds (reasonable rate)
  - Cache deployment status
  - Exponential backoff on errors

### Medium Risk: File System Issues
- **Risk**: /tmp gets cleared, permissions issues
- **Mitigation**:
  - Check and recreate directories on startup
  - Proper error logging
  - Persistent storage option

### Low Risk: Database Performance
- **Risk**: Timeline gets too large
- **Mitigation**:
  - Pagination on timeline queries
  - Archive old messages
  - Proper indexes

---

## Next Steps

1. **Get Approval**: Review this roadmap, adjust as needed
2. **Phase 2**: Build Claude CLI proof of concept (most critical)
3. **Validate**: Test end-to-end before building UI
4. **Phase 3**: Database and API layer
5. **Phase 4**: Beautiful UI/UX
6. **Phase 5**: Polish and deploy

**Estimated Total Time**: 6-8 days of focused development

Ready to start Phase 2?
