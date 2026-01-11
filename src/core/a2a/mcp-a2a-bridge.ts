/**
 * MCP + A2A Hybrid Bridge
 *
 * Bridges MCP (Model Context Protocol) tools with A2A (Agent-to-Agent) protocol.
 * Enables MCP tools to be exposed as A2A capabilities and A2A agents to use MCP tools.
 *
 * @module core/a2a/mcp-a2a-bridge
 *
 * @example
 * ```typescript
 * import { createMCPA2ABridge } from '@core/a2a';
 *
 * const bridge = createMCPA2ABridge({
 *   mcpManager,
 *   a2aServer,
 * });
 *
 * // Expose MCP tools as A2A capabilities
 * await bridge.exposeToolsAsCapabilities('mcp-server-1');
 *
 * // Execute MCP tool via A2A task
 * const result = await bridge.executeToolViaA2A('mcp-server-1', 'tool-name', { arg: 'value' });
 *
 * // Get unified tool/capability list
 * const capabilities = bridge.getUnifiedCapabilities();
 * ```
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  IMCPManager,
  MCPTool,
  MCPToolCallResult,
  MCPContent,
  MCPContentType,
} from '../tools/mcp/mcp.interface';
import {
  IA2AServer,
  A2ATask,
  A2ATaskResult,
  A2ATaskStatus,
  AgentCard,
  A2AArtifact,
} from './a2a-server';
import { IA2AClient } from './a2a-client';

// ============================================================================
// Enums
// ============================================================================

/**
 * Bridge operation mode
 */
export enum BridgeMode {
  /** MCP tools exposed as A2A capabilities */
  MCP_TO_A2A = 'mcp_to_a2a',
  /** A2A agents provide MCP-like tool interface */
  A2A_TO_MCP = 'a2a_to_mcp',
  /** Bidirectional integration */
  BIDIRECTIONAL = 'bidirectional',
}

/**
 * Capability source type
 */
export enum CapabilitySource {
  MCP = 'mcp',
  A2A = 'a2a',
  HYBRID = 'hybrid',
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Tool-to-capability mapping schema
 */
export const ToolCapabilityMappingSchema = z.object({
  toolName: z.string().min(1),
  serverId: z.string().min(1),
  capabilityName: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).default([]),
});

/**
 * Bridge configuration schema
 */
export const MCPA2ABridgeConfigSchema = z.object({
  /** Bridge operation mode */
  mode: z.nativeEnum(BridgeMode).default(BridgeMode.BIDIRECTIONAL),
  /** Auto-expose MCP tools as A2A capabilities */
  autoExposeMCPTools: z.boolean().default(true),
  /** Auto-register A2A agents as MCP tool providers */
  autoRegisterA2AAgents: z.boolean().default(true),
  /** Prefix for tool-derived capability names */
  capabilityPrefix: z.string().default('mcp:'),
  /** Prefix for agent-derived tool names */
  toolPrefix: z.string().default('a2a:'),
  /** Default timeout for cross-protocol operations (ms) */
  operationTimeout: z.number().int().min(1000).default(30000),
  /** Enable request/response logging */
  enableLogging: z.boolean().default(false),
  /** Maximum concurrent cross-protocol operations */
  maxConcurrentOperations: z.number().int().min(1).default(10),
});

export type ToolCapabilityMapping = z.infer<typeof ToolCapabilityMappingSchema>;
export type MCPA2ABridgeConfig = z.infer<typeof MCPA2ABridgeConfigSchema>;

// ============================================================================
// Types
// ============================================================================

/**
 * Unified capability info combining MCP and A2A
 */
export interface UnifiedCapability {
  id: string;
  name: string;
  description: string;
  source: CapabilitySource;
  sourceId: string; // MCP server ID or A2A agent ID
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Execution result for cross-protocol operations
 */
export interface CrossProtocolResult {
  success: boolean;
  source: CapabilitySource;
  sourceId: string;
  capabilityName: string;
  output?: unknown;
  artifacts?: A2AArtifact[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  duration: number;
  metadata?: Record<string, unknown>;
}

/**
 * Bridge statistics
 */
export interface BridgeStatistics {
  mode: BridgeMode;
  mcpToolsExposed: number;
  a2aAgentsRegistered: number;
  totalCrossProtocolCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageLatency: number;
  activeOperations: number;
}

/**
 * Bridge event types
 */
export const BridgeEvents = {
  TOOL_EXPOSED: 'bridge:tool:exposed',
  TOOL_HIDDEN: 'bridge:tool:hidden',
  AGENT_REGISTERED: 'bridge:agent:registered',
  AGENT_UNREGISTERED: 'bridge:agent:unregistered',
  OPERATION_STARTED: 'bridge:operation:started',
  OPERATION_COMPLETED: 'bridge:operation:completed',
  OPERATION_FAILED: 'bridge:operation:failed',
  CAPABILITY_SYNCED: 'bridge:capability:synced',
  ERROR: 'bridge:error',
} as const;

export type BridgeEventType = (typeof BridgeEvents)[keyof typeof BridgeEvents];

// ============================================================================
// Interface
// ============================================================================

/**
 * MCP-A2A Bridge interface
 */
export interface IMCPA2ABridge {
  // === Configuration ===
  /**
   * Get bridge configuration
   */
  getConfig(): MCPA2ABridgeConfig;

  /**
   * Get bridge mode
   */
  getMode(): BridgeMode;

  // === MCP to A2A (Tool → Capability) ===
  /**
   * Expose MCP tools from a server as A2A capabilities
   */
  exposeToolsAsCapabilities(serverId: string): Promise<ToolCapabilityMapping[]>;

  /**
   * Hide MCP tools from A2A (remove exposed capabilities)
   */
  hideToolsFromA2A(serverId: string): boolean;

  /**
   * Get all exposed tool-capability mappings
   */
  getExposedMappings(): Map<string, ToolCapabilityMapping[]>;

  /**
   * Execute MCP tool via A2A task
   */
  executeToolViaA2A(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<CrossProtocolResult>;

  // === A2A to MCP (Agent → Tool Provider) ===
  /**
   * Register A2A agent as MCP tool provider
   */
  registerAgentAsToolProvider(agentId: string, agentCard: AgentCard): boolean;

  /**
   * Unregister A2A agent from MCP tool providers
   */
  unregisterAgentFromTools(agentId: string): boolean;

  /**
   * Get all registered agent tool providers
   */
  getRegisteredToolProviders(): Map<string, AgentCard>;

  /**
   * Execute A2A agent capability via MCP tool interface
   */
  executeAgentViaMCP(
    agentId: string,
    capabilityName: string,
    args: Record<string, unknown>
  ): Promise<CrossProtocolResult>;

  // === Unified Operations ===
  /**
   * Get unified list of all capabilities (MCP tools + A2A capabilities)
   */
  getUnifiedCapabilities(): UnifiedCapability[];

  /**
   * Execute capability by ID (auto-routes to MCP or A2A)
   */
  executeCapability(
    capabilityId: string,
    args: Record<string, unknown>
  ): Promise<CrossProtocolResult>;

  /**
   * Find capabilities by name pattern or tags
   */
  findCapabilities(criteria: {
    namePattern?: string;
    tags?: string[];
    source?: CapabilitySource;
  }): UnifiedCapability[];

  // === Collaboration ===
  /**
   * Execute workflow involving both MCP tools and A2A agents
   */
  executeHybridWorkflow(
    steps: HybridWorkflowStep[]
  ): Promise<HybridWorkflowResult>;

  // === Events ===
  /**
   * Subscribe to bridge events
   */
  on(event: BridgeEventType, handler: (...args: unknown[]) => void): void;

  /**
   * Unsubscribe from bridge events
   */
  off(event: BridgeEventType, handler: (...args: unknown[]) => void): void;

  // === Statistics ===
  /**
   * Get bridge statistics
   */
  getStatistics(): BridgeStatistics;

  /**
   * Reset statistics
   */
  resetStatistics(): void;

  // === Lifecycle ===
  /**
   * Sync capabilities between MCP and A2A
   */
  sync(): Promise<void>;

  /**
   * Dispose bridge resources
   */
  dispose(): Promise<void>;
}

/**
 * Hybrid workflow step
 */
export interface HybridWorkflowStep {
  id: string;
  type: 'mcp_tool' | 'a2a_task' | 'parallel' | 'conditional';
  // For MCP tool execution
  serverId?: string;
  toolName?: string;
  // For A2A task execution
  agentId?: string;
  capabilityName?: string;
  // Common
  args?: Record<string, unknown> | string; // string for variable reference
  dependsOn?: string[];
  condition?: string;
  // For parallel execution
  parallelSteps?: HybridWorkflowStep[];
  // For conditional execution
  thenSteps?: HybridWorkflowStep[];
  elseSteps?: HybridWorkflowStep[];
}

/**
 * Hybrid workflow result
 */
export interface HybridWorkflowResult {
  success: boolean;
  stepResults: Map<string, CrossProtocolResult>;
  totalDuration: number;
  errors: Array<{ stepId: string; error: string }>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * MCP-A2A Hybrid Bridge
 *
 * Provides seamless integration between MCP tools and A2A agents.
 */
export class MCPA2ABridge extends EventEmitter implements IMCPA2ABridge {
  private readonly config: MCPA2ABridgeConfig;
  private readonly mcpManager?: IMCPManager;
  private readonly a2aServer?: IA2AServer;
  private readonly a2aClient?: IA2AClient;

  // Tool-to-capability mappings (serverId -> mappings[])
  private readonly exposedMappings: Map<string, ToolCapabilityMapping[]> = new Map();

  // Agent-to-tool provider mappings (agentId -> AgentCard)
  private readonly registeredToolProviders: Map<string, AgentCard> = new Map();

  // Unified capability cache
  private unifiedCapabilities: UnifiedCapability[] = [];
  private capabilitiesDirty = true;

  // Statistics
  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    totalLatency: 0,
    activeOperations: 0,
  };

  private disposed = false;

  constructor(
    options: {
      mcpManager?: IMCPManager;
      a2aServer?: IA2AServer;
      a2aClient?: IA2AClient;
      config?: Partial<MCPA2ABridgeConfig>;
    }
  ) {
    super();
    this.config = MCPA2ABridgeConfigSchema.parse(options.config ?? {});
    this.mcpManager = options.mcpManager;
    this.a2aServer = options.a2aServer;
    this.a2aClient = options.a2aClient;

    // Validate we have at least one integration point
    if (!this.mcpManager && !this.a2aServer && !this.a2aClient) {
      throw new Error(
        'At least one of mcpManager, a2aServer, or a2aClient must be provided'
      );
    }
  }

  // === Configuration ===

  getConfig(): MCPA2ABridgeConfig {
    return { ...this.config };
  }

  getMode(): BridgeMode {
    return this.config.mode;
  }

  // === MCP to A2A (Tool → Capability) ===

  async exposeToolsAsCapabilities(serverId: string): Promise<ToolCapabilityMapping[]> {
    this.ensureNotDisposed();

    if (!this.mcpManager) {
      throw new Error('MCP Manager not configured');
    }

    const client = this.mcpManager.getClient(serverId);
    if (!client || !client.isReady()) {
      throw new Error(`MCP server '${serverId}' is not connected`);
    }

    const toolsResult = await client.listTools();
    if (!toolsResult.success || !toolsResult.data) {
      throw new Error(`Failed to list tools from '${serverId}': ${toolsResult.error}`);
    }

    const mappings: ToolCapabilityMapping[] = [];

    for (const tool of toolsResult.data.tools) {
      const mapping = this.createToolCapabilityMapping(serverId, tool);
      mappings.push(mapping);

      this.emit(BridgeEvents.TOOL_EXPOSED, {
        serverId,
        toolName: tool.name,
        capabilityName: mapping.capabilityName,
      });
    }

    this.exposedMappings.set(serverId, mappings);
    this.capabilitiesDirty = true;

    return mappings;
  }

  hideToolsFromA2A(serverId: string): boolean {
    this.ensureNotDisposed();

    if (!this.exposedMappings.has(serverId)) {
      return false;
    }

    const mappings = this.exposedMappings.get(serverId) || [];
    this.exposedMappings.delete(serverId);
    this.capabilitiesDirty = true;

    for (const mapping of mappings) {
      this.emit(BridgeEvents.TOOL_HIDDEN, {
        serverId,
        toolName: mapping.toolName,
        capabilityName: mapping.capabilityName,
      });
    }

    return true;
  }

  getExposedMappings(): Map<string, ToolCapabilityMapping[]> {
    return new Map(this.exposedMappings);
  }

  async executeToolViaA2A(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<CrossProtocolResult> {
    this.ensureNotDisposed();

    if (!this.mcpManager) {
      throw new Error('MCP Manager not configured');
    }

    const startTime = Date.now();
    this.stats.activeOperations++;
    this.stats.totalCalls++;

    this.emit(BridgeEvents.OPERATION_STARTED, {
      type: 'mcp_tool',
      serverId,
      toolName,
    });

    try {
      const result = await this.mcpManager.callTool(serverId, {
        name: toolName,
        arguments: args,
      });

      const duration = Date.now() - startTime;
      this.stats.activeOperations--;

      if (!result.success) {
        this.stats.failedCalls++;
        const crossResult: CrossProtocolResult = {
          success: false,
          source: CapabilitySource.MCP,
          sourceId: serverId,
          capabilityName: toolName,
          error: {
            code: 'MCP_TOOL_ERROR',
            message: result.error || 'Unknown error',
          },
          duration,
        };

        this.emit(BridgeEvents.OPERATION_FAILED, crossResult);
        return crossResult;
      }

      this.stats.successfulCalls++;
      this.stats.totalLatency += duration;

      const crossResult: CrossProtocolResult = {
        success: true,
        source: CapabilitySource.MCP,
        sourceId: serverId,
        capabilityName: toolName,
        output: this.convertMCPResultToOutput(result.data!),
        artifacts: this.convertMCPResultToArtifacts(result.data!),
        duration,
      };

      this.emit(BridgeEvents.OPERATION_COMPLETED, crossResult);
      return crossResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.stats.activeOperations--;
      this.stats.failedCalls++;

      const crossResult: CrossProtocolResult = {
        success: false,
        source: CapabilitySource.MCP,
        sourceId: serverId,
        capabilityName: toolName,
        error: {
          code: 'MCP_TOOL_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        duration,
      };

      this.emit(BridgeEvents.OPERATION_FAILED, crossResult);
      return crossResult;
    }
  }

  // === A2A to MCP (Agent → Tool Provider) ===

  registerAgentAsToolProvider(agentId: string, agentCard: AgentCard): boolean {
    this.ensureNotDisposed();

    if (this.registeredToolProviders.has(agentId)) {
      return false;
    }

    this.registeredToolProviders.set(agentId, agentCard);
    this.capabilitiesDirty = true;

    this.emit(BridgeEvents.AGENT_REGISTERED, {
      agentId,
      agentCard,
    });

    return true;
  }

  unregisterAgentFromTools(agentId: string): boolean {
    this.ensureNotDisposed();

    if (!this.registeredToolProviders.has(agentId)) {
      return false;
    }

    const agentCard = this.registeredToolProviders.get(agentId);
    this.registeredToolProviders.delete(agentId);
    this.capabilitiesDirty = true;

    this.emit(BridgeEvents.AGENT_UNREGISTERED, {
      agentId,
      agentCard,
    });

    return true;
  }

  getRegisteredToolProviders(): Map<string, AgentCard> {
    return new Map(this.registeredToolProviders);
  }

  async executeAgentViaMCP(
    agentId: string,
    capabilityName: string,
    args: Record<string, unknown>
  ): Promise<CrossProtocolResult> {
    this.ensureNotDisposed();

    const startTime = Date.now();
    this.stats.activeOperations++;
    this.stats.totalCalls++;

    this.emit(BridgeEvents.OPERATION_STARTED, {
      type: 'a2a_task',
      agentId,
      capabilityName,
    });

    try {
      let result: A2ATaskResult;

      // Try A2A client first (remote agents)
      if (this.a2aClient && this.a2aClient.isConnected()) {
        const task: A2ATask = this.createA2ATaskFromArgs(capabilityName, args);
        result = await this.a2aClient.delegateTask(agentId, task);
      }
      // Fall back to local A2A server
      else if (this.a2aServer && this.a2aServer.isRunning()) {
        const task: A2ATask = this.createA2ATaskFromArgs(capabilityName, args);
        result = await this.a2aServer.handleTask(task);
      } else {
        throw new Error('No A2A client or server available');
      }

      const duration = Date.now() - startTime;
      this.stats.activeOperations--;

      if (result.status === A2ATaskStatus.FAILED) {
        this.stats.failedCalls++;
        const crossResult: CrossProtocolResult = {
          success: false,
          source: CapabilitySource.A2A,
          sourceId: agentId,
          capabilityName,
          error: result.error || {
            code: 'A2A_TASK_FAILED',
            message: 'Task execution failed',
          },
          duration,
        };

        this.emit(BridgeEvents.OPERATION_FAILED, crossResult);
        return crossResult;
      }

      this.stats.successfulCalls++;
      this.stats.totalLatency += duration;

      const crossResult: CrossProtocolResult = {
        success: true,
        source: CapabilitySource.A2A,
        sourceId: agentId,
        capabilityName,
        output: result.message?.content,
        artifacts: result.artifacts,
        duration,
        metadata: result.metadata as Record<string, unknown>,
      };

      this.emit(BridgeEvents.OPERATION_COMPLETED, crossResult);
      return crossResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.stats.activeOperations--;
      this.stats.failedCalls++;

      const crossResult: CrossProtocolResult = {
        success: false,
        source: CapabilitySource.A2A,
        sourceId: agentId,
        capabilityName,
        error: {
          code: 'A2A_TASK_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        duration,
      };

      this.emit(BridgeEvents.OPERATION_FAILED, crossResult);
      return crossResult;
    }
  }

  // === Unified Operations ===

  getUnifiedCapabilities(): UnifiedCapability[] {
    if (this.capabilitiesDirty) {
      this.rebuildUnifiedCapabilities();
    }
    return [...this.unifiedCapabilities];
  }

  async executeCapability(
    capabilityId: string,
    args: Record<string, unknown>
  ): Promise<CrossProtocolResult> {
    this.ensureNotDisposed();

    const capability = this.findCapabilityById(capabilityId);
    if (!capability) {
      return {
        success: false,
        source: CapabilitySource.HYBRID,
        sourceId: 'unknown',
        capabilityName: capabilityId,
        error: {
          code: 'CAPABILITY_NOT_FOUND',
          message: `Capability '${capabilityId}' not found`,
        },
        duration: 0,
      };
    }

    switch (capability.source) {
      case CapabilitySource.MCP:
        return this.executeToolViaA2A(capability.sourceId, capability.name, args);

      case CapabilitySource.A2A:
        return this.executeAgentViaMCP(capability.sourceId, capability.name, args);

      default:
        return {
          success: false,
          source: capability.source,
          sourceId: capability.sourceId,
          capabilityName: capability.name,
          error: {
            code: 'UNKNOWN_CAPABILITY_SOURCE',
            message: `Unknown capability source: ${capability.source}`,
          },
          duration: 0,
        };
    }
  }

  findCapabilities(criteria: {
    namePattern?: string;
    tags?: string[];
    source?: CapabilitySource;
  }): UnifiedCapability[] {
    const capabilities = this.getUnifiedCapabilities();

    return capabilities.filter((cap) => {
      // Filter by name pattern
      if (criteria.namePattern) {
        const regex = new RegExp(criteria.namePattern, 'i');
        if (!regex.test(cap.name) && !regex.test(cap.description)) {
          return false;
        }
      }

      // Filter by tags
      if (criteria.tags && criteria.tags.length > 0) {
        const hasMatchingTag = criteria.tags.some((tag) => cap.tags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Filter by source
      if (criteria.source && cap.source !== criteria.source) {
        return false;
      }

      return true;
    });
  }

  // === Collaboration ===

  async executeHybridWorkflow(
    steps: HybridWorkflowStep[]
  ): Promise<HybridWorkflowResult> {
    this.ensureNotDisposed();

    const startTime = Date.now();
    const stepResults = new Map<string, CrossProtocolResult>();
    const errors: Array<{ stepId: string; error: string }> = [];

    // Build dependency graph and execute in order
    const executed = new Set<string>();
    const pending = [...steps];

    while (pending.length > 0) {
      // Find steps that can be executed (all dependencies met)
      const executable = pending.filter((step) => {
        if (!step.dependsOn || step.dependsOn.length === 0) {
          return true;
        }
        return step.dependsOn.every((dep) => executed.has(dep));
      });

      if (executable.length === 0 && pending.length > 0) {
        // Circular dependency or missing dependency
        for (const step of pending) {
          errors.push({
            stepId: step.id,
            error: 'Unresolved dependencies',
          });
        }
        break;
      }

      // Execute all executable steps in parallel
      const results = await Promise.all(
        executable.map((step) => this.executeWorkflowStep(step, stepResults))
      );

      // Process results
      for (let i = 0; i < executable.length; i++) {
        const step = executable[i];
        const result = results[i];

        stepResults.set(step.id, result);
        executed.add(step.id);

        if (!result.success) {
          errors.push({
            stepId: step.id,
            error: result.error?.message || 'Unknown error',
          });
        }

        // Remove from pending
        const pendingIndex = pending.findIndex((p) => p.id === step.id);
        if (pendingIndex !== -1) {
          pending.splice(pendingIndex, 1);
        }
      }
    }

    return {
      success: errors.length === 0,
      stepResults,
      totalDuration: Date.now() - startTime,
      errors,
    };
  }

  // === Statistics ===

  getStatistics(): BridgeStatistics {
    return {
      mode: this.config.mode,
      mcpToolsExposed: this.countExposedTools(),
      a2aAgentsRegistered: this.registeredToolProviders.size,
      totalCrossProtocolCalls: this.stats.totalCalls,
      successfulCalls: this.stats.successfulCalls,
      failedCalls: this.stats.failedCalls,
      averageLatency:
        this.stats.successfulCalls > 0
          ? this.stats.totalLatency / this.stats.successfulCalls
          : 0,
      activeOperations: this.stats.activeOperations,
    };
  }

  resetStatistics(): void {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalLatency: 0,
      activeOperations: 0,
    };
  }

  // === Lifecycle ===

  async sync(): Promise<void> {
    this.ensureNotDisposed();

    // Sync MCP tools if auto-expose is enabled
    if (this.config.autoExposeMCPTools && this.mcpManager) {
      const clients = this.mcpManager.getAllClients();
      for (const [serverId, client] of clients) {
        if (client.isReady() && !this.exposedMappings.has(serverId)) {
          try {
            await this.exposeToolsAsCapabilities(serverId);
          } catch {
            // Log but continue with other servers
          }
        }
      }
    }

    // Sync A2A agents if auto-register is enabled
    if (this.config.autoRegisterA2AAgents && this.a2aServer) {
      const agentCards = this.a2aServer.getAllAgentCards();
      for (const card of agentCards) {
        const agentId = this.extractAgentIdFromUrl(card.url);
        if (agentId && !this.registeredToolProviders.has(agentId)) {
          this.registerAgentAsToolProvider(agentId, card);
        }
      }
    }

    this.capabilitiesDirty = true;
    this.emit(BridgeEvents.CAPABILITY_SYNCED, {
      mcpToolsExposed: this.countExposedTools(),
      a2aAgentsRegistered: this.registeredToolProviders.size,
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.exposedMappings.clear();
    this.registeredToolProviders.clear();
    this.unifiedCapabilities = [];
    this.removeAllListeners();
  }

  // === Private Methods ===

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('Bridge has been disposed');
    }
  }

  private createToolCapabilityMapping(
    serverId: string,
    tool: MCPTool
  ): ToolCapabilityMapping {
    return {
      toolName: tool.name,
      serverId,
      capabilityName: `${this.config.capabilityPrefix}${serverId}:${tool.name}`,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
      tags: ['mcp', serverId],
    };
  }

  private createA2ATaskFromArgs(
    capabilityName: string,
    args: Record<string, unknown>
  ): A2ATask {
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      message: {
        role: 'user',
        content: JSON.stringify({ capability: capabilityName, args }),
      },
      metadata: {
        capability: capabilityName,
        args,
        source: 'mcp-a2a-bridge',
      },
    };
  }

  private convertMCPResultToOutput(result: MCPToolCallResult): unknown {
    if (!result.content || result.content.length === 0) {
      return undefined;
    }

    // If single text content, return as string
    if (result.content.length === 1 && result.content[0].type === MCPContentType.TEXT) {
      return (result.content[0] as { type: MCPContentType.TEXT; text: string }).text;
    }

    // Return array of content
    return result.content.map((content: MCPContent) => {
      if (content.type === MCPContentType.TEXT) {
        return { type: 'text', content: content.text };
      }
      if (content.type === MCPContentType.IMAGE) {
        return { type: 'image', data: content.data, mimeType: content.mimeType };
      }
      if (content.type === MCPContentType.RESOURCE) {
        return { type: 'resource', resource: content.resource };
      }
      return content;
    });
  }

  private convertMCPResultToArtifacts(result: MCPToolCallResult): A2AArtifact[] | undefined {
    if (!result.content || result.content.length === 0) {
      return undefined;
    }

    const artifacts: A2AArtifact[] = [];

    result.content.forEach((content: MCPContent, index: number) => {
      if (content.type === MCPContentType.TEXT) {
        artifacts.push({
          id: `artifact-${index}`,
          name: `text-output-${index}`,
          mimeType: 'text/plain',
          parts: [{ type: 'text', content: content.text }],
        });
      } else if (content.type === MCPContentType.IMAGE) {
        artifacts.push({
          id: `artifact-${index}`,
          name: `image-output-${index}`,
          mimeType: content.mimeType,
          parts: [{ type: 'data', data: content.data }],
        });
      }
    });

    return artifacts.length > 0 ? artifacts : undefined;
  }

  private rebuildUnifiedCapabilities(): void {
    const capabilities: UnifiedCapability[] = [];

    // Add MCP tool capabilities
    for (const [serverId, mappings] of this.exposedMappings) {
      for (const mapping of mappings) {
        capabilities.push({
          id: mapping.capabilityName,
          name: mapping.toolName,
          description: mapping.description || `MCP tool: ${mapping.toolName}`,
          source: CapabilitySource.MCP,
          sourceId: serverId,
          inputSchema: mapping.inputSchema,
          outputSchema: mapping.outputSchema,
          tags: mapping.tags,
        });
      }
    }

    // Add A2A agent capabilities
    for (const [agentId, card] of this.registeredToolProviders) {
      for (const capability of card.capabilities) {
        capabilities.push({
          id: `${this.config.toolPrefix}${agentId}:${capability.name}`,
          name: capability.name,
          description: capability.description,
          source: CapabilitySource.A2A,
          sourceId: agentId,
          inputSchema: capability.inputSchema,
          outputSchema: capability.outputSchema,
          tags: ['a2a', agentId],
        });
      }
    }

    this.unifiedCapabilities = capabilities;
    this.capabilitiesDirty = false;
  }

  private findCapabilityById(capabilityId: string): UnifiedCapability | undefined {
    const capabilities = this.getUnifiedCapabilities();
    return capabilities.find((cap) => cap.id === capabilityId);
  }

  private countExposedTools(): number {
    let count = 0;
    for (const mappings of this.exposedMappings.values()) {
      count += mappings.length;
    }
    return count;
  }

  private extractAgentIdFromUrl(url: string): string | undefined {
    const match = url.match(/\/agents\/([^/]+)$/);
    return match ? match[1] : undefined;
  }

  private async executeWorkflowStep(
    step: HybridWorkflowStep,
    previousResults: Map<string, CrossProtocolResult>
  ): Promise<CrossProtocolResult> {
    // Resolve args with variable references
    const resolvedArgs = this.resolveArgs(step.args, previousResults);

    switch (step.type) {
      case 'mcp_tool':
        if (!step.serverId || !step.toolName) {
          return {
            success: false,
            source: CapabilitySource.MCP,
            sourceId: step.serverId || 'unknown',
            capabilityName: step.toolName || 'unknown',
            error: {
              code: 'INVALID_STEP',
              message: 'MCP tool step requires serverId and toolName',
            },
            duration: 0,
          };
        }
        return this.executeToolViaA2A(step.serverId, step.toolName, resolvedArgs);

      case 'a2a_task':
        if (!step.agentId || !step.capabilityName) {
          return {
            success: false,
            source: CapabilitySource.A2A,
            sourceId: step.agentId || 'unknown',
            capabilityName: step.capabilityName || 'unknown',
            error: {
              code: 'INVALID_STEP',
              message: 'A2A task step requires agentId and capabilityName',
            },
            duration: 0,
          };
        }
        return this.executeAgentViaMCP(step.agentId, step.capabilityName, resolvedArgs);

      case 'parallel':
        if (!step.parallelSteps || step.parallelSteps.length === 0) {
          return {
            success: true,
            source: CapabilitySource.HYBRID,
            sourceId: 'parallel',
            capabilityName: step.id,
            duration: 0,
          };
        }
        const parallelResults = await Promise.all(
          step.parallelSteps.map((s) => this.executeWorkflowStep(s, previousResults))
        );
        const allSuccess = parallelResults.every((r) => r.success);
        return {
          success: allSuccess,
          source: CapabilitySource.HYBRID,
          sourceId: 'parallel',
          capabilityName: step.id,
          output: parallelResults,
          duration: Math.max(...parallelResults.map((r) => r.duration)),
        };

      case 'conditional':
        const conditionMet = this.evaluateCondition(step.condition, previousResults);
        const stepsToExecute = conditionMet ? step.thenSteps : step.elseSteps;
        if (!stepsToExecute || stepsToExecute.length === 0) {
          return {
            success: true,
            source: CapabilitySource.HYBRID,
            sourceId: 'conditional',
            capabilityName: step.id,
            duration: 0,
          };
        }
        // Execute conditional steps sequentially
        let lastResult: CrossProtocolResult = {
          success: true,
          source: CapabilitySource.HYBRID,
          sourceId: 'conditional',
          capabilityName: step.id,
          duration: 0,
        };
        for (const s of stepsToExecute) {
          lastResult = await this.executeWorkflowStep(s, previousResults);
          if (!lastResult.success) break;
        }
        return lastResult;

      default:
        return {
          success: false,
          source: CapabilitySource.HYBRID,
          sourceId: 'unknown',
          capabilityName: step.id,
          error: {
            code: 'UNKNOWN_STEP_TYPE',
            message: `Unknown step type: ${step.type}`,
          },
          duration: 0,
        };
    }
  }

  private resolveArgs(
    args: Record<string, unknown> | string | undefined,
    previousResults: Map<string, CrossProtocolResult>
  ): Record<string, unknown> {
    if (!args) {
      return {};
    }

    if (typeof args === 'string') {
      // Variable reference like "${step1.output}"
      const match = args.match(/^\$\{([^}]+)\}$/);
      if (match) {
        const [stepId, field] = match[1].split('.');
        const result = previousResults.get(stepId);
        if (result && field === 'output') {
          return result.output as Record<string, unknown> ?? {};
        }
      }
      return {};
    }

    // Resolve variable references in object values
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const ref = value.slice(2, -1);
        const [stepId, field] = ref.split('.');
        const result = previousResults.get(stepId);
        if (result && field === 'output') {
          resolved[key] = result.output;
        } else {
          resolved[key] = value;
        }
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  private evaluateCondition(
    condition: string | undefined,
    previousResults: Map<string, CrossProtocolResult>
  ): boolean {
    if (!condition) {
      return true;
    }

    // Simple condition evaluation: "${stepId.success}" or "${stepId.output.field}"
    const match = condition.match(/^\$\{([^}]+)\}$/);
    if (!match) {
      return Boolean(condition);
    }

    const parts = match[1].split('.');
    const stepId = parts[0];
    const result = previousResults.get(stepId);

    if (!result) {
      return false;
    }

    if (parts[1] === 'success') {
      return result.success;
    }

    if (parts[1] === 'output' && parts.length > 2) {
      const output = result.output as Record<string, unknown>;
      return Boolean(output?.[parts[2]]);
    }

    return Boolean(result.output);
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new MCP-A2A Bridge
 */
export function createMCPA2ABridge(options: {
  mcpManager?: IMCPManager;
  a2aServer?: IA2AServer;
  a2aClient?: IA2AClient;
  config?: Partial<MCPA2ABridgeConfig>;
}): MCPA2ABridge {
  return new MCPA2ABridge(options);
}
