# Module Design: CodeAvengers

> SOLID 원칙 기반 각 모듈의 상세 설계

---

## 1. 설계 원칙 요약

### 1.1 SOLID 적용 기준

| 원칙 | 적용 방법 | 검증 방법 |
|------|-----------|-----------|
| **S** - Single Responsibility | 각 클래스는 하나의 변경 이유만 가짐 | 클래스당 책임 1개 확인 |
| **O** - Open/Closed | 확장에 열림, 수정에 닫힘 | 새 기능 추가 시 기존 코드 수정 불필요 확인 |
| **L** - Liskov Substitution | 파생 클래스는 기반 클래스 대체 가능 | 모든 구현체가 인터페이스 계약 준수 |
| **I** - Interface Segregation | 작은 역할별 인터페이스 | 인터페이스당 메서드 5개 이하 권장 |
| **D** - Dependency Inversion | 추상화에 의존 | 모든 의존성이 인터페이스를 통해 주입 |

### 1.2 모듈 구조 템플릿

```
module/
├── interfaces/           # 인터페이스 정의
│   └── *.interface.ts
├── impl/                 # 구현체
│   └── *.impl.ts
├── types/                # 타입 정의
│   └── *.types.ts
├── errors/               # 모듈 특화 에러
│   └── *.error.ts
├── __tests__/            # 테스트
│   ├── *.spec.ts
│   └── *.integration.ts
└── index.ts              # 공개 API
```

---

## 2. Core 모듈

### 2.1 DI Container 모듈

```
src/core/di/
├── interfaces/
│   ├── container.interface.ts
│   ├── provider.interface.ts
│   └── scope.interface.ts
├── impl/
│   ├── container.impl.ts
│   └── scope.impl.ts
├── tokens/
│   ├── tokens.ts
│   └── create-token.ts
├── decorators/
│   ├── injectable.decorator.ts
│   ├── inject.decorator.ts
│   └── optional.decorator.ts
└── index.ts
```

#### 2.1.1 IContainer 인터페이스

```typescript
// src/core/di/interfaces/container.interface.ts

/**
 * 의존성 주입 컨테이너 인터페이스
 *
 * SOLID 원칙:
 * - S: 의존성 등록/해결만 담당
 * - I: 핵심 기능만 노출
 * - D: 추상화된 Provider에 의존
 */
export interface IContainer {
  // === 등록 (Registration) ===

  /**
   * 일시적(transient) 의존성 등록
   * 요청할 때마다 새 인스턴스 생성
   */
  register<T>(token: Token<T>, provider: Provider<T>): this;

  /**
   * 싱글톤 의존성 등록
   * 최초 요청 시 인스턴스 생성, 이후 재사용
   */
  registerSingleton<T>(token: Token<T>, provider: Provider<T>): this;

  /**
   * 기존 인스턴스 등록
   */
  registerInstance<T>(token: Token<T>, instance: T): this;

  /**
   * 팩토리 함수 등록
   */
  registerFactory<T>(token: Token<T>, factory: Factory<T>): this;

  // === 해결 (Resolution) ===

  /**
   * 동기 해결 - 없으면 예외
   */
  resolve<T>(token: Token<T>): T;

  /**
   * 비동기 해결 - 비동기 초기화 지원
   */
  resolveAsync<T>(token: Token<T>): Promise<T>;

  /**
   * 안전한 해결 - 없으면 undefined
   */
  tryResolve<T>(token: Token<T>): T | undefined;

  /**
   * 모든 구현체 해결 (다중 등록)
   */
  resolveAll<T>(token: Token<T>): T[];

  // === 스코프 (Scope) ===

  /**
   * 자식 스코프 생성
   */
  createScope(name?: string): IScope;

  /**
   * 리소스 정리
   */
  dispose(): Promise<void>;
}
```

#### 2.1.2 Token 시스템

```typescript
// src/core/di/tokens/tokens.ts

import { createToken } from './create-token';

/**
 * 의존성 토큰 정의
 *
 * 네이밍 규칙:
 * - 인프라: Infra* 또는 서비스명
 * - 에이전트: Agent*
 * - 도구: Tool*
 * - 서비스: *Service
 */
export const TOKENS = {
  // === 인프라 계층 ===
  Logger: createToken<ILogger>('Logger'),
  Config: createToken<IConfig>('Config'),
  MessageBroker: createToken<IMessageBroker>('MessageBroker'),
  Database: createToken<IDatabase>('Database'),
  Cache: createToken<ICache>('Cache'),
  EventBus: createToken<IEventBus>('EventBus'),

  // === LLM 계층 ===
  LLMFactory: createToken<ILLMFactory>('LLMFactory'),
  LLMClient: createToken<ILLMClient>('LLMClient'),
  ModelOrchestrator: createToken<IModelOrchestrator>('ModelOrchestrator'),

  // === 에이전트 계층 ===
  AgentFactory: createToken<IAgentFactory>('AgentFactory'),
  AgentRegistry: createToken<IAgentRegistry>('AgentRegistry'),
  AgentLifecycle: createToken<IAgentLifecycle>('AgentLifecycle'),
  TaskProcessor: createToken<ITaskProcessor>('TaskProcessor'),

  // === 도구 계층 ===
  ToolRegistry: createToken<IToolRegistry>('ToolRegistry'),
  ToolExecutor: createToken<IToolExecutor>('ToolExecutor'),

  // === 훅 계층 ===
  HookRegistry: createToken<IHookRegistry>('HookRegistry'),
  HookExecutor: createToken<IHookExecutor>('HookExecutor'),

  // === 서비스 계층 ===
  OrchestratorService: createToken<IOrchestratorService>('OrchestratorService'),
  ProjectService: createToken<IProjectService>('ProjectService'),
  WorkflowService: createToken<IWorkflowService>('WorkflowService'),
  AgentService: createToken<IAgentService>('AgentService'),

  // === 보안 계층 ===
  SecurityManager: createToken<ISecurityManager>('SecurityManager'),
  PermissionManager: createToken<IPermissionManager>('PermissionManager'),
  AuditLogger: createToken<IAuditLogger>('AuditLogger'),
} as const;
```

#### 2.1.3 데코레이터

```typescript
// src/core/di/decorators/injectable.decorator.ts

/**
 * 클래스를 DI 컨테이너에서 주입 가능하게 표시
 *
 * @example
 * @Injectable()
 * class MyService implements IMyService {
 *   constructor(
 *     @Inject(TOKENS.Logger) private logger: ILogger,
 *   ) {}
 * }
 */
export function Injectable(options?: InjectableOptions): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(INJECTABLE_KEY, true, target);
    Reflect.defineMetadata(INJECTABLE_OPTIONS_KEY, options || {}, target);
    return target;
  };
}

// src/core/di/decorators/inject.decorator.ts

/**
 * 생성자 파라미터에 의존성 주입 표시
 */
export function Inject(token: Token<any>): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const existingInjections = Reflect.getMetadata(INJECT_KEY, target) || [];
    existingInjections.push({ index: parameterIndex, token });
    Reflect.defineMetadata(INJECT_KEY, existingInjections, target);
  };
}
```

### 2.2 Event System 모듈

```
src/core/events/
├── interfaces/
│   ├── event-bus.interface.ts
│   ├── event.interface.ts
│   └── event-handler.interface.ts
├── impl/
│   ├── event-bus.impl.ts
│   └── async-event-bus.impl.ts
├── types/
│   └── events.types.ts
└── index.ts
```

#### 2.2.1 IEventBus 인터페이스

```typescript
// src/core/events/interfaces/event-bus.interface.ts

/**
 * 이벤트 버스 인터페이스
 *
 * SOLID 원칙:
 * - S: 이벤트 발행/구독만 담당
 * - O: 새 이벤트 타입 추가 시 수정 불필요
 * - I: 발행자/구독자 인터페이스 분리
 */
export interface IEventBus {
  /**
   * 이벤트 발행 (동기)
   */
  emit<T extends IEvent>(event: T): void;

  /**
   * 이벤트 발행 (비동기, 모든 핸들러 완료 대기)
   */
  emitAsync<T extends IEvent>(event: T): Promise<void>;

  /**
   * 이벤트 구독
   */
  on<T extends IEvent>(
    eventType: EventType<T>,
    handler: IEventHandler<T>,
  ): Subscription;

  /**
   * 일회성 구독
   */
  once<T extends IEvent>(
    eventType: EventType<T>,
    handler: IEventHandler<T>,
  ): Subscription;

  /**
   * 구독 취소
   */
  off(subscription: Subscription): void;

  /**
   * 특정 이벤트의 모든 핸들러 제거
   */
  removeAllListeners(eventType?: EventType<any>): void;
}

/**
 * 발행자 전용 인터페이스 (ISP)
 */
export interface IEventPublisher {
  emit<T extends IEvent>(event: T): void;
  emitAsync<T extends IEvent>(event: T): Promise<void>;
}

/**
 * 구독자 전용 인터페이스 (ISP)
 */
export interface IEventSubscriber {
  on<T extends IEvent>(
    eventType: EventType<T>,
    handler: IEventHandler<T>,
  ): Subscription;
  once<T extends IEvent>(
    eventType: EventType<T>,
    handler: IEventHandler<T>,
  ): Subscription;
  off(subscription: Subscription): void;
}
```

#### 2.2.2 이벤트 타입 정의

```typescript
// src/core/events/types/events.types.ts

/**
 * 시스템 이벤트 타입
 */
export const SystemEvents = {
  // 에이전트 생명주기
  AgentStarted: 'system.agent.started',
  AgentStopped: 'system.agent.stopped',
  AgentError: 'system.agent.error',

  // 작업 생명주기
  TaskQueued: 'system.task.queued',
  TaskStarted: 'system.task.started',
  TaskCompleted: 'system.task.completed',
  TaskFailed: 'system.task.failed',

  // 워크플로우
  WorkflowStarted: 'system.workflow.started',
  WorkflowStepCompleted: 'system.workflow.step.completed',
  WorkflowCompleted: 'system.workflow.completed',
  WorkflowFailed: 'system.workflow.failed',

  // 도구
  ToolExecuted: 'system.tool.executed',
  ToolFailed: 'system.tool.failed',

  // 훅
  HookExecuted: 'system.hook.executed',
  HookFailed: 'system.hook.failed',

  // 시스템
  ContextThreshold: 'system.context.threshold',
  HealthCheck: 'system.health.check',
} as const;

/**
 * 이벤트 페이로드 타입
 */
export interface AgentStartedEvent extends IEvent {
  type: typeof SystemEvents.AgentStarted;
  payload: {
    agentId: string;
    agentType: AgentType;
    timestamp: Date;
  };
}

export interface TaskCompletedEvent extends IEvent {
  type: typeof SystemEvents.TaskCompleted;
  payload: {
    taskId: string;
    agentId: string;
    duration: number;
    result: TaskResult;
  };
}
```

---

## 3. Agent 모듈

### 3.1 Agent Core 모듈

```
src/agents/core/
├── interfaces/
│   ├── agent.interface.ts
│   ├── agent-lifecycle.interface.ts
│   ├── agent-factory.interface.ts
│   └── agent-registry.interface.ts
├── impl/
│   ├── lifecycle-manager.impl.ts
│   ├── task-processor.impl.ts
│   ├── event-emitter.impl.ts
│   ├── metrics-collector.impl.ts
│   ├── health-checker.impl.ts
│   └── task-queue.impl.ts
├── types/
│   ├── agent.types.ts
│   └── task.types.ts
└── index.ts
```

#### 3.1.1 IAgent 인터페이스

```typescript
// src/agents/core/interfaces/agent.interface.ts

/**
 * 에이전트 핵심 인터페이스
 *
 * SOLID 원칙:
 * - S: 에이전트의 핵심 계약만 정의
 * - L: 모든 에이전트 구현체가 완전 대체 가능
 * - I: 생명주기, 작업, 상태를 분리된 메서드로
 */
export interface IAgent {
  // === 식별 ===
  readonly id: string;
  readonly type: AgentType;
  readonly name: string;

  // === 생명주기 ===
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;

  // === 작업 처리 ===
  canHandle(task: Task): boolean;
  processTask(task: Task): Promise<TaskResult>;

  // === 상태 ===
  getState(): AgentState;
  getHealth(): HealthStatus;
  getCapabilities(): AgentCapability[];
  getMetrics(): AgentMetrics;
}

/**
 * 에이전트 상태 (불변)
 */
export interface AgentState {
  readonly status: AgentStatus;
  readonly currentTask: Task | null;
  readonly queuedTasks: number;
  readonly processedTasks: number;
  readonly lastActiveAt: Date | null;
}

export enum AgentStatus {
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  PROCESSING = 'processing',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}
```

#### 3.1.2 분해된 컴포넌트 인터페이스

```typescript
// src/agents/core/interfaces/agent-lifecycle.interface.ts

/**
 * 에이전트 생명주기 관리
 *
 * SRP: 생명주기 상태 전이만 담당
 */
export interface IAgentLifecycle {
  initialize(agent: IAgent): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;

  getStatus(): AgentStatus;
  onStatusChange(handler: StatusChangeHandler): Subscription;
}

// src/agents/core/interfaces/task-processor.interface.ts

/**
 * 작업 처리 담당
 *
 * SRP: 작업 실행 로직만 담당
 */
export interface ITaskProcessor {
  /**
   * 작업 처리 (에이전트의 executeTask 위임)
   */
  process<T extends Task>(
    task: T,
    executor: TaskExecutor<T>,
  ): Promise<TaskResult>;

  /**
   * 작업 검증
   */
  validate(task: Task): ValidationResult;

  /**
   * 작업 전처리
   */
  preProcess(task: Task): Promise<Task>;

  /**
   * 작업 후처리
   */
  postProcess(task: Task, result: TaskResult): Promise<TaskResult>;
}

// src/agents/core/interfaces/health-checker.interface.ts

/**
 * 헬스 체크 담당
 *
 * SRP: 에이전트 건강 상태 모니터링만 담당
 */
export interface IHealthChecker {
  check(): Promise<HealthStatus>;
  registerCheck(name: string, check: HealthCheck): void;
  unregisterCheck(name: string): void;
  startPeriodicCheck(intervalMs: number): void;
  stopPeriodicCheck(): void;
}

export interface HealthStatus {
  healthy: boolean;
  checks: Record<string, CheckResult>;
  lastCheckedAt: Date;
}

// src/agents/core/interfaces/metrics-collector.interface.ts

/**
 * 메트릭 수집 담당
 *
 * SRP: 메트릭 수집/보고만 담당
 */
export interface IMetricsCollector {
  // 카운터
  increment(name: string, value?: number, tags?: Tags): void;

  // 게이지
  gauge(name: string, value: number, tags?: Tags): void;

  // 히스토그램
  histogram(name: string, value: number, tags?: Tags): void;

  // 타이머
  startTimer(name: string, tags?: Tags): () => void;

  // 내보내기
  getMetrics(): AgentMetrics;
  reset(): void;
}
```

#### 3.1.3 Agent Factory

```typescript
// src/agents/core/interfaces/agent-factory.interface.ts

/**
 * 에이전트 팩토리 인터페이스
 *
 * SOLID 원칙:
 * - O: 새 에이전트 타입은 register로 추가 (기존 코드 수정 불필요)
 * - D: 팩토리를 통해 에이전트 생성 (직접 생성자 호출 금지)
 */
export interface IAgentFactory {
  /**
   * 에이전트 생성
   */
  create(type: AgentType, config: AgentConfig): IAgent;

  /**
   * 비동기 에이전트 생성 (초기화 포함)
   */
  createAsync(type: AgentType, config: AgentConfig): Promise<IAgent>;

  /**
   * 에이전트 클래스 등록 (OCP)
   */
  register<T extends IAgent>(
    type: AgentType,
    constructor: AgentConstructor<T>,
  ): void;

  /**
   * 지원하는 에이전트 타입 조회
   */
  getSupportedTypes(): AgentType[];

  /**
   * 특정 타입 지원 여부
   */
  supports(type: AgentType): boolean;
}

/**
 * 에이전트 생성자 타입
 */
export type AgentConstructor<T extends IAgent = IAgent> = new (
  config: AgentConfig,
  container: IContainer,
) => T;
```

#### 3.1.4 Agent Registry

```typescript
// src/agents/core/interfaces/agent-registry.interface.ts

/**
 * 에이전트 레지스트리 인터페이스
 *
 * SRP: 에이전트 인스턴스 추적/조회만 담당
 */
export interface IAgentRegistry {
  // === 등록 ===
  register(agent: IAgent): void;
  unregister(agentId: string): void;

  // === 조회 ===
  get(agentId: string): IAgent | undefined;
  getByType(type: AgentType): IAgent[];
  getAll(): IAgent[];

  // === 검색 ===
  find(predicate: (agent: IAgent) => boolean): IAgent[];
  findOne(predicate: (agent: IAgent) => boolean): IAgent | undefined;

  // === 상태 ===
  count(): number;
  countByType(type: AgentType): number;
  countByStatus(status: AgentStatus): number;

  // === 이벤트 ===
  onAgentRegistered(handler: AgentEventHandler): Subscription;
  onAgentUnregistered(handler: AgentEventHandler): Subscription;
}
```

### 3.2 BaseAgent 구현

```typescript
// src/agents/base/base-agent.ts

/**
 * 에이전트 기본 구현
 *
 * 컴포지션을 통해 분해된 컴포넌트들을 조합
 * Template Method 패턴으로 하위 클래스 확장점 제공
 */
@Injectable()
export abstract class BaseAgent implements IAgent {
  public readonly id: string;
  public readonly name: string;

  // 주입된 컴포넌트들
  protected readonly lifecycle: IAgentLifecycle;
  protected readonly taskProcessor: ITaskProcessor;
  protected readonly eventEmitter: IAgentEventEmitter;
  protected readonly metricsCollector: IMetricsCollector;
  protected readonly healthChecker: IHealthChecker;
  protected readonly taskQueue: ITaskQueue;
  protected readonly logger: ILogger;

  constructor(
    protected readonly config: AgentConfig,
    @Inject(TOKENS.Container) protected readonly container: IContainer,
  ) {
    this.id = config.id || generateId();
    this.name = config.name || `${this.type}-${this.id.slice(0, 8)}`;

    // DI로 컴포넌트 주입
    this.lifecycle = container.resolve(TOKENS.AgentLifecycle);
    this.taskProcessor = container.resolve(TOKENS.TaskProcessor);
    this.eventEmitter = container.resolve(TOKENS.AgentEventEmitter);
    this.metricsCollector = container.resolve(TOKENS.MetricsCollector);
    this.healthChecker = container.resolve(TOKENS.HealthChecker);
    this.taskQueue = container.resolve(TOKENS.TaskQueue);
    this.logger = container.resolve(TOKENS.Logger);
  }

  // === IAgent 구현 (위임) ===

  async initialize(): Promise<void> {
    this.logger.info(`Initializing agent: ${this.name}`);
    await this.lifecycle.initialize(this);
    await this.onInitialize(); // 훅
  }

  async start(): Promise<void> {
    await this.lifecycle.start();
    await this.onStart(); // 훅
    this.eventEmitter.emit({
      type: SystemEvents.AgentStarted,
      payload: { agentId: this.id, agentType: this.type },
    });
  }

  async stop(): Promise<void> {
    await this.onStop(); // 훅
    await this.lifecycle.stop();
    this.eventEmitter.emit({
      type: SystemEvents.AgentStopped,
      payload: { agentId: this.id },
    });
  }

  async dispose(): Promise<void> {
    await this.stop();
    await this.onDispose(); // 훅
  }

  canHandle(task: Task): boolean {
    return this.getCapabilities().some(cap =>
      cap.taskTypes.includes(task.type)
    );
  }

  async processTask(task: Task): Promise<TaskResult> {
    const timer = this.metricsCollector.startTimer('task.duration');

    try {
      this.metricsCollector.increment('task.started');

      // 전처리 → 실행 → 후처리
      const result = await this.taskProcessor.process(
        task,
        this.executeTask.bind(this),
      );

      this.metricsCollector.increment('task.completed');
      return result;

    } catch (error) {
      this.metricsCollector.increment('task.failed');
      throw error;
    } finally {
      timer(); // 타이머 종료
    }
  }

  getState(): AgentState {
    return {
      status: this.lifecycle.getStatus(),
      currentTask: this.taskQueue.getCurrent(),
      queuedTasks: this.taskQueue.size(),
      processedTasks: this.metricsCollector.getMetrics().processedTasks,
      lastActiveAt: this.metricsCollector.getMetrics().lastActiveAt,
    };
  }

  getHealth(): HealthStatus {
    return this.healthChecker.check();
  }

  getMetrics(): AgentMetrics {
    return this.metricsCollector.getMetrics();
  }

  // === 추상 메서드 (하위 클래스 구현) ===

  abstract get type(): AgentType;
  abstract getCapabilities(): AgentCapability[];
  abstract executeTask(task: Task): Promise<TaskResult>;

  // === 훅 포인트 (선택적 오버라이드) ===

  protected async onInitialize(): Promise<void> {}
  protected async onStart(): Promise<void> {}
  protected async onStop(): Promise<void> {}
  protected async onDispose(): Promise<void> {}
}
```

### 3.3 특화 에이전트 모듈

```
src/agents/
├── architect/
│   ├── architect-agent.ts
│   ├── capabilities.ts
│   └── index.ts
├── coder/
│   ├── coder-agent.ts
│   ├── capabilities.ts
│   └── index.ts
├── reviewer/
│   ├── reviewer-agent.ts
│   ├── review-strategies/
│   │   ├── code-review.strategy.ts
│   │   ├── security-review.strategy.ts
│   │   └── performance-review.strategy.ts
│   └── index.ts
├── tester/
│   ├── tester-agent.ts
│   ├── test-runners/
│   │   ├── unit-test.runner.ts
│   │   ├── integration-test.runner.ts
│   │   └── e2e-test.runner.ts
│   └── index.ts
└── doc-writer/
    ├── doc-writer-agent.ts
    └── index.ts
```

#### 3.3.1 CoderAgent

```typescript
// src/agents/coder/coder-agent.ts

/**
 * 코드 구현 에이전트
 *
 * 책임: 코드 생성, 수정, 리팩토링
 */
@Injectable()
export class CoderAgent extends BaseAgent {
  get type(): AgentType {
    return AgentType.CODER;
  }

  constructor(
    config: AgentConfig,
    container: IContainer,
    @Inject(TOKENS.LLMClient) private readonly llm: ILLMClient,
    @Inject(TOKENS.ToolRegistry) private readonly tools: IToolRegistry,
  ) {
    super(config, container);
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'code-generation',
        taskTypes: [TaskType.GENERATE_CODE],
        description: 'Generate code from specifications',
      },
      {
        name: 'code-modification',
        taskTypes: [TaskType.MODIFY_CODE, TaskType.REFACTOR],
        description: 'Modify or refactor existing code',
      },
      {
        name: 'bug-fix',
        taskTypes: [TaskType.FIX_BUG],
        description: 'Fix bugs in existing code',
      },
    ];
  }

  async executeTask(task: Task): Promise<TaskResult> {
    switch (task.type) {
      case TaskType.GENERATE_CODE:
        return this.generateCode(task as GenerateCodeTask);
      case TaskType.MODIFY_CODE:
        return this.modifyCode(task as ModifyCodeTask);
      case TaskType.REFACTOR:
        return this.refactorCode(task as RefactorTask);
      case TaskType.FIX_BUG:
        return this.fixBug(task as FixBugTask);
      default:
        throw new UnsupportedTaskError(task.type);
    }
  }

  private async generateCode(task: GenerateCodeTask): Promise<TaskResult> {
    // 1. LLM에 코드 생성 요청
    const response = await this.llm.chatWithTools(
      this.buildCodeGenPrompt(task),
      this.getAvailableTools(),
    );

    // 2. 도구 호출 처리
    const toolResults = await this.executeToolCalls(response.toolCalls);

    // 3. 결과 정리
    return {
      success: true,
      data: {
        files: toolResults.createdFiles,
        changes: toolResults.changes,
      },
    };
  }

  private getAvailableTools(): ToolDefinition[] {
    return [
      this.tools.get('file-write')!.toDefinition(),
      this.tools.get('file-read')!.toDefinition(),
      this.tools.get('shell')!.toDefinition(),
    ];
  }
}
```

#### 3.3.2 ReviewerAgent

```typescript
// src/agents/reviewer/reviewer-agent.ts

/**
 * 코드 리뷰 에이전트
 *
 * 책임: 코드 리뷰, 품질 검증
 * 특징: 다중 LLM 지원 (Gemini + GPT로 다중 관점)
 */
@Injectable()
export class ReviewerAgent extends BaseAgent {
  get type(): AgentType {
    return AgentType.REVIEWER;
  }

  constructor(
    config: AgentConfig,
    container: IContainer,
    @Inject(TOKENS.ModelOrchestrator) private readonly orchestrator: IModelOrchestrator,
    @Inject(TOKENS.ToolRegistry) private readonly tools: IToolRegistry,
  ) {
    super(config, container);
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'code-review',
        taskTypes: [TaskType.CODE_REVIEW],
        description: 'Review code for quality and issues',
      },
      {
        name: 'security-review',
        taskTypes: [TaskType.SECURITY_REVIEW],
        description: 'Review code for security vulnerabilities',
      },
    ];
  }

  async executeTask(task: Task): Promise<TaskResult> {
    const reviewTask = task as ReviewTask;

    // 다중 모델로 리뷰 실행
    const reviews = await this.orchestrator.executeMultiple(
      [
        this.orchestrator.selectModel('review-gemini'),
        this.orchestrator.selectModel('review-gpt'),
      ],
      this.buildReviewPrompt(reviewTask),
      new ReviewAggregator(),
    );

    return {
      success: true,
      data: {
        reviews: reviews.results,
        consensus: reviews.aggregated,
        suggestions: reviews.suggestions,
      },
    };
  }
}
```

---

## 4. Tool 모듈

### 4.1 Tool Core 모듈

```
src/tools/
├── core/
│   ├── interfaces/
│   │   ├── tool.interface.ts
│   │   ├── tool-registry.interface.ts
│   │   └── tool-executor.interface.ts
│   ├── impl/
│   │   ├── tool-registry.impl.ts
│   │   └── tool-executor.impl.ts
│   ├── base/
│   │   └── base-tool.ts
│   └── types/
│       └── tool.types.ts
```

#### 4.1.1 ITool 인터페이스

```typescript
// src/tools/core/interfaces/tool.interface.ts

/**
 * 도구 인터페이스
 *
 * SOLID 원칙:
 * - S: 각 도구는 특정 작업만 수행
 * - L: 모든 도구가 동일 인터페이스로 교체 가능
 * - I: 실행/검증/메타데이터 분리
 */
export interface ITool {
  // === 메타데이터 ===
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly version: string;

  // === 스키마 ===
  readonly inputSchema: JSONSchema;
  readonly outputSchema: JSONSchema;

  // === 실행 ===
  execute<TInput = unknown, TOutput = unknown>(
    params: TInput,
    context: ToolContext,
  ): Promise<ToolResult<TOutput>>;

  // === 검증 ===
  validate(params: unknown): ValidationResult;

  // === LLM 통합 ===
  toDefinition(): ToolDefinition;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ToolError;
  metadata: {
    duration: number;
    tokensUsed?: number;
    resourcesAccessed?: string[];
  };
}

export interface ToolContext {
  agentId: string;
  taskId: string;
  workingDirectory: string;
  permissions: Permission[];
  timeout: number;
}
```

#### 4.1.2 Tool Registry

```typescript
// src/tools/core/interfaces/tool-registry.interface.ts

/**
 * 도구 레지스트리 인터페이스
 *
 * OCP: 새 도구는 register로 추가
 */
export interface IToolRegistry {
  // === 등록 ===
  register(tool: ITool): void;
  registerMany(tools: ITool[]): void;
  unregister(name: string): void;

  // === 조회 ===
  get(name: string): ITool | undefined;
  getOrThrow(name: string): ITool;
  has(name: string): boolean;

  // === 검색 ===
  getByCategory(category: ToolCategory): ITool[];
  getAll(): ITool[];
  search(query: string): ITool[];

  // === LLM 통합 ===
  getDefinitions(names?: string[]): ToolDefinition[];
  getDefinitionsByCategory(category: ToolCategory): ToolDefinition[];
}
```

#### 4.1.3 Base Tool

```typescript
// src/tools/core/base/base-tool.ts

/**
 * 도구 기본 구현
 */
export abstract class BaseTool implements ITool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: ToolCategory;
  abstract readonly inputSchema: JSONSchema;
  abstract readonly outputSchema: JSONSchema;

  readonly version: string = '1.0.0';

  constructor(
    @Inject(TOKENS.Logger) protected readonly logger: ILogger,
    @Inject(TOKENS.AuditLogger) protected readonly auditLogger: IAuditLogger,
  ) {}

  async execute<TInput, TOutput>(
    params: TInput,
    context: ToolContext,
  ): Promise<ToolResult<TOutput>> {
    const startTime = Date.now();

    try {
      // 1. 검증
      const validation = this.validate(params);
      if (!validation.valid) {
        return {
          success: false,
          error: new ValidationError(validation.errors),
          metadata: { duration: Date.now() - startTime },
        };
      }

      // 2. 권한 확인
      await this.checkPermissions(context);

      // 3. 실행
      const result = await this.doExecute(params as TInput, context);

      // 4. 감사 로그
      this.auditLogger.log({
        action: `tool:${this.name}`,
        outcome: 'success',
        actor: context.agentId,
      });

      return {
        success: true,
        data: result,
        metadata: { duration: Date.now() - startTime },
      };

    } catch (error) {
      this.auditLogger.log({
        action: `tool:${this.name}`,
        outcome: 'failure',
        actor: context.agentId,
        details: { error: error.message },
      });

      return {
        success: false,
        error: this.wrapError(error),
        metadata: { duration: Date.now() - startTime },
      };
    }
  }

  validate(params: unknown): ValidationResult {
    return validateJsonSchema(params, this.inputSchema);
  }

  toDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.inputSchema,
    };
  }

  // 하위 클래스 구현
  protected abstract doExecute<TInput, TOutput>(
    params: TInput,
    context: ToolContext,
  ): Promise<TOutput>;

  protected abstract getRequiredPermissions(): Permission[];

  private async checkPermissions(context: ToolContext): Promise<void> {
    const required = this.getRequiredPermissions();
    for (const permission of required) {
      if (!context.permissions.includes(permission)) {
        throw new PermissionDeniedError(permission);
      }
    }
  }
}
```

### 4.2 구체적 도구 구현

```
src/tools/
├── file/
│   ├── file-read.tool.ts
│   ├── file-write.tool.ts
│   ├── file-delete.tool.ts
│   └── index.ts
├── git/
│   ├── git-clone.tool.ts
│   ├── git-commit.tool.ts
│   ├── git-push.tool.ts
│   ├── git-branch.tool.ts
│   └── index.ts
├── shell/
│   ├── shell-execute.tool.ts
│   └── index.ts
├── lsp/
│   ├── lsp-go-to-definition.tool.ts
│   ├── lsp-find-references.tool.ts
│   ├── lsp-rename.tool.ts
│   └── index.ts
└── ast-grep/
    ├── ast-search.tool.ts
    ├── ast-replace.tool.ts
    └── index.ts
```

#### 4.2.1 File Write Tool

```typescript
// src/tools/file/file-write.tool.ts

@Injectable()
export class FileWriteTool extends BaseTool {
  readonly name = 'file-write';
  readonly description = 'Write content to a file';
  readonly category = ToolCategory.FILE;

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path' },
      content: { type: 'string', description: 'Content to write' },
      mode: {
        type: 'string',
        enum: ['overwrite', 'append', 'create'],
        default: 'overwrite',
      },
    },
    required: ['path', 'content'],
  };

  readonly outputSchema: JSONSchema = {
    type: 'object',
    properties: {
      path: { type: 'string' },
      bytesWritten: { type: 'number' },
    },
  };

  protected getRequiredPermissions(): Permission[] {
    return [Permission.FILE_WRITE];
  }

  protected async doExecute(
    params: FileWriteParams,
    context: ToolContext,
  ): Promise<FileWriteResult> {
    const fullPath = this.resolvePath(params.path, context.workingDirectory);

    // 경로 검증 (보안)
    this.validatePath(fullPath, context.workingDirectory);

    // 디렉토리 생성
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // 파일 쓰기
    const flag = params.mode === 'append' ? 'a' : 'w';
    await fs.writeFile(fullPath, params.content, { flag });

    return {
      path: fullPath,
      bytesWritten: Buffer.byteLength(params.content),
    };
  }
}
```

#### 4.2.2 Git Commit Tool

```typescript
// src/tools/git/git-commit.tool.ts

@Injectable()
export class GitCommitTool extends BaseTool {
  readonly name = 'git-commit';
  readonly description = 'Create a git commit';
  readonly category = ToolCategory.GIT;

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to commit (empty = all staged)',
      },
      amend: { type: 'boolean', default: false },
    },
    required: ['message'],
  };

  constructor(
    logger: ILogger,
    auditLogger: IAuditLogger,
    @Inject(TOKENS.ShellExecutor) private readonly shell: IShellExecutor,
  ) {
    super(logger, auditLogger);
  }

  protected getRequiredPermissions(): Permission[] {
    return [Permission.GIT_COMMIT];
  }

  protected async doExecute(
    params: GitCommitParams,
    context: ToolContext,
  ): Promise<GitCommitResult> {
    // 파일 스테이징
    if (params.files && params.files.length > 0) {
      await this.shell.execute('git', ['add', ...params.files], {
        cwd: context.workingDirectory,
      });
    }

    // 커밋
    const args = ['commit', '-m', params.message];
    if (params.amend) args.push('--amend');

    const result = await this.shell.execute('git', args, {
      cwd: context.workingDirectory,
    });

    // 커밋 해시 추출
    const commitHash = await this.getLastCommitHash(context.workingDirectory);

    return {
      hash: commitHash,
      message: params.message,
    };
  }
}
```

---

## 5. Hook 모듈

### 5.1 Hook Core 모듈

```
src/hooks/
├── core/
│   ├── interfaces/
│   │   ├── hook.interface.ts
│   │   ├── hook-registry.interface.ts
│   │   └── hook-executor.interface.ts
│   ├── impl/
│   │   ├── hook-registry.impl.ts
│   │   └── hook-executor.impl.ts
│   └── types/
│       └── hook.types.ts
├── builtin/
│   ├── context-monitor.hook.ts
│   ├── token-optimizer.hook.ts
│   ├── code-quality.hook.ts
│   ├── session-recovery.hook.ts
│   ├── git-auto-commit.hook.ts
│   ├── security-scanner.hook.ts
│   ├── performance-monitor.hook.ts
│   └── error-handler.hook.ts
└── index.ts
```

#### 5.1.1 IHook 인터페이스

```typescript
// src/hooks/core/interfaces/hook.interface.ts

/**
 * 훅 인터페이스
 *
 * SOLID 원칙:
 * - S: 각 훅은 특정 이벤트에 대한 하나의 관심사만 처리
 * - O: 새 훅은 구현하여 등록 (기존 코드 수정 불필요)
 * - L: 모든 훅이 동일 인터페이스로 교체 가능
 */
export interface IHook {
  // === 메타데이터 ===
  readonly name: string;
  readonly description: string;
  readonly event: HookEvent;
  readonly priority: number;  // 높을수록 먼저 실행

  // === 실행 ===
  execute(context: HookContext): Promise<HookResult>;

  // === 조건부 실행 ===
  shouldRun(context: HookContext): boolean;
}

export interface HookContext {
  event: HookEvent;
  agent?: IAgent;
  task?: Task;
  tool?: ITool;
  workflow?: Workflow;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface HookResult {
  action: HookAction;
  message?: string;
  modifiedContext?: Partial<HookContext>;
  error?: Error;
}

export enum HookAction {
  CONTINUE = 'continue',   // 다음 훅으로 진행
  MODIFY = 'modify',       // 컨텍스트 수정 후 진행
  SKIP = 'skip',           // 이 훅 건너뛰기
  ABORT = 'abort',         // 체인 중단
  RETRY = 'retry',         // 재시도 요청
}

/**
 * 훅 이벤트 정의
 */
export const HookEvent = {
  // 에이전트 생명주기
  AGENT_BEFORE_START: 'agent:before:start',
  AGENT_AFTER_START: 'agent:after:start',
  AGENT_BEFORE_STOP: 'agent:before:stop',
  AGENT_AFTER_STOP: 'agent:after:stop',
  AGENT_ERROR: 'agent:error',

  // 작업 생명주기
  TASK_BEFORE_PROCESS: 'task:before:process',
  TASK_AFTER_PROCESS: 'task:after:process',
  TASK_ERROR: 'task:error',

  // 도구 생명주기
  TOOL_BEFORE_EXECUTE: 'tool:before:execute',
  TOOL_AFTER_EXECUTE: 'tool:after:execute',
  TOOL_ERROR: 'tool:error',

  // 워크플로우
  WORKFLOW_BEFORE_START: 'workflow:before:start',
  WORKFLOW_STEP_COMPLETE: 'workflow:step:complete',
  WORKFLOW_AFTER_COMPLETE: 'workflow:after:complete',
  WORKFLOW_ERROR: 'workflow:error',

  // Git
  GIT_BEFORE_COMMIT: 'git:before:commit',
  GIT_AFTER_COMMIT: 'git:after:commit',
  GIT_BEFORE_PUSH: 'git:before:push',
  GIT_AFTER_PUSH: 'git:after:push',
  GIT_BEFORE_PR: 'git:before:pr',
  GIT_AFTER_PR: 'git:after:pr',

  // 컨텍스트
  CONTEXT_THRESHOLD_WARNING: 'context:threshold:warning',
  CONTEXT_THRESHOLD_CRITICAL: 'context:threshold:critical',
  CONTEXT_COMPACT: 'context:compact',

  // LLM
  LLM_BEFORE_CALL: 'llm:before:call',
  LLM_AFTER_CALL: 'llm:after:call',
  LLM_TOKEN_LIMIT: 'llm:token:limit',

  // 세션
  SESSION_START: 'session:start',
  SESSION_END: 'session:end',
  SESSION_CHECKPOINT: 'session:checkpoint',
  SESSION_RESTORE: 'session:restore',
} as const;
```

#### 5.1.2 Hook Executor

```typescript
// src/hooks/core/impl/hook-executor.impl.ts

/**
 * 훅 실행기 구현
 *
 * 체인 패턴으로 훅 순차 실행
 */
@Injectable()
export class HookExecutor implements IHookExecutor {
  constructor(
    @Inject(TOKENS.HookRegistry) private readonly registry: IHookRegistry,
    @Inject(TOKENS.Logger) private readonly logger: ILogger,
    @Inject(TOKENS.EventBus) private readonly eventBus: IEventBus,
  ) {}

  async execute(event: HookEvent, context: HookContext): Promise<HookChainResult> {
    const hooks = this.registry.getByEvent(event);
    const results: HookResult[] = [];
    let currentContext = { ...context };

    this.logger.debug(`Executing ${hooks.length} hooks for event: ${event}`);

    for (const hook of hooks) {
      try {
        // 조건 확인
        if (!hook.shouldRun(currentContext)) {
          this.logger.debug(`Hook ${hook.name} skipped (condition not met)`);
          continue;
        }

        // 훅 실행
        const result = await this.executeWithTimeout(hook, currentContext);
        results.push(result);

        // 결과 처리
        switch (result.action) {
          case HookAction.ABORT:
            this.logger.warn(`Hook chain aborted by ${hook.name}: ${result.message}`);
            return { aborted: true, reason: result.message, results };

          case HookAction.MODIFY:
            if (result.modifiedContext) {
              currentContext = { ...currentContext, ...result.modifiedContext };
            }
            break;

          case HookAction.RETRY:
            // 재시도 로직 (최대 3회)
            const retryResult = await this.retryHook(hook, currentContext);
            results.push(retryResult);
            break;
        }

        // 이벤트 발행
        this.eventBus.emit({
          type: SystemEvents.HookExecuted,
          payload: { hookName: hook.name, result },
        });

      } catch (error) {
        this.logger.error(`Hook ${hook.name} failed`, error);
        results.push({ action: HookAction.CONTINUE, error });

        this.eventBus.emit({
          type: SystemEvents.HookFailed,
          payload: { hookName: hook.name, error },
        });
      }
    }

    return { aborted: false, results, modifiedContext: currentContext };
  }

  private async executeWithTimeout(
    hook: IHook,
    context: HookContext,
  ): Promise<HookResult> {
    return Promise.race([
      hook.execute(context),
      this.timeout(5000, `Hook ${hook.name} timed out`),
    ]);
  }
}
```

### 5.2 내장 훅 구현

#### 5.2.1 Context Monitor Hook

```typescript
// src/hooks/builtin/context-monitor.hook.ts

/**
 * 컨텍스트 사용량 모니터링 훅
 *
 * 목적: LLM 컨텍스트 윈도우 사용량 추적 및 경고
 * 영감: oh-my-opencode의 컨텍스트 관리
 */
@Injectable()
export class ContextMonitorHook implements IHook {
  readonly name = 'context-monitor';
  readonly description = 'Monitors LLM context usage and warns on threshold';
  readonly event = HookEvent.LLM_AFTER_CALL;
  readonly priority = 100; // 높은 우선순위

  private usageHistory: TokenUsage[] = [];

  constructor(
    @Inject(TOKENS.Config) private readonly config: IConfig,
    @Inject(TOKENS.EventBus) private readonly eventBus: IEventBus,
  ) {}

  shouldRun(): boolean {
    return true; // 항상 실행
  }

  async execute(context: HookContext): Promise<HookResult> {
    const llmResult = context.data.llmResult as LLMResult;
    const maxTokens = this.config.get('llm.maxContextTokens', 128000);

    // 사용량 기록
    this.usageHistory.push({
      timestamp: new Date(),
      tokens: llmResult.usage.totalTokens,
    });

    // 사용률 계산
    const usagePercent = (llmResult.usage.totalTokens / maxTokens) * 100;

    // 임계값 확인
    if (usagePercent >= 90) {
      this.eventBus.emit({
        type: HookEvent.CONTEXT_THRESHOLD_CRITICAL,
        payload: { usagePercent, tokens: llmResult.usage.totalTokens },
      });

      return {
        action: HookAction.MODIFY,
        message: `Critical: Context usage at ${usagePercent.toFixed(1)}%`,
        modifiedContext: {
          data: { ...context.data, shouldCompact: true },
        },
      };
    }

    if (usagePercent >= 75) {
      this.eventBus.emit({
        type: HookEvent.CONTEXT_THRESHOLD_WARNING,
        payload: { usagePercent, tokens: llmResult.usage.totalTokens },
      });

      return {
        action: HookAction.CONTINUE,
        message: `Warning: Context usage at ${usagePercent.toFixed(1)}%`,
      };
    }

    return { action: HookAction.CONTINUE };
  }
}
```

#### 5.2.2 Code Quality Hook

```typescript
// src/hooks/builtin/code-quality.hook.ts

/**
 * 코드 품질 검사 훅
 *
 * 목적: 커밋 전 코드 품질 자동 검사
 */
@Injectable()
export class CodeQualityHook implements IHook {
  readonly name = 'code-quality';
  readonly description = 'Runs code quality checks before commits';
  readonly event = HookEvent.GIT_BEFORE_COMMIT;
  readonly priority = 80;

  constructor(
    @Inject(TOKENS.ToolRegistry) private readonly tools: IToolRegistry,
    @Inject(TOKENS.Config) private readonly config: IConfig,
  ) {}

  shouldRun(context: HookContext): boolean {
    return this.config.get('hooks.codeQuality.enabled', true);
  }

  async execute(context: HookContext): Promise<HookResult> {
    const changedFiles = context.data.changedFiles as string[];
    const issues: QualityIssue[] = [];

    // 1. Linting
    if (this.config.get('hooks.codeQuality.lint', true)) {
      const lintResult = await this.runLint(changedFiles);
      issues.push(...lintResult.issues);
    }

    // 2. Type checking
    if (this.config.get('hooks.codeQuality.typeCheck', true)) {
      const typeResult = await this.runTypeCheck(changedFiles);
      issues.push(...typeResult.issues);
    }

    // 3. Security scan
    if (this.config.get('hooks.codeQuality.security', true)) {
      const securityResult = await this.runSecurityScan(changedFiles);
      issues.push(...securityResult.issues);
    }

    // 결과 평가
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    if (errors.length > 0) {
      return {
        action: HookAction.ABORT,
        message: `Quality check failed: ${errors.length} errors found`,
        modifiedContext: {
          data: { ...context.data, qualityIssues: issues },
        },
      };
    }

    if (warnings.length > 0) {
      return {
        action: HookAction.CONTINUE,
        message: `Quality check passed with ${warnings.length} warnings`,
        modifiedContext: {
          data: { ...context.data, qualityIssues: issues },
        },
      };
    }

    return { action: HookAction.CONTINUE };
  }
}
```

#### 5.2.3 Session Recovery Hook

```typescript
// src/hooks/builtin/session-recovery.hook.ts

/**
 * 세션 복구 훅
 *
 * 목적: 세션 상태 저장 및 복구
 * 영감: oh-my-opencode의 세션 복구 메커니즘
 */
@Injectable()
export class SessionRecoveryHook implements IHook {
  readonly name = 'session-recovery';
  readonly description = 'Saves and restores session state';
  readonly event = HookEvent.SESSION_CHECKPOINT;
  readonly priority = 90;

  private readonly storageKey = 'session-state';

  constructor(
    @Inject(TOKENS.Storage) private readonly storage: IStorage,
    @Inject(TOKENS.Logger) private readonly logger: ILogger,
  ) {}

  shouldRun(): boolean {
    return true;
  }

  async execute(context: HookContext): Promise<HookResult> {
    const sessionState: SessionState = {
      id: context.data.sessionId as string,
      timestamp: new Date(),
      agents: await this.getAgentStates(context),
      pendingTasks: context.data.pendingTasks as Task[],
      workflowProgress: context.data.workflowProgress as WorkflowProgress,
      conversation: context.data.conversationHistory as Message[],
    };

    // 상태 저장
    await this.storage.set(
      `${this.storageKey}:${sessionState.id}`,
      sessionState,
    );

    this.logger.info(`Session checkpoint saved: ${sessionState.id}`);

    return { action: HookAction.CONTINUE };
  }

  // 세션 복구 (별도 메서드)
  async restoreSession(sessionId: string): Promise<SessionState | null> {
    const state = await this.storage.get<SessionState>(
      `${this.storageKey}:${sessionId}`,
    );

    if (!state) {
      this.logger.warn(`No session state found for: ${sessionId}`);
      return null;
    }

    this.logger.info(`Session restored: ${sessionId}`);
    return state;
  }
}
```

---

## 6. LLM 모듈

### 6.1 LLM Core 모듈

```
src/llm/
├── core/
│   ├── interfaces/
│   │   ├── llm-client.interface.ts
│   │   ├── llm-factory.interface.ts
│   │   ├── model-orchestrator.interface.ts
│   │   └── auth-provider.interface.ts
│   ├── types/
│   │   ├── message.types.ts
│   │   ├── tool.types.ts
│   │   └── response.types.ts
│   └── base/
│       └── base-llm-client.ts
├── providers/
│   ├── claude/
│   │   ├── claude-client.ts
│   │   └── claude-types.ts
│   ├── openai/
│   │   ├── openai-client.ts
│   │   └── openai-types.ts
│   └── gemini/
│       ├── gemini-client.ts
│       └── gemini-types.ts
├── auth/
│   ├── api-key.auth.ts
│   └── subscription.auth.ts
├── orchestrator/
│   ├── model-orchestrator.ts
│   ├── model-selector.ts
│   └── result-aggregator.ts
└── index.ts
```

#### 6.1.1 ILLMClient 인터페이스

```typescript
// src/llm/core/interfaces/llm-client.interface.ts

/**
 * LLM 클라이언트 인터페이스
 *
 * SOLID 원칙:
 * - S: LLM 통신만 담당
 * - L: 모든 LLM 제공자가 동일 인터페이스 구현
 * - I: 채팅/도구/토큰 관리 분리
 */
export interface ILLMClient {
  // === 메타데이터 ===
  readonly provider: LLMProvider;
  readonly model: string;
  readonly capabilities: LLMCapability[];

  // === 기본 채팅 ===
  chat(
    messages: Message[],
    options?: ChatOptions,
  ): Promise<ChatResult>;

  // === 스트리밍 ===
  chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncIterable<ChatChunk>;

  // === 도구 사용 ===
  chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options?: ChatWithToolsOptions,
  ): Promise<ChatWithToolsResult>;

  // === 토큰 관리 ===
  countTokens(messages: Message[]): Promise<number>;
  getMaxTokens(): number;
  getRemainingTokens(used: number): number;

  // === 상태 ===
  isAvailable(): Promise<boolean>;
  getUsage(): LLMUsage;
  getHealth(): HealthStatus;
}

/**
 * 채팅 전용 인터페이스 (ISP)
 */
export interface IChatClient {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResult>;
  chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatChunk>;
}

/**
 * 도구 사용 전용 인터페이스 (ISP)
 */
export interface IToolUseClient {
  chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options?: ChatWithToolsOptions,
  ): Promise<ChatWithToolsResult>;
}
```

#### 6.1.2 IModelOrchestrator 인터페이스

```typescript
// src/llm/core/interfaces/model-orchestrator.interface.ts

/**
 * 모델 오케스트레이터 인터페이스
 *
 * 목적: 작업별 최적 모델 선택 및 다중 모델 조율
 */
export interface IModelOrchestrator {
  // === 모델 선택 ===

  /**
   * 작업 유형에 따른 모델 선택
   */
  selectModel(taskType: TaskType): ILLMClient;

  /**
   * 특정 역할의 모델 선택
   */
  selectModelByRole(role: ModelRole): ILLMClient;

  // === 다중 모델 실행 ===

  /**
   * 다중 모델로 동일 요청 실행 및 결과 집계
   * 예: 리뷰 시 Gemini + GPT 동시 실행
   */
  executeMultiple<T>(
    clients: ILLMClient[],
    messages: Message[],
    aggregator: IResultAggregator<T>,
  ): Promise<AggregatedResult<T>>;

  /**
   * 폴백 체인 실행
   * 주 모델 실패 시 대체 모델로 시도
   */
  executeWithFallback(
    primary: ILLMClient,
    fallbacks: ILLMClient[],
    messages: Message[],
  ): Promise<ChatResult>;

  /**
   * 분할 실행 (큰 작업을 여러 모델로 분배)
   */
  executeSplit<T>(
    chunks: Message[][],
    clientSelector: (index: number) => ILLMClient,
    merger: (results: ChatResult[]) => T,
  ): Promise<T>;

  // === 모델 관리 ===

  registerClient(role: ModelRole, client: ILLMClient): void;
  getClient(role: ModelRole): ILLMClient | undefined;
  getAllClients(): Map<ModelRole, ILLMClient>;
}

export enum ModelRole {
  // 코딩
  PRIMARY_CODER = 'primary-coder',      // Claude Code
  FALLBACK_CODER = 'fallback-coder',    // GPT-4

  // 리뷰
  REVIEWER_A = 'reviewer-a',            // Gemini
  REVIEWER_B = 'reviewer-b',            // GPT-4

  // 설계
  ARCHITECT = 'architect',              // Claude Opus

  // 문서
  DOC_WRITER = 'doc-writer',            // Gemini

  // 탐색
  EXPLORER = 'explorer',                // Haiku/Grok
}
```

#### 6.1.3 Base LLM Client

```typescript
// src/llm/core/base/base-llm-client.ts

/**
 * LLM 클라이언트 기본 구현
 */
export abstract class BaseLLMClient implements ILLMClient {
  protected usage: LLMUsage = { totalTokens: 0, requests: 0 };

  abstract readonly provider: LLMProvider;
  abstract readonly model: string;
  abstract readonly capabilities: LLMCapability[];

  constructor(
    protected readonly config: LLMClientConfig,
    @Inject(TOKENS.AuthProvider) protected readonly auth: IAuthProvider,
    @Inject(TOKENS.Logger) protected readonly logger: ILogger,
  ) {}

  abstract chat(messages: Message[], options?: ChatOptions): Promise<ChatResult>;
  abstract chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatChunk>;
  abstract countTokens(messages: Message[]): Promise<number>;

  async chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options?: ChatWithToolsOptions,
  ): Promise<ChatWithToolsResult> {
    // 도구 정의를 포함한 채팅
    const enhancedOptions: ChatOptions = {
      ...options,
      tools,
    };

    const result = await this.chat(messages, enhancedOptions);

    // 도구 호출 파싱
    const toolCalls = this.parseToolCalls(result);

    return {
      ...result,
      toolCalls,
      hasToolCalls: toolCalls.length > 0,
    };
  }

  getMaxTokens(): number {
    return this.config.maxTokens || 128000;
  }

  getRemainingTokens(used: number): number {
    return this.getMaxTokens() - used;
  }

  getUsage(): LLMUsage {
    return { ...this.usage };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // 간단한 요청으로 가용성 확인
      await this.chat([{ role: 'user', content: 'ping' }], {
        maxTokens: 5,
      });
      return true;
    } catch {
      return false;
    }
  }

  getHealth(): HealthStatus {
    return {
      healthy: this.usage.errors === 0 || this.usage.errors < this.usage.requests * 0.1,
      checks: {
        availability: { status: 'healthy' },
        errorRate: {
          status: this.usage.errors < 5 ? 'healthy' : 'degraded',
          value: this.usage.errors,
        },
      },
      lastCheckedAt: new Date(),
    };
  }

  protected abstract parseToolCalls(result: ChatResult): ToolCall[];
}
```

---

## 7. Infrastructure 모듈

### 7.1 Messaging 모듈

```
src/infra/messaging/
├── interfaces/
│   └── message-broker.interface.ts
├── impl/
│   ├── nats-broker.impl.ts
│   └── in-memory-broker.impl.ts
├── types/
│   └── messaging.types.ts
└── index.ts
```

#### 7.1.1 IMessageBroker 구현 (NATS)

```typescript
// src/infra/messaging/impl/nats-broker.impl.ts

@Injectable()
export class NatsBroker implements IMessageBroker {
  private connection: NatsConnection | null = null;
  private subscriptions = new Map<string, NatsSubscription>();

  constructor(
    @Inject(TOKENS.Config) private readonly config: IConfig,
    @Inject(TOKENS.Logger) private readonly logger: ILogger,
  ) {}

  async connect(): Promise<void> {
    const url = this.config.get('nats.url', 'nats://localhost:4222');
    this.connection = await connect({ servers: url });
    this.logger.info(`Connected to NATS: ${url}`);
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
      this.connection = null;
    }
  }

  isConnected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }

  async publish<T>(topic: string, message: T): Promise<void> {
    if (!this.connection) throw new Error('Not connected');

    const data = JSON.stringify(message);
    this.connection.publish(topic, encode(data));
  }

  async subscribe<T>(
    topic: string,
    handler: MessageHandler<T>,
  ): Promise<Subscription> {
    if (!this.connection) throw new Error('Not connected');

    const subscription = this.connection.subscribe(topic, {
      callback: (err, msg) => {
        if (err) {
          this.logger.error(`Subscription error on ${topic}`, err);
          return;
        }

        const data = JSON.parse(decode(msg.data)) as T;
        handler(data);
      },
    });

    const id = generateId();
    this.subscriptions.set(id, subscription);

    return {
      id,
      topic,
      unsubscribe: async () => {
        subscription.unsubscribe();
        this.subscriptions.delete(id);
      },
    };
  }

  async request<TReq, TRes>(
    topic: string,
    message: TReq,
    timeout = 5000,
  ): Promise<TRes> {
    if (!this.connection) throw new Error('Not connected');

    const data = JSON.stringify(message);
    const response = await this.connection.request(topic, encode(data), {
      timeout,
    });

    return JSON.parse(decode(response.data)) as TRes;
  }
}
```

### 7.2 Storage 모듈

```
src/infra/storage/
├── interfaces/
│   ├── storage.interface.ts
│   └── database.interface.ts
├── impl/
│   ├── prisma-database.impl.ts
│   ├── redis-cache.impl.ts
│   └── file-storage.impl.ts
└── index.ts
```

#### 7.2.1 IStorage 인터페이스

```typescript
// src/infra/storage/interfaces/storage.interface.ts

/**
 * 저장소 인터페이스
 */
export interface IStorage {
  // === CRUD ===
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: SetOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;

  // === 배치 ===
  getMany<T>(keys: string[]): Promise<Map<string, T>>;
  setMany<T>(entries: Map<string, T>, options?: SetOptions): Promise<void>;
  deleteMany(keys: string[]): Promise<number>;

  // === 검색 ===
  keys(pattern?: string): Promise<string[]>;

  // === TTL ===
  setTTL(key: string, ttlSeconds: number): Promise<boolean>;
  getTTL(key: string): Promise<number>;
}

export interface SetOptions {
  ttlSeconds?: number;
  ifNotExists?: boolean;
}
```

---

## 8. 모듈 의존성 그래프

```
                         ┌──────────────────┐
                         │    CLI / API     │
                         └────────┬─────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    Core Domain Services   │
                    │  (Orchestrator, Project,  │
                    │   Workflow, Agent)        │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────┬───────────┼───────────┬───────────┐
          │           │           │           │           │
    ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
    │  Agents   │ │ Tools │ │   Hooks   │ │  LLM  │ │  Infra    │
    └─────┬─────┘ └───┬───┘ └─────┬─────┘ └───┬───┘ └─────┬─────┘
          │           │           │           │           │
          └───────────┴───────────┼───────────┴───────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Core (DI, Events)    │
                    └───────────────────────────┘
```

### 8.1 의존성 규칙

1. **상위 레이어 → 하위 레이어만 의존**
2. **인터페이스를 통해서만 의존**
3. **순환 의존성 금지**
4. **Core 모듈은 다른 모듈에 의존하지 않음**

---

## 9. 모듈 초기화 순서

```typescript
// src/bootstrap.ts

export async function bootstrap(): Promise<IContainer> {
  const container = new Container();

  // 1. Core 모듈 (의존성 없음)
  await initializeCoreModule(container);

  // 2. Infrastructure 모듈 (Core에만 의존)
  await initializeInfraModule(container);

  // 3. LLM 모듈 (Core, Infra에 의존)
  await initializeLLMModule(container);

  // 4. Tool 모듈 (Core, Infra에 의존)
  await initializeToolModule(container);

  // 5. Hook 모듈 (Core, Infra, Tool에 의존)
  await initializeHookModule(container);

  // 6. Agent 모듈 (모든 하위 모듈에 의존)
  await initializeAgentModule(container);

  // 7. Domain 서비스 (모든 모듈 조합)
  await initializeDomainServices(container);

  return container;
}
```

---

## 10. A2A (Agent-to-Agent) Protocol 모듈

> Google A2A 프로토콜 기반 외부 에이전트 협업 지원

### 10.1 A2A Core 모듈

```
src/a2a/
├── core/
│   ├── interfaces/
│   │   ├── a2a-server.interface.ts
│   │   ├── a2a-client.interface.ts
│   │   ├── agent-card.interface.ts
│   │   └── task.interface.ts
│   ├── impl/
│   │   ├── a2a-server.impl.ts
│   │   ├── a2a-client.impl.ts
│   │   └── agent-card-generator.impl.ts
│   ├── types/
│   │   ├── a2a.types.ts
│   │   └── protocol.types.ts
│   └── index.ts
├── adapters/
│   ├── claude-a2a-adapter.ts
│   └── openai-a2a-adapter.ts
└── registry/
    ├── agent-registry.ts
    └── capability-matcher.ts
```

#### 10.1.1 IA2AServer 인터페이스

```typescript
// src/a2a/core/interfaces/a2a-server.interface.ts

/**
 * A2A 서버 인터페이스
 *
 * 외부 에이전트가 CodeAvengers 에이전트와 협업할 수 있도록 함
 * Google A2A Protocol 준수
 */
export interface IA2AServer {
  // === 서버 관리 ===

  /**
   * A2A 서버 시작
   */
  start(port: number): Promise<void>;

  /**
   * A2A 서버 중지
   */
  stop(): Promise<void>;

  /**
   * 서버 상태 확인
   */
  isRunning(): boolean;

  // === 에이전트 등록 ===

  /**
   * 에이전트를 A2A 서버에 등록
   */
  registerAgent(agent: IAgent): void;

  /**
   * 에이전트 등록 해제
   */
  unregisterAgent(agentId: string): void;

  /**
   * 등록된 에이전트 목록
   */
  getRegisteredAgents(): AgentCard[];

  // === 태스크 처리 ===

  /**
   * A2A 태스크 수신 및 처리
   */
  handleTask(task: A2ATask): Promise<A2ATaskResult>;

  /**
   * 태스크 상태 조회
   */
  getTaskStatus(taskId: string): A2ATaskStatus;

  /**
   * 태스크 취소
   */
  cancelTask(taskId: string): Promise<boolean>;
}
```

#### 10.1.2 IA2AClient 인터페이스

```typescript
// src/a2a/core/interfaces/a2a-client.interface.ts

/**
 * A2A 클라이언트 인터페이스
 *
 * CodeAvengers가 외부 A2A 에이전트를 호출할 수 있도록 함
 */
export interface IA2AClient {
  // === 에이전트 탐색 ===

  /**
   * A2A 에이전트 발견
   */
  discoverAgents(endpoint: string): Promise<AgentCard[]>;

  /**
   * 특정 기능을 가진 에이전트 검색
   */
  findAgentsByCapability(capability: string): Promise<AgentCard[]>;

  // === 태스크 전송 ===

  /**
   * 외부 에이전트에 태스크 전송
   */
  sendTask(agentCard: AgentCard, task: A2ATask): Promise<A2ATaskResult>;

  /**
   * 스트리밍 태스크 전송
   */
  sendTaskStream(
    agentCard: AgentCard,
    task: A2ATask,
  ): AsyncIterable<A2ATaskChunk>;

  // === 상태 관리 ===

  /**
   * 원격 태스크 상태 조회
   */
  getRemoteTaskStatus(agentCard: AgentCard, taskId: string): Promise<A2ATaskStatus>;

  /**
   * 원격 태스크 취소
   */
  cancelRemoteTask(agentCard: AgentCard, taskId: string): Promise<boolean>;
}
```

#### 10.1.3 Agent Card 인터페이스

```typescript
// src/a2a/core/interfaces/agent-card.interface.ts

/**
 * A2A Agent Card - 에이전트 메타데이터
 *
 * Google A2A Protocol의 Agent Card 규격 준수
 */
export interface AgentCard {
  // 필수 필드
  name: string;
  description: string;
  url: string;
  version: string;

  // 기능 정의
  capabilities: AgentCapability[];

  // 인증 정보
  authentication?: {
    schemes: AuthScheme[];
    required: boolean;
  };

  // 제약 조건
  constraints?: {
    maxInputTokens?: number;
    maxOutputTokens?: number;
    supportedModalities?: Modality[];
    rateLimit?: RateLimitConfig;
  };

  // 메타데이터
  metadata?: {
    provider?: string;
    model?: string;
    tags?: string[];
  };
}

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
}

export type AuthScheme = 'bearer' | 'api_key' | 'oauth2' | 'none';
export type Modality = 'text' | 'image' | 'audio' | 'video' | 'file';
```

#### 10.1.4 A2A Task Types

```typescript
// src/a2a/core/types/a2a.types.ts

/**
 * A2A 태스크 정의
 */
export interface A2ATask {
  id: string;
  sessionId?: string;

  // 메시지
  message: {
    role: 'user' | 'assistant' | 'system';
    content: A2AContent[];
  };

  // 푸시 알림
  pushNotification?: {
    url: string;
    authentication?: AuthConfig;
  };

  // 히스토리 (멀티턴 대화)
  historyLength?: number;

  // 메타데이터
  metadata?: Record<string, unknown>;
}

export type A2AContent =
  | { type: 'text'; text: string }
  | { type: 'file'; file: FileContent }
  | { type: 'data'; data: Record<string, unknown> };

export interface A2ATaskResult {
  id: string;
  status: A2ATaskStatus;

  // 결과
  artifacts?: A2AArtifact[];

  // 에러
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  // 메타데이터
  metadata?: {
    duration?: number;
    tokensUsed?: number;
    model?: string;
  };
}

export interface A2AArtifact {
  name?: string;
  description?: string;
  parts: A2AContent[];
  index: number;
  append?: boolean;
  lastChunk?: boolean;
}

export enum A2ATaskStatus {
  SUBMITTED = 'submitted',
  WORKING = 'working',
  INPUT_REQUIRED = 'input-required',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}
```

#### 10.1.5 Claude A2A Adapter

```typescript
// src/a2a/adapters/claude-a2a-adapter.ts

/**
 * CodeAvengers 에이전트를 A2A 프로토콜로 래핑
 *
 * 기존 IAgent → A2A 호환 에이전트로 변환
 */
@Injectable()
export class ClaudeA2AAdapter implements IA2AAgentAdapter {
  constructor(
    @Inject(TOKENS.AgentRegistry) private readonly agentRegistry: IAgentRegistry,
    @Inject(TOKENS.Logger) private readonly logger: ILogger,
    @Inject(TOKENS.EventBus) private readonly eventBus: IEventBus,
  ) {}

  /**
   * IAgent를 Agent Card로 변환
   */
  toAgentCard(agent: IAgent): AgentCard {
    return {
      name: `CodeAvengers-${agent.type}`,
      description: this.generateDescription(agent),
      url: `${this.getBaseUrl()}/a2a/agents/${agent.id}`,
      version: '1.0.0',
      capabilities: this.convertCapabilities(agent.getCapabilities()),
      authentication: {
        schemes: ['bearer'],
        required: true,
      },
      metadata: {
        provider: 'CodeAvengers',
        tags: [agent.type, 'autonomous', 'coding'],
      },
    };
  }

  /**
   * A2A 태스크를 내부 Task로 변환
   */
  toInternalTask(a2aTask: A2ATask, agent: IAgent): Task {
    return {
      id: a2aTask.id,
      type: this.inferTaskType(a2aTask, agent),
      agentType: agent.type,
      input: this.extractTaskInput(a2aTask),
      metadata: {
        source: 'a2a',
        sessionId: a2aTask.sessionId,
        ...a2aTask.metadata,
      },
    };
  }

  /**
   * 내부 TaskResult를 A2A 결과로 변환
   */
  toA2AResult(taskResult: TaskResult, taskId: string): A2ATaskResult {
    return {
      id: taskId,
      status: taskResult.success ? A2ATaskStatus.COMPLETED : A2ATaskStatus.FAILED,
      artifacts: taskResult.success ? this.convertToArtifacts(taskResult.data) : undefined,
      error: taskResult.error ? {
        code: taskResult.error.code || 'TASK_ERROR',
        message: taskResult.error.message,
        details: taskResult.error.details,
      } : undefined,
      metadata: {
        duration: taskResult.metadata?.duration,
        tokensUsed: taskResult.metadata?.tokensUsed,
      },
    };
  }

  /**
   * A2A 태스크 처리
   */
  async handleA2ATask(a2aTask: A2ATask, agentId: string): Promise<A2ATaskResult> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      return {
        id: a2aTask.id,
        status: A2ATaskStatus.FAILED,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent ${agentId} not found`,
        },
      };
    }

    try {
      this.eventBus.emit({
        type: 'a2a:task:started',
        payload: { taskId: a2aTask.id, agentId },
      });

      const internalTask = this.toInternalTask(a2aTask, agent);
      const result = await agent.processTask(internalTask);

      this.eventBus.emit({
        type: 'a2a:task:completed',
        payload: { taskId: a2aTask.id, agentId, success: result.success },
      });

      return this.toA2AResult(result, a2aTask.id);

    } catch (error) {
      this.logger.error(`A2A task failed: ${a2aTask.id}`, error);

      return {
        id: a2aTask.id,
        status: A2ATaskStatus.FAILED,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
        },
      };
    }
  }

  private convertCapabilities(capabilities: AgentCapability[]): AgentCapability[] {
    return capabilities.map(cap => ({
      name: cap.name,
      description: cap.description,
      inputSchema: this.generateInputSchema(cap),
      outputSchema: this.generateOutputSchema(cap),
    }));
  }
}
```

### 10.2 MCP + A2A 하이브리드 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    CodeAvengers Core                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Agent Orchestrator                       │   │
│  │                                                           │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│  │  │Architect│  │  Coder  │  │Reviewer │  │ Tester  │    │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │   │
│  │       │            │            │            │          │   │
│  └───────┼────────────┼────────────┼────────────┼──────────┘   │
│          │            │            │            │               │
│  ┌───────▼────────────▼────────────▼────────────▼──────────┐   │
│  │                 Tool/Integration Layer                    │   │
│  │                                                           │   │
│  │  ┌────────────────┐          ┌────────────────┐         │   │
│  │  │  MCP Clients   │          │  A2A Clients   │         │   │
│  │  │                │          │                │         │   │
│  │  │ ┌───────────┐  │          │ ┌───────────┐  │         │   │
│  │  │ │ Context7  │  │          │ │ External  │  │         │   │
│  │  │ │  Server   │  │          │ │  Agent A  │  │         │   │
│  │  │ └───────────┘  │          │ └───────────┘  │         │   │
│  │  │ ┌───────────┐  │          │ ┌───────────┐  │         │   │
│  │  │ │  Serena   │  │    ←→    │ │ External  │  │         │   │
│  │  │ │  Server   │  │  Hybrid  │ │  Agent B  │  │         │   │
│  │  │ └───────────┘  │          │ └───────────┘  │         │   │
│  │  │ ┌───────────┐  │          │ ┌───────────┐  │         │   │
│  │  │ │ Playwright│  │          │ │ External  │  │         │   │
│  │  │ │  Server   │  │          │ │  Agent C  │  │         │   │
│  │  │ └───────────┘  │          │ └───────────┘  │         │   │
│  │  └────────────────┘          └────────────────┘         │   │
│  │         ↓                            ↓                   │   │
│  │    Tools (도구)                Agents (협업)             │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

MCP = 도구 연결 (Tool Integration)
  - 에이전트가 사용하는 외부 도구/서비스
  - 문서 조회, 브라우저 테스트, 코드 분석 등

A2A = 에이전트 협업 (Agent Collaboration)
  - 에이전트 간 작업 위임 및 협업
  - 외부 AI 에이전트와의 상호작용
```

---

## 11. DX (Developer Experience) 모듈

> Claude Code DX 개선 도구들을 CodeAvengers에 통합

### 11.1 DX Core 모듈

```
src/dx/
├── core/
│   ├── interfaces/
│   │   ├── dx-manager.interface.ts
│   │   └── dx-module.interface.ts
│   └── types/
│       └── dx.types.ts
├── token-budget/
│   ├── interfaces/
│   │   ├── token-budget.interface.ts
│   │   └── cost-tracker.interface.ts
│   ├── impl/
│   │   ├── token-budget-manager.impl.ts
│   │   └── cost-tracker.impl.ts
│   └── index.ts
├── error-recovery/
│   ├── interfaces/
│   │   └── error-recovery.interface.ts
│   ├── impl/
│   │   ├── retry-strategy.impl.ts
│   │   ├── circuit-breaker.impl.ts
│   │   └── fallback-handler.impl.ts
│   ├── decorators/
│   │   ├── retry.decorator.ts
│   │   ├── circuit-breaker.decorator.ts
│   │   └── fallback.decorator.ts
│   └── index.ts
├── config-manager/
│   ├── interfaces/
│   │   └── config-manager.interface.ts
│   ├── impl/
│   │   ├── smart-config-manager.impl.ts
│   │   ├── project-detector.impl.ts
│   │   └── config-validator.impl.ts
│   └── index.ts
├── session-manager/
│   ├── interfaces/
│   │   └── session-manager.interface.ts
│   ├── impl/
│   │   ├── session-manager.impl.ts
│   │   ├── session-storage.impl.ts
│   │   └── session-search.impl.ts
│   └── index.ts
├── mcp-health/
│   ├── interfaces/
│   │   └── mcp-health.interface.ts
│   ├── impl/
│   │   ├── mcp-health-monitor.impl.ts
│   │   └── mcp-diagnostics.impl.ts
│   └── index.ts
├── testing/
│   ├── interfaces/
│   │   └── agent-testing.interface.ts
│   ├── impl/
│   │   ├── agent-test-runner.impl.ts
│   │   ├── mock-llm-client.impl.ts
│   │   └── test-scenario-builder.impl.ts
│   └── index.ts
└── index.ts
```

### 11.2 Token Budget Manager

```typescript
// src/dx/token-budget/interfaces/token-budget.interface.ts

/**
 * 토큰 예산 관리 인터페이스
 *
 * 목적: LLM API 비용 및 토큰 사용량 추적/제한
 * 출처: claude-code-dx-improvement-tools.md
 */
export interface ITokenBudgetManager {
  // === 예산 설정 ===

  /**
   * 예산 생성
   */
  createBudget(config: TokenBudgetConfig): TokenBudget;

  /**
   * 예산 업데이트
   */
  updateBudget(budgetId: string, config: Partial<TokenBudgetConfig>): void;

  // === 사용량 추적 ===

  /**
   * 토큰 사용 기록
   */
  recordUsage(usage: TokenUsage): void;

  /**
   * 현재 사용량 조회
   */
  getCurrentUsage(budgetId?: string): TokenUsageReport;

  /**
   * 예산 상태 확인
   */
  checkBudget(budgetId?: string): BudgetStatus;

  // === 알림 ===

  /**
   * 경고 임계값 도달 시 콜백
   */
  onWarning(callback: (status: BudgetStatus) => void): Subscription;

  /**
   * 예산 초과 시 콜백
   */
  onExceeded(callback: (status: BudgetStatus) => void): Subscription;

  // === 세션 통합 ===

  /**
   * 예산이 적용된 세션 생성
   */
  withBudget<T>(budget: TokenBudget, operation: () => Promise<T>): Promise<T>;
}

export interface TokenBudgetConfig {
  id?: string;
  name: string;

  // 한도
  maxTokens: number;
  maxCost?: number;  // USD

  // 임계값
  warningThreshold: number;  // 0-1

  // 기간
  period?: 'session' | 'daily' | 'weekly' | 'monthly';

  // 동작
  onExceed: 'warn' | 'block' | 'throttle';
}

export interface TokenBudget {
  id: string;
  config: TokenBudgetConfig;

  // 현재 상태
  currentTokens: number;
  currentCost: number;

  // 상태
  status: 'active' | 'warning' | 'exceeded';

  // 타임스탬프
  createdAt: Date;
  resetAt?: Date;
}

export interface TokenUsage {
  budgetId?: string;

  // 토큰 정보
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;

  // 비용 (선택)
  cost?: number;

  // 메타데이터
  model: string;
  operation: string;
  timestamp: Date;
}

export interface BudgetStatus {
  budget: TokenBudget;

  // 사용률
  tokenUsagePercent: number;
  costUsagePercent?: number;

  // 잔여
  remainingTokens: number;
  remainingCost?: number;

  // 상태
  isWarning: boolean;
  isExceeded: boolean;

  // 예측
  estimatedRunout?: Date;
}
```

#### 11.2.2 Token Budget Manager 구현

```typescript
// src/dx/token-budget/impl/token-budget-manager.impl.ts

@Injectable()
export class TokenBudgetManager implements ITokenBudgetManager {
  private budgets = new Map<string, TokenBudget>();
  private usageHistory: TokenUsage[] = [];
  private warningCallbacks: ((status: BudgetStatus) => void)[] = [];
  private exceededCallbacks: ((status: BudgetStatus) => void)[] = [];

  constructor(
    @Inject(TOKENS.Config) private readonly config: IConfig,
    @Inject(TOKENS.EventBus) private readonly eventBus: IEventBus,
    @Inject(TOKENS.Logger) private readonly logger: ILogger,
  ) {
    // 기본 예산 생성
    const defaultConfig = this.config.get<TokenBudgetConfig>('dx.tokenBudget.default');
    if (defaultConfig) {
      this.createBudget(defaultConfig);
    }
  }

  createBudget(config: TokenBudgetConfig): TokenBudget {
    const budget: TokenBudget = {
      id: config.id || generateId(),
      config,
      currentTokens: 0,
      currentCost: 0,
      status: 'active',
      createdAt: new Date(),
    };

    this.budgets.set(budget.id, budget);
    this.logger.info(`Token budget created: ${budget.id} (max: ${config.maxTokens} tokens)`);

    return budget;
  }

  recordUsage(usage: TokenUsage): void {
    // 사용량 기록
    this.usageHistory.push(usage);

    // 예산 업데이트
    const budgetId = usage.budgetId || 'default';
    const budget = this.budgets.get(budgetId);

    if (budget) {
      budget.currentTokens += usage.totalTokens;
      if (usage.cost) {
        budget.currentCost += usage.cost;
      }

      // 상태 확인
      const status = this.checkBudget(budgetId);

      if (status.isExceeded && budget.status !== 'exceeded') {
        budget.status = 'exceeded';
        this.triggerExceeded(status);
      } else if (status.isWarning && budget.status === 'active') {
        budget.status = 'warning';
        this.triggerWarning(status);
      }
    }

    // 이벤트 발행
    this.eventBus.emit({
      type: 'dx:token:usage',
      payload: usage,
    });
  }

  checkBudget(budgetId?: string): BudgetStatus {
    const budget = this.budgets.get(budgetId || 'default');

    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    const tokenUsagePercent = budget.currentTokens / budget.config.maxTokens;
    const costUsagePercent = budget.config.maxCost
      ? budget.currentCost / budget.config.maxCost
      : undefined;

    return {
      budget,
      tokenUsagePercent,
      costUsagePercent,
      remainingTokens: budget.config.maxTokens - budget.currentTokens,
      remainingCost: budget.config.maxCost
        ? budget.config.maxCost - budget.currentCost
        : undefined,
      isWarning: tokenUsagePercent >= budget.config.warningThreshold,
      isExceeded: tokenUsagePercent >= 1.0,
      estimatedRunout: this.estimateRunout(budget),
    };
  }

  async withBudget<T>(budget: TokenBudget, operation: () => Promise<T>): Promise<T> {
    const status = this.checkBudget(budget.id);

    if (status.isExceeded && budget.config.onExceed === 'block') {
      throw new BudgetExceededError(budget.id, status);
    }

    try {
      return await operation();
    } finally {
      // 작업 후 상태 재확인
      const newStatus = this.checkBudget(budget.id);
      if (newStatus.isExceeded && !status.isExceeded) {
        this.logger.warn(`Budget exceeded during operation: ${budget.id}`);
      }
    }
  }

  onWarning(callback: (status: BudgetStatus) => void): Subscription {
    this.warningCallbacks.push(callback);
    return {
      unsubscribe: () => {
        const index = this.warningCallbacks.indexOf(callback);
        if (index > -1) this.warningCallbacks.splice(index, 1);
      },
    };
  }

  onExceeded(callback: (status: BudgetStatus) => void): Subscription {
    this.exceededCallbacks.push(callback);
    return {
      unsubscribe: () => {
        const index = this.exceededCallbacks.indexOf(callback);
        if (index > -1) this.exceededCallbacks.splice(index, 1);
      },
    };
  }

  private triggerWarning(status: BudgetStatus): void {
    this.logger.warn(`Token budget warning: ${status.budget.id} at ${(status.tokenUsagePercent * 100).toFixed(1)}%`);
    this.warningCallbacks.forEach(cb => cb(status));
    this.eventBus.emit({
      type: 'dx:budget:warning',
      payload: status,
    });
  }

  private triggerExceeded(status: BudgetStatus): void {
    this.logger.error(`Token budget exceeded: ${status.budget.id}`);
    this.exceededCallbacks.forEach(cb => cb(status));
    this.eventBus.emit({
      type: 'dx:budget:exceeded',
      payload: status,
    });
  }

  private estimateRunout(budget: TokenBudget): Date | undefined {
    // 최근 사용 패턴 기반 예측
    const recentUsage = this.usageHistory
      .filter(u => u.budgetId === budget.id)
      .slice(-10);

    if (recentUsage.length < 2) return undefined;

    const avgTokensPerMinute = this.calculateAvgTokensPerMinute(recentUsage);
    if (avgTokensPerMinute <= 0) return undefined;

    const remainingTokens = budget.config.maxTokens - budget.currentTokens;
    const minutesUntilRunout = remainingTokens / avgTokensPerMinute;

    return new Date(Date.now() + minutesUntilRunout * 60 * 1000);
  }
}
```

### 11.3 Error Recovery Library

```typescript
// src/dx/error-recovery/interfaces/error-recovery.interface.ts

/**
 * 에러 복구 라이브러리 인터페이스
 *
 * 목적: 도구 실행 실패 시 자동 복구 전략 제공
 * 출처: claude-code-dx-improvement-tools.md
 */
export interface IErrorRecovery {
  // === 재시도 ===

  /**
   * 재시도 전략으로 작업 실행
   */
  retry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions,
  ): Promise<T>;

  // === 서킷 브레이커 ===

  /**
   * 서킷 브레이커로 작업 실행
   */
  withCircuitBreaker<T>(
    operation: () => Promise<T>,
    options?: CircuitBreakerOptions,
  ): Promise<T>;

  // === 폴백 ===

  /**
   * 폴백 전략으로 작업 실행
   */
  withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    options?: FallbackOptions,
  ): Promise<T>;

  // === 조합 ===

  /**
   * 여러 전략 조합
   */
  compose<T>(
    operation: () => Promise<T>,
    strategies: RecoveryStrategy[],
  ): Promise<T>;
}

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;  // ms
  maxDelay: number;      // ms
  backoffMultiplier: number;
  retryOn?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;        // ms
  resetTimeout: number;   // ms
  onOpen?: () => void;
  onClose?: () => void;
  onHalfOpen?: () => void;
}

export interface FallbackOptions {
  timeout?: number;
  shouldFallback?: (error: Error) => boolean;
  onFallback?: (error: Error) => void;
}

export type RecoveryStrategy =
  | { type: 'retry'; options: RetryOptions }
  | { type: 'circuitBreaker'; options: CircuitBreakerOptions }
  | { type: 'fallback'; fallback: () => Promise<unknown>; options?: FallbackOptions };
```

#### 11.3.2 Retry Strategy 구현

```typescript
// src/dx/error-recovery/impl/retry-strategy.impl.ts

@Injectable()
export class RetryStrategy {
  constructor(
    @Inject(TOKENS.Logger) private readonly logger: ILogger,
    @Inject(TOKENS.EventBus) private readonly eventBus: IEventBus,
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = this.getDefaultOptions(),
  ): Promise<T> {
    let lastError: Error;
    let delay = options.initialDelay;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation();

      } catch (error) {
        lastError = error as Error;

        // 재시도 가능 여부 확인
        if (options.retryOn && !options.retryOn(lastError)) {
          throw lastError;
        }

        // 마지막 시도였으면 에러 throw
        if (attempt === options.maxAttempts) {
          this.logger.error(`All ${options.maxAttempts} retry attempts failed`);
          throw lastError;
        }

        // 재시도 콜백
        options.onRetry?.(attempt, lastError);

        this.logger.warn(
          `Attempt ${attempt}/${options.maxAttempts} failed, retrying in ${delay}ms`,
          lastError,
        );

        // 이벤트 발행
        this.eventBus.emit({
          type: 'dx:retry:attempt',
          payload: { attempt, maxAttempts: options.maxAttempts, delay, error: lastError.message },
        });

        // 대기
        await this.sleep(delay);

        // 지수 백오프
        delay = Math.min(delay * options.backoffMultiplier, options.maxDelay);
      }
    }

    throw lastError!;
  }

  private getDefaultOptions(): RetryOptions {
    return {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 11.3.3 Circuit Breaker 구현

```typescript
// src/dx/error-recovery/impl/circuit-breaker.impl.ts

enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

@Injectable()
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private resetTimer?: NodeJS.Timeout;

  constructor(
    @Inject(TOKENS.Logger) private readonly logger: ILogger,
    @Inject(TOKENS.EventBus) private readonly eventBus: IEventBus,
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    options: CircuitBreakerOptions,
  ): Promise<T> {
    // OPEN 상태면 즉시 실패
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset(options.resetTimeout)) {
        this.transitionTo(CircuitState.HALF_OPEN, options);
      } else {
        throw new CircuitOpenError('Circuit breaker is open');
      }
    }

    try {
      // 타임아웃 적용
      const result = await this.withTimeout(operation(), options.timeout);

      this.recordSuccess(options);
      return result;

    } catch (error) {
      this.recordFailure(options);
      throw error;
    }
  }

  private recordSuccess(options: CircuitBreakerOptions): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED, options);
      }
    }

    this.failureCount = 0;
  }

  private recordFailure(options: CircuitBreakerOptions): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN, options);
    } else if (this.failureCount >= options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN, options);
    }
  }

  private transitionTo(newState: CircuitState, options: CircuitBreakerOptions): void {
    const oldState = this.state;
    this.state = newState;

    this.logger.info(`Circuit breaker: ${oldState} → ${newState}`);

    this.eventBus.emit({
      type: 'dx:circuitBreaker:stateChange',
      payload: { from: oldState, to: newState },
    });

    switch (newState) {
      case CircuitState.OPEN:
        options.onOpen?.();
        this.scheduleReset(options.resetTimeout, options);
        break;
      case CircuitState.CLOSED:
        options.onClose?.();
        this.failureCount = 0;
        this.successCount = 0;
        break;
      case CircuitState.HALF_OPEN:
        options.onHalfOpen?.();
        this.successCount = 0;
        break;
    }
  }

  private scheduleReset(timeout: number, options: CircuitBreakerOptions): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitState.OPEN) {
        this.transitionTo(CircuitState.HALF_OPEN, options);
      }
    }, timeout);
  }

  private shouldAttemptReset(resetTimeout: number): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime.getTime() >= resetTimeout;
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new TimeoutError('Operation timed out')), timeout)
      ),
    ]);
  }
}
```

### 11.4 Agent Testing Framework

```typescript
// src/dx/testing/interfaces/agent-testing.interface.ts

/**
 * 에이전트 테스팅 프레임워크 인터페이스
 *
 * 목적: 에이전트 로직 테스트를 위한 모킹 및 시나리오 실행
 * 출처: claude-code-dx-improvement-tools.md
 */
export interface IAgentTestRunner {
  // === 테스트 실행 ===

  /**
   * 테스트 시나리오 실행
   */
  runScenario(scenario: TestScenario): Promise<TestResult>;

  /**
   * 여러 시나리오 실행
   */
  runScenarios(scenarios: TestScenario[]): Promise<TestSuiteResult>;

  // === 모킹 ===

  /**
   * Mock LLM 클라이언트 생성
   */
  createMockLLM(config: MockLLMConfig): IMockLLMClient;

  /**
   * Mock 도구 생성
   */
  createMockTool(config: MockToolConfig): IMockTool;

  // === 검증 ===

  /**
   * 에이전트 출력 검증
   */
  assertOutput(actual: TaskResult, expected: ExpectedOutput): AssertionResult;

  /**
   * 도구 호출 검증
   */
  assertToolCalls(calls: ToolCall[], expected: ExpectedToolCall[]): AssertionResult;
}

export interface TestScenario {
  name: string;
  description?: string;

  // 테스트 대상
  agentType: AgentType;
  agentConfig?: Partial<AgentConfig>;

  // 입력
  task: Task;

  // 모킹
  mockLLMResponses?: MockLLMResponse[];
  mockToolResults?: Record<string, unknown>;

  // 기대값
  expected: {
    success?: boolean;
    outputMatches?: (output: unknown) => boolean;
    toolCallCount?: number;
    toolCallSequence?: string[];
    maxDuration?: number;
  };

  // 훅
  beforeRun?: () => Promise<void>;
  afterRun?: (result: TestResult) => Promise<void>;
}

export interface MockLLMConfig {
  responses: MockLLMResponse[];
  defaultResponse?: string;
  latency?: number;
  errorRate?: number;
}

export interface MockLLMResponse {
  trigger: string | RegExp | ((input: string) => boolean);
  response: string | ChatResult | (() => string | ChatResult);
  toolCalls?: ToolCall[];
}

export interface TestResult {
  scenario: TestScenario;
  passed: boolean;

  // 실행 결과
  taskResult?: TaskResult;
  duration: number;

  // 검증 결과
  assertions: AssertionResult[];

  // 추적
  toolCalls: ToolCall[];
  llmCalls: LLMCallRecord[];

  // 에러
  error?: Error;
}
```

#### 11.4.2 Mock LLM Client

```typescript
// src/dx/testing/impl/mock-llm-client.impl.ts

/**
 * 테스트용 Mock LLM 클라이언트
 */
export class MockLLMClient implements ILLMClient {
  readonly provider = 'mock' as LLMProvider;
  readonly model = 'mock-model';
  readonly capabilities: LLMCapability[] = ['chat', 'tools'];

  private responseIndex = 0;
  private callHistory: LLMCallRecord[] = [];

  constructor(private readonly config: MockLLMConfig) {}

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    // 호출 기록
    this.callHistory.push({
      messages,
      options,
      timestamp: new Date(),
    });

    // 지연 시뮬레이션
    if (this.config.latency) {
      await this.sleep(this.config.latency);
    }

    // 에러 시뮬레이션
    if (this.config.errorRate && Math.random() < this.config.errorRate) {
      throw new Error('Simulated LLM error');
    }

    // 응답 찾기
    const lastMessage = messages[messages.length - 1];
    const response = this.findResponse(lastMessage.content as string);

    return {
      content: typeof response === 'string' ? response : response.content,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      model: this.model,
    };
  }

  async chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options?: ChatWithToolsOptions,
  ): Promise<ChatWithToolsResult> {
    const result = await this.chat(messages, options);

    // 응답에서 도구 호출 추출
    const mockResponse = this.findMockResponse(messages[messages.length - 1].content as string);

    return {
      ...result,
      toolCalls: mockResponse?.toolCalls || [],
      hasToolCalls: (mockResponse?.toolCalls?.length || 0) > 0,
    };
  }

  async *chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncIterable<ChatChunk> {
    const result = await this.chat(messages, options);
    const content = result.content as string;

    // 청크 단위로 스트리밍
    for (let i = 0; i < content.length; i += 10) {
      yield {
        content: content.slice(i, i + 10),
        done: i + 10 >= content.length,
      };
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    // 간단한 토큰 추정
    return messages.reduce((sum, m) => sum + (m.content as string).length / 4, 0);
  }

  getMaxTokens(): number {
    return 128000;
  }

  getRemainingTokens(used: number): number {
    return this.getMaxTokens() - used;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getUsage(): LLMUsage {
    return {
      totalTokens: this.callHistory.length * 150,
      requests: this.callHistory.length,
      errors: 0,
    };
  }

  getHealth(): HealthStatus {
    return {
      healthy: true,
      checks: {},
      lastCheckedAt: new Date(),
    };
  }

  // 테스트 유틸리티

  getCallHistory(): LLMCallRecord[] {
    return [...this.callHistory];
  }

  resetHistory(): void {
    this.callHistory = [];
    this.responseIndex = 0;
  }

  private findResponse(input: string): string | ChatResult {
    for (const resp of this.config.responses) {
      const trigger = resp.trigger;
      const matches =
        typeof trigger === 'string' ? input.includes(trigger) :
        trigger instanceof RegExp ? trigger.test(input) :
        trigger(input);

      if (matches) {
        return typeof resp.response === 'function' ? resp.response() : resp.response;
      }
    }

    return this.config.defaultResponse || 'Mock response';
  }

  private findMockResponse(input: string): MockLLMResponse | undefined {
    return this.config.responses.find(resp => {
      const trigger = resp.trigger;
      return typeof trigger === 'string' ? input.includes(trigger) :
        trigger instanceof RegExp ? trigger.test(input) :
        trigger(input);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 11.5 MCP Health Monitor

```typescript
// src/dx/mcp-health/interfaces/mcp-health.interface.ts

/**
 * MCP 서버 헬스 모니터 인터페이스
 *
 * 목적: MCP 서버 상태 모니터링 및 진단
 * 출처: claude-code-cli-dx-tools.md
 */
export interface IMCPHealthMonitor {
  // === 상태 확인 ===

  /**
   * 모든 MCP 서버 상태 확인
   */
  checkAll(): Promise<MCPHealthReport>;

  /**
   * 특정 서버 상태 확인
   */
  checkServer(serverId: string): Promise<MCPServerHealth>;

  // === 모니터링 ===

  /**
   * 주기적 헬스 체크 시작
   */
  startMonitoring(intervalMs: number): void;

  /**
   * 모니터링 중지
   */
  stopMonitoring(): void;

  // === 진단 ===

  /**
   * 서버 진단 실행
   */
  diagnose(serverId: string): Promise<MCPDiagnostics>;

  /**
   * 연결 테스트
   */
  testConnection(serverId: string): Promise<ConnectionTestResult>;

  // === 알림 ===

  /**
   * 상태 변경 시 콜백
   */
  onStatusChange(callback: (change: MCPStatusChange) => void): Subscription;

  /**
   * 서버 다운 시 콜백
   */
  onServerDown(callback: (serverId: string) => void): Subscription;
}

export interface MCPHealthReport {
  timestamp: Date;
  servers: Record<string, MCPServerHealth>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
  };
}

export interface MCPServerHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';

  // 지표
  latency?: number;
  uptime?: number;
  lastSuccessfulCall?: Date;
  errorRate?: number;

  // 기능
  availableTools?: string[];

  // 에러
  lastError?: {
    message: string;
    timestamp: Date;
  };
}

export interface MCPDiagnostics {
  serverId: string;
  timestamp: Date;

  // 연결 상태
  connection: {
    status: 'connected' | 'disconnected' | 'connecting';
    protocol: string;
    endpoint?: string;
  };

  // 성능
  performance: {
    avgLatency: number;
    p99Latency: number;
    throughput: number;
  };

  // 도구 상태
  tools: {
    total: number;
    available: number;
    failing: string[];
  };

  // 권장 사항
  recommendations: string[];
}
```

### 11.6 Session Manager

```typescript
// src/dx/session-manager/interfaces/session-manager.interface.ts

/**
 * 세션 관리자 인터페이스
 *
 * 목적: 작업 세션 저장/복원/검색
 * 출처: claude-code-cli-dx-tools.md
 */
export interface ISessionManager {
  // === 세션 생성/저장 ===

  /**
   * 새 세션 생성
   */
  createSession(config?: SessionConfig): Session;

  /**
   * 현재 세션 저장
   */
  saveSession(session: Session): Promise<void>;

  /**
   * 자동 저장 설정
   */
  enableAutoSave(intervalMs: number): void;

  // === 세션 복원 ===

  /**
   * 세션 복원
   */
  restoreSession(sessionId: string): Promise<Session>;

  /**
   * 최근 세션 복원
   */
  restoreLatest(): Promise<Session | null>;

  // === 세션 검색 ===

  /**
   * 세션 목록 조회
   */
  listSessions(filter?: SessionFilter): Promise<SessionSummary[]>;

  /**
   * 세션 검색
   */
  searchSessions(query: string): Promise<SessionSummary[]>;

  // === 세션 관리 ===

  /**
   * 세션 삭제
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * 세션 내보내기
   */
  exportSession(sessionId: string, format: ExportFormat): Promise<Buffer>;

  /**
   * 세션 가져오기
   */
  importSession(data: Buffer, format: ExportFormat): Promise<Session>;
}

export interface Session {
  id: string;
  name?: string;

  // 메타데이터
  createdAt: Date;
  updatedAt: Date;

  // 상태
  state: SessionState;

  // 컨텍스트
  context: {
    workingDirectory: string;
    projectId?: string;
    agentStates: Record<string, AgentState>;
    pendingTasks: Task[];
    conversationHistory: Message[];
  };

  // 설정
  config: SessionConfig;
}

export interface SessionState {
  status: 'active' | 'paused' | 'completed' | 'error';
  progress: number;  // 0-100
  currentPhase?: string;
}

export interface SessionConfig {
  name?: string;
  autoSave: boolean;
  autoSaveInterval?: number;
  maxHistoryLength?: number;
  retentionDays?: number;
}

export interface SessionSummary {
  id: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  progress: number;
  taskCount: number;
  projectName?: string;
}
```

---

## 12. DI 토큰 확장

```typescript
// src/core/di/tokens/tokens.ts (확장)

export const TOKENS = {
  // ... 기존 토큰 ...

  // === A2A 계층 ===
  A2AServer: createToken<IA2AServer>('A2AServer'),
  A2AClient: createToken<IA2AClient>('A2AClient'),
  A2AAgentAdapter: createToken<IA2AAgentAdapter>('A2AAgentAdapter'),
  A2AAgentRegistry: createToken<IA2AAgentRegistry>('A2AAgentRegistry'),

  // === DX 계층 ===
  TokenBudgetManager: createToken<ITokenBudgetManager>('TokenBudgetManager'),
  ErrorRecovery: createToken<IErrorRecovery>('ErrorRecovery'),
  RetryStrategy: createToken<RetryStrategy>('RetryStrategy'),
  CircuitBreaker: createToken<CircuitBreaker>('CircuitBreaker'),
  SmartConfigManager: createToken<ISmartConfigManager>('SmartConfigManager'),
  SessionManager: createToken<ISessionManager>('SessionManager'),
  MCPHealthMonitor: createToken<IMCPHealthMonitor>('MCPHealthMonitor'),
  AgentTestRunner: createToken<IAgentTestRunner>('AgentTestRunner'),
} as const;
```

---

## 13. 모듈 의존성 그래프 (확장)

```
                         ┌──────────────────┐
                         │    CLI / API     │
                         └────────┬─────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    Core Domain Services   │
                    │  (Orchestrator, Project,  │
                    │   Workflow, Agent)        │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────┬───────────┼───────────┬───────────┬───────────┐
          │           │           │           │           │           │
    ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐ ┌───▼───┐
    │  Agents   │ │ Tools │ │   Hooks   │ │  LLM  │ │   A2A     │ │  DX   │
    └─────┬─────┘ └───┬───┘ └─────┬─────┘ └───┬───┘ └─────┬─────┘ └───┬───┘
          │           │           │           │           │           │
          │           │           │           │           │           │
          └───────────┴───────────┼───────────┴───────────┴───────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │     Infrastructure        │
                    │  (Messaging, Storage)     │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Core (DI, Events)    │
                    └───────────────────────────┘
```

---

## 14. 다음 단계

1. **구현 시작**: REFACTORING_PLAN.md의 Stage 1부터 순차 진행
2. **테스트 우선**: 각 모듈 인터페이스에 대한 테스트 먼저 작성
3. **점진적 마이그레이션**: 기존 코드와 병행 운영 후 전환
4. **문서화**: API 문서, 사용 가이드 작성
5. **A2A 통합**: 외부 에이전트 협업 테스트
6. **DX 도구 검증**: 토큰 예산, 에러 복구 도구 검증
