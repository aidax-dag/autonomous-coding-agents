# Development Roadmap

> CodeAvengers 개발 로드맵

---

## Phase Overview

```
Phase 0: Foundation (기반)        ─── ✅ COMPLETED
    ↓
Phase 1: Core Agents (핵심)       ─── ✅ COMPLETED
    ↓
Phase 2: Workflow (워크플로우)    ─── ✅ COMPLETED
    ↓
Phase 3: Tools & Hooks (도구)     ─── ✅ COMPLETED
    ↓
Phase 4: Advanced Features        ─── ✅ COMPLETED
    ↓
Phase 5: Platform (플랫폼)        ─── 📋 PLANNED
```

---

## Phase 0: Foundation ✅ COMPLETED

> SOLID 원칙 기반의 확장 가능한 코어 구조

| Feature | Description | Status |
|---------|-------------|--------|
| Core Interfaces | IAgent, ITool, IHook 등 | ✅ |
| DI Container | 의존성 주입 컨테이너 | ✅ |
| Configuration | 환경별 설정 관리 | ✅ |
| Logger | 구조화된 로깅 | ✅ |
| Error Handling | 에러 타입 체계 | ✅ |
| Event System | 이벤트 버스, pub/sub | ✅ |
| Metrics | 메트릭 수집 기반 | ✅ |
| Test Infrastructure | Mock/Stub, 픽스처 | ✅ |
| Token Budget | 토큰 예산 관리 | ✅ |
| Error Recovery | Retry, Circuit Breaker | ✅ |

---

## Phase 1: Core Agents ✅ COMPLETED

> 핵심 에이전트 구현

| Feature | Description | Status |
|---------|-------------|--------|
| Base Agent | 에이전트 기반 클래스 | ✅ |
| Coder Agent | 코드 생성/수정 | ✅ |
| Reviewer Agent | 코드 리뷰 | ✅ |
| Repo Manager | 저장소 관리 | ✅ |
| Agent Manager | 에이전트 조율 | ✅ |
| LLM Integration | Claude, OpenAI, Gemini | ✅ |

---

## Phase 2: Workflow ✅ COMPLETED

> 워크플로우 엔진

| Feature | Description | Status |
|---------|-------------|--------|
| Workflow Engine | 워크플로우 실행 | ✅ |
| State Machine | 상태 관리 | ✅ |
| Step Executor | 스텝 실행 | ✅ |
| Progress Tracker | 진행률 추적 | ✅ |
| Rollback Manager | 롤백 관리 | ✅ |
| Workflow Templates | 템플릿 정의 | ✅ |

---

## Phase 3: Tools & Hooks ✅ COMPLETED

> 도구 및 훅 시스템

| Feature | Description | Status |
|---------|-------------|--------|
| Tool Registry | 도구 등록/관리 | ✅ |
| LSP Tools | Language Server Protocol | ✅ |
| AST-Grep | AST 기반 코드 변환 | ✅ |
| Git Tools | Git 명령어 | ✅ |
| Shell Tools | Shell 실행 | ✅ |
| File Tools | 파일 작업 | ✅ |
| MCP Integration | Model Context Protocol | ✅ |
| Hook System | 훅 레지스트리 | ✅ |
| Session Recovery | 세션 복구 훅 | ✅ |

---

## Phase 4: Advanced Features ✅ COMPLETED

> 고급 기능 및 최적화

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Team System | 팀 에이전트 리팩토링 | ✅ | P0 |
| Test Coverage 70% | 테스트 커버리지 향상 | ✅ 77.5% | P1 |
| CLI LLM Integration | CLI 기반 LLM 연동 | ✅ | P1 |
| Document Queue | 문서 기반 작업 큐 | ✅ | P1 |
| Quality Metrics | 실제 품질 측정 | ✅ | P2 |
| Output Optimizer | 출력 최적화 | ✅ | P2 |
| CLAUDE.md Parser | 설정 파일 파서 | ✅ | P2 |
| MCP Config Schema | .mcp.json 스키마 | ✅ | P2 |

### CLI LLM Integration Details

| CLI | Version | Status |
|-----|---------|--------|
| claude | 2.1.4+ | ✅ Implemented |
| codex | 0.76.0+ | ✅ Implemented |
| gemini | 0.22.5+ | ✅ Implemented |
| ollama | 0.13.5+ | ✅ Implemented |

---

## Phase 5: Platform 📋 PLANNED

> 멀티 플랫폼 지원

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| API Server | Fastify REST/WS API | ✅ 구현완료 | P0 |
| Desktop App | Tauri 기반 데스크톱 | ✅ 스캐폴딩 | P3 |
| Web Dashboard | Vite+React 웹 인터페이스 | ✅ 스캐폴딩 | P3 |
| Team Collaboration | 팀 협업 기능 | 📋 Planned | P4 |
| Multi-Project | 멀티 프로젝트 관리 | 📋 Planned | P4 |
| SaaS Features | 클라우드 서비스 | 📋 Planned | P4 |

### API Server Details

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| /api/health | GET | 서버 상태 확인 | ✅ |
| /api/agents | GET/POST | 에이전트 관리 | ✅ |
| /api/agents/:id | GET/PATCH/DELETE | 에이전트 상세 | ✅ |
| /api/workflows | GET/POST | 워크플로우 관리 | ✅ |
| /api/tools | GET/POST | 도구 관리 | ✅ |
| /api/hooks | GET/POST | 훅 관리 | ✅ |
| /api/dashboard/stats | GET | 대시보드 통계 | ✅ |
| /api/projects | GET/POST | 프로젝트 관리 | ✅ |
| /api/logs | GET | 로그 조회 | ✅ |
| ws://localhost:3002 | - | WebSocket 실시간 | ✅ |

### 실행 방법

```bash
# API 서버 시작 (개발 모드)
npm run dev:api

# 웹 대시보드 시작
cd web && npm run dev

# 데스크톱 앱 시작
cd desktop && npm run tauri:dev
```

---

## Priority Legend

| Priority | Label | Description |
|----------|-------|-------------|
| P0 | 🔴 Critical | 프로젝트 진행 필수 |
| P1 | 🟠 High | 핵심 기능, 초기 릴리스 필수 |
| P2 | 🟡 Medium | 중요하지만 지연 가능 |
| P3 | 🟢 Low | Nice to have |
| P4 | 🔵 Future | 향후 고려 |

---

## Success Metrics

### Technical
- 문서 → 코드 자동화율: 90%+
- 코드 리뷰 자동 통과율: 80%+
- 테스트 커버리지: 70%+ ✅ (현재 77.5%)
- 빌드 성공률: 95%+

### Business
- 개발 시간 단축: 3-5배
- 버그 감소율: 60%+

---

## Related Documents

- [Current Status](./STATUS.md) - 현재 진행 상황
- [Next Tasks](./NEXT_TASKS.md) - 다음 작업 리스트
- [Reference Guide](./REFERENCE.md) - 외부 참조 가이드
- [Architecture Overview](../02-architecture/OVERVIEW.md) - 아키텍처 개요
