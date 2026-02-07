# F004 - ReflexionPattern (에러 학습 시스템)

> **우선순위**: P1 (High Value)
> **모듈**: `src/core/learning/`
> **효과**: 에러 재발률 <10%, 캐시 히트 시 0 토큰
> **출처 패턴**: SuperClaude ReflexionPattern
> **현재 코드 상태 (As-Is, 2026-02-06)**: ✅ 구현 및 단위 테스트 존재

---

## 1. 개요

### 1.1 목적

에러 발생 시 **기존 해결책을 조회**하고, 새로운 해결책을 **학습하여 저장**함으로써 동일 에러의 재발을 방지합니다.

### 1.2 배경

- **문제**: 동일한 에러가 반복 발생하여 매번 동일한 조사/해결 과정을 거침
- **해결**: 에러-해결책 매핑을 저장하고 캐시 기반으로 즉시 해결
- **효과**: 캐시 히트 시 0 토큰 사용, 에러 재발률 10% 미만

### 1.3 출처 패턴

```yaml
출처: SuperClaude Framework
위치: /SuperClaude_Framework/src/superclaude/pm_agent/reflexion.py
검증: 에러 학습 및 예방 프레임워크
```

### 1.4 토큰 절감 효과

```
Cache Hit (기존 에러):
  - 조회: 0 토큰
  - 즉시 해결책 반환

Cache Miss (신규 에러):
  - 조사: 1,000-2,000 토큰
  - 해결책 도출 및 저장
  - 다음 발생 시 0 토큰
```

---

## 2. 상세 스펙

### 2.1 인터페이스 정의

```typescript
/**
 * 학습된 해결책
 */
export interface LearnedSolution {
  /** 고유 식별자 */
  id: string;
  /** 에러 타입/카테고리 */
  errorType: string;
  /** 원본 에러 메시지 */
  errorMessage: string;
  /** 에러 시그니처 (정규화된 해시) */
  errorSignature: string;
  /** 식별된 근본 원인 */
  rootCause: string;
  /** 적용된 해결책 */
  solution: string;
  /** 예방 체크리스트 */
  prevention: string[];
  /** 생성 시간 */
  createdAt: Date;
  /** 마지막 사용 시간 */
  lastUsedAt?: Date;
  /** 성공 적용 횟수 */
  successCount: number;
  /** 실패 적용 횟수 */
  failureCount: number;
  /** 태그 (분류용) */
  tags?: string[];
}

/**
 * Reflexion 조회 결과
 */
export interface ReflexionResult {
  /** 캐시 히트 여부 */
  cacheHit: boolean;
  /** 찾은 해결책 (있는 경우) */
  solution?: LearnedSolution;
  /** 사용된 토큰 수 (캐시 히트=0, 미스=1-2K) */
  tokensUsed: number;
  /** 해결책 신뢰도 */
  confidence?: number;
}

/**
 * ReflexionPattern 인터페이스
 */
export interface IReflexionPattern {
  /**
   * 기존 해결책 조회
   * @param error 발생한 에러
   * @returns 학습된 해결책 (없으면 null)
   */
  lookup(error: Error): Promise<LearnedSolution | null>;

  /**
   * 새로운 해결책 학습
   * @param error 원본 에러
   * @param solution 해결책
   * @param rootCause 근본 원인
   */
  learn(error: Error, solution: string, rootCause: string): Promise<void>;

  /**
   * 에러 타입별 예방 체크리스트 반환
   * @param errorType 에러 타입
   * @returns 예방 체크리스트
   */
  getPreventionChecklist(errorType: string): string[];

  /**
   * 해결책 적용 결과 기록
   * @param solutionId 해결책 ID
   * @param success 성공 여부
   */
  recordOutcome(solutionId: string, success: boolean): Promise<void>;

  /**
   * 통계 조회
   */
  getStats(): Promise<{
    totalSolutions: number;
    totalLookups: number;
    cacheHitRate: number;
    avgSuccessRate: number;
  }>;
}
```

### 2.2 에러 시그니처 생성

```typescript
/**
 * 에러 시그니처 생성 알고리즘
 *
 * 목적: 유사한 에러를 동일하게 매칭하기 위한 정규화
 */
export function generateErrorSignature(error: Error): string {
  const errorType = error.constructor.name;

  // 에러 메시지 정규화
  const normalizedMessage = error.message
    // 숫자 → 'N'
    .replace(/\d+/g, 'N')
    // 따옴표 내 문자열 → 'STR'
    .replace(/['"][^'"]+['"]/g, 'STR')
    // 파일 경로 → 'PATH'
    .replace(/\/[^\s]+/g, 'PATH')
    // UUID → 'UUID'
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    // 연속 공백 → 단일 공백
    .replace(/\s+/g, ' ')
    // 길이 제한
    .slice(0, 200);

  return `${errorType}:${normalizedMessage}`;
}

/**
 * 에러 카테고리 분류
 */
export const ERROR_CATEGORIES = {
  SYNTAX: ['SyntaxError', 'ParseError'],
  TYPE: ['TypeError', 'TypeMismatchError'],
  RUNTIME: ['RuntimeError', 'ReferenceError', 'RangeError'],
  NETWORK: ['NetworkError', 'FetchError', 'TimeoutError'],
  FILE: ['FileNotFoundError', 'PermissionError', 'IOError'],
  VALIDATION: ['ValidationError', 'SchemaError'],
  AUTH: ['AuthenticationError', 'AuthorizationError'],
  CONFIG: ['ConfigurationError', 'EnvironmentError'],
} as const;

export function classifyError(error: Error): string {
  const errorName = error.constructor.name;

  for (const [category, types] of Object.entries(ERROR_CATEGORIES)) {
    if (types.some(t => errorName.includes(t) ||
        error.message.toLowerCase().includes(t.toLowerCase()))) {
      return category;
    }
  }

  return 'UNKNOWN';
}
```

### 2.3 저장소 형식

```typescript
/**
 * 저장소 설정
 */
export const STORAGE_CONFIG = {
  /** 저장 파일 경로 */
  filePath: 'docs/memory/solutions_learned.jsonl',
  /** 최대 저장 개수 */
  maxEntries: 1000,
  /** 오래된 항목 정리 기간 (일) */
  retentionDays: 365,
  /** 백업 활성화 */
  enableBackup: true,
};

/**
 * JSONL 형식 (한 줄에 하나의 JSON 객체)
 *
 * 장점:
 * - 추가 쓰기 용이 (append)
 * - 부분 읽기 가능
 * - 손상 시 복구 용이
 */

// 예시 저장 형식
// {"id":"sol-001","errorType":"TypeError",...}\n
// {"id":"sol-002","errorType":"NetworkError",...}\n
```

---

## 3. 구현 가이드

### 3.1 파일 구조

```
src/core/learning/
├── index.ts                          # 모듈 엔트리포인트 (✅ 완료)
├── interfaces/
│   └── learning.interface.ts         # 인터페이스 정의 (✅ 완료)
├── reflexion-pattern.ts              # ⏳ 구현 필요
├── instinct-store.ts                 # F005
└── solutions-cache.ts                # F006
```

### 3.2 클래스 구조

```typescript
// reflexion-pattern.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import {
  IReflexionPattern,
  LearnedSolution,
  ReflexionResult,
} from './interfaces/learning.interface.js';
import {
  generateErrorSignature,
  classifyError,
  STORAGE_CONFIG,
} from './index.js';

/**
 * ReflexionPattern 구현체
 */
export class ReflexionPattern implements IReflexionPattern {
  private solutions: Map<string, LearnedSolution> = new Map();
  private filePath: string;
  private lookupCount: number = 0;
  private hitCount: number = 0;

  constructor(options?: {
    filePath?: string;
  }) {
    this.filePath = options?.filePath ?? STORAGE_CONFIG.filePath;
  }

  /**
   * 초기화 - 파일에서 기존 해결책 로드
   */
  async initialize(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        const solution = JSON.parse(line) as LearnedSolution;
        this.solutions.set(solution.errorSignature, solution);
      }
    } catch (error) {
      // 파일이 없으면 빈 상태로 시작
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async lookup(error: Error): Promise<LearnedSolution | null> {
    this.lookupCount++;

    const signature = generateErrorSignature(error);
    const solution = this.solutions.get(signature);

    if (solution) {
      this.hitCount++;
      // 마지막 사용 시간 업데이트
      solution.lastUsedAt = new Date();
      return solution;
    }

    return null;
  }

  async learn(error: Error, solution: string, rootCause: string): Promise<void> {
    const signature = generateErrorSignature(error);
    const errorType = classifyError(error);

    const learned: LearnedSolution = {
      id: uuid(),
      errorType,
      errorMessage: error.message,
      errorSignature: signature,
      rootCause,
      solution,
      prevention: this.generatePreventionChecklist(errorType, rootCause),
      createdAt: new Date(),
      successCount: 0,
      failureCount: 0,
      tags: [errorType],
    };

    // 메모리에 저장
    this.solutions.set(signature, learned);

    // 파일에 추가
    await this.appendToFile(learned);
  }

  getPreventionChecklist(errorType: string): string[] {
    const defaultChecklist = [
      '유사 에러 발생 여부 확인',
      '코드 변경 전 테스트 작성',
      '변경 후 전체 테스트 실행',
    ];

    const typeSpecificChecklist: Record<string, string[]> = {
      TYPE: [
        '타입 정의 확인',
        'null/undefined 체크 추가',
        'TypeScript strict 모드 활성화',
      ],
      NETWORK: [
        '네트워크 타임아웃 설정 확인',
        '재시도 로직 구현',
        '오프라인 처리 추가',
      ],
      FILE: [
        '파일 경로 존재 확인',
        '권한 설정 확인',
        '에러 핸들링 추가',
      ],
      AUTH: [
        '토큰 만료 처리 확인',
        '권한 검증 로직 확인',
        '보안 로깅 추가',
      ],
    };

    return [...defaultChecklist, ...(typeSpecificChecklist[errorType] ?? [])];
  }

  async recordOutcome(solutionId: string, success: boolean): Promise<void> {
    for (const solution of this.solutions.values()) {
      if (solution.id === solutionId) {
        if (success) {
          solution.successCount++;
        } else {
          solution.failureCount++;
        }
        break;
      }
    }

    // 파일 업데이트 (전체 재작성 또는 부분 업데이트)
    await this.saveToFile();
  }

  async getStats(): Promise<{
    totalSolutions: number;
    totalLookups: number;
    cacheHitRate: number;
    avgSuccessRate: number;
  }> {
    let totalSuccess = 0;
    let totalAttempts = 0;

    for (const solution of this.solutions.values()) {
      totalSuccess += solution.successCount;
      totalAttempts += solution.successCount + solution.failureCount;
    }

    return {
      totalSolutions: this.solutions.size,
      totalLookups: this.lookupCount,
      cacheHitRate: this.lookupCount > 0
        ? this.hitCount / this.lookupCount
        : 0,
      avgSuccessRate: totalAttempts > 0
        ? totalSuccess / totalAttempts
        : 0,
    };
  }

  private generatePreventionChecklist(errorType: string, rootCause: string): string[] {
    const baseChecklist = this.getPreventionChecklist(errorType);

    // 근본 원인 기반 추가 체크리스트
    const rootCauseBased: string[] = [];
    if (rootCause.includes('null') || rootCause.includes('undefined')) {
      rootCauseBased.push('null/undefined 방어 코드 추가');
    }
    if (rootCause.includes('async') || rootCause.includes('await')) {
      rootCauseBased.push('비동기 에러 핸들링 확인');
    }

    return [...baseChecklist, ...rootCauseBased];
  }

  private async appendToFile(solution: LearnedSolution): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(this.filePath, JSON.stringify(solution) + '\n');
  }

  private async saveToFile(): Promise<void> {
    const content = Array.from(this.solutions.values())
      .map(s => JSON.stringify(s))
      .join('\n');
    await fs.writeFile(this.filePath, content + '\n');
  }
}

/**
 * ReflexionPattern 팩토리 함수
 */
export async function createReflexionPattern(
  options?: Parameters<typeof ReflexionPattern['prototype']['constructor']>[0]
): Promise<IReflexionPattern> {
  const pattern = new ReflexionPattern(options);
  await pattern.initialize();
  return pattern;
}
```

### 3.3 의존성

```yaml
내부_의존성:
  - src/core/learning/interfaces/learning.interface.ts
  - src/core/learning/solutions-cache.ts (선택적)

외부_의존성:
  - fs/promises (Node.js 내장)
  - path (Node.js 내장)
  - uuid (UUID 생성)
```

---

## 4. 사용 예시

### 4.1 기본 사용

```typescript
import { createReflexionPattern } from '@core/learning';

// ReflexionPattern 생성 및 초기화
const reflexion = await createReflexionPattern();

try {
  // 코드 실행
  await someRiskyOperation();
} catch (error) {
  // 1. 기존 해결책 조회
  const existingSolution = await reflexion.lookup(error as Error);

  if (existingSolution) {
    console.log('✅ 캐시 히트! 기존 해결책 적용:');
    console.log(`  해결책: ${existingSolution.solution}`);
    console.log(`  예방: ${existingSolution.prevention.join(', ')}`);

    // 해결책 적용
    await applySolution(existingSolution.solution);

    // 결과 기록
    await reflexion.recordOutcome(existingSolution.id, true);
  } else {
    console.log('❌ 캐시 미스. 새로운 해결책 도출 필요.');

    // 해결책 도출 (실제로는 AI 분석 등)
    const solution = await investigateAndSolve(error);
    const rootCause = await identifyRootCause(error);

    // 새로운 해결책 학습
    await reflexion.learn(error as Error, solution, rootCause);
  }
}
```

### 4.2 예방 체크리스트 사용

```typescript
import { createReflexionPattern, classifyError } from '@core/learning';

const reflexion = await createReflexionPattern();

// 에러 타입별 예방 체크리스트 조회
const errorType = classifyError(new TypeError('Cannot read property'));
const checklist = reflexion.getPreventionChecklist(errorType);

console.log(`${errorType} 에러 예방 체크리스트:`);
checklist.forEach((item, i) => {
  console.log(`  ${i + 1}. ${item}`);
});
```

### 4.3 통계 모니터링

```typescript
import { createReflexionPattern } from '@core/learning';

const reflexion = await createReflexionPattern();

// 주기적 통계 확인
setInterval(async () => {
  const stats = await reflexion.getStats();

  console.log('=== ReflexionPattern 통계 ===');
  console.log(`총 해결책: ${stats.totalSolutions}개`);
  console.log(`총 조회: ${stats.totalLookups}회`);
  console.log(`캐시 히트율: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`평균 성공률: ${(stats.avgSuccessRate * 100).toFixed(1)}%`);
}, 60000); // 1분마다
```

---

## 5. 검증 계획

### 5.1 단위 테스트

```typescript
// __tests__/reflexion-pattern.test.ts

describe('ReflexionPattern', () => {
  describe('lookup()', () => {
    it('should return null for new error', async () => {
      const pattern = await createReflexionPattern({
        filePath: '/tmp/test-solutions.jsonl',
      });

      const error = new Error('New error');
      const result = await pattern.lookup(error);

      expect(result).toBeNull();
    });

    it('should return solution for known error', async () => {
      const pattern = await createReflexionPattern({
        filePath: '/tmp/test-solutions.jsonl',
      });

      const error = new TypeError('Cannot read property x');

      // 학습
      await pattern.learn(error, 'Add null check', 'Missing null check');

      // 조회
      const result = await pattern.lookup(error);

      expect(result).not.toBeNull();
      expect(result?.solution).toBe('Add null check');
    });
  });

  describe('generateErrorSignature()', () => {
    it('should normalize similar errors to same signature', () => {
      const error1 = new Error('Cannot read property x of undefined at line 10');
      const error2 = new Error('Cannot read property y of undefined at line 20');

      const sig1 = generateErrorSignature(error1);
      const sig2 = generateErrorSignature(error2);

      expect(sig1).toBe(sig2);
    });
  });

  describe('recordOutcome()', () => {
    it('should increment success count', async () => {
      const pattern = await createReflexionPattern({
        filePath: '/tmp/test-solutions.jsonl',
      });

      const error = new Error('Test error');
      await pattern.learn(error, 'solution', 'cause');

      const solution = await pattern.lookup(error);
      expect(solution?.successCount).toBe(0);

      await pattern.recordOutcome(solution!.id, true);

      const updated = await pattern.lookup(error);
      expect(updated?.successCount).toBe(1);
    });
  });
});
```

### 5.2 성능 테스트

```typescript
// __tests__/performance/reflexion-pattern.perf.test.ts

describe('ReflexionPattern Performance', () => {
  it('should lookup in < 10ms for 1000 solutions', async () => {
    const pattern = await createReflexionPattern({
      filePath: '/tmp/perf-solutions.jsonl',
    });

    // 1000개 해결책 학습
    for (let i = 0; i < 1000; i++) {
      const error = new Error(`Error type ${i}`);
      await pattern.learn(error, `Solution ${i}`, `Cause ${i}`);
    }

    // 조회 성능 측정
    const error = new Error('Error type 500');
    const start = Date.now();
    await pattern.lookup(error);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(10);
  });
});
```

### 5.3 재발률 측정

```yaml
재발률_측정:
  방법: "2주 간 에러 로그 분석"

  측정_지표:
    - "동일 에러 타입 재발 횟수"
    - "캐시 히트 후 해결 성공률"
    - "학습 후 재발까지 시간"

  성공_기준:
    - "에러 재발률 10% 미만"
    - "캐시 히트 시 해결 성공률 80%+"
```

---

## 6. 체크리스트

### 6.1 구현 완료 조건

```markdown
## 필수 항목

- [ ] ReflexionPattern 클래스 구현
- [ ] IReflexionPattern 인터페이스 준수
- [ ] lookup() - 에러 시그니처 기반 조회
- [ ] learn() - 새 해결책 학습 및 저장
- [ ] getPreventionChecklist() - 예방 체크리스트
- [ ] recordOutcome() - 결과 기록
- [ ] getStats() - 통계 조회
- [ ] JSONL 파일 저장/로드

## 테스트 항목

- [ ] 단위 테스트 작성 (커버리지 80%+)
- [ ] 성능 테스트 (1000개 조회 < 10ms)
- [ ] 재발률 측정 테스트

## 문서화 항목

- [ ] JSDoc 주석 추가
- [ ] 사용 예시 코드 작성
- [ ] index.ts에 export 추가
```

### 6.2 완료 검증

```yaml
완료_검증:
  코드_검증:
    - "tsc --noEmit 성공"
    - "eslint 경고 0개"
    - "테스트 전체 통과"

  기능_검증:
    - "에러 시그니처 정규화 정상"
    - "JSONL 저장/로드 정상"
    - "캐시 히트율 측정 가능"

  성능_검증:
    - "1000개 해결책 조회 < 10ms"
    - "파일 I/O 비동기 처리"
```

---

## 문서 메타데이터

```yaml
문서_정보:
  Feature_ID: F004
  버전: 1.0
  작성일: 2026-02-06
  상태: 스펙 완료, 구현 대기

관련_문서:
  - F005-InstinctStore.md
  - F006-SolutionsCache.md
  - learning.interface.ts

변경_이력:
  v1.0: 초기 버전 - 상세 스펙 작성
```
