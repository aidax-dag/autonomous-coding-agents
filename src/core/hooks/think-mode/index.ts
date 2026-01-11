/**
 * Think Mode Hook Module
 *
 * Provides automatic extended thinking mode detection and switching.
 *
 * Feature: F3.18 - Think Mode
 * @module core/hooks/think-mode
 */

// Export all interfaces
export {
  // Enums
  ThinkMode,
  ThinkTriggerType,
  TransitionReason,
  ComplexityLevel,
  // Interfaces
  type ComplexityAssessment,
  type ComplexityFactor,
  type ThinkTrigger,
  type ModeTransition,
  type ThinkSession,
  type ThinkSessionMetrics,
  type ThinkModeConfig,
  type CustomTriggerPattern,
  type ThinkModeMetrics,
  type ThinkModeEventData,
  type ThinkModeSubscription,
  type IThinkMode,
  // Callback types
  type ModeChangedCallback,
  type ComplexityAssessedCallback,
  type TriggerDetectedCallback,
  type SessionStartedCallback,
  type SessionEndedCallback,
  // Constants
  DEFAULT_COMPLEXITY_THRESHOLDS,
  DEFAULT_TOKEN_LIMITS,
  EXPLICIT_TRIGGER_PATTERNS,
  COMPLEXITY_TRIGGER_PATTERNS,
  MODE_PRIORITY,
  DEFAULT_THINK_MODE_CONFIG,
} from './think-mode.interface.js';

// Export implementation
export { ThinkModeHook, createThinkMode } from './think-mode.hook.js';
