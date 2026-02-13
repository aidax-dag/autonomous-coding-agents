/**
 * Service Registry
 *
 * Lightweight service locator for initializing and managing integration modules
 * (validation, learning, context). Provides typed getters with null safety
 * and graceful degradation on initialization failures.
 *
 * @module core/services/service-registry
 */

import {
  ConfidenceChecker,
  createConfidenceChecker,
} from '../validation/confidence-checker';
import {
  SelfCheckProtocol,
  createSelfCheckProtocol,
} from '../validation/self-check-protocol';
import {
  GoalBackwardVerifier,
  createGoalBackwardVerifier,
} from '../validation/goal-backward-verifier';
import { ReflexionPattern, createReflexionPattern } from '../learning/reflexion-pattern';
import { InstinctStore, createInstinctStore } from '../learning/instinct-store';
import { SolutionsCache, createSolutionsCache } from '../learning/solutions-cache';
import { ContextManager, createContextManager } from '../context/context-manager';
import {
  SessionManager,
  createSessionManager,
  createJSONLPersistence,
  createSessionRecovery,
} from '../session/index';
import { SandboxEscalation, createSandboxEscalation } from '../security/sandbox-escalation';
import type { SandboxEscalationOptions } from '../security/interfaces/escalation.interface';
import { PermissionManager, createPermissionManager } from '../permission/permission-manager';
import type { PermissionManagerOptions } from '../permission/permission-manager';
import { MCPClient, createMCPClient } from '../mcp/mcp-client';
import { MCPToolRegistry, createMCPToolRegistry } from '../mcp/mcp-tool-registry';
import {
  MCPConnectionManager,
  createMCPConnectionManager,
  type MCPServerEntry,
} from '../mcp/mcp-connection-manager';
import { LSPClient, createLSPClient } from '../lsp/lsp-client';
import { DiagnosticsCollector, createDiagnosticsCollector } from '../lsp/diagnostics-collector';
import {
  LSPConnectionManager,
  createLSPConnectionManager,
  type LSPServerEntry as LSPServerEntryType,
} from '../lsp/lsp-connection-manager';
import { SkillRegistry, createSkillRegistry } from '../skills/skill-registry';
import { PluginLoader, createPluginLoader } from '../plugins/plugin-loader';
import { PluginRegistry, createPluginRegistry } from '../plugins/plugin-registry';
import { PluginLifecycle, createPluginLifecycle } from '../plugins/plugin-lifecycle';
import { StateTracker, createStateTracker } from '../context/planning-context/state-tracker';
import { PhaseManager, createPhaseManager } from '../context/planning-context/phase-manager';
import { ContextBudget, createContextBudget } from '../context/planning-context/context-budget';
import { GitHubClient, createGitHubClient } from '../../shared/github/github-client';
import { mkdir } from 'fs/promises';

/**
 * Configuration for ServiceRegistry initialization
 */
export interface ServiceRegistryConfig {
  /** Project root directory */
  projectRoot?: string;
  /** Enable validation modules (ConfidenceChecker, SelfCheckProtocol, GoalBackwardVerifier) */
  enableValidation?: boolean;
  /** Enable learning modules (ReflexionPattern, InstinctStore, SolutionsCache) */
  enableLearning?: boolean;
  /** Enable context management module (ContextManager) */
  enableContext?: boolean;
  /** Enable session persistence module (SessionManager) */
  enableSession?: boolean;
  /** Enable security module (SandboxEscalation) */
  enableSecurity?: boolean;
  /** Directory for memory/learning persistence (default: 'docs/memory') */
  memoryDir?: string;
  /** Directory for session persistence (default: 'data/sessions') */
  sessionDir?: string;
  /** Sandbox escalation options */
  sandboxOptions?: SandboxEscalationOptions;
  /** Enable permission module (PermissionManager) (default: false) */
  enablePermission?: boolean;
  /** Permission manager options */
  permissionOptions?: PermissionManagerOptions;
  /** Enable planning context module (default: false) */
  enablePlanningContext?: boolean;
  /** Directory for planning state persistence (default: 'data/planning') */
  planningDir?: string;
  /** Enable MCP integration (default: false) */
  enableMCP?: boolean;
  /** MCP server configurations for multi-server connection management */
  mcpServers?: MCPServerEntry[];
  /** Enable LSP integration (default: false) */
  enableLSP?: boolean;
  /** LSP server configurations for multi-server connection management */
  lspServers?: LSPServerEntryType[];
  /** Enable skills registry (default: false, auto-enabled with enableMCP or enableLSP) */
  enableSkills?: boolean;
  /** Enable plugin system (default: false) */
  enablePlugins?: boolean;
  /** Directory for plugin discovery (default: 'plugins') */
  pluginsDir?: string;
  /** Enable GitHub integration (default: false) */
  enableGitHub?: boolean;
  /** GitHub personal access token */
  githubToken?: string;
}

/**
 * ServiceRegistry
 *
 * Singleton registry managing integration module lifecycle.
 * Each module initializes independently - one failure doesn't block others.
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;

  private confidenceChecker: ConfidenceChecker | null = null;
  private selfCheckProtocol: SelfCheckProtocol | null = null;
  private goalBackwardVerifier: GoalBackwardVerifier | null = null;
  private reflexionPattern: ReflexionPattern | null = null;
  private instinctStore: InstinctStore | null = null;
  private solutionsCache: SolutionsCache | null = null;
  private contextManager: ContextManager | null = null;
  private sessionManager: SessionManager | null = null;
  private sandboxEscalation: SandboxEscalation | null = null;
  private permissionManager: PermissionManager | null = null;
  private mcpClient: MCPClient | null = null;
  private mcpToolRegistry: MCPToolRegistry | null = null;
  private mcpConnectionManager: MCPConnectionManager | null = null;
  private lspClient: LSPClient | null = null;
  private diagnosticsCollector: DiagnosticsCollector | null = null;
  private lspConnectionManager: LSPConnectionManager | null = null;
  private skillRegistry: SkillRegistry | null = null;
  private pluginLoader: PluginLoader | null = null;
  private pluginRegistry: PluginRegistry | null = null;
  private pluginLifecycle: PluginLifecycle | null = null;
  private stateTracker: StateTracker | null = null;
  private phaseManager: PhaseManager | null = null;
  private contextBudget: ContextBudget | null = null;
  private githubClient: GitHubClient | null = null;
  private _initialized = false;

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /** Reset singleton instance (for testing) */
  static resetInstance(): void {
    ServiceRegistry.instance = undefined as unknown as ServiceRegistry;
  }

  /**
   * Initialize enabled modules.
   * Idempotent - calling multiple times is safe.
   * Each module initializes in its own try/catch for graceful degradation.
   */
  async initialize(config: ServiceRegistryConfig = {}): Promise<void> {
    if (this._initialized) return;

    const {
      projectRoot = process.cwd(),
      enableValidation = false,
      enableLearning = false,
      enableContext = false,
      enableSession = false,
      enableSecurity = false,
      enablePermission = false,
      memoryDir = 'docs/memory',
      sessionDir = 'data/sessions',
      sandboxOptions,
      permissionOptions,
    } = config;

    const basePath = `${projectRoot}/${memoryDir}`;

    // Validation modules (synchronous initialization)
    if (enableValidation) {
      try {
        this.confidenceChecker = createConfidenceChecker();
      } catch {
        /* module init failed - continue */
      }

      try {
        this.selfCheckProtocol = createSelfCheckProtocol();
      } catch {
        /* module init failed - continue */
      }

      try {
        this.goalBackwardVerifier = createGoalBackwardVerifier();
      } catch {
        /* module init failed - continue */
      }
    }

    // Learning modules (async initialization)
    if (enableLearning) {
      // Ensure memory directory exists before module initialization
      try {
        await mkdir(basePath, { recursive: true });
      } catch {
        /* directory creation failed - modules will handle individually */
      }

      try {
        this.reflexionPattern = await createReflexionPattern({
          filePath: `${basePath}/solutions_learned.jsonl`,
        });
      } catch {
        /* module init failed - continue */
      }

      try {
        this.instinctStore = await createInstinctStore({
          storagePath: `${basePath}/instincts.jsonl`,
        });
      } catch {
        /* module init failed - continue */
      }

      try {
        this.solutionsCache = await createSolutionsCache({
          persistPath: `${basePath}/solutions_cache.jsonl`,
        });
      } catch {
        /* module init failed - continue */
      }
    }

    // Context module (synchronous initialization)
    if (enableContext) {
      try {
        this.contextManager = createContextManager();
      } catch {
        /* module init failed - continue */
      }
    }

    // Session module (async initialization)
    if (enableSession) {
      const sessionBasePath = `${projectRoot}/${sessionDir}`;
      try {
        const persistence = await createJSONLPersistence({ baseDir: sessionBasePath });
        const recovery = createSessionRecovery({ persistence });
        this.sessionManager = await createSessionManager({ persistence, recovery });
      } catch {
        /* module init failed - continue */
      }
    }

    // Security module (synchronous initialization)
    if (enableSecurity) {
      try {
        this.sandboxEscalation = createSandboxEscalation(sandboxOptions);
      } catch {
        /* module init failed - continue */
      }
    }

    // Permission module (synchronous initialization)
    if (enablePermission) {
      try {
        this.permissionManager = createPermissionManager(permissionOptions);
      } catch {
        /* module init failed - continue */
      }
    }

    // MCP module (async initialization — connects to configured servers)
    if (config.enableMCP) {
      try {
        this.mcpToolRegistry = createMCPToolRegistry();

        const servers = config.mcpServers ?? [];
        if (servers.length > 0) {
          this.mcpConnectionManager = createMCPConnectionManager({ servers });
          await this.mcpConnectionManager.connectAll();

          // Register discovered tools as skills via the tool registry
          for (const entry of servers) {
            const client = this.mcpConnectionManager.getClient(entry.name);
            const tools = this.mcpConnectionManager.getServerTools(entry.name);
            if (client && tools.length > 0 && this.mcpToolRegistry) {
              this.mcpToolRegistry.registerAsSkills(tools, client);
            }
          }

          // Backward compatibility: set mcpClient to the first connected server's client
          const firstConnected = servers.find(
            (s) => this.mcpConnectionManager?.getClient(s.name)?.isConnected(),
          );
          if (firstConnected) {
            this.mcpClient = this.mcpConnectionManager.getClient(firstConnected.name);
          }
        } else {
          // No servers configured — create a standalone client for backward compatibility
          this.mcpClient = createMCPClient();
        }
      } catch {
        /* module init failed - continue */
      }
    }

    // LSP module (async initialization — connects to configured servers)
    if (config.enableLSP) {
      try {
        this.diagnosticsCollector = createDiagnosticsCollector();

        const lspServers = config.lspServers ?? [];
        if (lspServers.length > 0) {
          this.lspConnectionManager = createLSPConnectionManager({ servers: lspServers });
          await this.lspConnectionManager.connectAll();

          // Backward compatibility: set lspClient to the first connected server's client
          const firstConnected = lspServers.find(
            (s) => this.lspConnectionManager?.getClient(s.name),
          );
          if (firstConnected) {
            this.lspClient = this.lspConnectionManager.getClient(firstConnected.name);
          }
        } else {
          // No servers configured — create a standalone client for backward compatibility
          this.lspClient = createLSPClient();
        }
      } catch {
        /* module init failed - continue */
      }
    }

    // Skills module (auto-enabled with MCP or LSP, or explicitly)
    if (config.enableSkills || config.enableMCP || config.enableLSP) {
      try {
        this.skillRegistry = createSkillRegistry();
      } catch {
        /* module init failed - continue */
      }
    }

    // Planning context module (async initialization)
    if (config.enablePlanningContext) {
      const planningBasePath = `${projectRoot}/${config.planningDir || 'data/planning'}`;
      try {
        await mkdir(planningBasePath, { recursive: true });
      } catch {
        /* directory creation failed - modules will handle individually */
      }
      try {
        this.stateTracker = createStateTracker(`${planningBasePath}/state.md`);
        this.phaseManager = createPhaseManager();
        this.contextBudget = createContextBudget();
      } catch {
        /* module init failed - continue */
      }
    }

    // Plugin module (synchronous initialization — discovery is deferred)
    if (config.enablePlugins) {
      try {
        this.pluginLoader = createPluginLoader();
        this.pluginRegistry = createPluginRegistry();
        this.pluginLifecycle = createPluginLifecycle();
      } catch {
        /* module init failed - continue */
      }
    }

    // GitHub module (synchronous initialization)
    if (config.enableGitHub && config.githubToken) {
      try {
        this.githubClient = createGitHubClient(config.githubToken);
      } catch {
        /* module init failed - continue */
      }
    }

    this._initialized = true;
  }

  /**
   * Dispose all modules and clean up resources.
   */
  async dispose(): Promise<void> {
    try {
      if (this.solutionsCache) {
        await this.solutionsCache.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.contextManager) {
        this.contextManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.sessionManager) {
        await this.sessionManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.mcpConnectionManager) {
        await this.mcpConnectionManager.disconnectAll();
      } else if (this.mcpClient?.isConnected()) {
        await this.mcpClient.disconnect();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.lspConnectionManager) {
        await this.lspConnectionManager.disconnectAll();
      }
    } catch {
      /* dispose error ignored */
    }

    this.confidenceChecker = null;
    this.selfCheckProtocol = null;
    this.goalBackwardVerifier = null;
    this.reflexionPattern = null;
    this.instinctStore = null;
    this.solutionsCache = null;
    this.contextManager = null;
    this.sessionManager = null;
    this.sandboxEscalation = null;
    this.permissionManager = null;
    this.mcpClient = null;
    this.mcpToolRegistry = null;
    this.mcpConnectionManager = null;
    this.lspClient = null;
    this.diagnosticsCollector = null;
    this.lspConnectionManager = null;
    this.skillRegistry = null;
    this.pluginLoader = null;
    this.pluginRegistry = null;
    this.pluginLifecycle = null;
    this.stateTracker = null;
    this.phaseManager = null;
    this.contextBudget = null;
    this.githubClient = null;
    this._initialized = false;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  // Typed getters (null safety)
  getConfidenceChecker(): ConfidenceChecker | null {
    return this.confidenceChecker;
  }

  getSelfCheckProtocol(): SelfCheckProtocol | null {
    return this.selfCheckProtocol;
  }

  getGoalBackwardVerifier(): GoalBackwardVerifier | null {
    return this.goalBackwardVerifier;
  }

  getReflexionPattern(): ReflexionPattern | null {
    return this.reflexionPattern;
  }

  getInstinctStore(): InstinctStore | null {
    return this.instinctStore;
  }

  getSolutionsCache(): SolutionsCache | null {
    return this.solutionsCache;
  }

  getContextManager(): ContextManager | null {
    return this.contextManager;
  }

  getSessionManager(): SessionManager | null {
    return this.sessionManager;
  }

  getSandboxEscalation(): SandboxEscalation | null {
    return this.sandboxEscalation;
  }

  getPermissionManager(): PermissionManager | null {
    return this.permissionManager;
  }

  getMCPClient(): MCPClient | null {
    return this.mcpClient;
  }

  getMCPToolRegistry(): MCPToolRegistry | null {
    return this.mcpToolRegistry;
  }

  getMCPConnectionManager(): MCPConnectionManager | null {
    return this.mcpConnectionManager;
  }

  getLSPClient(): LSPClient | null {
    return this.lspClient;
  }

  getDiagnosticsCollector(): DiagnosticsCollector | null {
    return this.diagnosticsCollector;
  }

  getLSPConnectionManager(): LSPConnectionManager | null {
    return this.lspConnectionManager;
  }

  getSkillRegistry(): SkillRegistry | null {
    return this.skillRegistry;
  }

  getPluginLoader(): PluginLoader | null {
    return this.pluginLoader;
  }

  getPluginRegistry(): PluginRegistry | null {
    return this.pluginRegistry;
  }

  getPluginLifecycle(): PluginLifecycle | null {
    return this.pluginLifecycle;
  }

  getStateTracker(): StateTracker | null {
    return this.stateTracker;
  }

  getPhaseManager(): PhaseManager | null {
    return this.phaseManager;
  }

  getContextBudget(): ContextBudget | null {
    return this.contextBudget;
  }

  getGitHubClient(): GitHubClient | null {
    return this.githubClient;
  }
}
