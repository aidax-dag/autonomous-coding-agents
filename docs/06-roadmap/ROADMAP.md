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
Phase D: Platform Expansion          ─── ✅ COMPLETED
    ↓
Phase E: Backlog Enhancements         ─── ✅ COMPLETED
    ↓
Phase F: Quality & Ecosystem (v1.1)   ─── ✅ COMPLETED
    ↓
Phase G: Integration & v2.0           ─── ✅ COMPLETED
    ↓
Phase H: Advanced Autonomy (v2.1)     ─── ✅ COMPLETED
    ↓
Phase I: Quality & Ecosystem (v3.0)    ─── ✅ COMPLETED
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

## Phase D: Platform Expansion ✅ COMPLETED

| # | Task | Status | Description |
|---|------|--------|-------------|
| D-1 | 인스틴트 공유 | ✅ | InstinctBundleExporter/Importer, 3 API endpoints |
| D-2 | 팀 협업 | ✅ | CollaborationHub, SSE, 6 API endpoints |
| D-3 | 멀티 프로젝트 | ✅ | ProjectManager, workspace index |
| D-4 | SaaS 기능 | ✅ | TenantManager, BillingManager |
| D-5 | 사용량 분석 | ✅ | UsageTracker, CostReporter |

---

## Backlog Enhancements (E) ✅ COMPLETED

| # | Task | Status | Description |
|---|------|--------|-------------|
| E-1 | Loop Detection | ✅ | LoopDetector, 3 detection strategies |
| E-2 | AST-Grep 통합 | ✅ | ASTGrepClient, 5 presets |
| E-3 | IDE 연동 | ✅ | IDEBridge (JSON-RPC 2.0) |
| E-4 | DB 퍼시스턴스 | ✅ | InMemoryDBClient, MigrationEngine |

---

## Phase F: Quality & Ecosystem (v1.1) ✅ COMPLETED

| Sprint | Tasks | Description |
|--------|-------|-------------|
| Sprint 1 | F-1~F-3 | 문서 현행화, E2E 통합 테스트 106개, Eval 확장 3→13 |
| Sprint 2 | F-4~F-6 | LLM 프로바이더 4→10, 인스틴트→스킬 변환, 7-Phase 워크플로우 |
| Sprint 3 | F-7~F-9 | A2A 프로토콜, MCP OAuth, Windows 샌드박스 |
| Sprint 4 | F-10~F-12 | Headless CI/CD, 플러그인 마켓플레이스, Desktop App |

---

## Phase G: Integration & Production (v2.0) ✅ COMPLETED

| Sprint | Tasks | Description |
|--------|-------|-------------|
| Sprint 1 | G-1~G-4 | 파이프라인 실연결 (Hook↔Orchestrator, Validation↔Agent, Learning↔Session, Context↔LLM) |
| Sprint 2 | G-5~G-8 | 런타임 통합 (ServiceRegistry 6모듈 확장, Error Recovery 체인, Config 16필드, CLI headless) |
| Sprint 3 | G-9~G-12 | 테스트 강화 (Integration 30, Coverage 142, Benchmark 67, Security 95) |
| Sprint 4 | G-13~G-16 | 문서화 & 릴리스 (API Docs, 경쟁분석 v3, ROADMAP v3, 릴리스 자동화) |

---

## Phase H: 고급 자율성 & AI 네이티브 (v2.1) ✅ COMPLETED

| Sprint | Tasks | Description |
|--------|-------|-------------|
| Sprint 1 | H-1~H-4 | 자율 디버깅 루프, 멀티 에이전트 협업, RAG 기반 코드 검색, 적응형 프롬프트 |
| Sprint 2 | H-5~H-8 | 멀티 모달 지원, 자연어 테스트 생성, Git 지능형 워크플로우, 실시간 페어 프로그래밍 |

---

## Phase I: 실전 품질 & 생태계 (v3.0) ✅ COMPLETED

| Sprint | Tasks | Description |
|--------|-------|-------------|
| Sprint 1 | I-1~I-4 | 코드 품질 안정화 (ESLint 0, TypeScript Clean, Barrel Export, 대형 파일 리팩토링) |
| Sprint 2 | I-5~I-8 | 실전 LLM 통합 (Integration Test Framework 116 tests, 실 API 검증, Resilience, Model Router) |
| Sprint 3 | I-9~I-12 | IDE 생태계 (VS Code Extension 7 commands + webview, 마켓플레이스 배포, JetBrains JSON-RPC) |
| Sprint 4 | I-13~I-16 | 벡터 검색 & 생태계 (Ollama/HuggingFace 임베딩, Qdrant/Weaviate DB, 예제 플러그인 3종, 경쟁 분석 v4) |

---

## Success Metrics

### Technical
- 테스트 커버리지: ~90%+ ✅ (목표: 70%+)
- 테스트 수: 6,353 (302 suites) + 116 integration tests
- 소스 코드: 72,000+ LOC (440+ 파일)
- TypeScript strict mode: ✅ Clean
- 코드 조직: SOLID 원칙 + DI 패턴
- LLM 프로바이더: 10개 (Claude, OpenAI, Gemini, Ollama, Mistral, xAI, Groq, Together, DeepSeek, Fireworks)
- AI 네이티브 모듈: 8개 (debugging, collaboration, RAG, adaptive-prompts, multimodal, test-gen, git-workflow, pair-programming)
- 성능 기준선: 10개 벤치마크 (LLM 응답, 파이프라인, 컨텍스트 압축, 에이전트 초기화 등)
- 보안 감사 테스트: 95개 (권한, 네트워크 격리, JWT, .env.local 갭 발견)

### Operational
- Docker Compose 단일 명령 배포
- JWT 기반 인증 + API 키 (CI/CD)
- Rate limiting + CORS 보안
- 실시간 모니터링 (HUD + SSE)
- Headless CI/CD 모드 (GitHub Actions, GitLab CI, Jenkins, CircleCI)
- 플러그인 마켓플레이스 (패키징, 검색, 설치)
- Desktop App (IPC, 윈도우 관리, 시스템 트레이)
- 릴리스 자동화 (npm publish, GitHub Release, Docker Hub)

---

## Related Documents

- [Current Status](./STATUS.md) - 현재 진행 상황
- [Next Tasks](./NEXT_TASKS.md) - 다음 작업 리스트
- [Architecture Overview](../02-architecture/OVERVIEW.md) - 아키텍처 개요
