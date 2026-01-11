/**
 * API Interfaces Module
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/interfaces
 */

// ==================== Core API Interfaces ====================
export {
  // Enums
  ApiStatusCode,
  ApiResourceType,
  ApiOperation,
  SortOrder,
  // Types
  type PaginationParams,
  type SortParams,
  type FilterParams,
  type ListQueryParams,
  type PaginationMeta,
  type ApiResponse,
  type ApiResponseMeta,
  type ListResponse,
  type ApiError,
  type ApiErrorDetail,
  type RequestContext,
  type AuthContext,
  type TypedRequest,
  type RouteHandler,
  type RouteDefinition,
  type RouteSchema,
  type RouteMiddleware,
  type RateLimitConfig,
  type AuthConfig,
  type ApiServerConfig,
  type CorsConfig,
  type HelmetConfig,
  type LoggingConfig,
  type SwaggerConfig,
  type SwaggerTag,
  type ApiAuthConfig,
  type AuthValidator,
  type GracefulShutdownConfig,
  type IApiServer,
  type FastifyPluginAsync,
  type ApiServerHealth,
  type IRouter,
  type IController,
  // Constants
  DEFAULT_API_CONFIG,
  API_ERROR_CODES,
  type ApiErrorCode,
} from './api.interface.js';

// ==================== Agent API Interfaces ====================
export {
  // Request types
  type CreateAgentRequest,
  type UpdateAgentRequest,
  type SubmitTaskRequest,
  type AgentListQuery,
  // Response types
  type AgentSummary,
  type AgentDetail,
  type AgentTaskResponse,
  type AgentHealthResponse,
  type AgentCapabilitiesResponse,
  type CreateAgentResponse,
  type GetAgentResponse,
  type ListAgentsResponse,
  type UpdateAgentResponse,
  type DeleteAgentResponse,
  type AgentActionResponse,
  type SubmitTaskResponse,
  type GetAgentHealthResponse,
  type GetAgentCapabilitiesResponse,
  // Route params
  type AgentIdParam,
  type TaskIdParam,
} from './agent-api.interface.js';

// ==================== Workflow API Interfaces ====================
export {
  // Enums
  WorkflowStatus,
  WorkflowInstanceStatus,
  StepStatus,
  // Request types
  type CreateWorkflowRequest,
  type WorkflowStepDefinition,
  type StepConfig,
  type WorkflowTrigger,
  type TriggerConfig,
  type UpdateWorkflowRequest,
  type ExecuteWorkflowRequest,
  type WorkflowListQuery,
  type WorkflowInstanceListQuery,
  // Response types
  type WorkflowSummary,
  type WorkflowDetail,
  type WorkflowStats,
  type WorkflowInstanceSummary,
  type WorkflowInstanceDetail,
  type StepExecution,
  type CreateWorkflowResponse,
  type GetWorkflowResponse,
  type ListWorkflowsResponse,
  type UpdateWorkflowResponse,
  type DeleteWorkflowResponse,
  type ExecuteWorkflowResponse,
  type GetWorkflowInstanceResponse,
  type ListWorkflowInstancesResponse,
  type CancelWorkflowInstanceResponse,
  // Route params
  type WorkflowIdParam,
  type WorkflowInstanceIdParam,
  type WorkflowInstanceParam,
} from './workflow-api.interface.js';

// ==================== Tool API Interfaces ====================
export {
  // Enums
  ToolStatus,
  ExecutionStatus,
  // Request types
  type RegisterToolRequest,
  type UpdateToolRequest,
  type ExecuteToolRequest,
  type BatchExecuteRequest,
  type ToolListQuery,
  type ExecutionHistoryQuery,
  // Response types
  type ToolSummary,
  type ToolDetail,
  type ToolStats,
  type ToolExecutionResult,
  type BatchExecutionResult,
  type ToolValidationResult,
  type RegisterToolResponse,
  type GetToolResponse,
  type ListToolsResponse,
  type UpdateToolResponse,
  type UnregisterToolResponse,
  type ExecuteToolResponse,
  type BatchExecuteResponse,
  type ValidateParametersResponse,
  type GetExecutionHistoryResponse,
  type GetToolStatsResponse,
  // Route params
  type ToolNameParam,
  type ExecutionIdParam,
  type ToolExecutionParam,
} from './tool-api.interface.js';

// ==================== Hook API Interfaces ====================
export {
  // Enums
  HookStatus,
  HookExecutionStatus,
  // Request types
  type RegisterHookRequest,
  type UpdateHookRequest,
  type TestHookRequest,
  type HookListQuery,
  type HookExecutionHistoryQuery,
  // Response types
  type HookSummary,
  type HookDetail,
  type HookStats,
  type HookExecutionRecord,
  type HookTestResult,
  type AvailableEventsResponse,
  type RegisterHookResponse,
  type GetHookResponse,
  type ListHooksResponse,
  type UpdateHookResponse,
  type UnregisterHookResponse,
  type EnableHookResponse,
  type DisableHookResponse,
  type TestHookResponse,
  type GetHookExecutionHistoryResponse,
  type GetHookStatsResponse,
  type GetAvailableEventsResponse,
  // Route params
  type HookIdParam,
  type HookExecutionIdParam,
} from './hook-api.interface.js';

// ==================== WebSocket API Interfaces ====================
export {
  // Enums
  WsConnectionState,
  WsMessageType,
  WsCloseCode,
  // Constants
  WS_ERROR_CODES,
  DEFAULT_WS_CONFIG,
  STREAMABLE_EVENTS,
  // Message types
  type WsMessage,
  type WsRequest,
  type WsResponse,
  type WsEventMessage,
  type WsError,
  type WsAuthPayload,
  type WsAuthResult,
  type WsSubscriptionPayload,
  type WsSubscriptionResult,
  // Connection types
  type WsConnectionInfo,
  type WsConnectionMetrics,
  type IWsConnection,
  // Server types
  type WsServerConfig,
  type WsServerHealth,
  type IWsServer,
  // Handler types
  type WsMessageHandler,
  type WsConnectionHandler,
  type WsDisconnectionHandler,
  type WsErrorHandler,
  // Streaming types
  type EventSubscriptionConfig,
  type StreamingEvent,
} from './ws.interface.js';
