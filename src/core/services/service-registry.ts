/**
 * Service Registry
 *
 * Lightweight service locator for initializing and managing integration modules
 * (validation, learning, context). Provides typed getters with null safety
 * and graceful degradation on initialization failures.
 *
 * Module initialization logic delegated to module-initializer.ts.
 *
 * @module core/services/service-registry
 */

import type {
  ConfidenceChecker,
} from '../validation/confidence-checker';
import type {
  SelfCheckProtocol,
} from '../validation/self-check-protocol';
import type {
  GoalBackwardVerifier,
} from '../validation/goal-backward-verifier';
import type { ReflexionPattern } from '../learning/reflexion-pattern';
import type { InstinctStore } from '../learning/instinct-store';
import type { SolutionsCache } from '../learning/solutions-cache';
import type { ContextManager } from '../context/context-manager';
import type {
  SessionManager,
} from '../session/index';
import type { SandboxEscalation } from '../security/sandbox-escalation';
import type { PermissionManager } from '../permission/permission-manager';
import type { PermissionManagerOptions } from '../permission/permission-manager';
import type { MCPClient } from '../mcp/mcp-client';
import type { MCPToolRegistry } from '../mcp/mcp-tool-registry';
import type {
  MCPConnectionManager,
  MCPServerEntry,
} from '../mcp/mcp-connection-manager';
import type { LSPClient } from '../lsp/lsp-client';
import type { DiagnosticsCollector } from '../lsp/diagnostics-collector';
import type {
  LSPConnectionManager,
  LSPServerEntry as LSPServerEntryType,
} from '../lsp/lsp-connection-manager';
import type { SkillRegistry } from '../skills/skill-registry';
import type { PluginLoader } from '../plugins/plugin-loader';
import type { PluginRegistry } from '../plugins/plugin-registry';
import type { PluginLifecycle } from '../plugins/plugin-lifecycle';
import type { StateTracker } from '../context/planning-context/state-tracker';
import type { PhaseManager } from '../context/planning-context/phase-manager';
import type { ContextBudget } from '../context/planning-context/context-budget';
import type { GitHubClient } from '../../shared/github/github-client';
import type { CollaborationHub } from '../../ui/web/collaboration-hub';
import type { IDEBridge } from '../../ui/ide/ide-bridge';
import type { UsageTracker } from '../analytics/usage-tracker';
import type { ASTGrepClient } from '../tools/ast-grep/ast-grep-client';
import type { ProjectManager } from '../workspace/project-manager';
import type { TenantManager } from '../saas/tenant-manager';
import type { BillingManager } from '../saas/billing-manager';
import type { LoopDetector } from '../orchestrator/loop-detector';
import type {
  A2AGateway,
  A2AGatewayConfig,
} from '../protocols/a2a/a2a-gateway';
import type { A2ARouter } from '../protocols/a2a/a2a-router';
import type { OAuthManager } from '../mcp/oauth/oauth-manager';
import type { OAuthManagerConfig } from '../mcp/oauth/oauth-manager';
import type {
  MarketplaceRegistry,
} from '../plugins/marketplace/marketplace-registry';
import type {
  SevenPhaseWorkflow,
} from '../orchestrator/workflow/seven-phase-workflow';
import type { SevenPhaseConfig } from '../orchestrator/workflow/seven-phase-workflow';
import type { CostReporter } from '../analytics/cost-reporter';
import type { IDBClient, DBConfig } from '../persistence/db-client';
import type { SandboxEscalationOptions } from '../security/interfaces/escalation.interface';
import { ModuleInitializer, type ModuleInitResult, createEmptyModuleResult } from './module-initializer';

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
  /** Enable collaboration hub (default: false) */
  enableCollaboration?: boolean;
  /** Enable usage analytics module (default: false) */
  enableAnalytics?: boolean;
  /** Enable multi-project management (default: false) */
  enableMultiProject?: boolean;
  /** Maximum projects for multi-project management (default: 20) */
  maxProjects?: number;
  /** Enable SaaS features - tenant and billing management (default: false) */
  enableSaaS?: boolean;
  /** Enable IDE bridge for VS Code / JetBrains integration (default: false) */
  enableIDE?: boolean;
  /** Enable AST-Grep integration for pattern-based code search (default: false) */
  enableASTGrep?: boolean;
  /** Enable loop detection for task execution (default: false) */
  enableLoopDetection?: boolean;
  /** Enable database persistence layer (default: false) */
  enablePersistence?: boolean;
  /** Database configuration (defaults to InMemoryDBClient when omitted) */
  dbConfig?: DBConfig;
  /** Enable A2A protocol modules - A2AGateway and A2ARouter (default: false) */
  enableA2A?: boolean;
  /** A2A Gateway configuration (required when enableA2A is true) */
  a2aConfig?: A2AGatewayConfig;
  /** Enable MCP OAuth module - OAuthManager (default: false) */
  enableMCPOAuth?: boolean;
  /** OAuth manager configuration */
  oauthConfig?: OAuthManagerConfig;
  /** Enable plugin marketplace module - MarketplaceRegistry (default: false) */
  enableMarketplace?: boolean;
  /** Enable seven-phase workflow module (default: false) */
  enableSevenPhase?: boolean;
  /** Seven-phase workflow configuration (required when enableSevenPhase is true) */
  sevenPhaseConfig?: SevenPhaseConfig;
  /** Enable usage tracking module - UsageTracker + CostReporter (default: false) */
  enableUsageTracking?: boolean;
}

/**
 * ServiceRegistry
 *
 * Singleton registry managing integration module lifecycle.
 * Each module initializes independently - one failure doesn't block others.
 * Module initialization is delegated to ModuleInitializer.
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;

  private modules: ModuleInitResult = createEmptyModuleResult();
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

    const initializer = new ModuleInitializer();
    this.modules = await initializer.initializeAll(config);

    this._initialized = true;
  }

  /**
   * Dispose all modules and clean up resources.
   */
  async dispose(): Promise<void> {
    try {
      if (this.modules.solutionsCache) {
        await this.modules.solutionsCache.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.contextManager) {
        this.modules.contextManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.sessionManager) {
        await this.modules.sessionManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.mcpConnectionManager) {
        await this.modules.mcpConnectionManager.disconnectAll();
      } else if (this.modules.mcpClient?.isConnected()) {
        await this.modules.mcpClient.disconnect();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.lspConnectionManager) {
        await this.modules.lspConnectionManager.disconnectAll();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.collaborationHub) {
        this.modules.collaborationHub.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.ideBridge) {
        this.modules.ideBridge.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.dbClient?.isConnected()) {
        await this.modules.dbClient.disconnect();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.a2aGateway) {
        this.modules.a2aGateway.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.oauthManager) {
        this.modules.oauthManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.marketplaceRegistry) {
        this.modules.marketplaceRegistry.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    // Null out references that don't need async disposal
    this.modules.confidenceChecker = null;
    this.modules.selfCheckProtocol = null;
    this.modules.goalBackwardVerifier = null;
    this.modules.reflexionPattern = null;
    this.modules.instinctStore = null;
    this.modules.solutionsCache = null;
    this.modules.contextManager = null;
    this.modules.sessionManager = null;
    this.modules.sandboxEscalation = null;
    this.modules.permissionManager = null;
    this.modules.mcpClient = null;
    this.modules.mcpToolRegistry = null;
    this.modules.mcpConnectionManager = null;
    this.modules.lspClient = null;
    this.modules.diagnosticsCollector = null;
    this.modules.lspConnectionManager = null;
    this.modules.skillRegistry = null;
    this.modules.pluginLoader = null;
    this.modules.pluginRegistry = null;
    this.modules.pluginLifecycle = null;
    this.modules.stateTracker = null;
    this.modules.phaseManager = null;
    this.modules.contextBudget = null;
    this.modules.githubClient = null;
    this.modules.usageTracker = null;
    this.modules.collaborationHub = null;
    this.modules.ideBridge = null;
    this.modules.loopDetector = null;

    try {
      if (this.modules.projectManager) {
        this.modules.projectManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.tenantManager) {
        this.modules.tenantManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.modules.billingManager) {
        this.modules.billingManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    this.modules.projectManager = null;
    this.modules.tenantManager = null;
    this.modules.billingManager = null;
    this.modules.astGrepClient = null;
    this.modules.dbClient = null;
    this.modules.a2aGateway = null;
    this.modules.a2aRouter = null;
    this.modules.oauthManager = null;
    this.modules.marketplaceRegistry = null;
    this.modules.sevenPhaseWorkflow = null;
    this.modules.costReporter = null;
    this._initialized = false;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  // Typed getters (null safety)
  getConfidenceChecker(): ConfidenceChecker | null {
    return this.modules.confidenceChecker;
  }

  getSelfCheckProtocol(): SelfCheckProtocol | null {
    return this.modules.selfCheckProtocol;
  }

  getGoalBackwardVerifier(): GoalBackwardVerifier | null {
    return this.modules.goalBackwardVerifier;
  }

  getReflexionPattern(): ReflexionPattern | null {
    return this.modules.reflexionPattern;
  }

  getInstinctStore(): InstinctStore | null {
    return this.modules.instinctStore;
  }

  getSolutionsCache(): SolutionsCache | null {
    return this.modules.solutionsCache;
  }

  getContextManager(): ContextManager | null {
    return this.modules.contextManager;
  }

  getSessionManager(): SessionManager | null {
    return this.modules.sessionManager;
  }

  getSandboxEscalation(): SandboxEscalation | null {
    return this.modules.sandboxEscalation;
  }

  getPermissionManager(): PermissionManager | null {
    return this.modules.permissionManager;
  }

  getMCPClient(): MCPClient | null {
    return this.modules.mcpClient;
  }

  getMCPToolRegistry(): MCPToolRegistry | null {
    return this.modules.mcpToolRegistry;
  }

  getMCPConnectionManager(): MCPConnectionManager | null {
    return this.modules.mcpConnectionManager;
  }

  getLSPClient(): LSPClient | null {
    return this.modules.lspClient;
  }

  getDiagnosticsCollector(): DiagnosticsCollector | null {
    return this.modules.diagnosticsCollector;
  }

  getLSPConnectionManager(): LSPConnectionManager | null {
    return this.modules.lspConnectionManager;
  }

  getSkillRegistry(): SkillRegistry | null {
    return this.modules.skillRegistry;
  }

  getPluginLoader(): PluginLoader | null {
    return this.modules.pluginLoader;
  }

  getPluginRegistry(): PluginRegistry | null {
    return this.modules.pluginRegistry;
  }

  getPluginLifecycle(): PluginLifecycle | null {
    return this.modules.pluginLifecycle;
  }

  getStateTracker(): StateTracker | null {
    return this.modules.stateTracker;
  }

  getPhaseManager(): PhaseManager | null {
    return this.modules.phaseManager;
  }

  getContextBudget(): ContextBudget | null {
    return this.modules.contextBudget;
  }

  getGitHubClient(): GitHubClient | null {
    return this.modules.githubClient;
  }

  getUsageTracker(): UsageTracker | null {
    return this.modules.usageTracker;
  }

  getCollaborationHub(): CollaborationHub | null {
    return this.modules.collaborationHub;
  }

  getProjectManager(): ProjectManager | null {
    return this.modules.projectManager;
  }

  getTenantManager(): TenantManager | null {
    return this.modules.tenantManager;
  }

  getBillingManager(): BillingManager | null {
    return this.modules.billingManager;
  }

  getIDEBridge(): IDEBridge | null {
    return this.modules.ideBridge;
  }

  getASTGrepClient(): ASTGrepClient | null {
    return this.modules.astGrepClient;
  }

  getLoopDetector(): LoopDetector | null {
    return this.modules.loopDetector;
  }

  getDBClient(): IDBClient | null {
    return this.modules.dbClient;
  }

  getA2AGateway(): A2AGateway | null {
    return this.modules.a2aGateway;
  }

  getA2ARouter(): A2ARouter | null {
    return this.modules.a2aRouter;
  }

  getOAuthManager(): OAuthManager | null {
    return this.modules.oauthManager;
  }

  getMarketplaceRegistry(): MarketplaceRegistry | null {
    return this.modules.marketplaceRegistry;
  }

  getSevenPhaseWorkflow(): SevenPhaseWorkflow | null {
    return this.modules.sevenPhaseWorkflow;
  }

  getCostReporter(): CostReporter | null {
    return this.modules.costReporter;
  }
}
