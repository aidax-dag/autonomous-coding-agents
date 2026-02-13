# Development Roadmap

> ACA (Autonomous Coding Agents) 개발 로드맵

---

## Phase Overview

```
Phase 0: Foundation (기반)           ─── ✅ COMPLETED
    ↓
Phase 1: Core Agents (핵심)          ─── ✅ COMPLETED
    ↓
Phase 2: Workflow (워크플로우)       ─── ✅ COMPLETED
    ↓
Phase 3: Tools & Hooks (도구)        ─── ✅ COMPLETED
    ↓
Phase 4: Advanced Features           ─── ✅ COMPLETED
    ↓
Phase 5: Platform (플랫폼)           ─── ✅ COMPLETED
    ↓
Phase A-F: Enhancement Strategy      ─── ✅ COMPLETED
    ↓
Phase B: Production Ready            ─── ✅ COMPLETED
    ↓
Phase C: Feature Expansion           ─── ✅ COMPLETED
    ↓
Phase D: Platform Expansion          ─── 📋 PLANNED
```

---

## Phase 0-4: Core Implementation ✅ COMPLETED

모든 핵심 모듈 구현 완료:
- Orchestrator, Team Agents, Hooks, Validation, Learning, Context
- Session, Security, Skills, Deep Worker, Protocols, HUD, Benchmark
- LLM Clients (Claude/OpenAI/Gemini/Ollama), Model Router, Cost Tracker
- CLI (run/submit/serve), Error Recovery, Config, Logging

---

## Phase 5: Platform ✅ COMPLETED

| Feature | Status |
|---------|--------|
| API Server (standalone entry point) | ✅ |
| Web Dashboard (React 19 + Vite + Tailwind) | ✅ |
| Desktop App (Tauri 2 scaffolding) | ✅ |
| SSE Real-time Updates | ✅ |
| i18n, Themes, Shortcuts, Notifications | ✅ |

---

## Enhancement Strategy (Phase A-F) ✅ COMPLETED

| Phase | Tasks | Description |
|-------|-------|-------------|
| A | T1-T3 | Hook Pipeline (GoalVerificationHook, IntegrationFlags) |
| B | T4-T6 | MCP/LSP/Skill Bridge |
| C | T7-T9 | Cross-Module Wiring (HookExecutor↔Orchestrator) |
| D | T10-T12 | Security Hooks (PermissionGuard, PlatformSandbox) |
| E | T13-T15 | Telemetry/Learning (OTel, FeedbackLoop) |
| F | T16-T17 | Dashboard/Benchmark (RunnerDataSource) |

---

## Phase B: Production Ready ✅ COMPLETED

| # | Task | Status | Description |
|---|------|--------|-------------|
| B-1 | API 서버 엔트리포인트 | ✅ | `src/api/server.ts`, 미들웨어, Dockerfile |
| B-2 | API 보안 | ✅ | JWT, API Key, Rate Limit, CORS, Validation |
| B-3 | 프론트엔드 인증 | ✅ | LoginPage, AuthContext, ProtectedRoute |
| B-4 | GitHub 실제 연동 | ✅ | GitHubClient, ServiceRegistry 통합 |
| B-5 | README + CHANGELOG | ✅ | 공개용 문서 |
| B-6 | 문서 정리 | ✅ | NEXT_STEPS.md 삭제, 문서 현행화 |
| B-docker | Docker Compose | ✅ | docker-compose.yml, web Dockerfile, nginx |

### API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /api/health | GET | No | 서버 상태 확인 |
| /api/login | POST | No | JWT 토큰 발행 |
| /api/auth/refresh | POST | No | 액세스 토큰 갱신 |
| /api/snapshot | GET | Yes | 대시보드 스냅샷 |
| /api/agents | GET | Yes | 에이전트 목록 |
| /api/agents/:id | GET | Yes | 에이전트 상세 |
| /api/tasks | POST | Yes | 태스크 제출 |
| /api/sse/clients | GET | Yes | SSE 클라이언트 수 |

---

## Phase C: Feature Expansion ✅ COMPLETED

| # | Task | Status | Description |
|---|------|--------|-------------|
| C-1 | MCP 도구 실전 연동 | ✅ | MCPConnectionManager (365줄), presets 5종, config 스키마, ServiceRegistry 통합 |
| C-2 | 병렬 실행 통합 | ✅ | AgentPool↔ParallelExecutor wiring, BackgroundManager→Runner API, 이벤트, config 확장 |
| C-3 | Evals 모듈 | ✅ | EvalRunner, EvalReporter, 3 definitions |
| C-4 | LSP 실전 통합 | ✅ | DocumentSync, SymbolCache, LSPConnectionManager, RefactorEngine LSP 연결, presets 5종 |

### Phase C API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /api/mcp/servers | GET | Yes | MCP 서버 목록, 도구 수, 연결 상태 |
| /api/pool/stats | GET | Yes | AgentPool active/available/queued 슬롯 |

---

## Phase D: Platform Expansion 📋 PLANNED

| # | Task | Description |
|---|------|-------------|
| D-1 | 인스틴트 공유 | 팀 간 학습 전이, import/export |
| D-2 | 팀 협업 | 실시간 협업, 공유 세션 |
| D-3 | 멀티 프로젝트 | 여러 프로젝트 동시 관리 |
| D-4 | SaaS 기능 | 멀티 테넌트, 과금 |
| D-5 | 사용량 분석 | 비용 리포트, 사용 패턴 대시보드 |

---

## Success Metrics

### Technical
- 테스트 커버리지: 70%+ ✅ (현재 77.5%)
- 테스트 수: 3,715 (227 suites)
- TypeScript strict mode: ✅ Clean
- 코드 조직: SOLID 원칙 + DI 패턴

### Operational
- Docker Compose 단일 명령 배포
- JWT 기반 인증 + API 키 (CI/CD)
- Rate limiting + CORS 보안
- 실시간 모니터링 (HUD + SSE)

---

## Related Documents

- [Current Status](./STATUS.md) - 현재 진행 상황
- [Next Tasks](./NEXT_TASKS.md) - 다음 작업 리스트
- [Architecture Overview](../02-architecture/OVERVIEW.md) - 아키텍처 개요
