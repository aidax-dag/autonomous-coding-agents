# F002 - SelfCheckProtocol (사후 실행 자체 검사)

> **우선순위**: P0 (Critical Path)
> **모듈**: `src/core/validation/`
> **효과**: 환각 탐지, 완료 검증 강화
> **출처 패턴**: SuperClaude SelfCheckProtocol

---

## 1. 개요

### 1.1 목적

태스크 실행 후 **4대 필수 질문**과 **7대 위험 신호 탐지**를 통해 결과물의 품질을 검증하고 환각(hallucination)을 탐지합니다.

### 1.2 배경

- **문제**: 에이전트가 실제로 완료하지 않은 작업을 완료했다고 보고하거나, 불확실한 정보를 확신있게 전달
- **해결**: 체계적인 사후 검증 프로토콜로 증거 기반 검증
- **효과**: 환각 탐지율 향상, 결과물 신뢰도 증가

### 1.3 출처 패턴

```yaml
출처: SuperClaude Framework
위치: /SuperClaude_Framework/src/superclaude/pm_agent/self_check.py
검증: 4대 질문 + 7대 위험 신호 패턴
```

---

## 2. 상세 스펙

### 2.1 인터페이스 정의

```typescript
/**
 * 검증 증거
 */
export interface Evidence {
  /** 테스트 출력 결과 */
  testOutput?: string;
  /** 테스트 통과 여부 */
  testsPassed?: boolean;
  /** 요구사항 충족 목록 */
  requirementsList?: {
    requirement: string;
    met: boolean;
  }[];
  /** 가정 목록 */
  assumptions?: {
    assumption: string;
    verified: boolean;
    source?: string;
  }[];
  /** 증거 목록 */
  evidence?: {
    type: string;
    content: string;
  }[];
  /** 코드 변경 사항 */
  codeChanges?: {
    file: string;
    diff: string;
  }[];
}

/**
 * 자체 검사 질문
 */
export interface SelfCheckQuestion {
  /** 질문 고유 ID */
  id: string;
  /** 질문 내용 */
  question: string;
  /** 검증 함수 */
  validator: (evidence: Evidence) => Promise<boolean>;
  /** 필수 여부 */
  required: boolean;
}

/**
 * 위험 신호
 */
export interface DangerSignal {
  /** 탐지 패턴 */
  pattern: RegExp;
  /** 심각도 */
  severity: 'warning' | 'error';
  /** 메시지 */
  message: string;
}

/**
 * 자체 검사 결과
 */
export interface SelfCheckResult {
  /** 전체 통과 여부 */
  passed: boolean;
  /** 질문별 결과 */
  questions: {
    id: string;
    passed: boolean;
    evidence?: string;
  }[];
  /** 탐지된 위험 신호 */
  dangerSignals: {
    signal: string;
    found: boolean;
    context?: string;
  }[];
  /** GoalBackward 검증 결과 (선택) */
  goalVerification?: GoalBackwardResult;
}

/**
 * SelfCheckProtocol 인터페이스
 */
export interface ISelfCheckProtocol {
  /**
   * 자체 검사 실행
   * @param evidence 검증 증거
   * @returns 검사 결과
   */
  check(evidence: Evidence): Promise<SelfCheckResult>;

  /**
   * 위험 신호 스캔
   * @param text 스캔할 텍스트
   * @returns 발견된 위험 신호
   */
  scanForDangerSignals(text: string): { signal: string; context: string }[];

  /**
   * 질문 설정
   * @param questions 질문 배열
   */
  setQuestions(questions: SelfCheckQuestion[]): void;

  /**
   * 위험 신호 설정
   * @param signals 위험 신호 배열
   */
  setDangerSignals(signals: DangerSignal[]): void;
}
```

### 2.2 4대 자기 검사 질문

```typescript
/**
 * 4대 필수 질문 (SuperClaude 패턴)
 */
export const SELF_CHECK_QUESTIONS: SelfCheckQuestion[] = [
  {
    id: 'tests_pass',
    question: '모든 테스트 통과? (실제 출력 필수)',
    validator: async (evidence) => {
      return evidence.testOutput !== undefined && evidence.testsPassed === true;
    },
    required: true,
  },
  {
    id: 'requirements_met',
    question: '모든 요구사항 충족? (구체적 목록)',
    validator: async (evidence) => {
      if (!evidence.requirementsList || evidence.requirementsList.length === 0) {
        return false;
      }
      return evidence.requirementsList.every(r => r.met);
    },
    required: true,
  },
  {
    id: 'no_assumptions',
    question: '검증 없는 가정 없음? (문서 제시)',
    validator: async (evidence) => {
      if (!evidence.assumptions) {
        return true; // 가정이 없으면 통과
      }
      return evidence.assumptions.every(a => a.verified);
    },
    required: true,
  },
  {
    id: 'evidence_exists',
    question: '증거 있음? (테스트 결과, 코드 변경, 검증)',
    validator: async (evidence) => {
      const hasTestEvidence = evidence.testOutput !== undefined;
      const hasCodeEvidence = evidence.codeChanges && evidence.codeChanges.length > 0;
      const hasOtherEvidence = evidence.evidence && evidence.evidence.length > 0;
      return hasTestEvidence || hasCodeEvidence || hasOtherEvidence;
    },
    required: true,
  },
];
```

### 2.3 7대 위험 신호

```typescript
/**
 * 7대 위험 신호 패턴 (SuperClaude 패턴)
 */
export const DANGER_SIGNALS: DangerSignal[] = [
  {
    pattern: /should work/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "should work"',
  },
  {
    pattern: /probably/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "probably"',
  },
  {
    pattern: /I believe/i,
    severity: 'warning',
    message: '주관적 표현 감지: "I believe"',
  },
  {
    pattern: /I think/i,
    severity: 'warning',
    message: '주관적 표현 감지: "I think"',
  },
  {
    pattern: /typically/i,
    severity: 'warning',
    message: '일반화 표현 감지: "typically"',
  },
  {
    pattern: /usually/i,
    severity: 'warning',
    message: '일반화 표현 감지: "usually"',
  },
  {
    pattern: /without concrete evidence/i,
    severity: 'error',
    message: '증거 없는 주장 감지',
  },
];

/**
 * 추가 위험 신호 (확장)
 */
export const EXTENDED_DANGER_SIGNALS: DangerSignal[] = [
  ...DANGER_SIGNALS,
  {
    pattern: /might be/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "might be"',
  },
  {
    pattern: /could be/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "could be"',
  },
  {
    pattern: /perhaps/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "perhaps"',
  },
  {
    pattern: /assume/i,
    severity: 'warning',
    message: '가정 표현 감지: "assume"',
  },
  {
    pattern: /TODO|FIXME|HACK/i,
    severity: 'error',
    message: '미완성 마커 감지',
  },
];
```

---

## 3. 구현 가이드

### 3.1 파일 구조

```
src/core/validation/
├── index.ts                          # 모듈 엔트리포인트 (✅ 완료)
├── interfaces/
│   └── validation.interface.ts       # 인터페이스 정의 (✅ 완료)
├── confidence-checker.ts             # F001
└── self-check-protocol.ts            # ⏳ 구현 필요
```

### 3.2 클래스 구조

```typescript
// self-check-protocol.ts

import {
  ISelfCheckProtocol,
  Evidence,
  SelfCheckQuestion,
  DangerSignal,
  SelfCheckResult,
} from './interfaces/validation.interface.js';

/**
 * SelfCheckProtocol 구현체
 */
export class SelfCheckProtocol implements ISelfCheckProtocol {
  private questions: SelfCheckQuestion[] = [];
  private dangerSignals: DangerSignal[] = [];

  constructor(options?: {
    questions?: SelfCheckQuestion[];
    dangerSignals?: DangerSignal[];
  }) {
    if (options?.questions) {
      this.questions = options.questions;
    }
    if (options?.dangerSignals) {
      this.dangerSignals = options.dangerSignals;
    }
  }

  async check(evidence: Evidence): Promise<SelfCheckResult> {
    // 1. 질문별 검증 실행
    const questionResults = await Promise.all(
      this.questions.map(async (q) => ({
        id: q.id,
        passed: await q.validator(evidence),
        evidence: this.getEvidenceForQuestion(q.id, evidence),
      }))
    );

    // 2. 위험 신호 스캔
    const textToScan = this.collectTextForScan(evidence);
    const signalResults = this.scanForDangerSignals(textToScan);

    // 3. 전체 통과 여부 결정
    const requiredQuestionsPassed = this.questions
      .filter(q => q.required)
      .every(q => questionResults.find(r => r.id === q.id)?.passed);

    const noErrorSignals = !signalResults.some(
      s => this.dangerSignals.find(d => d.message === s.signal)?.severity === 'error'
    );

    const passed = requiredQuestionsPassed && noErrorSignals;

    return {
      passed,
      questions: questionResults,
      dangerSignals: this.dangerSignals.map(signal => ({
        signal: signal.message,
        found: signalResults.some(s => s.signal === signal.message),
        context: signalResults.find(s => s.signal === signal.message)?.context,
      })),
    };
  }

  scanForDangerSignals(text: string): { signal: string; context: string }[] {
    const results: { signal: string; context: string }[] = [];

    for (const signal of this.dangerSignals) {
      const match = text.match(signal.pattern);
      if (match) {
        // 매칭된 부분 주변 컨텍스트 추출
        const index = match.index ?? 0;
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + match[0].length + 50);
        const context = text.substring(start, end);

        results.push({
          signal: signal.message,
          context: `...${context}...`,
        });
      }
    }

    return results;
  }

  setQuestions(questions: SelfCheckQuestion[]): void {
    this.questions = questions;
  }

  setDangerSignals(signals: DangerSignal[]): void {
    this.dangerSignals = signals;
  }

  private getEvidenceForQuestion(questionId: string, evidence: Evidence): string {
    switch (questionId) {
      case 'tests_pass':
        return evidence.testOutput ?? 'No test output';
      case 'requirements_met':
        return JSON.stringify(evidence.requirementsList ?? []);
      case 'no_assumptions':
        return JSON.stringify(evidence.assumptions ?? []);
      case 'evidence_exists':
        return `Tests: ${!!evidence.testOutput}, Code: ${evidence.codeChanges?.length ?? 0} files`;
      default:
        return '';
    }
  }

  private collectTextForScan(evidence: Evidence): string {
    const parts: string[] = [];

    if (evidence.testOutput) {
      parts.push(evidence.testOutput);
    }

    if (evidence.evidence) {
      parts.push(...evidence.evidence.map(e => e.content));
    }

    if (evidence.assumptions) {
      parts.push(...evidence.assumptions.map(a => a.assumption));
    }

    return parts.join('\n');
  }
}

/**
 * SelfCheckProtocol 팩토리 함수
 */
export function createSelfCheckProtocol(
  options?: Parameters<typeof SelfCheckProtocol['prototype']['constructor']>[0]
): ISelfCheckProtocol {
  return new SelfCheckProtocol(options);
}

/**
 * 기본 설정으로 SelfCheckProtocol 생성
 */
export function createDefaultSelfCheckProtocol(): ISelfCheckProtocol {
  return createSelfCheckProtocol({
    questions: SELF_CHECK_QUESTIONS,
    dangerSignals: DANGER_SIGNALS,
  });
}
```

### 3.3 의존성

```yaml
내부_의존성:
  - src/core/validation/interfaces/validation.interface.ts
  - src/core/validation/goal-backward-verifier.ts (선택적)

외부_의존성:
  - 없음 (순수 TypeScript 구현)
```

---

## 4. 사용 예시

### 4.1 기본 사용

```typescript
import { createDefaultSelfCheckProtocol, Evidence } from '@core/validation';

// SelfCheckProtocol 생성
const selfCheck = createDefaultSelfCheckProtocol();

// 증거 수집
const evidence: Evidence = {
  testOutput: `
    PASS src/auth/login.test.ts
    PASS src/auth/logout.test.ts
    Test Suites: 2 passed, 2 total
  `,
  testsPassed: true,
  requirementsList: [
    { requirement: 'User can login with email/password', met: true },
    { requirement: 'User receives JWT token', met: true },
  ],
  codeChanges: [
    { file: 'src/auth/login.ts', diff: '+export function login() {...}' },
  ],
};

// 자체 검사 실행
const result = await selfCheck.check(evidence);

if (result.passed) {
  console.log('✅ 모든 검사 통과');
} else {
  console.log('❌ 검사 실패');
  console.log('실패한 질문:', result.questions.filter(q => !q.passed));
  console.log('발견된 위험 신호:', result.dangerSignals.filter(s => s.found));
}
```

### 4.2 위험 신호 스캔만 사용

```typescript
import { createDefaultSelfCheckProtocol } from '@core/validation';

const selfCheck = createDefaultSelfCheckProtocol();

const agentResponse = `
  I've implemented the login function. It should work correctly
  because I believe the authentication logic is sound.
  The user probably won't encounter any issues.
`;

const signals = selfCheck.scanForDangerSignals(agentResponse);

if (signals.length > 0) {
  console.log('⚠️ 위험 신호 발견:');
  signals.forEach(s => {
    console.log(`  - ${s.signal}`);
    console.log(`    컨텍스트: ${s.context}`);
  });
}
```

### 4.3 GoalBackwardVerifier와 결합

```typescript
import {
  createDefaultSelfCheckProtocol,
  createGoalBackwardVerifier,
} from '@core/validation';

const selfCheck = createDefaultSelfCheckProtocol();
const goalVerifier = createGoalBackwardVerifier();

async function validateTaskCompletion(
  evidence: Evidence,
  expectedPaths: string[]
): Promise<{ passed: boolean; details: string }> {
  // 1. SelfCheck 실행
  const selfCheckResult = await selfCheck.check(evidence);

  // 2. GoalBackward 검증
  const goalResult = await goalVerifier.verify({
    description: 'Task completion',
    expectedPaths,
  });

  // 3. 종합 판단
  const passed = selfCheckResult.passed && goalResult.passed;

  return {
    passed,
    details: `SelfCheck: ${selfCheckResult.passed}, GoalBackward: ${goalResult.passed}`,
  };
}
```

---

## 5. 검증 계획

### 5.1 단위 테스트

```typescript
// __tests__/self-check-protocol.test.ts

describe('SelfCheckProtocol', () => {
  describe('check()', () => {
    it('should pass when all evidence is provided', async () => {
      const protocol = createDefaultSelfCheckProtocol();

      const evidence: Evidence = {
        testOutput: 'All tests passed',
        testsPassed: true,
        requirementsList: [{ requirement: 'req1', met: true }],
        evidence: [{ type: 'test', content: 'passed' }],
      };

      const result = await protocol.check(evidence);
      expect(result.passed).toBe(true);
    });

    it('should fail when tests did not pass', async () => {
      const protocol = createDefaultSelfCheckProtocol();

      const evidence: Evidence = {
        testOutput: 'Tests failed',
        testsPassed: false,
      };

      const result = await protocol.check(evidence);
      expect(result.passed).toBe(false);
      expect(result.questions.find(q => q.id === 'tests_pass')?.passed).toBe(false);
    });

    it('should fail when unverified assumptions exist', async () => {
      const protocol = createDefaultSelfCheckProtocol();

      const evidence: Evidence = {
        testOutput: 'passed',
        testsPassed: true,
        requirementsList: [{ requirement: 'req1', met: true }],
        assumptions: [{ assumption: 'assume API is stable', verified: false }],
        evidence: [{ type: 'test', content: 'passed' }],
      };

      const result = await protocol.check(evidence);
      expect(result.passed).toBe(false);
    });
  });

  describe('scanForDangerSignals()', () => {
    it('should detect "should work" pattern', () => {
      const protocol = createDefaultSelfCheckProtocol();

      const text = 'This implementation should work correctly.';
      const signals = protocol.scanForDangerSignals(text);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].signal).toContain('should work');
    });

    it('should detect multiple patterns', () => {
      const protocol = createDefaultSelfCheckProtocol();

      const text = 'I think this should work. It will probably be fine.';
      const signals = protocol.scanForDangerSignals(text);

      expect(signals.length).toBe(3); // "I think", "should work", "probably"
    });

    it('should return empty array for clean text', () => {
      const protocol = createDefaultSelfCheckProtocol();

      const text = 'The tests confirm the implementation is correct. All assertions pass.';
      const signals = protocol.scanForDangerSignals(text);

      expect(signals.length).toBe(0);
    });
  });
});
```

### 5.2 통합 테스트

```typescript
// __tests__/integration/self-check-protocol.integration.test.ts

describe('SelfCheckProtocol Integration', () => {
  it('should integrate with real test output', async () => {
    const protocol = createDefaultSelfCheckProtocol();

    // 실제 테스트 실행 후 증거 수집
    const evidence: Evidence = {
      testOutput: execSync('npm test -- --json').toString(),
      testsPassed: true,
      // ... 실제 증거
    };

    const result = await protocol.check(evidence);
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('questions');
    expect(result).toHaveProperty('dangerSignals');
  });
});
```

### 5.3 환각 탐지 효과 측정

```yaml
환각_탐지_검증:
  방법: "라벨링된 테스트 데이터셋 사용"
  기간: "1주"

  테스트_데이터:
    - "환각이 포함된 응답 50개"
    - "정확한 응답 50개"

  측정_지표:
    - "True Positive Rate (환각 탐지율)"
    - "False Positive Rate (오탐율)"
    - "Precision / Recall"

  성공_기준:
    - "환각 탐지율 70%+"
    - "오탐율 20% 이하"
```

---

## 6. 체크리스트

### 6.1 구현 완료 조건

```markdown
## 필수 항목

- [ ] SelfCheckProtocol 클래스 구현
- [ ] ISelfCheckProtocol 인터페이스 준수
- [ ] 4대 자기 검사 질문 구현
- [ ] 7대 위험 신호 탐지 구현
- [ ] 증거 수집 및 검증 로직
- [ ] 통과/실패 판정 로직

## 테스트 항목

- [ ] 단위 테스트 작성 (커버리지 80%+)
- [ ] 통합 테스트 작성
- [ ] 환각 탐지 효과 측정

## 문서화 항목

- [ ] JSDoc 주석 추가
- [ ] 사용 예시 코드 작성
- [ ] index.ts에 export 추가

## 통합 항목

- [ ] GoalBackwardVerifier 연동
- [ ] Orchestrator 통합
- [ ] 로깅 추가
```

### 6.2 완료 검증

```yaml
완료_검증:
  코드_검증:
    - "tsc --noEmit 성공"
    - "eslint 경고 0개"
    - "테스트 전체 통과"

  기능_검증:
    - "4대 질문 각각 독립적으로 검증"
    - "7대 위험 신호 정확히 탐지"
    - "복합 시나리오 (질문 + 위험 신호) 정상 동작"

  성능_검증:
    - "단일 검사 50ms 이내"
    - "대용량 텍스트 스캔 200ms 이내"
```

---

## 문서 메타데이터

```yaml
문서_정보:
  Feature_ID: F002
  버전: 1.0
  작성일: 2026-02-06
  상태: 스펙 완료, 구현 대기

관련_문서:
  - F001-ConfidenceChecker.md
  - F003-GoalBackwardVerifier.md
  - validation.interface.ts

변경_이력:
  v1.0: 초기 버전 - 상세 스펙 작성
```
