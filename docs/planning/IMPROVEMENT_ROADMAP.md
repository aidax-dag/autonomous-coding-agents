# CodeAvengers Improvement Roadmap

> 이 문서는 프로젝트 개선 작업의 영속적 참조 문서입니다.
> 작업 진행 시 이 문서를 업데이트하고, 새 세션에서는 이 문서를 먼저 참조하세요.

**최종 업데이트**: 2026-01-11
**현재 상태**: 실제 LLM 통합 완료 ✅

---

## 1. 프로젝트 비전

### 1.1 목표
```
"에이전트들만으로 프로덕트 빌딩하는 팀을 재현하고,
프로덕트가 완료될 때까지 자동으로 움직이는 조직을 신설한다"
```

### 1.2 핵심 차별화
| 기존 도구 (oh-my-opencode 등) | CodeAvengers 목표 |
|------------------------------|------------------|
| Human-in-the-loop 필수 | 최소 인간 개입 |
| 세션 기반 실행 | 24/7 데몬 실행 |
| 단일 프로젝트 | 멀티 프로젝트 관리 |
| 수동 트리거 | 완료까지 자동 진행 |
| 컨텍스트 휘발 | 영속적 메모리 |

---

## 2. 현재 상태 분석 (2026-01-11 업데이트)

### 2.1 이미 구현된 것 (✅)

#### Core Infrastructure (~9000 lines)
```
src/core/orchestrator/
├── orchestrator-service.ts  ✅ 875 lines
│   - Task routing (5가지 전략: round-robin, least-loaded, random, capability, priority)
│   - Agent selection 로직
│   - Task queue 관리
│   - Health check
│   - Event emission
└── index.ts                 ✅

src/core/workflow/
├── workflow-engine.ts       ✅ 1333 lines - 워크플로우 실행 엔진
├── state-machine.ts         ✅ 911 lines - 상태 머신
├── step-executor.ts         ✅ 717 lines - 스텝 실행기
├── workflow-definition.ts   ✅ 1175 lines - 워크플로우 정의
├── progress-tracker.ts      ✅ 1421 lines - 진행률 추적
├── rollback-manager.ts      ✅ 1221 lines - 롤백 관리
├── workflow-templates.ts    ✅ 997 lines - 템플릿
└── index.ts                 ✅
```

#### Tools Layer
```
src/core/tools/
├── lsp/        ✅ Language Server Protocol
├── ast-grep/   ✅ AST 기반 코드 검색/변환
├── git/        ✅ Git 명령어
├── shell/      ✅ Shell 실행 (7개 도구)
├── file/       ✅ 파일 작업 (10개 도구)
├── mcp/        ✅ Model Context Protocol
└── web-search/ ✅ 웹 검색
```

#### Agents & LLM
```
src/core/agents/   ✅ Base agent 구현
src/agents/        ✅ LLM 클라이언트 (Claude, Gemini, OpenAI)
```

#### Recovery & Session
```
src/core/hooks/session-recovery/  ✅ 세션 복구 훅
src/dx/error-recovery/            ✅ 에러 복구 구현
```

### 2.2 새로 구현된 컴포넌트 (✅ NEW)

```
src/core/orchestrator/task-decomposer.ts  ✅ ~850 lines (53 tests)
├── PRD 문서 파싱 및 분석
├── 기능별 태스크 분해
├── 의존성 그래프 생성 (순환 감지 포함)
├── 위상 정렬 기반 실행 순서 결정
└── 병렬화 가능한 실행 계획 생성

src/core/memory/project-store.ts  ✅ ~700 lines (38 tests)
├── 프로젝트 상태 영속화 (FileSystem/InMemory)
├── 세션 간 컨텍스트 유지
├── 체크포인트/롤백 지원
├── 태스크 진행 상황 추적
├── 결정/인사이트/블로커 기록
└── 이벤트 기반 알림 시스템

src/core/daemon/daemon.ts  ✅ ~750 lines (28 tests)
├── 24/7 실행 루프
├── 멀티 프로젝트 관리
├── 태스크 폴링 및 스케줄링
├── 에이전트 디스패치 (추상 인터페이스)
├── 에러 복구 및 재시도
└── 헬스 모니터링

src/core/quality/completion-detector.ts  ✅ ~730 lines (49 tests)
├── 프로젝트 완료 판단 (CompletionStatus)
├── 스펙 대비 검증 (validateAgainstSpec)
├── 품질 게이트 (MINIMAL, STANDARD, STRICT, ENTERPRISE)
├── 품질 차원별 검사 (Task, Criteria, Test, Code, Doc, Security, Performance)
├── 이벤트 기반 알림 시스템
└── 권장 사항 생성

src/core/runner/autonomous-runner.ts  ✅ ~760 lines (27 tests)
├── 전체 컴포넌트 통합 서비스
├── PRD에서 프로젝트 생성 (createProject, runProjectFromPRD)
├── 프로젝트 라이프사이클 관리 (start, stop, pause, resume)
├── LLM 기반 에이전트 디스패처 (LLMAgentDispatcher)
├── 품질 게이트 연동
└── 멀티 프로젝트 동시 실행
```

### 2.3 핵심 컴포넌트 구현 현황

```
┌─────────────────────────────────────────────────────────────┐
│            ALL CORE + INTEGRATION COMPLETE ✅                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ TaskDecomposer        (~850 lines, 53 tests)            │
│  ✅ ProjectStore          (~700 lines, 38 tests)            │
│  ✅ Daemon                (~750 lines, 28 tests)            │
│  ✅ CompletionDetector    (~730 lines, 49 tests)            │
│  ✅ AutonomousRunner      (~760 lines, 27 tests) [NEW]      │
│                                                              │
│  Total: ~3790 lines of core code, 195 tests                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 구현 우선순위 (재정의)

### Priority 1: TaskDecomposer ✅ 완료
- **구현 파일**: `src/core/orchestrator/task-decomposer.ts`
- **테스트**: `tests/unit/core/orchestrator/task-decomposer.test.ts` (53 tests)
- **주요 기능**: PRD 분석, 태스크 분해, 의존성 그래프, 실행 계획

### Priority 2: ProjectStore ✅ 완료
- **구현 파일**: `src/core/memory/project-store.ts`
- **테스트**: `tests/unit/core/memory/project-store.test.ts` (38 tests)
- **주요 기능**: 상태 영속화, 체크포인트, 컨텍스트 관리, 태스크 추적

### Priority 3: Daemon ✅ 완료
- **구현 파일**: `src/core/daemon/daemon.ts`
- **테스트**: `tests/unit/core/daemon/daemon.test.ts` (28 tests)
- **주요 기능**: 24/7 실행, 태스크 폴링, 에이전트 디스패치, 헬스 모니터링

### Priority 4: CompletionDetector ✅ 완료
- **구현 파일**: `src/core/quality/completion-detector.ts`
- **테스트**: `tests/unit/core/quality/completion-detector.test.ts` (49 tests)
- **주요 기능**: 완료 검사, 스펙 검증, 품질 게이트 평가

---

## 4. 진행 상황 로그

### 2026-01-11 (Session 5)
- [x] 실제 LLM 클라이언트 통합 완료
- [x] `SharedLLMClientAdapter` - shared LLM 클라이언트와 core 인터페이스 연결
- [x] `createRealLLMClient()` - 실제 LLM 클라이언트 생성
- [x] `createAutonomousRunnerByProvider()` - 프로바이더별 Runner 생성
- [x] CLI에 `--provider` 옵션 추가 (claude|openai|gemini|mock)
- [x] CLI에 `--model` 옵션 추가 (모델 선택)
- [x] 총 테스트: 223개 (모든 테스트 통과)

### 2026-01-11 (Session 4)
- [x] CLI 인터페이스 구현 완료 (~450 lines, 28 tests)
- [x] `runner create` - PRD에서 프로젝트 생성
- [x] `runner run` - 프로젝트 실행
- [x] `runner status` - 프로젝트 상태 조회
- [x] `runner stop/pause/resume` - 프로젝트 제어
- [x] 기존 CLI (`multi-agent`)와 통합
- [x] 총 테스트: 223개 (195 + 28 CLI tests)
- [x] 실제 PRD로 E2E 테스트 완료 (아래 상세 내용)

#### E2E Test Results (실제 PRD 테스트)
**Test PRD**: Todo App (Task Management + Data Persistence + Task Filtering)

**Create Command**:
```bash
multi-agent runner create test-prd.md --mock
# Result: 3 features, 25 tasks extracted successfully
```

**Run Command**:
```bash
multi-agent runner run proj_1768142027866_1_0rbmb1 --mock
# Result: 25/25 tasks completed in 30s
```

**Completion Status**: `PARTIALLY_COMPLETE`
- Task Completion: 100% (25/25) ✅
- Acceptance Criteria: 0% ❌ (Mock doesn't set metadata)
- Test Coverage: 75% (mock value) ✅

**Note**: `PARTIALLY_COMPLETE` is expected with mock client since:
1. Mock tasks don't set `metadata.acceptanceCriteria`
2. STANDARD quality gate requires acceptance criteria ≥ 70%
3. For COMPLETE status: gatePassed && score ≥ 95%

**Bug Fixed During Testing**:
- PRD parsing issue: `### Feature X` headers were being detected as new sections
- Fixed in `task-decomposer.ts:detectSectionType()` to skip `###` headers

### 2026-01-11 (Session 3)
- [x] AutonomousRunner 통합 서비스 구현 완료 (~760 lines, 27 tests)
- [x] LLMAgentDispatcher 구현 (IAgentDispatcher 인터페이스)
- [x] MockLLMClient 테스트 헬퍼 구현
- [x] createMockAutonomousRunner 팩토리 함수
- [x] 모든 핵심 컴포넌트 통합 완료 (195 tests total)
- [x] 통합 테스트 작성 및 검증

### 2026-01-11 (Session 2)
- [x] CompletionDetector 구현 완료 (~730 lines, 49 tests)
- [x] 품질 게이트 시스템 (MINIMAL, STANDARD, STRICT, ENTERPRISE)
- [x] 품질 차원별 검사 (7개 차원)
- [x] 스펙 대비 검증 기능
- [x] 모든 핵심 컴포넌트 구현 완료 (168 tests total)

### 2026-01-11 (Session 1)
- [x] TaskDecomposer 구현 완료 (~850 lines, 53 tests)
- [x] ProjectStore 구현 완료 (~700 lines, 38 tests)
- [x] Daemon 구현 완료 (~750 lines, 28 tests)
- [x] CompletionDetector 구현 시작

### 2025-01-11
- [x] 프로젝트 비교 분석 완료 (oh-my-opencode vs CodeAvengers)
- [x] 개선 로드맵 문서 작성
- [x] 기존 구현 상태 파악 (Orchestrator, Workflow 이미 ~9000 lines 구현됨)
- [x] 진짜 미구현 컴포넌트 식별 (TaskDecomposer, ProjectStore, Daemon, CompletionDetector)

---

## 5. 파일 위치 요약

```
src/core/
├── orchestrator/
│   ├── orchestrator-service.ts  ✅ 구현됨
│   ├── task-decomposer.ts       ✅ 구현됨 (NEW)
│   └── index.ts
├── memory/                      ✅ 구현됨 (NEW)
│   ├── project-store.ts         ✅ 구현됨
│   └── index.ts
├── daemon/                      ✅ 구현됨 (NEW)
│   ├── daemon.ts                ✅ 구현됨
│   └── index.ts
├── quality/                     ✅ 구현됨 (NEW)
│   ├── completion-detector.ts   ✅ 구현됨
│   └── index.ts
├── runner/                      ✅ 구현됨 (NEW - 통합 서비스)
│   ├── autonomous-runner.ts     ✅ 구현됨
│   └── index.ts
└── workflow/                    ✅ 구현됨
    ├── workflow-engine.ts
    ├── state-machine.ts
    └── ...

src/cli/
├── index.ts              ✅ 기존 CLI + runner 통합
└── autonomous.ts         ✅ 구현됨 (NEW - Runner CLI)

tests/
├── unit/core/
│   ├── orchestrator/task-decomposer.test.ts  (53 tests)
│   ├── memory/project-store.test.ts          (38 tests)
│   ├── daemon/daemon.test.ts                 (28 tests)
│   └── quality/completion-detector.test.ts   (49 tests)
├── unit/cli/
│   └── autonomous.test.ts                    (28 tests)
└── integration/core/
    └── runner/autonomous-runner.test.ts      (27 tests)
```

---

## 6. 다음 세션 시작 시 체크리스트

```bash
# 1. 이 문서 먼저 읽기
cat docs/planning/IMPROVEMENT_ROADMAP.md

# 2. 테스트 상태 확인
npm test -- --testPathPattern="task-decomposer|project-store|daemon|completion-detector|autonomous-runner|cli/autonomous" --no-coverage --forceExit
# 예상 결과: 53 + 38 + 28 + 49 + 27 + 28 = 223 tests passing

# 3. CLI 사용법
# Mock 클라이언트 (테스트용)
multi-agent runner create <prd-file> --mock  # PRD에서 프로젝트 생성
multi-agent runner run <project-id> --mock   # 프로젝트 실행

# 실제 LLM (API 키 필요)
ANTHROPIC_API_KEY=sk-xxx multi-agent runner create <prd-file> -p claude  # Claude 사용
OPENAI_API_KEY=sk-xxx multi-agent runner create <prd-file> -p openai     # OpenAI 사용

# 상태 및 제어
multi-agent runner status <project-id>       # 상태 조회
multi-agent runner stop <project-id>         # 중지

# 4. 다음 작업 선택
# - 실제 LLM으로 E2E 테스트 (API 키 필요)
# - 웹훅/알림 시스템
# - 로깅 및 모니터링
# - 성능 테스트
```

---

## 7. 다음 단계 (향후 작업)

### Integration Layer ✅ 완료
```
1. ✅ LLMAgentDispatcher 구현 (LLM 클라이언트 연동)
2. ✅ AutonomousRunner 통합 서비스 (모든 컴포넌트 통합)
3. ✅ CLI 인터페이스 구현 (create, run, status, stop, pause, resume)
4. ⏳ 웹훅/알림 시스템
```

### Testing & Validation
```
1. ✅ 통합 테스트 작성 (27 tests)
2. ✅ CLI 테스트 작성 (28 tests)
3. ✅ 엔드-투-엔드 테스트 (실제 PRD로 테스트) - Mock client로 검증 완료
4. ✅ 실제 LLM 연동 구현 완료 (Claude/OpenAI/Gemini 지원)
5. ⏳ 실제 LLM으로 E2E 테스트 (API 키 필요)
6. ⏳ 성능 테스트
```

### Production Readiness
```
1. ✅ CLI 인터페이스 (create, run, status, stop, pause, resume 명령어)
2. ✅ 실제 LLM 클라이언트 통합 (Claude/OpenAI/Gemini)
3. ⏳ 로깅 및 모니터링
4. ⏳ 웹훅 알림 시스템
5. ⏳ 에러 리포팅
```

---

## 8. 참조 문서

- [VISION.md](./VISION.md) - 프로젝트 비전
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처
- [FEATURE_ROADMAP.md](./FEATURE_ROADMAP.md) - 기능 로드맵
- [oh-my-opencode orchestration-guide](https://github.com/code-yeongyu/oh-my-opencode/blob/dev/docs/orchestration-guide.md)
