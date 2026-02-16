# F009 - Agent 통합

> **우선순위**: P3 (Consolidation)
> **모듈**: `src/core/agents/`
> **상태**: ✅ 완료
> **의존성**: P0, P1, P2 완료 후
> **리스크**: Low (마이그레이션 완료)
> **완료일**: 2026-02-08
> **현재 코드 상태 (As-Is, 2026-02-08)**: ✅ 구조 통합 완료 (10,254줄), 테스트 6,754+개 통과

---

## 1. 개요

### 1.1 목적

Agent 통합은 **현재 3곳에 분산된 에이전트 정의를 단일 구조로 통합**하는 대규모 리팩토링 작업입니다. 이를 통해 코드 중복을 제거하고, 일관된 에이전트 아키텍처를 제공하며, 장기적인 유지보수성을 크게 향상시킵니다.

### 1.2 현재 분산 상태

```
현재 (3곳 분산):
├── src/agents/                    # 레거시 (13K LOC)
│   ├── coder/                     # 코더 에이전트
│   ├── manager/                   # 매니저 에이전트
│   ├── reviewer/                  # 리뷰어 에이전트
│   └── repo-manager/              # 레포 매니저 에이전트
│
├── src/core/agents/               # 리팩토링 버전 (5K LOC)
│   ├── base-agent.ts              # 베이스 에이전트
│   ├── agent-factory.ts           # 팩토리
│   ├── agent-registry.ts          # 레지스트리
│   └── specialized/               # 전문화 에이전트 (200K LOC)
│       ├── architect-agent.ts
│       ├── coder-agent.ts
│       └── ...
│
└── src/core/orchestrator/agents/  # 팀 에이전트
    ├── base-team-agent.ts
    └── ...
```

### 1.3 통합 후 목표 구조

```
통합 후:
└── src/core/agents/               # 통합된 에이전트 시스템
    ├── index.ts                   # 통합 export
    │
    ├── base/                      # 기본 클래스
    │   ├── base-agent.ts
    │   ├── agent-factory.ts
    │   ├── agent-registry.ts
    │   └── interfaces/
    │       └── agent.interface.ts
    │
    ├── specialized/               # 전문화 에이전트 (유지)
    │   ├── architect-agent.ts
    │   ├── coder-agent.ts
    │   ├── docwriter-agent.ts
    │   ├── explorer-agent.ts
    │   ├── librarian-agent.ts
    │   ├── reviewer-agent.ts
    │   └── tester-agent.ts
    │
    ├── teams/                     # 팀 에이전트 (orchestrator에서 이동)
    │   ├── base-team-agent.ts
    │   ├── planning-agent.ts
    │   ├── development-agent.ts
    │   └── qa-agent.ts
    │
    ├── communication/             # 에이전트 간 통신
    │   ├── agent-communication.ts
    │   ├── message-bus.ts
    │   └── protocol/
    │       └── message.interface.ts
    │
    ├── execution/                 # 실행 관리
    │   ├── background-executor.ts
    │   ├── task-queue.ts
    │   └── execution-context.ts
    │
    └── _legacy/                   # 마이그레이션 대기
        ├── README.md              # 마이그레이션 안내
        └── [기존 src/agents/ 내용]
```

### 1.4 핵심 가치

| 측면 | 현재 | 통합 후 |
|-----|-----|--------|
| 코드 위치 | 3곳 분산 | 1곳 집중 |
| 중복 코드 | 상당량 | 최소화 |
| 아키텍처 | 불일치 | 통일된 구조 |
| 의존성 | 복잡/순환 위험 | 계층화/단순화 |
| 테스트 | 분산/중복 | 집중/효율적 |
| 신규 에이전트 | 배치 혼란 | 명확한 가이드 |

---

## 2. 상세 스펙

### 2.1 통합 인터페이스 정의

```typescript
// src/core/agents/base/interfaces/agent.interface.ts

/**
 * 에이전트 타입 열거형
 */
export enum AgentType {
  // 전문화 에이전트
  ARCHITECT = 'architect',
  CODER = 'coder',
  DOCWRITER = 'docwriter',
  EXPLORER = 'explorer',
  LIBRARIAN = 'librarian',
  REVIEWER = 'reviewer',
  TESTER = 'tester',

  // 팀 에이전트
  PLANNING_TEAM = 'planning-team',
  DEVELOPMENT_TEAM = 'development-team',
  QA_TEAM = 'qa-team',

  // 레거시 (마이그레이션 대상)
  LEGACY_CODER = 'legacy-coder',
  LEGACY_MANAGER = 'legacy-manager',
  LEGACY_REVIEWER = 'legacy-reviewer',
}

/**
 * 에이전트 상태
 */
export enum AgentState {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TERMINATED = 'terminated',
}

/**
 * 에이전트 역량
 */
export interface AgentCapabilities {
  canExecuteCode: boolean;
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canAccessNetwork: boolean;
  canSpawnSubAgents: boolean;
  canCommunicate: boolean;
  maxConcurrentTasks: number;
  supportedLanguages: string[];
  supportedFrameworks: string[];
}

/**
 * 에이전트 설정
 */
export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  capabilities: AgentCapabilities;
  timeout: number;              // ms
  retryCount: number;
  priority: number;             // 0-10
  metadata?: Record<string, unknown>;
}

/**
 * 에이전트 컨텍스트
 */
export interface AgentContext {
  taskId: string;
  parentAgentId?: string;
  workingDirectory: string;
  environment: Record<string, string>;
  sharedState: Map<string, unknown>;
  startTime: Date;
  deadline?: Date;
}

/**
 * 에이전트 태스크
 */
export interface AgentTask {
  id: string;
  type: string;
  description: string;
  input: unknown;
  priority: number;
  deadline?: Date;
  dependencies?: string[];      // 다른 task IDs
  metadata?: Record<string, unknown>;
}

/**
 * 에이전트 결과
 */
export interface AgentResult {
  taskId: string;
  agentId: string;
  success: boolean;
  output?: unknown;
  error?: AgentError;
  metrics: AgentMetrics;
  artifacts?: AgentArtifact[];
}

/**
 * 에이전트 에러
 */
export interface AgentError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
  recoverable: boolean;
}

/**
 * 에이전트 메트릭
 */
export interface AgentMetrics {
  startTime: Date;
  endTime: Date;
  duration: number;             // ms
  tokensUsed: number;
  apiCalls: number;
  filesModified: number;
  subAgentsSpawned: number;
}

/**
 * 에이전트 아티팩트
 */
export interface AgentArtifact {
  type: 'file' | 'code' | 'report' | 'log';
  name: string;
  path?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * IAgent 인터페이스
 */
export interface IAgent {
  // 기본 정보
  readonly id: string;
  readonly type: AgentType;
  readonly state: AgentState;
  readonly capabilities: AgentCapabilities;

  // 생명주기
  initialize(config: AgentConfig): Promise<void>;
  start(context: AgentContext): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  terminate(): Promise<void>;

  // 태스크 실행
  execute(task: AgentTask): Promise<AgentResult>;
  canHandle(task: AgentTask): boolean;

  // 통신
  send(targetAgentId: string, message: AgentMessage): Promise<void>;
  receive(message: AgentMessage): Promise<void>;
  broadcast(message: AgentMessage): Promise<void>;

  // 이벤트
  on(event: AgentEvent, handler: AgentEventHandler): void;
  off(event: AgentEvent, handler: AgentEventHandler): void;

  // 상태
  getState(): AgentState;
  getMetrics(): AgentMetrics;
  getContext(): AgentContext | null;
}

/**
 * 에이전트 메시지
 */
export interface AgentMessage {
  id: string;
  type: 'request' | 'response' | 'broadcast' | 'notification';
  senderId: string;
  receiverId?: string;         // broadcast 시 undefined
  payload: unknown;
  timestamp: Date;
  correlationId?: string;      // 요청-응답 연결용
  priority: number;
}

/**
 * 에이전트 이벤트
 */
export type AgentEvent =
  | 'state-changed'
  | 'task-started'
  | 'task-completed'
  | 'task-failed'
  | 'message-received'
  | 'error';

/**
 * 에이전트 이벤트 핸들러
 */
export type AgentEventHandler = (data: AgentEventData) => void;

/**
 * 에이전트 이벤트 데이터
 */
export interface AgentEventData {
  event: AgentEvent;
  agentId: string;
  timestamp: Date;
  details: unknown;
}
```

### 2.2 팀 에이전트 인터페이스

```typescript
// src/core/agents/teams/interfaces/team-agent.interface.ts

import { IAgent, AgentConfig, AgentResult, AgentTask } from '../../base/interfaces/agent.interface';

/**
 * 팀 구성원
 */
export interface TeamMember {
  agentId: string;
  role: string;
  capabilities: string[];
  status: 'available' | 'busy' | 'offline';
}

/**
 * 팀 태스크 할당
 */
export interface TaskAssignment {
  taskId: string;
  assigneeId: string;
  assignedAt: Date;
  deadline?: Date;
  priority: number;
}

/**
 * 팀 설정
 */
export interface TeamConfig extends AgentConfig {
  teamName: string;
  maxMembers: number;
  coordinationStrategy: 'sequential' | 'parallel' | 'dynamic';
  failurePolicy: 'fail-fast' | 'continue' | 'retry';
}

/**
 * ITeamAgent 인터페이스
 */
export interface ITeamAgent extends IAgent {
  // 팀 관리
  getMembers(): TeamMember[];
  addMember(agent: IAgent, role: string): Promise<void>;
  removeMember(agentId: string): Promise<void>;

  // 태스크 분배
  assignTask(task: AgentTask, assigneeId: string): Promise<void>;
  reassignTask(taskId: string, newAssigneeId: string): Promise<void>;
  getAssignments(): TaskAssignment[];

  // 조율
  coordinate(tasks: AgentTask[]): Promise<AgentResult[]>;
  synchronize(): Promise<void>;
  resolveConflict(conflict: TeamConflict): Promise<void>;
}

/**
 * 팀 충돌
 */
export interface TeamConflict {
  type: 'resource' | 'dependency' | 'priority';
  involvedAgents: string[];
  description: string;
  resolution?: string;
}
```

### 2.3 통신 프로토콜

```typescript
// src/core/agents/communication/protocol/message.interface.ts

/**
 * 메시지 유형
 */
export enum MessageType {
  // 요청/응답
  REQUEST = 'request',
  RESPONSE = 'response',

  // 알림
  NOTIFICATION = 'notification',
  BROADCAST = 'broadcast',

  // 제어
  CONTROL = 'control',
  HEARTBEAT = 'heartbeat',

  // 상태
  STATE_UPDATE = 'state-update',
  PROGRESS_UPDATE = 'progress-update',
}

/**
 * 메시지 우선순위
 */
export enum MessagePriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  CRITICAL = 10,
}

/**
 * 메시지 상태
 */
export enum MessageStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  PROCESSED = 'processed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/**
 * 메시지 구조
 */
export interface Message {
  id: string;
  type: MessageType;
  priority: MessagePriority;
  status: MessageStatus;

  // 발신/수신
  senderId: string;
  receiverId?: string;         // broadcast 시 undefined
  recipientFilter?: RecipientFilter;

  // 내용
  subject: string;
  payload: unknown;

  // 메타데이터
  timestamp: Date;
  expiresAt?: Date;
  correlationId?: string;
  replyTo?: string;

  // 추적
  traceId?: string;
  spanId?: string;
}

/**
 * 수신자 필터
 */
export interface RecipientFilter {
  types?: AgentType[];
  capabilities?: string[];
  states?: AgentState[];
  tags?: string[];
}

/**
 * 메시지 버스 인터페이스
 */
export interface IMessageBus {
  // 발행/구독
  publish(message: Message): Promise<void>;
  subscribe(filter: MessageFilter, handler: MessageHandler): Subscription;
  unsubscribe(subscription: Subscription): void;

  // 요청/응답
  request(message: Message, timeout?: number): Promise<Message>;
  respond(originalMessageId: string, response: Message): Promise<void>;

  // 상태
  getQueueSize(): number;
  getPendingMessages(): Message[];
  getDeliveryStats(): DeliveryStats;
}

/**
 * 메시지 필터
 */
export interface MessageFilter {
  types?: MessageType[];
  senders?: string[];
  priorities?: MessagePriority[];
  subjects?: string[];
  customFilter?: (message: Message) => boolean;
}

/**
 * 메시지 핸들러
 */
export type MessageHandler = (message: Message) => Promise<void>;

/**
 * 구독
 */
export interface Subscription {
  id: string;
  filter: MessageFilter;
  createdAt: Date;
  active: boolean;
}

/**
 * 배달 통계
 */
export interface DeliveryStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  averageLatency: number;
  queueDepth: number;
}
```

---

## 3. 구현 가이드

### 3.1 파일 구조

```
src/core/agents/
├── index.ts
│
├── base/
│   ├── index.ts
│   ├── base-agent.ts
│   ├── agent-factory.ts
│   ├── agent-registry.ts
│   └── interfaces/
│       ├── index.ts
│       └── agent.interface.ts
│
├── specialized/
│   ├── index.ts
│   ├── architect-agent.ts
│   ├── coder-agent.ts
│   ├── docwriter-agent.ts
│   ├── explorer-agent.ts
│   ├── librarian-agent.ts
│   ├── reviewer-agent.ts
│   └── tester-agent.ts
│
├── teams/
│   ├── index.ts
│   ├── base-team-agent.ts
│   ├── planning-agent.ts
│   ├── development-agent.ts
│   ├── qa-agent.ts
│   └── interfaces/
│       └── team-agent.interface.ts
│
├── communication/
│   ├── index.ts
│   ├── agent-communication.ts
│   ├── message-bus.ts
│   └── protocol/
│       └── message.interface.ts
│
├── execution/
│   ├── index.ts
│   ├── background-executor.ts
│   ├── task-queue.ts
│   └── execution-context.ts
│
└── _legacy/
    ├── README.md
    └── ... (기존 src/agents/ 내용)
```

### 3.2 베이스 에이전트 구현

```typescript
// src/core/agents/base/base-agent.ts

import {
  IAgent,
  AgentType,
  AgentState,
  AgentCapabilities,
  AgentConfig,
  AgentContext,
  AgentTask,
  AgentResult,
  AgentMessage,
  AgentMetrics,
  AgentEvent,
  AgentEventHandler,
  AgentEventData,
} from './interfaces/agent.interface';

/**
 * BaseAgent
 *
 * 모든 에이전트의 기본 클래스
 */
export abstract class BaseAgent implements IAgent {
  public readonly id: string;
  public readonly type: AgentType;

  protected _state: AgentState = AgentState.IDLE;
  protected _capabilities: AgentCapabilities;
  protected _context: AgentContext | null = null;
  protected _config: AgentConfig | null = null;
  protected _metrics: AgentMetrics;

  private eventHandlers: Map<AgentEvent, Set<AgentEventHandler>>;

  constructor(id: string, type: AgentType, capabilities: AgentCapabilities) {
    this.id = id;
    this.type = type;
    this._capabilities = capabilities;
    this.eventHandlers = new Map();
    this._metrics = this.initializeMetrics();

    // 이벤트 핸들러 맵 초기화
    const events: AgentEvent[] = [
      'state-changed',
      'task-started',
      'task-completed',
      'task-failed',
      'message-received',
      'error',
    ];
    for (const event of events) {
      this.eventHandlers.set(event, new Set());
    }
  }

  // === Getters ===

  get state(): AgentState {
    return this._state;
  }

  get capabilities(): AgentCapabilities {
    return this._capabilities;
  }

  // === 생명주기 ===

  async initialize(config: AgentConfig): Promise<void> {
    this.setState(AgentState.INITIALIZING);
    this._config = config;

    try {
      await this.onInitialize(config);
      this.setState(AgentState.IDLE);
    } catch (error) {
      this.setState(AgentState.FAILED);
      throw error;
    }
  }

  async start(context: AgentContext): Promise<void> {
    if (this._state !== AgentState.IDLE) {
      throw new Error(`Cannot start agent in state: ${this._state}`);
    }

    this._context = context;
    this.setState(AgentState.RUNNING);
    this._metrics.startTime = new Date();

    await this.onStart(context);
  }

  async pause(): Promise<void> {
    if (this._state !== AgentState.RUNNING) {
      throw new Error(`Cannot pause agent in state: ${this._state}`);
    }

    this.setState(AgentState.PAUSED);
    await this.onPause();
  }

  async resume(): Promise<void> {
    if (this._state !== AgentState.PAUSED) {
      throw new Error(`Cannot resume agent in state: ${this._state}`);
    }

    this.setState(AgentState.RUNNING);
    await this.onResume();
  }

  async stop(): Promise<void> {
    this.setState(AgentState.COMPLETED);
    this._metrics.endTime = new Date();
    this._metrics.duration = this._metrics.endTime.getTime() - this._metrics.startTime.getTime();

    await this.onStop();
  }

  async terminate(): Promise<void> {
    this.setState(AgentState.TERMINATED);
    this._metrics.endTime = new Date();

    await this.onTerminate();
  }

  // === 태스크 실행 ===

  async execute(task: AgentTask): Promise<AgentResult> {
    if (this._state !== AgentState.RUNNING) {
      throw new Error(`Cannot execute task in state: ${this._state}`);
    }

    if (!this.canHandle(task)) {
      throw new Error(`Agent ${this.type} cannot handle task type: ${task.type}`);
    }

    this.emit('task-started', { task });

    try {
      const result = await this.doExecute(task);
      this.emit('task-completed', { task, result });
      return result;
    } catch (error) {
      this.emit('task-failed', { task, error });
      return {
        taskId: task.id,
        agentId: this.id,
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
        metrics: this._metrics,
      };
    }
  }

  abstract canHandle(task: AgentTask): boolean;

  // === 통신 ===

  async send(targetAgentId: string, message: AgentMessage): Promise<void> {
    await this.onSend(targetAgentId, message);
  }

  async receive(message: AgentMessage): Promise<void> {
    this.emit('message-received', { message });
    await this.onReceive(message);
  }

  async broadcast(message: AgentMessage): Promise<void> {
    await this.onBroadcast(message);
  }

  // === 이벤트 ===

  on(event: AgentEvent, handler: AgentEventHandler): void {
    this.eventHandlers.get(event)?.add(handler);
  }

  off(event: AgentEvent, handler: AgentEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  // === 상태 ===

  getState(): AgentState {
    return this._state;
  }

  getMetrics(): AgentMetrics {
    return { ...this._metrics };
  }

  getContext(): AgentContext | null {
    return this._context;
  }

  // === Protected Methods ===

  protected setState(newState: AgentState): void {
    const oldState = this._state;
    this._state = newState;
    this.emit('state-changed', { oldState, newState });
  }

  protected emit(event: AgentEvent, details: unknown): void {
    const data: AgentEventData = {
      event,
      agentId: this.id,
      timestamp: new Date(),
      details,
    };

    for (const handler of this.eventHandlers.get(event) ?? []) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Agent event handler error for ${event}:`, error);
      }
    }
  }

  // === Abstract Methods (구현 필요) ===

  protected abstract onInitialize(config: AgentConfig): Promise<void>;
  protected abstract onStart(context: AgentContext): Promise<void>;
  protected abstract onPause(): Promise<void>;
  protected abstract onResume(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onTerminate(): Promise<void>;
  protected abstract doExecute(task: AgentTask): Promise<AgentResult>;
  protected abstract onSend(targetAgentId: string, message: AgentMessage): Promise<void>;
  protected abstract onReceive(message: AgentMessage): Promise<void>;
  protected abstract onBroadcast(message: AgentMessage): Promise<void>;

  // === Private Methods ===

  private initializeMetrics(): AgentMetrics {
    return {
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      tokensUsed: 0,
      apiCalls: 0,
      filesModified: 0,
      subAgentsSpawned: 0,
    };
  }
}
```

### 3.3 에이전트 팩토리

```typescript
// src/core/agents/base/agent-factory.ts

import { IAgent, AgentType, AgentConfig } from './interfaces/agent.interface';
import { ArchitectAgent } from '../specialized/architect-agent';
import { CoderAgent } from '../specialized/coder-agent';
import { ReviewerAgent } from '../specialized/reviewer-agent';
// ... 다른 에이전트 imports

/**
 * AgentFactory
 *
 * 에이전트 인스턴스 생성 팩토리
 */
export class AgentFactory {
  private static instance: AgentFactory;
  private agentCounter: number = 0;

  private constructor() {}

  static getInstance(): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory();
    }
    return AgentFactory.instance;
  }

  /**
   * 에이전트 생성
   */
  create(type: AgentType, config?: Partial<AgentConfig>): IAgent {
    const id = this.generateId(type);

    switch (type) {
      case AgentType.ARCHITECT:
        return new ArchitectAgent(id);
      case AgentType.CODER:
        return new CoderAgent(id);
      case AgentType.REVIEWER:
        return new ReviewerAgent(id);
      // ... 다른 에이전트 타입들
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  /**
   * 타입별 에이전트 생성
   */
  createArchitect(config?: Partial<AgentConfig>): IAgent {
    return this.create(AgentType.ARCHITECT, config);
  }

  createCoder(config?: Partial<AgentConfig>): IAgent {
    return this.create(AgentType.CODER, config);
  }

  createReviewer(config?: Partial<AgentConfig>): IAgent {
    return this.create(AgentType.REVIEWER, config);
  }

  // ... 다른 convenience 메서드들

  private generateId(type: AgentType): string {
    this.agentCounter++;
    return `${type}-${Date.now()}-${this.agentCounter}`;
  }
}
```

---

## 4. 마이그레이션 전략

### 4.1 단계별 마이그레이션

```yaml
단계:
  1_분석 (1주):
    작업:
      - 중복 코드 식별
      - 기능 매핑 (레거시 → 새 구조)
      - 테스트 커버리지 확인
      - 의존성 그래프 작성
    산출물:
      - 마이그레이션 매핑 문서
      - 중복 코드 목록
      - 테스트 갭 분석

  2_deprecated_표시 (2일):
    작업:
      - src/agents/ 전체에 @deprecated JSDoc 추가
      - console.warn 추가 (개발 모드)
      - _legacy/ 디렉토리 생성
      - 마이그레이션 가이드 작성
    산출물:
      - deprecation 주석
      - _legacy/README.md

  3_점진적_이동 (4주):
    작업:
      - 새 기능은 core/agents/에만 추가
      - 버그 수정 시 core/agents/로 이동
      - teams/ 이동 (orchestrator에서)
      - communication/ 구현
      - execution/ 구현
    검증:
      - 각 이동 시 테스트 통과
      - 하위 호환성 유지

  4_완전_전환 (1주):
    작업:
      - src/agents/ → src/core/agents/_legacy/
      - re-export 설정
      - 문서 업데이트
    검증:
      - 모든 테스트 통과
      - 레거시 import 동작

  5_정리 (6개월+ 후):
    작업:
      - _legacy/ 완전 제거
      - re-export 제거
      - 문서 최종 업데이트
    검증:
      - 레거시 코드 완전 제거
      - 새 구조만 사용
```

### 4.2 중복 코드 매핑

```typescript
// 마이그레이션 매핑 예시

const MIGRATION_MAP = {
  // 레거시 → 새 구조
  'src/agents/coder/coder-agent.ts': 'src/core/agents/specialized/coder-agent.ts',
  'src/agents/manager/manager-agent.ts': 'src/core/agents/teams/planning-agent.ts',
  'src/agents/reviewer/reviewer-agent.ts': 'src/core/agents/specialized/reviewer-agent.ts',
  'src/core/orchestrator/agents/base-team-agent.ts': 'src/core/agents/teams/base-team-agent.ts',

  // 기능 매핑
  'sendMessage': 'communication/agent-communication.ts',
  'executeInBackground': 'execution/background-executor.ts',
  'agentRegistry': 'base/agent-registry.ts',
};
```

### 4.3 레거시 호환 레이어

```typescript
// src/agents/index.ts (레거시 호환)

/**
 * @deprecated Use `import { ... } from '@/core/agents'` instead.
 * This module will be removed in version X.0.
 */

// 개발 모드 경고
if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATED] src/agents/ is deprecated. ' +
    'Use import from @/core/agents instead. ' +
    'This will be removed in version X.0.'
  );
}

// re-export
export * from '../core/agents';

// 레거시 이름 호환
export { CoderAgent as LegacyCoderAgent } from '../core/agents';
export { ReviewerAgent as LegacyReviewerAgent } from '../core/agents';
```

---

## 5. 사용 예시

### 5.1 에이전트 생성 및 실행

```typescript
import { AgentFactory, AgentType } from '@/core/agents';

// 팩토리로 에이전트 생성
const factory = AgentFactory.getInstance();
const coder = factory.create(AgentType.CODER);

// 초기화
await coder.initialize({
  id: coder.id,
  name: 'Primary Coder',
  type: AgentType.CODER,
  capabilities: coder.capabilities,
  timeout: 300000,
  retryCount: 3,
  priority: 5,
});

// 컨텍스트로 시작
await coder.start({
  taskId: 'task-001',
  workingDirectory: '/project',
  environment: { NODE_ENV: 'development' },
  sharedState: new Map(),
  startTime: new Date(),
});

// 태스크 실행
const result = await coder.execute({
  id: 'task-001-subtask-1',
  type: 'implement-feature',
  description: 'Implement login form',
  input: { requirements: '...' },
  priority: 5,
});

console.log('Result:', result);
```

### 5.2 팀 에이전트 조율

```typescript
import { AgentFactory, AgentType } from '@/core/agents';

const factory = AgentFactory.getInstance();

// 팀 에이전트 생성
const devTeam = factory.create(AgentType.DEVELOPMENT_TEAM);

// 팀 멤버 추가
const architect = factory.create(AgentType.ARCHITECT);
const coder = factory.create(AgentType.CODER);
const reviewer = factory.create(AgentType.REVIEWER);

await devTeam.addMember(architect, 'lead-architect');
await devTeam.addMember(coder, 'senior-developer');
await devTeam.addMember(reviewer, 'code-reviewer');

// 태스크 조율
const tasks = [
  { id: 't1', type: 'design', description: 'Design API' },
  { id: 't2', type: 'implement', description: 'Implement endpoints' },
  { id: 't3', type: 'review', description: 'Code review' },
];

const results = await devTeam.coordinate(tasks);
```

### 5.3 에이전트 간 통신

```typescript
import { MessageBus, MessageType, MessagePriority } from '@/core/agents/communication';

const bus = new MessageBus();

// 구독
bus.subscribe(
  { types: [MessageType.REQUEST], senders: ['coder-*'] },
  async (message) => {
    console.log('Received request:', message.subject);
    // 처리...
    await bus.respond(message.id, {
      // ... response
    });
  }
);

// 메시지 발행
await bus.publish({
  id: 'msg-001',
  type: MessageType.REQUEST,
  priority: MessagePriority.NORMAL,
  status: MessageStatus.PENDING,
  senderId: 'coder-1',
  receiverId: 'reviewer-1',
  subject: 'Code review request',
  payload: { files: ['auth.ts'] },
  timestamp: new Date(),
});
```

---

## 6. 검증 계획

### 6.1 단위 테스트

```typescript
// tests/unit/agents/base-agent.test.ts

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent('test-1', AgentType.CODER);
  });

  describe('lifecycle', () => {
    it('should transition through states correctly', async () => {
      expect(agent.state).toBe(AgentState.IDLE);

      await agent.initialize({ ... });
      expect(agent.state).toBe(AgentState.IDLE);

      await agent.start({ ... });
      expect(agent.state).toBe(AgentState.RUNNING);

      await agent.pause();
      expect(agent.state).toBe(AgentState.PAUSED);

      await agent.resume();
      expect(agent.state).toBe(AgentState.RUNNING);

      await agent.stop();
      expect(agent.state).toBe(AgentState.COMPLETED);
    });
  });

  describe('events', () => {
    it('should emit state-changed events', async () => {
      const events: AgentEventData[] = [];
      agent.on('state-changed', (data) => events.push(data));

      await agent.initialize({ ... });
      await agent.start({ ... });

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.details.newState === AgentState.RUNNING)).toBe(true);
    });
  });
});
```

### 6.2 통합 테스트

```typescript
// tests/integration/agents/agent-coordination.test.ts

describe('Agent Coordination', () => {
  it('should coordinate multiple agents', async () => {
    const factory = AgentFactory.getInstance();

    const architect = factory.create(AgentType.ARCHITECT);
    const coder = factory.create(AgentType.CODER);

    await architect.initialize({ ... });
    await coder.initialize({ ... });

    // 아키텍트가 설계
    const design = await architect.execute({
      id: 't1',
      type: 'design',
      description: 'Design system',
      input: {},
    });

    // 코더가 구현
    const implementation = await coder.execute({
      id: 't2',
      type: 'implement',
      description: 'Implement design',
      input: design.output,
    });

    expect(implementation.success).toBe(true);
  });
});
```

---

## 7. 체크리스트

### 7.1 구현 완료 조건

```markdown
## Agent 통합 체크리스트

### 분석 (P3.1)
- [ ] 에이전트 중복 분석 문서 작성
- [ ] 기능 매핑 완료
- [ ] 테스트 커버리지 확인

### 기반 구조 (P3.2)
- [ ] _legacy/ 디렉토리 생성
- [ ] @deprecated JSDoc 추가
- [ ] 마이그레이션 가이드 작성

### 핵심 구현 (P3.3)
- [ ] base/base-agent.ts 구현
- [ ] base/agent-factory.ts 구현
- [ ] base/agent-registry.ts 구현
- [ ] 인터페이스 정의 완료

### 팀 에이전트 (P3.4)
- [ ] teams/ 디렉토리 이동
- [ ] base-team-agent.ts 통합
- [ ] planning-agent.ts 통합
- [ ] development-agent.ts 통합
- [ ] qa-agent.ts 통합

### 통신 시스템 (P3.5)
- [ ] communication/ 구현
- [ ] message-bus.ts 구현
- [ ] 프로토콜 정의

### 실행 시스템 (P3.6)
- [ ] execution/ 구현
- [ ] background-executor.ts 구현
- [ ] task-queue.ts 구현

### 테스트 (P3.7)
- [ ] 단위 테스트 커버리지 >80%
- [ ] 통합 테스트 완료
- [ ] 마이그레이션 테스트

### 정리 (P3.8 - 6개월 후)
- [ ] 레거시 코드 완전 제거
- [ ] 문서 최종 업데이트
```

---

## 8. 리스크 관리

### 8.1 기술적 리스크

| 리스크 | 확률 | 영향 | 대응 |
|-------|-----|-----|-----|
| 순환 의존성 발생 | 중 | 높음 | 레이어 분리 엄격 적용, 정적 분석 도구 사용 |
| 하위 호환성 파괴 | 중 | 높음 | re-export 유지, 6개월 유예 기간 |
| 테스트 커버리지 감소 | 중 | 중 | 마이그레이션 전 테스트 보강 |
| 마이그레이션 기간 초과 | 중 | 중 | 버퍼 20% 확보, 블로커 발생 시 대안 작업 전환 |
| 런타임 성능 저하 | 낮음 | 중 | 벤치마크 테스트, 점진적 롤아웃 |

### 8.2 완화 전략

```yaml
완화_전략:
  점진적_접근:
    - 신규 기능만 새 구조에 추가
    - 버그 수정 시 점진적 이동
    - 큰 변경 없이 하위 호환성 유지

  테스트_우선:
    - 마이그레이션 전 테스트 보강
    - 각 단계별 테스트 검증
    - 회귀 테스트 자동화

  롤백_계획:
    - 각 단계별 롤백 포인트 확보
    - re-export로 즉시 롤백 가능
    - 단계별 배포로 위험 분산
```

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.0
  작성일: 2026-02-06
  상태: 활성 (Active)

변경_이력:
  v1.0: 초기 버전 - Agent 통합 스펙 정의

다음_갱신:
  예정일: 구현 시작 시 (P0, P1, P2 완료 후)
  담당: 프로젝트 소유자
```
