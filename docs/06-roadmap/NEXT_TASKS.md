# 다음 작업 리스트

> 최종 수정: 2026-02-14 (Phase I 계획 수립, v3.0 실전 품질 & 생태계)

---

## Phase B: 프로덕션 준비 (v1.0-alpha) ✅ COMPLETED

> B-1 ~ B-6, B-docker 모두 완료. 상세는 ROADMAP.md 참조.

---

## Phase C: 기능 확장 (v1.0-beta) ✅ COMPLETED

> C-1 ~ C-4 모두 완료.

### 구현 결과

| 모듈 | 상태 | 생성 파일 | 테스트 |
|------|------|-----------|--------|
| C-1 MCP 도구 실전 연동 | ✅ | MCPConnectionManager (365줄), presets/index.ts, config 스키마 | 28 tests |
| C-2 병렬 실행 통합 | ✅ | AgentPool↔ParallelExecutor wiring, Runner API, 이벤트 | 17 tests |
| C-3 Evals 모듈 | ✅ | EvalRunner, EvalReporter, 3 definitions | 25 tests |
| C-4 LSP 실전 통합 | ✅ | DocumentSync, SymbolCache, LSPConnectionManager, RefactorEngine | 37 tests (new) |

---

## Phase D: 플랫폼 확장 (v1.0 GA) ✅ COMPLETED

> D-1 ~ D-5 + B-4 모두 완료.

### 구현 결과

| 모듈 | 상태 | 생성 파일 | 테스트 |
|------|------|-----------|--------|
| D-1 인스틴트 공유 | ✅ | InstinctBundleExporter, InstinctBundleImporter, 3 API endpoints | 23 tests |
| D-2 팀 협업 | ✅ | CollaborationHub, 6 API endpoints | 43 tests |
| D-3 멀티 프로젝트 | ✅ | ProjectManager, workspace index 갱신 | 34 tests |
| D-4 SaaS 기능 | ✅ | TenantManager, BillingManager, saas barrel | 45 tests |
| D-5 사용량 분석 | ✅ | UsageTracker, CostReporter, 2 API endpoints | 39 tests |
| B-4 GitHub 연동 | ✅ | GitHubClient (Octokit 래핑), types, ServiceRegistry 통합 | 37 tests |

---

## 추가 개선 항목 (Backlog) ✅ COMPLETED

> E-1 ~ E-4 모두 완료.

### 구현 결과

| 모듈 | 상태 | 생성 파일 | 테스트 |
|------|------|-----------|--------|
| E-1 Loop Detection | ✅ | LoopDetector (circular buffer, 3 detection strategies) | 41 tests |
| E-2 AST-Grep 통합 | ✅ | ASTGrepClient, 5 presets, YAML rule builder | 29 tests |
| E-3 IDE 연동 | ✅ | IDEBridge (JSON-RPC 2.0), IDECommandRegistry | 55 tests |
| E-4 DB 퍼시스턴스 | ✅ | InMemoryDBClient, MigrationEngine, PersistenceAdapter | 70 tests |

---

## Phase F: 품질 심화 & 생태계 확장 (v1.1) ✅ COMPLETED

> F-1 ~ F-12 모두 완료. 254 suites, 4,745 tests.

### Sprint 1: 품질 기반

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| F-1 | 문서 현행화 | ✅ | 경쟁 분석 갱신, NEXT_TASKS 업데이트 | — |
| F-2 | E2E 통합 테스트 | ✅ | 5 E2E 테스트 파일 (ServiceRegistry, Orchestrator, ACP, Hook, Skill) | 106 tests |
| F-3 | Eval 확장 (3→13) | ✅ | 10 new eval definitions, ALL_EVAL_DEFINITIONS | 39 tests |

### Sprint 2: 기능 확장

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| F-4 | 추가 LLM 프로바이더 (4→10) | ✅ | Mistral, xAI, Groq, Together, DeepSeek, Fireworks 클라이언트 | 87 tests |
| F-5 | 인스틴트→스킬 자동 변환 | ✅ | InstinctToSkillConverter, InstinctDerivedSkill | 37 tests |
| F-6 | 7-Phase 워크플로우 | ✅ | SevenPhaseWorkflow, DEFAULT_PHASE_DEFINITIONS, PhaseExecutor | 37 tests |

### Sprint 3: 프로토콜 확장

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| F-7 | A2A 프로토콜 | ✅ | A2AGateway, A2ARouter, types, ACP 브릿지 | 35 tests |
| F-8 | MCP OAuth | ✅ | OAuthManager, PKCE, types, auto-refresh | 49 tests |
| F-9 | Windows 샌드박스 | ✅ | WindowsSandbox, platform factory 업데이트 | 36 tests |

### Sprint 4: 플랫폼 생태계

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| F-10 | Headless CI/CD 모드 | ✅ | HeadlessRunner, CIDetector (4 providers), OutputFormatter (3 formats) | 49 tests |
| F-11 | 플러그인 마켓플레이스 | ✅ | PluginPackager, MarketplaceRegistry (publish/search/install) | 70 tests |
| F-12 | Desktop App | ✅ | IPCBridge, WindowManager, SystemTray, DesktopApp orchestrator | 106 tests |

---

## Phase G: 실전 품질 강화 & 통합 완성 (v2.0) ✅ COMPLETED

> G-1 ~ G-16 모두 완료. 276 suites, 5,313+ tests.

### Sprint 1: 파이프라인 실연결

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| G-1 | Hook↔Orchestrator 실연결 | ✅ | HookExecutor → OrchestratorRunner.executeGoal() pre/post goal/task 호출 | 8 tests |
| G-2 | Validation↔Agent 실연결 | ✅ | ConfidenceChecker, StubDetector, GoalBackwardVerifier 에이전트 후처리 연결 | 8 tests |
| G-3 | Learning↔Session 실연결 | ✅ | ReflexionPattern 자동 학습, InstinctStore 세션 시작 시 패턴 로드 | 8 tests |
| G-4 | Context↔LLM 실연결 | ✅ | TokenBudgetManager LLM 호출 전 체크, CompactionStrategy 자동 실행 | 8 tests |

### Sprint 2: 런타임 통합 강화

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| G-5 | ServiceRegistry 완전 초기화 | ✅ | 6개 모듈 확장 (MCP, Parallel, Eval, Instinct, Collaboration, Project) | 12 tests |
| G-6 | Error Recovery 파이프라인 | ✅ | ErrorEscalator → ReflexionPattern → InstinctStore → retry/fallback 체인 | 10 tests |
| G-7 | Config 통합 검증 | ✅ | RunnerConfigSchema 16개 신규 필드, env 변수 매핑, 기본값 검증 | 10 tests |
| G-8 | CLI 완전 통합 | ✅ | `runner headless <goal>` 서브커맨드, HeadlessRunner 연동 | 8 tests |

### Sprint 3: 테스트 & 커버리지 강화

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| G-9 | 통합 테스트 강화 | ✅ | Hook→Validation→Learning→Context 전체 파이프라인 통합 테스트 | 30 tests |
| G-10 | 커버리지 갭 해소 | ✅ | Dashboard API, Config, Ollama, Claude CLI 등 주요 모듈 97-100% 달성 | 142 tests |
| G-11 | 성능 벤치마크 | ✅ | BenchmarkRunner 10개 기준선, 회귀 감지 자동화 | 67 tests |
| G-12 | 보안 감사 | ✅ | PermissionManager, 네트워크 격리, JWT 검증, .env.local 갭 발견 | 95 tests |

### Sprint 4: 문서화 & 릴리스

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| G-13 | API 문서 자동 생성 | ✅ | OpenAPI 3.0 스펙, Swagger UI, 모든 REST endpoint 문서화 | — |
| G-14 | 경쟁 분석 v3 | ✅ | Phase F/G 반영, 기능 비교표 업데이트 | — |
| G-15 | ROADMAP v3 | ✅ | Phase G 완료 반영, v2.0 메트릭, Phase H 계획 | — |
| G-16 | 릴리스 자동화 | ✅ | npm publish, GitHub Release, Docker Hub 자동화 스크립트 | — |

---

## Phase H: 고급 자율성 & AI 네이티브 (v2.1) ✅ COMPLETED

> H-1 ~ H-8 모두 완료. 286 suites, 5,883 tests.

### Sprint 1: 자율 에이전트 기반

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| H-1 | 자율 디버깅 루프 | ✅ | HypothesisGenerator (10 error patterns), DebuggingLoop (diagnose→hypotheses→test→learn) | 39 tests |
| H-2 | 멀티 에이전트 협업 | ✅ | FeedbackLoop, CollaborationManager (register/delegate/feedback/conflict resolution) | 50 tests |
| H-3 | RAG 기반 코드 검색 | ✅ | CodeChunkStrategy, LocalEmbeddingEngine (n-gram hashing), InMemoryVectorStore, RAGOrchestrator | 44 tests |
| H-4 | 적응형 프롬프트 | ✅ | FeedbackTracker, PromptOptimizer, A/B Testing framework | 53 tests |

### Sprint 2: AI 네이티브 기능

| # | 작업 | 상태 | 생성 파일 | 테스트 |
|---|------|------|-----------|--------|
| H-5 | 멀티 모달 지원 | ✅ | ImageAnalyzer, UICodeGenerator (React), MultimodalProcessor | 86 tests |
| H-6 | 자연어 테스트 생성 | ✅ | RequirementParser, TestCaseGenerator, TestCodeEmitter (Jest/Mocha/Vitest) | 47 tests |
| H-7 | Git 지능형 워크플로우 | ✅ | BranchStrategist (7 strategies), ConflictResolver, PRReviewer | 69 tests |
| H-8 | 실시간 페어 프로그래밍 | ✅ | CursorSync, SuggestionManager, PairSessionManager | 60 tests |

---

## Phase I: 실전 품질 & 생태계 (v3.0) ✅ COMPLETED

> Phase I 전체 완료. 코드 품질 안정화, 실전 LLM 통합, IDE 생태계, 벡터 검색 & 생태계 구축.

### 현재 상태

| 지표 | 값 |
|------|-----|
| 테스트 | 6,353 (302 suites) + 116 integration |
| 커버리지 | 90.62%+ |
| TypeScript | ✅ Clean |
| ESLint | ✅ 0 errors |
| 소스 | 440+ 파일, 72,000+ LOC |

### 핵심 갭 분석

| 갭 | 심각도 | 현황 |
|----|--------|------|
| 모든 LLM 테스트가 mock 기반 | 🔴 HIGH | 5,883 tests 전부 mock. 실제 API 검증 0건 |
| IDE 확장 미출시 | 🔴 HIGH | IDEBridge JSON-RPC 존재, VS Code 확장 없음 |
| 프로덕션 배포 경험 없음 | 🔴 HIGH | Docker Compose 있으나 실행 이력 0 |
| RAG가 n-gram 해싱 | 🟡 MED | 진정한 벡터 임베딩 아님 |
| ESLint 에러 46건 | 🟡 MED | unsafe declaration merging 22건 |
| 대형 파일 리팩토링 필요 | 🟡 MED | orchestrator-runner 1,363줄 등 5개 |
| barrel export 누락 | 🟢 LOW | core/, shared/, dx/ index.ts 미존재 |
| 플러그인 생태계 0건 | 🟢 LOW | 마켓플레이스 스캐폴딩만 존재 |

### Sprint 1: 코드 품질 & 안정화 ✅ COMPLETED

| # | 작업 | 상태 | 생성/수정 파일 | 테스트 |
|---|------|------|---------------|--------|
| I-1 | ESLint 에러 해소 | ✅ | 15파일 declaration merging, require()→import, prefer-const, regex escape, any→unknown | 0→0 errors |
| I-2 | TypeScript 미사용 변수 수정 | ✅ | conflict-resolver, pr-reviewer, requirement-parser 3건 수정 | — |
| I-3 | Barrel Export 정비 | ✅ | core/index.ts (33 modules), shared/index.ts (4 modules), dx/index.ts (1 module) | 3 tests |
| I-4 | 대형 파일 리팩토링 | ✅ | TaskExecutor, RunnerLifecycle, ModuleInitializer 추출 (orchestrator-runner 1,363→858줄, service-registry 936→528줄) | 76 tests |

### Sprint 2: 실전 LLM 통합

| # | 작업 | 상태 | 설명 | 테스트 |
|---|------|------|------|--------|
| I-5 | LLM Integration Test Framework | ✅ | 4 helpers + 3 test files, describeIntegration/describeProvider 패턴, dry-run 지원 | 24 tests |
| I-6 | Claude/OpenAI 실 API 검증 | ✅ | 토큰 카운팅, 에러 핸들링, 멀티턴, JSON 출력, rate limit (42 tests) | 42 tests |
| I-7 | LLM Resilience 테스트 | ✅ | timeout, error recovery, large payload, concurrent safety (5 categories) | 30 tests |
| I-8 | Model Router 실전 검증 | ✅ | single/multi-provider routing, cost tracking, strategy switching, failover | 20 tests |

### Sprint 3: IDE 생태계

| # | 작업 | 상태 | 설명 | 테스트 |
|---|------|------|------|--------|
| I-9 | VS Code Extension 코어 | ✅ | ACAClient, StatusBar, TreeProviders, 6 commands, vscode mock | 58 tests |
| I-10 | VS Code 태스크 UI | ✅ | TaskWebviewPanel, TaskDetailPanel, SSE 실시간, nonce CSP | 25 tests |
| I-11 | VS Code 마켓플레이스 배포 | ✅ | SVG 아이콘, README, CHANGELOG, .vscodeignore, launch.json, vsce 패키징 | — |
| I-12 | JetBrains 플러그인 기초 | ✅ | JSON-RPC 2.0 프로토콜, ACAJetBrainsClient, TCP 소켓, plugin.json | 41 tests |

### Sprint 4: 벡터 검색 & 생태계

| # | 작업 | 상태 | 설명 | 테스트 |
|---|------|------|------|--------|
| I-13 | 벡터 임베딩 엔진 교체 | ✅ | IEmbeddingEngine, Ollama/HuggingFace 엔진, DimensionAdapter, Factory | 36 tests |
| I-14 | 벡터 DB 통합 | ✅ | IVectorStore, QdrantAdapter, WeaviateAdapter, Factory, 비동기 전환 | 32 tests |
| I-15 | 예제 플러그인 3종 | ✅ | LintingPlugin, TestRunnerPlugin, DocumentationPlugin + 마켓플레이스 매니페스트 | 80 tests |
| I-16 | 경쟁 분석 v4 & 문서 현행화 | ✅ | v0.4.0→v2.1+ 전면 갱신, 비교표 16→28항목, 갭 해소 반영, 부록 확장 | — |

### 실제 결과

| 지표 | Phase H 후 (v2.1) | Phase I 후 (v3.0) |
|------|-------------|-------------------|
| 테스트 | 5,883 (286 suites) | 6,353 (302 suites) + 116 integration |
| ESLint 에러 | 46 | 0 |
| 실 API 테스트 | 0 | 116 (6 suites, dry-run skip) |
| IDE 확장 | 0 | VS Code 1개 (7 commands, webview) + JetBrains JSON-RPC |
| 벡터 검색 | n-gram 해싱 | Ollama + HuggingFace 임베딩, Qdrant + Weaviate DB |
| 플러그인 생태계 | 0개 | 예제 3종 (린팅/테스트/문서, 80 tests) |
| 경쟁 분석 | v3 (Phase G 기준) | v4 (Phase H 반영, 28항목 비교) |
