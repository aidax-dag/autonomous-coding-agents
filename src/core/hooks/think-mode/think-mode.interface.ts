/**
 * Think Mode Hook Interface
 *
 * Provides automatic extended thinking mode detection and switching.
 *
 * Feature: F3.18 - Think Mode
 * @module core/hooks/think-mode
 */

import { IDisposable } from '../../di/interfaces/container.interface.js';
import { HookConfig } from '../../interfaces/hook.interface.js';

// ==================== Enums ====================

/**
 * Think mode types for different analysis depths
 */
export enum ThinkMode {
  /** Standard response mode - quick, focused answers */
  NORMAL = 'normal',
  /** Extended analysis mode - deeper exploration (~4K tokens) */
  EXTENDED = 'extended',
  /** Step-by-step reasoning mode - methodical analysis (~10K tokens) */
  REASONING = 'reasoning',
  /** Creative problem-solving mode - exploratory thinking */
  CREATIVE = 'creative',
  /** Debug/troubleshooting mode - systematic investigation */
  DEBUG = 'debug',
  /** Maximum depth analysis mode (~32K tokens) */
  ULTRATHINK = 'ultrathink',
}

/**
 * Trigger types for mode switching
 */
export enum ThinkTriggerType {
  /** Explicit user command/flag */
  EXPLICIT = 'explicit',
  /** Automatic complexity detection */
  COMPLEXITY = 'complexity',
  /** Error/failure context */
  ERROR = 'error',
  /** Ambiguity in requirements */
  AMBIGUITY = 'ambiguity',
  /** Multi-step problem detection */
  MULTI_STEP = 'multi_step',
  /** Architecture/design context */
  ARCHITECTURE = 'architecture',
  /** Security-sensitive context */
  SECURITY = 'security',
  /** Performance optimization context */
  PERFORMANCE = 'performance',
}

/**
 * Think mode transition reasons
 */
export enum TransitionReason {
  /** User explicitly requested mode */
  USER_REQUEST = 'user_request',
  /** Automatic trigger detected */
  AUTO_DETECTED = 'auto_detected',
  /** Escalation due to complexity */
  ESCALATION = 'escalation',
  /** De-escalation after resolution */
  DE_ESCALATION = 'de_escalation',
  /** Timeout or resource limit */
  RESOURCE_LIMIT = 'resource_limit',
  /** Task completion */
  TASK_COMPLETE = 'task_complete',
}

/**
 * Complexity level assessment
 */
export enum ComplexityLevel {
  /** Simple, single-step task */
  TRIVIAL = 'trivial',
  /** Standard task, no special handling */
  LOW = 'low',
  /** Moderate complexity, may benefit from extended thinking */
  MEDIUM = 'medium',
  /** High complexity, extended thinking recommended */
  HIGH = 'high',
  /** Very high complexity, deep analysis required */
  CRITICAL = 'critical',
}

// ==================== Interfaces ====================

/**
 * Complexity assessment result
 */
export interface ComplexityAssessment {
  /** Overall complexity level */
  level: ComplexityLevel;
  /** Confidence in the assessment (0-1) */
  confidence: number;
  /** Detected complexity factors */
  factors: ComplexityFactor[];
  /** Recommended think mode */
  recommendedMode: ThinkMode;
  /** Assessment timestamp */
  assessedAt: Date;
}

/**
 * Individual complexity factor
 */
export interface ComplexityFactor {
  /** Factor type */
  type: ThinkTriggerType;
  /** Factor weight (0-1) */
  weight: number;
  /** Evidence supporting this factor */
  evidence: string[];
  /** Factor score (0-1) */
  score: number;
}

/**
 * Think mode trigger
 */
export interface ThinkTrigger {
  /** Trigger type */
  type: ThinkTriggerType;
  /** Pattern or keyword that triggered */
  pattern: string;
  /** Matched content */
  match?: string;
  /** Trigger confidence (0-1) */
  confidence: number;
  /** Recommended mode from this trigger */
  suggestedMode: ThinkMode;
}

/**
 * Mode transition event
 */
export interface ModeTransition {
  /** Transition ID */
  id: string;
  /** Previous mode */
  fromMode: ThinkMode;
  /** New mode */
  toMode: ThinkMode;
  /** Reason for transition */
  reason: TransitionReason;
  /** Triggers that caused transition */
  triggers: ThinkTrigger[];
  /** Transition timestamp */
  timestamp: Date;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Think mode session state
 */
export interface ThinkSession {
  /** Session ID */
  id: string;
  /** Current think mode */
  currentMode: ThinkMode;
  /** Mode history */
  transitions: ModeTransition[];
  /** Total thinking tokens used */
  tokensUsed: number;
  /** Session start time */
  startedAt: Date;
  /** Last activity time */
  lastActivityAt: Date;
  /** Session metrics */
  metrics: ThinkSessionMetrics;
}

/**
 * Think session metrics
 */
export interface ThinkSessionMetrics {
  /** Total mode transitions */
  transitionCount: number;
  /** Time spent in each mode (ms) */
  timeByMode: Record<ThinkMode, number>;
  /** Tokens used by mode */
  tokensByMode: Record<ThinkMode, number>;
  /** Average complexity assessed */
  averageComplexity: number;
  /** Tasks completed */
  tasksCompleted: number;
  /** Successful resolutions */
  successfulResolutions: number;
}

/**
 * Think mode configuration
 */
export interface ThinkModeConfig extends Partial<HookConfig> {
  /** Enable automatic mode detection */
  autoDetectEnabled?: boolean;
  /** Default think mode */
  defaultMode?: ThinkMode;
  /** Complexity threshold for extended mode (0-1) */
  extendedThreshold?: number;
  /** Complexity threshold for reasoning mode (0-1) */
  reasoningThreshold?: number;
  /** Complexity threshold for ultrathink mode (0-1) */
  ultrathinkThreshold?: number;
  /** Maximum tokens for extended mode */
  extendedTokenLimit?: number;
  /** Maximum tokens for reasoning mode */
  reasoningTokenLimit?: number;
  /** Maximum tokens for ultrathink mode */
  ultrathinkTokenLimit?: number;
  /** Auto de-escalation after success */
  autoDeescalate?: boolean;
  /** Triggers to enable */
  enabledTriggers?: ThinkTriggerType[];
  /** Custom trigger patterns */
  customPatterns?: CustomTriggerPattern[];
  /** Session timeout (ms) */
  sessionTimeout?: number;
}

/**
 * Custom trigger pattern
 */
export interface CustomTriggerPattern {
  /** Pattern name */
  name: string;
  /** Regex pattern string */
  pattern: string;
  /** Trigger type to use */
  triggerType: ThinkTriggerType;
  /** Mode to suggest */
  suggestedMode: ThinkMode;
  /** Pattern weight (0-1) */
  weight?: number;
}

/**
 * Think mode metrics
 */
export interface ThinkModeMetrics {
  /** Total sessions */
  totalSessions: number;
  /** Active sessions */
  activeSessions: number;
  /** Total transitions */
  totalTransitions: number;
  /** Transitions by type */
  transitionsByReason: Record<TransitionReason, number>;
  /** Mode usage distribution */
  modeUsage: Record<ThinkMode, number>;
  /** Average session duration (ms) */
  averageSessionDuration: number;
  /** Average tokens per session */
  averageTokensPerSession: number;
  /** Complexity distribution */
  complexityDistribution: Record<ComplexityLevel, number>;
  /** Auto-detection accuracy (when feedback available) */
  autoDetectionAccuracy?: number;
}

/**
 * Think mode event data
 */
export interface ThinkModeEventData {
  /** Current session */
  session?: ThinkSession;
  /** Latest transition */
  transition?: ModeTransition;
  /** Metrics snapshot */
  metrics: ThinkModeMetrics;
}

/**
 * Think mode subscription
 */
export interface ThinkModeSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

// ==================== Event Callbacks ====================

/**
 * Callback for mode changed event
 */
export type ModeChangedCallback = (transition: ModeTransition) => void;

/**
 * Callback for complexity assessed event
 */
export type ComplexityAssessedCallback = (assessment: ComplexityAssessment) => void;

/**
 * Callback for trigger detected event
 */
export type TriggerDetectedCallback = (triggers: ThinkTrigger[]) => void;

/**
 * Callback for session started event
 */
export type SessionStartedCallback = (session: ThinkSession) => void;

/**
 * Callback for session ended event
 */
export type SessionEndedCallback = (session: ThinkSession) => void;

// ==================== Main Interface ====================

/**
 * Think Mode Hook Interface
 */
export interface IThinkMode extends IDisposable {
  /**
   * Get current think mode
   */
  getCurrentMode(): ThinkMode;

  /**
   * Get current session
   */
  getSession(): ThinkSession | undefined;

  /**
   * Start a new think session
   */
  startSession(initialMode?: ThinkMode): ThinkSession;

  /**
   * End the current session
   */
  endSession(): ThinkSession | undefined;

  /**
   * Assess complexity of input
   */
  assessComplexity(input: string, context?: Record<string, unknown>): ComplexityAssessment;

  /**
   * Detect triggers in input
   */
  detectTriggers(input: string): ThinkTrigger[];

  /**
   * Manually set think mode
   */
  setMode(mode: ThinkMode, reason?: string): ModeTransition;

  /**
   * Get recommended mode for input
   */
  getRecommendedMode(input: string, context?: Record<string, unknown>): ThinkMode;

  /**
   * Record thinking tokens used
   */
  recordTokenUsage(tokens: number): void;

  /**
   * Record task completion (for de-escalation)
   */
  recordTaskCompletion(success: boolean): void;

  /**
   * Get mode metrics
   */
  getMetrics(): ThinkModeMetrics;

  /**
   * Get mode history
   */
  getModeHistory(): ModeTransition[];

  /**
   * Subscribe to mode changed events
   */
  onModeChanged(callback: ModeChangedCallback): ThinkModeSubscription;

  /**
   * Subscribe to complexity assessed events
   */
  onComplexityAssessed(callback: ComplexityAssessedCallback): ThinkModeSubscription;

  /**
   * Subscribe to trigger detected events
   */
  onTriggerDetected(callback: TriggerDetectedCallback): ThinkModeSubscription;

  /**
   * Subscribe to session started events
   */
  onSessionStarted(callback: SessionStartedCallback): ThinkModeSubscription;

  /**
   * Subscribe to session ended events
   */
  onSessionEnded(callback: SessionEndedCallback): ThinkModeSubscription;
}

// ==================== Constants ====================

/**
 * Default complexity thresholds
 */
export const DEFAULT_COMPLEXITY_THRESHOLDS = {
  extended: 0.4,
  reasoning: 0.6,
  ultrathink: 0.85,
};

/**
 * Default token limits by mode
 */
export const DEFAULT_TOKEN_LIMITS: Record<ThinkMode, number> = {
  [ThinkMode.NORMAL]: 2000,
  [ThinkMode.EXTENDED]: 4000,
  [ThinkMode.REASONING]: 10000,
  [ThinkMode.CREATIVE]: 6000,
  [ThinkMode.DEBUG]: 8000,
  [ThinkMode.ULTRATHINK]: 32000,
};

/**
 * Explicit mode trigger patterns (user commands)
 * Note: More specific patterns must come first (e.g., --think-hard before --think)
 */
export const EXPLICIT_TRIGGER_PATTERNS: Array<{
  pattern: RegExp;
  mode: ThinkMode;
}> = [
  { pattern: /--think-hard\b/i, mode: ThinkMode.REASONING },
  { pattern: /--ultrathink\b/i, mode: ThinkMode.ULTRATHINK },
  { pattern: /--creative\b/i, mode: ThinkMode.CREATIVE },
  { pattern: /--debug\b/i, mode: ThinkMode.DEBUG },
  { pattern: /--think\b/i, mode: ThinkMode.EXTENDED }, // Must be last (matches --think only)
];

/**
 * Complexity trigger patterns
 */
export const COMPLEXITY_TRIGGER_PATTERNS: Array<{
  type: ThinkTriggerType;
  patterns: RegExp[];
  weight: number;
  suggestedMode: ThinkMode;
}> = [
  // Architecture/design triggers
  {
    type: ThinkTriggerType.ARCHITECTURE,
    patterns: [
      /\b(architect|design|system|infrastructure|microservice|monolith)\b/i,
      /\b(scalab|maintainab|extensib|modular)\w*\b/i,
      /\b(refactor|restructure|reorganize|redesign)\b/i,
    ],
    weight: 0.7,
    suggestedMode: ThinkMode.REASONING,
  },
  // Multi-step problem triggers
  {
    type: ThinkTriggerType.MULTI_STEP,
    patterns: [
      /\b(first|then|next|after|finally|step\s*\d+)\b/i,
      /\b(workflow|pipeline|process|sequence)\b/i,
      /\b(multiple|several|various|many)\s+(file|component|module|step)/i,
    ],
    weight: 0.5,
    suggestedMode: ThinkMode.EXTENDED,
  },
  // Error/debug triggers
  {
    type: ThinkTriggerType.ERROR,
    patterns: [
      /\b(error|bug|issue|problem|fail\w*|broken|crash\w*)\b/i,
      /\b(debug\w*|troubleshoot\w*|diagnose|investigate)\b/i,
      /\b(doesn't work|not working|won't|can't)\b/i,
    ],
    weight: 0.6,
    suggestedMode: ThinkMode.DEBUG,
  },
  // Security triggers
  {
    type: ThinkTriggerType.SECURITY,
    patterns: [
      /\b(security|vulnerab\w*|auth\w*|permission|access\s+control)\b/i,
      /\b(encrypt\w*|decrypt\w*|hash\w*|token|credential|secret)\b/i,
      /\b(xss|csrf|injection|sanitize|validate)\b/i,
    ],
    weight: 0.8,
    suggestedMode: ThinkMode.REASONING,
  },
  // Performance triggers
  {
    type: ThinkTriggerType.PERFORMANCE,
    patterns: [
      /\b(performance|optimiz|slow|fast|speed|latency)\b/i,
      /\b(memory|cpu|resource|bottleneck|profil)\b/i,
      /\b(cache|lazy|eager|batch|parallel)\b/i,
    ],
    weight: 0.6,
    suggestedMode: ThinkMode.EXTENDED,
  },
  // Ambiguity triggers
  {
    type: ThinkTriggerType.AMBIGUITY,
    patterns: [
      /\b(unclear|confus|ambigu|vague|not sure)\b/i,
      /\b(what|how|why|which|when)\s+(should|would|could|do)\b/i,
      /\b(best\s+practice|recommend|suggest|advise)\b/i,
    ],
    weight: 0.5,
    suggestedMode: ThinkMode.EXTENDED,
  },
];

/**
 * Mode priority order (higher = more thinking)
 */
export const MODE_PRIORITY: Record<ThinkMode, number> = {
  [ThinkMode.NORMAL]: 0,
  [ThinkMode.EXTENDED]: 1,
  [ThinkMode.CREATIVE]: 2,
  [ThinkMode.DEBUG]: 3,
  [ThinkMode.REASONING]: 4,
  [ThinkMode.ULTRATHINK]: 5,
};

/**
 * Default think mode configuration
 */
export const DEFAULT_THINK_MODE_CONFIG: Required<
  Omit<ThinkModeConfig, 'customPatterns' | 'name' | 'description' | 'event' | 'conditions'>
> = {
  priority: 95, // High priority to influence other hooks
  enabled: true,
  timeout: 120000,
  retryOnError: false,
  autoDetectEnabled: true,
  defaultMode: ThinkMode.NORMAL,
  extendedThreshold: DEFAULT_COMPLEXITY_THRESHOLDS.extended,
  reasoningThreshold: DEFAULT_COMPLEXITY_THRESHOLDS.reasoning,
  ultrathinkThreshold: DEFAULT_COMPLEXITY_THRESHOLDS.ultrathink,
  extendedTokenLimit: DEFAULT_TOKEN_LIMITS[ThinkMode.EXTENDED],
  reasoningTokenLimit: DEFAULT_TOKEN_LIMITS[ThinkMode.REASONING],
  ultrathinkTokenLimit: DEFAULT_TOKEN_LIMITS[ThinkMode.ULTRATHINK],
  autoDeescalate: true,
  enabledTriggers: Object.values(ThinkTriggerType),
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
};
