/**
 * Main Export Tests
 *
 * Verifies that src/index.ts (the npm package entry point) exports all
 * expected public symbols and does not leak internal implementation details.
 */

import * as MainExport from '../../src/index';

describe('Main package export (src/index.ts)', () => {
  // ------------------------------------------------------------------
  // Core: Orchestrator & Runner
  // ------------------------------------------------------------------
  it('should export CEOOrchestrator class and factory', () => {
    expect(MainExport.CEOOrchestrator).toBeDefined();
    expect(typeof MainExport.createCEOOrchestrator).toBe('function');
    expect(MainExport.CEOStatus).toBeDefined();
  });

  it('should export OrchestratorRunner class and factory', () => {
    expect(MainExport.OrchestratorRunner).toBeDefined();
    expect(typeof MainExport.createOrchestratorRunner).toBe('function');
    expect(MainExport.RunnerStatus).toBeDefined();
  });

  it('should export runner configuration utilities', () => {
    expect(typeof MainExport.createRunnerFromEnv).toBe('function');
    expect(typeof MainExport.createRunnerFromConfig).toBe('function');
    expect(typeof MainExport.buildRunnerConfig).toBe('function');
    expect(typeof MainExport.loadRunnerConfig).toBe('function');
    expect(MainExport.RunnerConfigSchema).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Core: Team Agents & Registry
  // ------------------------------------------------------------------
  it('should export TeamRegistry and factory', () => {
    expect(MainExport.TeamRegistry).toBeDefined();
    expect(typeof MainExport.createDefaultRegistry).toBe('function');
  });

  it('should export BaseTeamAgent and TaskRouter', () => {
    expect(MainExport.BaseTeamAgent).toBeDefined();
    expect(MainExport.TaskRouter).toBeDefined();
    expect(MainExport.TeamAgentStatus).toBeDefined();
    expect(MainExport.TeamRoutingStrategy).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Core: Services
  // ------------------------------------------------------------------
  it('should export ServiceRegistry', () => {
    expect(MainExport.ServiceRegistry).toBeDefined();
  });

  it('should export logging utilities', () => {
    expect(MainExport.ConsoleLogger).toBeDefined();
    expect(typeof MainExport.createLogger).toBe('function');
  });

  // ------------------------------------------------------------------
  // Core: Hooks
  // ------------------------------------------------------------------
  it('should export hook infrastructure', () => {
    expect(MainExport.HookRegistry).toBeDefined();
    expect(MainExport.HookExecutor).toBeDefined();
    expect(MainExport.BaseHook).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Core: Skills
  // ------------------------------------------------------------------
  it('should export skill infrastructure', () => {
    expect(MainExport.SkillRegistry).toBeDefined();
    expect(typeof MainExport.createSkillRegistry).toBe('function');
    expect(MainExport.SkillPipeline).toBeDefined();
    expect(typeof MainExport.createSkillPipeline).toBe('function');
  });

  // ------------------------------------------------------------------
  // Shared: LLM
  // ------------------------------------------------------------------
  it('should export LLM base client and factory functions', () => {
    expect(MainExport.BaseLLMClient).toBeDefined();
    expect(typeof MainExport.createLLMClient).toBe('function');
    expect(typeof MainExport.createCLILLMClient).toBe('function');
    expect(typeof MainExport.createLLMClientFromConfig).toBe('function');
  });

  it('should export ModelRouter and CostTracker', () => {
    expect(MainExport.ModelRouter).toBeDefined();
    expect(typeof MainExport.createModelRouter).toBe('function');
    expect(MainExport.CostTracker).toBeDefined();
    expect(typeof MainExport.createCostTracker).toBe('function');
    expect(MainExport.ModelProfileRegistry).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Shared: Configuration
  // ------------------------------------------------------------------
  it('should export configuration utilities', () => {
    expect(typeof MainExport.loadConfig).toBe('function');
    expect(typeof MainExport.validateConfig).toBe('function');
    expect(typeof MainExport.getConfig).toBe('function');
    expect(typeof MainExport.resetConfig).toBe('function');
    expect(typeof MainExport.isCLIProvider).toBe('function');
  });

  // ------------------------------------------------------------------
  // Shared: Errors
  // ------------------------------------------------------------------
  it('should export error classes', () => {
    expect(MainExport.AgentError).toBeDefined();
    expect(MainExport.ConfigError).toBeDefined();
    expect(MainExport.LLMError).toBeDefined();
    expect(MainExport.LLMRateLimitError).toBeDefined();
    expect(MainExport.GitHubError).toBeDefined();
    expect(MainExport.GitError).toBeDefined();
    expect(MainExport.ValidationError).toBeDefined();
    expect(MainExport.ErrorCode).toBeDefined();
  });

  it('should export error utility functions', () => {
    expect(typeof MainExport.isAgentError).toBe('function');
    expect(typeof MainExport.isRetryableError).toBe('function');
    expect(typeof MainExport.getErrorCode).toBe('function');
    expect(typeof MainExport.wrapError).toBe('function');
    expect(typeof MainExport.retryWithBackoff).toBe('function');
  });

  // ------------------------------------------------------------------
  // Negative: internal/platform modules must NOT be exported
  // ------------------------------------------------------------------
  it('should not export internal or platform-specific modules', () => {
    const exportedKeys = Object.keys(MainExport);

    // CLI internals
    expect(exportedKeys).not.toContain('startCLI');
    expect(exportedKeys).not.toContain('CLICommand');

    // Platform-specific
    expect(exportedKeys).not.toContain('VSCodeExtension');
    expect(exportedKeys).not.toContain('JetBrainsPlugin');
    expect(exportedKeys).not.toContain('DesktopApp');

    // UI internals
    expect(exportedKeys).not.toContain('TUIRenderer');
    expect(exportedKeys).not.toContain('WebDashboard');

    // Mock/test utilities should not leak
    expect(exportedKeys).not.toContain('createMockRunner');
    expect(exportedKeys).not.toContain('createMockWorkflow');
  });
});
