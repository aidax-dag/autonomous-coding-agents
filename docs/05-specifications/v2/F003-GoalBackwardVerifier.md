# F003 - GoalBackwardVerifier (목표 역방향 검증)

> **우선순위**: P0 (Critical Path)
> **모듈**: `src/core/validation/`
> **효과**: Task Completion → Goal Achievement 검증 전환
> **출처 패턴**: get-shit-done Goal-Backward Verification
> **현재 코드 상태 (As-Is, 2026-02-06)**: ⚠️ 구현됨 (WIRED 검증은 스펙 대비 완화)

---

## 1. 개요

### 1.1 목적

"파일 존재 = 완료"가 아닌 **3단계 목표 달성 검증**을 통해 실제 구현이 완료되었는지 확인합니다.

### 1.2 배경

- **문제**: 파일이 생성되었지만 placeholder이거나, 시스템에 연결되지 않은 경우
- **해결**: exists → substantive → wired 3단계 검증
- **효과**: 미완성 코드 배포 방지, 실제 완료 보장

### 1.3 출처 패턴

```yaml
출처: get-shit-done Framework
위치: /get-shit-done/workflows/
검증: 3단계 Goal-Backward Verification
```

### 1.4 3단계 검증 개념

```
잘못된 검증:
  ❌ 파일 존재 = 완료

올바른 검증:
  ✅ Stage 1 (EXISTS): 파일이 예상 경로에 존재하는가?
  ✅ Stage 2 (SUBSTANTIVE): 실제 구현인가, placeholder 아닌가?
  ✅ Stage 3 (WIRED): 시스템에 연결되어 있는가?
```

---

## 2. 상세 스펙

### 2.1 인터페이스 정의

```typescript
/**
 * 검증 단계 열거형
 */
export enum VerificationStage {
  /** Stage 1: 파일 존재 확인 */
  EXISTS = 'exists',
  /** Stage 2: 실제 구현 확인 (placeholder 아님) */
  SUBSTANTIVE = 'substantive',
  /** Stage 3: 시스템 연결 확인 */
  WIRED = 'wired',
}

/**
 * 목표 정의
 */
export interface GoalDefinition {
  /** 목표 설명 */
  description: string;
  /** 예상 파일/경로 목록 */
  expectedPaths: string[];
  /** 예상 연결 (import/export) */
  expectedConnections?: string[];
  /** 예상 테스트 커버리지 */
  expectedTests?: string[];
}

/**
 * 목표 역방향 검증 결과
 */
export interface GoalBackwardResult {
  /** 전체 통과 여부 */
  passed: boolean;
  /** 단계별 결과 */
  stages: {
    stage: VerificationStage;
    passed: boolean;
    details: string;
    checkedPaths?: string[];
  }[];
}

/**
 * GoalBackwardVerifier 인터페이스
 */
export interface IGoalBackwardVerifier {
  /**
   * Stage 1: 파일 존재 확인
   * @param paths 확인할 경로 목록
   * @returns 모든 파일 존재 여부
   */
  verifyExists(paths: string[]): Promise<boolean>;

  /**
   * Stage 2: 실제 구현 확인
   * - TODO/FIXME/placeholder 탐지
   * - 최소 코드 복잡도 확인
   * @param paths 확인할 경로 목록
   * @returns 모든 파일이 실제 구현인지 여부
   */
  verifySubstantive(paths: string[]): Promise<boolean>;

  /**
   * Stage 3: 시스템 연결 확인
   * - import 추적
   * - 라우팅 확인
   * - 테스트 존재 확인
   * @param paths 확인할 경로 목록
   * @returns 시스템에 연결되어 있는지 여부
   */
  verifyWired(paths: string[]): Promise<boolean>;

  /**
   * 3단계 전체 검증 실행
   * @param goal 목표 정의
   * @returns 검증 결과
   */
  verify(goal: GoalDefinition): Promise<GoalBackwardResult>;
}
```

### 2.2 Placeholder 탐지 패턴

```typescript
/**
 * Placeholder/미완성 마커 패턴
 */
export const PLACEHOLDER_PATTERNS = [
  // 주석 마커
  /\/\/\s*TODO/i,
  /\/\/\s*FIXME/i,
  /\/\/\s*HACK/i,
  /\/\/\s*XXX/i,
  /\/\*\s*TODO/i,
  /#\s*TODO/i,

  // 미구현 표현
  /throw new Error\(['"]not implemented['"]\)/i,
  /throw new Error\(['"]TODO['"]\)/i,
  /NotImplementedError/i,

  // Placeholder 코드
  /placeholder/i,
  /stub/i,
  /mock\s+implementation/i,
  /dummy/i,

  // 빈 함수/클래스
  /\{\s*\}/, // 빈 블록 (주의: false positive 가능)
  /pass\s*$/, // Python pass
  /\.\.\./,   // TypeScript never
];

/**
 * 최소 코드 복잡도 기준
 */
export const MIN_COMPLEXITY_THRESHOLDS = {
  /** 최소 줄 수 (빈 줄, 주석 제외) */
  minLines: 5,
  /** 최소 함수/메서드 수 */
  minFunctions: 1,
  /** 최소 import 수 */
  minImports: 0,
};
```

### 2.3 연결 확인 패턴

```typescript
/**
 * 연결 확인 방법
 */
export const WIRING_CHECKS = {
  /**
   * Import 확인
   * - 다른 파일에서 해당 모듈을 import하는지 확인
   */
  checkImports: true,

  /**
   * Export 확인
   * - index.ts 등에서 re-export 되는지 확인
   */
  checkExports: true,

  /**
   * 라우팅 확인
   * - 라우터/컨트롤러에 등록되어 있는지 확인
   */
  checkRouting: true,

  /**
   * 테스트 확인
   * - 해당 모듈에 대한 테스트 파일 존재 확인
   */
  checkTests: true,
};
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
├── self-check-protocol.ts            # F002
└── goal-backward-verifier.ts         # ⏳ 구현 필요
```

### 3.2 클래스 구조

```typescript
// goal-backward-verifier.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  IGoalBackwardVerifier,
  GoalDefinition,
  GoalBackwardResult,
  VerificationStage,
} from './interfaces/validation.interface.js';

/**
 * GoalBackwardVerifier 구현체
 */
export class GoalBackwardVerifier implements IGoalBackwardVerifier {
  private projectRoot: string;
  private placeholderPatterns: RegExp[];
  private minComplexity: typeof MIN_COMPLEXITY_THRESHOLDS;

  constructor(options?: {
    projectRoot?: string;
    placeholderPatterns?: RegExp[];
    minComplexity?: typeof MIN_COMPLEXITY_THRESHOLDS;
  }) {
    this.projectRoot = options?.projectRoot ?? process.cwd();
    this.placeholderPatterns = options?.placeholderPatterns ?? PLACEHOLDER_PATTERNS;
    this.minComplexity = options?.minComplexity ?? MIN_COMPLEXITY_THRESHOLDS;
  }

  async verifyExists(paths: string[]): Promise<boolean> {
    const results = await Promise.all(
      paths.map(async (p) => {
        const fullPath = path.resolve(this.projectRoot, p);
        try {
          await fs.access(fullPath);
          return true;
        } catch {
          return false;
        }
      })
    );
    return results.every(Boolean);
  }

  async verifySubstantive(paths: string[]): Promise<boolean> {
    const results = await Promise.all(
      paths.map(async (p) => {
        const fullPath = path.resolve(this.projectRoot, p);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          return this.isSubstantive(content);
        } catch {
          return false;
        }
      })
    );
    return results.every(Boolean);
  }

  async verifyWired(paths: string[]): Promise<boolean> {
    const results = await Promise.all(
      paths.map(async (p) => {
        return this.checkWiring(p);
      })
    );
    return results.every(Boolean);
  }

  async verify(goal: GoalDefinition): Promise<GoalBackwardResult> {
    const stages: GoalBackwardResult['stages'] = [];

    // Stage 1: EXISTS
    const existsResult = await this.verifyExists(goal.expectedPaths);
    stages.push({
      stage: VerificationStage.EXISTS,
      passed: existsResult,
      details: existsResult
        ? '모든 파일이 예상 경로에 존재합니다.'
        : '일부 파일이 존재하지 않습니다.',
      checkedPaths: goal.expectedPaths,
    });

    if (!existsResult) {
      return { passed: false, stages };
    }

    // Stage 2: SUBSTANTIVE
    const substantiveResult = await this.verifySubstantive(goal.expectedPaths);
    stages.push({
      stage: VerificationStage.SUBSTANTIVE,
      passed: substantiveResult,
      details: substantiveResult
        ? '모든 파일이 실제 구현을 포함합니다.'
        : '일부 파일이 placeholder이거나 미완성입니다.',
      checkedPaths: goal.expectedPaths,
    });

    if (!substantiveResult) {
      return { passed: false, stages };
    }

    // Stage 3: WIRED
    const wiredResult = await this.verifyWired(goal.expectedPaths);
    stages.push({
      stage: VerificationStage.WIRED,
      passed: wiredResult,
      details: wiredResult
        ? '모든 파일이 시스템에 연결되어 있습니다.'
        : '일부 파일이 시스템에 연결되지 않았습니다.',
      checkedPaths: goal.expectedPaths,
    });

    return {
      passed: existsResult && substantiveResult && wiredResult,
      stages,
    };
  }

  /**
   * 실제 구현인지 확인 (placeholder 아님)
   */
  private isSubstantive(content: string): boolean {
    // 1. Placeholder 패턴 체크
    for (const pattern of this.placeholderPatterns) {
      if (pattern.test(content)) {
        return false;
      }
    }

    // 2. 최소 복잡도 체크
    const lines = content.split('\n').filter(
      line => line.trim() && !line.trim().startsWith('//')
    );

    if (lines.length < this.minComplexity.minLines) {
      return false;
    }

    // 3. 함수/클래스 존재 확인
    const functionPattern = /(?:function|const|let|var)\s+\w+\s*=?\s*(?:async\s*)?\(?|class\s+\w+/g;
    const functions = content.match(functionPattern) ?? [];

    if (functions.length < this.minComplexity.minFunctions) {
      return false;
    }

    return true;
  }

  /**
   * 시스템 연결 확인
   */
  private async checkWiring(filePath: string): Promise<boolean> {
    const fileName = path.basename(filePath, path.extname(filePath));
    const dirPath = path.dirname(path.resolve(this.projectRoot, filePath));

    // 1. 같은 디렉토리의 index.ts에서 export 확인
    const indexPath = path.join(dirPath, 'index.ts');
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      if (indexContent.includes(fileName)) {
        return true;
      }
    } catch {
      // index.ts가 없으면 다른 방법으로 확인
    }

    // 2. 프로젝트 전체에서 import 확인 (간단 버전)
    // 실제 구현에서는 Grep 등 사용
    return true; // placeholder - 실제 구현 필요
  }
}

/**
 * GoalBackwardVerifier 팩토리 함수
 */
export function createGoalBackwardVerifier(
  options?: Parameters<typeof GoalBackwardVerifier['prototype']['constructor']>[0]
): IGoalBackwardVerifier {
  return new GoalBackwardVerifier(options);
}
```

### 3.3 의존성

```yaml
내부_의존성:
  - src/core/validation/interfaces/validation.interface.ts

외부_의존성:
  - fs/promises (Node.js 내장)
  - path (Node.js 내장)

선택적_의존성:
  - Grep/Glob 도구 (연결 확인용)
```

---

## 4. 사용 예시

### 4.1 기본 사용

```typescript
import { createGoalBackwardVerifier } from '@core/validation';

const verifier = createGoalBackwardVerifier();

// 목표 정의
const goal = {
  description: 'Create login endpoint',
  expectedPaths: [
    'src/api/auth/login.ts',
    'src/api/auth/login.test.ts',
  ],
  expectedConnections: ['src/api/auth/index.ts'],
  expectedTests: ['src/api/auth/login.test.ts'],
};

// 검증 실행
const result = await verifier.verify(goal);

if (result.passed) {
  console.log('✅ 모든 검증 통과');
} else {
  console.log('❌ 검증 실패');
  result.stages.forEach(stage => {
    const icon = stage.passed ? '✅' : '❌';
    console.log(`  ${icon} ${stage.stage}: ${stage.details}`);
  });
}
```

### 4.2 단계별 사용

```typescript
import { createGoalBackwardVerifier } from '@core/validation';

const verifier = createGoalBackwardVerifier();

const paths = ['src/auth/login.ts', 'src/auth/logout.ts'];

// Stage 1: 파일 존재 확인
const exists = await verifier.verifyExists(paths);
console.log(`Stage 1 (EXISTS): ${exists ? 'PASS' : 'FAIL'}`);

if (exists) {
  // Stage 2: 실제 구현 확인
  const substantive = await verifier.verifySubstantive(paths);
  console.log(`Stage 2 (SUBSTANTIVE): ${substantive ? 'PASS' : 'FAIL'}`);

  if (substantive) {
    // Stage 3: 시스템 연결 확인
    const wired = await verifier.verifyWired(paths);
    console.log(`Stage 3 (WIRED): ${wired ? 'PASS' : 'FAIL'}`);
  }
}
```

### 4.3 SelfCheckProtocol과 결합

```typescript
import {
  createDefaultSelfCheckProtocol,
  createGoalBackwardVerifier,
} from '@core/validation';

const selfCheck = createDefaultSelfCheckProtocol();
const goalVerifier = createGoalBackwardVerifier();

async function fullValidation(
  evidence: Evidence,
  goal: GoalDefinition
): Promise<{ passed: boolean; selfCheck: SelfCheckResult; goalBackward: GoalBackwardResult }> {
  // 1. SelfCheck 실행
  const selfCheckResult = await selfCheck.check(evidence);

  // 2. GoalBackward 검증
  const goalBackwardResult = await goalVerifier.verify(goal);

  return {
    passed: selfCheckResult.passed && goalBackwardResult.passed,
    selfCheck: selfCheckResult,
    goalBackward: goalBackwardResult,
  };
}
```

---

## 5. 검증 계획

### 5.1 단위 테스트

```typescript
// __tests__/goal-backward-verifier.test.ts

describe('GoalBackwardVerifier', () => {
  describe('verifyExists()', () => {
    it('should return true when all files exist', async () => {
      const verifier = createGoalBackwardVerifier();
      const result = await verifier.verifyExists([
        'package.json', // 확실히 존재하는 파일
      ]);
      expect(result).toBe(true);
    });

    it('should return false when any file is missing', async () => {
      const verifier = createGoalBackwardVerifier();
      const result = await verifier.verifyExists([
        'package.json',
        'nonexistent-file.ts',
      ]);
      expect(result).toBe(false);
    });
  });

  describe('verifySubstantive()', () => {
    it('should return false for placeholder code', async () => {
      // 테스트 파일 생성 (TODO 포함)
      const testFile = '/tmp/test-placeholder.ts';
      await fs.writeFile(testFile, '// TODO: implement this');

      const verifier = createGoalBackwardVerifier({ projectRoot: '/tmp' });
      const result = await verifier.verifySubstantive(['test-placeholder.ts']);

      expect(result).toBe(false);
    });

    it('should return true for real implementation', async () => {
      const testFile = '/tmp/test-real.ts';
      await fs.writeFile(testFile, `
        export function calculate(a: number, b: number): number {
          if (a < 0 || b < 0) {
            throw new Error('Negative numbers not allowed');
          }
          return a + b;
        }
      `);

      const verifier = createGoalBackwardVerifier({ projectRoot: '/tmp' });
      const result = await verifier.verifySubstantive(['test-real.ts']);

      expect(result).toBe(true);
    });
  });

  describe('verify()', () => {
    it('should return all stages in correct order', async () => {
      const verifier = createGoalBackwardVerifier();
      const result = await verifier.verify({
        description: 'Test',
        expectedPaths: ['package.json'],
      });

      expect(result.stages).toHaveLength(3);
      expect(result.stages[0].stage).toBe('exists');
      expect(result.stages[1].stage).toBe('substantive');
      expect(result.stages[2].stage).toBe('wired');
    });

    it('should stop early if stage fails', async () => {
      const verifier = createGoalBackwardVerifier();
      const result = await verifier.verify({
        description: 'Test',
        expectedPaths: ['nonexistent.ts'],
      });

      expect(result.passed).toBe(false);
      expect(result.stages[0].passed).toBe(false);
      // Stage 2, 3는 실행되지 않음
    });
  });
});
```

### 5.2 통합 테스트

```typescript
// __tests__/integration/goal-backward-verifier.integration.test.ts

describe('GoalBackwardVerifier Integration', () => {
  it('should verify real project files', async () => {
    const verifier = createGoalBackwardVerifier({
      projectRoot: process.cwd(),
    });

    const result = await verifier.verify({
      description: 'Validation module',
      expectedPaths: [
        'src/core/validation/index.ts',
        'src/core/validation/interfaces/validation.interface.ts',
      ],
    });

    expect(result.stages[0].passed).toBe(true); // EXISTS
    expect(result.stages[1].passed).toBe(true); // SUBSTANTIVE
  });
});
```

---

## 6. 체크리스트

### 6.1 구현 완료 조건

```markdown
## 필수 항목

- [ ] GoalBackwardVerifier 클래스 구현
- [ ] IGoalBackwardVerifier 인터페이스 준수
- [ ] Stage 1 (EXISTS) 구현 - 파일 존재 확인
- [ ] Stage 2 (SUBSTANTIVE) 구현 - placeholder 탐지
- [ ] Stage 3 (WIRED) 구현 - 시스템 연결 확인
- [ ] verify() 메서드 - 3단계 전체 실행

## 테스트 항목

- [ ] 단위 테스트 작성 (커버리지 80%+)
- [ ] 통합 테스트 작성
- [ ] placeholder 탐지 정확도 테스트

## 문서화 항목

- [ ] JSDoc 주석 추가
- [ ] 사용 예시 코드 작성
- [ ] index.ts에 export 추가

## 통합 항목

- [ ] SelfCheckProtocol 연동
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
    - "Stage 1: 파일 존재 여부 정확히 판단"
    - "Stage 2: TODO/FIXME/placeholder 탐지"
    - "Stage 3: import/export 연결 확인"
    - "실패 시 early return 동작"

  성능_검증:
    - "100개 파일 검증 1초 이내"
```

---

## 문서 메타데이터

```yaml
문서_정보:
  Feature_ID: F003
  버전: 1.0
  작성일: 2026-02-06
  상태: 스펙 완료, 구현 대기

관련_문서:
  - F001-ConfidenceChecker.md
  - F002-SelfCheckProtocol.md
  - validation.interface.ts

변경_이력:
  v1.0: 초기 버전 - 상세 스펙 작성
```
