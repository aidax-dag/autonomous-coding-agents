/**
 * Todo Enforcer Hook Module
 *
 * Provides TODO detection, tracking, and enforcement for code quality.
 *
 * Feature: F3.17 - Todo Enforcer
 * @module core/hooks/todo-enforcer
 */

// Export all interfaces
export {
  // Enums
  TodoPriority,
  TodoStatus,
  TodoType,
  EnforcementLevel,
  TodoSupportedLanguage,
  // Interfaces
  type TodoLocation,
  type ParsedTodo,
  type TodoEnforcementRule,
  type EnforcementViolation,
  type TodoFileAnalysis,
  type TodoAnalysisResult,
  type TodoStatistics,
  type TodoEnforcerConfig,
  type TodoEnforcerMetrics,
  type TodoEnforcerEventData,
  type TodoEnforcerSubscription,
  type ITodoEnforcer,
  // Callback types
  type AnalysisStartedCallback,
  type AnalysisCompletedCallback,
  type TodoFoundCallback,
  type ViolationFoundCallback,
  type OperationBlockedCallback,
  // Constants
  TODO_TYPE_PATTERNS,
  PRIORITY_PATTERNS,
  ASSIGNEE_PATTERN,
  ISSUE_REF_PATTERNS,
  DUE_DATE_PATTERNS,
  TAG_PATTERNS,
  EXTENSION_TO_TODO_LANGUAGE,
  LANGUAGE_COMMENT_PATTERNS,
  DEFAULT_TODO_INCLUDE_PATTERNS,
  DEFAULT_TODO_EXCLUDE_PATTERNS,
  DEFAULT_ENFORCEMENT_RULES,
  DEFAULT_TODO_ENFORCER_CONFIG,
  PRIORITY_ORDER,
} from './todo-enforcer.interface.js';

// Export implementation
export { TodoEnforcerHook, createTodoEnforcer } from './todo-enforcer.hook.js';
