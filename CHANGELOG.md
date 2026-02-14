# Changelog

All notable changes to the Autonomous Coding Agents (ACA) project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-02-14

Advanced Autonomy & AI-Native — Autonomous Debugging, Multi-Agent Collaboration, RAG Code Search, Adaptive Prompts, Multimodal, NL Test Generation, Git Workflow Intelligence, Real-time Pair Programming.

### Added

#### Autonomous Debugging Loop (H-1)
- `HypothesisGenerator` with 10 error pattern recognizers (null reference, type mismatch, async/await, import, bounds, syntax, timeout, permission, memory, network).
- `DebuggingLoop` implementing diagnose→hypotheses→test→learn cycle with automatic fix verification.
- Confidence-scored hypothesis ranking and iterative refinement.

#### Multi-Agent Collaboration (H-2)
- `FeedbackLoop` for structured inter-agent feedback with quality scoring.
- `CollaborationManager` for agent registration, task delegation, feedback collection, and conflict resolution.
- Role-based agent coordination (CEO→Planning→Dev→QA) with direct agent-to-agent communication.

#### RAG-Based Code Search (H-3)
- `CodeChunkStrategy` for intelligent code segmentation by function, class, and block boundaries.
- `LocalEmbeddingEngine` using n-gram hashing for local vector embeddings without external API calls.
- `InMemoryVectorStore` with cosine similarity search and configurable top-k retrieval.
- `RAGOrchestrator` coordinating chunking→embedding→storage→retrieval pipeline.

#### Adaptive Prompts (H-4)
- `FeedbackTracker` for tracking prompt performance metrics and success rates.
- `PromptOptimizer` for dynamic prompt refinement based on historical feedback patterns.
- A/B testing framework for systematic prompt variant comparison and selection.

#### Multimodal Support (H-5)
- `ImageAnalyzer` for screenshot analysis, UI element detection, and layout extraction.
- `UICodeGenerator` for converting visual analysis to React component code.
- `MultimodalProcessor` orchestrating image→analysis→code generation pipeline.

#### Natural Language Test Generation (H-6)
- `RequirementParser` for extracting testable conditions from natural language requirement text.
- `TestCaseGenerator` for producing structured test cases from parsed requirements.
- `TestCodeEmitter` supporting Jest, Mocha, and Vitest output formats.
- `TestGenerator` facade coordinating parse→generate→emit workflow.

#### Git Intelligent Workflow (H-7)
- `BranchStrategist` with 7 branching strategies (feature, bugfix, hotfix, release, experiment, refactor, docs).
- `ConflictResolver` for automatic merge conflict detection and resolution suggestions.
- `PRReviewer` for automated pull request review with code quality and convention checks.

#### Real-time Pair Programming (H-8)
- `CursorSync` for synchronized cursor position tracking across IDE sessions.
- `SuggestionManager` for real-time agent suggestion display with accept/reject workflow.
- `PairSessionManager` for session lifecycle management (create, join, leave, close) with participant tracking.

## [0.5.0] - 2026-02-14

Quality Deepening & Ecosystem Expansion — E2E Tests, Eval Expansion, LLM Providers, Protocols, Platform Ecosystem.

### Added

#### E2E Integration Tests (F-2)
- 5 end-to-end test suites: ServiceRegistry lifecycle, Orchestrator lifecycle, ACP integration, Hook pipeline, Skill execution.
- 106 tests covering full CLI→Orchestrator→Agent→Skill workflows.

#### Eval Expansion (F-3)
- 10 new eval definitions expanding from 3 to 13 total scenarios.
- Categories: generalist, plan-mode, subagent-delegation, tool-use, context-management, security, code-quality.
- `ALL_EVAL_DEFINITIONS` barrel export with category/severity distribution validation.

#### Additional LLM Providers (F-4)
- 6 new providers: Mistral AI, xAI (Grok), Groq, Together AI, DeepSeek, Fireworks AI.
- OpenAI-compatible providers using `openai` SDK with custom `baseURL`.
- 12 new model profiles (2 per provider) with capability metadata.
- `RunnerConfigSchema` updated with 6 provider entries and API key fields.

#### Instinct-to-Skill Conversion (F-5)
- `InstinctToSkillConverter` for automatic skill creation from learned instinct patterns.
- `InstinctDerivedSkill` implementing `ISkill` with pattern matching and confidence scoring.
- Convert, preview, and cluster-based conversion workflows.

#### 7-Phase Workflow (F-6)
- `SevenPhaseWorkflow`: Discovery → Exploration → Clarification → Design → Implementation → Review → Summary.
- `DEFAULT_PHASE_DEFINITIONS` with configurable phase metadata.
- `PhaseExecutor` callback pattern for pluggable phase implementation.

#### A2A Protocol (F-7)
- `A2AGateway` for Agent-to-Agent communication with peer discovery and task delegation.
- `A2ARouter` with pattern-based message routing and priority ordering.
- `AgentCard` discovery protocol and ACP message bus bridging.
- 6 A2A message types: task-delegation, acceptance, rejection, progress, completion, discovery.

#### MCP OAuth (F-8)
- `OAuthManager` with `client_credentials` and `authorization_code` grant types.
- PKCE (Proof Key for Code Exchange) implementation with S256 challenge method.
- Automatic token refresh with configurable intervals and `.unref()` timers.
- Token storage and retrieval interface for persistent OAuth sessions.

#### Windows Sandbox (F-9)
- `WindowsSandbox` implementing `IOSSandbox` with PowerShell script generation.
- Environment-variable-based policy passing for sandboxed processes.
- `createPlatformSandbox()` factory updated with `win32` platform support.

#### Headless CI/CD Mode (F-10)
- `HeadlessRunner` for non-interactive API-only agent execution.
- `CIDetector` supporting GitHub Actions, GitLab CI, Jenkins, CircleCI.
- `OutputFormatter` with JSON, JSONL, and minimal output formats.
- GitHub Actions annotations (`::notice::`, `::error::`, `::warning::`) and output variables.
- `EXIT_CODES`: SUCCESS(0), GOAL_FAILED(1), TIMEOUT(2), CONFIG_ERROR(3), RUNTIME_ERROR(4).

#### Plugin Marketplace (F-11)
- `PluginPackager` with manifest validation (semver, naming), packaging, and integrity verification.
- `MarketplaceRegistry` for plugin publishing, search (query/keyword/author), install/uninstall.
- Paginated search with sorting (downloads, rating, name, updated).
- Download counting and multi-version support.

#### Desktop App (F-12)
- `IPCBridge` for channel-based IPC communication with timeout and pending request management.
- `WindowManager` for window lifecycle (create, close, focus, minimize, maximize, resize, move).
- `SystemTray` with configurable menu items, tooltip, icon, and click simulation.
- `DesktopApp` orchestrator combining IPC, windows, and tray with state machine lifecycle.
- 5 built-in IPC handlers: `app:getState`, `app:getConfig`, `window:list`, `window:focus`, `tray:getMenu`.

## [0.4.0] - 2026-02-13

Additional Improvements — Loop Detection, AST-Grep Integration, IDE Bridge, DB Persistence.

### Added

#### Loop Detection (E-1)
- `LoopDetector` with circular buffer for bounded execution history tracking.
- Three detection strategies: same-task repetition, task-sequence cycle, and state-regression via output hashing.
- Configurable thresholds: `maxSameTaskRetries`, `maxSequenceRepeats`, `sequenceWindowSize`, `timeWindowMs`.
- Escalating suggested actions: `continue` → `warn` → `block`.
- `LoopMetrics` for monitoring detection statistics: checks performed, loops detected, actions blocked.
- `ServiceRegistry` integration with `enableLoopDetection` flag.

#### AST-Grep Integration (E-2)
- `ASTGrepClient` wrapping `sg` CLI binary for structural code search and rewriting.
- Methods: `search`, `searchByRule`, `rewrite`, `listLanguages`, `isAvailable`.
- 5 built-in rule presets: unused imports, console.log removal, TODO comments, empty functions, debugger statements.
- Temporary YAML rule file management for complex rule-based searches.
- `ServiceRegistry` integration with `enableASTGrep` flag.

#### IDE Integration (E-3)
- `IDEBridge` for JSON-RPC 2.0 based communication with VS Code and JetBrains IDEs.
- Client lifecycle management: connect, disconnect, track connected clients.
- Command dispatch with configurable timeout and built-in commands: `getStatus`, `listAgents`, `submitTask`, `getTaskResult`, `listSkills`.
- `IDECommandRegistry` for custom command registration and handler management.
- Event-driven notifications: `client:connected`, `client:disconnected`, `command:executed`, `notification:sent`.
- `ServiceRegistry` integration with `enableIDE` flag.

#### DB Persistence (E-4)
- `IDBClient` interface with `connect`, `disconnect`, `query`, `execute`, `transaction`, `isConnected`.
- `InMemoryDBClient` for testing with regex-based SQL parsing (CREATE TABLE, INSERT, SELECT, UPDATE, DELETE).
- `MigrationEngine` with version-ordered migration execution, rollback support, and `_migrations` tracking table.
- `GenericPersistenceAdapter<T>` for typed CRUD operations: `create`, `get`, `update`, `delete`, `list`, `count`.
- `ServiceRegistry` integration with `enablePersistence` and `dbConfig` options.

## [0.3.0] - 2026-02-13

Platform Expansion — Instinct Sharing, Team Collaboration, Multi-Project, SaaS, Usage Analytics, GitHub Integration.

### Added

#### Instinct Sharing (D-1)
- `InstinctBundleExporter` for portable instinct bundle export with confidence filtering and category selection.
- `InstinctBundleImporter` with validation, confidence capping, deduplication, and dry-run support.
- Dashboard API endpoints: `GET /api/instincts`, `POST /api/instincts/export`, `POST /api/instincts/import`.

#### Team Collaboration (D-2)
- `CollaborationHub` for SSE-based shared sessions and real-time team communication.
- Session lifecycle: create, join, leave, close with participant tracking.
- Message broadcasting with configurable history limits per session.
- 6 message types: cursor, edit, chat, status, task-update, agent-event.
- Dashboard API endpoints: 6 collaboration REST routes for session and message management.

#### Multi-Project Management (D-3)
- `ProjectManager` for managing multiple project workspaces with add/remove/switch lifecycle.
- Active project tracking with `lastAccessedAt` timestamps for recent project queries.
- Configurable max project limits with event-driven notifications.

#### SaaS Features (D-4)
- `TenantManager` with plan-based limits (free/pro/enterprise), usage tracking, and feature gating.
- `BillingManager` with default billing plans, subscription lifecycle, invoice creation and payment.
- Stripe-compatible interfaces for payment integration.

#### Usage Analytics (D-5)
- `UsageTracker` for recording LLM usage with breakdowns by agent, model, and provider.
- `CostReporter` for generating cost reports with daily aggregation and automated recommendations.
- Configurable record limits with oldest-first eviction.
- Dashboard API endpoints: `GET /api/analytics/summary`, `GET /api/analytics/cost-report`.

#### GitHub Integration (B-4)
- `GitHubClient` wrapping Octokit for PR, Issue, and Repository operations.
- 18 methods covering full PR lifecycle, issue management, and repository queries.
- Custom error handling: authentication, rate limit, not found, validation errors.
- `ServiceRegistry` integration with `enableGitHub` flag.

## [0.2.0] - 2026-02-13

Feature Expansion — MCP, Parallel Execution, LSP real integration.

### Added

#### MCP Real Integration (C-1)
- `MCPConnectionManager` for multi-server MCP connection management with fault isolation.
- 5 built-in MCP server presets: filesystem, github, fetch, memory, brave-search.
- MCP server configuration schema in shared config (`mcp.servers[]`).
- `ServiceRegistry` integration with automatic tool discovery and registration.
- Dashboard API endpoint `GET /api/mcp/servers` for MCP server status.

#### Parallel Execution Integration (C-2)
- `AgentPool` ↔ `ParallelExecutor` wiring with semaphore-based acquire/release.
- `executeGoalAsync()` for fire-and-forget goal execution via `BackgroundManager`.
- Parallel execution events: `parallel:batch-start`, `parallel:batch-complete`, `pool:acquired`, `pool:released`.
- Runner config extensions: `providerLimits`, `globalMax`, `enableBackgroundGoals`.
- Dashboard API endpoint `GET /api/pool/stats` for agent pool statistics.

#### LSP Real Integration (C-4)
- `DocumentSync` for LSP text document lifecycle notifications (didOpen/didChange/didClose/didSave).
- `SymbolCache` with configurable TTL and LRU eviction for symbol lookup results.
- `LSPConnectionManager` for multi-language server connection management with language-based routing.
- `RefactorEngine` upgraded from stub handlers to real LSP `textDocument/rename` and `textDocument/codeAction`.
- 5 LSP server presets: typescript, python, go, rust, css.
- LSP server configuration schema in shared config (`lsp.servers[]`).

## [0.1.0] - 2026-02-13

Initial release of the ACA multi-agent orchestration system.

### Added

#### Core Orchestration
- `OrchestratorRunner` lifecycle management with start, pause, resume, and destroy states.
- `CEOOrchestrator` for high-level goal decomposition and task delegation.
- `TaskRouter` with load-balanced routing strategy for distributing work across teams.
- `TeamRegistry` for dynamic team registration and lookup.
- `AgentFactory` with dependency injection for creating configured agent instances.
- `ParallelExecutor` for concurrent task execution across teams.
- `ErrorEscalator` with configurable escalation policies.
- `RunnerStateManager` for tracking runner lifecycle state transitions.
- `BackgroundManager` for background task coordination.

#### Agents
- `PlanningAgent` -- task decomposition, goal planning, and dependency analysis.
- `DevelopmentAgent` -- code generation with frontend and backend variants.
- `QAAgent` -- test execution and quality assurance.
- `CodeQualityAgent` -- deep code review, refactoring suggestions, and test generation.
- `ArchitectureAgent` -- system design and architectural decision support.
- `SecurityAgent` -- vulnerability scanning and security assessment.
- `DebuggingAgent` -- root cause analysis and fix suggestion generation.
- `DocumentationAgent` -- automated documentation generation.
- `ExplorationAgent` -- codebase exploration and pattern discovery.
- `IntegrationAgent` -- service integration and API connection management.

#### Skill System
- `SkillRegistry` for skill discovery, registration, and management.
- `SkillPipeline` for composing and chaining skills into multi-step workflows.
- 14 built-in skills: planning, code-review, test-generation, TDD workflow, refactoring, security-scan, git-workflow, documentation, debugging, performance, migration, API design, database, and CI/CD.

#### LLM Provider Abstraction
- Multi-provider support: Anthropic Claude, OpenAI, Google Gemini, and Ollama (via CLI).
- `ModelRouter` with pluggable routing strategies (cost, latency, capability).
- `ResilientClient` wrapper with retry, timeout, and fallback behavior.
- `CostTracker` for per-request and aggregate token cost tracking.
- Model profiles with capability metadata for routing decisions.

#### CLI
- `runner run <goal>` -- execute a high-level goal through the orchestrator.
- `runner submit <team> <description>` -- submit a task directly to a specific team.
- `runner config` -- display the loaded runner configuration.
- `runner serve` -- start the web dashboard API server.
- Priority, project, tag, and workspace override flags.
- Validation and learning hook opt-in flags.

#### API Server
- HTTP API server with OrchestratorRunner integration.
- REST endpoints: `/api/health`, `/api/snapshot`, `/api/agents`, `/api/agents/:agentId`, `/api/tasks`, `/api/sse/clients`.
- JWT-based authentication with configurable secret.
- API key authentication support.
- Request logging middleware.
- CORS middleware with configurable origins.
- Rate limiting middleware (per-IP throttling).
- Request body validation middleware (Zod schemas).
- Error handler middleware with normalized JSON responses.
- Login endpoint for token issuance.

#### API Gateway
- `APIGateway` class bridging HTTP/WebSocket requests to ACP messages.
- Task submission, status publishing, and health check methods.
- Event handler registration for gateway-level event forwarding.

#### ACP (Agent Communication Protocol)
- `ACPMessageBus` for typed publish/subscribe messaging between agents.
- Request/response pattern with configurable timeouts.
- Message types: `task:submit`, `task:status`, `task:result`, `system:health`, `agent:status`.

#### HUD Dashboard
- `HUDDashboard` with agent status tracking, system health scoring, and warning aggregation.
- `MetricsCollector` for time-series metric recording.
- `HUDSnapshot` for point-in-time dashboard state export.

#### Web Dashboard
- `WebDashboard` orchestrator combining HTTP server, REST API, and SSE broker.
- `DashboardAPI` with REST routes for health, snapshot, agents, and task submission.
- `SSEBroker` for real-time server-sent event broadcasting to connected clients.
- `HttpAdapter` for Node.js HTTP server integration.

#### Terminal UI (TUI)
- Agent panel component for real-time agent status display.
- Task tracker component for task progress monitoring.
- Cost display component for LLM spending visibility.
- Diff viewer component for code change review.
- Log viewer component for structured log output.
- React-style hooks: `useAgentStatus`, `useTaskProgress`.

#### Permission System
- `PermissionManager` with default-deny rule set.
- `PermissionResolver` with glob-based pattern matching and specificity ranking.
- `ApprovalWorkflow` with three modes: suggest, auto-edit, and full-auto.
- Tiered permission actions: ALLOW, ASK_USER, DENY.

#### Hook Pipeline
- `HookRegistry` for hook discovery and registration.
- `HookExecutor` for ordered hook execution with error handling.
- Built-in hooks: code quality, confidence check, context optimizer, error learning, goal verification, permission guard, sandbox escalation, self-check.

#### Security
- Platform-aware sandbox: `SeatbeltSandbox` (macOS), `LandlockSandbox` (Linux).
- `NetworkIsolation` for controlling agent network access.
- `ResourceLimiter` for CPU and memory constraints.
- `SandboxEscalation` for dynamic privilege adjustment.

#### Plugin System
- `PluginLoader` for filesystem-based plugin discovery.
- `PluginRegistry` for plugin registration and dependency resolution.
- `PluginLifecycle` for managed start/stop/restart operations.
- `PluginAPI` providing a sandboxed API surface for plugin authors.

#### Session Management
- `SessionManager` for session creation, restoration, and lifecycle tracking.
- `JsonlPersistence` for append-only session log storage.
- `SessionRecovery` for crash recovery from persisted state.
- `SessionCompactor` for log compaction and storage optimization.

#### Learning Subsystem
- `ReflexionPattern` for error-driven learning and self-improvement.
- `InstinctStore` for persistent pattern storage.
- `InstinctClustering` for grouping related patterns.
- `TeamLearningHub` for cross-team knowledge sharing.
- `SolutionsCache` for caching successful solutions.
- Instinct import/export for transferring learned patterns between instances.

#### Context Management
- `ContextManager` for tracking and optimizing context window usage.
- `TokenBudgetManager` for per-agent token budget allocation.
- `ContextMonitor` for real-time context pressure detection.
- `CompactionStrategy` for context window compaction.
- `OutputOptimizer` for reducing output token usage.
- `QualityCurve` for modeling quality-vs-token trade-offs.
- Planning context subsystem: `PhaseManager`, `StateTracker`, `ResearchSnapshot`, `ContextBudget`, `PlanningDirectory`.

#### Validation
- `ConfidenceChecker` for output confidence scoring.
- `StubDetector` for identifying placeholder and stub code.
- `GoalBackwardVerifier` for verifying outputs against original goals.
- `VerificationPipeline` for orchestrating multi-step verification.
- `VerificationReport` for structured validation reporting.

#### LSP Integration
- `LspClient` with stdio and socket transport support.
- `DiagnosticsCollector` for aggregating language server diagnostics.
- `SymbolResolver` for symbol lookup and navigation.
- `RefactorEngine` for LSP-powered automated refactoring.

#### MCP (Model Context Protocol)
- `MCPClient` for connecting to MCP servers.
- `MCPServer` for exposing agent capabilities as MCP tools.
- `MCPToolRegistry` for tool discovery and registration.
- Transport implementations for stdio and HTTP.

#### Workspace Management
- `WorkspaceManager` for directory and file operations within agent workspaces.
- `TaskDocument` model with team type, priority, and task type metadata.
- `DocumentQueue` for ordered task processing.
- `PlanValidator` for validating generated plans.
- XML plan format support for structured plan serialization.

#### Brownfield Analysis
- `BrownfieldAnalyzer` for analyzing existing codebases before agent operations.

#### Evals
- `EvalRunner` for executing agent performance benchmarks.
- `EvalReporter` for structured benchmark reporting.
- Eval definition framework for custom benchmark scenarios.

#### Benchmarks
- `BenchmarkRunner` for orchestrator-level task execution benchmarks.
- `OrchestratorTaskExecutor` for isolated benchmark task execution.

#### Telemetry
- `OTelProvider` for OpenTelemetry provider initialization.
- `TraceManager` for distributed trace creation and propagation.
- `MetricsExporter` for metrics export to configured backends.
- `CostAnalytics` for LLM cost aggregation and reporting.

#### Dynamic Prompts
- `PromptRegistry` for registering prompt templates by name.
- `PromptRenderer` for variable substitution and template rendering.

#### Docs Generator
- `DocsGenerator` for automated project documentation generation.

#### Instinct Transfer
- `InstinctTransfer` for migrating learned patterns between agent instances.

#### Checkpoint
- `CheckpointManager` for creating and restoring state snapshots.

#### Other
- `ServiceRegistry` for dependency registration and lookup.
- Internationalization (i18n) support.
- Notification system for agent event notifications.
- Keyboard shortcuts system.
- Developer experience (DX) error recovery utilities.
- GitHub/Octokit integration for repository operations.
- Winston-based structured logging.
- Zod-validated configuration loading from environment variables.
- Comprehensive test suite: unit, integration, e2e, and specs.
