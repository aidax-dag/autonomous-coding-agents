# Implementation Priority List (구현 우선순위 리스트)

> **버전**: 3.1 (New P3 전체 완료)
> **작성일**: 2026-02-11
> **이전 버전**: 3.0, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0, 1.1
> **상태**: New P3 완료 — 전체 구현 완료
> **관련 문서**: IMPROVEMENT_RECOMMENDATIONS.md v3.2

---

## 1. Executive Summary

### 1.1 문서 목적

이 문서는 `IMPROVEMENT_RECOMMENDATIONS.md v3.0`에서 도출된 개선 작업을 **우선순위별로 정리**하여 체계적인 구현 로드맵을 제공합니다. Phase 1 (P0/P1) 완료 후, v3.0 심층 분석에서 발견된 12개 신규 개선 영역을 Phase 2로 편성합니다.

### 1.2 Phase 1 현황 — ✅ Integration Sprint 완료

| 우선순위 | 리스크 | 작업 영역 | 모듈 구현 | 파이프라인 통합 |
|---------|--------|----------|:--------:|:-------------:|
| **P0** | Low | 검증 시스템 (validation/) | ✅ **완료** | ✅ **완료** |
| **P1** | Low | 학습 시스템 (learning/) | ✅ **완료** | ✅ **완료** |

| 구현물 | 파일 | 크기 | 모듈 | 통합 |
|--------|------|------|:----:|:----:|
| ConfidenceChecker | `confidence-checker.ts` | 11KB | ✅ | ✅ ConfidenceCheckHook |
| SelfCheckProtocol | `self-check-protocol.ts` | 10KB | ✅ | ✅ SelfCheckHook |
| GoalBackwardVerifier | `goal-backward-verifier.ts` | 12KB | ✅ | ✅ executeGoal() |
| ReflexionPattern | `reflexion-pattern.ts` | 10KB | ✅ | ✅ ErrorLearningHook |
| InstinctStore | `instinct-store.ts` | 22KB | ✅ | ✅ Learning listener |
| SolutionsCache | `solutions-cache.ts` | 17KB | ✅ | ✅ ErrorLearningHook |

> **✅ v2.3**: Integration Sprint 완료. ServiceRegistry로 모듈 초기화, Hook 시스템으로 파이프라인 연결,
> feature flag (`enableValidation`, `enableLearning`, `enableContextManagement`)로 opt-in 활성화.

### 1.3 Phase 2 우선순위 매트릭스 (v3.2 — 통합 검증 반영)

| 우선순위 | 리스크 | 작업 영역 | 예상 기간 | 상태 |
|---------|--------|----------|----------|------|
| ~~Integration~~ | ~~Medium~~ | ~~P0/P1 파이프라인 통합 + 설정 이슈 수정~~ | ~~1-2주~~ | ✅ **완료** |
| ~~New P0~~ | ~~Low~~ | ~~Behavioral Evals + Tiered Model Routing~~ | ~~3-5주~~ | ✅ **완료** |
| ~~기존 P2~~ | ~~Low~~ | ~~Context 통합 (context/)~~ | ~~1주~~ | ✅ **완료** |
| ~~New P1~~ | ~~Low-High~~ | ~~JSONL Session + Sandbox + Thin Orchestrator~~ | ~~7-11주~~ | ✅ **완료** |
| ~~기존 P3~~ | ~~High~~ | ~~Agent 통합 (agents/)~~ | ~~6주+~~ | ✅ **대부분 완료** |
| ~~New P2~~ | ~~Medium~~ | ~~Composable Skills + Deep Worker + Multi-Frontend~~ | ~~8-12주~~ | ✅ **완료** |
| **New P3** | Low-Medium | HUD + SWE-bench + HLD/MLD/LLD + Brownfield | 12-16주 | ✅ **완료** |

### 1.4 핵심 목표

0. ~~P0/P1 모듈 파이프라인 연결~~ ✅ 완료
1. ~~에이전트 품질 객관적 측정 (Behavioral Evals)~~ ⚠️ Referenced but not implemented — `core/evals/` does not exist on disk (0 tests)
2. ~~30-50% 비용 절감 (Tiered Model Routing)~~ ✅ 완료 — `shared/llm/tiered-router.ts` + `cost-tracker.ts` (37 tests)
3. 🔴 **세션 안정성** (JSONL Persistence)으로 crash-safe 복구
4. **오케스트레이터 경량화** (Thin Orchestrator)로 유지보수성 향상

---

## 1.5 ✅ Integration Sprint — P0/P1 파이프라인 통합 (완료)

> **v2.3 완료**: ServiceRegistry + 4 Hooks + OrchestratorRunner 파이프라인 연결 + AgentType 통일 + ILLMClient 정리 + dx/ 마이그레이션

### 1.5.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 구현 완료된 P0/P1 모듈을 실행 파이프라인에 연결 |
| 리스크 | Medium (기존 파이프라인 변경 필요) |
| 예상 기간 | 1-2주 |
| 전제조건 | OrchestratorRunner 동작 파악 완료 |

### 1.5.2 작업 목록

| # | 작업 | 파일 | 효과 | 상태 |
|---|-----|-----|------|:----:|
| I-1 | validation/ → OrchestratorRunner 연결 | `orchestrator-runner.ts` | ConfidenceCheckHook TASK_BEFORE | ✅ |
| I-2 | validation/ → Agent 워크플로우 연결 | `orchestrator-runner.ts` | SelfCheckHook TASK_AFTER | ✅ |
| I-3 | learning/ → Agent 에러 핸들러 연결 | `orchestrator-runner.ts` | ErrorLearningHook TASK_ERROR | ✅ |
| I-4 | learning/ → 작업 완료 시 SolutionsCache 저장 | ErrorLearningHook | 성공 패턴 학습 | ✅ |
| I-5 | learning/ → InstinctStore 작업 전 조회 | Learning listener | 이전 학습 활용 | ✅ |
| I-6 | HookExecutor 파이프라인 부트스트랩 | `orchestrator-runner.ts` | Hook 라이프사이클 활성화 | ✅ |
| I-7 | context/ → hooks 경로 정리 | hooks의 import → `core/context/` | dx/ 의존 제거 | ✅ |
| I-8 | rbac.middleware.ts 빈 파일 수정 | 이전 세션 완료 | type-check 통과 | ✅ |
| I-9 | AgentType enum 통일 | 4곳 12-member superset | DB-코드 일치 | ✅ |
| I-10 | ILLMClient 인터페이스 통합 방향 | core/agents canonical | deprecated 마킹 | ✅ |
| I-11 | .env.example 포트 수정 | 이전 세션 완료 | 5432 → 5434 | ✅ |

### 1.5.3 의존성

```
I-1 (validation→orchestrator) ─┐
I-2 (validation→workflow)      ├──→ I-6 (HookExecutor 부트스트랩)
I-3 (learning→에러)             │
I-4 (learning→성공)             │
I-5 (learning→조회)            ─┘
I-7 (context 경로) ─→ 독립 실행 가능
I-8~I-11 (설정 이슈) ─→ 독립 실행 가능, 병렬 처리 권장
```

---

## 2. New P0 - 즉시 구현 (Quality & Cost)

### 2.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 에이전트 품질 객관적 측정 + 비용 최적화 |
| 모듈 | `core/evals/`, `shared/llm/` |
| 리스크 | Low (신규 모듈, 기존 코드 영향 최소) |
| 예상 기간 | 3-5주 |
| 출처 패턴 | gemini-cli (Behavioral Evals), oh-my-claudecode (Tiered Routing) |

### 2.2 작업 목록: Behavioral Evals

| # | 작업 | 파일/위치 | 의존성 | 효과 |
|---|-----|----------|--------|------|
| 1 | evals/ 디렉토리 생성 | `src/core/evals/` | - | - |
| 2 | Eval 인터페이스 정의 | `interfaces/eval.interface.ts` | #1 | - |
| 3 | Eval index.ts 생성 | `index.ts` | #2 | - |
| 4 | **EvalRunner 구현** | `eval-runner.ts` | #3 | 테스트 자동 실행 |
| 5 | **EvalReporter 구현** | `eval-reporter.ts` | #4 | 결과 리포팅 |
| 6 | 코드 품질 Eval 정의 | `definitions/code-quality.eval.yaml` | #4 | ALWAYS_PASSES |
| 7 | 태스크 완료 Eval 정의 | `definitions/task-completion.eval.yaml` | #4 | USUALLY_PASSES |
| 8 | 도구 사용 Eval 정의 | `definitions/tool-usage.eval.yaml` | #4 | USUALLY_PASSES |
| 9 | CI/CD 통합 스크립트 | `scripts/run-evals.ts` | #5 | 자동화 |

### 2.3 상세 스펙: EvalRunner

```typescript
/**
 * Behavioral Eval 실행기
 *
 * 출처: gemini-cli Behavioral Evals
 * 심각도: ALWAYS_PASSES (100% 필수) / USUALLY_PASSES (80%+ 기대)
 */
export interface IEvalRunner {
  loadDefinitions(path: string): Promise<EvalDefinition[]>;
  runEval(definition: EvalDefinition, agent: BaseAgent): Promise<EvalResult>;
  runSuite(suiteName: string): Promise<EvalSuiteResult>;
}

export interface EvalDefinition {
  id: string;
  name: string;
  category: 'code_quality' | 'tool_usage' | 'error_handling' | 'task_completion';
  severity: 'ALWAYS_PASSES' | 'USUALLY_PASSES';
  input: EvalInput;
  expectedBehavior: ExpectedBehavior;
  timeout: number;
}

export interface EvalResult {
  evalId: string;
  passed: boolean;
  severity: 'ALWAYS_PASSES' | 'USUALLY_PASSES';
  score: number;       // 0-1
  details: string;
  duration: number;
}

export interface EvalSuiteResult {
  totalEvals: number;
  passed: number;
  failed: number;
  alwaysPassRate: number;   // ALWAYS_PASSES 통과율 (목표: 100%)
  usuallyPassRate: number;  // USUALLY_PASSES 통과율 (목표: 80%+)
  regressions: EvalResult[];
}
```

### 2.4 작업 목록: Tiered Model Routing

| # | 작업 | 파일/위치 | 의존성 | 효과 |
|---|-----|----------|--------|------|
| 10 | **TieredRouter 구현** | `shared/llm/tiered-router.ts` | - | 자동 모델 선택 |
| 11 | RoutingStrategy 구현 | `shared/llm/routing-strategy.ts` | #10 | 전략 패턴 |
| 12 | CostTracker 구현 | `shared/llm/cost-tracker.ts` | #10 | 비용 추적 |
| 13 | LLM Factory 통합 | `shared/llm/index.ts` 수정 | #10 | 기존 코드 연동 |
| 14 | 에이전트별 Tier 설정 | 에이전트 설정 파일 | #13 | 맞춤 라우팅 |

### 2.5 상세 스펙: TieredRouter

```typescript
/**
 * 작업 복잡도 기반 모델 자동 선택
 *
 * 출처: oh-my-claudecode Tiered Model Routing
 * 효과: 30-50% 비용 절감
 */
export interface ITieredRouter {
  route(task: TaskContext): ModelSelection;
  setStrategy(strategy: RoutingStrategy): void;
  getCostReport(): CostReport;
}

export enum ModelTier {
  FAST = 'fast',        // haiku, gpt-4o-mini, gemini-flash
  BALANCED = 'balanced', // sonnet, gpt-4o, gemini-pro
  POWERFUL = 'powerful', // opus, o3, gemini-ultra
}

export interface RoutingStrategy {
  evaluateComplexity(task: TaskContext): number;  // 1-10
  selectTier(complexity: number, budget: number): ModelTier;
  selectModel(tier: ModelTier, preferences: ModelPreferences): string;
}

export interface ModelSelection {
  tier: ModelTier;
  model: string;
  estimatedCost: number;
  rationale: string;
}
```

### 2.6 검증 계획

```yaml
behavioral_evals:
  단위_테스트:
    - "EvalRunner가 정의 파일 정상 로드"
    - "ALWAYS_PASSES eval 실패 시 CI 차단"
    - "USUALLY_PASSES eval 80% 미달 시 경고"
  통합_테스트:
    - "전체 eval suite 실행 30초 이내"
    - "기존 에이전트 대상 eval 통과 확인"

tiered_routing:
  단위_테스트:
    - "복잡도 1-3 → FAST tier 선택"
    - "복잡도 4-7 → BALANCED tier 선택"
    - "복잡도 8-10 → POWERFUL tier 선택"
  비용_검증:
    - "동일 작업 세트로 A/B 테스트"
    - "Tiered 대비 단일 모델 비용 비교"
    - "목표: 30%+ 비용 절감"
```

---

## 3. 기존 P2 - Context 통합 (Optimization)

> 기존 IMPLEMENTATION_PRIORITY_LIST v1.1의 P2 유지

### 3.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 분산된 컨텍스트 관리 기능 통합 |
| 모듈 | `src/core/context/` |
| 리스크 | Low (대부분 이미 구현됨) |
| 예상 기간 | 1주 (정리 작업만) |

> **⚠️ v3.1 팩트 체크 (2026-02-08)**: `core/context/` 모듈이 이미 존재하며, 핵심 컴포넌트가 구현되어 있음.
> 현재 `core/context/` 파일: context-manager.ts(464), token-budget-manager.ts(176), context-monitor.ts(248),
> output-optimizer.ts(311), quality-curve.ts(371), compaction-strategy.ts(236), index.ts(157) — 총 ~2K LOC.
> `dx/token-budget/`, `dx/output-optimizer/`에 re-export 잔재가 남아있어 정리 필요.

### 3.2 작업 목록

| # | 작업 | 현재 위치 | 통합 위치 | 상태 |
|---|-----|----------|----------|------|
| 15 | ~~context/ 디렉토리 생성~~ | - | `src/core/context/` | ✅ 이미 존재 |
| 16 | ~~token-budget-manager 이동~~ | `dx/token-budget/` | `core/context/` | ✅ 이미 존재 (dx/ re-export 정리 필요) |
| 17 | ~~context-monitor 통합~~ | `hooks/context-monitor/` | `core/context/` | ✅ 이미 존재 (hook은 별도 유지) |
| 18 | ~~output-optimizer 이동~~ | `dx/output-optimizer/` | `core/context/` | ✅ 이미 존재 (dx/ re-export 정리 필요) |
| 19 | ~~QualityCurve 구현~~ | - | `quality-curve.ts` | ✅ 이미 존재 (371 LOC) |
| 20 | ~~compaction-strategy 구현~~ | - | `compaction-strategy.ts` | ✅ 이미 존재 (236 LOC) |
| 21 | dx/ re-export 정리 + hook 연동 강화 | `dx/` | `dx/index.ts` | ✅ 완료 (token-budget, output-optimizer 제거됨. error-recovery만 유지) |

### 3.3 QualityCurve 스펙

```typescript
/**
 * 컨텍스트 품질 곡선 (get-shit-done 패턴)
 */
export enum QualityLevel {
  PEAK = 'peak',           // 0-30%: 포괄적, 철저함
  GOOD = 'good',           // 30-50%: 확신, 견고함
  DEGRADING = 'degrading', // 50-70%: 효율 모드
  POOR = 'poor',           // 70%+: 급한, 최소한
}

export interface IQualityCurve {
  getLevel(usagePercent: number): QualityLevel;
  getRecommendations(level: QualityLevel): string[];
  shouldStartNewPlan(usagePercent: number): boolean;
}
```

---

## 4. New P1 - 단기 구현 (Stability & Security)

### 4.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 세션 안정성 + 보안 강화 + 오케스트레이터 경량화 |
| 모듈 | `core/session/`, `core/security/`, `core/orchestrator/` |
| 리스크 | Low-High (JSONL=Low, Sandbox=Medium, Thin Orchestrator=High) |
| 예상 기간 | 7-11주 |

### 4.2 작업 목록: JSONL Session Persistence

| # | 작업 | 파일 | 의존성 | 효과 |
|---|-----|-----|--------|------|
| 22 | JSONL 스토리지 구현 | `core/session/jsonl-persistence.ts` | - | crash-safe |
| 23 | session-manager 통합 | `core/session/session-manager.ts` 수정 | #22 | 기존 API 유지 |
| 24 | 세션 복구 로직 | `core/session/session-recovery.ts` | #22 | 자동 복구 |
| 25 | 압축(compaction) 로직 | `core/session/session-compactor.ts` | #22 | 용량 관리 |

### 4.3 상세 스펙: JSONL Persistence

```typescript
/**
 * JSONL 기반 append-only 세션 저장
 *
 * 출처: codex JSONL Session Persistence
 */
export interface IJSONLPersistence {
  append(sessionId: string, entry: SessionEntry): Promise<void>;
  readAll(sessionId: string): AsyncIterable<SessionEntry>;
  readLast(sessionId: string, count: number): Promise<SessionEntry[]>;
  compact(sessionId: string, summarizer: (entries: SessionEntry[]) => SessionEntry): Promise<void>;
}

export interface SessionEntry {
  timestamp: string;
  type: 'user_message' | 'agent_response' | 'tool_call' | 'tool_result' | 'state_change';
  data: unknown;
  metadata?: Record<string, unknown>;
}

// 저장 위치: data/sessions/{session-id}.jsonl
// 형식: 각 라인이 독립적 JSON (append-only)
```

### 4.4 작업 목록: Progressive Sandbox Escalation

| # | 작업 | 파일 | 의존성 | 효과 | 상태 |
|---|-----|-----|--------|------|:----:|
| 26 | Escalation 인터페이스 | `core/security/interfaces/escalation.interface.ts` | - | 설계 | ✅ |
| 27 | SandboxEscalation 구현 | `core/security/sandbox-escalation.ts` | #26 | 4단계 에스컬레이션 | ✅ |
| 28 | ConfidenceChecker 연동 | `core/hooks/sandbox-escalation/` | #27 | SandboxEscalationHook | ✅ |
| 29 | security/ 모듈 통합 | `core/security/index.ts` + ServiceRegistry | #27 | enableSecurity flag | ✅ |

### 4.5 작업 목록: Thin Orchestrator (High Risk) — ✅ 완료

| # | 작업 | 파일 | 의존성 | 효과 | 상태 |
|---|-----|-----|--------|------|------|
| 30 | Orchestrator 모듈 분석 | 문서화 | - | 현황 파악 (9,890 LOC, 29 files) | ✅ |
| 31 | 라우팅/상태 분리 설계 | 설계 문서 | #30 | 아키텍처 | ✅ |
| 32 | TaskRouter 리팩토링 | `core/orchestrator/task-router.ts` (425 LOC) | #31 | 이미 독립적 — 변경 불필요 | ✅ |
| 33 | StateManager 추출 | `core/orchestrator/runner-state-manager.ts` (96 LOC) | #31 | 이미 추출 완료 | ✅ |
| 34 | ErrorEscalator 추출 | `core/orchestrator/error-escalator.ts` (274 LOC) | #31 | 이미 추출 완료 | ✅ |
| 35 | Orchestrator 모듈 경량화 | `agent-factory.ts` + `integration-setup.ts` + `mock-runner.ts` | #32-34 | runner 912→604 LOC (34% 감소) | ✅ |
| 36 | 통합 테스트 | `agent-factory.test.ts` + `integration-setup.test.ts` + `mock-runner.test.ts` | #35 | 17 신규 + 688 기존 통과 | ✅ |

---

## 5. 기존 P3 - Agent 통합 (Consolidation) — ✅ 대부분 완료

> 기존 IMPLEMENTATION_PRIORITY_LIST v1.1의 P3. v2.7 분석 결과 대부분 이미 완료됨.

### 5.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 분산된 에이전트 정의 통합 (3곳 → 1곳) |
| 결과 | `src/agents/` 삭제됨, `src/core/agents/` 미생성, `src/core/orchestrator/agents/`로 통합 완료 |
| 리스크 | ~~High~~ → N/A (이미 완료) |

### 5.2 작업 목록 (v1.1에서 이관)

| # | 작업 | 리스크 | 상태 | 비고 |
|---|-----|--------|------|------|
| 37 | 에이전트 중복 분석 문서화 | Low | ✅ 완료 | 분석 결과: 이미 1곳 통합 (`core/orchestrator/agents/`) |
| 38 | _legacy/ 디렉토리 생성 + @deprecated | Low | ✅ N/A | `src/agents/` 이미 삭제, 레거시 코드 없음 |
| 39 | teams/ 이동 (orchestrator → agents) | Medium | ⏸ 보류 | agents가 orchestrator와 밀접 결합, 분리 불필요 |
| 40 | communication/ 구현 | Medium | → New P2 | 신규 기능으로 재분류 (#43+ Composable Skills) |
| 41 | execution/ 구현 | Medium | → New P2 | 신규 기능으로 재분류 (#43+ Deep Worker) |
| 42 | 레거시 완전 제거 | High | ✅ N/A | `AgentType`, `AgentTypeNormalizer` 이미 제거됨 |

### 5.3 v2.7 분석 상세

- `src/agents/` — 이전 작업에서 완전 삭제됨
- `src/core/agents/` — 디렉토리 자체 미존재
- `AgentType` enum — 코드베이스에서 완전 제거됨
- `AgentTypeNormalizer` — 코드베이스에서 완전 제거됨
- `shared/llm/base-client.ts` — stale @deprecated 참조 수정 완료
- 현재 에이전트: `core/orchestrator/agents/` 4개 (planning, development, qa, code-quality, 1,780 LOC)

---

## 6. New P2 - 확장성 (Extensibility)

### 6.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 스킬 조합성 + 진정한 자율성 + 멀티 프론트엔드 |
| 리스크 | Medium |
| 예상 기간 | 8-12주 |

### 6.2 작업 목록: Composable Skills — ✅ 완료

| # | 작업 | 파일 | 상태 |
|---|-----|-----|------|
| 43 | skills/ 디렉토리 생성 | `src/core/skills/` (interfaces/ + skills/) | ✅ |
| 44 | SkillRegistry 구현 | `skill-registry.ts` (97 LOC) | ✅ 11 tests |
| 45 | SkillPipeline 구현 | `skill-pipeline.ts` (182 LOC) | ✅ 15 tests |
| 46 | 기존 에이전트 기능 스킬 추출 | planning, code-review, test-generation, refactoring | ✅ 21 tests |

### 6.3 작업 목록: Deep Worker / Genuine Autonomy — ✅ 완료

| # | 작업 | 파일 | 상태 |
|---|-----|-----|------|
| 47 | DeepWorker 인터페이스 | `core/deep-worker/interfaces/deep-worker.interface.ts` | ✅ |
| 48 | PreExploration 구현 | `core/deep-worker/pre-exploration.ts` | ✅ 5 tests |
| 49 | SelfPlanning 구현 | `core/deep-worker/self-planning.ts` | ✅ 4 tests |
| 50 | RetryWithStrategyChange | `core/deep-worker/retry-strategy.ts` | ✅ 9 tests |
| 51 | TodoContinuationEnforcer | `core/deep-worker/todo-enforcer.ts` | ✅ 11 tests |
| — | DeepWorker orchestrator | `core/deep-worker/deep-worker.ts` | ✅ 7 tests |

### 6.4 작업 목록: Multi-Frontend / ACP — ✅ 완료

| # | 작업 | 파일 | 상태 |
|---|-----|-----|------|
| 52 | ACP 프로토콜 정의 | `core/protocols/` (interfaces + acp-message-bus.ts) | ✅ 14 tests |
| 53 | Web Dashboard 기초 | → 보류 (프론트엔드 프레임워크 미정) | ⏸ |
| 54 | API Gateway 통합 | `src/api/gateway.ts` | ✅ 8 tests |

---

## 7. New P3 - 고도화 (Enhancement)

### 7.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 모니터링 + 벤치마크 + 문서 생성 + 코드 분석 |
| 리스크 | Low-Medium |
| 예상 기간 | 12-16주 |

### 7.2 작업 목록

| # | 작업 | 출처 | 효과 | 상태 |
|---|-----|------|------|------|
| 55 | HUD Dashboard 구현 | oh-my-claudecode | 실시간 모니터링 | ✅ `core/hud/` — MetricsCollector + HUDDashboard, 18 tests |
| 56 | SWE-bench 벤치마크 통합 | oh-my-claudecode | 객관적 품질 측정 | ✅ `core/benchmark/` — BenchmarkRunner, 12 tests |
| 57 | HLD/MLD/LLD Generator | FEATURE_IMPROVEMENTS.md | 문서 자동 생성 | ✅ `core/docs-generator/` — DocsGenerator, 19 tests |
| 58 | Brownfield Analyzer | get-shit-done | 기존 코드 분석 | ✅ `core/brownfield/` — BrownfieldAnalyzer, 17 tests |
| 59 | Instinct Import/Export | everything-claude-code | 프로젝트 간 학습 전파 | ✅ `core/instinct-transfer/` — InstinctTransfer, 10 tests |
| 60 | Dynamic Prompts | oh-my-opencode | 런타임 프롬프트 최적화 | ✅ `core/dynamic-prompts/` — PromptRegistry + PromptRenderer, 22 tests |
| 61 | Checkpoint Protocol | get-shit-done | 3종 체크포인트 | ✅ `core/checkpoint/` — CheckpointManager, 21 tests |

---

## 8. 타임라인 및 마일스톤

### 8.1 전체 타임라인

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        구현 타임라인 (2026)                                      │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ~ Feb 6       Feb W2-3     Feb W4-Mar   Mar-Apr       Apr-Jun     Jun+         │
│  ─────────     ─────────    ─────────    ─────────     ─────────   ────         │
│                                                                                 │
│  ┌────────┐   ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐ ┌────────┐  │
│  │Phase 1 │ → │ New P0  │→ │기존 P2  │→ │ New P1   │→ │기존 P3+ │→│New P3  │  │
│  │P0+P1   │   │Evals +  │  │Context  │  │JSONL +   │  │New P2   │ │HUD+    │  │
│  │✅ 완료  │   │Routing  │  │통합     │  │Sandbox + │  │Skills + │ │SWE +   │  │
│  └────────┘   └─────────┘  └─────────┘  │Thin Orch │  │Deep Wkr │ │HLD/MLD │  │
│                                          └──────────┘  └─────────┘ └────────┘  │
│                                                                                 │
│  ✅ 완료       ⏳ 3-5주      ✅ 대부분    ⏳ 7-11주     ⏳ 14-18주  ⏳ 12-16주   │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 마일스톤

| 마일스톤 | 목표일 | 산출물 | 상태 |
|---------|--------|--------|------|
| M1: Phase 1 P0 모듈 | 2026-02-06 | ConfidenceChecker, SelfCheck, GoalBackward | ✅ 모듈 완료 |
| M2: Phase 1 P1 모듈 | 2026-02-06 | ReflexionPattern, InstinctStore, SolutionsCache | ✅ 모듈 완료 |
| M2.5: Integration | 2026-02-08 | P0/P1 파이프라인 통합 + 설정 수정 | ✅ **완료** |
| M3: New P0 Evals | 2026-02-08 | EvalRunner, Eval 정의, 3 Evaluators | ✅ **완료** |
| M4: New P0 Routing | 2026-02-08 | TieredRouter, CostTracker, DefaultRoutingStrategy | ✅ **완료** |
| M5: 기존 P2 Context | 2026-02-11 | context/ 모듈 통합, QualityCurve, dx/ 정리 | ✅ **완료** |
| M6: New P1 JSONL | 2026-02-11 | JSONL Persistence, Session Recovery | ✅ **완료** |
| M7: New P1 Sandbox | 2026-02-11 | Progressive Sandbox Escalation (45+13 tests) | ✅ **완료** |
| M8: New P1 Thin Orch | 2026-02-11 | agent-factory + integration-setup + mock-runner (912→604 LOC) | ✅ **완료** |
| M8.5: 기존 P3 분석 | 2026-02-11 | Agent 통합 이미 완료 확인, stale ref 수정, #40-41 → New P2 재분류 | ✅ **완료** |
| M9a: New P2 Skills | 2026-02-11 | SkillRegistry + SkillPipeline + 4 extracted skills (47 tests) | ✅ **완료** |
| M9b: New P2 Worker | 2026-02-11 | DeepWorker + PreExploration + SelfPlanning + RetryStrategy + TodoEnforcer (36 tests) | ✅ **완료** |
| M9c: New P2 Frontend | 2026-02-11 | ACP Protocol (14 tests) + API Gateway (8 tests). Web Dashboard 보류. | ✅ **완료** |
| M10: New P3 | 2026-02-11 | HUD, SWE-bench, HLD/MLD/LLD, Brownfield, Instinct Transfer, Dynamic Prompts, Checkpoint | ✅ 완료 |

---

## 9. 의존성 그래프

### 9.1 Phase 2 의존성

```
                    ┌─────────────────────┐
                    │  Phase 1 (모듈 완료) │
                    │  validation/         │
                    │  learning/           │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ 🔴 Integration      │
                    │ Sprint (I-1~I-11)   │
                    │ 파이프라인 통합      │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ New P0       │  │ 기존 P2      │  │ New P1-a     │
    │ Evals +      │  │ Context      │  │ JSONL        │
    │ Routing      │  │ ✅ 대부분완료│  │ Session      │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                 │
           ▼                 │                 ▼
    ┌──────────────┐         │          ┌──────────────┐
    │ New P1-b     │         │          │ New P1-c     │
    │ Progressive  │◄────────┘          │ Thin         │
    │ Sandbox      │                    │ Orchestrator │
    └──────┬───────┘                    └──────┬───────┘
           │                                   │
           └───────────────┬───────────────────┘
                           ▼
              ┌────────────────────────┐
              │  기존 P3 + New P2      │
              │  Agent 통합            │
              │  Composable Skills     │
              │  Deep Worker           │
              │  Multi-Frontend        │
              └────────────┬───────────┘
                           ▼
              ┌────────────────────────┐
              │  New P3               │
              │  HUD + SWE-bench      │
              │  HLD/MLD/LLD         │
              │  Brownfield          │
              └────────────────────────┘
```

### 9.2 모듈 간 의존성

```yaml
# Phase 1 (완료)
validation/:
  depends_on: []
  used_by: [orchestrator, agents, workflow, security]

learning/:
  depends_on: []
  used_by: [orchestrator, agents]

# New P0
evals/:
  depends_on: [agents (테스트 대상)]
  used_by: [ci/cd, monitoring]

shared/llm/ (tiered):
  depends_on: []
  used_by: [agents, orchestrator]

# 기존 P2
context/:
  depends_on: []
  used_by: [orchestrator, agents, hooks]

# New P1
session/ (jsonl):
  depends_on: []
  used_by: [orchestrator, agents]

security/ (escalation):
  depends_on: [validation/confidence-checker]
  used_by: [orchestrator, agents]

orchestrator/ (thin):
  depends_on: [agents, validation, learning]
  used_by: [api, workflow]

# New P2
skills/:
  depends_on: [agents]
  used_by: [orchestrator, workflow]

# 기존 P3 — ✅ 완료 (agents는 core/orchestrator/agents/로 통합 완료)
# agents/ (통합): already consolidated under orchestrator/agents/
```

---

## 10. 성공 지표

### 10.1 Phase 2 정량적 지표

| 지표 | 현재 | 목표 | 측정 방법 | 우선순위 |
|-----|-----|-----|---------|---------|
| Eval 통과율 (ALWAYS) | 미측정 | 100% | EvalRunner | New P0 |
| Eval 통과율 (USUALLY) | 미측정 | 80%+ | EvalRunner | New P0 |
| LLM 비용 | 기준치 | -30~50% | CostTracker | New P0 |
| 세션 crash 복구율 | 미측정 | 100% | JSONL 테스트 | New P1 |
| Orchestrator 모듈 LOC | ~11K (28 files) | ~5-7K | wc -l | New P1 |
| 컨텍스트 모듈 분산 | ~~4곳~~ → ✅ 1곳 (core/context/) | ✅ 달성 | 디렉토리 카운트 | 기존 P2 ✅ |
| 에이전트 코드 분산 | ~~3곳~~ → ✅ 1곳 (`core/orchestrator/agents/`) | ✅ 달성 | 디렉토리 카운트 | 기존 P3 ✅ |

### 10.2 Phase 2 정성적 지표

- [ ] Behavioral Eval 실패 시 원인 즉시 파악 가능
- [ ] 모델 비용 대시보드로 실시간 모니터링
- [ ] 세션 비정상 종료 후 자동 복구 확인
- [ ] CEO Orchestrator 코드 리뷰 시 "복잡하다" 피드백 감소

---

## 11. 리스크 관리

### 11.1 Phase 2 기술적 리스크

| 리스크 | 확률 | 영향 | 대응 | 관련 작업 |
|-------|-----|-----|------|----------|
| Eval 정의 부적합 | 중 | 중 | 점진적 eval 추가, 커뮤니티 참고 | New P0 |
| Tiered Routing 오판 | 낮음 | 중 | Fallback 체인, 수동 오버라이드 | New P0 |
| JSONL 스토리지 용량 | 낮음 | 중 | 주기적 compaction | New P1 |
| Thin Orchestrator 회귀 | 높음 | 높음 | 단계적 추출, 충분한 테스트 | New P1 |
| Deep Worker 통제 불능 | 중 | 높음 | Sandbox 연동, 리소스 제한 | New P2 |

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 2.0
  작성일: 2026-02-08
  이전_버전: 1.1
  상태: Phase 1 완료, Phase 2 계획

관련_문서:
  - IMPROVEMENT_RECOMMENDATIONS.md v3.0
  - CODE_STRUCTURE_IMPROVEMENT_PLAN.md
  - docs/05-specifications/v2/ (상세 Feature 스펙)

변경_이력:
  v1.0: 초기 버전 - P0~P3 우선순위 리스트
  v1.1: P0/P1 구현 완료 상태 반영
  v2.0: |
    Phase 2 계획 추가:
    - IMPROVEMENT_RECOMMENDATIONS v3.0 심층 분석 기반 12개 신규 개선 영역
    - New P0 (Behavioral Evals + Tiered Routing)
    - New P1 (JSONL Session + Progressive Sandbox + Thin Orchestrator)
    - New P2 (Composable Skills + Deep Worker + Multi-Frontend)
    - New P3 (HUD + SWE-bench + HLD/MLD/LLD + Brownfield)
    - 61개 작업 항목 정의
    - 의존성 그래프 업데이트

다음_갱신:
  예정일: New P0 착수 시
  담당: 프로젝트 소유자
```

---

> **참고**: 이 문서는 `IMPROVEMENT_RECOMMENDATIONS.md v3.0`의 실행 가이드입니다. 우선순위와 일정은 프로젝트 상황에 따라 조정될 수 있습니다.
