# Database Schema Design

## Overview

The workspace-centric schema organizes everything around pattern workspaces, with a timeline of messages for each activity.

## Entity Relationship

```
PatternWorkspace (1) ──┬─→ (many) WorkspaceMessage
                       ├─→ (many) PatternSession
                       ├─→ (many) FeedbackItem
                       └─→ (many) ClaudeExecution

User ──→ (many) PatternWorkspace
User ──→ (many) WorkspaceMessage
```

## Prisma Schema

```prisma
// ============================================================================
// PATTERN WORKSPACE - Central hub for each pattern/indicator
// ============================================================================

model PatternWorkspace {
  id          String   @id @default(cuid())

  // Pattern identification
  patternType String   // "swings", "bos", "choch", etc.
  name        String   // Display name
  category    String   // "price_action", "order_blocks", etc.

  // Status tracking
  status      String   @default("soon")  // soon | implementing | beta | in_review | verified
  version     String   @default("0.0.0") // Semantic version

  // Lifecycle timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Status transition timestamps
  implementedAt DateTime?  // When first algorithm was created
  approvedAt    DateTime?  // When user approved
  verifiedAt    DateTime?  // When admin verified

  // Pattern description (for SOON patterns)
  description        String?  @db.Text
  userReasoning      String?  @db.Text
  identificationSteps Json?   // Array of steps user takes to identify pattern
  attachments        String[] // URLs to images/videos

  // Statistics
  sessionCount       Int @default(0)
  feedbackCount      Int @default(0)
  successRate        Float?
  lastTestedAt       DateTime?

  // Relations
  createdById String
  createdBy   User   @relation("CreatedWorkspaces", fields: [createdById], references: [id])

  approvedById String?
  approvedBy   User?   @relation("ApprovedWorkspaces", fields: [approvedById], references: [id])

  verifiedById String?
  verifiedBy   User?   @relation("VerifiedWorkspaces", fields: [verifiedById], references: [id])

  // Child relations
  messages    WorkspaceMessage[]
  sessions    PatternSession[]
  feedbackItems FeedbackItem[]
  executions  ClaudeExecution[]

  @@index([patternType])
  @@index([status])
  @@index([createdById])
  @@unique([patternType]) // One workspace per pattern type
}

// ============================================================================
// WORKSPACE MESSAGE - Timeline entries (chat-style messages)
// ============================================================================

model WorkspaceMessage {
  id          String   @id @default(cuid())

  workspaceId String
  workspace   PatternWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  // Message metadata
  type        String   // See MESSAGE_TYPES below
  createdAt   DateTime @default(now())

  // Author
  authorId    String?
  author      User?    @relation(fields: [authorId], references: [id])
  authorType  String   @default("user") // user | system | claude

  // Content
  title       String?
  content     String?  @db.Text
  data        Json?    // Type-specific data

  // Attachments
  attachments String[] // URLs to images, videos, files

  // References
  sessionId    String?
  session      PatternSession? @relation(fields: [sessionId], references: [id])

  feedbackId   String?
  feedback     FeedbackItem?   @relation(fields: [feedbackId], references: [id])

  executionId  String?
  execution    ClaudeExecution? @relation(fields: [executionId], references: [id])

  // Status for progress messages
  status       String? // pending | in_progress | completed | failed
  progress     Int?    // 0-100

  @@index([workspaceId, createdAt])
  @@index([type])
  @@index([sessionId])
}

// ============================================================================
// CLAUDE EXECUTION - Tracks each time Claude processes feedback
// ============================================================================

model ClaudeExecution {
  id          String   @id @default(cuid())

  workspaceId String
  workspace   PatternWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  // Trigger
  triggeredBy String
  user        User     @relation(fields: [triggeredBy], references: [id])
  triggeredAt DateTime @default(now())

  // Status
  status      String   @default("pending") // pending | running | completed | failed | retry
  phase       String?  // planning | implementing | testing | refining | deploying
  progress    Int      @default(0) // 0-100

  // Input
  feedbackIds  String[]  // IDs of feedback items sent to Claude
  promptFile   String?   // Path to generated prompt file

  // Output
  completedAt  DateTime?
  filesChanged String[]  // List of files Claude modified
  commitHash   String?
  commitMessage String?  @db.Text

  // Deploy tracking
  deployStartedAt  DateTime?
  deployCompletedAt DateTime?
  deployUrl        String?
  deployStatus     String?  // queued | building | ready | error | canceled
  deployLogs       String?  @db.Text

  // Retry logic
  retryCount   Int      @default(0)
  maxRetries   Int      @default(10)
  retryReason  String?  @db.Text
  parentExecutionId String?

  // Phases breakdown (JSON)
  phases       Json?    // { planning: { startedAt, completedAt, ... }, ... }
  checkpoints  Json?    // Array of checkpoint objects

  // Error handling
  error        String?  @db.Text
  erroredAt    DateTime?

  // Relations
  messages     WorkspaceMessage[]

  @@index([workspaceId, triggeredAt])
  @@index([status])
  @@index([phase])
}

// ============================================================================
// PATTERN SESSION - Test sessions (existing model, linked to workspace)
// ============================================================================

// Add to existing PatternSession model:
// workspaceId String
// workspace   PatternWorkspace @relation(fields: [workspaceId], references: [id])

// ============================================================================
// FEEDBACK ITEM - Individual feedback entries (existing, linked to workspace)
// ============================================================================

// Add to existing FeedbackItem model:
// workspaceId String
// workspace   PatternWorkspace @relation(fields: [workspaceId], references: [id])
// sentToClaudeAt DateTime?
// executionId    String?  // Which Claude execution processed this

// ============================================================================
// USER - Add workspace relations
// ============================================================================

// Add to existing User model:
// createdWorkspaces  PatternWorkspace[] @relation("CreatedWorkspaces")
// approvedWorkspaces PatternWorkspace[] @relation("ApprovedWorkspaces")
// verifiedWorkspaces PatternWorkspace[] @relation("VerifiedWorkspaces")
// claudeExecutions   ClaudeExecution[]
// workspaceMessages  WorkspaceMessage[]
```

## Message Types Reference

```typescript
enum MessageType {
  // Pattern lifecycle
  PATTERN_CREATED = "pattern_created",
  PATTERN_DESCRIPTION_SUBMITTED = "pattern_description_submitted",

  // Session events
  SESSION_CREATED = "session_created",
  SESSION_COMPLETED = "session_completed",

  // Feedback events
  FEEDBACK_ADDED = "feedback_added",
  FEEDBACK_BATCH_SENT = "feedback_batch_sent",

  // Claude execution
  CLAUDE_STARTED = "claude_started",
  CLAUDE_PHASE_UPDATE = "claude_phase_update",
  CLAUDE_CHECKPOINT = "claude_checkpoint",
  CLAUDE_COMPLETED = "claude_completed",
  CLAUDE_FAILED = "claude_failed",

  // Deploy events
  DEPLOY_STARTED = "deploy_started",
  DEPLOY_BUILDING = "deploy_building",
  DEPLOY_SUCCESS = "deploy_success",
  DEPLOY_FAILED = "deploy_failed",
  DEPLOY_RETRY = "deploy_retry",

  // Approval workflow
  USER_APPROVED = "user_approved",
  ADMIN_VERIFIED = "admin_verified",

  // System events
  VERSION_UPDATED = "version_updated",
  STATUS_CHANGED = "status_changed",
}
```

## Status Values

```typescript
// PatternWorkspace.status
enum WorkspaceStatus {
  SOON = "soon",              // Not yet implemented
  IMPLEMENTING = "implementing", // Claude is creating initial algorithm
  BETA = "beta",              // Testing phase
  IN_REVIEW = "in_review",    // User approved, waiting for admin
  VERIFIED = "verified",      // Admin verified, production-ready
}

// ClaudeExecution.status
enum ExecutionStatus {
  PENDING = "pending",        // Waiting to start
  RUNNING = "running",        // Claude is working
  COMPLETED = "completed",    // Successfully finished
  FAILED = "failed",          // Failed and stopped
  RETRY = "retry",           // Retrying after failure
}

// ClaudeExecution.phase
enum ExecutionPhase {
  PLANNING = "planning",
  IMPLEMENTING = "implementing",
  TESTING = "testing",
  REFINING = "refining",
  DEPLOYING = "deploying",
}

// ClaudeExecution.deployStatus (matches Vercel)
enum DeployStatus {
  QUEUED = "queued",
  BUILDING = "building",
  READY = "ready",
  ERROR = "error",
  CANCELED = "canceled",
}
```

## Indexes for Performance

```prisma
// Critical queries:
// 1. Get workspace timeline (messages ordered by time)
@@index([workspaceId, createdAt]) on WorkspaceMessage

// 2. Get user's workspaces
@@index([createdById]) on PatternWorkspace

// 3. Get active executions
@@index([status]) on ClaudeExecution

// 4. Get workspace stats
@@index([workspaceId, triggeredAt]) on ClaudeExecution

// 5. Filter workspaces by status
@@index([status]) on PatternWorkspace
```

## Migration Strategy

1. Create new models: `PatternWorkspace`, `WorkspaceMessage`, `ClaudeExecution`
2. Add foreign keys to existing: `PatternSession`, `FeedbackItem`
3. Create workspaces for existing patterns (data migration script)
4. Link existing sessions and feedback to workspaces
5. Keep old `ImplementationSession` for backward compatibility (deprecated)

## Sample Queries

```typescript
// Get workspace with full timeline
const workspace = await prisma.patternWorkspace.findUnique({
  where: { id: workspaceId },
  include: {
    messages: {
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { name: true, image: true } },
        session: true,
        feedback: true,
        execution: true,
      },
    },
    sessions: {
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
    executions: {
      orderBy: { triggeredAt: 'desc' },
      take: 1, // Latest execution
    },
  },
});

// Create new message in timeline
await prisma.workspaceMessage.create({
  data: {
    workspaceId,
    type: 'feedback_batch_sent',
    authorId: userId,
    authorType: 'user',
    title: 'Feedback sent to Claude',
    content: `Sent ${feedbackCount} corrections for analysis`,
    data: { feedbackIds, sessionId },
  },
});

// Start Claude execution
const execution = await prisma.claudeExecution.create({
  data: {
    workspaceId,
    triggeredBy: userId,
    status: 'pending',
    feedbackIds,
    promptFile: `/tmp/feedback-${workspaceId}-${Date.now()}.json`,
  },
});

// Update execution progress
await prisma.claudeExecution.update({
  where: { id: executionId },
  data: {
    phase: 'implementing',
    progress: 45,
  },
});

// Create progress message
await prisma.workspaceMessage.create({
  data: {
    workspaceId,
    executionId,
    type: 'claude_phase_update',
    authorType: 'claude',
    title: 'Implementation in progress',
    status: 'in_progress',
    progress: 45,
    data: { phase: 'implementing', checkpoint: 'Updating detection logic' },
  },
});
```
