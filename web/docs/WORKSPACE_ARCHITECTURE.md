# Pattern Workspace Architecture

## Overview

A unified, chat-style interface for each pattern/indicator where users can test, give feedback, send to Claude Code for fixes, and track implementation progress - all in one place.

## Visual Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          App Header                                       │
├────────────┬─────────────────────────────────────────┬────────────────────┤
│            │                                          │                    │
│  PATTERNS  │           TIMELINE (Chat View)           │    SUMMARY         │
│            │                                          │                    │
│ → Swings   │  ┌────────────────────────────────────┐│  Progress      ▼   │
│   BOS      │  │ Session #1 - Jan 10, 2026          ││  ✓ Implemented     │
│   CHoCH    │  │ ┌──────────────────────────────┐  ││  ✓ Session 1       │
│   FVG      │  │ │ TradingView Chart            │  ││  ⟳ Claude fixing   │
│   ...      │  │ │ [Give Feedback] button       │  ││  ○ Session 2       │
│            │  │ └──────────────────────────────┘  ││                    │
│ + New SOON │  │                                    ││  Status        ▼   │
│            │  │ 💬 User: "False positive at..."   ││  Beta              │
│            │  │ 🖼️ Image attached                  ││  v1.2.3            │
│            │  │                                    ││  [Approve]         │
│            │  │ ✅ Feedback sent to Claude         ││                    │
│            │  │                                    ││  Stats         ▼   │
│            │  │ 🤖 Claude is working...            ││  12 sessions       │
│            │  │    ├─ Planning ✓                  ││  8 corrections     │
│            │  │    ├─ Implementation ⟳             ││  Last: 2h ago      │
│            │  │    ├─ Testing ○                   ││                    │
│            │  │    └─ Deploy ○                    ││                    │
│            │  │                                    ││                    │
│            │  │ ✅ Deploy successful! v1.2.3       ││                    │
│            │  │                                    ││                    │
│            │  │ Session #2 - Jan 11, 2026          ││                    │
│            │  │ ...                                ││                    │
│            │  └────────────────────────────────────┘│                    │
│            │                                          │                    │
│            │  [+ New Session] [Send to Claude]       │                    │
│            │                                          │                    │
├────────────┴─────────────────────────────────────────┴────────────────────┤
│  Input: Add feedback, attach images, etc...                   [Send]      │
└──────────────────────────────────────────────────────────────────────────┘
```

## User Flow

### 1. Pattern Selection / Creation

```
User clicks on pattern in sidebar
  ├─ IF pattern exists
  │   └─ Load workspace with timeline
  │
  └─ IF pattern is SOON (not implemented)
      ├─ Show pattern description form
      ├─ User describes how they identify pattern
      ├─ User uploads images/videos
      ├─ User submits
      ├─ Create WorkspaceMessage (type: pattern_submission)
      ├─ Trigger Claude Code with pattern spec
      ├─ Claude implements algorithm
      ├─ Status changes: SOON → BETA
      └─ Timeline shows implementation progress
```

### 2. Testing & Feedback Loop

```
User creates new session in workspace
  ├─ Click "+ New Session"
  ├─ Session creation inline (symbol, timeframe, date range)
  ├─ Chart loads in timeline
  ├─ User tests pattern detection
  │
  ├─ User gives feedback (multiple items)
  │   ├─ Add comment with candle reference
  │   ├─ Attach images
  │   ├─ Mark false positives/negatives
  │   └─ Each feedback item appears in timeline
  │
  ├─ When ready, click "Send to Claude"
  │   ├─ Aggregate ALL feedback from session
  │   ├─ Create WorkspaceMessage (type: feedback_batch)
  │   ├─ Write feedback to watched file
  │   └─ Claude Code wakes up
  │
  ├─ Claude processes feedback
  │   ├─ Timeline shows progress updates (real-time)
  │   ├─ Planning → Implementation → Testing → Deploy
  │   └─ Each phase creates WorkspaceMessage
  │
  ├─ Deploy monitoring
  │   ├─ IF deploy successful
  │   │   ├─ Create WorkspaceMessage (type: deploy_success)
  │   │   ├─ Notify user
  │   │   └─ User can test new version
  │   │
  │   └─ IF deploy fails
  │       ├─ Capture Vercel logs
  │       ├─ Create WorkspaceMessage (type: deploy_failed)
  │       ├─ Forward logs to Claude
  │       ├─ Retry (max 10 attempts)
  │       └─ IF all retries fail → Email admin
  │
  └─ Loop: Create another session to test again
```

### 3. Approval Workflow

```
When user satisfied with pattern:
  ├─ Click "Approve" in sidebar
  ├─ Status changes: BETA → IN_REVIEW
  ├─ Create WorkspaceMessage (type: user_approved)
  ├─ Notify admin
  │
  └─ Admin reviews
      ├─ Can see all timeline history
      ├─ All sessions and feedback
      └─ Click "Verify"
          ├─ Status changes: IN_REVIEW → VERIFIED
          └─ Pattern becomes production-ready
```

## State Machine

```
Pattern Status Flow:

SOON
  ↓ (user submits pattern description)
IMPLEMENTING
  ↓ (Claude implements algorithm)
BETA
  ↓ (user tests & iterates with feedback)
BETA (testing continues...)
  ↓ (user clicks "Approve")
IN_REVIEW
  ↓ (admin clicks "Verify")
VERIFIED
```

## Key Design Principles

1. **Single Source of Truth**: Everything happens in the pattern workspace
2. **Timeline-Based**: All activities are messages in chronological order
3. **Real-Time**: Progress updates appear live as Claude works
4. **Async & Autonomous**: Claude runs 24/7, wakes on feedback
5. **Self-Healing**: Auto-retry with logs on deploy failures
6. **Auditable**: Complete history of all changes and decisions

## Timeline Message Types

Every activity creates a message in the timeline:

- `pattern_submission` - User submits SOON pattern description
- `session_created` - New test session started
- `feedback_added` - User adds single feedback item
- `feedback_batch_sent` - Batch of feedback sent to Claude
- `claude_started` - Claude begins processing
- `claude_progress` - Phase update from Claude
- `claude_completed` - Claude finished changes
- `deploy_started` - Vercel deploy triggered
- `deploy_success` - Deploy completed successfully
- `deploy_failed` - Deploy failed with logs
- `retry_attempt` - Auto-retry initiated
- `user_approved` - User approves pattern
- `admin_verified` - Admin verifies pattern

## Technical Components

### Frontend
- `/workspace/[patternType]` - Main workspace page
- Components: PatternSidebar, Timeline, MessageBubble, ProgressSummary
- Real-time updates via polling or WebSocket

### Backend
- API routes for workspace operations
- Feedback aggregation endpoint
- Status polling endpoint
- Deploy monitoring service

### Claude CLI Integration
- Background service watching feedback files
- Prompt template with CLAUDE_STANDARDS_TEMPLATE.md
- Progress reporting mechanism
- Git commit and push automation

### Infrastructure
- Vercel API for deploy monitoring
- Email service for admin notifications
- File system for feedback exchange
- Database for persistence
