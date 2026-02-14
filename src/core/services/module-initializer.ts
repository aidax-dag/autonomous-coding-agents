/**
 * Module Initializer
 *
 * Extracted from service-registry.ts to isolate the large initialize()
 * method's module-by-module initialization blocks. Each `if (config.enableX)`
 * block becomes a dedicated method here.
 *
 * @module core/services/module-initializer
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
import { CollaborationHub, createCollaborationHub } from '../../ui/web/collaboration-hub';
import { IDEBridge, createIDEBridge } from '../../ui/ide/ide-bridge';
import { UsageTracker, createUsageTracker } from '../analytics/usage-tracker';
import { ASTGrepClient, createASTGrepClient } from '../tools/ast-grep/ast-grep-client';
import { ProjectManager } from '../workspace/project-manager';
import { TenantManager } from '../saas/tenant-manager';
import { BillingManager } from '../saas/billing-manager';
import { LoopDetector, createLoopDetector } from '../orchestrator/loop-detector';
import {
  A2AGateway,
  createA2AGateway,
  type A2AGatewayConfig,
} from '../protocols/a2a/a2a-gateway';
import { A2ARouter, createA2ARouter } from '../protocols/a2a/a2a-router';
import { OAuthManager, createOAuthManager } from '../mcp/oauth/oauth-manager';
import type { OAuthManagerConfig } from '../mcp/oauth/oauth-manager';
import {
  MarketplaceRegistry,
  createMarketplaceRegistry,
} from '../plugins/marketplace/marketplace-registry';
import {
  SevenPhaseWorkflow,
  createSevenPhaseWorkflow,
} from '../orchestrator/workflow/seven-phase-workflow';
import type { SevenPhaseConfig } from '../orchestrator/workflow/seven-phase-workflow';
import { CostReporter, createCostReporter } from '../analytics/cost-reporter';
import type { IDBClient, DBConfig } from '../persistence/db-client';
import { createInMemoryDBClient } from '../persistence/db-client';
import { createDBClient } from '../persistence/db-factory';
import { OTelProvider } from '../../shared/telemetry/otel-provider';
import {
  ObservabilityStack,
  createObservabilityStack,
  type ObservabilityConfig,
} from '../../shared/telemetry/observability-stack';
import { mkdir } from 'fs/promises';
import type { ServiceRegistryConfig } from './service-registry';

/**
 * Result of module initialization - all the initialized module instances.
 */
export interface ModuleInitResult {
  confidenceChecker: ConfidenceChecker | null;
  selfCheckProtocol: SelfCheckProtocol | null;
  goalBackwardVerifier: GoalBackwardVerifier | null;
  reflexionPattern: ReflexionPattern | null;
  instinctStore: InstinctStore | null;
  solutionsCache: SolutionsCache | null;
  contextManager: ContextManager | null;
  sessionManager: SessionManager | null;
  sandboxEscalation: SandboxEscalation | null;
  permissionManager: PermissionManager | null;
  mcpClient: MCPClient | null;
  mcpToolRegistry: MCPToolRegistry | null;
  mcpConnectionManager: MCPConnectionManager | null;
  lspClient: LSPClient | null;
  diagnosticsCollector: DiagnosticsCollector | null;
  lspConnectionManager: LSPConnectionManager | null;
  skillRegistry: SkillRegistry | null;
  pluginLoader: PluginLoader | null;
  pluginRegistry: PluginRegistry | null;
  pluginLifecycle: PluginLifecycle | null;
  stateTracker: StateTracker | null;
  phaseManager: PhaseManager | null;
  contextBudget: ContextBudget | null;
  githubClient: GitHubClient | null;
  collaborationHub: CollaborationHub | null;
  usageTracker: UsageTracker | null;
  projectManager: ProjectManager | null;
  tenantManager: TenantManager | null;
  billingManager: BillingManager | null;
  ideBridge: IDEBridge | null;
  astGrepClient: ASTGrepClient | null;
  loopDetector: LoopDetector | null;
  dbClient: IDBClient | null;
  observabilityStack: ObservabilityStack | null;
  a2aGateway: A2AGateway | null;
  a2aRouter: A2ARouter | null;
  oauthManager: OAuthManager | null;
  marketplaceRegistry: MarketplaceRegistry | null;
  sevenPhaseWorkflow: SevenPhaseWorkflow | null;
  costReporter: CostReporter | null;
}

/**
 * Create a blank ModuleInitResult with all fields set to null.
 */
export function createEmptyModuleResult(): ModuleInitResult {
  return {
    confidenceChecker: null,
    selfCheckProtocol: null,
    goalBackwardVerifier: null,
    reflexionPattern: null,
    instinctStore: null,
    solutionsCache: null,
    contextManager: null,
    sessionManager: null,
    sandboxEscalation: null,
    permissionManager: null,
    mcpClient: null,
    mcpToolRegistry: null,
    mcpConnectionManager: null,
    lspClient: null,
    diagnosticsCollector: null,
    lspConnectionManager: null,
    skillRegistry: null,
    pluginLoader: null,
    pluginRegistry: null,
    pluginLifecycle: null,
    stateTracker: null,
    phaseManager: null,
    contextBudget: null,
    githubClient: null,
    collaborationHub: null,
    usageTracker: null,
    projectManager: null,
    tenantManager: null,
    billingManager: null,
    ideBridge: null,
    astGrepClient: null,
    loopDetector: null,
    dbClient: null,
    observabilityStack: null,
    a2aGateway: null,
    a2aRouter: null,
    oauthManager: null,
    marketplaceRegistry: null,
    sevenPhaseWorkflow: null,
    costReporter: null,
  };
}

/**
 * ModuleInitializer
 *
 * Initializes integration modules based on configuration flags.
 * Each module initializes in its own try/catch for graceful degradation.
 */
export class ModuleInitializer {
  /**
   * Initialize all enabled modules and return the result.
   */
  async initializeAll(config: ServiceRegistryConfig): Promise<ModuleInitResult> {
    const result = createEmptyModuleResult();

    const {
      projectRoot = process.cwd(),
      memoryDir = 'docs/memory',
      sessionDir = 'data/sessions',
      sandboxOptions,
      permissionOptions,
    } = config;

    const basePath = `${projectRoot}/${memoryDir}`;

    if (config.enableValidation) {
      this.initializeValidation(result);
    }

    if (config.enableLearning) {
      await this.initializeLearning(result, basePath);
    }

    if (config.enableContext) {
      this.initializeContext(result);
    }

    if (config.enableSession) {
      await this.initializeSession(result, projectRoot, sessionDir);
    }

    if (config.enableSecurity) {
      this.initializeSecurity(result, sandboxOptions);
    }

    if (config.enablePermission) {
      this.initializePermission(result, permissionOptions);
    }

    if (config.enableMCP) {
      await this.initializeMCP(result, config.mcpServers);
    }

    if (config.enableLSP) {
      await this.initializeLSP(result, config.lspServers);
    }

    if (config.enableSkills || config.enableMCP || config.enableLSP) {
      this.initializeSkills(result);
    }

    if (config.enablePlanningContext) {
      await this.initializePlanningContext(result, projectRoot, config.planningDir);
    }

    if (config.enablePlugins) {
      this.initializePlugins(result);
    }

    if (config.enableGitHub && config.githubToken) {
      this.initializeGitHub(result, config.githubToken);
    }

    if (config.enableCollaboration) {
      this.initializeCollaboration(result);
    }

    if (config.enableIDE) {
      this.initializeIDE(result);
    }

    if (config.enableAnalytics) {
      this.initializeAnalytics(result);
    }

    if (config.enableMultiProject) {
      this.initializeMultiProject(result, config.maxProjects);
    }

    if (config.enableASTGrep) {
      this.initializeASTGrep(result, projectRoot);
    }

    if (config.enableSaaS) {
      this.initializeSaaS(result);
    }

    if (config.enableLoopDetection) {
      this.initializeLoopDetection(result);
    }

    if (config.enablePersistence) {
      await this.initializePersistence(result, config.dbConfig);
    }

    if (config.enableA2A && config.a2aConfig) {
      this.initializeA2A(result, config.a2aConfig);
    }

    if (config.enableMCPOAuth) {
      this.initializeMCPOAuth(result, config.oauthConfig);
    }

    if (config.enableMarketplace) {
      this.initializeMarketplace(result);
    }

    if (config.enableSevenPhase && config.sevenPhaseConfig) {
      this.initializeSevenPhase(result, config.sevenPhaseConfig);
    }

    if (config.enableUsageTracking) {
      this.initializeUsageTracking(result);
    }

    if (config.enableObservability) {
      await this.initializeObservability(result, config.observabilityConfig);
    }

    return result;
  }

  // ---- Individual module initializers ----

  initializeValidation(result: ModuleInitResult): void {
    try {
      result.confidenceChecker = createConfidenceChecker();
    } catch {
      /* module init failed - continue */
    }

    try {
      result.selfCheckProtocol = createSelfCheckProtocol();
    } catch {
      /* module init failed - continue */
    }

    try {
      result.goalBackwardVerifier = createGoalBackwardVerifier();
    } catch {
      /* module init failed - continue */
    }
  }

  async initializeLearning(result: ModuleInitResult, basePath: string): Promise<void> {
    try {
      await mkdir(basePath, { recursive: true });
    } catch {
      /* directory creation failed - modules will handle individually */
    }

    try {
      result.reflexionPattern = await createReflexionPattern({
        filePath: `${basePath}/solutions_learned.jsonl`,
      });
    } catch {
      /* module init failed - continue */
    }

    try {
      result.instinctStore = await createInstinctStore({
        storagePath: `${basePath}/instincts.jsonl`,
      });
    } catch {
      /* module init failed - continue */
    }

    try {
      result.solutionsCache = await createSolutionsCache({
        persistPath: `${basePath}/solutions_cache.jsonl`,
      });
    } catch {
      /* module init failed - continue */
    }
  }

  initializeContext(result: ModuleInitResult): void {
    try {
      result.contextManager = createContextManager();
    } catch {
      /* module init failed - continue */
    }
  }

  async initializeSession(
    result: ModuleInitResult,
    projectRoot: string,
    sessionDir: string,
  ): Promise<void> {
    const sessionBasePath = `${projectRoot}/${sessionDir}`;
    try {
      const persistence = await createJSONLPersistence({ baseDir: sessionBasePath });
      const recovery = createSessionRecovery({ persistence });
      result.sessionManager = await createSessionManager({ persistence, recovery });
    } catch {
      /* module init failed - continue */
    }
  }

  initializeSecurity(
    result: ModuleInitResult,
    sandboxOptions?: SandboxEscalationOptions,
  ): void {
    try {
      result.sandboxEscalation = createSandboxEscalation(sandboxOptions);
    } catch {
      /* module init failed - continue */
    }
  }

  initializePermission(
    result: ModuleInitResult,
    permissionOptions?: PermissionManagerOptions,
  ): void {
    try {
      result.permissionManager = createPermissionManager(permissionOptions);
    } catch {
      /* module init failed - continue */
    }
  }

  async initializeMCP(
    result: ModuleInitResult,
    mcpServers?: MCPServerEntry[],
  ): Promise<void> {
    try {
      result.mcpToolRegistry = createMCPToolRegistry();

      const servers = mcpServers ?? [];
      if (servers.length > 0) {
        result.mcpConnectionManager = createMCPConnectionManager({ servers });
        await result.mcpConnectionManager.connectAll();

        // Register discovered tools as skills via the tool registry
        for (const entry of servers) {
          const client = result.mcpConnectionManager.getClient(entry.name);
          const tools = result.mcpConnectionManager.getServerTools(entry.name);
          if (client && tools.length > 0 && result.mcpToolRegistry) {
            result.mcpToolRegistry.registerAsSkills(tools, client);
          }
        }

        // Backward compatibility: set mcpClient to the first connected server's client
        const firstConnected = servers.find(
          (s) => result.mcpConnectionManager?.getClient(s.name)?.isConnected(),
        );
        if (firstConnected) {
          result.mcpClient = result.mcpConnectionManager.getClient(firstConnected.name);
        }
      } else {
        // No servers configured -- create a standalone client for backward compatibility
        result.mcpClient = createMCPClient();
      }
    } catch {
      /* module init failed - continue */
    }
  }

  async initializeLSP(
    result: ModuleInitResult,
    lspServers?: LSPServerEntryType[],
  ): Promise<void> {
    try {
      result.diagnosticsCollector = createDiagnosticsCollector();

      const servers = lspServers ?? [];
      if (servers.length > 0) {
        result.lspConnectionManager = createLSPConnectionManager({ servers });
        await result.lspConnectionManager.connectAll();

        // Backward compatibility: set lspClient to the first connected server's client
        const firstConnected = servers.find(
          (s) => result.lspConnectionManager?.getClient(s.name),
        );
        if (firstConnected) {
          result.lspClient = result.lspConnectionManager.getClient(firstConnected.name);
        }
      } else {
        // No servers configured -- create a standalone client for backward compatibility
        result.lspClient = createLSPClient();
      }
    } catch {
      /* module init failed - continue */
    }
  }

  initializeSkills(result: ModuleInitResult): void {
    try {
      result.skillRegistry = createSkillRegistry();
    } catch {
      /* module init failed - continue */
    }
  }

  async initializePlanningContext(
    result: ModuleInitResult,
    projectRoot: string,
    planningDir?: string,
  ): Promise<void> {
    const planningBasePath = `${projectRoot}/${planningDir || 'data/planning'}`;
    try {
      await mkdir(planningBasePath, { recursive: true });
    } catch {
      /* directory creation failed - modules will handle individually */
    }
    try {
      result.stateTracker = createStateTracker(`${planningBasePath}/state.md`);
      result.phaseManager = createPhaseManager();
      result.contextBudget = createContextBudget();
    } catch {
      /* module init failed - continue */
    }
  }

  initializePlugins(result: ModuleInitResult): void {
    try {
      result.pluginLoader = createPluginLoader();
      result.pluginRegistry = createPluginRegistry();
      result.pluginLifecycle = createPluginLifecycle();
    } catch {
      /* module init failed - continue */
    }
  }

  initializeGitHub(result: ModuleInitResult, githubToken: string): void {
    try {
      result.githubClient = createGitHubClient(githubToken);
    } catch {
      /* module init failed - continue */
    }
  }

  initializeCollaboration(result: ModuleInitResult): void {
    try {
      result.collaborationHub = createCollaborationHub();
    } catch {
      /* module init failed - continue */
    }
  }

  initializeIDE(result: ModuleInitResult): void {
    try {
      result.ideBridge = createIDEBridge();
    } catch {
      /* module init failed - continue */
    }
  }

  initializeAnalytics(result: ModuleInitResult): void {
    try {
      result.usageTracker = createUsageTracker();
    } catch {
      /* module init failed - continue */
    }
  }

  initializeMultiProject(result: ModuleInitResult, maxProjects?: number): void {
    try {
      result.projectManager = new ProjectManager({
        maxProjects,
      });
    } catch {
      /* module init failed - continue */
    }
  }

  initializeASTGrep(result: ModuleInitResult, projectRoot: string): void {
    try {
      result.astGrepClient = createASTGrepClient({
        cwd: projectRoot,
      });
    } catch {
      /* module init failed - continue */
    }
  }

  initializeSaaS(result: ModuleInitResult): void {
    try {
      result.tenantManager = new TenantManager();
    } catch {
      /* module init failed - continue */
    }

    try {
      result.billingManager = new BillingManager();
    } catch {
      /* module init failed - continue */
    }
  }

  initializeLoopDetection(result: ModuleInitResult): void {
    try {
      result.loopDetector = createLoopDetector();
    } catch {
      /* module init failed - continue */
    }
  }

  async initializePersistence(
    result: ModuleInitResult,
    dbConfig?: DBConfig,
  ): Promise<void> {
    try {
      const client = dbConfig
        ? createDBClient(dbConfig)
        : createInMemoryDBClient();
      await client.connect();
      result.dbClient = client;
    } catch {
      /* module init failed - continue */
    }
  }

  async initializeObservability(
    result: ModuleInitResult,
    config?: ObservabilityConfig,
  ): Promise<void> {
    try {
      const provider = new OTelProvider({
        serviceName: config?.serviceName ?? 'aca',
      });
      provider.initialize();
      const stack = createObservabilityStack(provider, config);
      await stack.start();
      result.observabilityStack = stack;
    } catch {
      /* module init failed - continue */
    }
  }

  initializeA2A(result: ModuleInitResult, a2aConfig: A2AGatewayConfig): void {
    try {
      result.a2aGateway = createA2AGateway(a2aConfig);
    } catch {
      /* module init failed - continue */
    }

    try {
      result.a2aRouter = createA2ARouter();
    } catch {
      /* module init failed - continue */
    }
  }

  initializeMCPOAuth(result: ModuleInitResult, oauthConfig?: OAuthManagerConfig): void {
    try {
      result.oauthManager = createOAuthManager(oauthConfig);
    } catch {
      /* module init failed - continue */
    }
  }

  initializeMarketplace(result: ModuleInitResult): void {
    try {
      result.marketplaceRegistry = createMarketplaceRegistry();
    } catch {
      /* module init failed - continue */
    }
  }

  initializeSevenPhase(result: ModuleInitResult, sevenPhaseConfig: SevenPhaseConfig): void {
    try {
      result.sevenPhaseWorkflow = createSevenPhaseWorkflow(sevenPhaseConfig);
    } catch {
      /* module init failed - continue */
    }
  }

  initializeUsageTracking(result: ModuleInitResult): void {
    try {
      if (!result.usageTracker) {
        result.usageTracker = createUsageTracker();
      }
    } catch {
      /* module init failed - continue */
    }

    try {
      if (result.usageTracker) {
        result.costReporter = createCostReporter(result.usageTracker);
      }
    } catch {
      /* module init failed - continue */
    }
  }
}
