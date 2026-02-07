# System Design

> 핵심 모듈 및 컴포넌트 설계

**Last Updated**: 2026-01-24

## 1. Directory Structure

```
src/
├── core/                      # 핵심 도메인
│   ├── agents/               # 에이전트 시스템
│   │   ├── specialized/      # 특화 에이전트 (Coder, Reviewer, Architect 등)
│   │   ├── execution/        # 백그라운드 실행
│   │   └── communication/    # 에이전트 간 통신
│   ├── config/               # 설정 서비스
│   ├── daemon/               # 데몬 프로세스
│   ├── di/                   # 의존성 주입
│   ├── events/               # 이벤트 시스템
│   ├── hooks/                # 훅 시스템 (11개 훅)
│   ├── interfaces/           # 공통 인터페이스
│   ├── kernel/               # Agent OS 커널
│   │   ├── scheduler.ts      # 스케줄러
│   │   ├── process-manager.ts
│   │   ├── resource-manager.ts
│   │   └── security-module.ts
│   ├── knowledge/            # 지식 저장소
│   ├── logging/              # 구조화된 로깅
│   ├── memory/               # 프로젝트 메모리
│   ├── metrics/              # 메트릭 수집
│   ├── orchestrator/         # 오케스트레이터
│   │   ├── llm/              # 팀별 LLM 프롬프트
│   │   ├── agents/           # 팀 에이전트
│   │   ├── workflow/         # 워크플로우 실행
│   │   └── quality/          # 품질 실행기
│   ├── quality/              # 품질 검사 시스템
│   │   └── checks/           # 5가지 품질 체커
│   ├── runner/               # 자율 실행기
│   ├── security/             # 보안 시스템
│   │   ├── audit/            # 감사 로그
│   │   ├── permission/       # 권한 관리
│   │   ├── plugin/           # 플러그인 보안
│   │   ├── scanning/         # 코드 스캐닝
│   │   ├── secret/           # 시크릿 관리
│   │   └── trust/            # 신뢰 관리
│   ├── session/              # 세션 관리
│   ├── services/             # 공통 서비스
│   ├── teams/                # 팀 에이전트 (6개 팀)
│   ├── tools/                # 도구 시스템 (7개 카테고리)
│   ├── workflow/             # 워크플로우 엔진
│   └── workspace/            # 워크스페이스 관리
│       ├── document-queue.ts # 문서 기반 작업 큐
│       └── task-document.ts
│
├── api/                      # REST/GraphQL API
│   ├── auth/                 # 인증 (JWT, API Key)
│   ├── graphql/              # GraphQL 스키마/리졸버
│   ├── middleware/           # 미들웨어
│   ├── ratelimit/            # 레이트 리미팅
│   ├── routes/               # REST 라우트
│   ├── server/               # API/WebSocket 서버
│   └── services/             # API 서비스 레이어
│
├── dx/                       # Developer Experience
│   ├── debug-toolkit/        # 디버그 도구
│   ├── error-recovery/       # 에러 복구 전략
│   ├── output-optimizer/     # 출력 최적화
│   ├── testing/              # Mock LLM 등 테스트 유틸
│   └── token-budget/         # 토큰 예산 관리
│
├── agents/                   # 독립 에이전트 프로세스
│   ├── base/                 # 기반 에이전트
│   ├── coder/                # 코더 에이전트
│   ├── reviewer/             # 리뷰어 에이전트
│   ├── repo-manager/         # 저장소 관리자
│   └── manager/              # 에이전트 매니저
│
├── shared/                   # 공유 모듈
│   ├── llm/                  # LLM 클라이언트
│   │   ├── cli/              # CLI 클라이언트 (Claude, Codex, Gemini, Ollama)
│   │   ├── claude-client.ts
│   │   ├── openai-client.ts
│   │   ├── gemini-client.ts
│   │   └── resilient-client.ts
│   ├── analysis/             # 코드 분석
│   ├── ci/                   # CI 체커
│   ├── config/               # 공유 설정
│   ├── errors/               # 커스텀 에러
│   ├── feedback/             # 피드백 시스템
│   ├── git/                  # Git 작업
│   ├── github/               # GitHub API
│   ├── logging/              # 공유 로거
│   ├── messaging/            # NATS 메시징
│   └── notifications/        # 알림 시스템
│
├── server/                   # 서버
│   ├── health-server.ts      # 헬스 체크 서버
│   └── webhook/              # GitHub Webhook 서버
│
├── cli/                      # CLI 인터페이스
│   ├── index.ts              # CLI 진입점
│   ├── autonomous.ts         # 자율 실행 CLI
│   └── interactive.ts        # 인터랙티브 모드
│
├── bin/                      # 실행 스크립트
│   ├── start-coder.ts
│   ├── start-reviewer.ts
│   ├── start-repo-manager.ts
│   └── start-health-server.ts
│
└── test/                     # E2E 테스트
    └── e2e/
```

---

## 2. Core Interfaces

### 2.1 Agent Interface
```typescript
interface IAgent {
  id: string;
  type: AgentType;
  initialize(): Promise<void>;
  processTask(task: Task): Promise<TaskResult>;
  getHealth(): HealthStatus;
  stop(): Promise<void>;
}

interface IAgentFactory {
  create(type: AgentType, config: AgentConfig): Promise<IAgent>;
  createFromSpec(spec: AgentSpec): Promise<IAgent>;
}

interface IAgentRegistry {
  register(agent: IAgent): void;
  unregister(agentId: string): void;
  get(agentId: string): IAgent | undefined;
  getByType(type: AgentType): IAgent[];
  getAll(): IAgent[];
}
```

### 2.2 Tool Interface
```typescript
interface ITool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  schema: ToolSchema;
  execute(params: TInput): Promise<ToolResult<TOutput>>;
  validate(params: unknown): ToolValidationResult;
}

interface IToolRegistry {
  register(tool: ITool): void;
  get(name: string): ITool | undefined;
  getAll(): ITool[];
  execute(name: string, params: unknown): Promise<ToolResult>;
}
```

### 2.3 Hook Interface
```typescript
interface IHook {
  name: string;
  event: HookEvent;
  priority: number;
  enabled: boolean;
  execute(context: HookContext): Promise<HookResult>;
  cleanup?(): Promise<void>;
}

interface IHookRegistry {
  register(hook: IHook): void;
  unregister(name: string): void;
  getByEvent(event: HookEvent): IHook[];
  executeHooks(event: HookEvent, context: HookContext): Promise<HookResult[]>;
}
```

### 2.4 Team Interface
```typescript
interface ITeam {
  id: string;
  name: string;
  type: TeamType;
  capabilities: string[];
  executeTask(task: TeamTask): Promise<TaskResult>;
  getMembers(): AgentRole[];
  getStats(): TeamStats;
}

interface ITeamRegistry {
  register(team: ITeam): void;
  route(task: Task): ITeam | undefined;
  getByCapability(capability: string): ITeam[];
}
```

---

## 3. Key Components

### 3.1 Orchestrator System
```
src/core/orchestrator/
├── ceo-orchestrator.ts       # CEO 오케스트레이터 (전략적 의사결정)
├── task-router.ts            # 태스크 라우팅 (5가지 전략)
├── task-decomposer.ts        # 태스크 분해
├── team-registry.ts          # 팀 레지스트리
├── team-agent.ts             # 팀 에이전트 베이스
├── base-team-agent.ts        # 기본 팀 에이전트
├── agent-workflow.ts         # 에이전트 워크플로우
├── orchestrator-service.ts   # 오케스트레이터 서비스
├── orchestrator-runner.ts    # 실행기
├── llm/                      # 팀별 LLM 프롬프트
│   ├── development-llm.ts
│   ├── planning-llm.ts
│   ├── qa-llm.ts
│   ├── code-quality-llm.ts
│   └── prompt-templates.ts
├── agents/                   # 팀 에이전트 구현
│   ├── development-agent.ts
│   ├── planning-agent.ts
│   ├── qa-agent.ts
│   └── code-quality-agent.ts
├── workflow/                 # 워크플로우
│   ├── workflow-engine.ts
│   ├── workflow-parser.ts
│   └── workflow-schema.ts
└── quality/
    └── quality-executor.ts
```

**Routing Strategies:**
- `round-robin`: 순차 분배
- `least-loaded`: 최소 부하 에이전트
- `random`: 무작위 선택
- `capability`: 능력 기반 매칭
- `priority`: 우선순위 기반

### 3.2 Workflow Engine
```
src/core/workflow/
├── workflow-engine.ts        # 메인 엔진 (IWorkflowEngine)
├── workflow-definition.ts    # 워크플로우 정의
├── workflow-templates.ts     # 사전 정의 템플릿
├── state-machine.ts          # 상태 머신
├── step-executor.ts          # 스텝 실행기
├── progress-tracker.ts       # 진행률 추적
└── rollback-manager.ts       # 롤백 관리
```

### 3.3 Tool System
```
src/core/tools/
├── base-tool.ts              # 기본 도구 클래스
├── tool-registry.ts          # 도구 레지스트리
├── tool-executor.ts          # 도구 실행기
├── lsp/                      # Language Server Protocol (5개)
│   ├── lsp-client.ts
│   ├── lsp-definition.tool.ts
│   ├── lsp-references.tool.ts
│   ├── lsp-hover.tool.ts
│   ├── lsp-document-symbols.tool.ts
│   └── lsp-workspace-symbols.tool.ts
├── ast-grep/                 # AST 기반 도구 (4개)
│   ├── ast-grep-client.ts
│   ├── ast-search.tool.ts
│   ├── ast-lint.tool.ts
│   └── ast-rewrite.tool.ts
├── git/                      # Git 명령어 (12개)
│   ├── git-client.ts
│   ├── git-add.tool.ts
│   ├── git-branch.tool.ts
│   ├── git-checkout.tool.ts
│   ├── git-commit.tool.ts
│   ├── git-diff.tool.ts
│   ├── git-log.tool.ts
│   ├── git-merge.tool.ts
│   ├── git-pull.tool.ts
│   ├── git-push.tool.ts
│   ├── git-reset.tool.ts
│   ├── git-stash.tool.ts
│   └── git-status.tool.ts
├── shell/                    # Shell 실행 (7개)
│   ├── shell-client.ts
│   ├── shell-command.tool.ts
│   ├── shell-exec.tool.ts
│   ├── shell-pipe.tool.ts
│   ├── shell-script.tool.ts
│   ├── shell-env.tool.ts
│   ├── shell-which.tool.ts
│   └── shell-validate.tool.ts
├── file/                     # 파일 작업 (10개)
│   ├── file-client.ts
│   ├── file-read.tool.ts
│   ├── file-write.tool.ts
│   ├── file-delete.tool.ts
│   ├── file-copy.tool.ts
│   ├── file-move.tool.ts
│   ├── file-mkdir.tool.ts
│   ├── file-list.tool.ts
│   ├── file-search.tool.ts
│   ├── file-exists.tool.ts
│   └── file-stats.tool.ts
├── mcp/                      # Model Context Protocol (5개)
│   ├── mcp-client.ts
│   ├── mcp-manager.ts
│   ├── stdio-transport.ts
│   ├── websocket-transport.ts
│   └── http-transport.ts
└── web-search/               # 웹 검색 (3개)
    ├── web-search-client.ts
    ├── web-search.tool.ts
    ├── web-fetch.tool.ts
    └── web-crawl.tool.ts
```

### 3.4 Team System
```
src/core/teams/
├── base-team.ts              # 팀 추상 클래스
├── team-registry.ts          # 팀 레지스트리
├── team-types.ts             # 팀 타입 정의
├── development/              # 개발 팀
│   ├── development-team.ts   # 부모 개발 팀
│   ├── frontend-team/        # 프론트엔드 팀 (리팩토링됨)
│   │   ├── frontend-team.ts
│   │   ├── frontend-team.config.ts
│   │   ├── frontend-team.roles.ts
│   │   ├── frontend-team.types.ts
│   │   ├── templates/        # 컴포넌트 템플릿
│   │   ├── test-templates/   # 테스트 템플릿
│   │   └── utils/            # 유틸리티
│   ├── backend-team/         # 백엔드 팀 (리팩토링됨)
│   │   ├── backend-team.ts
│   │   ├── backend-team.config.ts
│   │   ├── backend-team.roles.ts
│   │   ├── backend-team.types.ts
│   │   ├── templates/        # API/Service 템플릿
│   │   ├── test-templates/   # 테스트 템플릿
│   │   └── docs/             # 문서 템플릿
│   └── fullstack-team/       # 풀스택 팀 (리팩토링됨)
├── qa/                       # QA 팀
│   └── qa-team/              # QA 팀 (리팩토링됨)
│       ├── qa-team.ts
│       ├── qa-team.config.ts
│       ├── qa-team.roles.ts
│       └── utils/
├── planning/                 # 기획 팀
│   └── planning-team.ts
└── code-quality/             # 코드 품질 팀
    └── code-quality-team.ts
```

### 3.5 Hook System
```
src/core/hooks/
├── base-hook.ts              # 기본 훅 클래스
├── hook-registry.ts          # 훅 레지스트리
├── hook-executor.ts          # 훅 실행기
├── session-recovery/         # 세션 복구 훅
├── token-optimizer/          # 토큰 최적화 훅
├── context-monitor/          # 컨텍스트 모니터링 훅
├── code-quality/             # 코드 품질 훅
├── think-mode/               # Think 모드 훅
├── comment-checker/          # 주석 검사 훅
├── todo-enforcer/            # TODO 강제 훅
├── auto-compaction/          # 자동 압축 훅
└── mcp-health-monitor/       # MCP 헬스 모니터 훅
```

### 3.6 Specialized Agents
```
src/core/agents/specialized/
├── coder-agent.ts            # 코드 생성/수정
├── reviewer-agent.ts         # 코드 리뷰
├── architect-agent.ts        # 설계, 모듈 분해
├── tester-agent.ts           # TDD, 테스트 작성
├── docwriter-agent.ts        # 문서 생성
├── explorer-agent.ts         # 코드베이스 탐색
└── librarian-agent.ts        # 공식 문서 조회
```

### 3.7 Kernel System (Agent OS)
```
src/core/kernel/
├── scheduler.ts              # 태스크 스케줄링
├── process-manager.ts        # 프로세스 관리
├── resource-manager.ts       # 리소스 관리
└── security-module.ts        # 보안 모듈
```

### 3.8 Security System
```
src/core/security/
├── audit/                    # 감사 로그
│   ├── audit.manager.ts
│   └── audit.interface.ts
├── permission/               # 권한 관리
│   ├── permission.manager.ts
│   └── permission.interface.ts
├── plugin/                   # 플러그인 보안
│   └── plugin-security.manager.ts
├── scanning/                 # 코드 스캐닝
│   ├── code-scanner.ts
│   ├── dependency-scanner.ts
│   ├── secret-detector.ts
│   └── static-analyzer.ts
├── secret/                   # 시크릿 관리
│   └── secret.manager.ts
└── trust/                    # 신뢰 관리
    └── trust.manager.ts
```

### 3.9 Enterprise Features
```
src/core/enterprise/
├── sso/                      # SSO 통합
│   └── sso.manager.ts
├── team/                     # 팀 관리
│   └── team.manager.ts
├── multi-repo/               # 멀티 레포지토리
│   └── multi-repo.manager.ts
├── workflow/                 # 엔터프라이즈 워크플로우
│   └── workflow.manager.ts
└── analytics/                # 분석
    └── analytics.manager.ts
```

### 3.10 Quality System
```
src/core/quality/
├── completion-detector.ts    # 완료 감지
└── checks/
    ├── code-quality-checker.ts
    ├── security-checker.ts
    ├── test-coverage-checker.ts
    ├── performance-checker.ts
    └── documentation-checker.ts
```

---

## 4. API Layer

### 4.1 REST API
```
src/api/routes/
├── base.router.ts            # 기본 라우터
├── agents.router.ts          # /api/agents
├── workflows.router.ts       # /api/workflows
├── tools.router.ts           # /api/tools
└── hooks.router.ts           # /api/hooks
```

### 4.2 GraphQL API
```
src/api/graphql/
├── schema/
│   └── schema.graphql        # GraphQL 스키마
├── resolvers/
│   ├── query.resolver.ts
│   ├── mutation.resolver.ts
│   └── subscription.resolver.ts
└── plugins/
    └── mercurius.plugin.ts
```

### 4.3 Authentication
```
src/api/auth/
├── middlewares/
│   ├── auth.middleware.ts    # JWT 인증
│   └── rbac.middleware.ts    # RBAC 권한
└── services/
    ├── jwt.service.ts
    └── api-key.service.ts
```

### 4.4 WebSocket Server
```
src/api/server/
├── api-server.ts             # Fastify REST 서버
└── ws-server.ts              # WebSocket 서버
```

---

## 5. LLM Integration

### 5.1 API Clients
```typescript
// Claude, OpenAI, Gemini API 클라이언트
interface ILLMClient {
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  stream?(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<LLMStreamChunk>;
}

class ClaudeClient extends BaseLLMClient { ... }
class OpenAIClient extends BaseLLMClient { ... }
class GeminiClient extends BaseLLMClient { ... }
class ResilientLLMClient implements ILLMClient { ... }  // 장애 복구 래퍼
```

### 5.2 CLI Clients
```typescript
// 로컬 CLI 도구 통합
class ClaudeCLIClient extends BaseCLIClient { ... }   // claude CLI
class CodexCLIClient extends BaseCLIClient { ... }    // codex CLI
class GeminiCLIClient extends BaseCLIClient { ... }   // gemini CLI
class OllamaClient implements ILLMClient { ... }      // ollama
```

---

## 6. DI Container

### 6.1 Core Tokens
```typescript
const TOKENS = {
  // Infrastructure
  NatsClient: createToken<INatsClient>('NatsClient'),
  Database: createToken<IDatabase>('Database'),
  EventBus: createToken<IEventBus>('EventBus'),

  // Agents
  AgentRegistry: createToken<IAgentRegistry>('AgentRegistry'),
  AgentFactory: createToken<IAgentFactory>('AgentFactory'),
  CoderAgent: createToken<IAgent>('CoderAgent'),
  ReviewerAgent: createToken<IAgent>('ReviewerAgent'),
  ArchitectAgent: createToken<IAgent>('ArchitectAgent'),

  // Services
  OrchestratorService: createToken<IOrchestratorService>('OrchestratorService'),
  WorkflowEngine: createToken<IWorkflowEngine>('WorkflowEngine'),
  ToolRegistry: createToken<IToolRegistry>('ToolRegistry'),
  HookRegistry: createToken<IHookRegistry>('HookRegistry'),
  TeamRegistry: createToken<ITeamRegistry>('TeamRegistry'),

  // LLM
  LLMClient: createToken<ILLMClient>('LLMClient'),
};
```

### 6.2 Registration Pattern
```typescript
container.registerSingleton(TOKENS.EventBus, EventBus);
container.registerSingleton(TOKENS.NatsClient, NatsClient);
container.registerSingleton(TOKENS.AgentRegistry, AgentRegistry);
container.registerTransient(TOKENS.CoderAgent, CoderAgent);
```

---

## 7. Event System

### 7.1 Event Types
```typescript
enum EventType {
  // Agent Events
  AGENT_STARTED = 'agent.started',
  AGENT_STOPPED = 'agent.stopped',
  AGENT_ERROR = 'agent.error',

  // Task Events
  TASK_CREATED = 'task.created',
  TASK_ASSIGNED = 'task.assigned',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',

  // Workflow Events
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_STEP_COMPLETED = 'workflow.step.completed',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',

  // Team Events
  TEAM_TASK_RECEIVED = 'team.task.received',
  TEAM_TASK_COMPLETED = 'team.task.completed',

  // Hook Events
  HOOK_EXECUTED = 'hook.executed',
  HOOK_FAILED = 'hook.failed',
}
```

### 7.2 Event Bus
```typescript
interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(type: EventType, handler: EventHandler): Subscription;
  subscribeAll(handler: EventHandler): Subscription;
  unsubscribe(subscription: Subscription): void;
}
```

---

## 8. Error Recovery

### 8.1 Strategies
- **Retry**: 지수 백오프를 사용한 재시도
- **Circuit Breaker**: 연속 실패 시 차단
- **Fallback**: 대체 동작 제공
- **Timeout**: 시간 초과 처리
- **Composite**: 전략 조합

### 8.2 Usage
```typescript
const strategy = new CompositeStrategy([
  new RetryStrategy({ maxRetries: 3, backoffMultiplier: 2 }),
  new CircuitBreakerStrategy({ threshold: 5, resetTimeout: 30000 }),
  new FallbackStrategy({ fallback: defaultValue }),
  new TimeoutStrategy({ timeout: 5000 }),
]);

const result = await strategy.execute(operation);
```

---

## 9. Configuration

### 9.1 Environment Variables
```bash
# Required
NATS_URL=nats://localhost:4222
DATABASE_URL=postgresql://user:pass@localhost:5432/db
GITHUB_TOKEN=ghp_...

# LLM API
LLM_PROVIDER=claude              # claude | openai | gemini
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# LLM CLI (Optional)
CLAUDE_CLI_PATH=/usr/local/bin/claude
CODEX_CLI_PATH=/usr/local/bin/codex
OLLAMA_HOST=http://localhost:11434

# Server
HEALTH_PORT=3000
WEBHOOK_PORT=3001
API_PORT=3002

# Optional
LOG_LEVEL=info
NODE_ENV=production
```

### 9.2 Config Schema
```typescript
interface AppConfig {
  nats: NatsConfig;
  database: DatabaseConfig;
  llm: LLMConfig;
  agents: AgentConfig[];
  hooks: HookConfig[];
  teams: TeamConfig[];
  api: APIConfig;
  security: SecurityConfig;
}
```

---

## 10. Related Documents

- [Overview](./OVERVIEW.md) - 아키텍처 개요
- [Module Reference](./MODULE_REFERENCE.md) - 모듈 상세
- [CLI Usage](../03-guides/CLI_USAGE.md) - CLI 사용법
- [Deployment](../03-guides/DEPLOYMENT.md) - 배포 가이드
