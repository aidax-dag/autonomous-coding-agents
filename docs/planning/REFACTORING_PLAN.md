# Refactoring Plan: autonomous-coding-agents → CodeAvengers

> 기존 코드를 SOLID 원칙 기반으로 리팩토링하는 상세 계획

---

## 1. 현재 코드 분석

### 1.1 현재 디렉토리 구조

```
src/
├── agents/
│   ├── base/
│   │   ├── agent.ts          # BaseAgent (459 lines) - 리팩토링 필요
│   │   ├── types.ts          # 타입 정의
│   │   └── index.ts
│   ├── coder/
│   │   ├── coder-agent.ts    # CoderAgent (569 lines) - 리팩토링 필요
│   │   └── index.ts
│   ├── reviewer/
│   │   ├── reviewer-agent.ts
│   │   └── index.ts
│   ├── repo-manager/
│   │   ├── repo-manager-agent.ts
│   │   └── index.ts
│   └── manager/
│       ├── agent-manager.ts
│       └── index.ts
├── shared/
│   ├── llm/                  # LLM 클라이언트
│   ├── messaging/            # NATS
│   ├── github/               # GitHub API
│   ├── git/                  # Git 작업
│   ├── analysis/             # 코드 분석
│   ├── ci/                   # CI 통합
│   ├── feedback/             # 피드백
│   ├── notifications/        # 알림
│   ├── logging/              # 로깅
│   ├── errors/               # 에러
│   └── config/               # 설정
├── server/                   # Webhook 서버
├── cli/                      # CLI
├── bin/                      # 실행 스크립트
└── test/                     # 테스트
```

### 1.2 현재 문제점

| 문제 | 위치 | 영향 | 우선순위 |
|------|------|------|----------|
| **God Class** | `BaseAgent` | 단일 책임 위반, 확장 어려움 | 🔴 P0 |
| **하드코딩** | LLM API 키 | 환경 변경 어려움 | 🔴 P0 |
| **밀결합** | 에이전트 ↔ NATS | 테스트/교체 어려움 | 🟠 P1 |
| **인터페이스 부재** | 전체 | 모킹/스텁 어려움 | 🔴 P0 |
| **DI 없음** | 전체 | 유연성 부족 | 🔴 P0 |
| **훅 시스템 없음** | - | 확장 불가 | 🟠 P1 |
| **도구 추상화 부재** | Git, Shell | 재사용 어려움 | 🟠 P1 |

### 1.3 SOLID 위반 사항

#### S - Single Responsibility 위반
```typescript
// 현재 BaseAgent가 담당하는 것들:
// 1. 에이전트 생명주기
// 2. LLM 클라이언트 관리
// 3. NATS 메시지 처리
// 4. 작업 큐 관리
// 5. 메트릭 수집
// 6. 이벤트 발행
// 7. 헬스 체크
// → 7개 책임 = SRP 심각한 위반
```

#### O - Open/Closed 위반
```typescript
// 새 에이전트 타입 추가 시 수정 필요한 파일들:
// - types.ts (enum 수정)
// - agent-manager.ts (switch문 수정)
// - bin/ (새 시작 스크립트)
// → 확장에 닫혀 있음
```

#### D - Dependency Inversion 위반
```typescript
// 구체 클래스에 직접 의존
this.llmClient = createLLMClient(...);  // 추상화 없음
this.natsClient = new NatsClient(...);   // 추상화 없음
```

---

## 2. 리팩토링 단계

### 2.1 Stage 1: 인터페이스 추출 (Week 1)

#### 목표
- 모든 핵심 컴포넌트에 인터페이스 정의
- 구현체와 계약 분리

#### 작업 목록

| 작업 | 파일 | 설명 |
|------|------|------|
| R1.1 | `src/core/interfaces/agent.interface.ts` | IAgent 인터페이스 |
| R1.2 | `src/core/interfaces/tool.interface.ts` | ITool 인터페이스 |
| R1.3 | `src/core/interfaces/hook.interface.ts` | IHook 인터페이스 |
| R1.4 | `src/core/interfaces/llm.interface.ts` | ILLMClient 인터페이스 |
| R1.5 | `src/core/interfaces/messaging.interface.ts` | IMessageBroker 인터페이스 |
| R1.6 | `src/core/interfaces/storage.interface.ts` | IStorage 인터페이스 |

#### R1.1 IAgent 인터페이스

```typescript
// src/core/interfaces/agent.interface.ts

export interface IAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly capabilities: AgentCapability[];

  // 생명주기
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;

  // 작업 처리
  canHandle(task: Task): boolean;
  processTask(task: Task): Promise<TaskResult>;

  // 상태
  getState(): AgentState;
  getHealth(): HealthStatus;
  getMetrics(): AgentMetrics;
}

export interface IAgentFactory {
  create(type: AgentType, config: AgentConfig): IAgent;
  register(type: AgentType, factory: AgentConstructor): void;
}

export interface IAgentRegistry {
  register(agent: IAgent): void;
  unregister(agentId: string): void;
  get(agentId: string): IAgent | undefined;
  getByType(type: AgentType): IAgent[];
  getAll(): IAgent[];
}
```

#### R1.5 IMessageBroker 인터페이스

```typescript
// src/core/interfaces/messaging.interface.ts

export interface IMessageBroker {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  publish<T>(topic: string, message: T): Promise<void>;
  subscribe<T>(topic: string, handler: MessageHandler<T>): Promise<Subscription>;
  unsubscribe(subscription: Subscription): Promise<void>;

  request<TReq, TRes>(topic: string, message: TReq, timeout?: number): Promise<TRes>;
}

export type MessageHandler<T> = (message: T) => void | Promise<void>;

export interface Subscription {
  id: string;
  topic: string;
  unsubscribe(): Promise<void>;
}
```

### 2.2 Stage 2: DI 컨테이너 구현 (Week 1)

#### 목표
- 의존성 주입 컨테이너 구현
- 서비스 등록/해결 패턴

#### 작업 목록

| 작업 | 파일 | 설명 |
|------|------|------|
| R2.1 | `src/core/di/container.ts` | DI 컨테이너 |
| R2.2 | `src/core/di/tokens.ts` | 의존성 토큰 정의 |
| R2.3 | `src/core/di/decorators.ts` | @Injectable, @Inject 데코레이터 |
| R2.4 | `src/core/di/module.ts` | 모듈 정의 |

#### R2.1 DI Container

```typescript
// src/core/di/container.ts

export interface IContainer {
  // 등록
  register<T>(token: Token<T>, provider: Provider<T>): void;
  registerSingleton<T>(token: Token<T>, provider: Provider<T>): void;
  registerInstance<T>(token: Token<T>, instance: T): void;

  // 해결
  resolve<T>(token: Token<T>): T;
  resolveAsync<T>(token: Token<T>): Promise<T>;
  tryResolve<T>(token: Token<T>): T | undefined;

  // 스코프
  createScope(): IContainer;
  dispose(): void;
}

export class Container implements IContainer {
  private bindings = new Map<symbol, Binding>();
  private instances = new Map<symbol, any>();
  private parent?: Container;

  register<T>(token: Token<T>, provider: Provider<T>): void {
    this.bindings.set(token.symbol, {
      provider,
      lifecycle: 'transient',
    });
  }

  registerSingleton<T>(token: Token<T>, provider: Provider<T>): void {
    this.bindings.set(token.symbol, {
      provider,
      lifecycle: 'singleton',
    });
  }

  resolve<T>(token: Token<T>): T {
    const binding = this.bindings.get(token.symbol);
    if (!binding) {
      if (this.parent) return this.parent.resolve(token);
      throw new Error(`No binding for ${token.name}`);
    }

    if (binding.lifecycle === 'singleton') {
      if (!this.instances.has(token.symbol)) {
        this.instances.set(token.symbol, binding.provider(this));
      }
      return this.instances.get(token.symbol);
    }

    return binding.provider(this);
  }
}
```

#### R2.2 Tokens

```typescript
// src/core/di/tokens.ts

export const TOKENS = {
  // 인프라
  MessageBroker: createToken<IMessageBroker>('MessageBroker'),
  Storage: createToken<IStorage>('Storage'),
  Cache: createToken<ICache>('Cache'),
  Logger: createToken<ILogger>('Logger'),

  // LLM
  LLMClient: createToken<ILLMClient>('LLMClient'),
  LLMFactory: createToken<ILLMFactory>('LLMFactory'),

  // 에이전트
  AgentFactory: createToken<IAgentFactory>('AgentFactory'),
  AgentRegistry: createToken<IAgentRegistry>('AgentRegistry'),

  // 도구
  ToolRegistry: createToken<IToolRegistry>('ToolRegistry'),

  // 훅
  HookRegistry: createToken<IHookRegistry>('HookRegistry'),

  // 서비스
  OrchestratorService: createToken<IOrchestratorService>('OrchestratorService'),
  ProjectService: createToken<IProjectService>('ProjectService'),
  WorkflowService: createToken<IWorkflowService>('WorkflowService'),
};
```

### 2.3 Stage 3: BaseAgent 분해 (Week 2)

#### 목표
- God Class 분해
- 단일 책임 원칙 적용

#### 분해 계획

```
현재 BaseAgent (7 책임)
         ↓
┌────────┴────────┐
│                 │
↓                 ↓
AgentLifecycle    AgentTaskProcessor
(생명주기)         (작업 처리)
     │                  │
     ↓                  ↓
AgentMetrics      AgentEventEmitter
(메트릭)           (이벤트)
     │                  │
     ↓                  ↓
AgentHealth       AgentQueue
(헬스체크)         (작업 큐)
```

#### 작업 목록

| 작업 | 파일 | 설명 |
|------|------|------|
| R3.1 | `src/agents/core/lifecycle-manager.ts` | 생명주기 관리 |
| R3.2 | `src/agents/core/task-processor.ts` | 작업 처리 |
| R3.3 | `src/agents/core/event-emitter.ts` | 이벤트 발행 |
| R3.4 | `src/agents/core/metrics-collector.ts` | 메트릭 수집 |
| R3.5 | `src/agents/core/health-checker.ts` | 헬스 체크 |
| R3.6 | `src/agents/core/task-queue.ts` | 작업 큐 |
| R3.7 | `src/agents/base/base-agent.ts` | 새 BaseAgent (조합) |

#### R3.7 새 BaseAgent

```typescript
// src/agents/base/base-agent.ts

export abstract class BaseAgent implements IAgent {
  protected readonly lifecycle: IAgentLifecycle;
  protected readonly taskProcessor: ITaskProcessor;
  protected readonly eventEmitter: IAgentEventEmitter;
  protected readonly metricsCollector: IMetricsCollector;
  protected readonly healthChecker: IHealthChecker;
  protected readonly taskQueue: ITaskQueue;

  constructor(
    protected readonly config: AgentConfig,
    protected readonly container: IContainer,
  ) {
    // DI로 의존성 주입
    this.lifecycle = container.resolve(TOKENS.AgentLifecycle);
    this.taskProcessor = container.resolve(TOKENS.TaskProcessor);
    this.eventEmitter = container.resolve(TOKENS.AgentEventEmitter);
    this.metricsCollector = container.resolve(TOKENS.MetricsCollector);
    this.healthChecker = container.resolve(TOKENS.HealthChecker);
    this.taskQueue = container.resolve(TOKENS.TaskQueue);
  }

  // IAgent 구현 - 각 컴포넌트에 위임
  async initialize(): Promise<void> {
    await this.lifecycle.initialize();
  }

  async processTask(task: Task): Promise<TaskResult> {
    return this.taskProcessor.process(task, this.executeTask.bind(this));
  }

  // 하위 클래스가 구현
  abstract executeTask(task: Task): Promise<TaskResult>;
  abstract getAgentType(): AgentType;
}
```

### 2.4 Stage 4: 훅 시스템 구현 (Week 2-3)

#### 목표
- 확장 가능한 훅 시스템
- oh-my-opencode 컨셉 적용

#### 작업 목록

| 작업 | 파일 | 설명 |
|------|------|------|
| R4.1 | `src/hooks/interfaces/hook.interface.ts` | IHook 인터페이스 |
| R4.2 | `src/hooks/registry/hook-registry.ts` | 훅 레지스트리 |
| R4.3 | `src/hooks/executor/hook-executor.ts` | 훅 실행기 |
| R4.4 | `src/hooks/builtin/context-monitor.ts` | 컨텍스트 모니터 훅 |
| R4.5 | `src/hooks/builtin/token-optimizer.ts` | 토큰 최적화 훅 |
| R4.6 | `src/hooks/builtin/code-quality.ts` | 코드 품질 훅 |
| R4.7 | `src/hooks/builtin/session-recovery.ts` | 세션 복구 훅 |

#### R4.2 Hook Registry

```typescript
// src/hooks/registry/hook-registry.ts

export interface IHookRegistry {
  register(hook: IHook): void;
  unregister(name: string): void;
  getByEvent(event: HookEvent): IHook[];
  getAll(): IHook[];
}

export class HookRegistry implements IHookRegistry {
  private hooks = new Map<string, IHook>();
  private eventIndex = new Map<HookEvent, Set<string>>();

  register(hook: IHook): void {
    this.hooks.set(hook.name, hook);

    // 이벤트 인덱스 업데이트
    if (!this.eventIndex.has(hook.event)) {
      this.eventIndex.set(hook.event, new Set());
    }
    this.eventIndex.get(hook.event)!.add(hook.name);
  }

  getByEvent(event: HookEvent): IHook[] {
    const names = this.eventIndex.get(event) || new Set();
    return Array.from(names)
      .map(name => this.hooks.get(name)!)
      .sort((a, b) => b.priority - a.priority); // 우선순위 정렬
  }
}
```

#### R4.3 Hook Executor

```typescript
// src/hooks/executor/hook-executor.ts

export interface IHookExecutor {
  execute(event: HookEvent, context: HookContext): Promise<HookChainResult>;
}

export class HookExecutor implements IHookExecutor {
  constructor(
    private readonly registry: IHookRegistry,
    private readonly logger: ILogger,
  ) {}

  async execute(event: HookEvent, context: HookContext): Promise<HookChainResult> {
    const hooks = this.registry.getByEvent(event);
    const results: HookResult[] = [];

    for (const hook of hooks) {
      try {
        if (!hook.shouldRun(context)) continue;

        const result = await hook.execute(context);
        results.push(result);

        // 중단 조건 체크
        if (result.action === 'abort') {
          return { aborted: true, reason: result.message, results };
        }

        // 컨텍스트 수정 반영
        if (result.modifiedContext) {
          Object.assign(context, result.modifiedContext);
        }
      } catch (error) {
        this.logger.error(`Hook ${hook.name} failed`, error);
        results.push({ action: 'error', error });
      }
    }

    return { aborted: false, results };
  }
}
```

### 2.5 Stage 5: 도구 시스템 구현 (Week 3)

#### 목표
- 통합 도구 인터페이스
- LSP, AST-Grep, Git 등 도구 추상화

#### 작업 목록

| 작업 | 파일 | 설명 |
|------|------|------|
| R5.1 | `src/tools/interfaces/tool.interface.ts` | ITool 인터페이스 |
| R5.2 | `src/tools/registry/tool-registry.ts` | 도구 레지스트리 |
| R5.3 | `src/tools/git/git-tool.ts` | Git 도구 |
| R5.4 | `src/tools/shell/shell-tool.ts` | Shell 도구 |
| R5.5 | `src/tools/file/file-tool.ts` | 파일 도구 |
| R5.6 | `src/tools/lsp/lsp-tool.ts` | LSP 도구 |
| R5.7 | `src/tools/ast-grep/ast-grep-tool.ts` | AST-Grep 도구 |

#### R5.1 Tool Interface

```typescript
// src/tools/interfaces/tool.interface.ts

export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly schema: ToolInputSchema;

  // 실행
  execute<TInput, TOutput>(params: TInput): Promise<ToolResult<TOutput>>;

  // 검증
  validate(params: unknown): ValidationResult;

  // 메타데이터
  getCapabilities(): ToolCapability[];
}

export interface IToolRegistry {
  register(tool: ITool): void;
  unregister(name: string): void;
  get(name: string): ITool | undefined;
  getByCategory(category: ToolCategory): ITool[];
  getAll(): ITool[];
  search(query: string): ITool[];
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ToolError;
  metadata: {
    duration: number;
    tokensUsed?: number;
  };
}
```

### 2.6 Stage 6: LLM 클라이언트 리팩토링 (Week 3-4)

#### 목표
- 구독 기반 인증 지원
- 다중 모델 오케스트레이션

#### 작업 목록

| 작업 | 파일 | 설명 |
|------|------|------|
| R6.1 | `src/llm/interfaces/llm.interface.ts` | ILLMClient 확장 |
| R6.2 | `src/llm/factory/llm-factory.ts` | LLM 팩토리 |
| R6.3 | `src/llm/clients/claude-client.ts` | Claude 클라이언트 리팩토링 |
| R6.4 | `src/llm/clients/openai-client.ts` | OpenAI 클라이언트 리팩토링 |
| R6.5 | `src/llm/clients/gemini-client.ts` | Gemini 클라이언트 리팩토링 |
| R6.6 | `src/llm/orchestrator/model-orchestrator.ts` | 모델 오케스트레이터 |
| R6.7 | `src/llm/auth/subscription-auth.ts` | 구독 인증 지원 |

#### R6.1 Enhanced LLM Interface

```typescript
// src/llm/interfaces/llm.interface.ts

export interface ILLMClient {
  readonly provider: LLMProvider;
  readonly model: string;
  readonly capabilities: LLMCapability[];

  // 기본 채팅
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResult>;
  chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatChunk>;

  // 도구 사용
  chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options?: ChatOptions
  ): Promise<ChatWithToolsResult>;

  // 토큰 관리
  countTokens(messages: Message[]): Promise<number>;
  getMaxTokens(): number;
  getRemainingTokens(used: number): number;

  // 헬스
  isAvailable(): Promise<boolean>;
  getUsage(): LLMUsage;
}

export interface ILLMFactory {
  create(provider: LLMProvider, config: LLMConfig): ILLMClient;
  createFromSubscription(subscription: Subscription): ILLMClient;
}

export interface IModelOrchestrator {
  // 작업별 모델 선택
  selectModel(task: TaskType): ILLMClient;

  // 다중 모델 실행 (리뷰 등)
  executeMultiple(
    clients: ILLMClient[],
    messages: Message[],
    aggregator: ResultAggregator
  ): Promise<AggregatedResult>;

  // 폴백
  executeWithFallback(
    primary: ILLMClient,
    fallbacks: ILLMClient[],
    messages: Message[]
  ): Promise<ChatResult>;
}
```

### 2.7 Stage 7: 에이전트 구현체 리팩토링 (Week 4)

#### 목표
- 기존 에이전트 새 구조로 마이그레이션
- 새 에이전트 추가 (Architect, Tester)

#### 작업 목록

| 작업 | 파일 | 설명 |
|------|------|------|
| R7.1 | `src/agents/architect/architect-agent.ts` | Architect 에이전트 (신규) |
| R7.2 | `src/agents/coder/coder-agent.ts` | Coder 에이전트 리팩토링 |
| R7.3 | `src/agents/reviewer/reviewer-agent.ts` | Reviewer 에이전트 리팩토링 |
| R7.4 | `src/agents/tester/tester-agent.ts` | Tester 에이전트 (신규) |
| R7.5 | `src/agents/doc-writer/doc-writer-agent.ts` | DocWriter 에이전트 (신규) |
| R7.6 | `src/agents/explorer/explorer-agent.ts` | Explorer 에이전트 (신규) |

---

## 3. 마이그레이션 전략

### 3.1 점진적 마이그레이션

```
Phase A: 인터페이스 추출 (기존 코드 유지)
    ↓
Phase B: 새 구현체 작성 (병렬)
    ↓
Phase C: 어댑터로 연결 (호환성 유지)
    ↓
Phase D: 전환 (feature flag)
    ↓
Phase E: 정리 (구 코드 제거)
```

### 3.2 호환성 어댑터

```typescript
// src/adapters/legacy-agent-adapter.ts

// 기존 코드와 새 인터페이스 연결
export class LegacyAgentAdapter implements IAgent {
  constructor(private readonly legacyAgent: LegacyBaseAgent) {}

  async processTask(task: Task): Promise<TaskResult> {
    // 기존 메서드 호출을 새 인터페이스로 변환
    const legacyResult = await this.legacyAgent.processTask(task);
    return this.convertResult(legacyResult);
  }

  // ... 변환 로직
}
```

### 3.3 Feature Flags

```typescript
// src/config/feature-flags.ts

export const FEATURE_FLAGS = {
  USE_NEW_AGENT_SYSTEM: env('FF_NEW_AGENT_SYSTEM', false),
  USE_NEW_HOOK_SYSTEM: env('FF_NEW_HOOK_SYSTEM', false),
  USE_NEW_TOOL_REGISTRY: env('FF_NEW_TOOL_REGISTRY', false),
};

// 사용
if (FEATURE_FLAGS.USE_NEW_AGENT_SYSTEM) {
  return container.resolve(TOKENS.AgentFactory);
} else {
  return new LegacyAgentFactory();
}
```

---

## 4. 테스트 전략

### 4.1 테스트 피라미드

```
        ╱╲
       ╱  ╲
      ╱ E2E╲        (10%)
     ╱──────╲
    ╱        ╲
   ╱Integration╲    (30%)
  ╱────────────╲
 ╱              ╲
╱     Unit       ╲  (60%)
──────────────────
```

### 4.2 테스트 작성 원칙

```typescript
// 모든 인터페이스에 대한 목 생성
export const createMockAgent = (): jest.Mocked<IAgent> => ({
  id: 'mock-agent',
  type: AgentType.CODER,
  initialize: jest.fn().mockResolvedValue(undefined),
  processTask: jest.fn().mockResolvedValue({ success: true }),
  getHealth: jest.fn().mockReturnValue({ healthy: true }),
  // ...
});

// 테스트 유틸리티
export const createTestContainer = (): IContainer => {
  const container = new Container();
  container.registerInstance(TOKENS.Logger, createMockLogger());
  container.registerInstance(TOKENS.MessageBroker, createMockBroker());
  return container;
};
```

### 4.3 리팩토링별 테스트

| Stage | 테스트 유형 | 커버리지 목표 |
|-------|-------------|---------------|
| 1 | 인터페이스 타입 테스트 | 100% |
| 2 | DI 컨테이너 단위 테스트 | 95% |
| 3 | BaseAgent 분해 단위 테스트 | 90% |
| 4 | 훅 시스템 통합 테스트 | 85% |
| 5 | 도구 시스템 통합 테스트 | 85% |
| 6 | LLM 클라이언트 모킹 테스트 | 80% |
| 7 | 에이전트 E2E 테스트 | 70% |

---

## 5. 파일 변경 요약

### 5.1 새로 생성할 파일

```
src/
├── core/
│   ├── interfaces/         # 10개 파일
│   ├── di/                 # 4개 파일
│   └── events/             # 3개 파일
├── agents/
│   ├── core/               # 6개 파일
│   ├── architect/          # 2개 파일
│   ├── tester/             # 2개 파일
│   ├── doc-writer/         # 2개 파일
│   └── explorer/           # 2개 파일
├── hooks/
│   ├── interfaces/         # 2개 파일
│   ├── registry/           # 2개 파일
│   ├── executor/           # 2개 파일
│   └── builtin/            # 8개 파일
├── tools/
│   ├── interfaces/         # 2개 파일
│   ├── registry/           # 2개 파일
│   ├── lsp/                # 3개 파일
│   └── ast-grep/           # 3개 파일
└── adapters/               # 3개 파일

총: ~60개 신규 파일
```

### 5.2 수정할 파일

```
src/agents/base/agent.ts          → 전면 리팩토링
src/agents/coder/coder-agent.ts   → 새 베이스 상속
src/agents/reviewer/*             → 새 베이스 상속
src/shared/llm/*                  → 인터페이스 적용
src/shared/messaging/*            → 인터페이스 적용
```

### 5.3 삭제할 파일 (Phase E)

```
src/agents/manager/agent-manager.ts  → AgentRegistry로 대체
src/agents/repo-manager/*            → Orchestrator로 통합
```

---

## 6. 리스크 및 대응

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| 기존 기능 회귀 | 중 | 높음 | 어댑터 + feature flag |
| 일정 지연 | 높음 | 중 | 단계별 릴리스 |
| 복잡도 증가 | 중 | 중 | 문서화, 코드 리뷰 |
| 팀 학습 곡선 | 중 | 낮음 | 가이드 문서 |

---

## 7. 체크리스트

### Stage 완료 기준

- [x] **Stage 1**: 모든 인터페이스 정의, 타입 테스트 통과 ✅ (2026-01-04)
- [x] **Stage 2**: DI 컨테이너 작동, 95% 커버리지 ✅ (2026-01-04)
- [x] **Stage 3**: BaseAgent 분해, 모든 단위 테스트 통과 ✅ (2026-01-04)
- [ ] **Stage 4**: 훅 시스템 작동, 내장 훅 5개 이상
- [ ] **Stage 5**: 도구 레지스트리 작동, 핵심 도구 5개
- [ ] **Stage 6**: LLM 클라이언트 작동, 다중 모델 지원
- [ ] **Stage 7**: 모든 에이전트 마이그레이션, E2E 테스트 통과

### 추가 완료 항목 (Phase 0 DX Layer)
- [x] **Token Budget Manager**: 예산 관리, 경고 시스템, withBudget 래퍼
- [x] **Error Recovery Library**: Retry, Circuit Breaker, Fallback, Timeout
- [x] **Mock LLM Client**: 패턴 매칭, 응답 시퀀스, 검증 유틸
- [x] **Event Bus**: Async pub/sub, 필터링, 우선순위, waitFor

### Phase 1 완료 항목 (2026-01-04)
- [x] **F0.3 Configuration System**: 환경별 설정 관리, Zod 스키마 검증
- [x] **F1.1 Agent Base Class**: DI 기반 BaseAgent, 생명주기 관리
- [x] **F1.2 Agent Factory**: 에이전트 생성 팩토리, 등록 시스템 (22 tests)
- [x] **F1.3 Agent Registry**: 에이전트 레지스트리, 조회/관리 (26 tests)
- [x] **F1.5 Coder Agent Refactor**: DI 기반 CoderAgent 리팩토링 (27 tests)
- [x] **F1.11 Agent Communication**: 에이전트 간 통신 프로토콜 (23 tests)

**총 테스트**: 217개 통과 | **커버리지**: 83.7%

---

## 8. 다음 문서

- **MODULE_DESIGN.md**: 각 모듈 상세 설계
