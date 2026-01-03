/**
 * Core Interfaces Module
 *
 * Exports all core interfaces for the CodeAvengers system.
 *
 * @module core/interfaces
 */

// Agent Interfaces
export {
  // Enums
  AgentType,
  AgentStatus,
  TaskPriority,
  TaskResultStatus,
  // Types
  type AgentCapability,
  type AgentMetrics,
  type HealthStatus,
  type AgentState,
  type ITask,
  type TaskMetadata,
  type TaskResult,
  type TaskError,
  type TaskResultMetadata,
  type IAgent,
  type IAgentConfig,
  type LLMConfig,
  type IAgentFactory,
  type AgentConstructor,
  type IAgentRegistry,
  type IAgentLifecycle,
} from './agent.interface';

// Tool Interfaces
export {
  // Enums
  ToolCategory,
  // Types
  type ToolParameter,
  type ToolParameterType,
  type ToolParameterValidation,
  type ToolSchema,
  type ToolExample,
  type ToolResult,
  type ToolError,
  type ToolResultMetadata,
  type ToolExecutionOptions,
  type ToolValidationResult,
  type ToolValidationError,
  type ITool,
  type ToolConstructor,
  type IToolRegistry,
  type IToolExecutor,
  type ToolCall,
  type ToolExecutionRecord,
  type IToolFactory,
} from './tool.interface';

// Hook Interfaces
export {
  // Enums
  HookEvent,
  HookAction,
  // Types
  type HookContext,
  type HookResult,
  type HookConfig,
  type HookCondition,
  type IHook,
  type HookConstructor,
  type IHookRegistry,
  type IHookExecutor,
  type HookExecutionOptions,
  type HookResultReducer,
  type HookExecutionRecord,
  type BuiltinHookType,
} from './hook.interface';

// Event Interfaces
export {
  // Constants
  SystemEvents,
  // Types
  type IEvent,
  type EventMetadata,
  type EventType,
  type EventHandler,
  type Subscription,
  type EventFilter,
  type SubscriptionOptions,
  type IEventPublisher,
  type IEventSubscriber,
  type IEventBus,
  type IAsyncEventBus,
  type SystemEventType,
  type AgentStartedEvent,
  type AgentStoppedEvent,
  type TaskCompletedEvent,
  type TaskFailedEvent,
  type ContextThresholdEvent,
  type IEventFactory,
} from './event.interface';
