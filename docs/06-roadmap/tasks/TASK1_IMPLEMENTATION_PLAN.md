# Task 1: 웹 대시보드 API 연동 - 수정된 구현 계획

> 기존 TASK1_WEB_DASHBOARD_API.md 문서 분석 후 실제 코드베이스에 맞게 수정된 구현 계획

**작성일**: 2026-01-24
**기반 분석**: 실제 코드베이스 구조 분석 완료

---

## 1. 기존 문서 문제점 분석

### 1.1 발견된 불일치 사항

| 항목 | 기존 문서 가정 | 실제 코드베이스 | 영향 |
|------|---------------|----------------|------|
| DI 컨테이너 | `tsyringe` (`@injectable`, `@inject`) | 자체 구현 (`createContainer`, `createToken`) | 서비스 등록 방식 변경 필요 |
| 에이전트 조회 | `IAgentManager.listAgents()` | `AgentsService.listAgents()` 이미 존재 | 기존 서비스 활용 |
| 워크플로우 조회 | `IWorkflowEngine.listWorkflows()` | `WorkflowsService.listWorkflows()` 이미 존재 | 기존 서비스 활용 |
| 이벤트 구독 | `eventBus.subscribe()` | `eventBus.on()` | 메서드명 수정 |
| API 경로 | `/api/v1/dashboard/stats` | `/api/dashboard/stats` | 경로 수정 |
| 대시보드 엔드포인트 | 신규 생성 필요 | `registerDashboardRoutes()` 이미 존재 | 확장만 필요 |

### 1.2 현재 코드베이스 구조

```
src/
├── api/
│   ├── routes/
│   │   ├── base.router.ts        # BaseRouter 추상 클래스 ✅
│   │   ├── agents.router.ts      # AgentsRouter 구현 ✅
│   │   ├── workflows.router.ts   # WorkflowsRouter 구현 ✅
│   │   └── index.ts              # 라우터 exports ✅
│   ├── services/
│   │   ├── agents.service.ts     # AgentsService (인메모리) ✅
│   │   ├── workflows.service.ts  # WorkflowsService (인메모리) ✅
│   │   └── index.ts
│   └── interfaces/
│       └── api.interface.ts      # API 인터페이스 ✅
├── core/
│   ├── di/
│   │   ├── impl/container.impl.ts  # Container 구현 ✅
│   │   └── tokens/tokens.ts        # Token 정의 ✅
│   ├── events/
│   │   └── impl/event-bus.impl.ts  # EventBus (on, emit) ✅
│   └── workflow/
│       └── workflow-engine.ts      # WorkflowEngine ✅
├── agents/
│   └── manager/
│       └── agent-manager.ts        # AgentManager ✅
└── bin/
    └── start-api-server.ts         # API 서버 진입점 ✅

web/src/
├── api/
│   └── client.ts           # ApiClient ✅ (getDashboardStats 존재)
├── types/
│   └── api.ts              # DashboardStats 타입 ✅
└── pages/
    └── Dashboard.tsx       # 대시보드 페이지 (수정 필요)
```

---

## 2. 수정된 구현 전략

### 2.1 접근 방식 변경

**기존 문서 접근**: 완전히 새로운 DashboardService/Router 생성
**수정된 접근**: 기존 서비스 활용 + 최소한의 수정

#### 핵심 변경 사항

1. **DashboardService 생성** - 기존 서비스들을 조합하여 통계 제공
2. **registerDashboardRoutes 확장** - 기존 함수 수정
3. **웹 클라이언트 업데이트** - React Query 적용

### 2.2 의존성 그래프

```
                    ┌─────────────────────┐
                    │  DashboardService   │ (신규)
                    └─────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
   ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
   │AgentsService│   │WorkflowsServ.│   │  EventBus    │
   └─────────────┘   └──────────────┘   └──────────────┘
         │                  │                   │
         ▼                  ▼                   ▼
   (인메모리 Map)    (인메모리 Map)    (이벤트 수집)
```

---

## 3. 상세 구현 계획

### Phase 1: DashboardService 생성

#### 3.1.1 파일: `src/api/services/dashboard.service.ts`

```typescript
/**
 * Dashboard API Service
 *
 * 대시보드 통계 집계를 위한 서비스
 * 기존 AgentsService, WorkflowsService를 조합하여 통계 제공
 */

import { createLogger, ILogger } from '../../core/services/logger.js';
import { AgentsService, createAgentsService, AgentInfo } from './agents.service.js';
import { WorkflowsService, createWorkflowsService, WorkflowInfo } from './workflows.service.js';
import { createEventBus, EventBus, SystemEvents } from '../../core/events/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ProjectStats {
  total: number;
  active: number;
  archived: number;
}

export interface WorkflowStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  pending: number;
}

export interface AgentStats {
  total: number;
  online: number;
  offline: number;
  busy: number;
  idle: number;
}

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: Date;
  entityId?: string;
  entityType?: 'agent' | 'workflow' | 'project';
  metadata?: Record<string, unknown>;
}

export type ActivityType =
  | 'agent_started'
  | 'agent_stopped'
  | 'agent_task_completed'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'project_created'
  | 'project_updated';

export interface DashboardStats {
  projects: ProjectStats;
  workflows: WorkflowStats;
  agents: AgentStats;
  recentActivity: Activity[];
  lastUpdated: Date;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class DashboardService {
  private readonly logger: ILogger;
  private readonly agentsService: AgentsService;
  private readonly workflowsService: WorkflowsService;
  private readonly eventBus: EventBus;
  private activityBuffer: Activity[] = [];
  private readonly MAX_ACTIVITY_BUFFER = 100;

  constructor(
    agentsService?: AgentsService,
    workflowsService?: WorkflowsService,
    eventBus?: EventBus
  ) {
    this.logger = createLogger('DashboardService');
    this.agentsService = agentsService || createAgentsService();
    this.workflowsService = workflowsService || createWorkflowsService();
    this.eventBus = eventBus || createEventBus();

    this.subscribeToEvents();
  }

  /**
   * 이벤트 버스 구독 - 활동 기록 수집
   */
  private subscribeToEvents(): void {
    // 에이전트 이벤트
    this.eventBus.on(SystemEvents.AgentStarted, (event) => {
      this.addActivity({
        type: 'agent_started',
        message: `에이전트 ${event.payload?.agentId || 'unknown'} 시작됨`,
        entityId: event.payload?.agentId,
        entityType: 'agent',
        metadata: event.payload,
      });
    });

    this.eventBus.on(SystemEvents.AgentStopped, (event) => {
      this.addActivity({
        type: 'agent_stopped',
        message: `에이전트 ${event.payload?.agentId || 'unknown'} 중지됨`,
        entityId: event.payload?.agentId,
        entityType: 'agent',
        metadata: event.payload,
      });
    });

    this.eventBus.on(SystemEvents.TaskCompleted, (event) => {
      this.addActivity({
        type: 'agent_task_completed',
        message: `태스크 ${event.payload?.taskId || 'unknown'} 완료`,
        entityId: event.payload?.taskId,
        entityType: 'agent',
        metadata: event.payload,
      });
    });

    this.logger.debug('Event subscriptions initialized');
  }

  /**
   * 활동 기록 추가
   */
  private addActivity(activity: Omit<Activity, 'id' | 'timestamp'>): void {
    const newActivity: Activity = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...activity,
    };

    this.activityBuffer.unshift(newActivity);

    // 버퍼 크기 제한
    if (this.activityBuffer.length > this.MAX_ACTIVITY_BUFFER) {
      this.activityBuffer = this.activityBuffer.slice(0, this.MAX_ACTIVITY_BUFFER);
    }
  }

  /**
   * 전체 대시보드 통계 조회
   */
  async getStats(): Promise<DashboardStats> {
    const [agents, workflows, recentActivity] = await Promise.all([
      this.getAgentStats(),
      this.getWorkflowStats(),
      this.getRecentActivity(10),
    ]);

    // 프로젝트 통계는 현재 구현되지 않음
    const projects: ProjectStats = {
      total: 0,
      active: 0,
      archived: 0,
    };

    return {
      projects,
      workflows,
      agents,
      recentActivity,
      lastUpdated: new Date(),
    };
  }

  /**
   * 에이전트 통계 조회
   */
  async getAgentStats(): Promise<AgentStats> {
    try {
      const result = await this.agentsService.listAgents({ limit: 1000 });
      const agents = result.agents;

      const stats: AgentStats = {
        total: agents.length,
        online: 0,
        offline: 0,
        busy: 0,
        idle: 0,
      };

      for (const agent of agents) {
        // status 기반 분류
        if (agent.status === 'running' || agent.status === 'idle') {
          stats.online++;
          if (agent.currentTask) {
            stats.busy++;
          } else {
            stats.idle++;
          }
        } else {
          stats.offline++;
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get agent stats', { error });
      return { total: 0, online: 0, offline: 0, busy: 0, idle: 0 };
    }
  }

  /**
   * 워크플로우 통계 조회
   */
  async getWorkflowStats(): Promise<WorkflowStats> {
    try {
      const result = await this.workflowsService.listWorkflows({ limit: 1000 });
      const workflows = result.workflows;

      const stats: WorkflowStats = {
        total: workflows.length,
        running: 0,
        completed: 0,
        failed: 0,
        pending: 0,
      };

      for (const workflow of workflows) {
        switch (workflow.status) {
          case 'active':
            stats.running++;
            break;
          case 'archived':
            stats.completed++;
            break;
          case 'draft':
            stats.pending++;
            break;
          case 'paused':
            stats.pending++;
            break;
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get workflow stats', { error });
      return { total: 0, running: 0, completed: 0, failed: 0, pending: 0 };
    }
  }

  /**
   * 최근 활동 조회
   */
  async getRecentActivity(limit = 10): Promise<Activity[]> {
    return this.activityBuffer.slice(0, limit);
  }
}

// Factory function
let dashboardServiceInstance: DashboardService | null = null;

export function createDashboardService(): DashboardService {
  if (!dashboardServiceInstance) {
    dashboardServiceInstance = new DashboardService();
  }
  return dashboardServiceInstance;
}

export function getDashboardService(): DashboardService {
  return createDashboardService();
}
```

#### 3.1.2 의존성 검증

```bash
# 필요한 import 경로 확인
# ✅ AgentsService: src/api/services/agents.service.ts
# ✅ WorkflowsService: src/api/services/workflows.service.ts
# ✅ EventBus: src/core/events/index.ts
# ✅ Logger: src/core/services/logger.js
```

---

### Phase 2: API 서버 수정

#### 3.2.1 파일: `src/bin/start-api-server.ts` 수정

**현재 상태** (Line 162-228):
```typescript
function registerDashboardRoutes(fastify, prefix) {
  // Mock data 반환
  const stats = { projects: {...}, workflows: {...}, agents: {...} };
  return reply.send({ success: true, data: stats });
}
```

**수정 후**:
```typescript
import { createDashboardService, DashboardService } from '../api/services/dashboard.service.js';

/**
 * Register dashboard routes for web client compatibility
 */
function registerDashboardRoutes(
  fastify: ReturnType<ReturnType<typeof createApiServer>['getInstance']>,
  prefix: string
): void {
  const dashboardService = createDashboardService();

  // Dashboard stats endpoint - 실제 데이터 반환
  fastify.get(`${prefix}/dashboard/stats`, async (request, reply) => {
    try {
      const stats = await dashboardService.getStats();

      return reply.send({
        success: true,
        data: {
          projects: stats.projects,
          workflows: stats.workflows,
          agents: stats.agents,
          recentActivity: stats.recentActivity.map(activity => ({
            id: activity.id,
            type: activity.type,
            message: activity.message,
            timestamp: activity.timestamp.toISOString(),
            entityId: activity.entityId,
            entityType: activity.entityType,
          })),
          lastUpdated: stats.lastUpdated.toISOString(),
        },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get dashboard stats', { error });
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DASHBOARD_STATS_ERROR',
          message: 'Failed to retrieve dashboard statistics',
        },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // Dashboard activity endpoint - 신규 추가
  fastify.get(`${prefix}/dashboard/activity`, async (request, reply) => {
    try {
      const query = request.query as { limit?: string };
      const limit = parseInt(query.limit || '10', 10);
      const activities = await dashboardService.getRecentActivity(limit);

      return reply.send({
        success: true,
        data: activities.map(activity => ({
          id: activity.id,
          type: activity.type,
          message: activity.message,
          timestamp: activity.timestamp.toISOString(),
          entityId: activity.entityId,
          entityType: activity.entityType,
        })),
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
          total: activities.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get activity', { error });
      return reply.status(500).send({
        success: false,
        error: {
          code: 'ACTIVITY_ERROR',
          message: 'Failed to retrieve activity',
        },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // 기존 projects, logs 엔드포인트 유지
  // ...

  logger.debug('Dashboard routes registered');
}
```

---

### Phase 3: 웹 클라이언트 수정

#### 3.3.1 파일: `web/src/types/api.ts` 수정

```typescript
// 기존 DashboardStats 타입 업데이트 (Line 176-202)

export interface DashboardStats {
  projects: {
    total: number;
    active: number;
    archived?: number;  // 추가
  };
  workflows: {
    total: number;
    running: number;
    completed: number;
    failed: number;
    pending?: number;  // 추가
  };
  agents: {
    total: number;
    online: number;
    busy: number;
    offline?: number;  // 추가
    idle?: number;     // 추가
  };
  recentActivity: ActivityItem[];
  lastUpdated?: string;  // 추가
}

export interface ActivityItem {
  id: string;
  type: ActivityType;  // 변경: string에서 구체적 타입으로
  action?: string;     // optional로 변경
  message?: string;    // 추가
  description?: string;  // optional 유지
  timestamp: string;
  entityId?: string;   // 추가
  entityType?: 'agent' | 'workflow' | 'project';  // 추가
  metadata?: Record<string, unknown>;
}

export type ActivityType =
  | 'agent_started'
  | 'agent_stopped'
  | 'agent_task_completed'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'project_created'
  | 'project_updated'
  | 'project'    // 기존 호환성
  | 'workflow'   // 기존 호환성
  | 'agent'      // 기존 호환성
  | 'system';    // 기존 호환성
```

#### 3.3.2 파일: `web/src/api/client.ts` 수정

```typescript
// 기존 getDashboardStats 메서드 확인 - 이미 구현됨 (Line 58-60)
// 추가 메서드만 필요

// 추가할 메서드 (Line 60 이후)
async getDashboardActivity(limit = 10): Promise<ApiResponse<ActivityItem[]>> {
  return this.request(`/dashboard/activity?limit=${limit}`);
}

async getAgentStats(): Promise<ApiResponse<AgentStats>> {
  return this.request('/dashboard/agents');
}

async getWorkflowStats(): Promise<ApiResponse<WorkflowStats>> {
  return this.request('/dashboard/workflows');
}
```

#### 3.3.3 파일: `web/src/pages/Dashboard.tsx` 수정

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { DashboardStats, ActivityItem } from '@/types/api';

export function Dashboard() {
  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.getDashboardStats(),
    refetchInterval: 5000, // 5초마다 자동 갱신
    staleTime: 3000,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-red-500 text-6xl mb-4">!</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          데이터를 불러올 수 없습니다
        </h2>
        <p className="text-gray-500 mb-6">
          {error instanceof Error ? error.message : '알 수 없는 오류'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const stats = response?.data;

  if (!stats) {
    return <div className="text-gray-500">데이터가 없습니다.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        {stats.lastUpdated && (
          <div className="text-sm text-gray-500">
            마지막 업데이트: {new Date(stats.lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* 통계 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="프로젝트"
          value={stats.projects.total}
          subtitle={`활성 ${stats.projects.active}`}
          color="blue"
        />
        <StatCard
          title="워크플로우"
          value={stats.workflows.total}
          subtitle={`실행 중 ${stats.workflows.running}`}
          color="green"
        />
        <StatCard
          title="에이전트"
          value={stats.agents.total}
          subtitle={`온라인 ${stats.agents.online}`}
          color="purple"
        />
        <StatCard
          title="작업 중"
          value={stats.agents.busy}
          subtitle={`대기 ${stats.agents.idle || 0}`}
          color="orange"
        />
      </div>

      {/* 최근 활동 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">최근 활동</h2>
        <ActivityFeed activities={stats.recentActivity} />
      </div>
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: number;
  subtitle: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

// 활동 피드 컴포넌트
function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        최근 활동이 없습니다.
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      agent_started: '🟢',
      agent_stopped: '🔴',
      agent_task_completed: '✅',
      workflow_started: '▶️',
      workflow_completed: '🎉',
      workflow_failed: '❌',
      project_created: '📁',
      project_updated: '📝',
    };
    return icons[type] || '📌';
  };

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
        >
          <span className="text-xl">{getActivityIcon(activity.type)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">
              {activity.message || activity.description || activity.action}
            </p>
            <p className="text-xs text-gray-500">
              {formatRelativeTime(activity.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// 스켈레톤 로딩
function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      <div className="h-8 w-32 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 상대 시간 포맷
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return then.toLocaleDateString();
}
```

---

## 4. 구현 순서 및 체크리스트

### 4.1 백엔드 (총 3단계)

| 순서 | 작업 | 파일 | 예상 LOC |
|------|------|------|----------|
| 1 | DashboardService 생성 | `src/api/services/dashboard.service.ts` | ~200 |
| 2 | services/index.ts 수정 | `src/api/services/index.ts` | ~5 |
| 3 | start-api-server.ts 수정 | `src/bin/start-api-server.ts` | ~50 |

### 4.2 프론트엔드 (총 3단계)

| 순서 | 작업 | 파일 | 예상 LOC |
|------|------|------|----------|
| 1 | 타입 업데이트 | `web/src/types/api.ts` | ~20 |
| 2 | API 클라이언트 수정 | `web/src/api/client.ts` | ~10 |
| 3 | Dashboard 페이지 수정 | `web/src/pages/Dashboard.tsx` | ~150 |

### 4.3 구현 순서도

```
[1] src/api/services/dashboard.service.ts 생성
          │
          ▼
[2] src/api/services/index.ts 수정 (export 추가)
          │
          ▼
[3] src/bin/start-api-server.ts 수정 (import + 라우트 수정)
          │
          ▼
[4] TypeScript 컴파일 확인 (npm run build)
          │
          ▼
[5] API 테스트 (curl http://localhost:3001/api/dashboard/stats)
          │
          ▼
[6] web/src/types/api.ts 수정
          │
          ▼
[7] web/src/api/client.ts 수정
          │
          ▼
[8] web/src/pages/Dashboard.tsx 수정
          │
          ▼
[9] 프론트엔드 테스트 (npm run dev)
```

---

## 5. 검증 체크리스트

### 5.1 백엔드 검증

```bash
# 1. 컴파일 확인
npm run build

# 2. API 서버 시작
npm run start:api

# 3. 대시보드 통계 API 테스트
curl http://localhost:3001/api/dashboard/stats | jq

# 예상 응답:
# {
#   "success": true,
#   "data": {
#     "projects": { "total": 0, "active": 0, "archived": 0 },
#     "workflows": { "total": 0, "running": 0, "completed": 0, "failed": 0, "pending": 0 },
#     "agents": { "total": 0, "online": 0, "offline": 0, "busy": 0, "idle": 0 },
#     "recentActivity": [],
#     "lastUpdated": "2026-01-24T..."
#   }
# }

# 4. 활동 조회 API 테스트
curl "http://localhost:3001/api/dashboard/activity?limit=5" | jq
```

### 5.2 프론트엔드 검증

1. http://localhost:5175 접속
2. 대시보드 페이지 로딩 확인
3. 통계 카드 4개 표시 확인
4. 최근 활동 섹션 표시 확인
5. 5초 후 자동 갱신 확인 (Network 탭에서 요청 확인)

---

## 6. 주의사항

### 6.1 기존 코드와의 호환성

- 기존 `AgentsService`, `WorkflowsService`는 인메모리 Map만 사용
- 실제 `AgentManager`, `WorkflowEngine`과 연동되지 않음
- 실제 시스템 연동은 별도 작업 필요 (Phase 2로 분리 권장)

### 6.2 타입 안전성

- `EventBus.on()` 메서드 사용 시 `SystemEvents` enum 사용
- Activity 타입에 Date 객체 사용 (JSON 직렬화 시 ISO 문자열로 변환)

### 6.3 에러 처리

- DashboardService 메서드들은 내부적으로 try-catch 처리
- 에러 발생 시 기본값 반환 (0, 빈 배열 등)
- 로그에 에러 기록

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2026-01-24 | 1.0 | 기존 문서 분석 및 수정된 구현 계획 작성 |
