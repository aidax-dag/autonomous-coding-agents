# Feature Roadmap: CodeAvengers

> 기능별 우선순위와 구현 로드맵

---

## 1. 로드맵 개요

### 1.1 Phase 구조

```
Phase 0: Foundation (기반)      ─── 4주
    ↓
Phase 1: Core Agents (핵심)     ─── 6주
    ↓
Phase 2: Workflow (워크플로우)  ─── 4주
    ↓
Phase 3: Tools & Hooks (도구)   ─── 4주
    ↓
Phase 4: Platform (플랫폼)      ─── 8주
    ↓
Phase 5: Enterprise (확장)      ─── 지속
```

### 1.2 우선순위 기준

| 우선순위 | 레이블 | 설명 |
|----------|--------|------|
| P0 | 🔴 Critical | 없으면 프로젝트 불가능 |
| P1 | 🟠 High | 핵심 기능, 초기 릴리스 필수 |
| P2 | 🟡 Medium | 중요하지만 지연 가능 |
| P3 | 🟢 Low | Nice to have |
| P4 | 🔵 Future | 향후 고려 |

---

## 2. Phase 0: Foundation (기반 재구축) ✅ COMPLETED

> 목표: SOLID 원칙 기반의 확장 가능한 코어 구조 수립
>
> **완료일**: 2026-01-04 | **테스트**: 335개 통과 (기존 119 + Logger 123 + Metrics 93)

### 2.1 Feature List

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F0.1 | **Core Interfaces** | 핵심 인터페이스 정의 (IAgent, ITool, IHook 등) | 🔴 P0 | ✅ 완료 |
| F0.2 | **Dependency Injection** | DI 컨테이너 구현 (자체 구현) | 🔴 P0 | ✅ 완료 |
| F0.3 | **Configuration System** | 환경별 설정 관리, 스키마 검증 | 🔴 P0 | ✅ 완료 |
| F0.4 | **Logger Refactor** | 구조화된 로깅, 컨텍스트 전파 | 🟠 P1 | ✅ 완료 (123 tests) |
| F0.5 | **Error Handling** | 에러 타입 체계, 복구 전략 | 🟠 P1 | ✅ 완료 (Error Recovery에 통합) |
| F0.6 | **Event System** | 이벤트 버스, pub/sub 패턴 | 🔴 P0 | ✅ 완료 |
| F0.7 | **Metrics Foundation** | 메트릭 수집 기반 (카운터, 게이지, 히스토그램) | 🟡 P2 | ✅ 완료 (93 tests) |
| F0.8 | **Test Infrastructure** | 테스트 유틸, 목/스텁, 픽스처 | 🔴 P0 | ✅ 완료 (Mock LLM 포함) |
| F0.9 | **Token Budget Manager** | 토큰 예산 관리, 비용 제어, 경고 시스템 | 🔴 P0 | ✅ 완료 |
| F0.10 | **Error Recovery Library** | Retry Strategy, Circuit Breaker, Fallback 패턴 | 🔴 P0 | ✅ 완료 |

### 2.2 Phase 0 구현 결과

```
src/
├── core/
│   ├── interfaces/     # IEvent, IDisposable, ILogger 등 핵심 인터페이스
│   ├── di/             # DI Container, Token, Scope 시스템
│   ├── events/         # AsyncEventBus (pub/sub, 필터링, 우선순위)
│   └── config/         # (placeholder)
│
└── dx/
    ├── error-recovery/ # Retry, Circuit Breaker, Fallback, Timeout, Composite
    ├── token-budget/   # Budget Manager, Usage Tracking, Callbacks
    └── testing/        # Mock LLM Client (패턴 매칭, 시퀀스, 검증)
```

### 2.2 상세 스펙

#### F0.1 Core Interfaces
```typescript
// 모든 에이전트의 기반
interface IAgent {
  id: string;
  type: AgentType;
  initialize(): Promise<void>;
  processTask(task: Task): Promise<TaskResult>;
  getHealth(): HealthStatus;
}

// 모든 도구의 기반
interface ITool {
  name: string;
  schema: ToolSchema;
  execute(params: unknown): Promise<ToolResult>;
}

// 모든 훅의 기반
interface IHook {
  name: string;
  event: HookEvent;
  priority: number;
  execute(context: HookContext): Promise<HookResult>;
}
```

#### F0.6 Event System
```typescript
interface IEventBus {
  emit<T>(event: string, payload: T): void;
  on<T>(event: string, handler: (payload: T) => void): Unsubscribe;
  once<T>(event: string, handler: (payload: T) => void): void;
}
```

#### F0.9 Token Budget Manager
```typescript
interface ITokenBudgetManager {
  // 예산 생성/관리
  createBudget(config: TokenBudgetConfig): TokenBudget;
  getBudget(budgetId: string): TokenBudget | undefined;
  deleteBudget(budgetId: string): boolean;

  // 사용량 기록
  recordUsage(usage: TokenUsage): void;

  // 예산 확인
  checkBudget(budgetId?: string): BudgetStatus;
  getRemainingBudget(budgetId?: string): number;

  // 예산 내 작업 실행
  withBudget<T>(budget: TokenBudget, operation: () => Promise<T>): Promise<T>;

  // 이벤트 구독
  onWarning(callback: (status: BudgetStatus) => void): Subscription;
  onExceeded(callback: (status: BudgetStatus) => void): Subscription;
}

interface TokenBudgetConfig {
  maxTokens: number;
  warningThreshold?: number;  // 0.0 - 1.0 (기본값: 0.8)
  resetInterval?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'never';
  scope?: 'global' | 'agent' | 'task';
}

interface BudgetStatus {
  budgetId: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  isWarning: boolean;
  isExceeded: boolean;
  resetAt?: Date;
}
```

#### F0.10 Error Recovery Library
```typescript
interface IErrorRecovery {
  // Retry with strategies
  retry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T>;

  // Circuit Breaker
  withCircuitBreaker<T>(
    operation: () => Promise<T>,
    options?: CircuitBreakerOptions
  ): Promise<T>;

  // Fallback
  withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    options?: FallbackOptions
  ): Promise<T>;

  // 복합 전략
  withRecovery<T>(
    operation: () => Promise<T>,
    strategies: RecoveryStrategy[]
  ): Promise<T>;
}

interface RetryOptions {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay?: number;
  retryOn?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  onStateChange?: (state: CircuitState) => void;
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface FallbackOptions {
  timeout?: number;
  shouldFallback?: (error: Error) => boolean;
  onFallback?: (error: Error) => void;
}
```

---

## 3. Phase 1: Core Agents (핵심 에이전트) ✅ COMPLETED

> 목표: 문서 기반 자율 개발을 위한 핵심 에이전트 구현
>
> **시작일**: 2026-01-04 | **완료**: 14/14 기능

### 3.1 Feature List

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F1.1 | **Agent Base Class** | BaseAgent 리팩토링, 생명주기 관리 | 🔴 P0 | ✅ 완료 |
| F1.2 | **Agent Factory** | 에이전트 생성 팩토리, 등록 시스템 | 🔴 P0 | ✅ 완료 (22 tests) |
| F1.3 | **Agent Registry** | 에이전트 레지스트리, 조회/관리 | 🔴 P0 | ✅ 완료 (26 tests) |
| F1.4 | **Architect Agent** | 설계/분석 에이전트 신규 구현 | 🟠 P1 | ✅ 완료 (34 tests) |
| F1.5 | **Coder Agent Refactor** | 기존 코더 에이전트 리팩토링 | 🔴 P0 | ✅ 완료 (27 tests) |
| F1.6 | **Reviewer Agent Enhance** | 리뷰어 에이전트 강화 (다중 모델) | 🟠 P1 | ✅ 완료 (36 tests) |
| F1.7 | **Tester Agent** | TDD 기반 테스터 에이전트 신규 | 🟠 P1 | ✅ 완료 (33 tests) |
| F1.8 | **DocWriter Agent** | 문서 작성 에이전트 신규 | 🟡 P2 | ✅ 완료 (48 tests) |
| F1.9 | **Explorer Agent** | 코드베이스 탐색 에이전트 신규 | 🟡 P2 | ✅ 완료 (52 tests) |
| F1.10 | **Librarian Agent** | 문서/레퍼런스 조회 에이전트 | 🟡 P2 | ✅ 완료 (58 tests) |
| F1.11 | **Agent Communication** | 에이전트 간 통신 프로토콜 | 🔴 P0 | ✅ 완료 (23 tests) |
| F1.12 | **Background Execution** | 백그라운드 에이전트 실행 | 🟠 P1 | ✅ 완료 (37 tests) |
| F1.13 | **Agent Testing Framework** | Mock LLM, 테스트 시나리오, 검증 유틸 | 🔴 P0 | ✅ 완료 (Phase 0) |
| F1.14 | **Mock LLM Client** | 결정론적 테스트용 LLM 모킹 | 🔴 P0 | ✅ 완료 (Phase 0) |

### 3.2 상세 스펙

#### F1.4 Architect Agent
```typescript
class ArchitectAgent extends BaseAgent {
  // 문서 분석 → 모듈 분해
  analyzeDocument(doc: Document): Promise<ModuleBreakdown>;

  // 아키텍처 설계
  designArchitecture(requirements: Requirements): Promise<Architecture>;

  // 기술 스택 추천
  recommendTechStack(context: ProjectContext): Promise<TechStack>;

  // API 설계
  designAPI(module: Module): Promise<APISpec>;
}
```

#### F1.7 Tester Agent
```typescript
class TesterAgent extends BaseAgent {
  // 스펙에서 테스트 생성
  generateTestsFromSpec(spec: FeatureSpec): Promise<TestSuite>;

  // 테스트 실행
  runTests(suite: TestSuite): Promise<TestResult>;

  // 커버리지 분석
  analyzeCoverage(result: TestResult): Promise<CoverageReport>;

  // 스펙 검증
  validateAgainstSpec(code: string, spec: FeatureSpec): Promise<ValidationResult>;
}
```

#### F1.13 Agent Testing Framework
```typescript
interface IAgentTestRunner {
  // 테스트 실행
  runTest(test: AgentTest): Promise<AgentTestResult>;
  runSuite(suite: AgentTestSuite): Promise<AgentTestSuiteResult>;

  // 시나리오 테스트
  runScenario(scenario: AgentScenario): Promise<ScenarioResult>;

  // Mock 설정
  setMockLLM(mock: IMockLLMClient): void;
  setMockTools(mocks: Map<string, MockTool>): void;
}

interface AgentTest {
  name: string;
  description?: string;
  agent: AgentType;
  input: TaskInput;
  expectedOutput?: Partial<TaskOutput>;
  expectedToolCalls?: ExpectedToolCall[];
  timeout?: number;
  tags?: string[];
}

interface AgentScenario {
  name: string;
  steps: ScenarioStep[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

interface ScenarioStep {
  agent: AgentType;
  action: string;
  input: unknown;
  validate: (result: unknown) => boolean | Promise<boolean>;
}
```

#### F1.14 Mock LLM Client
```typescript
interface IMockLLMClient extends ILLMClient {
  // Mock 응답 설정
  setResponse(pattern: string | RegExp, response: MockResponse): void;
  setResponseSequence(responses: MockResponse[]): void;

  // 기록 검증
  getCallHistory(): LLMCallRecord[];
  expectCall(matcher: CallMatcher): CallExpectation;
  verifyAllExpectations(): void;

  // 동작 시뮬레이션
  simulateError(error: Error): void;
  simulateLatency(ms: number): void;
  simulateStreamInterruption(): void;

  // 상태 리셋
  reset(): void;
}

interface MockResponse {
  content: string;
  toolCalls?: ToolCall[];
  delay?: number;
  shouldStream?: boolean;
}

interface LLMCallRecord {
  timestamp: Date;
  messages: Message[];
  response: LLMResponse;
  duration: number;
  tokenUsage: TokenUsage;
}
```

---

## 4. Phase 2: Workflow Engine (워크플로우 엔진) ✅ COMPLETED

> 목표: 문서 → 코드 → 리뷰 → 테스트 → 배포 자동화
>
> **시작일**: 2026-01-04 | **완료일**: 2026-01-05 | **완료**: 14/14 기능 | **테스트**: 656개 통과

### 4.1 Feature List

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F2.1 | **Workflow Definition** | 워크플로우 DSL, 정의 스키마 | 🔴 P0 | ✅ 완료 (46 tests) |
| F2.2 | **Workflow Engine** | 워크플로우 실행 엔진 | 🔴 P0 | ✅ 완료 (29 tests) |
| F2.3 | **Step Executor** | 단계별 실행기, 재시도 로직 | 🔴 P0 | ✅ 완료 (33 tests) |
| F2.4 | **State Machine** | 워크플로우 상태 머신 | 🟠 P1 | ✅ 완료 (69 tests) |
| F2.5 | **Orchestrator Service** | 에이전트 조율, 작업 분배 | 🔴 P0 | ✅ 완료 (30 tests) |
| F2.6 | **Progress Tracker** | 진행 상황 추적, 리포팅 | 🟠 P1 | ✅ 완료 (93 tests) |
| F2.7 | **Rollback Support** | 실패 시 롤백, 복구 | 🟠 P1 | ✅ 완료 (69 tests) |
| F2.8 | **Parallel Execution** | 병렬 단계 실행 | 🟡 P2 | ✅ 완료 (F2.2에 포함) |
| F2.9 | **Conditional Flow** | 조건부 분기, 동적 라우팅 | 🟡 P2 | ✅ 완료 (F2.2에 포함) |
| F2.10 | **Workflow Templates** | 사전 정의 워크플로우 템플릿 | 🟡 P2 | ✅ 완료 (101 tests) |
| F2.11 | **A2A Protocol Server** | Google A2A 프로토콜 서버 구현 | 🟠 P1 | ✅ 완료 (28 tests) |
| F2.12 | **A2A Protocol Client** | 외부 A2A 에이전트 연동 클라이언트 | 🟠 P1 | ✅ 완료 (30 tests) |
| F2.13 | **Agent Card System** | 에이전트 역량 기술 (A2A 표준) | 🟠 P1 | ✅ 완료 (56 tests) |
| F2.14 | **MCP + A2A Hybrid** | MCP 도구와 A2A 협업 통합 | 🟡 P2 | ✅ 완료 (72 tests) |

### 4.2 Phase 2 구현 결과 (P0 + F2.6 + F2.7 + F2.10~F2.14 완료)

```
src/core/
├── workflow/
│   ├── workflow-definition.ts   # DSL 스키마, 빌더, 검증 (46 tests)
│   ├── workflow-engine.ts       # 실행 엔진, 병렬/조건/루프 (29 tests)
│   ├── step-executor.ts         # 단계 실행, 재시도, 타임아웃 (33 tests)
│   ├── state-machine.ts         # 상태 머신, 전이, 가드 (69 tests)
│   ├── progress-tracker.ts      # 진행 추적, 시간 예측, 리포팅 (93 tests)
│   ├── rollback-manager.ts      # 롤백 관리, 체크포인트, 보상 액션 (69 tests)
│   ├── workflow-templates.ts    # 템플릿 시스템, 빌트인 템플릿 (101 tests)
│   └── index.ts                 # 모듈 exports
│
├── a2a/
│   ├── a2a-server.ts            # A2A 프로토콜 서버 (28 tests)
│   ├── a2a-client.ts            # A2A 클라이언트 (30 tests)
│   ├── a2a-transport.ts         # HTTP/JSON-RPC 트랜스포트
│   ├── agent-card.ts            # Agent Card System (56 tests)
│   ├── mcp-a2a-bridge.ts        # MCP + A2A Hybrid Bridge (72 tests)
│   └── index.ts                 # 모듈 exports
│
└── orchestrator/
    ├── orchestrator-service.ts  # 에이전트 조율, 라우팅 (30 tests)
    └── index.ts                 # 모듈 exports

총 테스트: 570개 통과
```

**주요 기능:**
- **WorkflowDefinition**: Zod 스키마 기반 DSL, 빌더 패턴, 의존성 검증
- **WorkflowEngine**: 병렬/순차/조건/루프 스텝, 이벤트 발행, 통계 추적
- **StepExecutor**: FIXED/EXPONENTIAL/LINEAR 재시도, 타임아웃, 훅 지원
- **StateMachine**: 워크플로우/스텝 상태 전이, 가드/액션, 히스토리 추적
- **ProgressTracker**: 진행률 계산, 시간 예측 (EMA 기반), 다중 리포트 형식 (text/json/markdown/html), 마일스톤 추적
- **RollbackManager**: 체크포인트 관리, 5가지 롤백 전략 (FULL/TO_CHECKPOINT/FAILED_STEP_ONLY/TO_LAST_SUCCESS/SKIP_AND_CONTINUE), 보상 액션 등록/실행, 우선순위 기반 실행, 재시도 지원
- **OrchestratorService**: ROUND_ROBIN/LEAST_LOADED/RANDOM/CAPABILITY_MATCH 라우팅
- **A2AServer**: Google A2A 프로토콜 서버, Agent Card 시스템, 태스크 처리/스트리밍, 동시성 제어, 헬스체크, 이벤트 발행
- **A2ATransport**: HTTP REST + JSON-RPC 2.0 트랜스포트, SSE 스트리밍, CORS 지원, 인증 (API Key/Bearer Token)
- **MCPA2ABridge**: MCP 도구를 A2A 역량으로 노출, A2A 에이전트를 MCP 도구 제공자로 등록, 통합 역량 조회, 하이브리드 워크플로우 실행 (병렬/조건부 스텝), 변수 참조 해결, 통계 추적

### 4.2 상세 스펙 - A2A Protocol

#### F2.11 A2A Protocol Server
```typescript
interface IA2AServer {
  // 서버 생명주기
  start(port: number): Promise<void>;
  stop(): Promise<void>;

  // 에이전트 등록
  registerAgent(agent: IAgent): void;
  unregisterAgent(agentId: string): void;
  getAgentCard(agentId: string): AgentCard | undefined;

  // 태스크 처리 (A2A 표준)
  handleTask(task: A2ATask): Promise<A2ATaskResult>;
  handleTaskStream(task: A2ATask): AsyncGenerator<A2ATaskUpdate>;

  // 태스크 관리
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

interface AgentCapability {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
}
```

#### F2.12 A2A Protocol Client
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

interface A2ATask {
  id: string;
  type: string;
  input: unknown;
  context?: A2AContext;
  constraints?: A2AConstraints;
}

interface A2ATaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'cancelled';
  output?: unknown;
  artifacts?: A2AArtifact[];
  error?: A2AError;
  metadata: A2AMetadata;
}
```

### 4.3 워크플로우 예시

#### 기본 개발 워크플로우
```yaml
name: feature-development
description: 기능 개발 전체 사이클

steps:
  - id: analyze
    agent: architect
    action: analyzeFeature
    input: ${feature.spec}

  - id: design
    agent: architect
    action: designImplementation
    input: ${steps.analyze.output}
    dependsOn: [analyze]

  - id: generate-tests
    agent: tester
    action: generateTests
    input: ${steps.design.output}
    dependsOn: [design]

  - id: implement
    agent: coder
    action: implement
    input:
      design: ${steps.design.output}
      tests: ${steps.generate-tests.output}
    dependsOn: [generate-tests]

  - id: run-tests
    agent: tester
    action: runTests
    input: ${steps.implement.output}
    dependsOn: [implement]

  - id: review
    agent: reviewer
    action: reviewCode
    input: ${steps.implement.output}
    dependsOn: [run-tests]
    condition: ${steps.run-tests.output.passed}

  - id: commit
    tool: git
    action: commit
    input:
      files: ${steps.implement.output.files}
      message: "feat: ${feature.name}"
    dependsOn: [review]
    condition: ${steps.review.output.approved}

  - id: create-pr
    tool: github
    action: createPR
    input: ${steps.commit.output}
    dependsOn: [commit]
```

---

## 5. Phase 3: Tools & Hooks (도구 및 훅) ✅ COMPLETED

> 목표: oh-my-opencode에서 영감받은 고급 도구 및 훅 시스템
>
> **시작일**: 2026-01-04 | **완료일**: 2026-01-09 | **완료**: 18/18 기능 | **테스트**: 1228개 통과

### 5.1 Feature List - Tools

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F3.1 | **Tool Registry** | 도구 레지스트리, 동적 로딩 | 🔴 P0 | ✅ 완료 (30 tests) |
| F3.2 | **LSP Integration** | LSP 서버 연동, 코드 인텔리전스 | 🟠 P1 | ✅ 완료 (102 tests) |
| F3.3 | **AST-Grep Tool** | AST 기반 코드 검색/변환 | 🟠 P1 | ✅ 완료 (80 tests) |
| F3.4 | **Git Tools** | Git 작업 도구 (commit, push, PR) | 🔴 P0 | ✅ 완료 (43 tests) |
| F3.5 | **Shell Tools** | 셸 명령 실행, 샌드박스 | 🟠 P1 | ✅ 완료 (48 tests) |
| F3.6 | **File Tools** | 파일 읽기/쓰기, 검색 | 🔴 P0 | ✅ 완료 (51 tests) |
| F3.7 | **MCP Integration** | MCP 서버 연동 (Context7, Exa 등) | 🟡 P2 | ✅ 완료 (120 tests) |
| F3.8 | **Web Search Tool** | 웹 검색, 문서 크롤링 | 🟡 P2 | ✅ 완료 (115 tests) |

### 5.2 Feature List - Hooks

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F3.10 | **Hook Registry** | 훅 레지스트리, 우선순위 관리 | 🔴 P0 | ✅ 완료 (57 tests) |
| F3.11 | **Context Monitor** | 컨텍스트 윈도우 모니터링 | 🟠 P1 | ✅ 완료 (29 tests) |
| F3.12 | **Token Optimizer** | 토큰 최적화, 출력 압축 | 🟠 P1 | ✅ 완료 (43 tests) |
| F3.13 | **Session Recovery** | 세션 복구, 체크포인트 | 🟠 P1 | ✅ 완료 (53 tests) |
| F3.14 | **Auto Compaction** | 자동 컨텍스트 압축 | 🟡 P2 | ✅ 완료 (43 tests) |
| F3.15 | **Comment Checker** | 과도한 주석 검사/제거 | 🟡 P2 | ✅ 완료 (76 tests) |
| F3.16 | **Code Quality Hook** | 코드 품질 검사 (lint, format) | 🟠 P1 | ✅ 완료 (40 tests) |
| F3.17 | **Todo Enforcer** | TODO 완료 강제 | 🟡 P2 | ✅ 완료 (103 tests) |
| F3.18 | **Think Mode** | 확장 사고 모드 자동 전환 | 🟡 P2 | ✅ 완료 (89 tests) |
| F3.19 | **MCP Health Monitor** | MCP 서버 상태 모니터링 | 🟠 P1 | ✅ 완료 (57 tests) |
| F3.20 | **Session Manager** | 세션 지속성, 복구, 마이그레이션 | 🟠 P1 | ✅ 완료 (72 tests) |
| F3.21 | **Debug Toolkit** | 에이전트 디버깅 도구 모음 | 🟡 P2 | ✅ 완료 (66 tests) |

### 5.3 Phase 3 구현 결과 (완료)

```
src/core/
├── tools/
│   ├── base-tool.ts           # 도구 추상 클래스, 검증, 헬퍼
│   ├── tool-registry.ts       # 등록/조회, 카테고리 인덱싱 (30 tests)
│   ├── tool-executor.ts       # 실행, 타임아웃, 재시도, 캐싱
│   ├── git/                   # Git 도구 모듈 (43 tests)
│   │   ├── git.interface.ts   # Git 관련 타입/인터페이스
│   │   ├── git-client.ts      # Git 명령 실행 클라이언트
│   │   ├── git-status.tool.ts # 저장소 상태 조회
│   │   ├── git-add.tool.ts    # 파일 스테이징
│   │   ├── git-reset.tool.ts  # 스테이징 해제
│   │   ├── git-commit.tool.ts # 커밋 생성
│   │   ├── git-push.tool.ts   # 원격 푸시
│   │   ├── git-pull.tool.ts   # 원격 풀
│   │   ├── git-branch.tool.ts # 브랜치 관리
│   │   ├── git-checkout.tool.ts # 체크아웃
│   │   ├── git-diff.tool.ts   # 변경사항 비교
│   │   ├── git-log.tool.ts    # 커밋 로그
│   │   ├── git-merge.tool.ts  # 브랜치 병합
│   │   ├── git-stash.tool.ts  # 스태시 관리
│   │   └── index.ts           # 모듈 exports, 팩토리
│   ├── file/                   # File 도구 모듈 (51 tests)
│   │   └── ...                 # 파일 읽기/쓰기/검색 도구
│   ├── shell/                  # Shell 도구 모듈 (48 tests)
│   │   ├── shell.interface.ts  # Shell 관련 타입/인터페이스
│   │   ├── shell-client.ts     # Shell 명령 실행, 샌드박스 보안
│   │   ├── shell-exec.tool.ts  # 셸 명령 실행
│   │   ├── shell-command.tool.ts # 명령어+인자 실행 (안전)
│   │   ├── shell-script.tool.ts  # 스크립트 파일 실행
│   │   ├── shell-env.tool.ts   # 환경 변수 관리
│   │   ├── shell-which.tool.ts # 명령어 위치 조회
│   │   ├── shell-pipe.tool.ts  # 파이프 명령 실행
│   │   ├── shell-validate.tool.ts # 명령어 샌드박스 검증
│   │   └── index.ts            # 모듈 exports, 팩토리
│   ├── lsp/                    # LSP 도구 모듈 (102 tests)
│   │   ├── lsp.interface.ts    # LSP 타입/인터페이스 정의
│   │   ├── lsp-client.ts       # LSP 클라이언트 구현
│   │   └── index.ts            # 모듈 exports
│   └── index.ts                # 모듈 exports
│
└── hooks/
    ├── base-hook.ts           # 훅 추상 클래스, 조건 평가
    ├── hook-registry.ts       # 등록/조회, 이벤트 인덱싱, 우선순위 정렬
    ├── hook-executor.ts       # 순차/병렬 실행, 타임아웃 (57 tests)
    ├── context-monitor/       # Context Monitor Hook (29 tests)
    │   ├── context-monitor.interface.ts  # 인터페이스/타입 정의
    │   ├── context-monitor.hook.ts       # 모니터링 훅 구현
    │   └── index.ts           # 모듈 exports
    ├── token-optimizer/       # Token Optimizer Hook (43 tests)
    │   ├── token-optimizer.interface.ts  # 인터페이스/타입 정의
    │   ├── token-optimizer.hook.ts       # 최적화 훅 구현
    │   └── index.ts           # 모듈 exports
    ├── session-recovery/      # Session Recovery Hook (53 tests)
    │   ├── session-recovery.interface.ts # 세션/체크포인트 인터페이스
    │   ├── session-recovery.hook.ts      # 세션 복구 훅 구현
    │   └── index.ts           # 모듈 exports
    ├── auto-compaction/       # Auto Compaction Hook (43 tests)
    │   ├── auto-compaction.interface.ts  # 압축 모드/전략/메시지 인터페이스
    │   ├── auto-compaction.hook.ts       # 자동 압축 훅 구현
    │   └── index.ts           # 모듈 exports
    ├── code-quality/          # Code Quality Hook (40 tests)
    │   ├── code-quality.interface.ts     # 품질 체크 타입/결과/설정 인터페이스
    │   ├── code-quality.hook.ts          # 코드 품질 검사 훅 구현
    │   └── index.ts           # 모듈 exports
    ├── comment-checker/       # Comment Checker Hook (76 tests)
    │   ├── comment-checker.interface.ts  # 주석 분석 타입/설정 인터페이스
    │   ├── comment-checker.hook.ts       # 주석 검사/제거 훅 구현
    │   └── index.ts           # 모듈 exports
    ├── todo-enforcer/         # Todo Enforcer Hook (103 tests)
    │   ├── todo-enforcer.interface.ts    # TODO 검사 타입/설정 인터페이스
    │   ├── todo-enforcer.hook.ts         # TODO 강제 훅 구현
    │   └── index.ts           # 모듈 exports
    ├── think-mode/            # Think Mode Hook (89 tests)
    │   ├── think-mode.interface.ts       # 모드/트리거/세션 인터페이스
    │   ├── think-mode.hook.ts            # 자동 모드 전환 훅 구현
    │   └── index.ts           # 모듈 exports
    ├── mcp-health-monitor/    # MCP Health Monitor Hook (57 tests)
    │   ├── mcp-health-monitor.interface.ts  # MCP 서버 상태/복구 인터페이스
    │   ├── mcp-health-monitor.hook.ts       # MCP 서버 상태 모니터링 훅 구현
    │   └── index.ts           # 모듈 exports
    └── index.ts               # 모듈 exports

session/                       # Session Manager (72 tests)
├── session-manager.interface.ts  # 세션/체크포인트/이벤트 인터페이스
├── session-manager.ts            # 세션 관리자 구현
└── index.ts                      # 모듈 exports

dx/
├── debug-toolkit/             # Debug Toolkit (66 tests)
│   ├── interfaces/            # 인터페이스 정의 (IDebugToolkit, Trace, Profile 등)
│   ├── impl/                  # 구현체 (DebugToolkit)
│   └── index.ts               # 모듈 exports

총 테스트: 1002개 통과 (Git 43 + File 51 + Shell 48 + LSP 102 + Hook 57 + Tool Registry 30 + Context Monitor 29 + Token Optimizer 43 + Session Recovery 53 + Auto Compaction 43 + Code Quality 40 + Comment Checker 76 + Todo Enforcer 103 + Think Mode 89 + MCP Health Monitor 57 + Session Manager 72 + Debug Toolkit 66)
```

**주요 기능:**
- **BaseTool**: 추상 클래스, 파라미터 검증, success/failure 헬퍼
- **ToolRegistry**: 카테고리별 인덱싱, 검색, 가용성 확인
- **ToolExecutor**: 타임아웃, 재시도 (exponential backoff), 캐싱, 히스토리
- **GitTools**: 12개 Git 도구 (status, add, reset, commit, push, pull, branch, checkout, diff, log, merge, stash)
- **GitClient**: Node.js child_process 기반 Git 명령 실행, 출력 파싱
- **FileTools**: 파일 읽기/쓰기/검색 도구 (read, write, delete, search, list)
- **ShellTools**: 7개 Shell 도구 (exec, command, script, env, which, pipe, validate)
- **ShellClient**: Node.js spawn 기반 샌드박스 보안 (명령 화이트/블랙리스트, 경로 제한, 환경변수 필터링)
- **LSPClient**: Language Server Protocol 클라이언트, 18개 언어 지원, 코드 인텔리전스 (hover, goto definition, references, completions, diagnostics, code actions, rename, call hierarchy, type hierarchy)
- **BaseHook**: 추상 클래스, 조건 평가, 우선순위 지원
- **HookRegistry**: 이벤트별 인덱싱, 우선순위 정렬, enable/disable
- **HookExecutor**: 순차/병렬 실행, 컨텍스트 수정 전파, 히스토리
- **ContextMonitorHook**: 컨텍스트 사용량 모니터링, 임계값 경고, 사용량 구독
- **TokenOptimizerHook**: 7가지 최적화 전략 (whitespace, deduplicate, truncate, remove_empty_lines, compress_code, remove_comments, all)
- **SessionRecoveryHook**: 세션 지속성, 체크포인트 생성/복원, 자동 체크포인트, 스토리지 어댑터 추상화 (Memory/File/Custom)
- **AutoCompactionHook**: 자동 컨텍스트 압축, 3가지 모드 (Aggressive/Balanced/Conservative), 4가지 전략 (REMOVE_OLDEST/SUMMARIZE/DEDUPLICATE/HYBRID), 메시지 우선순위 기반 압축, ISummarizer 통합
- **CodeQualityHook**: 코드 품질 검사, 4가지 체크 타입 (LINT/FORMAT/TYPE_CHECK/TEST), ESLint/Prettier/TypeScript/Jest 통합, 자동 수정 지원, 이슈 심각도 분류, 도구 가용성 확인
- **CommentCheckerHook**: 과도한 주석 검사/제거, 14개 언어 지원, 10가지 이슈 유형 (REDUNDANT/VERBOSE/OUTDATED/EXCESSIVE_BLOCK/HIGH_DENSITY/TRIVIAL/COMMENTED_CODE/NONSTANDARD_FORMAT/MISSING_DOC/UNTRACKED_TODO), 주석 밀도/비율 분석, 주석 통계, 자동 수정 지원 (백업/드라이런), 티켓 참조 검증
- **TodoEnforcerHook**: TODO 주석 완료 강제, 17개 언어 지원, 9가지 TODO 유형 (TODO/FIXME/HACK/OPTIMIZE/REVIEW/SECURITY/DEPRECATED/NOTE/CUSTOM), 우선순위 검출 (CRITICAL/HIGH/MEDIUM/LOW), 담당자/@username 추출, JIRA/GitHub 이슈 참조 추출, 커스텀 패턴 지원, 커밋/배포 차단, 리포트 생성 (text/markdown/json)
- **ThinkModeHook**: 자동 확장 사고 모드 전환, 6가지 모드 (NORMAL/EXTENDED/REASONING/CREATIVE/DEBUG/ULTRATHINK), 8가지 트리거 유형 (EXPLICIT/COMPLEXITY/ERROR/AMBIGUITY/MULTI_STEP/ARCHITECTURE/SECURITY/PERFORMANCE), 복잡도 평가 및 자동 에스컬레이션, 세션 기반 토큰 추적, 자동 디에스컬레이션, 이벤트 구독 (모드 변경, 복잡도 평가, 트리거 감지, 세션 이벤트)
- **MCPHealthMonitorHook**: MCP 서버 상태 모니터링, 4가지 상태 (HEALTHY/DEGRADED/UNHEALTHY/UNKNOWN), 자동 복구 (exponential backoff), 통계 수집 (응답 시간, 에러율, percentiles), 이벤트 구독 (상태 변경, 경고, 복구)
- **SessionManager**: 세션 생명주기 관리, 다중 세션 지원, 체크포인트 생성/복원, 내보내기/가져오기 (마이그레이션), 세션 필터링/정렬/페이징, 이벤트 구독, 자동 정리

### 5.4 상세 스펙

#### F3.2 LSP Integration
```typescript
interface ILSPService {
  // 연결 관리
  connect(server: LSPServerConfig): Promise<void>;
  disconnect(serverId: string): Promise<void>;

  // 코드 인텔리전스
  hover(file: string, position: Position): Promise<HoverResult>;
  gotoDefinition(file: string, position: Position): Promise<Location[]>;
  findReferences(file: string, position: Position): Promise<Location[]>;
  getDocumentSymbols(file: string): Promise<Symbol[]>;

  // 리팩토링
  rename(file: string, position: Position, newName: string): Promise<WorkspaceEdit>;
  getCodeActions(file: string, range: Range): Promise<CodeAction[]>;
  applyCodeAction(action: CodeAction): Promise<void>;

  // 진단
  getDiagnostics(file: string): Promise<Diagnostic[]>;
}
```

#### F3.11 Context Monitor Hook
```typescript
class ContextMonitorHook implements IHook {
  name = 'context-monitor';
  event = HookEvent.TASK_BEFORE;
  priority = 100;

  async execute(context: HookContext): Promise<HookResult> {
    const usage = this.calculateContextUsage(context);

    if (usage > 0.85) {
      return {
        action: 'compact',
        message: '컨텍스트 85% 초과, 압축 필요',
      };
    }

    if (usage > 0.70) {
      return {
        action: 'warn',
        message: `컨텍스트 사용량: ${(usage * 100).toFixed(1)}%`,
      };
    }

    return { action: 'continue' };
  }
}
```

#### F3.19 MCP Health Monitor
```typescript
interface IMCPHealthMonitor {
  // 서버 상태 조회
  getServerStatus(serverId: string): MCPServerStatus;
  getAllServerStatuses(): Map<string, MCPServerStatus>;

  // 헬스체크
  checkHealth(serverId: string): Promise<HealthCheckResult>;
  checkAllHealth(): Promise<Map<string, HealthCheckResult>>;

  // 자동 복구
  enableAutoRecovery(serverId: string, options?: RecoveryOptions): void;
  disableAutoRecovery(serverId: string): void;

  // 모니터링 이벤트
  onStatusChange(callback: (serverId: string, status: MCPServerStatus) => void): Subscription;
  onHealthWarning(callback: (serverId: string, warning: HealthWarning) => void): Subscription;

  // 통계
  getStatistics(serverId: string): MCPServerStatistics;
}

interface MCPServerStatus {
  serverId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
  capabilities: string[];
}

interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  details: HealthDetail[];
  recommendations?: string[];
}

interface RecoveryOptions {
  maxRetries: number;
  retryDelay: number;
  escalationPolicy?: EscalationPolicy;
  fallbackServers?: string[];
}
```

#### F3.20 Session Manager
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

  // 마이그레이션
  exportSession(sessionId: string): Promise<ExportedSession>;
  importSession(data: ExportedSession): Promise<Session>;

  // 이벤트
  onSessionChange(callback: (event: SessionEvent) => void): Subscription;
}

interface Session {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: SessionStatus;
  context: SessionContext;
  metadata: SessionMetadata;
}

interface SessionSnapshot {
  id: string;
  sessionId: string;
  createdAt: Date;
  state: SerializedState;
  checksum: string;
}

interface Checkpoint {
  id: string;
  name: string;
  sessionId: string;
  createdAt: Date;
  snapshot: SessionSnapshot;
  tags: string[];
}
```

#### F3.21 Debug Toolkit
```typescript
interface IDebugToolkit {
  // 에이전트 추적
  traceAgent(agentId: string, options?: TraceOptions): AgentTrace;
  stopTrace(traceId: string): void;
  getTraceLog(traceId: string): TraceLog;

  // 상태 검사
  inspectAgentState(agentId: string): AgentStateSnapshot;
  inspectToolExecution(executionId: string): ToolExecutionDetail;
  inspectLLMCall(callId: string): LLMCallDetail;

  // 메모리 분석
  analyzeMemoryUsage(): MemoryReport;
  detectMemoryLeaks(): LeakReport;

  // 성능 프로파일링
  startProfiling(options?: ProfileOptions): ProfileSession;
  stopProfiling(sessionId: string): ProfileReport;

  // 디버그 출력
  setLogLevel(level: LogLevel): void;
  enableVerboseMode(): void;
  disableVerboseMode(): void;
}

interface AgentTrace {
  traceId: string;
  agentId: string;
  events: TraceEvent[];
  startTime: Date;
  endTime?: Date;
}

interface TraceEvent {
  timestamp: Date;
  type: 'call' | 'return' | 'error' | 'tool' | 'llm';
  data: unknown;
  duration?: number;
}
```

---

## 6. Phase 4: Platform (플랫폼) 🔄 IN PROGRESS

> 목표: CLI 외 Desktop/Web 플랫폼 지원

### 6.1 Feature List - API ✅ COMPLETED

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F4.1 | **REST API** | RESTful API 엔드포인트 (Fastify) | 🟠 P1 | ✅ 완료 |
| F4.2 | **WebSocket API** | 실시간 통신, 스트리밍 | 🟠 P1 | ✅ 완료 |
| F4.3 | **GraphQL API** | GraphQL 스키마, 리졸버 (Mercurius) | 🟡 P2 | ✅ 완료 |
| F4.4 | **API Authentication** | JWT, API 키 인증, RBAC | 🟠 P1 | ✅ 완료 |
| F4.5 | **Rate Limiting** | API 요청 제한, 메모리 스토어 | 🟡 P2 | ✅ 완료 |

**API 구현 완료 (2026-01-10)**: 444개 테스트 통과
- `src/api/server/` - ApiServer, WsServer
- `src/api/auth/` - JWT, API Key, RBAC 미들웨어
- `src/api/routes/` - Agents, Tools, Workflows, Hooks 라우터
- `src/api/graphql/` - 스키마, Query/Mutation/Subscription 리졸버
- `src/api/ratelimit/` - Rate limiter 서비스 및 미들웨어
- `src/api/middleware/` - Error, Logging, Validation 미들웨어

### 6.2 Feature List - Desktop ✅ COMPLETED

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F4.10 | **Tauri Setup** | Tauri 프로젝트 설정 | 🟡 P2 | ✅ 완료 |
| F4.11 | **IPC Bridge** | Rust ↔ JS 통신 | 🟡 P2 | ✅ 완료 |
| F4.12 | **Local Storage** | 로컬 데이터 관리 | 🟡 P2 | ✅ 완료 |
| F4.13 | **System Tray** | 시스템 트레이 통합 | 🟢 P3 | ✅ 완료 |
| F4.14 | **Auto Update** | 자동 업데이트 | 🟢 P3 | ✅ 완료 |

**Desktop 구현 완료 (2026-01-10)**:
- `desktop/src-tauri/` - Tauri 2.x Rust 백엔드
  - `main.rs` - 앱 진입점, 플러그인 초기화
  - `state.rs` - 앱 상태 관리 (ApiConfig, ConnectionState)
  - `config.rs` - 설정 영속화 (tauri-plugin-store)
  - `tray.rs` - 시스템 트레이 (메뉴, 이벤트)
  - `api.rs` - API 클라이언트 (reqwest, JSON)
  - `updater.rs` - 자동 업데이트 (tauri-plugin-updater)
  - `commands/` - IPC 커맨드 (agent, workflow, config, system, storage)
- `desktop/src/` - React + TypeScript 프론트엔드
  - `App.tsx` - 라우팅, 상태 동기화
  - `types/` - IPC 타입 정의
  - `hooks/useTauri.ts` - Tauri IPC 훅
  - `store/` - Zustand 전역 상태
  - `components/` - Layout, Card, StatusBadge
  - `pages/` - Dashboard, Agents, Workflows, Settings

### 6.3 Feature List - Web ✅ COMPLETED

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F4.20 | **Dashboard UI** | 대시보드 기본 UI | 🟡 P2 | ✅ 완료 |
| F4.21 | **Project Manager** | 프로젝트 관리 UI | 🟡 P2 | ✅ 완료 |
| F4.22 | **Workflow Monitor** | 워크플로우 모니터링 | 🟡 P2 | ✅ 완료 |
| F4.23 | **Agent Status** | 에이전트 상태 뷰 | 🟡 P2 | ✅ 완료 |
| F4.24 | **Log Viewer** | 실시간 로그 뷰어 | 🟡 P2 | ✅ 완료 |

**Web 구현 완료 (2026-01-10)**:
- `web/` - React + TypeScript + Vite 프론트엔드
  - `src/pages/Dashboard.tsx` - 통계 카드, 활동 차트, 최근 활동
  - `src/pages/Projects.tsx` - 프로젝트 CRUD, 검색/필터
  - `src/pages/Workflows.tsx` - 워크플로우 모니터링, 단계 확장
  - `src/pages/Agents.tsx` - 에이전트 상태, CPU/메모리 메트릭
  - `src/pages/Logs.tsx` - 실시간 로그, 레벨 필터, 내보내기
  - `src/components/Layout.tsx` - 사이드바 레이아웃
  - `src/hooks/useApi.ts` - React Query 훅
  - `src/store/appStore.ts` - Zustand 상태 관리
  - `src/api/client.ts` - REST API 클라이언트

---

## 7. Phase 5: Enterprise & Security (확장 및 보안) ✅ COMPLETED

> 목표: 보안 강화, 팀 협업, 엔터프라이즈 기능
>
> **완료일**: 2026-01-11 | **테스트**: 428개 통과 (Security 144 + Enterprise 284)

### 7.1 Feature List - Security ✅ COMPLETED

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F5.1 | **Plugin Security** | 플러그인 검증, 샌드박스, 코드 스캔 | 🟠 P1 | ✅ 완료 |
| F5.2 | **Trust System** | 신뢰 레벨 관리, 화이트/블랙리스트 | 🟠 P1 | ✅ 완료 |
| F5.3 | **Permission System** | RBAC 권한 관리, Subject/Role/Policy | 🟠 P1 | ✅ 완료 |
| F5.4 | **Audit Logging** | 감사 이벤트 로깅, 알림, 보존 정책 | 🟠 P1 | ✅ 완료 |
| F5.5 | **Secret Management** | AES-256-GCM 암호화, 버전 관리, Env 연동 | 🟠 P1 | ✅ 완료 |
| F5.6 | **Code Scanning** | 정적 분석, 의존성 취약점, 시크릿 탐지 (심화) | 🟡 P2 | ✅ 완료 |

**Security 코어 구현 완료 (2026-01-11)**:
- `src/core/security/plugin/` - PluginSecurityManager (검증, 샌드박스, 코드 스캔)
- `src/core/security/trust/` - TrustManager (5단계 신뢰 레벨, 화이트/블랙리스트)
- `src/core/security/permission/` - PermissionManager (RBAC, Subject, Role, Policy)
- `src/core/security/audit/` - AuditManager (이벤트 로깅, 알림, Export)
- `src/core/security/secret/` - SecretManager (암호화, 버전 관리, 환경변수)
- `src/core/security/scanning/` - CodeScanner (144 tests)
  - StaticAnalyzer: 40+ 보안 규칙 (eval, SQL Injection, XSS, Path Traversal 등)
  - DependencyScanner: CVE 데이터베이스 기반 취약점 탐지 (npm/pip/go)
  - SecretDetector: 30+ 시크릿 패턴 (AWS, GitHub, Slack, Stripe, JWT 등)
  - 리포트 생성: SARIF, JSON, HTML, Text 형식 지원

### 7.2 Feature List - Enterprise ✅ COMPLETED

| ID | Feature | 설명 | 우선순위 | 상태 |
|----|---------|------|----------|------|
| F5.10 | **Team Management** | 팀 관리, 멤버 역할, 초대 시스템 | 🔵 P4 | ✅ 완료 (66 tests) |
| F5.11 | **Multi-Repo** | 다중 레포지토리 관리 | 🔵 P4 | ✅ 완료 |
| F5.12 | **SSO Integration** | SSO 연동 (SAML, OIDC) | 🔵 P4 | ✅ 완료 |
| F5.13 | **Usage Analytics** | 사용량 분석, 리포트 | 🔵 P4 | ✅ 완료 |
| F5.14 | **Custom Workflows** | 커스텀 워크플로우 빌더 | 🔵 P4 | ✅ 완료 |

**Enterprise 구현 완료 (2026-01-11)**: 284개 테스트 통과
- `src/core/enterprise/team/` - TeamManager (팀 CRUD, 멤버/초대 관리, 권한, 활동 로그)
- `src/core/enterprise/multi-repo/` - MultiRepoManager (다중 저장소 관리)
- `src/core/enterprise/sso/` - SSOManager (SAML 2.0, OIDC 지원)
- `src/core/enterprise/analytics/` - AnalyticsManager (사용량 분석, 리포팅)
- `src/core/enterprise/workflow/` - WorkflowManager (커스텀 워크플로우 빌더)

### 7.3 상세 스펙

#### F5.1 Plugin Security
```typescript
interface IPluginSecurityManager {
  // 플러그인 검증
  verify(plugin: IPlugin): Promise<VerificationResult>;

  // 샌드박스 실행
  runInSandbox<T>(plugin: IPlugin, fn: () => T): Promise<T>;

  // 코드 스캔
  scanCode(code: string): Promise<ScanResult>;

  // 네트워크 제한
  setNetworkPolicy(pluginId: string, policy: NetworkPolicy): void;

  // 파일 시스템 제한
  setFSPolicy(pluginId: string, policy: FSPolicy): void;
}

interface VerificationResult {
  verified: boolean;
  trustLevel: TrustLevel;
  issues: SecurityIssue[];
  signature?: string;
}
```

#### F5.2 Trust System
```typescript
interface ITrustManager {
  // 화이트리스트 관리
  addToWhitelist(id: string, source: 'official' | 'verified' | 'user'): void;
  removeFromWhitelist(id: string): void;
  isWhitelisted(id: string): boolean;

  // 신뢰 레벨
  getTrustLevel(id: string): TrustLevel;
  setTrustLevel(id: string, level: TrustLevel): void;

  // 신뢰 소스
  addTrustSource(source: TrustSource): void;
  getTrustSources(): TrustSource[];
}

enum TrustLevel {
  BLOCKED = -1,     // 차단됨
  UNTRUSTED = 0,    // 미신뢰 (샌드박스 필수)
  VERIFIED = 1,     // 검증됨 (제한적 신뢰)
  TRUSTED = 2,      // 신뢰됨
  BUILTIN = 3,      // 내장 (완전 신뢰)
}
```

---

## 8. 우선순위 요약

### 8.1 Critical (P0) - 없으면 프로젝트 불가

| Phase | Feature IDs | 설명 |
|-------|-------------|------|
| 0 | F0.1, F0.2, F0.6, F0.8, F0.9, F0.10 | 코어 인터페이스, DI, 이벤트, 테스트, 토큰 예산, 에러 복구 |
| 1 | F1.1-F1.3, F1.5, F1.11, F1.13, F1.14 | 에이전트 기반, 코더 리팩, 통신, 테스트 프레임워크 |
| 2 | F2.1-F2.3, F2.5 | 워크플로우 정의/엔진, 오케스트레이터 |
| 3 | F3.1, F3.4, F3.6, F3.10 | 도구/훅 레지스트리, Git, 파일 |

### 8.2 High (P1) - 초기 릴리스 필수

| Phase | Feature IDs | 설명 |
|-------|-------------|------|
| 0 | F0.4, F0.5 | 로깅, 에러 처리 |
| 1 | F1.4, F1.6-F1.7, F1.12 | Architect, Reviewer, Tester, 백그라운드 |
| 2 | F2.4, F2.6-F2.7, F2.11-F2.13 | 상태 머신, 진행 추적, 롤백, A2A 프로토콜 |
| 3 | F3.2-F3.3, F3.11-F3.13, F3.16, F3.19, F3.20 | LSP, AST, 훅들, MCP 모니터, 세션 관리 |
| 4 | F4.1-F4.2, F4.4 | REST/WS API, 인증 |
| 5 | F5.1-F5.5 | 보안 핵심 |

### 8.3 타임라인

```
Week 1-4:   Phase 0 (Foundation)
Week 5-10:  Phase 1 (Core Agents)
Week 11-14: Phase 2 (Workflow)
Week 15-18: Phase 3 (Tools & Hooks)
Week 19-26: Phase 4 (Platform)
Week 27+:   Phase 5 (Enterprise)
```

---

## 9. 의존성 그래프

```
F0.1 (Interfaces)
  ├── F0.2 (DI)
  │     └── F1.2 (Agent Factory)
  │           └── F1.3 (Agent Registry)
  │                 └── F2.5 (Orchestrator)
  ├── F0.6 (Event System)
  │     ├── F1.11 (Agent Communication)
  │     ├── F3.10 (Hook Registry)
  │     └── F3.19 (MCP Health Monitor)
  ├── F0.9 (Token Budget Manager)
  │     └── F1.1 (Base Agent) ─── 모든 에이전트 토큰 관리
  ├── F0.10 (Error Recovery)
  │     ├── F1.1 (Base Agent) ─── 에이전트 복구 전략
  │     └── F3.19 (MCP Health Monitor) ─── 자동 복구
  └── F1.1 (Base Agent)
        ├── F1.4 (Architect)
        ├── F1.5 (Coder)
        ├── F1.6 (Reviewer)
        └── F1.7 (Tester)

F1.13 (Agent Testing Framework)
  ├── F1.14 (Mock LLM Client)
  ├── F0.8 (Test Infrastructure)
  └── F1.1 (Base Agent) ─── 테스트 대상

F2.1 (Workflow Definition)
  └── F2.2 (Workflow Engine)
        ├── F2.3 (Step Executor)
        └── F2.5 (Orchestrator)
              ├── F2.11 (A2A Server) ─── 외부 에이전트 협업
              └── F4.1 (REST API)

F2.11 (A2A Protocol Server)
  ├── F2.12 (A2A Client)
  ├── F2.13 (Agent Card System)
  └── F2.14 (MCP + A2A Hybrid)
        └── F3.7 (MCP Integration)

F3.1 (Tool Registry)
  ├── F3.2 (LSP)
  ├── F3.3 (AST-Grep)
  └── F3.4 (Git)

F3.19 (MCP Health Monitor)
  └── F3.7 (MCP Integration)
        └── 모든 MCP 서버 상태 관리

F3.20 (Session Manager)
  ├── F0.6 (Event System)
  ├── F3.13 (Session Recovery)
  └── F1.3 (Agent Registry) ─── 에이전트 상태 포함

F3.21 (Debug Toolkit)
  ├── F0.7 (Metrics Foundation)
  ├── F1.1 (Base Agent) ─── 에이전트 추적
  └── F3.19 (MCP Health Monitor) ─── 상태 검사

F5.1 (Plugin Security)
  └── F5.2 (Trust System)
        └── All Plugin Loading
```

---

## 10. 다음 문서

- **REFACTORING_PLAN.md**: 기존 코드 리팩토링 상세 계획
- **MODULE_DESIGN.md**: 각 모듈별 상세 설계
