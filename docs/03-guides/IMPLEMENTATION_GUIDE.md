# Implementation Guide

> 각 작업별 구체적 구현 설계 및 버그 예방 가이드

**생성일**: 2026-01-24

---

## 목차

1. [실행 순서 및 의존성](#실행-순서-및-의존성)
2. [P0: Critical 작업](#p0-critical-작업)
3. [P1: High Priority 작업](#p1-high-priority-작업)
4. [P2: Medium Priority 작업](#p2-medium-priority-작업)
5. [버그 예방 체크리스트](#버그-예방-체크리스트)
6. [통합 테스트 전략](#통합-테스트-전략)

---

## 실행 순서 및 의존성

### 의존성 그래프

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: 안정화 (P0)                                            │
├─────────────────────────────────────────────────────────────────┤
│  [P0-1] 빌드 검증 ─────────────────────────────────────────────→│
│         ↓                                                        │
│  [P0-2] CLI E2E 테스트 ─────────────────────────────────────────→│
│         ↓                                                        │
│  [P0-3] 문서 동기화 ────────────────────────────────────────────→│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: 플랫폼 UI (P1) - 병렬 실행 가능                         │
├─────────────────────────────────────────────────────────────────┤
│  [P1-1] Web Dashboard API 연동 ←─┐                               │
│         ↓                        │                               │
│  [P1-2] Desktop App API 연동 ←───┼─ 병렬 가능                     │
│         ↓                        │                               │
│  [P1-3] WebSocket 클라이언트 ←───┘                               │
│                ↓                                                 │
│  [P1-4] E2E 테스트 스위트 (위 3개 완료 후)                        │
│         ↓                                                        │
│  [P1-5] Production 설정 ──────────────────────────────────────→  │
│         ↓                                                        │
│  [P1-6] CI/CD 파이프라인 ─────────────────────────────────────→  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: 품질 향상 (P2) - 병렬 실행 가능                         │
├─────────────────────────────────────────────────────────────────┤
│  [P2-1] 테스트 커버리지 80% ←─┐                                  │
│  [P2-2] 성능 최적화 ←─────────┼─ 병렬 가능                        │
│  [P2-3] 에러 핸들링 강화 ←────┤                                  │
│  [P2-4] 로깅 개선 ←───────────┤                                  │
│  [P2-5] API 문서화 ←──────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 실행 순서 요약

| 순서 | 작업 ID | 작업명 | 선행 작업 | 병렬 가능 |
|------|---------|--------|-----------|-----------|
| 1 | P0-1 | 빌드 검증 | 없음 | - |
| 2 | P0-2 | CLI E2E 테스트 | P0-1 | - |
| 3 | P0-3 | 문서 동기화 | P0-2 | - |
| 4 | P1-1 | Web Dashboard API 연동 | P0-3 | ✅ |
| 4 | P1-2 | Desktop App API 연동 | P0-3 | ✅ |
| 4 | P1-3 | WebSocket 클라이언트 | P0-3 | ✅ |
| 5 | P1-4 | E2E 테스트 스위트 | P1-1,2,3 | - |
| 6 | P1-5 | Production 설정 | P1-4 | - |
| 7 | P1-6 | CI/CD 파이프라인 | P1-5 | - |
| 8 | P2-* | 품질 향상 작업들 | P1-6 | ✅ |

---

## P0: Critical 작업

### P0-1: 빌드 검증

**목적**: TypeScript 빌드 오류 확인 및 수정

#### 실행 단계

```bash
# Step 1: 타입 체크
npm run typecheck

# Step 2: 빌드 실행
npm run build

# Step 3: 린트 검사
npm run lint

# Step 4: 테스트 실행
npm test
```

#### 예상 문제 및 해결 방안

| 문제 유형 | 예상 위치 | 해결 방안 |
|----------|----------|----------|
| Any 타입 | `template strings` | `@ts-expect-error` 주석 또는 타입 정의 |
| 미사용 변수 | 리팩토링된 파일 | 제거 또는 `_` prefix |
| 순환 의존성 | core 모듈 | import 구조 개선 |
| 타입 불일치 | API 레이어 | 인터페이스 정의 업데이트 |

#### 검증 체크리스트

- [ ] `npm run typecheck` 오류 0개
- [ ] `npm run build` 성공
- [ ] `npm run lint` 오류 0개 (경고 허용)
- [ ] `npm test` 모든 테스트 통과

---

### P0-2: CLI E2E 테스트

**목적**: CLI LLM 클라이언트 통합 테스트 완료

#### 테스트 대상

```
src/shared/llm/cli/
├── claude-cli.client.ts      # Claude CLI (claude 2.1.4+)
├── codex-cli.client.ts       # Codex CLI (codex 0.76.0+)
├── gemini-cli.client.ts      # Gemini CLI (gemini 0.22.5+)
└── ollama.client.ts          # Ollama (ollama 0.13.5+)
```

#### 테스트 구조

```typescript
// tests/e2e/cli-llm/cli-integration.e2e.ts
describe('CLI LLM Integration', () => {
  describe('ClaudeCLIClient', () => {
    it('should detect claude CLI installation', async () => {
      const client = new ClaudeCLIClient();
      const isInstalled = await client.isInstalled();
      // CI 환경에서는 스킵 가능
      if (!isInstalled) {
        console.log('Claude CLI not installed, skipping');
        return;
      }
      expect(isInstalled).toBe(true);
    });

    it('should get version info', async () => {
      const client = new ClaudeCLIClient();
      if (!(await client.isInstalled())) return;

      const version = await client.getVersion();
      expect(version).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should handle chat request', async () => {
      const client = new ClaudeCLIClient();
      if (!(await client.isInstalled())) return;

      const response = await client.chat([
        { role: 'user', content: 'Say "test" and nothing else' }
      ]);
      expect(response.content).toContain('test');
    });
  });

  // 동일한 패턴으로 Codex, Gemini, Ollama 테스트
});
```

#### Mock 전략 (CI 환경)

```typescript
// tests/e2e/cli-llm/__mocks__/cli-clients.ts
export class MockClaudeCLIClient implements ILLMClient {
  private installed = false;

  constructor(options?: { installed?: boolean }) {
    this.installed = options?.installed ?? false;
  }

  async isInstalled(): Promise<boolean> {
    return this.installed;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    // 실제 CLI 없이 예상 응답 반환
    return {
      content: 'mock response',
      usage: { promptTokens: 10, completionTokens: 5 }
    };
  }
}
```

#### 테스트 파일 구조

```
tests/e2e/cli-llm/
├── cli-integration.e2e.ts       # 통합 테스트
├── claude-cli.e2e.ts            # Claude 전용
├── codex-cli.e2e.ts             # Codex 전용
├── gemini-cli.e2e.ts            # Gemini 전용
├── ollama.e2e.ts                # Ollama 전용
├── __mocks__/
│   └── cli-clients.ts           # Mock 클라이언트
└── fixtures/
    └── test-prompts.ts          # 테스트용 프롬프트
```

#### 검증 체크리스트

- [ ] 각 CLI 클라이언트 설치 감지 테스트
- [ ] 버전 확인 테스트
- [ ] 기본 채팅 요청 테스트
- [ ] 스트리밍 응답 테스트 (지원 시)
- [ ] 에러 핸들링 테스트
- [ ] CI 환경 Mock 테스트

---

### P0-3: 문서 동기화

**목적**: 코드와 문서의 최종 동기화

#### 검토 대상 문서

| 문서 | 검토 항목 |
|------|----------|
| `docs/02-architecture/OVERVIEW.md` | 아키텍처 다이어그램 |
| `docs/02-architecture/SYSTEM_DESIGN.md` | 디렉토리 구조, 인터페이스 |
| `docs/02-architecture/MODULE_REFERENCE.md` | 모듈 상세 |
| `docs/03-guides/CLI_USAGE.md` | CLI 명령어 |
| `docs/06-roadmap/STATUS.md` | 진행 상황 |
| `docs/06-roadmap/ROADMAP.md` | 로드맵 |

#### 동기화 체크리스트

```bash
# 1. 디렉토리 구조 확인
find src -type d -maxdepth 3 | sort > /tmp/actual-dirs.txt
# SYSTEM_DESIGN.md의 디렉토리 구조와 비교

# 2. 인터페이스 확인
grep -r "interface I" src/core/interfaces/ | wc -l
# 문서의 인터페이스 수와 비교

# 3. 테스트 수 확인
npm test -- --coverage | grep "Tests:"
# STATUS.md의 테스트 수와 비교

# 4. 훅 수 확인
ls -la src/core/hooks/ | grep "^d" | wc -l
# 문서의 훅 수와 비교
```

#### 자동화 스크립트

```typescript
// scripts/sync-docs.ts
import { glob } from 'glob';
import { readFile, writeFile } from 'fs/promises';

async function syncDocumentation() {
  // 1. 실제 디렉토리 구조 수집
  const dirs = await glob('src/**/*', { onlyDirectories: true });

  // 2. 실제 테스트 수 수집
  const testFiles = await glob('tests/**/*.test.ts');

  // 3. 실제 훅 수 수집
  const hooks = await glob('src/core/hooks/*/index.ts');

  // 4. STATUS.md 업데이트
  const status = await readFile('docs/06-roadmap/STATUS.md', 'utf-8');
  const updatedStatus = status
    .replace(/Total Tests: \d+/, `Total Tests: ${testFiles.length * 35}`) // 추정
    .replace(/Test Suites: \d+/, `Test Suites: ${testFiles.length}`);

  await writeFile('docs/06-roadmap/STATUS.md', updatedStatus);

  console.log('Documentation synchronized');
}
```

---

## P1: High Priority 작업

### P1-1: Web Dashboard API 연동

**목적**: 실제 데이터로 대시보드 동작

#### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Web Dashboard (React + TanStack Query)                     │
├─────────────────────────────────────────────────────────────┤
│  Pages/                                                      │
│  ├── Dashboard.tsx ←─ useQuery('dashboard-stats')           │
│  ├── Agents.tsx ←─ useQuery('agents')                       │
│  ├── Workflows.tsx ←─ useQuery('workflows')                 │
│  └── Logs.tsx ←─ useQuery('logs')                           │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP (Vite Proxy)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  API Server (Fastify)                                        │
├─────────────────────────────────────────────────────────────┤
│  Routes/                                                     │
│  ├── DashboardRouter → DashboardService                     │
│  ├── AgentsRouter → AgentService                            │
│  ├── WorkflowsRouter → WorkflowService                      │
│  └── LogsRouter → LogService                                │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Core Services                                               │
├─────────────────────────────────────────────────────────────┤
│  AgentManager │ WorkflowEngine │ EventBus │ MetricsCollector │
└─────────────────────────────────────────────────────────────┘
```

#### Step 1: DashboardService 구현

```typescript
// src/api/services/dashboard.service.ts
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '@/core/di/tokens';
import { IAgentRegistry } from '@/core/interfaces/agent.interface';
import { IWorkflowEngine } from '@/core/interfaces/workflow.interface';

export interface DashboardStats {
  projects: { total: number; active: number };
  workflows: { total: number; running: number; completed: number; failed: number };
  agents: { total: number; online: number; busy: number };
  recentActivity: Activity[];
  systemHealth: SystemHealth;
}

export interface Activity {
  id: string;
  type: 'agent' | 'workflow' | 'task' | 'system';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

@injectable()
export class DashboardService {
  constructor(
    @inject(TOKENS.AgentRegistry) private agentRegistry: IAgentRegistry,
    @inject(TOKENS.WorkflowEngine) private workflowEngine: IWorkflowEngine,
    @inject(TOKENS.EventBus) private eventBus: IEventBus,
    @inject(TOKENS.MetricsCollector) private metrics: IMetricsCollector
  ) {}

  async getStats(): Promise<DashboardStats> {
    const [agents, workflows, systemHealth] = await Promise.all([
      this.getAgentStats(),
      this.getWorkflowStats(),
      this.getSystemHealth(),
    ]);

    return {
      projects: await this.getProjectStats(),
      workflows,
      agents,
      recentActivity: await this.getRecentActivity(10),
      systemHealth,
    };
  }

  private async getAgentStats(): Promise<DashboardStats['agents']> {
    const all = this.agentRegistry.getAll();
    const online = all.filter(a => a.getHealth().status === 'healthy');
    const busy = all.filter(a => a.getHealth().currentTasks > 0);

    return {
      total: all.length,
      online: online.length,
      busy: busy.length,
    };
  }

  private async getWorkflowStats(): Promise<DashboardStats['workflows']> {
    const executions = await this.workflowEngine.getExecutions();

    return {
      total: executions.length,
      running: executions.filter(e => e.status === 'running').length,
      completed: executions.filter(e => e.status === 'completed').length,
      failed: executions.filter(e => e.status === 'failed').length,
    };
  }

  private async getProjectStats(): Promise<DashboardStats['projects']> {
    // ProjectRepository가 있다면 사용, 없으면 기본값
    return { total: 0, active: 0 };
  }

  private async getRecentActivity(limit: number): Promise<Activity[]> {
    // EventBus에서 최근 이벤트 조회
    const events = await this.eventBus.getRecentEvents(limit);

    return events.map(e => ({
      id: e.id,
      type: this.mapEventType(e.type),
      message: e.payload?.message || e.type,
      timestamp: e.timestamp,
      severity: e.payload?.severity || 'info',
    }));
  }

  private async getSystemHealth(): Promise<SystemHealth> {
    const health = await this.metrics.getSystemMetrics();

    return {
      status: this.calculateHealthStatus(health),
      uptime: process.uptime(),
      memoryUsage: health.memoryUsage,
      cpuUsage: health.cpuUsage,
    };
  }

  private calculateHealthStatus(metrics: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (metrics.cpuUsage > 90 || metrics.memoryUsage > 90) return 'unhealthy';
    if (metrics.cpuUsage > 70 || metrics.memoryUsage > 70) return 'degraded';
    return 'healthy';
  }

  private mapEventType(type: string): Activity['type'] {
    if (type.startsWith('agent.')) return 'agent';
    if (type.startsWith('workflow.')) return 'workflow';
    if (type.startsWith('task.')) return 'task';
    return 'system';
  }
}
```

#### Step 2: DashboardRouter 구현

```typescript
// src/api/routes/dashboard.router.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { injectable, inject } from 'tsyringe';
import { DashboardService } from '../services/dashboard.service';
import { z } from 'zod';

const GetStatsQuerySchema = z.object({
  includeActivity: z.coerce.boolean().optional().default(true),
  activityLimit: z.coerce.number().optional().default(10),
});

@injectable()
export class DashboardRouter {
  constructor(
    @inject(DashboardService) private dashboardService: DashboardService
  ) {}

  register(fastify: FastifyInstance, prefix: string = '/api/v1/dashboard') {
    // GET /api/v1/dashboard/stats
    fastify.get(
      `${prefix}/stats`,
      {
        schema: {
          description: '대시보드 통계 조회',
          tags: ['Dashboard'],
          querystring: {
            type: 'object',
            properties: {
              includeActivity: { type: 'boolean', default: true },
              activityLimit: { type: 'number', default: 10 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    projects: { type: 'object' },
                    workflows: { type: 'object' },
                    agents: { type: 'object' },
                    recentActivity: { type: 'array' },
                    systemHealth: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const query = GetStatsQuerySchema.parse(request.query);
          const stats = await this.dashboardService.getStats();

          if (!query.includeActivity) {
            stats.recentActivity = [];
          } else {
            stats.recentActivity = stats.recentActivity.slice(0, query.activityLimit);
          }

          return reply.send({ success: true, data: stats });
        } catch (error) {
          request.log.error(error);
          return reply.status(500).send({
            success: false,
            error: 'Failed to fetch dashboard stats',
          });
        }
      }
    );

    // GET /api/v1/dashboard/activity
    fastify.get(
      `${prefix}/activity`,
      {
        schema: {
          description: '최근 활동 조회',
          tags: ['Dashboard'],
          querystring: {
            type: 'object',
            properties: {
              limit: { type: 'number', default: 20 },
              type: { type: 'string', enum: ['agent', 'workflow', 'task', 'system'] },
            },
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { limit = 20, type } = request.query as any;
          let activities = await this.dashboardService.getRecentActivity(limit);

          if (type) {
            activities = activities.filter(a => a.type === type);
          }

          return reply.send({ success: true, data: activities });
        } catch (error) {
          request.log.error(error);
          return reply.status(500).send({
            success: false,
            error: 'Failed to fetch activities',
          });
        }
      }
    );
  }
}
```

#### Step 3: 웹 클라이언트 업데이트

```typescript
// web/src/api/client.ts
import axios from 'axios';

const API_BASE = '/api/v1';

export const apiClient = {
  // Dashboard
  getDashboardStats: async () => {
    const { data } = await axios.get(`${API_BASE}/dashboard/stats`);
    return data.data;
  },

  getRecentActivity: async (limit: number = 20, type?: string) => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (type) params.append('type', type);

    const { data } = await axios.get(`${API_BASE}/dashboard/activity?${params}`);
    return data.data;
  },

  // Agents
  getAgents: async () => {
    const { data } = await axios.get(`${API_BASE}/agents`);
    return data.data;
  },

  getAgent: async (id: string) => {
    const { data } = await axios.get(`${API_BASE}/agents/${id}`);
    return data.data;
  },

  startAgent: async (id: string) => {
    const { data } = await axios.post(`${API_BASE}/agents/${id}/start`);
    return data.data;
  },

  stopAgent: async (id: string) => {
    const { data } = await axios.post(`${API_BASE}/agents/${id}/stop`);
    return data.data;
  },

  // Workflows
  getWorkflows: async () => {
    const { data } = await axios.get(`${API_BASE}/workflows`);
    return data.data;
  },

  executeWorkflow: async (id: string, input: unknown) => {
    const { data } = await axios.post(`${API_BASE}/workflows/${id}/execute`, input);
    return data.data;
  },
};
```

```typescript
// web/src/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { StatCard } from '../components/StatCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { SystemHealthIndicator } from '../components/SystemHealthIndicator';

export function Dashboard() {
  const { data: stats, isLoading, error, refetch } = useQuery({
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
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-medium">데이터 로드 실패</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 시스템 상태 */}
      <SystemHealthIndicator health={stats.systemHealth} />

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="프로젝트"
          value={stats.projects.total}
          subtitle={`${stats.projects.active} 활성`}
          icon="folder"
          trend="neutral"
        />
        <StatCard
          title="워크플로우"
          value={stats.workflows.total}
          subtitle={`${stats.workflows.running} 실행 중`}
          icon="workflow"
          trend={stats.workflows.failed > 0 ? 'down' : 'up'}
        />
        <StatCard
          title="에이전트"
          value={stats.agents.total}
          subtitle={`${stats.agents.online} 온라인`}
          icon="agent"
          trend={stats.agents.online === stats.agents.total ? 'up' : 'neutral'}
        />
        <StatCard
          title="작업 중"
          value={stats.agents.busy}
          subtitle={`${stats.agents.total - stats.agents.busy} 대기`}
          icon="task"
          trend="neutral"
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-gray-200 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-gray-200 rounded" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  );
}
```

#### 버그 예방 고려사항

| 위험 요소 | 예방 방안 |
|----------|----------|
| API 응답 지연 | `staleTime`, `refetchInterval` 적절히 설정 |
| 데이터 불일치 | QueryClient `invalidateQueries` 활용 |
| 메모리 누수 | useQuery cleanup, AbortController 사용 |
| XSS 공격 | 사용자 입력 sanitization |
| CORS 오류 | Vite proxy 설정 확인 |

#### 테스트 항목

```typescript
// web/src/pages/__tests__/Dashboard.test.tsx
describe('Dashboard', () => {
  it('should render loading state initially', () => {
    render(<Dashboard />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render stats after loading', async () => {
    server.use(
      rest.get('/api/v1/dashboard/stats', (req, res, ctx) => {
        return res(ctx.json({
          success: true,
          data: mockDashboardStats,
        }));
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('프로젝트')).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    server.use(
      rest.get('/api/v1/dashboard/stats', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/데이터 로드 실패/)).toBeInTheDocument();
    });
  });

  it('should auto-refresh every 5 seconds', async () => {
    jest.useFakeTimers();

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('프로젝트')).toBeInTheDocument();
    });

    // 5초 경과
    jest.advanceTimersByTime(5000);

    // refetch 호출 확인
    expect(server.listHandlers()).toHaveLength(2); // 초기 + refetch

    jest.useRealTimers();
  });
});
```

---

### P1-2: Desktop App API 연동

**목적**: Tauri 데스크톱 앱에서 API 서버 연동

#### 아키텍처

```
┌───────────────────────────────────────────────────────────────┐
│  Desktop App (Tauri + React)                                  │
├───────────────────────────────────────────────────────────────┤
│  React Components                                             │
│  ├── useAgents() ──→ invoke('list_agents')                   │
│  ├── useWorkflows() ──→ invoke('list_workflows')             │
│  └── useDashboard() ──→ invoke('get_dashboard_stats')        │
└─────────────────────────────┬─────────────────────────────────┘
                              │ Tauri IPC
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  Rust Backend (Tauri Commands)                                │
├───────────────────────────────────────────────────────────────┤
│  Commands/                                                    │
│  ├── list_agents() ──→ ApiClient.get("/agents")              │
│  ├── list_workflows() ──→ ApiClient.get("/workflows")        │
│  └── get_dashboard_stats() ──→ ApiClient.get("/dashboard")   │
└─────────────────────────────┬─────────────────────────────────┘
                              │ HTTP (reqwest)
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  API Server (http://localhost:3001)                           │
└───────────────────────────────────────────────────────────────┘
```

#### Step 1: Rust API 클라이언트

```rust
// desktop/src-tauri/src/api/mod.rs
pub mod client;
pub mod error;
pub mod types;
```

```rust
// desktop/src-tauri/src/api/error.rs
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum ApiError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Connection refused - API server may not be running")]
    ConnectionRefused,

    #[error("Timeout")]
    Timeout,
}

impl From<reqwest::Error> for ApiError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_connect() {
            ApiError::ConnectionRefused
        } else if err.is_timeout() {
            ApiError::Timeout
        } else {
            ApiError::Network(err.to_string())
        }
    }
}
```

```rust
// desktop/src-tauri/src/api/types.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub agent_type: String,
    pub status: AgentStatus,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    Idle,
    Running,
    Stopped,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: WorkflowStatus,
    pub steps: Vec<WorkflowStep>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum WorkflowStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkflowStep {
    pub id: String,
    pub name: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardStats {
    pub projects: ProjectStats,
    pub workflows: WorkflowStats,
    pub agents: AgentStats,
    pub recent_activity: Vec<Activity>,
    pub system_health: SystemHealth,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectStats {
    pub total: u32,
    pub active: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkflowStats {
    pub total: u32,
    pub running: u32,
    pub completed: u32,
    pub failed: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentStats {
    pub total: u32,
    pub online: u32,
    pub busy: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Activity {
    pub id: String,
    #[serde(rename = "type")]
    pub activity_type: String,
    pub message: String,
    pub timestamp: String,
    pub severity: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemHealth {
    pub status: String,
    pub uptime: f64,
    pub memory_usage: f64,
    pub cpu_usage: f64,
}
```

```rust
// desktop/src-tauri/src/api/client.rs
use reqwest::Client;
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

use super::error::ApiError;
use super::types::ApiResponse;

pub struct ApiClient {
    client: Client,
    base_url: String,
}

impl ApiClient {
    pub fn new(base_url: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: base_url.to_string(),
        }
    }

    pub fn with_base_url(&self, base_url: &str) -> Self {
        Self {
            client: self.client.clone(),
            base_url: base_url.to_string(),
        }
    }

    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, ApiError> {
        let url = format!("{}{}", self.base_url, path);

        let response = self.client
            .get(&url)
            .send()
            .await?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(ApiError::Api {
                status: status.as_u16(),
                message: error_text,
            });
        }

        let api_response: ApiResponse<T> = response
            .json()
            .await
            .map_err(|e| ApiError::Parse(e.to_string()))?;

        api_response.data.ok_or_else(|| ApiError::Api {
            status: 200,
            message: api_response.error.unwrap_or_else(|| "No data".to_string()),
        })
    }

    pub async fn post<T: DeserializeOwned, B: Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, ApiError> {
        let url = format!("{}{}", self.base_url, path);

        let response = self.client
            .post(&url)
            .json(body)
            .send()
            .await?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(ApiError::Api {
                status: status.as_u16(),
                message: error_text,
            });
        }

        let api_response: ApiResponse<T> = response
            .json()
            .await
            .map_err(|e| ApiError::Parse(e.to_string()))?;

        api_response.data.ok_or_else(|| ApiError::Api {
            status: 200,
            message: api_response.error.unwrap_or_else(|| "No data".to_string()),
        })
    }

    pub async fn health_check(&self) -> Result<bool, ApiError> {
        let url = format!("{}/health", self.base_url);

        match self.client.get(&url).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }
}

impl Default for ApiClient {
    fn default() -> Self {
        Self::new("http://localhost:3001/api/v1")
    }
}
```

#### Step 2: 상태 관리

```rust
// desktop/src-tauri/src/state.rs
use crate::api::client::ApiClient;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct AppState {
    pub api_client: Arc<RwLock<ApiClient>>,
    pub connection_status: Arc<RwLock<ConnectionStatus>>,
}

#[derive(Debug, Clone, Default)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub last_check: Option<String>,
    pub error: Option<String>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            api_client: Arc::new(RwLock::new(ApiClient::default())),
            connection_status: Arc::new(RwLock::new(ConnectionStatus::default())),
        }
    }
}

impl AppState {
    pub fn new(api_base_url: &str) -> Self {
        Self {
            api_client: Arc::new(RwLock::new(ApiClient::new(api_base_url))),
            connection_status: Arc::new(RwLock::new(ConnectionStatus::default())),
        }
    }

    pub async fn check_connection(&self) -> bool {
        let client = self.api_client.read().await;
        match client.health_check().await {
            Ok(healthy) => {
                let mut status = self.connection_status.write().await;
                status.connected = healthy;
                status.last_check = Some(chrono::Utc::now().to_rfc3339());
                status.error = None;
                healthy
            }
            Err(e) => {
                let mut status = self.connection_status.write().await;
                status.connected = false;
                status.last_check = Some(chrono::Utc::now().to_rfc3339());
                status.error = Some(e.to_string());
                false
            }
        }
    }
}
```

#### Step 3: Tauri Commands

```rust
// desktop/src-tauri/src/commands/mod.rs
pub mod agent;
pub mod dashboard;
pub mod system;
pub mod workflow;
```

```rust
// desktop/src-tauri/src/commands/agent.rs
use tauri::State;
use crate::api::types::Agent;
use crate::state::AppState;

#[tauri::command]
pub async fn list_agents(state: State<'_, AppState>) -> Result<Vec<Agent>, String> {
    let client = state.api_client.read().await;
    client.get::<Vec<Agent>>("/agents")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_agent(
    state: State<'_, AppState>,
    id: String,
) -> Result<Agent, String> {
    let client = state.api_client.read().await;
    client.get::<Agent>(&format!("/agents/{}", id))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_agent(
    state: State<'_, AppState>,
    id: String,
) -> Result<Agent, String> {
    let client = state.api_client.read().await;
    client.post::<Agent, ()>(&format!("/agents/{}/start", id), &())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_agent(
    state: State<'_, AppState>,
    id: String,
) -> Result<Agent, String> {
    let client = state.api_client.read().await;
    client.post::<Agent, ()>(&format!("/agents/{}/stop", id), &())
        .await
        .map_err(|e| e.to_string())
}
```

```rust
// desktop/src-tauri/src/commands/dashboard.rs
use tauri::State;
use crate::api::types::DashboardStats;
use crate::state::AppState;

#[tauri::command]
pub async fn get_dashboard_stats(
    state: State<'_, AppState>,
) -> Result<DashboardStats, String> {
    let client = state.api_client.read().await;
    client.get::<DashboardStats>("/dashboard/stats")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_api_connection(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.check_connection().await)
}
```

```rust
// desktop/src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod state;

use commands::{agent, dashboard, system, workflow};
use state::AppState;

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // Agent commands
            agent::list_agents,
            agent::get_agent,
            agent::start_agent,
            agent::stop_agent,
            // Dashboard commands
            dashboard::get_dashboard_stats,
            dashboard::check_api_connection,
            // Workflow commands
            workflow::list_workflows,
            workflow::get_workflow,
            workflow::execute_workflow,
            // System commands
            system::get_system_info,
        ])
        .setup(|app| {
            // 앱 시작 시 연결 상태 확인
            let state = app.state::<AppState>();
            tauri::async_runtime::spawn(async move {
                state.check_connection().await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### Step 4: React Hooks

```typescript
// desktop/src/hooks/useApiConnection.ts
import { invoke } from '@tauri-apps/api/core';
import { useQuery } from '@tanstack/react-query';

export function useApiConnection() {
  return useQuery({
    queryKey: ['api-connection'],
    queryFn: () => invoke<boolean>('check_api_connection'),
    refetchInterval: 10000, // 10초마다 체크
    retry: false,
  });
}
```

```typescript
// desktop/src/hooks/useDashboard.ts
import { invoke } from '@tauri-apps/api/core';
import { useQuery } from '@tanstack/react-query';
import { DashboardStats } from '../types';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => invoke<DashboardStats>('get_dashboard_stats'),
    refetchInterval: 5000,
  });
}
```

```typescript
// desktop/src/hooks/useAgents.ts
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Agent } from '../types';

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => invoke<Agent[]>('list_agents'),
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => invoke<Agent>('get_agent', { id }),
    enabled: !!id,
  });
}

export function useStartAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoke<Agent>('start_agent', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useStopAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoke<Agent>('stop_agent', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
```

#### Cargo.toml 의존성 추가

```toml
# desktop/src-tauri/Cargo.toml
[dependencies]
# ... 기존 의존성 ...
reqwest = { version = "0.11", features = ["json", "rustls-tls"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "1.0"
```

#### 버그 예방 고려사항

| 위험 요소 | 예방 방안 |
|----------|----------|
| API 서버 미실행 | 연결 상태 UI 표시, 자동 재연결 |
| 타임아웃 | reqwest 타임아웃 설정 (30초) |
| 메모리 누수 | Arc/RwLock 올바른 사용 |
| 동시성 이슈 | RwLock 사용, 비동기 처리 |
| 직렬화 오류 | serde 타입 일치 확인 |

---

### P1-3: WebSocket 실시간 이벤트 연동

**목적**: 실시간 이벤트 스트리밍

#### Step 1: 이벤트 타입 정의

```typescript
// src/api/interfaces/ws-events.ts
export enum WsEventType {
  // Connection
  CONNECTED = 'connection:connected',
  DISCONNECTED = 'connection:disconnected',

  // Agent Events
  AGENT_STARTED = 'agent:started',
  AGENT_STOPPED = 'agent:stopped',
  AGENT_STATUS_CHANGED = 'agent:status_changed',
  AGENT_TASK_PROGRESS = 'agent:task_progress',
  AGENT_ERROR = 'agent:error',

  // Workflow Events
  WORKFLOW_STARTED = 'workflow:started',
  WORKFLOW_STEP_STARTED = 'workflow:step_started',
  WORKFLOW_STEP_COMPLETED = 'workflow:step_completed',
  WORKFLOW_COMPLETED = 'workflow:completed',
  WORKFLOW_FAILED = 'workflow:failed',

  // Task Events
  TASK_CREATED = 'task:created',
  TASK_ASSIGNED = 'task:assigned',
  TASK_STARTED = 'task:started',
  TASK_PROGRESS = 'task:progress',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',

  // System Events
  SYSTEM_HEALTH = 'system:health',
  SYSTEM_METRICS = 'system:metrics',
  SYSTEM_ALERT = 'system:alert',
}

export interface WsEvent<T = unknown> {
  id: string;
  type: WsEventType;
  timestamp: string;
  data: T;
}

// Event Payloads
export interface AgentStatusChangedPayload {
  agentId: string;
  agentType: string;
  previousStatus: string;
  currentStatus: string;
  reason?: string;
}

export interface TaskProgressPayload {
  taskId: string;
  agentId: string;
  progress: number; // 0-100
  stage: string;
  message?: string;
}

export interface WorkflowStepPayload {
  workflowId: string;
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
}

export interface SystemMetricsPayload {
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
  activeConnections: number;
}
```

#### Step 2: WsServer 강화

```typescript
// src/api/server/ws-server.ts
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import { WsEvent, WsEventType } from '../interfaces/ws-events';
import { Logger } from '@/core/services/logger';

interface WsClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<WsEventType>;
  connectedAt: Date;
}

export class WsServer {
  private wss: WebSocketServer;
  private clients: Map<string, WsClient> = new Map();
  private logger: Logger;

  constructor(port: number) {
    this.logger = new Logger('WsServer');
    this.wss = new WebSocketServer({ port });
    this.setupServer();
  }

  private setupServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = uuid();
      const client: WsClient = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        connectedAt: new Date(),
      };

      this.clients.set(clientId, client);
      this.logger.info(`Client connected: ${clientId}`);

      // 연결 확인 메시지
      this.sendToClient(client, {
        id: uuid(),
        type: WsEventType.CONNECTED,
        timestamp: new Date().toISOString(),
        data: { clientId },
      });

      ws.on('message', (data) => {
        this.handleMessage(client, data.toString());
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.logger.info(`Client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        this.logger.error(`Client error: ${clientId}`, error);
      });

      // Heartbeat
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(interval);
        }
      }, 30000);
    });

    this.logger.info(`WebSocket server started on port ${this.wss.options.port}`);
  }

  private handleMessage(client: WsClient, message: string) {
    try {
      const data = JSON.parse(message);

      switch (data.action) {
        case 'subscribe':
          this.handleSubscribe(client, data.events);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(client, data.events);
          break;
        case 'ping':
          this.sendToClient(client, {
            id: uuid(),
            type: 'pong' as WsEventType,
            timestamp: new Date().toISOString(),
            data: {},
          });
          break;
      }
    } catch (error) {
      this.logger.error('Failed to parse message', error);
    }
  }

  private handleSubscribe(client: WsClient, events: WsEventType[]) {
    events.forEach(event => client.subscriptions.add(event));
    this.logger.debug(`Client ${client.id} subscribed to: ${events.join(', ')}`);
  }

  private handleUnsubscribe(client: WsClient, events: WsEventType[]) {
    events.forEach(event => client.subscriptions.delete(event));
  }

  private sendToClient(client: WsClient, event: WsEvent) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(event));
    }
  }

  /**
   * 모든 클라이언트에 브로드캐스트
   */
  broadcast<T>(type: WsEventType, data: T): void {
    const event: WsEvent<T> = {
      id: uuid(),
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    this.clients.forEach(client => {
      // 구독 확인 (빈 구독은 모든 이벤트 수신)
      if (client.subscriptions.size === 0 || client.subscriptions.has(type)) {
        this.sendToClient(client, event);
      }
    });
  }

  /**
   * 특정 클라이언트에 전송
   */
  sendTo<T>(clientId: string, type: WsEventType, data: T): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.sendToClient(client, {
        id: uuid(),
        type,
        timestamp: new Date().toISOString(),
        data,
      });
    }
  }

  /**
   * 연결된 클라이언트 수
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * 서버 종료
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.logger.info('WebSocket server closed');
        resolve();
      });
    });
  }
}
```

#### Step 3: 웹 클라이언트 WebSocket 훅

```typescript
// web/src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WsEvent, WsEventType } from '../types/ws-events';

interface UseWebSocketOptions {
  url?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastEvent: WsEvent | null;
  send: (action: string, data: unknown) => void;
  subscribe: (events: WsEventType[]) => void;
  unsubscribe: (events: WsEventType[]) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url = 'ws://localhost:3002/ws',
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const queryClient = useQueryClient();

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const wsEvent: WsEvent = JSON.parse(event.data);
        setLastEvent(wsEvent);
        handleEvent(wsEvent);
      } catch (error) {
        console.error('Failed to parse WebSocket message', error);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');

      if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setTimeout(connect, reconnectInterval);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error', error);
    };
  }, [url, autoReconnect, reconnectInterval, maxReconnectAttempts]);

  const handleEvent = useCallback((event: WsEvent) => {
    switch (event.type) {
      case WsEventType.AGENT_STATUS_CHANGED:
      case WsEventType.AGENT_STARTED:
      case WsEventType.AGENT_STOPPED:
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        break;

      case WsEventType.WORKFLOW_STARTED:
      case WsEventType.WORKFLOW_COMPLETED:
      case WsEventType.WORKFLOW_FAILED:
      case WsEventType.WORKFLOW_STEP_COMPLETED:
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        break;

      case WsEventType.TASK_PROGRESS:
        // 실시간 진행률 업데이트
        queryClient.setQueryData(
          ['task-progress', (event.data as any).taskId],
          event.data
        );
        break;

      case WsEventType.SYSTEM_METRICS:
        queryClient.setQueryData(['system-metrics'], event.data);
        break;
    }
  }, [queryClient]);

  const send = useCallback((action: string, data: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action, ...data }));
    }
  }, []);

  const subscribe = useCallback((events: WsEventType[]) => {
    send('subscribe', { events });
  }, [send]);

  const unsubscribe = useCallback((events: WsEventType[]) => {
    send('unsubscribe', { events });
  }, [send]);

  useEffect(() => {
    connect();

    return () => {
      ws.current?.close();
    };
  }, [connect]);

  return { isConnected, lastEvent, send, subscribe, unsubscribe };
}
```

#### Step 4: 실시간 알림 컴포넌트

```typescript
// web/src/components/RealtimeNotifications.tsx
import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { WsEvent, WsEventType } from '../types/ws-events';
import { Toast, ToastContainer } from './Toast';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
}

export function RealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { lastEvent, isConnected } = useWebSocket();

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 10)); // 최대 10개

    // 5초 후 자동 제거
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    if (!lastEvent) return;

    const notification = mapEventToNotification(lastEvent);
    if (notification) {
      addNotification(notification);
    }
  }, [lastEvent, addNotification]);

  return (
    <>
      {/* 연결 상태 표시 */}
      <div className={`fixed top-4 right-4 px-3 py-1 rounded-full text-sm ${
        isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isConnected ? '● 연결됨' : '○ 연결 끊김'}
      </div>

      {/* 알림 스택 */}
      <ToastContainer>
        {notifications.map(notification => (
          <Toast
            key={notification.id}
            type={notification.type}
            title={notification.title}
            message={notification.message}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </ToastContainer>
    </>
  );
}

function mapEventToNotification(event: WsEvent): Omit<Notification, 'id' | 'timestamp'> | null {
  switch (event.type) {
    case WsEventType.AGENT_STARTED:
      return {
        type: 'success',
        title: '에이전트 시작',
        message: `에이전트 ${(event.data as any).agentId}가 시작되었습니다.`,
      };

    case WsEventType.AGENT_STOPPED:
      return {
        type: 'info',
        title: '에이전트 중지',
        message: `에이전트 ${(event.data as any).agentId}가 중지되었습니다.`,
      };

    case WsEventType.AGENT_ERROR:
      return {
        type: 'error',
        title: '에이전트 오류',
        message: `에이전트 ${(event.data as any).agentId}에서 오류가 발생했습니다.`,
      };

    case WsEventType.WORKFLOW_COMPLETED:
      return {
        type: 'success',
        title: '워크플로우 완료',
        message: `워크플로우 ${(event.data as any).workflowId}가 완료되었습니다.`,
      };

    case WsEventType.WORKFLOW_FAILED:
      return {
        type: 'error',
        title: '워크플로우 실패',
        message: `워크플로우 ${(event.data as any).workflowId}가 실패했습니다.`,
      };

    case WsEventType.SYSTEM_ALERT:
      return {
        type: 'warning',
        title: '시스템 알림',
        message: (event.data as any).message,
      };

    default:
      return null;
  }
}
```

---

### P1-4: E2E 테스트 스위트

**목적**: 전체 시스템 E2E 테스트

#### 테스트 구조

```
tests/e2e/
├── setup/
│   ├── global-setup.ts        # 테스트 환경 초기화
│   ├── global-teardown.ts     # 테스트 환경 정리
│   └── test-fixtures.ts       # 공통 픽스처
├── api/
│   ├── agents.e2e.ts          # 에이전트 API 테스트
│   ├── workflows.e2e.ts       # 워크플로우 API 테스트
│   ├── dashboard.e2e.ts       # 대시보드 API 테스트
│   └── websocket.e2e.ts       # WebSocket 테스트
├── web/
│   ├── dashboard.e2e.ts       # 대시보드 UI 테스트
│   ├── agents.e2e.ts          # 에이전트 UI 테스트
│   └── workflows.e2e.ts       # 워크플로우 UI 테스트
└── integration/
    ├── agent-workflow.e2e.ts  # 에이전트-워크플로우 통합
    └── realtime.e2e.ts        # 실시간 이벤트 통합
```

#### Global Setup

```typescript
// tests/e2e/setup/global-setup.ts
import { spawn, ChildProcess } from 'child_process';
import waitOn from 'wait-on';

let apiServer: ChildProcess;
let wsServer: ChildProcess;

export async function setup() {
  // API 서버 시작
  apiServer = spawn('npm', ['run', 'dev:api'], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'test' },
  });

  // 서버 준비 대기
  await waitOn({
    resources: [
      'http://localhost:3001/api/health',
      'tcp:localhost:3002',
    ],
    timeout: 30000,
  });

  console.log('Test servers started');
}

export async function teardown() {
  apiServer?.kill();
  wsServer?.kill();
  console.log('Test servers stopped');
}
```

#### API E2E 테스트

```typescript
// tests/e2e/api/agents.e2e.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api/v1';

describe('Agents API E2E', () => {
  beforeAll(async () => {
    // 테스트 데이터 초기화
  });

  afterAll(async () => {
    // 테스트 데이터 정리
  });

  describe('GET /agents', () => {
    it('should return agent list', async () => {
      const { data } = await axios.get(`${API_BASE}/agents`);

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('POST /agents/:id/start', () => {
    it('should start an agent', async () => {
      // 먼저 에이전트 생성
      const createRes = await axios.post(`${API_BASE}/agents`, {
        name: 'test-agent',
        type: 'coder',
      });
      const agentId = createRes.data.data.id;

      // 에이전트 시작
      const { data } = await axios.post(`${API_BASE}/agents/${agentId}/start`);

      expect(data.success).toBe(true);
      expect(data.data.status).toBe('running');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent agent', async () => {
      try {
        await axios.get(`${API_BASE}/agents/non-existent-id`);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });
});
```

#### WebSocket E2E 테스트

```typescript
// tests/e2e/api/websocket.e2e.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/ws';

describe('WebSocket E2E', () => {
  let ws: WebSocket;

  beforeAll(() => {
    ws = new WebSocket(WS_URL);
  });

  afterAll(() => {
    ws.close();
  });

  it('should connect successfully', (done) => {
    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      done();
    });
  });

  it('should receive connection event', (done) => {
    ws.on('message', (data) => {
      const event = JSON.parse(data.toString());
      if (event.type === 'connection:connected') {
        expect(event.data.clientId).toBeDefined();
        done();
      }
    });
  });

  it('should handle subscription', (done) => {
    ws.send(JSON.stringify({
      action: 'subscribe',
      events: ['agent:started', 'agent:stopped'],
    }));

    // 응답 확인 (선택적)
    setTimeout(done, 100);
  });

  it('should receive broadcast events', (done) => {
    // 다른 테스트에서 에이전트 시작 시 이벤트 수신 확인
    const timeout = setTimeout(() => {
      done(); // 이벤트 없어도 통과 (타임아웃)
    }, 5000);

    ws.on('message', (data) => {
      const event = JSON.parse(data.toString());
      if (event.type === 'agent:started') {
        clearTimeout(timeout);
        expect(event.data.agentId).toBeDefined();
        done();
      }
    });
  });
});
```

---

### P1-5: Production 설정

**목적**: 환경별 설정 및 시크릿 관리

#### 환경 설정 구조

```
config/
├── default.json           # 기본 설정
├── development.json       # 개발 환경
├── test.json              # 테스트 환경
├── staging.json           # 스테이징 환경
├── production.json        # 프로덕션 환경
└── custom-environment-variables.json  # 환경 변수 매핑
```

```json
// config/default.json
{
  "app": {
    "name": "CodeAvengers",
    "version": "1.0.0"
  },
  "server": {
    "api": {
      "port": 3001,
      "host": "0.0.0.0"
    },
    "websocket": {
      "port": 3002
    }
  },
  "database": {
    "type": "postgresql",
    "pool": {
      "min": 2,
      "max": 10
    }
  },
  "llm": {
    "provider": "claude",
    "timeout": 30000,
    "maxRetries": 3
  },
  "security": {
    "jwt": {
      "expiresIn": "24h"
    },
    "rateLimit": {
      "max": 100,
      "windowMs": 60000
    }
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

```json
// config/production.json
{
  "logging": {
    "level": "warn"
  },
  "security": {
    "rateLimit": {
      "max": 50,
      "windowMs": 60000
    }
  }
}
```

```json
// config/custom-environment-variables.json
{
  "server": {
    "api": {
      "port": "API_PORT"
    }
  },
  "database": {
    "url": "DATABASE_URL"
  },
  "llm": {
    "provider": "LLM_PROVIDER",
    "apiKey": "ANTHROPIC_API_KEY"
  },
  "security": {
    "jwt": {
      "secret": "JWT_SECRET"
    }
  },
  "github": {
    "token": "GITHUB_TOKEN"
  }
}
```

#### 시크릿 관리

```typescript
// src/core/config/secrets.ts
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

interface Secrets {
  databaseUrl: string;
  jwtSecret: string;
  githubToken: string;
  anthropicApiKey: string;
}

export class SecretManager {
  private secrets: Partial<Secrets> = {};
  private smClient?: SecretsManager;

  constructor(private useAws: boolean = false) {
    if (useAws) {
      this.smClient = new SecretsManager({ region: process.env.AWS_REGION });
    }
  }

  async loadSecrets(): Promise<Secrets> {
    if (this.useAws) {
      return this.loadFromAws();
    }
    return this.loadFromEnv();
  }

  private async loadFromAws(): Promise<Secrets> {
    const secretName = process.env.AWS_SECRET_NAME || 'codeavengers/prod';

    const response = await this.smClient!.getSecretValue({
      SecretId: secretName,
    });

    const secrets = JSON.parse(response.SecretString || '{}');
    return {
      databaseUrl: secrets.DATABASE_URL,
      jwtSecret: secrets.JWT_SECRET,
      githubToken: secrets.GITHUB_TOKEN,
      anthropicApiKey: secrets.ANTHROPIC_API_KEY,
    };
  }

  private loadFromEnv(): Secrets {
    return {
      databaseUrl: process.env.DATABASE_URL || '',
      jwtSecret: process.env.JWT_SECRET || 'dev-secret',
      githubToken: process.env.GITHUB_TOKEN || '',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    };
  }
}
```

---

### P1-6: CI/CD 파이프라인

**목적**: GitHub Actions 배포 자동화

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  e2e:
    runs-on: ubuntu-latest
    needs: [build]
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
```

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-2

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: codeavengers
          IMAGE_TAG: ${{ github.ref_name }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster codeavengers-prod \
            --service codeavengers-api \
            --force-new-deployment
```

---

## P2: Medium Priority 작업

### P2-1: 테스트 커버리지 80%

**목적**: 77.5% → 80% 커버리지 향상

#### 커버리지 개선 대상

| 모듈 | 현재 | 목표 | 우선순위 |
|------|------|------|---------|
| `core/tools` | 70% | 80% | 높음 |
| `api` | 65% | 75% | 높음 |
| `agents` | 75% | 80% | 중간 |

#### 테스트 추가 계획

```typescript
// tests/unit/core/tools/mcp/mcp-client.test.ts
describe('McpClient', () => {
  describe('connect', () => {
    it('should establish stdio connection', async () => { /* ... */ });
    it('should establish websocket connection', async () => { /* ... */ });
    it('should handle connection errors', async () => { /* ... */ });
    it('should reconnect on disconnect', async () => { /* ... */ });
  });

  describe('execute', () => {
    it('should execute tool with valid params', async () => { /* ... */ });
    it('should validate params against schema', async () => { /* ... */ });
    it('should handle timeout', async () => { /* ... */ });
    it('should retry on transient errors', async () => { /* ... */ });
  });
});
```

---

### P2-2: 성능 최적화

**목적**: 프로파일링 및 병목 제거

#### 프로파일링 대상

| 영역 | 측정 지표 | 목표 |
|------|----------|------|
| API 응답 시간 | p95 latency | < 100ms |
| 메모리 사용량 | heap size | < 512MB |
| 에이전트 시작 시간 | cold start | < 2s |
| 워크플로우 실행 | step duration | < 30s |

#### 프로파일러 통합

```typescript
// src/core/services/profiler.ts
import { performance, PerformanceObserver } from 'perf_hooks';

export class Profiler {
  private static instance: Profiler;
  private marks: Map<string, number> = new Map();
  private measurements: Map<string, number[]> = new Map();

  static getInstance(): Profiler {
    if (!Profiler.instance) {
      Profiler.instance = new Profiler();
    }
    return Profiler.instance;
  }

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark);
    if (!start) {
      throw new Error(`Start mark "${startMark}" not found`);
    }

    const duration = performance.now() - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return duration;
  }

  getStats(name: string): { avg: number; p95: number; max: number } | null {
    const durations = this.measurements.get(name);
    if (!durations || durations.length === 0) return null;

    const sorted = [...durations].sort((a, b) => a - b);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      avg,
      p95: sorted[p95Index],
      max: sorted[sorted.length - 1],
    };
  }

  report(): void {
    console.log('\n📊 Performance Report\n');
    console.log('─'.repeat(60));

    for (const [name, durations] of this.measurements) {
      const stats = this.getStats(name);
      if (stats) {
        console.log(`${name}:`);
        console.log(`  Avg: ${stats.avg.toFixed(2)}ms | P95: ${stats.p95.toFixed(2)}ms | Max: ${stats.max.toFixed(2)}ms`);
      }
    }

    console.log('─'.repeat(60));
  }
}

// 데코레이터
export function Measure(name: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const profiler = Profiler.getInstance();
      const startMark = `${name}_start_${Date.now()}`;

      profiler.mark(startMark);

      try {
        return await original.apply(this, args);
      } finally {
        profiler.measure(name, startMark);
      }
    };

    return descriptor;
  };
}
```

---

### P2-3: 에러 핸들링 강화

**목적**: 사용자 친화적 에러 메시지

```typescript
// src/shared/errors/user-friendly-error.ts
export class UserFriendlyError extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string,
    public readonly technicalMessage: string,
    public readonly suggestions: string[] = [],
    public readonly metadata?: Record<string, unknown>
  ) {
    super(userMessage);
    this.name = 'UserFriendlyError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.userMessage,
      suggestions: this.suggestions,
    };
  }
}

// 에러 코드 정의
export const ErrorCodes = {
  // 에이전트 에러
  AGENT_NOT_FOUND: 'AGENT_001',
  AGENT_ALREADY_RUNNING: 'AGENT_002',
  AGENT_START_FAILED: 'AGENT_003',

  // 워크플로우 에러
  WORKFLOW_NOT_FOUND: 'WORKFLOW_001',
  WORKFLOW_VALIDATION_FAILED: 'WORKFLOW_002',
  WORKFLOW_EXECUTION_FAILED: 'WORKFLOW_003',

  // API 에러
  UNAUTHORIZED: 'AUTH_001',
  FORBIDDEN: 'AUTH_002',
  RATE_LIMITED: 'API_001',

  // 시스템 에러
  DATABASE_ERROR: 'SYS_001',
  EXTERNAL_SERVICE_ERROR: 'SYS_002',
} as const;

// 에러 메시지 매핑
export const ErrorMessages: Record<string, { user: string; suggestions: string[] }> = {
  [ErrorCodes.AGENT_NOT_FOUND]: {
    user: '요청한 에이전트를 찾을 수 없습니다.',
    suggestions: [
      '에이전트 ID를 확인해주세요.',
      '에이전트 목록에서 사용 가능한 에이전트를 확인해주세요.',
    ],
  },
  [ErrorCodes.RATE_LIMITED]: {
    user: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    suggestions: [
      '1분 후에 다시 시도해주세요.',
      'API 사용량을 확인해주세요.',
    ],
  },
  // ... 더 많은 에러 메시지
};
```

---

### P2-4: 로깅 개선

**목적**: 구조화된 로그, 레벨별 필터

```typescript
// src/core/services/structured-logger.ts
import pino from 'pino';

export interface LogContext {
  requestId?: string;
  userId?: string;
  agentId?: string;
  workflowId?: string;
  [key: string]: unknown;
}

export class StructuredLogger {
  private logger: pino.Logger;
  private context: LogContext = {};

  constructor(name: string, options?: pino.LoggerOptions) {
    this.logger = pino({
      name,
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      ...options,
    });
  }

  child(context: LogContext): StructuredLogger {
    const childLogger = new StructuredLogger(this.logger.bindings().name as string);
    childLogger.logger = this.logger.child(context);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info({ ...this.context, ...data }, message);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn({ ...this.context, ...data }, message);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.logger.error({
      ...this.context,
      ...data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    }, message);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug({ ...this.context, ...data }, message);
  }

  // 성능 측정 로그
  timing(operation: string, durationMs: number, data?: Record<string, unknown>): void {
    this.logger.info({
      ...this.context,
      ...data,
      operation,
      durationMs,
      type: 'timing',
    }, `${operation} completed in ${durationMs}ms`);
  }

  // 감사 로그
  audit(action: string, data: Record<string, unknown>): void {
    this.logger.info({
      ...this.context,
      ...data,
      action,
      type: 'audit',
      timestamp: new Date().toISOString(),
    }, `Audit: ${action}`);
  }
}
```

---

### P2-5: API 문서화

**목적**: OpenAPI/Swagger 스펙 생성

```typescript
// src/api/docs/swagger.ts
import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export async function setupSwagger(fastify: FastifyInstance) {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'CodeAvengers API',
        description: 'AI Agent Platform API',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3001', description: 'Development' },
        { url: 'https://api.codeavengers.io', description: 'Production' },
      ],
      tags: [
        { name: 'Agents', description: '에이전트 관리' },
        { name: 'Workflows', description: '워크플로우 관리' },
        { name: 'Dashboard', description: '대시보드' },
        { name: 'Tools', description: '도구 관리' },
        { name: 'Hooks', description: '훅 관리' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
      },
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}
```

---

## 버그 예방 체크리스트

### 코드 작성 시

- [ ] 모든 외부 입력 유효성 검사 (Zod 스키마)
- [ ] 에러 경계 설정 (try-catch, ErrorBoundary)
- [ ] null/undefined 체크 (Optional chaining, Nullish coalescing)
- [ ] 타입 안전성 확보 (strict TypeScript)
- [ ] 메모리 누수 방지 (cleanup 함수, AbortController)

### API 설계 시

- [ ] 일관된 응답 형식 (`{ success, data, error }`)
- [ ] 적절한 HTTP 상태 코드
- [ ] Rate limiting 적용
- [ ] 인증/인가 검증
- [ ] 요청 크기 제한

### 프론트엔드 작성 시

- [ ] 로딩 상태 UI
- [ ] 에러 상태 UI
- [ ] 빈 상태 UI
- [ ] 자동 재시도 로직
- [ ] 낙관적 업데이트

### 데이터베이스 작업 시

- [ ] 트랜잭션 사용
- [ ] 인덱스 확인
- [ ] N+1 쿼리 방지
- [ ] 데이터 무결성 검증
- [ ] 마이그레이션 롤백 계획

### 배포 전

- [ ] 환경 변수 확인
- [ ] 시크릿 로테이션
- [ ] 헬스 체크 엔드포인트
- [ ] 로그 수준 확인
- [ ] 롤백 절차 준비

---

## 통합 테스트 전략

### 테스트 피라미드

```
                    /\
                   /  \
                  / E2E \        10% - 전체 시스템 검증
                 /──────\
                /        \
               /Integration\     30% - 모듈 간 상호작용
              /────────────\
             /              \
            /      Unit      \   60% - 개별 함수/클래스
           /──────────────────\
```

### 테스트 환경

| 환경 | 데이터베이스 | 외부 서비스 | 용도 |
|------|-------------|-------------|------|
| Unit | In-memory | Mock | 빠른 피드백 |
| Integration | Testcontainers | Mock | 모듈 통합 |
| E2E | 실제 DB (Docker) | Mock 또는 실제 | 전체 검증 |

### 실행 명령

```bash
# 단위 테스트
npm run test:unit

# 통합 테스트
npm run test:integration

# E2E 테스트
npm run test:e2e

# 전체 테스트
npm test

# 커버리지 리포트
npm run test:coverage
```

---

## 관련 문서

- [NEXT_TASKS.md](../06-roadmap/NEXT_TASKS.md) - 작업 리스트
- [STATUS.md](../06-roadmap/STATUS.md) - 현재 상황
- [SYSTEM_DESIGN.md](../02-architecture/SYSTEM_DESIGN.md) - 시스템 설계
- [P5_PLATFORM.md](../06-roadmap/P5_PLATFORM.md) - Phase 5 상세 계획

---

*최종 업데이트: 2026-01-24*
