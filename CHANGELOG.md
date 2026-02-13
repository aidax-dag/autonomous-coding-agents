# Changelog

All notable changes to the Autonomous Coding Agents (ACA) project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-13

Phase C: Feature Expansion — MCP, Parallel Execution, LSP real integration.

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
