# System Design

> 핵심 모듈 및 컴포넌트 설계

**Last Updated**: 2026-02-11

## 1. Directory Structure

```
src/
├── core/                        # 핵심 도메인
│   ├── benchmark/               # SWE-bench 스타일 벤치마크 러너
│   ├── brownfield/              # 브라운필드 프로젝트 분석
│   ├── checkpoint/              # 체크포인트 프로토콜
│   ├── context/                 # 컨텍스트 관리 (TokenBudgetManager 등)
│   ├── deep-worker/             # 딥 워커 (PreExploration, SelfPlanning, RetryStrategy, TodoEnforcer)
│   ├── di/                      # 의존성 주입
│   ├── docs-generator/          # 문서 생성기 (HLD/MLD/LLD)
│   ├── dynamic-prompts/         # 동적 프롬프트 (PromptRegistry, PromptRenderer)
│   ├── hooks/                   # 훅 시스템 (11개 훅)
│   │   ├── base-hook.ts
│   │   ├── hook-registry.ts
│   │   ├── hook-executor.ts
│   │   └── ...                  # confidence-check, self-check, error-learning, context-optimizer 등
│   ├── hud/                     # HUD 대시보드 (MetricsCollector, HUDDashboard)
│   ├── instinct-transfer/       # 인스턴트 전이 학습
│   ├── interfaces/              # 공통 인터페이스
│   ├── learning/                # 학습 시스템 (ReflexionPattern, InstinctStore, SolutionsCache)
│   ├── orchestrator/            # 오케스트레이터
│   │   ├── ceo-orchestrator.ts  # CEO 오케스트레이터
│   │   ├── base-team-agent.ts   # 기본 팀 에이전트
│   │   ├── task-router.ts       # 태스크 라우팅 (5가지 전략)
│   │   ├── orchestrator-runner.ts
│   │   ├── agent-factory.ts     # 에이전트 팩토리
│   │   ├── integration-setup.ts # 통합 설정
│   │   ├── agents/              # 팀 에이전트 (4개)
│   │   │   ├── planning-agent.ts
│   │   │   ├── development-agent.ts
│   │   │   ├── qa-agent.ts
│   │   │   └── code-quality-agent.ts
│   │   ├── llm/                 # 팀별 LLM 프롬프트
│   │   ├── workflow/            # 워크플로우 실행
│   │   └── quality/             # 품질 실행기
│   ├── protocols/               # ACP 메시지 버스
│   ├── security/                # 프로그레시브 샌드박스 (4레벨)
│   ├── services/                # ServiceRegistry (싱글톤 라이프사이클)
│   ├── session/                 # JSONL 세션 영속화 + 복구
│   ├── skills/                  # 조합형 스킬 (SkillRegistry, SkillPipeline, 4개 스킬)
│   ├── validation/              # 검증 (ConfidenceChecker, SelfCheckProtocol, GoalBackwardVerifier)
│   └── workspace/               # 워크스페이스 관리
│       ├── workspace-manager.ts
│       ├── document-queue.ts    # 문서 기반 작업 큐
│       └── task-document.ts
│
├── api/                         # API Gateway
│   ├── gateway.ts               # HTTP ↔ ACP 브릿지
│   └── index.ts
│
├── dx/                          # Developer Experience
│   └── error-recovery/          # 에러 복구 전략 (Retry, CircuitBreaker, Fallback, Timeout)
│
├── shared/                      # 공유 모듈
│   ├── llm/                     # LLM 클라이언트
│   │   ├── base-client.ts       # ILLMClient 인터페이스
│   │   ├── claude-client.ts
│   │   ├── openai-client.ts
│   │   ├── gemini-client.ts
│   │   ├── resilient-client.ts  # 장애 복구 래퍼
│   │   ├── tiered-router.ts     # 티어 기반 모델 라우팅
│   │   ├── cost-tracker.ts      # 비용 추적
│   │   └── cli/                 # CLI 클라이언트 (Claude, Codex, Gemini, Ollama)
│   ├── ci/                      # CI 체커
│   ├── config/                  # Zod 기반 설정 관리
│   ├── errors/                  # 커스텀 에러 계층
│   └── logging/                 # Winston 기반 구조화된 로거
│
└── cli/                         # CLI 인터페이스
    ├── index.ts
    ├── autonomous.ts
    └── interactive.ts
```

---

## 2. Core Interfaces

### 2.1 Team Agent Interface
```typescript
// 팀 에이전트는 TeamType('planning' | 'development' | 'qa')으로 구분
// AgentType enum은 제거됨 — 팀 기반 아키텍처로 전환

interface BaseTeamAgent extends EventEmitter {
  team: TeamType;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  processTask(task: TaskDocument): Promise<TaskResult>;
  subscribeToInbox(options: SubscriptionOptions): void;
}

// 에이전트 팩토리 (agent-factory.ts)
function createAndRegisterAgents(
  config: AgentFactoryConfig,
  orchestrator: CEOOrchestrator
): Promise<{ planning; development; qa }>;
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

### 3.6 Security System (Progressive Sandbox)
```
src/core/security/
├── interfaces/               # 샌드박스 인터페이스
├── sandbox-escalation.ts     # 4레벨 프로그레시브 샌드박스
└── index.ts
```

**Sandbox Levels:**
- Level 0: Read-only (파일 읽기만 허용)
- Level 1: Limited write (제한된 쓰기)
- Level 2: Shell access (셸 실행 허용)
- Level 3: Full access (전체 접근)

### 3.7 New Modules (P2-P3)
```
src/core/skills/              # 조합형 스킬 시스템
├── skill-registry.ts         # 스킬 레지스트리
├── skill-pipeline.ts         # 스킬 파이프라인
└── skills/                   # 4개 내장 스킬

src/core/deep-worker/         # 딥 워커 시스템
├── pre-exploration.ts        # 사전 탐색
├── self-planning.ts          # 자기 계획
├── retry-strategy.ts         # 재시도 전략
├── todo-enforcer.ts          # TODO 강제
└── deep-worker.ts            # 통합 딥 워커

src/core/protocols/           # ACP 프로토콜
├── acp-message-bus.ts        # 에이전트-프론트엔드 통신 버스
└── index.ts

src/core/hud/                 # HUD 대시보드
├── metrics-collector.ts      # 메트릭 수집
└── hud-dashboard.ts          # 대시보드

src/core/benchmark/           # 벤치마크 시스템
└── benchmark-runner.ts       # SWE-bench 스타일 러너

src/core/docs-generator/      # 문서 생성기
└── docs-generator.ts         # HLD/MLD/LLD 자동 생성

src/core/brownfield/          # 브라운필드 분석
└── brownfield-analyzer.ts    # 기존 프로젝트 분석

src/core/instinct-transfer/   # 인스턴트 전이
└── instinct-transfer.ts      # 프로젝트 간 학습 전이

src/core/dynamic-prompts/     # 동적 프롬프트
├── prompt-registry.ts        # 프롬프트 레지스트리
└── prompt-renderer.ts        # 프롬프트 렌더러

src/core/checkpoint/          # 체크포인트
└── checkpoint-manager.ts     # 단계별 체크포인트 관리
```

---

## 4. API Layer

### 4.1 API Gateway
```
src/api/
├── gateway.ts               # APIGateway: HTTP ↔ ACP 메시지 브릿지
└── index.ts                 # 공개 API 재export
```

**Gateway 기능:**
- Task 제출 (correlationId 추적)
- 시스템 헬스 체크
- 상태 브로드캐스트
- 이벤트 구독 관리

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

### 6.1 ServiceRegistry (싱글톤 패턴)
```typescript
// ServiceRegistry: 모듈 라이프사이클 관리
const registry = ServiceRegistry.getInstance();
await registry.initialize({ workspaceDir, emitter });

// 팩토리 패턴으로 모듈 생성
const reflexion = createReflexionPattern({ basePath });
const skillRegistry = createSkillRegistry();
const checkpoint = createCheckpointManager({ agentId });
```

### 6.2 Integration Setup
```typescript
// integration-setup.ts: 피처 플래그 기반 통합
await initializeIntegrations(
  { enableValidation: true, enableLearning: true, enableContextManagement: true },
  hookRegistry,
  workspaceDir,
  emitter
);
// → ConfidenceCheckHook, SelfCheckHook, ErrorLearningHook, ContextOptimizerHook 등록
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
