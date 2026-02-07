# 코드 구조 개선 방안 (Code Structure Improvement Plan)

> **버전**: 1.0
> **작성일**: 2026-02-06
> **상태**: 제안 (Proposed)
> **관련 문서**: IMPROVEMENT_RECOMMENDATIONS_v2.md §7

---

## 1. Executive Summary

### 1.1 현재 상태

| 지표 | 값 | 비고 |
|-----|---|-----|
| TypeScript 파일 수 | 478개 | src/ 디렉토리 |
| 디렉토리 수 | 149개 | src/ 디렉토리 |
| Core 모듈 LOC | ~48,000 | src/core/ |
| 전문화 에이전트 LOC | ~200,000 | src/core/agents/specialized/ |
| Hook 타입 수 | 9개 | 18개 파일 |
| LLM Provider 수 | 3개 | Claude, OpenAI, Gemini |

### 1.2 주요 문제점

1. **에이전트 정의 분산**: 3곳에 중복 정의
2. **유사 기능 분산**: 토큰/컨텍스트 관리가 4곳에 분산
3. **신규 기능 배치 불명확**: ConfidenceChecker 등의 위치 미정

### 1.3 개선 목표

- 신규 기능을 위한 명확한 모듈 구조 확립
- 기존 중복 코드 통합
- 유지보수성 향상
- 신규 개발자 온보딩 시간 단축

---

## 2. Phase 1: 신규 모듈 추가 (Low Risk)

### 2.1 Validation 모듈 생성

**목적**: 실행 전/후 검증 시스템 통합

**위치**: `src/core/validation/`

```
src/core/validation/
├── index.ts                       # 모듈 진입점
├── interfaces/
│   └── validation.interface.ts    # 검증 인터페이스 정의
├── confidence-checker.ts          # 사전 실행 신뢰도 검사
├── self-check-protocol.ts         # 사후 실행 자체 검사
└── goal-backward-verifier.ts      # 목표 역방향 검증
```

#### 2.1.1 confidence-checker.ts 구현 스펙

```typescript
/**
 * ConfidenceChecker - Pre-execution confidence validation
 *
 * Source: SuperClaude ConfidenceChecker pattern
 * ROI Target: 25-250x (100-200 tokens → 5,000-50,000 tokens saved)
 */

export interface ConfidenceCheckItem {
  name: string;
  weight: number;  // 0-1
  check: () => Promise<boolean>;
}

export interface ConfidenceCheckResult {
  score: number;           // 0-100
  passed: boolean;
  threshold: number;
  items: {
    name: string;
    passed: boolean;
    weight: number;
  }[];
  recommendation: 'proceed' | 'alternatives' | 'stop';
}

export interface IConfidenceChecker {
  /**
   * Run confidence check before task execution
   * @param context Task context
   * @returns Confidence check result
   */
  check(context: TaskContext): Promise<ConfidenceCheckResult>;

  /**
   * Configure check items
   */
  setCheckItems(items: ConfidenceCheckItem[]): void;

  /**
   * Set thresholds
   */
  setThresholds(proceed: number, alternatives: number): void;
}

// Default check items from SuperClaude
export const DEFAULT_CHECK_ITEMS: ConfidenceCheckItem[] = [
  { name: 'duplicate_check_complete', weight: 0.25, check: () => checkDuplicates() },
  { name: 'architecture_check_complete', weight: 0.25, check: () => checkArchitecture() },
  { name: 'official_docs_verified', weight: 0.20, check: () => checkOfficialDocs() },
  { name: 'oss_reference_complete', weight: 0.15, check: () => checkOSSReferences() },
  { name: 'root_cause_identified', weight: 0.15, check: () => checkRootCause() },
];

// Default thresholds
export const DEFAULT_THRESHOLDS = {
  proceed: 90,      // ≥90% → 즉시 진행
  alternatives: 70, // 70-89% → 대안 제시
  // <70% → 중단 + 조사
};
```

#### 2.1.2 self-check-protocol.ts 구현 스펙

```typescript
/**
 * SelfCheckProtocol - Post-execution validation
 *
 * Source: SuperClaude SelfCheckProtocol + get-shit-done Goal-Backward
 */

export interface SelfCheckQuestion {
  id: string;
  question: string;
  validator: (evidence: Evidence) => Promise<boolean>;
  required: boolean;
}

export interface DangerSignal {
  pattern: RegExp;
  severity: 'warning' | 'error';
  message: string;
}

export interface SelfCheckResult {
  passed: boolean;
  questions: {
    id: string;
    passed: boolean;
    evidence?: string;
  }[];
  dangerSignals: {
    signal: string;
    found: boolean;
    context?: string;
  }[];
  goalVerification: GoalBackwardResult;
}

// 4대 자기 검사 질문 (SuperClaude)
export const SELF_CHECK_QUESTIONS: SelfCheckQuestion[] = [
  {
    id: 'tests_pass',
    question: '모든 테스트 통과? (실제 출력 필수)',
    validator: async (e) => e.testOutput !== undefined && e.testsPassed,
    required: true,
  },
  {
    id: 'requirements_met',
    question: '모든 요구사항 충족? (구체적 목록)',
    validator: async (e) => e.requirementsList?.every(r => r.met),
    required: true,
  },
  {
    id: 'no_assumptions',
    question: '검증 없는 가정 없음? (문서 제시)',
    validator: async (e) => e.assumptions?.every(a => a.verified),
    required: true,
  },
  {
    id: 'evidence_exists',
    question: '증거 있음? (테스트 결과, 코드 변경, 검증)',
    validator: async (e) => e.evidence?.length > 0,
    required: true,
  },
];

// 7대 위험 신호 (SuperClaude)
export const DANGER_SIGNALS: DangerSignal[] = [
  { pattern: /should work/i, severity: 'warning', message: '불확실한 표현 감지' },
  { pattern: /probably/i, severity: 'warning', message: '불확실한 표현 감지' },
  { pattern: /I believe/i, severity: 'warning', message: '주관적 표현 감지' },
  { pattern: /I think/i, severity: 'warning', message: '주관적 표현 감지' },
  { pattern: /typically/i, severity: 'warning', message: '일반화 표현 감지' },
  { pattern: /usually/i, severity: 'warning', message: '일반화 표현 감지' },
  { pattern: /without concrete evidence/i, severity: 'error', message: '증거 없는 주장' },
];
```

#### 2.1.3 goal-backward-verifier.ts 구현 스펙

```typescript
/**
 * GoalBackwardVerifier - 3-stage goal achievement verification
 *
 * Source: get-shit-done Goal-Backward Verification
 */

export enum VerificationStage {
  EXISTS = 'exists',
  SUBSTANTIVE = 'substantive',
  WIRED = 'wired',
}

export interface GoalBackwardResult {
  passed: boolean;
  stages: {
    stage: VerificationStage;
    passed: boolean;
    details: string;
  }[];
}

export interface IGoalBackwardVerifier {
  /**
   * Stage 1: 파일이 예상 경로에 존재하는가?
   */
  verifyExists(paths: string[]): Promise<boolean>;

  /**
   * Stage 2: 실제 구현인가, placeholder인가?
   * - TODO/placeholder 탐지
   * - 코드 복잡도 분석
   */
  verifySubstantive(paths: string[]): Promise<boolean>;

  /**
   * Stage 3: 시스템에 연결되어 있는가?
   * - import 추적
   * - 라우팅 확인
   * - 테스트 커버리지
   */
  verifyWired(paths: string[]): Promise<boolean>;

  /**
   * Run all 3 stages
   */
  verify(goal: GoalDefinition): Promise<GoalBackwardResult>;
}
```

### 2.2 Learning 모듈 생성

**목적**: 에러 학습 및 패턴 기반 지속적 학습

**위치**: `src/core/learning/`

```
src/core/learning/
├── index.ts                    # 모듈 진입점
├── interfaces/
│   └── learning.interface.ts   # 학습 인터페이스 정의
├── reflexion-pattern.ts        # 에러 학습 시스템
├── instinct-store.ts           # Instinct 기반 학습
└── solutions-cache.ts          # 에러 해결책 캐시
```

#### 2.2.1 reflexion-pattern.ts 구현 스펙

```typescript
/**
 * ReflexionPattern - Error learning and prevention
 *
 * Source: SuperClaude ReflexionPattern
 * Target: <10% error recurrence rate
 */

export interface LearnedSolution {
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

export interface ReflexionResult {
  cacheHit: boolean;
  solution?: LearnedSolution;
  tokensUsed: number;  // Cache hit = 0, Miss = 1-2K
}

export interface IReflexionPattern {
  /**
   * Look up existing solution
   */
  lookup(error: Error): Promise<LearnedSolution | null>;

  /**
   * Learn from new error resolution
   */
  learn(error: Error, solution: string, rootCause: string): Promise<void>;

  /**
   * Get prevention checklist for error type
   */
  getPreventionChecklist(errorType: string): string[];

  /**
   * Update solution success/failure count
   */
  recordOutcome(solutionId: string, success: boolean): Promise<void>;
}

// Storage location
export const SOLUTIONS_FILE = 'docs/memory/solutions_learned.jsonl';
```

#### 2.2.2 instinct-store.ts 구현 스펙

```typescript
/**
 * InstinctStore - Confidence-based pattern learning
 *
 * Source: everything-claude-code Instinct System
 */

export interface Instinct {
  id: string;
  trigger: string;           // "when writing new functions"
  action: string;            // "Use functional patterns over classes"
  confidence: number;        // 0.3-0.9
  domain: string;            // "code-style", "testing", "git", etc.
  source: 'session-observation' | 'repo-analysis' | 'user-correction';
  evidence: string[];        // 관찰 근거
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface InstinctEvolution {
  clusteredInstincts: string[];  // instinct IDs
  evolvedTo: 'skill' | 'command' | 'agent';
  evolvedId: string;
}

export interface IInstinctStore {
  /**
   * Create new instinct from observation
   */
  create(instinct: Omit<Instinct, 'id' | 'createdAt' | 'updatedAt'>): Promise<Instinct>;

  /**
   * Find matching instincts for context
   */
  findMatching(context: string, domain?: string): Promise<Instinct[]>;

  /**
   * Increase confidence (pattern reinforced)
   */
  reinforce(id: string): Promise<void>;

  /**
   * Decrease confidence (user correction)
   */
  correct(id: string): Promise<void>;

  /**
   * Cluster related instincts and evolve
   */
  evolve(threshold: number): Promise<InstinctEvolution[]>;

  /**
   * Export instincts for sharing
   */
  export(filter?: { domain?: string; minConfidence?: number }): Promise<Instinct[]>;

  /**
   * Import instincts from others
   */
  import(instincts: Instinct[]): Promise<void>;
}

// Confidence levels
export const CONFIDENCE_LEVELS = {
  TENTATIVE: 0.3,   // 제안만, 강제 아님
  MODERATE: 0.5,    // 관련 시 적용
  STRONG: 0.7,      // 자동 승인
  NEAR_CERTAIN: 0.9 // 핵심 행동
};

// Storage location
export const INSTINCTS_DIR = '~/.claude/homunculus/instincts/';
```

### 2.3 index.ts 파일 생성

#### validation/index.ts

```typescript
/**
 * Validation Module
 *
 * Provides pre-execution and post-execution validation systems.
 *
 * @module core/validation
 */

// Confidence Checker
export {
  ConfidenceChecker,
  createConfidenceChecker,
  DEFAULT_CHECK_ITEMS,
  DEFAULT_THRESHOLDS,
  type IConfidenceChecker,
  type ConfidenceCheckItem,
  type ConfidenceCheckResult,
} from './confidence-checker';

// Self Check Protocol
export {
  SelfCheckProtocol,
  createSelfCheckProtocol,
  SELF_CHECK_QUESTIONS,
  DANGER_SIGNALS,
  type ISelfCheckProtocol,
  type SelfCheckQuestion,
  type DangerSignal,
  type SelfCheckResult,
} from './self-check-protocol';

// Goal Backward Verifier
export {
  GoalBackwardVerifier,
  createGoalBackwardVerifier,
  VerificationStage,
  type IGoalBackwardVerifier,
  type GoalBackwardResult,
} from './goal-backward-verifier';
```

#### learning/index.ts

```typescript
/**
 * Learning Module
 *
 * Provides error learning and pattern-based continuous learning.
 *
 * @module core/learning
 */

// Reflexion Pattern
export {
  ReflexionPattern,
  createReflexionPattern,
  SOLUTIONS_FILE,
  type IReflexionPattern,
  type LearnedSolution,
  type ReflexionResult,
} from './reflexion-pattern';

// Instinct Store
export {
  InstinctStore,
  createInstinctStore,
  CONFIDENCE_LEVELS,
  INSTINCTS_DIR,
  type IInstinctStore,
  type Instinct,
  type InstinctEvolution,
} from './instinct-store';

// Solutions Cache
export {
  SolutionsCache,
  createSolutionsCache,
  type ISolutionsCache,
} from './solutions-cache';
```

---

## 3. Phase 2: 컨텍스트 관리 통합 (Medium Risk)

### 3.1 현재 분산 상태

```
현재:
├── dx/token-budget/              # TokenBudgetManager
├── dx/output-optimizer/          # OutputOptimizer
├── core/hooks/token-optimizer/   # TokenOptimizerHook
└── core/hooks/context-monitor/   # ContextMonitorHook
```

### 3.2 통합 제안

```
제안:
└── core/context/                 # 🆕 통합 모듈
    ├── index.ts
    ├── interfaces/
    │   └── context.interface.ts
    ├── token-budget-manager.ts   # dx/token-budget에서 이동
    ├── context-monitor.ts        # hooks/context-monitor에서 통합
    ├── output-optimizer.ts       # dx/output-optimizer에서 이동
    ├── compaction-strategy.ts    # 압축 전략 (신규)
    └── quality-curve.ts          # get-shit-done 품질 곡선 (신규)
```

### 3.3 Quality Curve 구현 스펙

```typescript
/**
 * QualityCurve - Context quality based on usage percentage
 *
 * Source: get-shit-done Context Engineering
 */

export enum QualityLevel {
  PEAK = 'peak',           // 0-30%: 포괄적, 철저함
  GOOD = 'good',           // 30-50%: 확신, 견고함
  DEGRADING = 'degrading', // 50-70%: 효율 모드
  POOR = 'poor',           // 70%+: 급한, 최소한
}

export interface QualityCurveConfig {
  peakThreshold: number;      // default: 30
  goodThreshold: number;      // default: 50
  degradingThreshold: number; // default: 70
}

export interface IQualityCurve {
  /**
   * Get current quality level based on context usage
   */
  getLevel(usagePercent: number): QualityLevel;

  /**
   * Get recommended actions for quality level
   */
  getRecommendations(level: QualityLevel): string[];

  /**
   * Check if new task should be started
   */
  shouldStartNewPlan(usagePercent: number): boolean;
}

// Default: 2-3 tasks per plan, ~50% context usage
export const RECOMMENDED_TASKS_PER_PLAN = 3;
export const TARGET_CONTEXT_USAGE = 50;
```

### 3.4 마이그레이션 전략

```yaml
단계:
  1_준비:
    - core/context/ 디렉토리 생성
    - 인터페이스 정의
    - 테스트 케이스 작성

  2_복사:
    - dx/token-budget/ → core/context/token-budget-manager.ts
    - dx/output-optimizer/ → core/context/output-optimizer.ts
    - 기존 위치에 deprecated 표시

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

## 4. Phase 3: 에이전트 통합 (High Risk)

### 4.1 현재 분산 상태

```
현재 (3곳):
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

### 4.2 통합 제안

```
제안:
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

### 4.3 마이그레이션 전략

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

## 5. 디렉토리 생성 스크립트

### 5.1 Phase 1 디렉토리 생성

```bash
#!/bin/bash
# scripts/create-new-modules.sh

set -e

BASE_DIR="src/core"

# Create validation module
mkdir -p "$BASE_DIR/validation/interfaces"
touch "$BASE_DIR/validation/index.ts"
touch "$BASE_DIR/validation/interfaces/validation.interface.ts"
touch "$BASE_DIR/validation/confidence-checker.ts"
touch "$BASE_DIR/validation/self-check-protocol.ts"
touch "$BASE_DIR/validation/goal-backward-verifier.ts"

# Create learning module
mkdir -p "$BASE_DIR/learning/interfaces"
touch "$BASE_DIR/learning/index.ts"
touch "$BASE_DIR/learning/interfaces/learning.interface.ts"
touch "$BASE_DIR/learning/reflexion-pattern.ts"
touch "$BASE_DIR/learning/instinct-store.ts"
touch "$BASE_DIR/learning/solutions-cache.ts"

echo "✅ Phase 1 directories created"
echo ""
echo "Created structure:"
find "$BASE_DIR/validation" "$BASE_DIR/learning" -type f | sort
```

### 5.2 실행 방법

```bash
cd /path/to/autonomous-coding-agents
chmod +x scripts/create-new-modules.sh
./scripts/create-new-modules.sh
```

---

## 6. 구현 우선순위 및 일정

### 6.1 Week 1: 기초 설정

| 작업 | 담당 | 상태 |
|-----|-----|-----|
| validation/ 디렉토리 생성 | - | ⏳ |
| learning/ 디렉토리 생성 | - | ⏳ |
| 인터페이스 정의 | - | ⏳ |
| 테스트 환경 설정 | - | ⏳ |

### 6.2 Week 2-3: 핵심 기능 구현

| 작업 | 우선순위 | 상태 |
|-----|---------|-----|
| ConfidenceChecker 구현 | P0 | ⏳ |
| SelfCheckProtocol 구현 | P0 | ⏳ |
| GoalBackwardVerifier 구현 | P0 | ⏳ |
| 기존 completion-detector.ts 통합 | P1 | ⏳ |

### 6.3 Week 4-6: 학습 시스템 구현

| 작업 | 우선순위 | 상태 |
|-----|---------|-----|
| ReflexionPattern 구현 | P1 | ⏳ |
| InstinctStore 구현 | P1 | ⏳ |
| SolutionsCache 구현 | P2 | ⏳ |

### 6.4 Month 2+: 통합 및 정리

| 작업 | 우선순위 | 상태 |
|-----|---------|-----|
| context/ 모듈 통합 | P2 | ⏳ |
| 레거시 에이전트 마이그레이션 시작 | P3 | ⏳ |
| 문서 업데이트 | P2 | ⏳ |

---

## 7. 성공 지표

### 7.1 정량적 지표

| 지표 | 현재 | 목표 | 측정 방법 |
|-----|-----|-----|---------|
| 중복 에이전트 코드 | 3곳 | 1곳 | 디렉토리 카운트 |
| 토큰 관리 모듈 | 4곳 | 1곳 | 디렉토리 카운트 |
| 신규 기능 배치 시간 | N/A | <1일 | 개발자 피드백 |
| 온보딩 시간 | N/A | -30% | 신규 개발자 측정 |

### 7.2 정성적 지표

- [ ] 신규 개발자가 5분 내에 모듈 위치 파악 가능
- [ ] 기능 검색 시 1곳에서만 결과 나옴
- [ ] 코드 리뷰 시 "위치가 맞나요?" 질문 감소

---

## 8. 리스크 및 대응

### 8.1 기술적 리스크

| 리스크 | 확률 | 영향 | 대응 |
|-------|-----|-----|-----|
| 순환 의존성 발생 | 중 | 높음 | 레이어 분리 엄격 적용 |
| 하위 호환성 파괴 | 중 | 높음 | re-export 유지, 유예 기간 |
| 테스트 커버리지 감소 | 낮음 | 중 | 마이그레이션 전 테스트 보강 |

### 8.2 조직적 리스크

| 리스크 | 확률 | 영향 | 대응 |
|-------|-----|-----|-----|
| 개발자 학습 곡선 | 중 | 중 | 상세 문서, 예제 코드 |
| 진행 중 프로젝트 영향 | 중 | 중 | 점진적 마이그레이션 |

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.0
  작성일: 2026-02-06
  상태: 제안 (Proposed)

관련_문서:
  - IMPROVEMENT_RECOMMENDATIONS_v2.md
  - PROJECT_ANALYSIS_REPORT.md
  - UNIFIED_VISION.md

다음_단계:
  - 프로젝트 소유자 검토
  - 기술 검토 (아키텍처 팀)
  - 승인 후 Phase 1 시작
```

---

> **참고**: 이 문서는 IMPROVEMENT_RECOMMENDATIONS_v2.md §7의 상세 구현 가이드입니다.
