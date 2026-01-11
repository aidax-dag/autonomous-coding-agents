/**
 * Think Mode Hook Implementation
 *
 * Provides automatic extended thinking mode detection and switching.
 *
 * Feature: F3.18 - Think Mode
 * @module core/hooks/think-mode
 */

import * as crypto from 'crypto';
import { BaseHook } from '../base-hook.js';
import { HookContext, HookEvent, HookResult } from '../../interfaces/hook.interface.js';
import {
  ComplexityAssessment,
  ComplexityFactor,
  ComplexityLevel,
  ComplexityAssessedCallback,
  COMPLEXITY_TRIGGER_PATTERNS,
  DEFAULT_THINK_MODE_CONFIG,
  DEFAULT_TOKEN_LIMITS,
  EXPLICIT_TRIGGER_PATTERNS,
  IThinkMode,
  MODE_PRIORITY,
  ModeChangedCallback,
  ModeTransition,
  SessionEndedCallback,
  SessionStartedCallback,
  ThinkMode,
  ThinkModeConfig,
  ThinkModeEventData,
  ThinkModeMetrics,
  ThinkModeSubscription,
  ThinkSession,
  ThinkSessionMetrics,
  ThinkTrigger,
  ThinkTriggerType,
  TransitionReason,
  TriggerDetectedCallback,
} from './think-mode.interface.js';

/**
 * Think Mode Hook Implementation
 */
export class ThinkModeHook
  extends BaseHook<unknown, ThinkModeEventData>
  implements IThinkMode
{
  readonly name = 'think-mode';
  readonly description = 'Automatic extended thinking mode detection and switching';
  readonly event = HookEvent.TASK_BEFORE;

  private config: Required<Omit<ThinkModeConfig, 'customPatterns' | 'name' | 'description' | 'event' | 'conditions'>>;
  private customPatterns: Array<{
    name: string;
    pattern: RegExp;
    triggerType: ThinkTriggerType;
    suggestedMode: ThinkMode;
    weight: number;
  }> = [];

  private currentSession: ThinkSession | undefined;
  private modeHistory: ModeTransition[] = [];
  private metrics: ThinkModeMetrics;
  private sessionTimer: NodeJS.Timeout | undefined;

  // Event callbacks
  private modeChangedCallbacks: Map<string, ModeChangedCallback> = new Map();
  private complexityAssessedCallbacks: Map<string, ComplexityAssessedCallback> = new Map();
  private triggerDetectedCallbacks: Map<string, TriggerDetectedCallback> = new Map();
  private sessionStartedCallbacks: Map<string, SessionStartedCallback> = new Map();
  private sessionEndedCallbacks: Map<string, SessionEndedCallback> = new Map();

  constructor(config?: ThinkModeConfig) {
    // Pass merged config to super so base class properties are set correctly
    super({ ...DEFAULT_THINK_MODE_CONFIG, ...config });

    this.config = {
      ...DEFAULT_THINK_MODE_CONFIG,
      ...config,
    };

    // Compile custom patterns
    if (config?.customPatterns) {
      this.customPatterns = config.customPatterns.map((p) => ({
        name: p.name,
        pattern: new RegExp(p.pattern, 'gi'),
        triggerType: p.triggerType,
        suggestedMode: p.suggestedMode,
        weight: p.weight ?? 0.5,
      }));
    }

    // Initialize metrics
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Execute the hook
   */
  async execute(context: HookContext<unknown>): Promise<HookResult<ThinkModeEventData>> {
    try {
      // Extract input from context
      const input = this.extractInputFromContext(context);
      if (!input) {
        return this.continue(
          { metrics: this.metrics },
          'No input to analyze'
        );
      }

      // Ensure session exists
      if (!this.currentSession) {
        this.startSession(this.config.defaultMode);
      }

      // Detect triggers
      const triggers = this.detectTriggers(input);
      if (triggers.length > 0) {
        this.emitTriggerDetected(triggers);
      }

      // Get recommended mode
      const recommendedMode = this.getRecommendedMode(input, context.metadata);

      // Check if mode change is needed
      const currentMode = this.getCurrentMode();
      if (recommendedMode !== currentMode && MODE_PRIORITY[recommendedMode] > MODE_PRIORITY[currentMode]) {
        // Escalate to higher thinking mode
        this.setMode(recommendedMode, TransitionReason.AUTO_DETECTED.toString());
      }

      return this.continue(
        {
          session: this.currentSession,
          transition: this.modeHistory[this.modeHistory.length - 1],
          metrics: this.metrics,
        },
        `Think mode: ${this.getCurrentMode()}`
      );
    } catch (error) {
      return this.abort(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get current think mode
   */
  getCurrentMode(): ThinkMode {
    return this.currentSession?.currentMode ?? this.config.defaultMode;
  }

  /**
   * Get current session
   */
  getSession(): ThinkSession | undefined {
    return this.currentSession;
  }

  /**
   * Start a new think session
   */
  startSession(initialMode?: ThinkMode): ThinkSession {
    // End existing session if any
    if (this.currentSession) {
      this.endSession();
    }

    const mode = initialMode ?? this.config.defaultMode;
    const now = new Date();

    this.currentSession = {
      id: crypto.randomUUID(),
      currentMode: mode,
      transitions: [],
      tokensUsed: 0,
      startedAt: now,
      lastActivityAt: now,
      metrics: this.createEmptySessionMetrics(),
    };

    // Start session timer
    this.resetSessionTimer();

    // Update global metrics
    this.metrics.totalSessions++;
    this.metrics.activeSessions++;

    // Emit event
    this.emitSessionStarted(this.currentSession);

    return this.currentSession;
  }

  /**
   * End the current session
   */
  endSession(): ThinkSession | undefined {
    if (!this.currentSession) {
      return undefined;
    }

    // Clear session timer
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = undefined;
    }

    // Calculate final metrics
    const sessionDuration = Date.now() - this.currentSession.startedAt.getTime();

    // Update session metrics
    const currentModeTime = Date.now() - this.currentSession.lastActivityAt.getTime();
    this.currentSession.metrics.timeByMode[this.currentSession.currentMode] =
      (this.currentSession.metrics.timeByMode[this.currentSession.currentMode] ?? 0) + currentModeTime;

    // Update global metrics
    this.metrics.activeSessions--;
    this.metrics.averageSessionDuration =
      (this.metrics.averageSessionDuration * (this.metrics.totalSessions - 1) + sessionDuration) /
      this.metrics.totalSessions;
    this.metrics.averageTokensPerSession =
      (this.metrics.averageTokensPerSession * (this.metrics.totalSessions - 1) +
        this.currentSession.tokensUsed) /
      this.metrics.totalSessions;

    const endedSession = this.currentSession;
    this.currentSession = undefined;

    // Emit event
    this.emitSessionEnded(endedSession);

    return endedSession;
  }

  /**
   * Assess complexity of input
   */
  assessComplexity(input: string, context?: Record<string, unknown>): ComplexityAssessment {
    const factors: ComplexityFactor[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Check enabled trigger patterns
    for (const triggerGroup of COMPLEXITY_TRIGGER_PATTERNS) {
      if (!this.config.enabledTriggers.includes(triggerGroup.type)) {
        continue;
      }

      const evidence: string[] = [];
      let patternScore = 0;

      for (const pattern of triggerGroup.patterns) {
        const matches = input.match(pattern);
        if (matches) {
          evidence.push(...matches.slice(0, 3)); // Max 3 evidence items per pattern
          patternScore = Math.min(patternScore + 0.3, 1.0);
        }
      }

      if (evidence.length > 0) {
        factors.push({
          type: triggerGroup.type,
          weight: triggerGroup.weight,
          evidence,
          score: patternScore,
        });

        totalScore += patternScore * triggerGroup.weight;
        totalWeight += triggerGroup.weight;
      }
    }

    // Check custom patterns
    for (const customPattern of this.customPatterns) {
      if (!this.config.enabledTriggers.includes(customPattern.triggerType)) {
        continue;
      }

      const matches = input.match(customPattern.pattern);
      if (matches) {
        factors.push({
          type: customPattern.triggerType,
          weight: customPattern.weight,
          evidence: matches.slice(0, 3),
          score: 0.8,
        });

        totalScore += 0.8 * customPattern.weight;
        totalWeight += customPattern.weight;
      }
    }

    // Consider context factors
    if (context) {
      // File count factor
      const fileCount = (context.fileCount as number) ?? 0;
      if (fileCount > 5) {
        factors.push({
          type: ThinkTriggerType.MULTI_STEP,
          weight: 0.4,
          evidence: [`${fileCount} files involved`],
          score: Math.min(fileCount / 10, 1.0),
        });
        totalScore += Math.min(fileCount / 10, 1.0) * 0.4;
        totalWeight += 0.4;
      }

      // Error count factor
      const errorCount = (context.errorCount as number) ?? 0;
      if (errorCount > 0) {
        factors.push({
          type: ThinkTriggerType.ERROR,
          weight: 0.5,
          evidence: [`${errorCount} errors detected`],
          score: Math.min(errorCount / 5, 1.0),
        });
        totalScore += Math.min(errorCount / 5, 1.0) * 0.5;
        totalWeight += 0.5;
      }
    }

    // Calculate normalized score
    const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Determine complexity level
    let level: ComplexityLevel;
    if (normalizedScore < 0.2) {
      level = ComplexityLevel.TRIVIAL;
    } else if (normalizedScore < 0.4) {
      level = ComplexityLevel.LOW;
    } else if (normalizedScore < 0.6) {
      level = ComplexityLevel.MEDIUM;
    } else if (normalizedScore < 0.8) {
      level = ComplexityLevel.HIGH;
    } else {
      level = ComplexityLevel.CRITICAL;
    }

    // Determine recommended mode
    let recommendedMode: ThinkMode;
    if (normalizedScore >= this.config.ultrathinkThreshold) {
      recommendedMode = ThinkMode.ULTRATHINK;
    } else if (normalizedScore >= this.config.reasoningThreshold) {
      recommendedMode = ThinkMode.REASONING;
    } else if (normalizedScore >= this.config.extendedThreshold) {
      recommendedMode = ThinkMode.EXTENDED;
    } else {
      recommendedMode = ThinkMode.NORMAL;
    }

    // Consider specific factor types for mode override
    const hasSecurityFactor = factors.some((f) => f.type === ThinkTriggerType.SECURITY && f.score > 0.5);
    const hasArchitectureFactor = factors.some((f) => f.type === ThinkTriggerType.ARCHITECTURE && f.score > 0.5);
    const hasErrorFactor = factors.some((f) => f.type === ThinkTriggerType.ERROR && f.score > 0.5);

    if (hasSecurityFactor || hasArchitectureFactor) {
      recommendedMode = this.maxMode(recommendedMode, ThinkMode.REASONING);
    }
    if (hasErrorFactor) {
      recommendedMode = this.maxMode(recommendedMode, ThinkMode.DEBUG);
    }

    const assessment: ComplexityAssessment = {
      level,
      confidence: Math.min(totalWeight / 2, 1.0), // Confidence based on evidence weight
      factors,
      recommendedMode,
      assessedAt: new Date(),
    };

    // Update metrics
    this.metrics.complexityDistribution[level] =
      (this.metrics.complexityDistribution[level] ?? 0) + 1;

    // Emit event
    this.emitComplexityAssessed(assessment);

    return assessment;
  }

  /**
   * Detect triggers in input
   */
  detectTriggers(input: string): ThinkTrigger[] {
    const triggers: ThinkTrigger[] = [];

    // Check explicit triggers first
    for (const explicit of EXPLICIT_TRIGGER_PATTERNS) {
      const match = input.match(explicit.pattern);
      if (match) {
        triggers.push({
          type: ThinkTriggerType.EXPLICIT,
          pattern: explicit.pattern.source,
          match: match[0],
          confidence: 1.0,
          suggestedMode: explicit.mode,
        });
      }
    }

    // If explicit trigger found, return early
    if (triggers.length > 0) {
      return triggers;
    }

    // Check complexity triggers
    for (const triggerGroup of COMPLEXITY_TRIGGER_PATTERNS) {
      if (!this.config.enabledTriggers.includes(triggerGroup.type)) {
        continue;
      }

      for (const pattern of triggerGroup.patterns) {
        const match = input.match(pattern);
        if (match) {
          triggers.push({
            type: triggerGroup.type,
            pattern: pattern.source,
            match: match[0],
            confidence: triggerGroup.weight,
            suggestedMode: triggerGroup.suggestedMode,
          });
          break; // Only one match per trigger group
        }
      }
    }

    // Check custom patterns
    for (const customPattern of this.customPatterns) {
      if (!this.config.enabledTriggers.includes(customPattern.triggerType)) {
        continue;
      }

      const match = input.match(customPattern.pattern);
      if (match) {
        triggers.push({
          type: customPattern.triggerType,
          pattern: customPattern.pattern.source,
          match: match[0],
          confidence: customPattern.weight,
          suggestedMode: customPattern.suggestedMode,
        });
      }
    }

    return triggers;
  }

  /**
   * Manually set think mode
   */
  setMode(mode: ThinkMode, reason?: string): ModeTransition {
    // Ensure session exists
    if (!this.currentSession) {
      // Start with default mode, then transition to target mode
      this.startSession(this.config.defaultMode);
    }

    // Get session reference (guaranteed to exist now)
    const session = this.currentSession!;

    // If target mode is same as current, still create transition record
    if (session.currentMode === mode && session.transitions.length > 0) {
      return session.transitions[session.transitions.length - 1];
    }

    const previousMode = session.currentMode;
    const now = new Date();

    // Update time tracking for previous mode
    const timeInPreviousMode = now.getTime() - session.lastActivityAt.getTime();
    session.metrics.timeByMode[previousMode] =
      (session.metrics.timeByMode[previousMode] ?? 0) + timeInPreviousMode;

    // Determine transition reason
    let transitionReason: TransitionReason;
    if (reason === TransitionReason.AUTO_DETECTED.toString()) {
      transitionReason = TransitionReason.AUTO_DETECTED;
    } else if (reason === TransitionReason.ESCALATION.toString()) {
      transitionReason = TransitionReason.ESCALATION;
    } else if (reason === TransitionReason.DE_ESCALATION.toString()) {
      transitionReason = TransitionReason.DE_ESCALATION;
    } else if (reason === TransitionReason.RESOURCE_LIMIT.toString()) {
      transitionReason = TransitionReason.RESOURCE_LIMIT;
    } else if (reason === TransitionReason.TASK_COMPLETE.toString()) {
      transitionReason = TransitionReason.TASK_COMPLETE;
    } else {
      transitionReason = TransitionReason.USER_REQUEST;
    }

    // Create transition
    const transition: ModeTransition = {
      id: crypto.randomUUID(),
      fromMode: previousMode,
      toMode: mode,
      reason: transitionReason,
      triggers: [],
      timestamp: now,
      context: reason ? { userReason: reason } : undefined,
    };

    // Update session
    session.currentMode = mode;
    session.lastActivityAt = now;
    session.transitions.push(transition);
    session.metrics.transitionCount++;

    // Update global history and metrics
    this.modeHistory.push(transition);
    this.metrics.totalTransitions++;
    this.metrics.transitionsByReason[transitionReason] =
      (this.metrics.transitionsByReason[transitionReason] ?? 0) + 1;
    this.metrics.modeUsage[mode] = (this.metrics.modeUsage[mode] ?? 0) + 1;

    // Reset session timer
    this.resetSessionTimer();

    // Emit event
    this.emitModeChanged(transition);

    return transition;
  }

  /**
   * Get recommended mode for input
   */
  getRecommendedMode(input: string, context?: Record<string, unknown>): ThinkMode {
    if (!this.config.autoDetectEnabled) {
      return this.config.defaultMode;
    }

    // Check explicit triggers first
    const triggers = this.detectTriggers(input);
    const explicitTrigger = triggers.find((t) => t.type === ThinkTriggerType.EXPLICIT);
    if (explicitTrigger) {
      return explicitTrigger.suggestedMode;
    }

    // Assess complexity
    const assessment = this.assessComplexity(input, context);
    return assessment.recommendedMode;
  }

  /**
   * Record thinking tokens used
   */
  recordTokenUsage(tokens: number): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.tokensUsed += tokens;
    this.currentSession.lastActivityAt = new Date();

    // Update mode-specific token tracking
    const currentMode = this.currentSession.currentMode;
    this.currentSession.metrics.tokensByMode[currentMode] =
      (this.currentSession.metrics.tokensByMode[currentMode] ?? 0) + tokens;

    // Check if token limit exceeded
    const limit = this.getTokenLimitForMode(currentMode);
    if (this.currentSession.tokensUsed > limit) {
      // De-escalate due to resource limit
      const lowerMode = this.getLowerMode(currentMode);
      if (lowerMode !== currentMode) {
        this.setMode(lowerMode, TransitionReason.RESOURCE_LIMIT.toString());
      }
    }

    // Reset session timer
    this.resetSessionTimer();
  }

  /**
   * Record task completion
   */
  recordTaskCompletion(success: boolean): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.metrics.tasksCompleted++;
    if (success) {
      this.currentSession.metrics.successfulResolutions++;
    }

    this.currentSession.lastActivityAt = new Date();

    // Auto de-escalate on success
    if (success && this.config.autoDeescalate) {
      const currentMode = this.currentSession.currentMode;
      const lowerMode = this.getLowerMode(currentMode);
      if (lowerMode !== currentMode) {
        this.setMode(lowerMode, TransitionReason.TASK_COMPLETE.toString());
      }
    }

    // Reset session timer
    this.resetSessionTimer();
  }

  /**
   * Get mode metrics
   */
  getMetrics(): ThinkModeMetrics {
    return { ...this.metrics };
  }

  /**
   * Get mode history
   */
  getModeHistory(): ModeTransition[] {
    return [...this.modeHistory];
  }

  /**
   * Subscribe to mode changed events
   */
  onModeChanged(callback: ModeChangedCallback): ThinkModeSubscription {
    const id = crypto.randomUUID();
    this.modeChangedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.modeChangedCallbacks.delete(id);
      },
    };
  }

  /**
   * Subscribe to complexity assessed events
   */
  onComplexityAssessed(callback: ComplexityAssessedCallback): ThinkModeSubscription {
    const id = crypto.randomUUID();
    this.complexityAssessedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.complexityAssessedCallbacks.delete(id);
      },
    };
  }

  /**
   * Subscribe to trigger detected events
   */
  onTriggerDetected(callback: TriggerDetectedCallback): ThinkModeSubscription {
    const id = crypto.randomUUID();
    this.triggerDetectedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.triggerDetectedCallbacks.delete(id);
      },
    };
  }

  /**
   * Subscribe to session started events
   */
  onSessionStarted(callback: SessionStartedCallback): ThinkModeSubscription {
    const id = crypto.randomUUID();
    this.sessionStartedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.sessionStartedCallbacks.delete(id);
      },
    };
  }

  /**
   * Subscribe to session ended events
   */
  onSessionEnded(callback: SessionEndedCallback): ThinkModeSubscription {
    const id = crypto.randomUUID();
    this.sessionEndedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.sessionEndedCallbacks.delete(id);
      },
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Clear session timer
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = undefined;
    }

    // End current session
    if (this.currentSession) {
      this.endSession();
    }

    // Clear callbacks
    this.modeChangedCallbacks.clear();
    this.complexityAssessedCallbacks.clear();
    this.triggerDetectedCallbacks.clear();
    this.sessionStartedCallbacks.clear();
    this.sessionEndedCallbacks.clear();
  }

  // ==================== Private Methods ====================

  /**
   * Extract input from context
   */
  private extractInputFromContext(context: HookContext<unknown>): string | undefined {
    // Try to get input from various context locations
    const data = context.data as Record<string, unknown> | undefined;

    if (typeof data?.input === 'string') {
      return data.input;
    }
    if (typeof data?.message === 'string') {
      return data.message;
    }
    if (typeof data?.content === 'string') {
      return data.content;
    }
    if (typeof data?.task === 'string') {
      return data.task;
    }
    if (typeof data?.prompt === 'string') {
      return data.prompt;
    }

    // Handle messages array (common format)
    if (Array.isArray(data?.messages)) {
      const messages = data.messages as Array<{ role?: string; content?: string }>;
      // Get content from last user message
      const userMessages = messages.filter((m) => m.role === 'user');
      const lastUserMessage = userMessages[userMessages.length - 1];
      if (lastUserMessage?.content) {
        return lastUserMessage.content;
      }
      // Fall back to last message with content
      const lastWithContent = [...messages].reverse().find((m) => m.content);
      if (lastWithContent?.content) {
        return lastWithContent.content;
      }
    }

    return undefined;
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): ThinkModeMetrics {
    return {
      totalSessions: 0,
      activeSessions: 0,
      totalTransitions: 0,
      transitionsByReason: {} as Record<TransitionReason, number>,
      modeUsage: {} as Record<ThinkMode, number>,
      averageSessionDuration: 0,
      averageTokensPerSession: 0,
      complexityDistribution: {} as Record<ComplexityLevel, number>,
    };
  }

  /**
   * Create empty session metrics
   */
  private createEmptySessionMetrics(): ThinkSessionMetrics {
    return {
      transitionCount: 0,
      timeByMode: {} as Record<ThinkMode, number>,
      tokensByMode: {} as Record<ThinkMode, number>,
      averageComplexity: 0,
      tasksCompleted: 0,
      successfulResolutions: 0,
    };
  }

  /**
   * Reset session timer
   */
  private resetSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(() => {
      this.endSession();
    }, this.config.sessionTimeout);
  }

  /**
   * Get token limit for mode
   */
  private getTokenLimitForMode(mode: ThinkMode): number {
    switch (mode) {
      case ThinkMode.EXTENDED:
        return this.config.extendedTokenLimit;
      case ThinkMode.REASONING:
        return this.config.reasoningTokenLimit;
      case ThinkMode.ULTRATHINK:
        return this.config.ultrathinkTokenLimit;
      default:
        return DEFAULT_TOKEN_LIMITS[mode];
    }
  }

  /**
   * Get lower mode (for de-escalation)
   */
  private getLowerMode(mode: ThinkMode): ThinkMode {
    const priority = MODE_PRIORITY[mode];
    for (const [m, p] of Object.entries(MODE_PRIORITY)) {
      if (p === priority - 1) {
        return m as ThinkMode;
      }
    }
    return mode;
  }

  /**
   * Get max mode by priority
   */
  private maxMode(a: ThinkMode, b: ThinkMode): ThinkMode {
    return MODE_PRIORITY[a] >= MODE_PRIORITY[b] ? a : b;
  }

  // ==================== Event Emitters ====================

  private emitModeChanged(transition: ModeTransition): void {
    this.modeChangedCallbacks.forEach((cb) => {
      try {
        cb(transition);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private emitComplexityAssessed(assessment: ComplexityAssessment): void {
    this.complexityAssessedCallbacks.forEach((cb) => {
      try {
        cb(assessment);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private emitTriggerDetected(triggers: ThinkTrigger[]): void {
    this.triggerDetectedCallbacks.forEach((cb) => {
      try {
        cb(triggers);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private emitSessionStarted(session: ThinkSession): void {
    this.sessionStartedCallbacks.forEach((cb) => {
      try {
        cb(session);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private emitSessionEnded(session: ThinkSession): void {
    this.sessionEndedCallbacks.forEach((cb) => {
      try {
        cb(session);
      } catch {
        // Ignore callback errors
      }
    });
  }
}

/**
 * Factory function to create ThinkModeHook
 */
export function createThinkMode(config?: ThinkModeConfig): ThinkModeHook {
  return new ThinkModeHook(config);
}
