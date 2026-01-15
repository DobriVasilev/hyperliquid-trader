/**
 * TypeScript Type Definitions for Workspace Timeline Messages
 *
 * These types define the structure of messages that appear in the
 * workspace timeline (chat view). Each message type has specific
 * data fields relevant to that activity.
 */

// ============================================================================
// BASE MESSAGE TYPE
// ============================================================================

export interface BaseMessage {
  id: string;
  workspaceId: string;
  type: MessageType;
  createdAt: Date;
  authorId?: string;
  authorType: 'user' | 'system' | 'claude';
  title?: string;
  content?: string;
  attachments?: string[];
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number; // 0-100
}

export enum MessageType {
  // Pattern lifecycle
  PATTERN_CREATED = 'pattern_created',
  PATTERN_DESCRIPTION_SUBMITTED = 'pattern_description_submitted',

  // Session events
  SESSION_CREATED = 'session_created',
  SESSION_COMPLETED = 'session_completed',

  // Feedback events
  FEEDBACK_ADDED = 'feedback_added',
  FEEDBACK_BATCH_SENT = 'feedback_batch_sent',

  // Claude execution
  CLAUDE_STARTED = 'claude_started',
  CLAUDE_PHASE_UPDATE = 'claude_phase_update',
  CLAUDE_CHECKPOINT = 'claude_checkpoint',
  CLAUDE_COMPLETED = 'claude_completed',
  CLAUDE_FAILED = 'claude_failed',

  // Deploy events
  DEPLOY_STARTED = 'deploy_started',
  DEPLOY_BUILDING = 'deploy_building',
  DEPLOY_SUCCESS = 'deploy_success',
  DEPLOY_FAILED = 'deploy_failed',
  DEPLOY_RETRY = 'deploy_retry',

  // Approval workflow
  USER_APPROVED = 'user_approved',
  ADMIN_VERIFIED = 'admin_verified',

  // System events
  VERSION_UPDATED = 'version_updated',
  STATUS_CHANGED = 'status_changed',
}

// ============================================================================
// SPECIFIC MESSAGE TYPES
// ============================================================================

export interface PatternCreatedMessage extends BaseMessage {
  type: MessageType.PATTERN_CREATED;
  data: {
    patternType: string;
    category: string;
    status: 'soon' | 'beta';
  };
}

export interface PatternDescriptionSubmittedMessage extends BaseMessage {
  type: MessageType.PATTERN_DESCRIPTION_SUBMITTED;
  data: {
    description: string;
    identificationSteps: string[];
    attachmentCount: number;
  };
}

export interface SessionCreatedMessage extends BaseMessage {
  type: MessageType.SESSION_CREATED;
  data: {
    sessionId: string;
    sessionName: string;
    symbol: string;
    timeframe: string;
    candleCount: number;
  };
}

export interface FeedbackAddedMessage extends BaseMessage {
  type: MessageType.FEEDBACK_ADDED;
  data: {
    feedbackId: string;
    feedbackType: string; // false_positive | false_negative | adjustment | other
    candleIndex?: number;
    candleTime?: string;
  };
}

export interface FeedbackBatchSentMessage extends BaseMessage {
  type: MessageType.FEEDBACK_BATCH_SENT;
  data: {
    sessionId: string;
    feedbackIds: string[];
    feedbackCount: number;
    totalComments: number;
    totalImages: number;
  };
}

export interface ClaudeStartedMessage extends BaseMessage {
  type: MessageType.CLAUDE_STARTED;
  data: {
    executionId: string;
    feedbackCount: number;
    estimatedDuration?: number; // minutes
  };
}

export interface ClaudePhaseUpdateMessage extends BaseMessage {
  type: MessageType.CLAUDE_PHASE_UPDATE;
  data: {
    executionId: string;
    phase: 'planning' | 'implementing' | 'testing' | 'refining' | 'deploying';
    phaseStartedAt: Date;
    currentTask?: string;
  };
}

export interface ClaudeCheckpointMessage extends BaseMessage {
  type: MessageType.CLAUDE_CHECKPOINT;
  data: {
    executionId: string;
    phase: string;
    checkpoint: string;
    details?: string;
    filesChanged?: string[];
  };
}

export interface ClaudeCompletedMessage extends BaseMessage {
  type: MessageType.CLAUDE_COMPLETED;
  data: {
    executionId: string;
    duration: number; // seconds
    filesChanged: string[];
    commitHash: string;
    commitMessage: string;
  };
}

export interface ClaudeFailedMessage extends BaseMessage {
  type: MessageType.CLAUDE_FAILED;
  data: {
    executionId: string;
    error: string;
    phase: string;
    willRetry: boolean;
    retryCount: number;
  };
}

export interface DeployStartedMessage extends BaseMessage {
  type: MessageType.DEPLOY_STARTED;
  data: {
    executionId: string;
    commitHash: string;
    deploymentId?: string;
  };
}

export interface DeploySuccessMessage extends BaseMessage {
  type: MessageType.DEPLOY_SUCCESS;
  data: {
    executionId: string;
    deploymentId: string;
    deployUrl: string;
    version: string;
    duration: number; // seconds
  };
}

export interface DeployFailedMessage extends BaseMessage {
  type: MessageType.DEPLOY_FAILED;
  data: {
    executionId: string;
    deploymentId?: string;
    error: string;
    logs: string;
    retryCount: number;
    willRetry: boolean;
  };
}

export interface DeployRetryMessage extends BaseMessage {
  type: MessageType.DEPLOY_RETRY;
  data: {
    executionId: string;
    retryNumber: number;
    maxRetries: number;
    previousError: string;
  };
}

export interface UserApprovedMessage extends BaseMessage {
  type: MessageType.USER_APPROVED;
  data: {
    previousStatus: string;
    newStatus: 'in_review';
    comment?: string;
  };
}

export interface AdminVerifiedMessage extends BaseMessage {
  type: MessageType.ADMIN_VERIFIED;
  data: {
    previousStatus: string;
    newStatus: 'verified';
    verifiedBy: string;
    comment?: string;
  };
}

export interface VersionUpdatedMessage extends BaseMessage {
  type: MessageType.VERSION_UPDATED;
  data: {
    previousVersion: string;
    newVersion: string;
    changes: string[];
  };
}

// ============================================================================
// UNION TYPE FOR TYPE-SAFE MESSAGE HANDLING
// ============================================================================

export type TimelineMessage =
  | PatternCreatedMessage
  | PatternDescriptionSubmittedMessage
  | SessionCreatedMessage
  | FeedbackAddedMessage
  | FeedbackBatchSentMessage
  | ClaudeStartedMessage
  | ClaudePhaseUpdateMessage
  | ClaudeCheckpointMessage
  | ClaudeCompletedMessage
  | ClaudeFailedMessage
  | DeployStartedMessage
  | DeploySuccessMessage
  | DeployFailedMessage
  | DeployRetryMessage
  | UserApprovedMessage
  | AdminVerifiedMessage
  | VersionUpdatedMessage;

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface WorkspaceSummary {
  patternType: string;
  status: 'soon' | 'implementing' | 'beta' | 'in_review' | 'verified';
  version: string;
  sessionCount: number;
  feedbackCount: number;
  lastActivity: Date;
  currentExecution?: {
    id: string;
    phase: string;
    progress: number;
  };
}

export interface ExecutionSummary {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retry';
  phase?: 'planning' | 'implementing' | 'testing' | 'refining' | 'deploying';
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  deployStatus?: 'queued' | 'building' | 'ready' | 'error';
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// GET /api/workspace/[patternType]/timeline
export interface GetTimelineRequest {
  patternType: string;
  limit?: number;
  offset?: number;
  types?: MessageType[];
}

export interface GetTimelineResponse {
  messages: TimelineMessage[];
  hasMore: boolean;
  total: number;
}

// POST /api/workspace/[patternType]/session
export interface CreateSessionRequest {
  symbol: string;
  timeframe: string;
  dateRange: {
    start: string;
    end: string;
  };
  candleData: unknown;
}

export interface CreateSessionResponse {
  success: boolean;
  sessionId: string;
  message: TimelineMessage; // SESSION_CREATED message
}

// POST /api/workspace/[patternType]/feedback
export interface AddFeedbackRequest {
  sessionId: string;
  type: 'false_positive' | 'false_negative' | 'adjustment' | 'other';
  reasoning: string;
  candleIndex?: number;
  candleTime?: string;
  attachments?: File[];
  metadata?: Record<string, unknown>;
}

export interface AddFeedbackResponse {
  success: boolean;
  feedbackId: string;
  message: TimelineMessage; // FEEDBACK_ADDED message
}

// POST /api/workspace/[patternType]/send-to-claude
export interface SendToClaudeRequest {
  sessionId?: string; // If provided, only send feedback from this session
  feedbackIds?: string[]; // If provided, only send these specific feedback items
}

export interface SendToClaudeResponse {
  success: boolean;
  executionId: string;
  feedbackCount: number;
  message: TimelineMessage; // FEEDBACK_BATCH_SENT + CLAUDE_STARTED messages
}

// GET /api/workspace/[patternType]/status
export interface GetStatusResponse {
  workspace: WorkspaceSummary;
  currentExecution?: ExecutionSummary;
  recentMessages: TimelineMessage[];
}

// POST /api/workspace/[patternType]/approve
export interface ApprovePatternRequest {
  comment?: string;
}

export interface ApprovePatternResponse {
  success: boolean;
  newStatus: 'in_review';
  message: TimelineMessage; // USER_APPROVED message
}

// POST /api/workspace/[patternType]/verify (admin only)
export interface VerifyPatternRequest {
  comment?: string;
}

export interface VerifyPatternResponse {
  success: boolean;
  newStatus: 'verified';
  message: TimelineMessage; // ADMIN_VERIFIED message
}

// ============================================================================
// WEBSOCKET EVENTS (if using WebSocket instead of polling)
// ============================================================================

export interface WebSocketEvent {
  type: 'message' | 'status_update' | 'execution_update';
  workspaceId: string;
  data: TimelineMessage | WorkspaceSummary | ExecutionSummary;
}
