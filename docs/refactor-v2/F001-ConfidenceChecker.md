# F001 - ConfidenceChecker (사전 실행 신뢰도 검사)

> **우선순위**: P0 (Critical Path)
> **모듈**: `src/core/validation/`
> **예상 ROI**: 25-250x
> **출처 패턴**: SuperClaude ConfidenceChecker

---

## 1. 개요

### 1.1 목적

태스크 실행 전에 신뢰도를 평가하여 **잘못된 방향의 작업을 사전에 방지**합니다. 100-200 토큰을 투자하여 5,000-50,000 토큰의 낭비를 방지합니다.

### 1.2 배경

- **문제**: 에이전트가 잘못된 방향으로 작업을 진행하여 토큰을 낭비
- **해결**: 작업 시작 전 체계적인 신뢰도 검사를 통해 조기 발견
- **효과**: 목표 ROI 25-250x (100-200 토큰 투자 → 5K-50K 토큰 절감)

### 1.3 출처 패턴

```yaml
출처: SuperClaude Framework
위치: /SuperClaude_Framework/src/superclaude/pm_agent/confidence.py
검증: 문서화된 ROI 수치 (실제 검증 필요)
```

---

## 2. 상세 스펙

### 2.1 인터페이스 정의

```typescript
/**
 * 태스크 컨텍스트 - 신뢰도 검사 입력
 */
export interface TaskContext {
  /** 태스크 고유 식별자 */
  taskId: string;
  /** 태스크 유형 (e.g., 'feature', 'bugfix', 'refactor') */
  taskType: string;
  /** 태스크 설명 */
  description: string;
  /** 관련 파일 목록 (선택) */
  files?: string[];
  /** 의존성 목록 (선택) */
  dependencies?: string[];
  /** 복잡도 (선택) */
  complexity?: 'simple' | 'moderate' | 'complex';
}

/**
 * 신뢰도 체크 항목
 */
export interface ConfidenceCheckItem {
  /** 체크 항목 고유명 */
  name: string;
  /** 가중치 (0-1, 총합 1) */
  weight: number;
  /** 체크 함수 */
  check: (context: TaskContext) => Promise<boolean>;
  /** 설명 (로깅용) */
  description?: string;
}

/**
 * 신뢰도 검사 결과
 */
export interface ConfidenceCheckResult {
  /** 전체 점수 (0-100) */
  score: number;
  /** 임계값 통과 여부 */
  passed: boolean;
  /** 사용된 임계값 */
  threshold: number;
  /** 개별 항목 결과 */
  items: {
    name: string;
    passed: boolean;
    weight: number;
  }[];
  /** 권장 행동 */
  recommendation: 'proceed' | 'alternatives' | 'stop';
  /** 권장 사유 */
  explanation?: string;
}

/**
 * ConfidenceChecker 인터페이스
 */
export interface IConfidenceChecker {
  /**
   * 신뢰도 검사 실행
   * @param context 태스크 컨텍스트
   * @returns 검사 결과
   */
  check(context: TaskContext): Promise<ConfidenceCheckResult>;

  /**
   * 체크 항목 설정
   * @param items 체크 항목 배열
   */
  setCheckItems(items: ConfidenceCheckItem[]): void;

  /**
   * 임계값 설정
   * @param proceed 즉시 진행 임계값 (기본: 90)
   * @param alternatives 대안 제시 임계값 (기본: 70)
   */
  setThresholds(proceed: number, alternatives: number): void;
}
```

### 2.2 기본 체크 항목

```typescript
/**
 * 5대 기본 체크 항목 (SuperClaude 패턴)
 */
export const DEFAULT_CHECK_ITEMS: Omit<ConfidenceCheckItem, 'check'>[] = [
  {
    name: 'duplicate_check_complete',
    weight: 0.25,
    description: '중복 코드/기능 확인 완료',
  },
  {
    name: 'architecture_check_complete',
    weight: 0.25,
    description: '아키텍처 적합성 확인 완료',
  },
  {
    name: 'official_docs_verified',
    weight: 0.20,
    description: '공식 문서 검증 완료',
  },
  {
    name: 'oss_reference_complete',
    weight: 0.15,
    description: 'OSS 참조 확인 완료',
  },
  {
    name: 'root_cause_identified',
    weight: 0.15,
    description: '근본 원인 식별 완료',
  },
];
```

### 2.3 임계값 및 동작

```typescript
/**
 * 기본 임계값
 */
export const DEFAULT_THRESHOLDS = {
  /** 90% 이상: 즉시 진행 */
  PROCEED: 90,
  /** 70% 이상: 대안 제시 */
  ALTERNATIVES: 70,
  /** 70% 미만: 중단 + 조사 */
} as const;

/**
 * 임계값별 동작
 *
 * score >= 90: recommendation = 'proceed'
 *   - 즉시 태스크 실행
 *   - 별도 확인 불필요
 *
 * 70 <= score < 90: recommendation = 'alternatives'
 *   - 대안 제시
 *   - 사용자 확인 후 진행
 *
 * score < 70: recommendation = 'stop'
 *   - 태스크 중단
 *   - 추가 조사 필요
 *   - 낮은 점수 항목 상세 분석
 */
```

### 2.4 점수 계산 알고리즘

```typescript
/**
 * 점수 계산 로직
 *
 * 1. 각 체크 항목 실행
 * 2. passed 시 해당 weight 누적
 * 3. 총점 = (누적 weight / 1.0) * 100
 */
function calculateScore(
  items: ConfidenceCheckItem[],
  results: boolean[]
): number {
  let totalWeight = 0;
  let passedWeight = 0;

  items.forEach((item, index) => {
    totalWeight += item.weight;
    if (results[index]) {
      passedWeight += item.weight;
    }
  });

  return Math.round((passedWeight / totalWeight) * 100);
}
```

---

## 3. 구현 가이드

### 3.1 파일 구조

```
src/core/validation/
├── index.ts                          # 모듈 엔트리포인트 (✅ 완료)
├── interfaces/
│   └── validation.interface.ts       # 인터페이스 정의 (✅ 완료)
└── confidence-checker.ts             # ⏳ 구현 필요
```

### 3.2 클래스 구조

```typescript
// confidence-checker.ts

import {
  IConfidenceChecker,
  TaskContext,
  ConfidenceCheckItem,
  ConfidenceCheckResult,
} from './interfaces/validation.interface.js';

/**
 * ConfidenceChecker 구현체
 */
export class ConfidenceChecker implements IConfidenceChecker {
  private checkItems: ConfidenceCheckItem[] = [];
  private proceedThreshold: number = 90;
  private alternativesThreshold: number = 70;

  constructor(options?: {
    checkItems?: ConfidenceCheckItem[];
    proceedThreshold?: number;
    alternativesThreshold?: number;
  }) {
    if (options?.checkItems) {
      this.checkItems = options.checkItems;
    }
    if (options?.proceedThreshold !== undefined) {
      this.proceedThreshold = options.proceedThreshold;
    }
    if (options?.alternativesThreshold !== undefined) {
      this.alternativesThreshold = options.alternativesThreshold;
    }
  }

  async check(context: TaskContext): Promise<ConfidenceCheckResult> {
    // 1. 각 체크 항목 실행
    const results = await Promise.all(
      this.checkItems.map(item => item.check(context))
    );

    // 2. 점수 계산
    const score = this.calculateScore(results);

    // 3. 권장 행동 결정
    const recommendation = this.getRecommendation(score);

    // 4. 결과 반환
    return {
      score,
      passed: score >= this.alternativesThreshold,
      threshold: this.proceedThreshold,
      items: this.checkItems.map((item, index) => ({
        name: item.name,
        passed: results[index],
        weight: item.weight,
      })),
      recommendation,
      explanation: this.getExplanation(recommendation, score),
    };
  }

  setCheckItems(items: ConfidenceCheckItem[]): void {
    this.checkItems = items;
  }

  setThresholds(proceed: number, alternatives: number): void {
    this.proceedThreshold = proceed;
    this.alternativesThreshold = alternatives;
  }

  private calculateScore(results: boolean[]): number {
    let passedWeight = 0;
    let totalWeight = 0;

    this.checkItems.forEach((item, index) => {
      totalWeight += item.weight;
      if (results[index]) {
        passedWeight += item.weight;
      }
    });

    return Math.round((passedWeight / totalWeight) * 100);
  }

  private getRecommendation(
    score: number
  ): 'proceed' | 'alternatives' | 'stop' {
    if (score >= this.proceedThreshold) {
      return 'proceed';
    } else if (score >= this.alternativesThreshold) {
      return 'alternatives';
    } else {
      return 'stop';
    }
  }

  private getExplanation(
    recommendation: 'proceed' | 'alternatives' | 'stop',
    score: number
  ): string {
    switch (recommendation) {
      case 'proceed':
        return `신뢰도 ${score}%: 즉시 진행 가능`;
      case 'alternatives':
        return `신뢰도 ${score}%: 대안 검토 후 진행 권장`;
      case 'stop':
        return `신뢰도 ${score}%: 추가 조사 필요, 태스크 중단 권장`;
    }
  }
}

/**
 * ConfidenceChecker 팩토리 함수
 */
export function createConfidenceChecker(
  options?: Parameters<typeof ConfidenceChecker['prototype']['constructor']>[0]
): IConfidenceChecker {
  return new ConfidenceChecker(options);
}
```

### 3.3 기본 체크 함수 구현

```typescript
// confidence-checker.ts (계속)

/**
 * 기본 체크 함수들
 */
export const defaultCheckFunctions = {
  /**
   * 중복 체크 완료 확인
   */
  async duplicateCheckComplete(context: TaskContext): Promise<boolean> {
    // 구현: 코드베이스에서 유사 기능 검색
    // 실제 구현에서는 Grep, Glob 등 사용
    return true; // placeholder
  },

  /**
   * 아키텍처 적합성 확인
   */
  async architectureCheckComplete(context: TaskContext): Promise<boolean> {
    // 구현: 아키텍처 문서와 비교
    // 실제 구현에서는 프로젝트 구조 분석
    return true; // placeholder
  },

  /**
   * 공식 문서 검증 완료
   */
  async officialDocsVerified(context: TaskContext): Promise<boolean> {
    // 구현: 관련 라이브러리/프레임워크 문서 확인
    // 실제 구현에서는 Context7 등 사용
    return true; // placeholder
  },

  /**
   * OSS 참조 완료
   */
  async ossReferenceComplete(context: TaskContext): Promise<boolean> {
    // 구현: 오픈소스 참조 구현 확인
    // 실제 구현에서는 GitHub 검색 등
    return true; // placeholder
  },

  /**
   * 근본 원인 식별 완료
   */
  async rootCauseIdentified(context: TaskContext): Promise<boolean> {
    // 구현: 버그픽스의 경우 근본 원인 분석
    // 실제 구현에서는 로그 분석, 스택 트레이스 등
    return context.taskType !== 'bugfix' || true; // placeholder
  },
};

/**
 * 기본 설정으로 ConfidenceChecker 생성
 */
export function createDefaultConfidenceChecker(): IConfidenceChecker {
  const checkItems: ConfidenceCheckItem[] = [
    {
      name: 'duplicate_check_complete',
      weight: 0.25,
      check: defaultCheckFunctions.duplicateCheckComplete,
      description: '중복 코드/기능 확인 완료',
    },
    {
      name: 'architecture_check_complete',
      weight: 0.25,
      check: defaultCheckFunctions.architectureCheckComplete,
      description: '아키텍처 적합성 확인 완료',
    },
    {
      name: 'official_docs_verified',
      weight: 0.20,
      check: defaultCheckFunctions.officialDocsVerified,
      description: '공식 문서 검증 완료',
    },
    {
      name: 'oss_reference_complete',
      weight: 0.15,
      check: defaultCheckFunctions.ossReferenceComplete,
      description: 'OSS 참조 확인 완료',
    },
    {
      name: 'root_cause_identified',
      weight: 0.15,
      check: defaultCheckFunctions.rootCauseIdentified,
      description: '근본 원인 식별 완료',
    },
  ];

  return createConfidenceChecker({ checkItems });
}
```

### 3.4 의존성

```yaml
내부_의존성:
  - src/core/validation/interfaces/validation.interface.ts

외부_의존성:
  - 없음 (순수 TypeScript 구현)

선택적_의존성:
  - Grep/Glob 도구 (중복 체크용)
  - Context7 MCP (문서 검증용)
```

---

## 4. 사용 예시

### 4.1 기본 사용

```typescript
import { createDefaultConfidenceChecker } from '@core/validation';

// ConfidenceChecker 생성
const checker = createDefaultConfidenceChecker();

// 태스크 컨텍스트 정의
const context = {
  taskId: 'task-001',
  taskType: 'feature',
  description: 'Add user authentication',
  files: ['src/auth/login.ts', 'src/auth/logout.ts'],
  complexity: 'moderate' as const,
};

// 신뢰도 검사 실행
const result = await checker.check(context);

// 결과 처리
if (result.recommendation === 'proceed') {
  console.log('✅ 즉시 진행');
} else if (result.recommendation === 'alternatives') {
  console.log('⚠️ 대안 검토 필요');
  console.log('낮은 점수 항목:', result.items.filter(i => !i.passed));
} else {
  console.log('❌ 추가 조사 필요');
  throw new Error(result.explanation);
}
```

### 4.2 커스텀 체크 항목 사용

```typescript
import { createConfidenceChecker, ConfidenceCheckItem } from '@core/validation';

// 커스텀 체크 항목
const customItems: ConfidenceCheckItem[] = [
  {
    name: 'security_review',
    weight: 0.3,
    check: async (ctx) => {
      // 보안 검토 완료 여부
      return ctx.files?.every(f => !f.includes('auth')) ?? true;
    },
    description: '보안 검토 완료',
  },
  {
    name: 'test_coverage',
    weight: 0.3,
    check: async (ctx) => {
      // 테스트 커버리지 확인
      return true; // 실제 구현 필요
    },
    description: '테스트 커버리지 확인',
  },
  {
    name: 'documentation',
    weight: 0.4,
    check: async (ctx) => {
      // 문서화 완료
      return true;
    },
    description: '문서화 완료',
  },
];

const checker = createConfidenceChecker({
  checkItems: customItems,
  proceedThreshold: 85,
  alternativesThreshold: 60,
});
```

### 4.3 Orchestrator 통합

```typescript
// orchestrator 내부에서 사용
class TaskOrchestrator {
  private confidenceChecker: IConfidenceChecker;

  constructor() {
    this.confidenceChecker = createDefaultConfidenceChecker();
  }

  async executeTask(task: Task): Promise<TaskResult> {
    // 1. 신뢰도 검사
    const context: TaskContext = {
      taskId: task.id,
      taskType: task.type,
      description: task.description,
      files: task.affectedFiles,
      complexity: task.complexity,
    };

    const confidence = await this.confidenceChecker.check(context);

    // 2. 권장 행동에 따른 분기
    switch (confidence.recommendation) {
      case 'proceed':
        return this.executeImmediately(task);
      case 'alternatives':
        return this.executeWithAlternatives(task, confidence);
      case 'stop':
        return this.stopAndInvestigate(task, confidence);
    }
  }
}
```

---

## 5. 검증 계획

### 5.1 단위 테스트

```typescript
// __tests__/confidence-checker.test.ts

describe('ConfidenceChecker', () => {
  describe('check()', () => {
    it('should return proceed when all checks pass', async () => {
      const checker = createConfidenceChecker({
        checkItems: [
          { name: 'test1', weight: 0.5, check: async () => true },
          { name: 'test2', weight: 0.5, check: async () => true },
        ],
      });

      const result = await checker.check({
        taskId: '1',
        taskType: 'feature',
        description: 'test',
      });

      expect(result.score).toBe(100);
      expect(result.recommendation).toBe('proceed');
    });

    it('should return stop when score is below 70', async () => {
      const checker = createConfidenceChecker({
        checkItems: [
          { name: 'test1', weight: 0.5, check: async () => false },
          { name: 'test2', weight: 0.5, check: async () => false },
        ],
      });

      const result = await checker.check({
        taskId: '1',
        taskType: 'feature',
        description: 'test',
      });

      expect(result.score).toBe(0);
      expect(result.recommendation).toBe('stop');
    });

    it('should return alternatives when score is between 70-90', async () => {
      const checker = createConfidenceChecker({
        checkItems: [
          { name: 'test1', weight: 0.4, check: async () => true },
          { name: 'test2', weight: 0.4, check: async () => true },
          { name: 'test3', weight: 0.2, check: async () => false },
        ],
      });

      const result = await checker.check({
        taskId: '1',
        taskType: 'feature',
        description: 'test',
      });

      expect(result.score).toBe(80);
      expect(result.recommendation).toBe('alternatives');
    });
  });

  describe('setThresholds()', () => {
    it('should use custom thresholds', async () => {
      const checker = createConfidenceChecker({
        checkItems: [
          { name: 'test', weight: 1.0, check: async () => true },
        ],
      });

      checker.setThresholds(95, 80);

      const result = await checker.check({
        taskId: '1',
        taskType: 'feature',
        description: 'test',
      });

      // 100점이지만 95 이상이므로 proceed
      expect(result.recommendation).toBe('proceed');
    });
  });
});
```

### 5.2 통합 테스트

```typescript
// __tests__/integration/confidence-checker.integration.test.ts

describe('ConfidenceChecker Integration', () => {
  it('should work with real file system checks', async () => {
    const checker = createDefaultConfidenceChecker();

    const context: TaskContext = {
      taskId: 'int-1',
      taskType: 'feature',
      description: 'Add validation module',
      files: ['src/core/validation/confidence-checker.ts'],
    };

    const result = await checker.check(context);

    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('recommendation');
    expect(result).toHaveProperty('items');
  });
});
```

### 5.3 성능 테스트

```typescript
// __tests__/performance/confidence-checker.perf.test.ts

describe('ConfidenceChecker Performance', () => {
  it('should complete check within 100ms', async () => {
    const checker = createDefaultConfidenceChecker();

    const context: TaskContext = {
      taskId: 'perf-1',
      taskType: 'feature',
      description: 'Performance test',
    };

    const start = Date.now();
    await checker.check(context);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should use less than 200 tokens equivalent', async () => {
    // 토큰 사용량 측정 (실제 구현 시)
    // 입력 + 출력 + 처리 로직 토큰 합계
    expect(true).toBe(true); // placeholder
  });
});
```

### 5.4 ROI 검증

```yaml
ROI_검증_계획:
  방법: "A/B 테스트"
  기간: "2주"

  실험_그룹:
    A_그룹: "ConfidenceChecker 적용"
    B_그룹: "ConfidenceChecker 미적용"

  측정_지표:
    - "잘못된 방향 작업 횟수"
    - "총 토큰 사용량"
    - "태스크 완료 시간"
    - "재작업 횟수"

  성공_기준:
    - "잘못된 방향 작업 50%+ 감소"
    - "총 토큰 사용량 20%+ 감소"
    - "ROI 10x 이상 달성"
```

---

## 6. 체크리스트

### 6.1 구현 완료 조건

```markdown
## 필수 항목

- [ ] ConfidenceChecker 클래스 구현
- [ ] IConfidenceChecker 인터페이스 준수
- [ ] 5대 기본 체크 항목 구현
- [ ] 임계값 로직 (90%/70%) 구현
- [ ] 점수 계산 알고리즘 구현
- [ ] 권장 행동 결정 로직 구현

## 테스트 항목

- [ ] 단위 테스트 작성 (커버리지 80%+)
- [ ] 통합 테스트 작성
- [ ] 성능 테스트 (100ms 이내)

## 문서화 항목

- [ ] JSDoc 주석 추가
- [ ] 사용 예시 코드 작성
- [ ] index.ts에 export 추가

## 통합 항목

- [ ] Orchestrator 통합
- [ ] 로깅 추가
- [ ] 메트릭 수집 연동
```

### 6.2 완료 검증

```yaml
완료_검증:
  코드_검증:
    - "tsc --noEmit 성공"
    - "eslint 경고 0개"
    - "테스트 전체 통과"

  기능_검증:
    - "모든 체크 통과 시 score=100, recommendation=proceed"
    - "일부 체크 실패 시 점수 정확히 계산"
    - "임계값 별 recommendation 정확히 반환"

  성능_검증:
    - "단일 검사 100ms 이내"
    - "메모리 누수 없음"
```

---

## 문서 메타데이터

```yaml
문서_정보:
  Feature_ID: F001
  버전: 1.0
  작성일: 2026-02-06
  상태: 스펙 완료, 구현 대기

관련_문서:
  - IMPLEMENTATION_PRIORITY_LIST.md
  - CODE_STRUCTURE_IMPROVEMENT_PLAN.md
  - validation.interface.ts

변경_이력:
  v1.0: 초기 버전 - 상세 스펙 작성
```
