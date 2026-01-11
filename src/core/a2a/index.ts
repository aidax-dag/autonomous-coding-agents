/**
 * A2A Protocol Module
 *
 * Implements the Google A2A (Agent-to-Agent) protocol for inter-agent communication.
 *
 * @module core/a2a
 *
 * @example
 * ```typescript
 * import {
 *   A2AServer,
 *   A2ATransport,
 *   createA2AServer,
 *   createA2ATransport,
 *   A2AServerStatus,
 *   A2ATaskStatus,
 * } from '@core/a2a';
 *
 * // Create and configure server
 * const server = createA2AServer({
 *   port: 3000,
 *   host: 'localhost',
 *   basePath: '/a2a',
 *   enableStreaming: true,
 * });
 *
 * // Register agents
 * server.registerAgent(myAgent);
 *
 * // Start the server
 * await server.start();
 *
 * // Create transport for HTTP handling
 * const transport = createA2ATransport(server);
 *
 * // Handle incoming requests
 * const response = await transport.handleRequest(request);
 * ```
 */

// ============================================================================
// A2A Server
// ============================================================================

// Enums
export {
  A2AServerStatus,
  A2ATaskStatus,
  A2AContentMode,
  A2AAuthType,
} from './a2a-server';

// Schemas
export {
  AgentSkillSchema,
  A2ACapabilitySchema,
  AuthenticationInfoSchema,
  AgentCardSchema,
  A2AMessageSchema,
  A2AArtifactSchema,
  A2AContextSchema,
  A2AConstraintsSchema,
  A2ATaskSchema,
  A2ATaskResultSchema,
  A2ATaskUpdateSchema,
  A2AServerConfigSchema,
} from './a2a-server';

// Types
export type {
  AgentSkill,
  A2ACapability,
  AuthenticationInfo,
  AgentCard,
  A2AMessage,
  A2AArtifact,
  A2AContext,
  A2AConstraints,
  A2ATask,
  A2ATaskResult,
  A2ATaskUpdate,
  A2AServerConfig,
  A2AError,
  RegisteredAgent,
  ActiveTask,
  A2AServerStats,
  A2AServerEventType,
  ServerEventPayload,
  AgentEventPayload,
  TaskEventPayload,
} from './a2a-server';

// Events
export { A2AServerEvents } from './a2a-server';

// Interface
export type { IA2AServer } from './a2a-server';

// Class
export { A2AServer } from './a2a-server';

// Factory
export { createA2AServer, validateA2ATask, validateAgentCard } from './a2a-server';

// ============================================================================
// A2A Transport
// ============================================================================

// Schemas
export {
  JsonRpcRequestSchema,
  JsonRpcErrorSchema,
  JsonRpcResponseSchema,
} from './a2a-transport';

// Types
export type {
  JsonRpcRequest,
  JsonRpcError,
  JsonRpcResponse,
  HttpRequest,
  HttpResponse,
  StreamEvent,
  IA2ATransport,
} from './a2a-transport';

// Constants
export { JsonRpcErrorCodes, A2AMethods } from './a2a-transport';

export type { A2AMethod } from './a2a-transport';

// Class
export { A2ATransport, JsonRpcException } from './a2a-transport';

// Factory
export { createA2ATransport } from './a2a-transport';

// ============================================================================
// A2A Client
// ============================================================================

// Enums
export { A2AClientStatus } from './a2a-client';

// Schemas
export { A2AClientConfigSchema } from './a2a-client';

// Types
export type {
  A2AClientConfig,
  A2AClientConfigInput,
  ConnectionOptions,
  DelegationOptions,
  A2ACollaborationResult,
  A2AServerInfo,
  A2AClientEventType,
  IA2AClient,
} from './a2a-client';

// Constants
export { A2AClientEvents } from './a2a-client';

// Class
export { A2AClient } from './a2a-client';

// Factory
export { createA2AClient } from './a2a-client';

// ============================================================================
// Agent Card System
// ============================================================================

// Enums
export { AgentCardRegistryStatus } from './agent-card';

// Schemas
export { AgentCardMetadataSchema } from './agent-card';

// Types
export type {
  AgentCardMetadata,
  RegisteredCard,
  AgentCardSearchCriteria,
  AgentCardSearchResult,
  AgentCardRegistryEventType,
  IAgentCardRegistry,
} from './agent-card';

// Constants
export { AgentCardRegistryEvents } from './agent-card';

// Classes
export { AgentCardBuilder, AgentCardRegistry } from './agent-card';

// Factory
export { createAgentCardRegistry, createAgentCardBuilder } from './agent-card';

// ============================================================================
// MCP-A2A Bridge
// ============================================================================

// Enums
export { BridgeMode, CapabilitySource } from './mcp-a2a-bridge';

// Schemas
export {
  ToolCapabilityMappingSchema,
  MCPA2ABridgeConfigSchema,
} from './mcp-a2a-bridge';

// Types
export type {
  ToolCapabilityMapping,
  MCPA2ABridgeConfig,
  UnifiedCapability,
  CrossProtocolResult,
  BridgeStatistics,
  BridgeEventType,
  IMCPA2ABridge,
  HybridWorkflowStep,
  HybridWorkflowResult,
} from './mcp-a2a-bridge';

// Constants
export { BridgeEvents } from './mcp-a2a-bridge';

// Class
export { MCPA2ABridge } from './mcp-a2a-bridge';

// Factory
export { createMCPA2ABridge } from './mcp-a2a-bridge';
