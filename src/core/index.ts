/**
 * Core Module - Public API
 * @module core
 *
 * Note: The following submodules are excluded from this barrel due to
 * naming conflicts with other submodules. Import them directly:
 *
 *   - './deep-worker'      (StepExecutor conflicts with orchestrator/workflow)
 *   - './dynamic-prompts'  (PromptContext conflicts with orchestrator/llm)
 *   - './rag'              (SearchOptions, SearchResult conflict with plugins/marketplace)
 *   - './session'          (CompactionResult conflicts with context)
 *   - './skills'           (SecurityFinding conflicts with orchestrator/agents)
 */

export * from './adaptive-prompts';
export * from './analytics';
export * from './benchmark';
export * from './brownfield';
export * from './checkpoint';
export * from './collaboration';
export * from './context';
export * from './debugging';
export * from './docs-generator';
export * from './evals';
export * from './git-workflow';
export * from './hooks';
export * from './hud';
export * from './i18n';
export * from './instinct-transfer';
export * from './learning';
export * from './lsp';
export * from './mcp';
export * from './multimodal';
export * from './notifications';
export * from './orchestrator';
export * from './pair-programming';
export * from './permission';
export * from './persistence';
export * from './plugins';
export * from './protocols';
export * from './saas';
export * from './security';
export * from './services';
export * from './shortcuts';
export * from './test-gen';
export * from './ticketing';
export * from './validation';
export * from './workspace';
