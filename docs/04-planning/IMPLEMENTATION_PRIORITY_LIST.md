# Implementation Priority List (구현 우선순위 리스트)

> **버전**: 1.0
> **작성일**: 2026-02-06
> **상태**: 활성 (Active)
> **관련 문서**: IMPROVEMENT_RECOMMENDATIONS_v2.md, CODE_STRUCTURE_IMPROVEMENT_PLAN.md

---

## 1. Executive Summary

### 1.1 문서 목적

이 문서는 `IMPROVEMENT_RECOMMENDATIONS_v2.md`와 `CODE_STRUCTURE_IMPROVEMENT_PLAN.md`에서 도출된 개선 작업을 **우선순위별로 정리**하여 체계적인 구현 로드맵을 제공합니다.

### 1.2 우선순위 매트릭스

| 우선순위 | 리스크 | 작업 영역 | 예상 기간 | 상태 |
|---------|--------|----------|----------|------|
| **P0** | Low | 검증 시스템 (validation/) | 2-3주 | 🟡 진행중 |
| **P1** | Low | 학습 시스템 (learning/) | 3-4주 | 🟡 진행중 |
| **P2** | Medium | 컨텍스트 통합 (context/) | 2-3주 | ⏳ 대기 |
| **P3** | High | 에이전트 통합 (agents/) | 6주+ | ⏳ 대기 |

### 1.3 핵심 목표

1. **사전 검증 시스템** 도입으로 잘못된 방향 작업 방지 (목표 ROI: 25-250x)
2. **사후 검증 시스템** 도입으로 환각 탐지 및 완료 검증 강화
3. **에러 학습 시스템** 도입으로 재발률 10% 미만 달성
4. **코드 구조 통합**으로 유지보수성 및 온보딩 효율 개선

---

## 2. P0 - 즉시 구현 (Critical Path)

### 2.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 실행 전/후 검증 시스템 구축 |
| 모듈 | `src/core/validation/` |
| 리스크 | Low (신규 모듈, 기존 코드 영향 없음) |
| 예상 기간 | 2-3주 |
| 출처 패턴 | SuperClaude (ConfidenceChecker, SelfCheckProtocol), get-shit-done (Goal-Backward) |

### 2.2 작업 목록

| # | 작업 | 파일 | 상태 | 의존성 | 예상 ROI |
|---|-----|-----|------|--------|----------|
| 1 | validation/ 디렉토리 생성 | `src/core/validation/` | ✅ 완료 | - | - |
| 2 | validation 인터페이스 정의 | `interfaces/validation.interface.ts` | ✅ 완료 | #1 | - |
| 3 | validation index.ts 생성 | `index.ts` | ✅ 완료 | #2 | - |
| 4 | **ConfidenceChecker 구현** | `confidence-checker.ts` | ⏳ 대기 | #3 | **25-250x** |
| 5 | **SelfCheckProtocol 구현** | `self-check-protocol.ts` | ⏳ 대기 | #3 | 환각 탐지 |
| 6 | **GoalBackwardVerifier 구현** | `goal-backward-verifier.ts` | ⏳ 대기 | #5 | 완료 검증 |
| 7 | completion-detector 통합 | 기존 파일 수정 | ⏳ 대기 | #6 | 기능 통합 |

### 2.3 상세 스펙

#### 2.3.1 ConfidenceChecker (사전 검증)

```typescript
/**
 * 사전 실행 신뢰도 검사
 *
 * 투자: 100-200 토큰
 * 절감: 5,000-50,000 토큰 (잘못된 방향 방지)
 * ROI: 25-250x
 */
export interface IConfidenceChecker {
  check(context: TaskContext): Promise<ConfidenceCheckResult>;
  setCheckItems(items: ConfidenceCheckItem[]): void;
  setThresholds(proceed: number, alternatives: number): void;
}

// 임계값 동작
// ≥90% → 즉시 진행
// 70-89% → 대안 제시
// <70% → 중단 + 조사

// 5대 체크 항목
const DEFAULT_CHECK_ITEMS = [
  { name: 'duplicate_check_complete', weight: 0.25 },
  { name: 'architecture_check_complete', weight: 0.25 },
  { name: 'official_docs_verified', weight: 0.20 },
  { name: 'oss_reference_complete', weight: 0.15 },
  { name: 'root_cause_identified', weight: 0.15 },
];
```

#### 2.3.2 SelfCheckProtocol (사후 검증)

```typescript
/**
 * 사후 실행 자체 검사
 *
 * 4대 질문 + 7대 위험신호 탐지
 */
export interface ISelfCheckProtocol {
  check(evidence: Evidence): Promise<SelfCheckResult>;
  scanForDangerSignals(text: string): { signal: string; context: string }[];
  setQuestions(questions: SelfCheckQuestion[]): void;
  setDangerSignals(signals: DangerSignal[]): void;
}

// 4대 자기 검사 질문
const SELF_CHECK_QUESTIONS = [
  { id: 'tests_pass', question: '모든 테스트 통과? (실제 출력 필수)', required: true },
  { id: 'requirements_met', question: '모든 요구사항 충족? (구체적 목록)', required: true },
  { id: 'no_assumptions', question: '검증 없는 가정 없음? (문서 제시)', required: true },
  { id: 'evidence_exists', question: '증거 있음? (테스트 결과, 코드 변경, 검증)', required: true },
];

// 7대 위험 신호
const DANGER_SIGNALS = [
  { pattern: /should work/i, severity: 'warning', message: '불확실한 표현 감지' },
  { pattern: /probably/i, severity: 'warning', message: '불확실한 표현 감지' },
  { pattern: /I believe/i, severity: 'warning', message: '주관적 표현 감지' },
  { pattern: /I think/i, severity: 'warning', message: '주관적 표현 감지' },
  { pattern: /typically/i, severity: 'warning', message: '일반화 표현 감지' },
  { pattern: /usually/i, severity: 'warning', message: '일반화 표현 감지' },
  { pattern: /without concrete evidence/i, severity: 'error', message: '증거 없는 주장' },
];
```

#### 2.3.3 GoalBackwardVerifier (목표 역방향 검증)

```typescript
/**
 * 3단계 목표 달성 검증
 *
 * Task Completion이 아닌 Goal Achievement 검증
 */
export interface IGoalBackwardVerifier {
  verifyExists(paths: string[]): Promise<boolean>;      // Stage 1: 파일 존재
  verifySubstantive(paths: string[]): Promise<boolean>; // Stage 2: 실제 구현 (not placeholder)
  verifyWired(paths: string[]): Promise<boolean>;       // Stage 3: 시스템 연결
  verify(goal: GoalDefinition): Promise<GoalBackwardResult>;
}

// 3단계 검증 vs 잘못된 검증
// ✅ 올바름: exists → substantive → wired
// ❌ 잘못됨: 파일 존재 = 완료
```

### 2.4 검증 계획

```yaml
검증_단계:
  1_단위_테스트:
    범위: "각 컴포넌트 독립 테스트"
    성공_기준:
      - "ConfidenceChecker 임계값 동작 확인"
      - "SelfCheckProtocol 위험신호 탐지 확인"
      - "GoalBackwardVerifier 3단계 검증 확인"

  2_통합_테스트:
    범위: "validation 모듈 전체"
    성공_기준:
      - "모듈 간 연동 정상"
      - "completion-detector 통합 정상"

  3_ROI_검증:
    범위: "실제 태스크 실행 A/B 테스트"
    성공_기준:
      - "잘못된 방향 작업 50%+ 감소"
      - "총 토큰 사용량 20%+ 감소"
```

---

## 3. P1 - 단기 구현 (High Value)

### 3.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 에러 학습 및 패턴 기반 지속적 학습 시스템 구축 |
| 모듈 | `src/core/learning/` |
| 리스크 | Low (신규 모듈, 기존 코드 영향 없음) |
| 예상 기간 | 3-4주 |
| 출처 패턴 | SuperClaude (ReflexionPattern), everything-claude-code (Instinct System) |

### 3.2 작업 목록

| # | 작업 | 파일 | 상태 | 의존성 | 효과 |
|---|-----|-----|------|--------|------|
| 8 | learning/ 디렉토리 생성 | `src/core/learning/` | ✅ 완료 | - | - |
| 9 | learning 인터페이스 정의 | `interfaces/learning.interface.ts` | ✅ 완료 | #8 | - |
| 10 | learning index.ts 생성 | `index.ts` | ✅ 완료 | #9 | - |
| 11 | **ReflexionPattern 구현** | `reflexion-pattern.ts` | ⏳ 대기 | #10 | 에러 재발 <10% |
| 12 | **InstinctStore 구현** | `instinct-store.ts` | ⏳ 대기 | #10 | 패턴 학습 |
| 13 | SolutionsCache 구현 | `solutions-cache.ts` | ⏳ 대기 | #11 | 0토큰 조회 |
| 14 | solutions_learned.jsonl 스토리지 | 파일 시스템 | ⏳ 대기 | #11 | 영속화 |

### 3.3 상세 스펙

#### 3.3.1 ReflexionPattern (에러 학습)

```typescript
/**
 * 에러 학습 및 예방 시스템
 *
 * 목표: 에러 재발률 <10%
 * 캐시 히트: 0 토큰 (즉시 해결)
 * 캐시 미스: 1-2K 토큰 (조사 + 기록)
 */
export interface IReflexionPattern {
  lookup(error: Error): Promise<LearnedSolution | null>;
  learn(error: Error, solution: string, rootCause: string): Promise<void>;
  getPreventionChecklist(errorType: string): string[];
  recordOutcome(solutionId: string, success: boolean): Promise<void>;
}

// 학습 데이터 구조
interface LearnedSolution {
  id: string;
  errorType: string;
  errorMessage: string;
  rootCause: string;
  solution: string;
  prevention: string[];  // 체크리스트
  createdAt: Date;
  successCount: number;
  failureCount: number;
}

// 저장 위치
const SOLUTIONS_FILE = 'docs/memory/solutions_learned.jsonl';
```

#### 3.3.2 InstinctStore (Instinct 기반 학습)

```typescript
/**
 * 신뢰도 기반 패턴 학습 시스템
 *
 * 스킬보다 작고 유연한 학습 단위
 * 0.3-0.9 신뢰도 스케일
 */
export interface IInstinctStore {
  create(instinct: Omit<Instinct, 'id' | 'createdAt' | 'updatedAt'>): Promise<Instinct>;
  findMatching(context: string, domain?: string): Promise<Instinct[]>;
  reinforce(id: string): Promise<void>;  // 신뢰도 +0.05
  correct(id: string): Promise<void>;    // 신뢰도 -0.10
  evolve(threshold: number): Promise<InstinctEvolution[]>;  // 스킬로 진화
  export(filter?: InstinctFilter): Promise<Instinct[]>;
  import(instincts: Instinct[]): Promise<void>;
}

// Instinct 데이터 구조
interface Instinct {
  id: string;
  trigger: string;           // "when writing new functions"
  action: string;            // "Use functional patterns over classes"
  confidence: number;        // 0.3-0.9
  domain: string;            // "code-style", "testing", "git", etc.
  source: 'session-observation' | 'repo-analysis' | 'user-correction';
  evidence: string[];
  usageCount: number;
}

// 신뢰도 레벨
const CONFIDENCE_LEVELS = {
  TENTATIVE: 0.3,   // 제안만, 강제 아님
  MODERATE: 0.5,    // 관련 시 적용
  STRONG: 0.7,      // 자동 승인
  NEAR_CERTAIN: 0.9 // 핵심 행동
};

// 저장 위치
const INSTINCTS_DIR = '~/.claude/homunculus/instincts/';
```

### 3.4 학습 계층 구조

```yaml
학습_계층:
  layer_1_reflexion:
    대상: "에러 및 해결책"
    저장: "solutions_learned.jsonl"
    조회: "0 토큰 (캐시 히트)"
    학습: "1-2K 토큰 (캐시 미스)"

  layer_2_instinct:
    대상: "패턴 및 선호도"
    저장: "~/.claude/homunculus/instincts/"
    신뢰도: "0.3-0.9 스케일"
    진화: "클러스터링 → 스킬/명령어/에이전트"

  layer_3_knowledge:
    대상: "검증된 지식"
    저장: "docs/patterns/, docs/mistakes/"
    승격: "temp → patterns (성공 시)"
    방지: "temp → mistakes (실패 시)"
```

---

## 4. P2 - 중기 구현 (Optimization)

### 4.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 분산된 컨텍스트 관리 기능 통합 |
| 모듈 | `src/core/context/` |
| 리스크 | Medium (기존 코드 이동 필요) |
| 예상 기간 | 2-3주 |
| 출처 패턴 | get-shit-done (Context Engineering, Quality Curve) |

### 4.2 현재 분산 상태

```
현재 (4곳 분산):
├── dx/token-budget/              # TokenBudgetManager
├── dx/output-optimizer/          # OutputOptimizer
├── core/hooks/token-optimizer/   # TokenOptimizerHook
└── core/hooks/context-monitor/   # ContextMonitorHook

통합 후:
└── core/context/                 # 통합 모듈
    ├── index.ts
    ├── interfaces/
    │   └── context.interface.ts
    ├── token-budget-manager.ts   # dx/token-budget에서 이동
    ├── context-monitor.ts        # hooks/context-monitor에서 통합
    ├── output-optimizer.ts       # dx/output-optimizer에서 이동
    ├── compaction-strategy.ts    # 압축 전략 (신규)
    └── quality-curve.ts          # get-shit-done 품질 곡선 (신규)
```

### 4.3 작업 목록

| # | 작업 | 현재 위치 | 통합 위치 | 리스크 | 효과 |
|---|-----|----------|----------|--------|------|
| 15 | context/ 디렉토리 생성 | - | `src/core/context/` | Low | - |
| 16 | token-budget-manager 이동 | `dx/token-budget/` | `core/context/` | Medium | 통합 |
| 17 | context-monitor 통합 | `hooks/context-monitor/` | `core/context/` | Medium | 통합 |
| 18 | output-optimizer 이동 | `dx/output-optimizer/` | `core/context/` | Medium | 통합 |
| 19 | **QualityCurve 구현** | - | `quality-curve.ts` | Low | 품질 개선 |
| 20 | compaction-strategy 구현 | - | `compaction-strategy.ts` | Low | 압축 |
| 21 | 레거시 re-export 설정 | `dx/` | `dx/index.ts` | Low | 하위호환 |

### 4.4 QualityCurve 스펙

```typescript
/**
 * 컨텍스트 품질 곡선
 *
 * 출처: get-shit-done Context Engineering
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

// 권장 설정
const RECOMMENDED_TASKS_PER_PLAN = 3;  // 계획당 2-3개 태스크
const TARGET_CONTEXT_USAGE = 50;        // 목표 컨텍스트 사용률
```

### 4.5 마이그레이션 전략

```yaml
단계:
  1_준비:
    - core/context/ 디렉토리 생성
    - 인터페이스 정의
    - 테스트 케이스 작성

  2_복사:
    - dx/token-budget/ → core/context/token-budget-manager.ts
    - dx/output-optimizer/ → core/context/output-optimizer.ts
    - 기존 위치에 @deprecated 표시

  3_통합:
    - context-monitor 통합
    - quality-curve 추가
    - compaction-strategy 추가

  4_전환:
    - 의존성 업데이트 (import 경로)
    - 레거시 re-export (하위 호환성)

  5_정리:
    - 6개월 후 레거시 제거
    - 문서 업데이트
```

---

## 5. P3 - 장기 구현 (Consolidation)

### 5.1 개요

| 항목 | 내용 |
|-----|------|
| 목표 | 분산된 에이전트 정의 통합 |
| 모듈 | `src/core/agents/` |
| 리스크 | High (대규모 코드 이동, 영향 범위 넓음) |
| 예상 기간 | 6주+ |
| 출처 패턴 | oh-my-opencode (Prometheus/Atlas 분리) |

### 5.2 현재 분산 상태

```
현재 (3곳 분산):
├── src/agents/                    # 레거시 (13K LOC)
│   ├── coder/
│   ├── manager/
│   ├── reviewer/
│   └── repo-manager/
│
├── src/core/agents/               # 리팩토링 버전 (5K LOC)
│   ├── base-agent.ts
│   ├── agent-factory.ts
│   ├── agent-registry.ts
│   └── specialized/               # 200K LOC
│       ├── architect-agent.ts
│       ├── coder-agent.ts
│       └── ...
│
└── src/core/orchestrator/agents/  # 팀 에이전트
    ├── base-team-agent.ts
    └── ...
```

### 5.3 통합 목표 구조

```
통합 후:
└── src/core/agents/               # 통합된 에이전트 시스템
    ├── index.ts
    ├── base/
    │   ├── base-agent.ts
    │   ├── agent-factory.ts
    │   └── interfaces/
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
    ├── teams/                     # orchestrator/agents에서 이동
    │   ├── base-team-agent.ts
    │   ├── planning-agent.ts
    │   ├── development-agent.ts
    │   └── qa-agent.ts
    │
    ├── communication/             # 에이전트 간 통신
    │   └── agent-communication.ts
    │
    ├── execution/                 # 백그라운드 실행
    │   └── background-executor.ts
    │
    └── _legacy/                   # 마이그레이션 대상
        ├── README.md              # 마이그레이션 안내
        └── [기존 src/agents/ 내용]
```

### 5.4 작업 목록

| # | 작업 | 현재 상태 | 목표 | 리스크 | 기간 |
|---|-----|----------|-----|--------|------|
| 22 | 에이전트 중복 분석 | 3곳 분산 | 문서화 | Low | 1주 |
| 23 | _legacy/ 디렉토리 생성 | - | `core/agents/_legacy/` | Low | 1일 |
| 24 | @deprecated JSDoc 추가 | `src/agents/` | 전체 | Low | 2일 |
| 25 | 마이그레이션 가이드 작성 | - | `_legacy/README.md` | Low | 1일 |
| 26 | teams/ 이동 | `orchestrator/agents/` | `core/agents/teams/` | Medium | 1주 |
| 27 | communication/ 구현 | - | `core/agents/communication/` | Medium | 2주 |
| 28 | execution/ 구현 | - | `core/agents/execution/` | Medium | 2주 |
| 29 | 레거시 완전 제거 | `src/agents/` | 삭제 | High | 6개월+ |

### 5.5 마이그레이션 전략

```yaml
단계:
  1_분석:
    - 중복 코드 식별
    - 기능 매핑
    - 테스트 커버리지 확인

  2_deprecated_표시:
    - src/agents/ 전체에 @deprecated JSDoc
    - console.warn 추가
    - 마이그레이션 가이드 작성

  3_점진적_이동:
    - 새 기능은 core/agents/에만 추가
    - 버그 수정 시 core/agents/로 이동
    - 6개월 유예 기간

  4_완전_전환:
    - src/agents/ → src/core/agents/_legacy/
    - re-export로 하위 호환성 유지

  5_정리:
    - 1년 후 _legacy/ 제거
    - 문서 최종 업데이트
```

---

## 6. 타임라인 및 마일스톤

### 6.1 전체 타임라인

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           구현 타임라인 (2026)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Feb W1       Feb W2-3      Feb W4-Mar W2   Mar W3+        Q2+              │
│  ───────      ─────────     ─────────────   ───────        ────             │
│                                                                              │
│  ┌─────┐     ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ 기초 │  →  │ P0 검증  │ → │ P1 학습  │ → │ P2 컨텍스트│ → │ P3 에이전트│     │
│  │ 설정 │     │ 시스템   │   │ 시스템   │   │ 통합      │   │ 통합       │     │
│  └─────┘     └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│                                                                              │
│  ✅ 완료      ⏳ 2-3주       ⏳ 3-4주       ⏳ 2-3주       ⏳ 6주+          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 마일스톤

| 마일스톤 | 목표일 | 산출물 | 상태 |
|---------|--------|--------|------|
| M1: 기초 설정 | 2026-02-06 | 디렉토리, 인터페이스, index.ts | ✅ 완료 |
| M2: P0 검증 시스템 | 2026-02-21 | ConfidenceChecker, SelfCheck, GoalBackward | ⏳ 대기 |
| M3: P1 학습 시스템 | 2026-03-14 | ReflexionPattern, InstinctStore, SolutionsCache | ⏳ 대기 |
| M4: P2 컨텍스트 통합 | 2026-04-04 | context/ 모듈 통합 | ⏳ 대기 |
| M5: P3 에이전트 통합 시작 | 2026-04-18 | _legacy 설정, deprecated 표시 | ⏳ 대기 |
| M6: P3 에이전트 통합 완료 | 2026-06-30 | agents/ 완전 통합 | ⏳ 대기 |

---

## 7. 의존성 그래프

### 7.1 작업 간 의존성

```
                    ┌─────────────────┐
                    │ 기초 설정 (완료) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌─────────────────┐ ┌────────────┐ ┌────────────┐
    │ ConfidenceChecker│ │ Reflexion  │ │ Context    │
    │      (P0)        │ │ Pattern    │ │ 통합       │
    │                  │ │   (P1)     │ │   (P2)     │
    └────────┬────────┘ └─────┬──────┘ └─────┬──────┘
             │                │              │
             ▼                ▼              │
    ┌─────────────────┐ ┌────────────┐      │
    │ SelfCheckProtocol│ │ Instinct   │      │
    │      (P0)        │ │ Store      │      │
    │                  │ │   (P1)     │      │
    └────────┬────────┘ └─────┬──────┘      │
             │                │              │
             ▼                ▼              │
    ┌─────────────────┐ ┌────────────┐      │
    │ GoalBackward    │ │ Solutions  │      │
    │ Verifier (P0)   │ │ Cache (P1) │      │
    └────────┬────────┘ └─────┬──────┘      │
             │                │              │
             └────────────────┴──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Agent 통합 (P3) │
                    └─────────────────┘
```

### 7.2 모듈 간 의존성

```yaml
validation/:
  depends_on: []
  used_by: [orchestrator, agents, workflow]

learning/:
  depends_on: []
  used_by: [orchestrator, agents]

context/:
  depends_on: []
  used_by: [orchestrator, agents, hooks]

agents/:
  depends_on: [validation, learning, context]
  used_by: [orchestrator, workflow, api]
```

---

## 8. 즉시 실행 작업 (Next Actions)

### 8.1 Top 5 작업

| 순서 | 작업 | 우선순위 | 파일 | 예상 LOC |
|-----|-----|---------|-----|----------|
| **1** | ConfidenceChecker 구현 | P0 | `confidence-checker.ts` | ~500 |
| **2** | SelfCheckProtocol 구현 | P0 | `self-check-protocol.ts` | ~400 |
| **3** | GoalBackwardVerifier 구현 | P0 | `goal-backward-verifier.ts` | ~300 |
| **4** | ReflexionPattern 구현 | P1 | `reflexion-pattern.ts` | ~400 |
| **5** | InstinctStore 구현 | P1 | `instinct-store.ts` | ~500 |

### 8.2 체크리스트

```markdown
## P0 - Validation 모듈

- [x] validation/ 디렉토리 생성
- [x] validation.interface.ts 작성
- [x] validation/index.ts 작성
- [ ] confidence-checker.ts 구현
  - [ ] ConfidenceChecker 클래스
  - [ ] 5대 체크 항목 구현
  - [ ] 임계값 로직 (90%/70%)
  - [ ] 단위 테스트
- [ ] self-check-protocol.ts 구현
  - [ ] SelfCheckProtocol 클래스
  - [ ] 4대 질문 구현
  - [ ] 7대 위험신호 탐지
  - [ ] 단위 테스트
- [ ] goal-backward-verifier.ts 구현
  - [ ] GoalBackwardVerifier 클래스
  - [ ] 3단계 검증 구현
  - [ ] 단위 테스트
- [ ] completion-detector.ts 통합

## P1 - Learning 모듈

- [x] learning/ 디렉토리 생성
- [x] learning.interface.ts 작성
- [x] learning/index.ts 작성
- [ ] reflexion-pattern.ts 구현
  - [ ] ReflexionPattern 클래스
  - [ ] 에러 시그니처 생성
  - [ ] 솔루션 조회/저장
  - [ ] 단위 테스트
- [ ] instinct-store.ts 구현
  - [ ] InstinctStore 클래스
  - [ ] 신뢰도 조정 로직
  - [ ] 진화 메커니즘
  - [ ] 단위 테스트
- [ ] solutions-cache.ts 구현
```

---

## 9. 성공 지표

### 9.1 정량적 지표

| 지표 | 현재 | 목표 | 측정 방법 |
|-----|-----|-----|---------|
| 잘못된 방향 작업 비율 | 미측정 | -50% | A/B 테스트 |
| 토큰 사용량 | 기준치 | -20% | 모니터링 |
| 에러 재발률 | 미측정 | <10% | 로그 분석 |
| 중복 에이전트 코드 | 3곳 | 1곳 | 디렉토리 카운트 |
| 토큰 관리 모듈 | 4곳 | 1곳 | 디렉토리 카운트 |
| 신규 기능 배치 시간 | 미측정 | <1일 | 개발자 피드백 |

### 9.2 정성적 지표

- [ ] 신규 개발자가 5분 내에 모듈 위치 파악 가능
- [ ] 기능 검색 시 1곳에서만 결과 나옴
- [ ] 코드 리뷰 시 "위치가 맞나요?" 질문 감소
- [ ] ConfidenceChecker로 사전에 문제 발견
- [ ] SelfCheckProtocol로 환각 탐지

---

## 10. 리스크 관리

### 10.1 기술적 리스크

| 리스크 | 확률 | 영향 | 대응 |
|-------|-----|-----|-----|
| ConfidenceChecker 임계값 부적합 | 중 | 중 | 설정 가능하게 구현, A/B 테스트 |
| 학습 시스템 스토리지 이슈 | 낮음 | 중 | JSONL 형식, 정기 정리 |
| 순환 의존성 발생 | 중 | 높음 | 레이어 분리 엄격 적용 |
| 하위 호환성 파괴 | 중 | 높음 | re-export 유지, 유예 기간 |
| 테스트 커버리지 감소 | 낮음 | 중 | 마이그레이션 전 테스트 보강 |

### 10.2 대응 전략

```yaml
리스크_대응:
  기술적:
    - 각 Phase별 독립적 구현 (영향 최소화)
    - 신규 모듈 우선 (Low Risk)
    - 통합 작업은 점진적 수행

  일정:
    - 버퍼 20% 확보
    - 의존성 낮은 작업 병렬 진행
    - 블로커 발생 시 대안 작업 전환
```

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.0
  작성일: 2026-02-06
  상태: 활성 (Active)

관련_문서:
  - IMPROVEMENT_RECOMMENDATIONS_v2.md
  - CODE_STRUCTURE_IMPROVEMENT_PLAN.md
  - PROJECT_ANALYSIS_REPORT.md
  - UNIFIED_VISION.md

변경_이력:
  v1.0: 초기 버전 - 우선순위 리스트 작성

다음_갱신:
  예정일: 작업 완료 시 또는 주요 변경 시
  담당: 프로젝트 소유자
```

---

> **참고**: 이 문서는 `IMPROVEMENT_RECOMMENDATIONS_v2.md`와 `CODE_STRUCTURE_IMPROVEMENT_PLAN.md`의 실행 가이드입니다. 우선순위와 일정은 프로젝트 상황에 따라 조정될 수 있습니다.
