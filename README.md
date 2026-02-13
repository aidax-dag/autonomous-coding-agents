# Autonomous Coding Agents (ACA)

Multi-agent orchestration system for autonomous software development. Coordinates specialized AI agents across planning, development, QA, security, and documentation workflows using configurable LLM providers.

**Version**: 0.1.0 | **License**: MIT | **Runtime**: Node.js 20+ | **Language**: TypeScript 5.9+

## Architecture

```
                          +------------------+
                          |   CLI / API      |
                          | (commander/HTTP) |
                          +--------+---------+
                                   |
                          +--------v---------+
                          | OrchestratorRunner|
                          |  (runner-config)  |
                          +--------+---------+
                                   |
                  +----------------+----------------+
                  |                                  |
         +--------v--------+              +---------v--------+
         | CEOOrchestrator |              |   Hook Pipeline  |
         |  (task routing)  |              | (validation,     |
         +-+------+------+-+              |  learning, etc.) |
           |      |      |                +------------------+
    +------+  +---+---+  +------+
    |         |       |         |
+---v---+ +---v---+ +-v----+ +-v----------+
|Planning| |  Dev  | |  QA  | | Security   |
| Agent  | | Agent | |Agent | | Agent  ... |
+---+---+ +---+---+ +--+---+ +---+--------+
    |         |         |         |
    +----+----+---------+---------+
         |
    +----v---------+     +---------------+
    | Skill System |     | LLM Providers |
    | (TDD, CI/CD, |     | Claude|OpenAI |
    |  security...) |     | Gemini|Ollama |
    +--------------+     +---------------+
         |
    +----v---------+     +---------------+
    | ACP Message  |     | HUD Dashboard |
    |    Bus       |     | (TUI + Web)   |
    +--------------+     +---------------+
```

The system follows a layered design:

1. **Entry layer** -- CLI (commander) and HTTP API server accept goals and tasks.
2. **Orchestration layer** -- `OrchestratorRunner` manages lifecycle; `CEOOrchestrator` decomposes goals and routes tasks to teams via `TaskRouter`.
3. **Agent layer** -- Specialized agents (planning, development, QA, security, architecture, documentation, debugging, exploration, integration) execute tasks using the skill system.
4. **Infrastructure layer** -- ACP message bus, HUD dashboard, permission system, plugin host, session persistence, and OpenTelemetry tracing.

## Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- At least one LLM API key (Anthropic, OpenAI, or Google Gemini)

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd autonomous-coding-agents
npm install

# Configure environment
cp .env.example .env
# Edit .env -- set at least one LLM API key and your GitHub credentials

# Build
npm run build

# Run a goal
npm run cli -- runner run "Implement user authentication with JWT"

# Or start the API server
npm run cli -- runner serve
```

## CLI Commands

The CLI is available via the `multi-agent` binary (after `npm run build && npm link`) or through `npm run cli`.

```bash
multi-agent runner <command>
```

| Command | Description | Example |
|---------|-------------|---------|
| `run <goal>` | Execute a high-level goal through the orchestrator | `runner run "Add REST API for users"` |
| `submit <team> <desc>` | Submit a task directly to a specific team | `runner submit development "Fix login bug"` |
| `config` | Display loaded runner configuration | `runner config` |
| `serve` | Start the web dashboard API server | `runner serve --port 3000` |

### run options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --priority <level>` | Task priority: low, medium, high, critical | `medium` |
| `--project <id>` | Project identifier | -- |
| `--tags <tags>` | Comma-separated tags | -- |
| `--no-wait` | Submit and exit without waiting for completion | `false` |
| `--workspace <dir>` | Override workspace directory | `WORK_DIR` env |
| `--validation` | Enable pre/post validation hooks | `false` |
| `--learning` | Enable error learning via ReflexionPattern | `false` |

### submit options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --priority <level>` | Task priority | `medium` |
| `--project <id>` | Project identifier | -- |
| `--workspace <dir>` | Override workspace directory | `WORK_DIR` env |

### serve options

| Flag | Description | Default |
|------|-------------|---------|
| `--port <port>` | Port to listen on | `3000` |
| `--host <host>` | Host to bind to | `localhost` |

## API Endpoints

The API server exposes REST endpoints for dashboard integration and task management.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | System health status (healthy / degraded / unhealthy) |
| `GET` | `/api/snapshot` | Full HUD dashboard snapshot (agents, metrics, warnings) |
| `GET` | `/api/agents` | List all active agents |
| `GET` | `/api/agents/:agentId` | Get a specific agent's status |
| `POST` | `/api/tasks` | Submit a new task (`{ name, description }`) |
| `GET` | `/api/sse/clients` | Count of connected SSE clients |
| `POST` | `/api/auth/login` | Authenticate and receive a JWT (requires `JWT_SECRET`) |

The server also provides an SSE stream that broadcasts `agent:status` events in real time.

### Middleware

The API server applies the following middleware automatically:

- **Request logging** -- Logs method, path, status, and duration for every request.
- **CORS** -- Configurable cross-origin resource sharing.
- **Rate limiting** -- Per-IP request throttling.
- **Validation** -- Request body validation via Zod schemas.
- **Error handler** -- Normalizes errors into a consistent JSON response format.
- **JWT authentication** -- Protects endpoints when `JWT_SECRET` is configured (min 16 characters).

## Configuration

All configuration is loaded from environment variables validated with Zod. Copy `.env.example` to `.env` and adjust the values.

### LLM Providers

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `LLM_PROVIDER` | Default provider: `claude`, `openai`, or `gemini` |
| `LLM_MODEL` | Override the default model (e.g., `claude-sonnet-4-5-20250929`) |
| `LLM_MAX_TOKENS` | Maximum tokens per LLM request |
| `LLM_TEMPERATURE` | Sampling temperature (0.0 -- 1.0) |

### GitHub

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token |
| `GITHUB_OWNER` | Repository owner |
| `GITHUB_REPO` | Repository name |

### Runner

| Variable | Description | Default |
|----------|-------------|---------|
| `WORK_DIR` | Workspace directory for agent operations | `/tmp/autonomous-coding-agents` |
| `MAX_CONCURRENT_TASKS` | Maximum parallel tasks | `1` |
| `TASK_TIMEOUT` | Per-task timeout in milliseconds | `300000` |
| `RETRY_ATTEMPTS` | Number of retry attempts on failure | `3` |
| `MAX_CONCURRENT_FEATURES` | Maximum features developed concurrently | `3` |
| `MAX_TURNS_PER_FEATURE` | Maximum agent turns per feature | `50` |
| `AGENT_TIMEOUT_MINUTES` | Per-agent timeout in minutes | `240` |
| `ROUTING_STRATEGY` | Task routing strategy (e.g., `LOAD_BALANCED`) | `LOAD_BALANCED` |

### Feature Flags

All flags default to `false`. Set to `true` to enable.

| Variable | Description |
|----------|-------------|
| `ENABLE_VALIDATION` | Pre/post validation hooks (confidence check, stub detection) |
| `ENABLE_LEARNING` | Error learning via ReflexionPattern and instinct store |
| `ENABLE_CONTEXT_MANAGEMENT` | Context window optimization and compaction |
| `ENABLE_SECURITY` | OS-level sandbox escalation (seatbelt on macOS, landlock on Linux) |
| `ENABLE_SESSION` | Session persistence and recovery (JSONL-based) |
| `ENABLE_MCP` | Model Context Protocol client/server integration |
| `ENABLE_LSP` | Language Server Protocol integration (diagnostics, symbols, refactoring) |
| `ENABLE_PLUGINS` | Plugin system with sandboxed execution |
| `ENABLE_PLANNING_CONTEXT` | Planning context module (phase management, research snapshots) |
| `ENABLE_EXPANDED_AGENTS` | Extended agent set (architecture, security, debugging, docs, exploration, integration) |
| `ENABLE_PARALLEL_EXECUTION` | Parallel task execution across teams |
| `ENABLE_TELEMETRY` | OpenTelemetry tracing and metrics export |
| `USE_REAL_QUALITY_TOOLS` | Use real quality tools instead of LLM-based mock |

### API Server

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `HOST` | API server bind address | `0.0.0.0` |
| `JWT_SECRET` | JWT signing secret (minimum 16 characters to enable auth) | -- |

### Logging

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Log verbosity: `debug`, `info`, `warn`, `error` | `info` |
| `LOG_TO_FILE` | Write logs to disk | `true` |
| `LOG_DIR` | Log output directory | `./logs` |

## Project Structure

```
src/
  api/                        # HTTP API server
    auth/                     #   JWT and API key authentication
    middleware/                #   Rate limiting, CORS, validation, error handling, logging
    gateway.ts                #   API Gateway -- bridges HTTP to ACP messages
    server.ts                 #   Server startup, lifecycle, and dependency wiring
  cli/                        # CLI entry point (commander)
    autonomous.ts             #   Runner subcommands (run, submit, config, serve)
  core/
    benchmark/                # Benchmark runner for orchestrator task evaluation
    brownfield/               # Brownfield codebase analyzer
    checkpoint/               # Checkpoint manager for state snapshots
    context/                  # Context management, token budgets, compaction strategies
      planning-context/       #   Phase manager, state tracker, research snapshots
    deep-worker/              # Long-running deep worker agent
    docs-generator/           # Documentation generation engine
    dynamic-prompts/          # Prompt registry and template renderer
    evals/                    # Eval runner and reporter for agent benchmarking
    hooks/                    # Hook pipeline
      code-quality/           #     Code quality validation
      confidence-check/       #     Output confidence scoring
      context-optimizer/      #     Context window optimization
      error-learning/         #     Error pattern learning
      goal-verification/      #     Goal-backward verification
      permission-guard/       #     Permission enforcement
      sandbox-escalation/     #     Sandbox level escalation
      self-check/             #     Self-check protocol
    hud/                      # HUD dashboard and metrics collector
    i18n/                     # Internationalization support
    instinct-transfer/        # Instinct transfer between agent instances
    learning/                 # Learning subsystem
      reflexion-pattern.ts    #     ReflexionPattern for error-driven learning
      instinct-store.ts       #     Persistent instinct storage
      instinct-clustering.ts  #     Pattern clustering
      team-learning-hub.ts    #     Cross-team knowledge sharing
      solutions-cache.ts      #     Solution caching
    lsp/                      # Language Server Protocol integration
      lsp-client.ts           #     LSP client and transport
      diagnostics-collector.ts #    Diagnostic aggregation
      symbol-resolver.ts      #     Symbol lookup and navigation
      refactor-engine.ts      #     Automated refactoring
    mcp/                      # Model Context Protocol
      mcp-client.ts           #     MCP client
      mcp-server.ts           #     MCP server
      mcp-tool-registry.ts    #     Tool discovery and registration
      mcp-transport/          #     Transport implementations
    notifications/            # Notification system
    orchestrator/             # Core orchestration engine
      agents/                 #   Specialized team agents
        planning-agent.ts     #     Task decomposition and planning
        development-agent.ts  #     Code generation (frontend/backend variants)
        qa-agent.ts           #     Test execution and quality assurance
        code-quality-agent.ts #     Deep review, refactoring, test generation
        architecture-agent.ts #     System design decisions
        security-agent.ts     #     Vulnerability assessment
        debugging-agent.ts    #     Root cause analysis
        documentation-agent.ts #    Documentation generation
        exploration-agent.ts  #     Codebase exploration
        integration-agent.ts  #     Service integration
      llm/                    #   Team-agent LLM adapters and model routing
      quality/                #   Quality tool integrations
      workflow/               #   Workflow engine, parser, and schema
      ceo-orchestrator.ts     #   Top-level goal decomposition and coordination
      orchestrator-runner.ts  #   Runner lifecycle, event wiring, and teardown
      task-router.ts          #   Load-balanced task routing strategies
      team-registry.ts        #   Team registration and lookup
      agent-factory.ts        #   Agent creation and dependency injection
      parallel-executor.ts    #   Parallel task execution
      error-escalator.ts      #   Error escalation policies
    permission/               # Permission and approval system
      permission-manager.ts   #     Central rule management (default deny)
      permission-resolver.ts  #     Rule matching engine
      approval-workflow.ts    #     Mode-based approval (suggest, auto-edit, full-auto)
    plugins/                  # Plugin system
      plugin-loader.ts        #     Discovery and loading
      plugin-registry.ts      #     Registration and lookup
      plugin-lifecycle.ts     #     Start/stop lifecycle management
      plugin-api.ts           #     Sandboxed plugin API surface
    protocols/                # ACP (Agent Communication Protocol) message bus
    security/                 # OS-level sandboxing
      seatbelt-sandbox.ts     #     macOS seatbelt sandbox
      landlock-sandbox.ts     #     Linux landlock sandbox
      network-isolation.ts    #     Network access control
      resource-limiter.ts     #     CPU/memory resource limits
      sandbox-escalation.ts   #     Dynamic escalation
    services/                 # Service registry
    session/                  # Session management
      session-manager.ts      #     Session lifecycle
      jsonl-persistence.ts    #     JSONL-based persistence
      session-recovery.ts     #     Crash recovery
      session-compactor.ts    #     Log compaction
    shortcuts/                # Keyboard shortcuts
    skills/                   # Composable skill system
      skill-registry.ts       #     Skill discovery and management
      skill-pipeline.ts       #     Skill composition and chaining
      skills/                 #     Skill implementations (see Skills section)
    validation/               # Output validation
      confidence-checker.ts   #     Confidence scoring
      stub-detector.ts        #     Stub/placeholder detection
      goal-backward-verifier.ts #   Goal-backward verification
      verification-pipeline.ts #    Verification orchestration
      verification-report.ts  #     Report generation
    workspace/                # Workspace management
      workspace-manager.ts    #     Directory and file operations
      task-document.ts        #     Task document model
      document-queue.ts       #     Task queue
      plan-validator.ts       #     Plan validation
      xml-plan-format.ts      #     XML plan serialization
  dx/                         # Developer experience utilities
    error-recovery/           #     Error recovery helpers
  shared/
    ci/                       # CI integration utilities
    config/                   # Configuration loading (Zod-validated)
    errors/                   # Custom error types and error codes
    github/                   # GitHub/Octokit integration
    llm/                      # LLM client abstraction layer
      claude-client.ts        #     Anthropic Claude
      openai-client.ts        #     OpenAI
      gemini-client.ts        #     Google Gemini
      base-client.ts          #     Shared client interface
      resilient-client.ts     #     Retry, timeout, and fallback wrapper
      model-router.ts         #     Multi-model routing
      model-profiles.ts       #     Model capability profiles
      cost-tracker.ts         #     Token cost tracking
      routing-strategies/     #     Cost, latency, and capability routing
      cli/                    #     CLI-based LLM clients (Ollama, etc.)
    logging/                  # Winston-based structured logging
    telemetry/                # OpenTelemetry integration
      otel-provider.ts        #     Provider initialization
      trace-manager.ts        #     Distributed tracing
      metrics-exporter.ts     #     Metrics export
      cost-analytics.ts       #     LLM cost analytics
  ui/
    tui/                      # Terminal UI dashboard
      components/             #     Agent panel, task tracker, cost display, diff viewer, log viewer
      hooks/                  #     React-style hooks (useAgentStatus, useTaskProgress)
    web/                      # Web dashboard
      web-server.ts           #     HTTP server
      web-dashboard.ts        #     Dashboard orchestrator
      dashboard-api.ts        #     REST API routes
      sse-broker.ts           #     Server-Sent Events for real-time updates
      http-adapter.ts         #     HTTP adapter
tests/
  unit/                       # Unit tests
  integration/                # Integration tests
  e2e/                        # End-to-end tests
  specs/                      # Test specifications
  __mocks__/                  # Test mocks
```

## Agents

The orchestrator manages specialized agents. Each agent handles a specific domain and is backed by the configured LLM provider.

| Agent | Responsibility |
|-------|---------------|
| PlanningAgent | Task decomposition, goal planning, dependency analysis |
| DevelopmentAgent | Code generation; includes frontend and backend variants |
| QAAgent | Test execution and quality assurance |
| CodeQualityAgent | Deep code review, refactoring suggestions, test generation |
| ArchitectureAgent | System design and architectural decisions |
| SecurityAgent | Vulnerability scanning and security assessment |
| DebuggingAgent | Root cause analysis and fix suggestions |
| DocumentationAgent | Documentation generation and maintenance |
| ExplorationAgent | Codebase exploration and pattern discovery |
| IntegrationAgent | Service integration and API connections |

The base set includes PlanningAgent, DevelopmentAgent, and QAAgent. Set `ENABLE_EXPANDED_AGENTS=true` to activate the full agent roster.

## Skills

Skills are composable, reusable capabilities invoked by agents through the `SkillPipeline`. Skills can be chained together for complex workflows.

| Skill | Description |
|-------|-------------|
| PlanningSkill | Task decomposition and work breakdown |
| CodeReviewSkill | Automated code review with findings |
| TestGenerationSkill | Test case generation from source code |
| TddWorkflowSkill | Red-green-refactor TDD cycle |
| RefactoringSkill | Code refactoring with safety checks |
| SecurityScanSkill | Security vulnerability scanning |
| GitWorkflowSkill | Git operations (branch, commit, PR creation) |
| DocumentationSkill | Documentation generation (API docs, guides) |
| DebuggingSkill | Debugging with root cause analysis and fix suggestions |
| PerformanceSkill | Performance profiling and optimization suggestions |
| MigrationSkill | Code and schema migration |
| ApiDesignSkill | REST API endpoint design |
| DatabaseSkill | Database schema and query design |
| CicdSkill | CI/CD pipeline configuration |

## Permission System

The permission system controls agent access to files, commands, and operations. It implements three approval modes:

| Mode | Behavior |
|------|----------|
| `suggest` | Agent proposes changes; user must approve each one |
| `auto-edit` | Agent applies file edits automatically; commands require approval |
| `full-auto` | Agent operates without user intervention |

Permission rules support glob patterns for file paths and command matching, with configurable actions: `ALLOW`, `ASK_USER`, and `DENY`. Rules are evaluated by specificity, with the most specific match taking precedence.

## Development

```bash
# Development mode with hot reload
npm run dev

# Development API server
npm run dev:api

# Type checking (no emit)
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Production build
npm run build

# Start production build
npm start
```

### TypeScript Configuration

| Setting | Value |
|---------|-------|
| Target | ES2022 |
| Module | ESNext |
| Module resolution | node |
| Strict mode | enabled |
| Path aliases | `@/*` -> `src/*`, `@agents/*` -> `src/agents/*`, `@shared/*` -> `src/shared/*`, `@types/*` -> `src/types/*` |

### Testing

Tests are organized under the `tests/` directory:

- `tests/unit/` -- Isolated unit tests
- `tests/integration/` -- Cross-module integration tests
- `tests/e2e/` -- End-to-end workflow tests
- `tests/specs/` -- Test specifications
- `tests/__mocks__/` -- Shared mocks

The test runner is Jest with `ts-jest` for TypeScript support.

## License

MIT
