# Phase 5: Platform (플랫폼)

> CodeAvengers 멀티 플랫폼 지원을 위한 상세 계획서

---

## 목차

1. [개요](#개요)
2. [완료된 작업](#완료된-작업)
3. [남은 작업 상세 계획](#남은-작업-상세-계획)
4. [기술 스택](#기술-스택)
5. [아키텍처](#아키텍처)

---

## 개요

### 목표
- REST API 서버를 통한 에이전트 시스템 제어
- 웹 기반 대시보드로 실시간 모니터링
- 데스크톱 앱으로 네이티브 경험 제공
- WebSocket을 통한 실시간 이벤트 스트리밍

### 현재 상태

| 컴포넌트 | 진행률 | 상태 |
|----------|--------|------|
| API 서버 | 100% | ✅ 완료 |
| 웹 대시보드 | 60% | 🔄 UI 완료, API 연동 필요 |
| 데스크톱 앱 | 60% | 🔄 UI 완료, API 연동 필요 |
| WebSocket 연동 | 30% | 🔄 서버 완료, 클라이언트 연동 필요 |

### 실행 방법

```bash
# API 서버 시작
npm run dev:api

# 웹 대시보드 시작
cd web && npm run dev

# 데스크톱 앱 시작
cd desktop && npm run tauri:dev
```

### 서비스 URL

| 서비스 | URL |
|--------|-----|
| API 서버 | http://localhost:3001 |
| Swagger UI | http://localhost:3001/docs |
| WebSocket | ws://localhost:3002 |
| 웹 대시보드 | http://localhost:5173 |
| 데스크톱 앱 | http://localhost:1420 |

---

## 완료된 작업

### 1. API 서버 엔트리 포인트 생성

**파일**: `src/bin/start-api-server.ts`

**작업 내용**:
- Fastify 기반 REST API 서버 부트스트랩
- 라우터 등록 (Agents, Workflows, Tools, Hooks)
- 대시보드 엔드포인트 추가 (/dashboard/stats, /projects, /logs)
- WebSocket 서버 초기화 (포트 3002)
- Swagger UI 문서화 (/docs)

**API 엔드포인트**:

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/api/health` | GET | 서버 상태 확인 |
| `/api/agents` | GET, POST | 에이전트 목록/생성 |
| `/api/agents/:id` | GET, PATCH, DELETE | 에이전트 상세 |
| `/api/workflows` | GET, POST | 워크플로우 목록/생성 |
| `/api/workflows/:id` | GET, PATCH, DELETE | 워크플로우 상세 |
| `/api/tools` | GET, POST | 도구 목록/생성 |
| `/api/hooks` | GET, POST | 훅 목록/생성 |
| `/api/dashboard/stats` | GET | 대시보드 통계 |
| `/api/projects` | GET, POST | 프로젝트 목록/생성 |
| `/api/logs` | GET | 로그 조회 |

---

### 2. Vite 프록시 설정 수정

**파일**: `web/vite.config.ts`

**변경 사항**:
```typescript
// Before
proxy: {
  '/api': { target: 'http://localhost:3000' },
  '/ws': { target: 'ws://localhost:3001' }
}

// After
proxy: {
  '/api': { target: 'http://localhost:3001' },
  '/ws': { target: 'ws://localhost:3002' }
}
```

---

### 3. API 클라이언트 경로 수정

**파일**: `web/src/api/client.ts`

**변경 사항**:
```typescript
// Before
const API_BASE = '/api/v1';

// After
const API_BASE = '/api';
```

---

### 4. 데스크톱 앱 설정 수정

**파일**: `desktop/src-tauri/tauri.conf.json`

**변경 사항**:
- `devUrl`: `http://localhost:5173` → `http://localhost:1420`
- `trayIcon` 섹션 제거 (디버그 모드 호환성)

---

### 5. Tauri 아이콘 파일 생성

**파일**: `desktop/src-tauri/icons/`

**생성된 파일**:
- `32x32.png` - 32x32 픽셀 아이콘
- `128x128.png` - 128x128 픽셀 아이콘
- `128x128@2x.png` - 256x256 픽셀 (Retina)
- `icon.png` - 기본 아이콘

---

### 6. 시스템 트레이 디버그 모드 비활성화

**파일**: `desktop/src-tauri/src/main.rs`

**변경 사항**:
```rust
// 디버그 모드에서 트레이 생성 스킵
#[cfg(not(debug_assertions))]
if let Err(e) = tray::create_tray(handle) {
    error!("Failed to create system tray: {}", e);
}
```

---

## 남은 작업 상세 계획

### Task 1: 웹 대시보드 실제 API 연동

**우선순위**: P1 (높음)
**예상 작업량**: 중간
**상태**: 📋 계획됨

#### 1.1 현재 상황

현재 대시보드는 API 서버에서 목(mock) 데이터를 반환:

```typescript
// src/bin/start-api-server.ts (현재)
fastify.get(`${prefix}/dashboard/stats`, async (request, reply) => {
  const stats = {
    projects: { total: 0, active: 0 },
    workflows: { total: 0, running: 0, completed: 0, failed: 0 },
    agents: { total: 0, online: 0, busy: 0 },
    recentActivity: [],
  };
  return reply.send({ success: true, data: stats });
});
```

#### 1.2 구현 계획

**Step 1: DashboardService 생성**

```typescript
// src/api/services/dashboard.service.ts
export class DashboardService {
  constructor(
    private agentManager: AgentManager,
    private workflowEngine: WorkflowEngine,
    private projectRepository: ProjectRepository
  ) {}

  async getStats(): Promise<DashboardStats> {
    const [agents, workflows, projects] = await Promise.all([
      this.agentManager.getAgentStats(),
      this.workflowEngine.getWorkflowStats(),
      this.projectRepository.getProjectStats(),
    ]);

    return {
      projects,
      workflows,
      agents,
      recentActivity: await this.getRecentActivity(),
    };
  }

  async getRecentActivity(limit = 10): Promise<Activity[]> {
    // 최근 활동 조회 로직
  }
}
```

**Step 2: DashboardRouter 생성**

```typescript
// src/api/routes/dashboard.router.ts
export class DashboardRouter extends BaseRouter {
  prefix = '/v1/dashboard';

  constructor(private dashboardService: DashboardService) {
    super();
  }

  getRoutes(): RouteDefinition[] {
    return [
      {
        method: 'GET',
        path: '/stats',
        handler: this.getStats.bind(this),
        schema: DashboardStatsSchema,
      },
      {
        method: 'GET',
        path: '/activity',
        handler: this.getActivity.bind(this),
        schema: ActivityListSchema,
      },
    ];
  }
}
```

**Step 3: 웹 대시보드 컴포넌트 업데이트**

```typescript
// web/src/pages/Dashboard.tsx
export function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.getDashboardStats(),
    refetchInterval: 5000, // 5초마다 갱신
  });

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard title="프로젝트" value={data.projects.total} />
      <StatCard title="워크플로우" value={data.workflows.running} />
      <StatCard title="에이전트" value={data.agents.online} />
      <ActivityFeed activities={data.recentActivity} />
    </div>
  );
}
```

#### 1.3 작업 체크리스트

- [ ] `DashboardService` 클래스 생성
- [ ] `DashboardRouter` 클래스 생성
- [ ] `start-api-server.ts`에서 라우터 등록
- [ ] 웹 대시보드 `Dashboard.tsx` 업데이트
- [ ] 로딩/에러 상태 UI 구현
- [ ] 자동 갱신 (polling) 구현
- [ ] E2E 테스트 작성

#### 1.4 관련 파일

| 파일 | 작업 |
|------|------|
| `src/api/services/dashboard.service.ts` | 신규 생성 |
| `src/api/routes/dashboard.router.ts` | 신규 생성 |
| `src/bin/start-api-server.ts` | 수정 |
| `web/src/pages/Dashboard.tsx` | 수정 |
| `web/src/components/StatCard.tsx` | 신규 생성 |
| `web/src/components/ActivityFeed.tsx` | 신규 생성 |

---

### Task 2: 데스크톱 앱 API 서버 연동

**우선순위**: P1 (높음)
**예상 작업량**: 중간
**상태**: 📋 계획됨

#### 2.1 현재 상황

데스크톱 앱은 Tauri IPC 커맨드를 통해 Rust 백엔드와 통신하지만, 실제 API 서버와 연동되지 않음:

```rust
// desktop/src-tauri/src/commands/agent.rs (현재)
#[tauri::command]
pub async fn list_agents() -> Result<Vec<Agent>, String> {
    // TODO: API 서버 연동
    Ok(vec![])
}
```

#### 2.2 구현 계획

**Step 1: HTTP 클라이언트 설정**

```rust
// desktop/src-tauri/src/api/client.rs
use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct ApiClient {
    client: Client,
    base_url: String,
}

impl ApiClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.to_string(),
        }
    }

    pub async fn get<T: for<'de> Deserialize<'de>>(&self, path: &str) -> Result<T, ApiError> {
        let url = format!("{}{}", self.base_url, path);
        let response = self.client.get(&url).send().await?;
        let data: ApiResponse<T> = response.json().await?;
        Ok(data.data)
    }

    pub async fn post<T, B>(&self, path: &str, body: &B) -> Result<T, ApiError>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}{}", self.base_url, path);
        let response = self.client.post(&url).json(body).send().await?;
        let data: ApiResponse<T> = response.json().await?;
        Ok(data.data)
    }
}
```

**Step 2: 상태 관리에 ApiClient 추가**

```rust
// desktop/src-tauri/src/state.rs
use crate::api::ApiClient;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub api_client: Arc<RwLock<ApiClient>>,
    pub config: Arc<RwLock<AppConfig>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            api_client: Arc::new(RwLock::new(
                ApiClient::new("http://localhost:3001/api")
            )),
            config: Arc::new(RwLock::new(AppConfig::default())),
        }
    }
}
```

**Step 3: 커맨드 업데이트**

```rust
// desktop/src-tauri/src/commands/agent.rs
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_agents(state: State<'_, AppState>) -> Result<Vec<Agent>, String> {
    let client = state.api_client.read().await;
    client.get("/agents")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_agent(
    state: State<'_, AppState>,
    id: String
) -> Result<Agent, String> {
    let client = state.api_client.read().await;
    client.post(&format!("/agents/{}/start", id), &())
        .await
        .map_err(|e| e.to_string())
}
```

**Step 4: 프론트엔드 훅 업데이트**

```typescript
// desktop/src/hooks/useAgents.ts
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation } from '@tanstack/react-query';

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => invoke<Agent[]>('list_agents'),
  });
}

export function useStartAgent() {
  return useMutation({
    mutationFn: (id: string) => invoke<Agent>('start_agent', { id }),
  });
}
```

#### 2.3 작업 체크리스트

- [ ] `ApiClient` Rust 모듈 생성
- [ ] `AppState`에 API 클라이언트 추가
- [ ] Agent 커맨드 API 연동
- [ ] Workflow 커맨드 API 연동
- [ ] System 커맨드 API 연동
- [ ] 연결 상태 표시 UI 구현
- [ ] 오프라인 모드 처리
- [ ] 통합 테스트 작성

#### 2.4 관련 파일

| 파일 | 작업 |
|------|------|
| `desktop/src-tauri/src/api/mod.rs` | 신규 생성 |
| `desktop/src-tauri/src/api/client.rs` | 신규 생성 |
| `desktop/src-tauri/src/state.rs` | 수정 |
| `desktop/src-tauri/src/commands/agent.rs` | 수정 |
| `desktop/src-tauri/src/commands/workflow.rs` | 수정 |
| `desktop/src-tauri/src/commands/system.rs` | 수정 |
| `desktop/src-tauri/Cargo.toml` | reqwest 의존성 추가 |
| `desktop/src/hooks/useAgents.ts` | 수정 |

---

### Task 3: WebSocket 실시간 이벤트 연동

**우선순위**: P2 (중간)
**예상 작업량**: 중간
**상태**: 📋 계획됨

#### 3.1 현재 상황

WebSocket 서버는 구현되어 있으나, 클라이언트 연동이 없음:

```typescript
// src/api/server/ws-server.ts (현재)
export class WsServer {
  broadcast(event: string, data: unknown): void {
    // 구현됨
  }
}
```

#### 3.2 구현 계획

**Step 1: 이벤트 타입 정의**

```typescript
// src/api/interfaces/ws-events.ts
export enum WsEventType {
  // 에이전트 이벤트
  AGENT_STARTED = 'agent:started',
  AGENT_STOPPED = 'agent:stopped',
  AGENT_STATUS_CHANGED = 'agent:status_changed',
  AGENT_TASK_PROGRESS = 'agent:task_progress',

  // 워크플로우 이벤트
  WORKFLOW_STARTED = 'workflow:started',
  WORKFLOW_COMPLETED = 'workflow:completed',
  WORKFLOW_FAILED = 'workflow:failed',
  WORKFLOW_STEP_CHANGED = 'workflow:step_changed',

  // 시스템 이벤트
  SYSTEM_HEALTH = 'system:health',
  SYSTEM_METRICS = 'system:metrics',
}

export interface WsEvent<T = unknown> {
  type: WsEventType;
  timestamp: string;
  data: T;
}
```

**Step 2: 이벤트 발행 통합**

```typescript
// src/agents/base/base-agent.ts
export abstract class BaseAgent {
  protected wsServer: WsServer;

  protected emitEvent(type: WsEventType, data: unknown): void {
    this.wsServer.broadcast(type, {
      agentId: this.id,
      agentType: this.type,
      ...data,
    });
  }

  async start(): Promise<void> {
    this.emitEvent(WsEventType.AGENT_STARTED, {
      status: 'running',
    });
    // ...
  }
}
```

**Step 3: 웹 클라이언트 WebSocket 훅**

```typescript
// web/src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3002/ws');

    ws.current.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);

      switch (type) {
        case 'agent:status_changed':
          queryClient.invalidateQueries({ queryKey: ['agents'] });
          break;
        case 'workflow:step_changed':
          queryClient.invalidateQueries({ queryKey: ['workflows'] });
          break;
        case 'system:metrics':
          queryClient.setQueryData(['metrics'], data);
          break;
      }
    };

    return () => ws.current?.close();
  }, [queryClient]);

  const send = useCallback((type: string, data: unknown) => {
    ws.current?.send(JSON.stringify({ type, data }));
  }, []);

  return { send };
}
```

**Step 4: 실시간 알림 컴포넌트**

```typescript
// web/src/components/RealtimeNotifications.tsx
export function RealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useWebSocketEvent('agent:started', (data) => {
    addNotification({
      type: 'info',
      message: `에이전트 ${data.agentId} 시작됨`,
    });
  });

  useWebSocketEvent('workflow:failed', (data) => {
    addNotification({
      type: 'error',
      message: `워크플로우 실패: ${data.error}`,
    });
  });

  return <NotificationStack notifications={notifications} />;
}
```

#### 3.3 작업 체크리스트

- [ ] WebSocket 이벤트 타입 정의
- [ ] 에이전트 이벤트 발행 통합
- [ ] 워크플로우 이벤트 발행 통합
- [ ] 웹 클라이언트 WebSocket 훅 생성
- [ ] 실시간 알림 컴포넌트 구현
- [ ] 데스크톱 앱 WebSocket 연동
- [ ] 재연결 로직 구현
- [ ] 이벤트 필터링 기능

#### 3.4 관련 파일

| 파일 | 작업 |
|------|------|
| `src/api/interfaces/ws-events.ts` | 신규 생성 |
| `src/api/server/ws-server.ts` | 수정 |
| `src/agents/base/base-agent.ts` | 수정 |
| `src/workflow/workflow-engine.ts` | 수정 |
| `web/src/hooks/useWebSocket.ts` | 신규 생성 |
| `web/src/components/RealtimeNotifications.tsx` | 신규 생성 |
| `desktop/src-tauri/src/api/websocket.rs` | 신규 생성 |

---

### Task 4: 프로덕션용 아이콘 디자인 적용

**우선순위**: P3 (낮음)
**예상 작업량**: 작음
**상태**: 📋 계획됨

#### 4.1 현재 상황

현재 플레이스홀더 아이콘(단색 파란색 사각형) 사용 중.

#### 4.2 구현 계획

**Step 1: 아이콘 디자인 요구사항**

```yaml
icon_specifications:
  concept: "AI 에이전트 + 코드 조합"
  style: "모던, 미니멀, 기술적"
  colors:
    primary: "#3B82F6"  # Blue-500
    secondary: "#1E40AF"  # Blue-800
    accent: "#10B981"  # Emerald-500

  sizes:
    - 16x16    # Favicon, small icons
    - 32x32    # Standard icon
    - 64x64    # Medium icon
    - 128x128  # Large icon
    - 256x256  # Retina (128@2x)
    - 512x512  # App store, high-res
    - 1024x1024  # macOS requirement

  formats:
    - PNG (모든 사이즈)
    - ICO (Windows)
    - ICNS (macOS)
    - SVG (벡터 원본)
```

**Step 2: 파일 구조**

```
desktop/src-tauri/icons/
├── 16x16.png
├── 32x32.png
├── 64x64.png
├── 128x128.png
├── 128x128@2x.png
├── icon.png (512x512)
├── icon.ico (Windows)
├── icon.icns (macOS)
└── icon.svg (원본)

web/public/
├── favicon.ico
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png (180x180)
└── android-chrome-192x192.png
```

**Step 3: Tauri 설정 업데이트**

```json
// desktop/src-tauri/tauri.conf.json
{
  "bundle": {
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "app": {
    "trayIcon": {
      "iconPath": "icons/32x32.png",
      "iconAsTemplate": true
    }
  }
}
```

#### 4.3 작업 체크리스트

- [ ] 아이콘 디자인 제작 (외부 또는 AI 생성)
- [ ] 모든 사이즈 PNG 생성
- [ ] Windows ICO 파일 생성
- [ ] macOS ICNS 파일 생성
- [ ] 웹 파비콘 세트 생성
- [ ] Tauri 설정 업데이트
- [ ] 시스템 트레이 아이콘 설정
- [ ] PWA 매니페스트 업데이트

#### 4.4 관련 파일

| 파일 | 작업 |
|------|------|
| `desktop/src-tauri/icons/*` | 교체 |
| `desktop/src-tauri/tauri.conf.json` | 수정 |
| `web/public/favicon.ico` | 신규/교체 |
| `web/public/manifest.json` | 수정 |
| `web/index.html` | 메타태그 추가 |

---

## 기술 스택

### 백엔드 (API 서버)

| 기술 | 버전 | 용도 |
|------|------|------|
| Node.js | 20+ | 런타임 |
| TypeScript | 5.7+ | 언어 |
| Fastify | 5.x | HTTP 프레임워크 |
| ws | 8.x | WebSocket |
| Zod | 3.x | 스키마 검증 |

### 웹 대시보드

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 18+ | UI 프레임워크 |
| Vite | 5.x | 빌드 도구 |
| TanStack Query | 5.x | 서버 상태 관리 |
| Zustand | 4.x | 클라이언트 상태 |
| Tailwind CSS | 3.x | 스타일링 |
| Recharts | 2.x | 차트 |

### 데스크톱 앱

| 기술 | 버전 | 용도 |
|------|------|------|
| Tauri | 2.x | 데스크톱 프레임워크 |
| Rust | 1.75+ | 네이티브 백엔드 |
| React | 18+ | UI 프레임워크 |
| reqwest | 0.11+ | HTTP 클라이언트 |
| tokio | 1.x | 비동기 런타임 |

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트                            │
├─────────────────────────┬───────────────────────────────────┤
│    웹 대시보드 (React)   │      데스크톱 앱 (Tauri)          │
│    localhost:5173       │      localhost:1420               │
└───────────┬─────────────┴───────────────┬───────────────────┘
            │                             │
            │  HTTP/REST                  │  HTTP/REST
            │  WebSocket                  │  (IPC → HTTP)
            ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     API 서버 (Fastify)                       │
│                     localhost:3001                          │
├─────────────────────────────────────────────────────────────┤
│  /api/agents    │  /api/workflows  │  /api/dashboard        │
│  /api/tools     │  /api/hooks      │  /api/projects         │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                   WebSocket 서버                             │
│                   localhost:3002                            │
├─────────────────────────────────────────────────────────────┤
│  실시간 이벤트: agent:*, workflow:*, system:*               │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Core 시스템                               │
├─────────────────────────────────────────────────────────────┤
│  AgentManager  │  WorkflowEngine  │  ToolRegistry           │
│  HookSystem    │  EventBus        │  MetricsCollector       │
└─────────────────────────────────────────────────────────────┘
```

---

## 참고 문서

- [ROADMAP.md](./ROADMAP.md) - 전체 로드맵
- [STATUS.md](./STATUS.md) - 현재 진행 상황
- [Architecture Overview](../02-architecture/OVERVIEW.md) - 아키텍처 개요

---

*최종 업데이트: 2026-01-24*
