# System Architecture: CodeAvengers

> SOLID 원칙 기반의 확장 가능한 멀티 에이전트 시스템 아키텍처

---

## 1. 아키텍처 개요

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Layer                                   │
├─────────────┬─────────────┬─────────────────────────────────────────────┤
│    CLI      │  Desktop    │              Web Dashboard                   │
│  (Current)  │  (Tauri)    │              (Next.js)                       │
└──────┬──────┴──────┬──────┴─────────────────┬───────────────────────────┘
       │             │                         │
       └─────────────┴────────────┬────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                          API Gateway                                     │
│                    (REST / GraphQL / tRPC)                               │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                       Core Domain Layer                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Orchestrator│  │   Project   │  │   Agent     │  │   Workflow  │    │
│  │   Service   │  │   Service   │  │   Service   │  │   Service   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼────────────┘
          │                │                │                │
┌─────────▼────────────────▼────────────────▼────────────────▼────────────┐
│                       Agent Layer                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Architect │ │  Coder   │ │ Reviewer │ │  Tester  │ │DocWriter │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       └────────────┴────────────┴────────────┴────────────┘             │
└───────────────┬─────────────────────────────────────┬───────────────────┘
                │                                     │
┌───────────────▼─────────────────┐   ┌───────────────▼───────────────────┐
│         A2A Protocol Layer       │   │        DX Enhancement Layer       │
├─────────────────────────────────┤   ├───────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐   │   │  ┌───────────┐  ┌───────────┐    │
│  │A2A Server │  │A2A Client │   │   │  │  Token    │  │  Error    │    │
│  │(Incoming) │  │(Outgoing) │   │   │  │  Budget   │  │ Recovery  │    │
│  └─────┬─────┘  └─────┬─────┘   │   │  └───────────┘  └───────────┘    │
│        │              │         │   │  ┌───────────┐  ┌───────────┐    │
│  ┌─────▼──────────────▼─────┐   │   │  │  Session  │  │   MCP     │    │
│  │      Agent Card          │   │   │  │  Manager  │  │  Monitor  │    │
│  │      Registry            │   │   │  └───────────┘  └───────────┘    │
│  └──────────────────────────┘   │   │  ┌───────────┐  ┌───────────┐    │
└─────────────────────────────────┘   │  │  Debug    │  │   Test    │    │
                │                     │  │  Toolkit  │  │ Framework │    │
                │                     │  └───────────┘  └───────────┘    │
                │                     └───────────────────────────────────┘
                │                                     │
┌───────────────▼─────────────────────────────────────▼───────────────────┐
│                      Tool & Plugin Layer                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │   LSP   │ │AST-Grep │ │   Git   │ │  Shell  │ │   MCP   │           │
│  │ Tools   │ │  Tools  │ │  Tools  │ │  Tools  │ │ Servers │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                     Infrastructure Layer                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    NATS     │  │ PostgreSQL  │  │    Redis    │  │   GitHub    │    │
│  │   Broker    │  │     DB      │  │    Cache    │  │     API     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 SOLID 원칙 적용

| 원칙 | 적용 방법 |
|------|-----------|
| **S**ingle Responsibility | 각 서비스/에이전트는 단일 책임 |
| **O**pen/Closed | 플러그인/훅으로 확장, 코어 수정 불필요 |
| **L**iskov Substitution | 에이전트 인터페이스 일관성 |
| **I**nterface Segregation | 역할별 작은 인터페이스 |
| **D**ependency Inversion | 추상화 의존, 구현체 주입 |

---

## 2. 레이어별 상세 설계

### 2.1 Client Layer

```typescript
// 공통 인터페이스로 CLI, Desktop, Web 통합
interface IClientAdapter {
  connect(): Promise<void>;
  sendCommand(cmd: Command): Promise<Response>;
  subscribe(event: EventType, handler: EventHandler): void;
  disconnect(): Promise<void>;
}

// CLI 구현
class CLIAdapter implements IClientAdapter { ... }

// Desktop 구현 (Tauri IPC)
class DesktopAdapter implements IClientAdapter { ... }

// Web 구현 (WebSocket)
class WebAdapter implements IClientAdapter { ... }
```

### 2.2 Core Domain Layer

#### 2.2.1 Orchestrator Service
```typescript
interface IOrchestratorService {
  // 워크플로우 실행
  executeWorkflow(workflow: Workflow): Promise<WorkflowResult>;

  // 에이전트 조율
  coordinateAgents(task: Task): Promise<void>;

  // 상태 모니터링
  getStatus(): OrchestratorStatus;
}
```

#### 2.2.2 Project Service
```typescript
interface IProjectService {
  // 프로젝트 생성/관리
  createProject(config: ProjectConfig): Promise<Project>;

  // 문서 분석
  analyzeDocuments(docs: Document[]): Promise<ModuleBreakdown>;

  // 모듈 생성
  generateModules(breakdown: ModuleBreakdown): Promise<Module[]>;
}
```

#### 2.2.3 Agent Service
```typescript
interface IAgentService {
  // 에이전트 등록/관리
  registerAgent(agent: IAgent): void;

  // 작업 할당
  assignTask(agentType: AgentType, task: Task): Promise<TaskResult>;

  // 에이전트 상태
  getAgentHealth(agentId: string): HealthStatus;
}
```

#### 2.2.4 Workflow Service
```typescript
interface IWorkflowService {
  // 워크플로우 정의
  createWorkflow(definition: WorkflowDefinition): Workflow;

  // 단계 실행
  executeStep(step: WorkflowStep): Promise<StepResult>;

  // 진행 상태
  getProgress(workflowId: string): WorkflowProgress;
}
```

### 2.3 Agent Layer

#### 2.3.1 Base Agent Interface
```typescript
interface IAgent {
  // 식별
  readonly id: string;
  readonly type: AgentType;

  // 생명주기
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  // 작업 처리
  processTask(task: Task): Promise<TaskResult>;

  // 상태
  getHealth(): HealthStatus;
  getCapabilities(): AgentCapability[];
}
```

#### 2.3.2 Agent Types
```typescript
enum AgentType {
  ARCHITECT = 'architect',
  CODER = 'coder',
  REVIEWER = 'reviewer',
  TESTER = 'tester',
  DOC_WRITER = 'doc_writer',
  EXPLORER = 'explorer',
  LIBRARIAN = 'librarian',
  DESIGNER = 'designer',
  SECURITY_AUDITOR = 'security_auditor',
}
```

#### 2.3.3 Agent Factory
```typescript
interface IAgentFactory {
  createAgent(type: AgentType, config: AgentConfig): IAgent;
  registerAgentClass(type: AgentType, agentClass: AgentConstructor): void;
}

// 의존성 주입으로 확장
class AgentFactory implements IAgentFactory {
  private registry: Map<AgentType, AgentConstructor> = new Map();

  registerAgentClass(type: AgentType, agentClass: AgentConstructor): void {
    this.registry.set(type, agentClass);
  }

  createAgent(type: AgentType, config: AgentConfig): IAgent {
    const AgentClass = this.registry.get(type);
    if (!AgentClass) throw new Error(`Unknown agent type: ${type}`);
    return new AgentClass(config);
  }
}
```

### 2.4 A2A Protocol Layer

> Google A2A (Agent-to-Agent) 프로토콜을 통한 외부 에이전트 협업 지원

#### 2.4.1 A2A Architecture Overview
```
                    ┌─────────────────────────────────────┐
                    │        External A2A Agents          │
                    │  (Claude, GPT, Gemini, Custom...)   │
                    └────────────────┬────────────────────┘
                                     │
                    ┌────────────────▼────────────────────┐
                    │           A2A Server                │
                    │  - Agent Discovery                  │
                    │  - Task Delegation                  │
                    │  - Protocol Translation             │
                    └────────────────┬────────────────────┘
                                     │
     ┌───────────────────────────────┼───────────────────────────────┐
     │                               │                               │
┌────▼────┐                    ┌─────▼─────┐                   ┌─────▼─────┐
│Agent    │                    │  Agent    │                   │   Agent   │
│Card     │                    │  Router   │                   │   Queue   │
│Registry │                    │           │                   │           │
└─────────┘                    └───────────┘                   └───────────┘
```

#### 2.4.2 A2A Server Interface
```typescript
interface IA2AServer {
  // 서버 관리
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  getStatus(): A2AServerStatus;

  // 에이전트 등록
  registerAgent(agent: IAgent): void;
  unregisterAgent(agentId: string): void;
  getRegisteredAgents(): AgentCard[];

  // 태스크 처리
  handleTask(task: A2ATask): Promise<A2ATaskResult>;
  handleTaskStream(task: A2ATask): AsyncGenerator<A2ATaskUpdate>;
  getTaskStatus(taskId: string): A2ATaskStatus;
  cancelTask(taskId: string): Promise<boolean>;
}

interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: AgentCapability[];
  skills: AgentSkill[];
  authentication?: AuthenticationInfo;
  defaultInputModes: InputMode[];
  defaultOutputModes: OutputMode[];
}
```

#### 2.4.3 A2A Client Interface
```typescript
interface IA2AClient {
  // 연결 관리
  connect(url: string, options?: ConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // 에이전트 탐색
  discoverAgents(): Promise<AgentCard[]>;
  getAgentCard(agentId: string): Promise<AgentCard>;

  // 태스크 위임
  delegateTask(agentId: string, task: A2ATask): Promise<A2ATaskResult>;
  delegateTaskStream(agentId: string, task: A2ATask): AsyncGenerator<A2ATaskUpdate>;

  // 협업
  collaborate(agents: string[], task: A2ATask): Promise<A2ACollaborationResult>;
}
```

#### 2.4.4 MCP + A2A Hybrid Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                        CodeAvengers Agent                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────┐          ┌─────────────────┐                 │
│   │   MCP Client    │          │   A2A Client    │                 │
│   │   (Tools)       │          │   (Agents)      │                 │
│   └────────┬────────┘          └────────┬────────┘                 │
│            │                            │                          │
│   ┌────────▼──────────────────────────▼────────┐                  │
│   │            Hybrid Orchestrator              │                  │
│   │  - Route to MCP (tool requests)            │                  │
│   │  - Route to A2A (agent collaboration)      │                  │
│   │  - Coordinate mixed workflows              │                  │
│   └─────────────────────────────────────────────┘                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
            │                             │
            ▼                             ▼
    ┌───────────────┐            ┌───────────────┐
    │  MCP Servers  │            │ External A2A  │
    │  (Context7,   │            │    Agents     │
    │   Exa, etc.)  │            │               │
    └───────────────┘            └───────────────┘
```

---

### 2.5 DX Enhancement Layer

> 개발자 경험(Developer Experience) 향상을 위한 핵심 유틸리티

#### 2.5.1 DX Layer Overview
```
┌─────────────────────────────────────────────────────────────────────┐
│                      DX Enhancement Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐│
│   │  Token Budget   │    │ Error Recovery  │    │  Session        ││
│   │    Manager      │    │    Library      │    │  Manager        ││
│   └─────────────────┘    └─────────────────┘    └─────────────────┘│
│                                                                      │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐│
│   │   MCP Health    │    │    Debug        │    │   Agent Test    ││
│   │    Monitor      │    │   Toolkit       │    │   Framework     ││
│   └─────────────────┘    └─────────────────┘    └─────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.5.2 Token Budget Manager
```typescript
interface ITokenBudgetManager {
  // 예산 생성/관리
  createBudget(config: TokenBudgetConfig): TokenBudget;
  getBudget(budgetId: string): TokenBudget | undefined;
  deleteBudget(budgetId: string): boolean;

  // 사용량 추적
  recordUsage(usage: TokenUsage): void;
  checkBudget(budgetId?: string): BudgetStatus;
  getRemainingBudget(budgetId?: string): number;

  // 예산 내 작업 실행
  withBudget<T>(budget: TokenBudget, operation: () => Promise<T>): Promise<T>;

  // 경고/초과 이벤트
  onWarning(callback: (status: BudgetStatus) => void): Subscription;
  onExceeded(callback: (status: BudgetStatus) => void): Subscription;
}

interface TokenBudgetConfig {
  maxTokens: number;
  warningThreshold?: number;  // 0.0 - 1.0 (기본값: 0.8)
  resetInterval?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'never';
  scope?: 'global' | 'agent' | 'task';
}
```

#### 2.5.3 Error Recovery Library
```typescript
interface IErrorRecovery {
  // Retry Strategy
  retry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;

  // Circuit Breaker
  withCircuitBreaker<T>(operation: () => Promise<T>, options?: CircuitBreakerOptions): Promise<T>;

  // Fallback
  withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T>;

  // 복합 전략
  withRecovery<T>(operation: () => Promise<T>, strategies: RecoveryStrategy[]): Promise<T>;
}

interface RetryOptions {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay?: number;
  retryOn?: (error: Error) => boolean;
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  onStateChange?: (state: CircuitState) => void;
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
```

#### 2.5.4 MCP Health Monitor
```typescript
interface IMCPHealthMonitor {
  // 상태 조회
  getServerStatus(serverId: string): MCPServerStatus;
  getAllServerStatuses(): Map<string, MCPServerStatus>;

  // 헬스체크
  checkHealth(serverId: string): Promise<HealthCheckResult>;
  checkAllHealth(): Promise<Map<string, HealthCheckResult>>;

  // 자동 복구
  enableAutoRecovery(serverId: string, options?: RecoveryOptions): void;
  disableAutoRecovery(serverId: string): void;

  // 이벤트
  onStatusChange(callback: (serverId: string, status: MCPServerStatus) => void): Subscription;
  onHealthWarning(callback: (serverId: string, warning: HealthWarning) => void): Subscription;
}

interface MCPServerStatus {
  serverId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
}
```

#### 2.5.5 Session Manager
```typescript
interface ISessionManager {
  // 세션 생명주기
  createSession(config?: SessionConfig): Promise<Session>;
  getSession(sessionId: string): Session | undefined;
  getCurrentSession(): Session | undefined;
  endSession(sessionId: string): Promise<void>;

  // 상태 관리
  saveState(sessionId: string): Promise<SessionSnapshot>;
  restoreState(snapshot: SessionSnapshot): Promise<Session>;
  getSnapshots(sessionId: string): SessionSnapshot[];

  // 체크포인트
  createCheckpoint(name?: string): Promise<Checkpoint>;
  restoreFromCheckpoint(checkpointId: string): Promise<void>;
  listCheckpoints(): Checkpoint[];

  // 세션 마이그레이션
  exportSession(sessionId: string): Promise<ExportedSession>;
  importSession(data: ExportedSession): Promise<Session>;
}
```

#### 2.5.6 Agent Test Framework
```typescript
interface IAgentTestRunner {
  // 테스트 실행
  runTest(test: AgentTest): Promise<AgentTestResult>;
  runSuite(suite: AgentTestSuite): Promise<AgentTestSuiteResult>;
  runScenario(scenario: AgentScenario): Promise<ScenarioResult>;

  // Mock 설정
  setMockLLM(mock: IMockLLMClient): void;
  setMockTools(mocks: Map<string, MockTool>): void;
}

interface IMockLLMClient extends ILLMClient {
  // Mock 응답 설정
  setResponse(pattern: string | RegExp, response: MockResponse): void;
  setResponseSequence(responses: MockResponse[]): void;

  // 기록 검증
  getCallHistory(): LLMCallRecord[];
  expectCall(matcher: CallMatcher): CallExpectation;
  verifyAllExpectations(): void;

  // 시뮬레이션
  simulateError(error: Error): void;
  simulateLatency(ms: number): void;
}
```

---

### 2.6 Tool & Plugin Layer

#### 2.6.1 Tool Interface
```typescript
interface ITool {
  readonly name: string;
  readonly description: string;
  readonly schema: ToolSchema;

  execute(params: ToolParams): Promise<ToolResult>;
  validate(params: ToolParams): ValidationResult;
}
```

#### 2.6.2 Tool Registry
```typescript
interface IToolRegistry {
  register(tool: ITool): void;
  unregister(name: string): void;
  get(name: string): ITool | undefined;
  getAll(): ITool[];
  getByCategory(category: ToolCategory): ITool[];
}
```

#### 2.4.3 Plugin System
```typescript
interface IPlugin {
  readonly name: string;
  readonly version: string;
  readonly trustLevel: TrustLevel;

  install(context: PluginContext): Promise<void>;
  uninstall(): Promise<void>;
  getTools(): ITool[];
  getAgents(): IAgent[];
  getHooks(): IHook[];
}

enum TrustLevel {
  UNTRUSTED = 0,    // 샌드박스 실행
  VERIFIED = 1,     // 검증됨
  TRUSTED = 2,      // 완전 신뢰
  BUILTIN = 3,      // 내장
}
```

### 2.5 Hook System

#### 2.5.1 Hook Interface
```typescript
interface IHook {
  readonly name: string;
  readonly event: HookEvent;
  readonly priority: number;

  execute(context: HookContext): Promise<HookResult>;
  shouldRun(context: HookContext): boolean;
}

enum HookEvent {
  // 에이전트 생명주기
  AGENT_START = 'agent:start',
  AGENT_STOP = 'agent:stop',

  // 작업 생명주기
  TASK_BEFORE = 'task:before',
  TASK_AFTER = 'task:after',
  TASK_ERROR = 'task:error',

  // 도구 생명주기
  TOOL_BEFORE = 'tool:before',
  TOOL_AFTER = 'tool:after',

  // 워크플로우
  WORKFLOW_START = 'workflow:start',
  WORKFLOW_STEP = 'workflow:step',
  WORKFLOW_END = 'workflow:end',

  // Git 작업
  GIT_COMMIT = 'git:commit',
  GIT_PUSH = 'git:push',
  GIT_PR_CREATE = 'git:pr:create',

  // 컨텍스트 관리
  CONTEXT_THRESHOLD = 'context:threshold',
  CONTEXT_COMPACT = 'context:compact',
}
```

#### 2.5.2 Hook Registry
```typescript
interface IHookRegistry {
  register(hook: IHook): void;
  unregister(name: string): void;
  getByEvent(event: HookEvent): IHook[];
  executeHooks(event: HookEvent, context: HookContext): Promise<void>;
}
```

---

## 3. 통신 아키텍처

### 3.1 내부 통신 (NATS)

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Agent A  │────▶│   NATS   │◀────│ Agent B  │
└──────────┘     │  Broker  │     └──────────┘
                 └────┬─────┘
                      │
              ┌───────┴───────┐
              ▼               ▼
        ┌──────────┐   ┌──────────┐
        │ Service  │   │ Service  │
        │    A     │   │    B     │
        └──────────┘   └──────────┘
```

#### 토픽 구조
```
agent.tasks.{agent_type}      # 에이전트별 작업 큐
agent.results.{agent_type}    # 에이전트별 결과
agent.events                  # 에이전트 이벤트
workflow.{workflow_id}        # 워크플로우별 채널
system.health                 # 헬스 체크
system.metrics                # 메트릭
```

### 3.2 외부 통신 (API)

```typescript
// API 라우트 구조
/api/v1
├── /projects
│   ├── POST   /              # 프로젝트 생성
│   ├── GET    /:id           # 프로젝트 조회
│   ├── PUT    /:id           # 프로젝트 수정
│   └── DELETE /:id           # 프로젝트 삭제
├── /workflows
│   ├── POST   /              # 워크플로우 시작
│   ├── GET    /:id           # 워크플로우 상태
│   └── POST   /:id/cancel    # 워크플로우 취소
├── /agents
│   ├── GET    /              # 에이전트 목록
│   ├── GET    /:id/health    # 에이전트 상태
│   └── POST   /:id/task      # 작업 할당
└── /plugins
    ├── GET    /              # 플러그인 목록
    ├── POST   /install       # 플러그인 설치
    └── DELETE /:id           # 플러그인 제거
```

### 3.3 실시간 통신 (WebSocket)

```typescript
// WebSocket 이벤트
interface WSEvents {
  // 구독
  'subscribe:workflow': { workflowId: string };
  'subscribe:agent': { agentId: string };

  // 서버 → 클라이언트
  'workflow:progress': WorkflowProgress;
  'agent:status': AgentStatus;
  'task:update': TaskUpdate;
  'log:stream': LogEntry;
}
```

---

## 4. 데이터 모델

### 4.1 Core Entities

```prisma
// Project
model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  status      ProjectStatus
  config      Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  modules     Module[]
  workflows   Workflow[]
  documents   Document[]
}

// Module
model Module {
  id          String   @id @default(uuid())
  projectId   String
  name        String
  type        ModuleType
  config      Json

  project     Project  @relation(fields: [projectId], references: [id])
  features    Feature[]
}

// Feature
model Feature {
  id          String   @id @default(uuid())
  moduleId    String
  name        String
  description String
  status      FeatureStatus
  priority    Int
  spec        Json      // TDD 스펙

  module      Module   @relation(fields: [moduleId], references: [id])
  tasks       Task[]
}

// Task
model Task {
  id          String   @id @default(uuid())
  featureId   String?
  workflowId  String?
  agentType   AgentType
  type        TaskType
  status      TaskStatus
  input       Json
  output      Json?
  error       Json?
  startedAt   DateTime?
  completedAt DateTime?

  feature     Feature?  @relation(fields: [featureId], references: [id])
  workflow    Workflow? @relation(fields: [workflowId], references: [id])
}

// Workflow
model Workflow {
  id          String   @id @default(uuid())
  projectId   String
  type        WorkflowType
  status      WorkflowStatus
  config      Json
  progress    Int      @default(0)

  project     Project  @relation(fields: [projectId], references: [id])
  tasks       Task[]
  steps       WorkflowStep[]
}
```

### 4.2 Enums

```typescript
enum ProjectStatus {
  DRAFT = 'draft',
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

enum ModuleType {
  CLIENT_WEB = 'client_web',
  CLIENT_MOBILE = 'client_mobile',
  CLIENT_DESKTOP = 'client_desktop',
  BACKEND_API = 'backend_api',
  BACKEND_AUTH = 'backend_auth',
  BACKEND_WORKER = 'backend_worker',
  INFRA_DB = 'infra_db',
  INFRA_CACHE = 'infra_cache',
  INFRA_QUEUE = 'infra_queue',
}

enum FeatureStatus {
  BACKLOG = 'backlog',
  SPEC_READY = 'spec_ready',
  IN_PROGRESS = 'in_progress',
  CODE_REVIEW = 'code_review',
  TESTING = 'testing',
  DONE = 'done',
}

enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
```

---

## 5. 보안 아키텍처

### 5.1 플러그인 신뢰 시스템

```typescript
interface ISecurityManager {
  // 플러그인 검증
  verifyPlugin(plugin: IPlugin): Promise<VerificationResult>;

  // 신뢰 레벨 관리
  setTrustLevel(pluginId: string, level: TrustLevel): void;
  getTrustLevel(pluginId: string): TrustLevel;

  // 화이트리스트
  addToWhitelist(pluginId: string): void;
  removeFromWhitelist(pluginId: string): void;
  isWhitelisted(pluginId: string): boolean;

  // 샌드박스
  createSandbox(plugin: IPlugin): Sandbox;
}
```

### 5.2 권한 시스템

```typescript
interface IPermissionManager {
  // 권한 확인
  checkPermission(agent: IAgent, action: Action): boolean;

  // 권한 부여
  grantPermission(agentId: string, permission: Permission): void;
  revokePermission(agentId: string, permission: Permission): void;

  // 역할 기반
  assignRole(agentId: string, role: Role): void;
  getRolePermissions(role: Role): Permission[];
}

enum Permission {
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  FILE_DELETE = 'file:delete',
  GIT_COMMIT = 'git:commit',
  GIT_PUSH = 'git:push',
  GIT_PR = 'git:pr',
  SHELL_EXECUTE = 'shell:execute',
  NETWORK_REQUEST = 'network:request',
  PLUGIN_INSTALL = 'plugin:install',
}
```

### 5.3 감사 로깅

```typescript
interface IAuditLogger {
  log(entry: AuditEntry): void;
  query(filter: AuditFilter): AuditEntry[];
  export(format: ExportFormat): Buffer;
}

interface AuditEntry {
  timestamp: Date;
  actor: string;        // 에이전트/사용자
  action: string;
  resource: string;
  outcome: 'success' | 'failure';
  details: Record<string, unknown>;
}
```

---

## 6. 확장성 설계

### 6.1 수평 확장

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
    │Instance │       │Instance │       │Instance │
    │    1    │       │    2    │       │    N    │
    └────┬────┘       └────┬────┘       └────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
              ┌────────────▼────────────┐
              │      Shared State       │
              │  (Redis / PostgreSQL)   │
              └─────────────────────────┘
```

### 6.2 에이전트 스케일링

```typescript
interface IAgentScaler {
  // 스케일 정책
  setPolicy(agentType: AgentType, policy: ScalePolicy): void;

  // 수동 스케일
  scaleUp(agentType: AgentType, count: number): Promise<void>;
  scaleDown(agentType: AgentType, count: number): Promise<void>;

  // 자동 스케일
  enableAutoScale(agentType: AgentType, config: AutoScaleConfig): void;
  disableAutoScale(agentType: AgentType): void;
}

interface AutoScaleConfig {
  minInstances: number;
  maxInstances: number;
  targetQueueDepth: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownSeconds: number;
}
```

---

## 7. 모니터링 & 관찰성

### 7.1 메트릭

```typescript
interface IMetricsCollector {
  // 카운터
  increment(name: string, tags?: Tags): void;

  // 게이지
  gauge(name: string, value: number, tags?: Tags): void;

  // 히스토그램
  histogram(name: string, value: number, tags?: Tags): void;

  // 타이머
  startTimer(name: string, tags?: Tags): () => void;
}

// 수집 메트릭 예시
const METRICS = {
  'tasks.total': 'counter',
  'tasks.completed': 'counter',
  'tasks.failed': 'counter',
  'tasks.duration': 'histogram',
  'agents.active': 'gauge',
  'agents.queue_depth': 'gauge',
  'context.usage_percent': 'gauge',
  'llm.tokens_used': 'counter',
  'llm.api_latency': 'histogram',
};
```

### 7.2 로깅

```typescript
interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}

interface LogContext {
  agentId?: string;
  taskId?: string;
  workflowId?: string;
  [key: string]: unknown;
}
```

### 7.3 트레이싱

```typescript
interface ITracer {
  startSpan(name: string, options?: SpanOptions): Span;
  getCurrentSpan(): Span | undefined;
  withSpan<T>(span: Span, fn: () => T): T;
}
```

---

## 8. 디렉토리 구조 (목표)

```
autonomous-coding-agents/
├── src/
│   ├── core/                    # 핵심 도메인
│   │   ├── orchestrator/
│   │   ├── project/
│   │   ├── workflow/
│   │   └── agent/
│   │
│   ├── agents/                  # 에이전트 구현
│   │   ├── base/
│   │   ├── architect/
│   │   ├── coder/
│   │   ├── reviewer/
│   │   ├── tester/
│   │   └── ...
│   │
│   ├── a2a/                     # A2A Protocol (NEW)
│   │   ├── server/              # A2A Server
│   │   │   ├── index.ts
│   │   │   ├── task-handler.ts
│   │   │   └── agent-registry.ts
│   │   ├── client/              # A2A Client
│   │   │   ├── index.ts
│   │   │   ├── discovery.ts
│   │   │   └── delegation.ts
│   │   ├── types/               # A2A Types
│   │   │   ├── agent-card.ts
│   │   │   ├── task.ts
│   │   │   └── protocol.ts
│   │   └── adapters/            # LLM → A2A Adapters
│   │       ├── claude-adapter.ts
│   │       ├── openai-adapter.ts
│   │       └── gemini-adapter.ts
│   │
│   ├── dx/                      # DX Enhancement (NEW)
│   │   ├── token-budget/        # Token Budget Manager
│   │   │   ├── index.ts
│   │   │   ├── budget.ts
│   │   │   └── tracker.ts
│   │   ├── error-recovery/      # Error Recovery Library
│   │   │   ├── index.ts
│   │   │   ├── retry.ts
│   │   │   ├── circuit-breaker.ts
│   │   │   └── fallback.ts
│   │   ├── session/             # Session Manager
│   │   │   ├── index.ts
│   │   │   ├── checkpoint.ts
│   │   │   └── migration.ts
│   │   ├── mcp-monitor/         # MCP Health Monitor
│   │   │   ├── index.ts
│   │   │   ├── health-check.ts
│   │   │   └── auto-recovery.ts
│   │   ├── testing/             # Agent Test Framework
│   │   │   ├── index.ts
│   │   │   ├── mock-llm.ts
│   │   │   ├── mock-tools.ts
│   │   │   └── test-runner.ts
│   │   └── debug/               # Debug Toolkit
│   │       ├── index.ts
│   │       ├── tracer.ts
│   │       └── profiler.ts
│   │
│   ├── tools/                   # 도구
│   │   ├── lsp/
│   │   ├── ast-grep/
│   │   ├── git/
│   │   ├── shell/
│   │   └── ...
│   │
│   ├── hooks/                   # 훅 시스템
│   │   ├── registry/
│   │   ├── builtin/
│   │   └── ...
│   │
│   ├── plugins/                 # 플러그인 시스템
│   │   ├── loader/
│   │   ├── security/
│   │   └── ...
│   │
│   ├── llm/                     # LLM 클라이언트
│   │   ├── base/
│   │   ├── claude/
│   │   ├── openai/
│   │   ├── gemini/
│   │   └── ...
│   │
│   ├── infra/                   # 인프라
│   │   ├── messaging/
│   │   ├── database/
│   │   ├── cache/
│   │   └── ...
│   │
│   ├── api/                     # API 레이어
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── websocket/
│   │
│   ├── cli/                     # CLI
│   │   ├── commands/
│   │   └── ...
│   │
│   └── shared/                  # 공유 유틸리티
│       ├── types/
│       ├── utils/
│       ├── errors/
│       └── di/                  # Dependency Injection
│           ├── container.ts
│           ├── tokens.ts
│           └── decorators.ts
│
├── packages/                    # 모노레포 패키지 (향후)
│   ├── desktop/                 # Desktop App
│   └── web/                     # Web Dashboard
│
├── prisma/                      # DB 스키마
├── tests/                       # 테스트
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                        # 문서
│   ├── planning/
│   ├── api/
│   └── ...
└── scripts/                     # 스크립트
```

---

## 9. 다음 문서

- **FEATURE_ROADMAP.md**: 상세 기능 목록 및 우선순위
- **REFACTORING_PLAN.md**: 기존 코드 리팩토링 단계
- **MODULE_DESIGN.md**: 각 모듈 상세 설계
