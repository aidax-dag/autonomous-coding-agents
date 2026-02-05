# F007 - QualityCurve

> **우선순위**: P2 (Optimization)
> **모듈**: `src/core/context/`
> **상태**: ⏳ 대기
> **의존성**: P0, P1 완료 후
> **출처 패턴**: get-shit-done (Context Engineering)

---

## 1. 개요

### 1.1 목적

QualityCurve는 **컨텍스트 사용률에 따른 출력 품질 레벨을 관리하는 시스템**입니다. 컨텍스트 윈도우의 사용률이 증가함에 따라 출력 품질이 저하되는 현상을 인식하고, 각 레벨에 맞는 최적화 전략을 제시합니다.

### 1.2 핵심 가치

| 측면 | 설명 |
|-----|------|
| 품질 인식 | 컨텍스트 사용률에 따른 품질 레벨 자동 판별 |
| 전략 제안 | 각 레벨에 맞는 최적화/압축 전략 제안 |
| 선제적 관리 | 품질 저하 전에 새 계획 시작 권장 |
| 리소스 효율 | 토큰 예산 내에서 최적의 품질 유지 |

### 1.3 품질 곡선 시각화

```
품질
 ▲
 │ PEAK ████████████████░░░░░░░░░░░░░░░░░░░░░░░░
 │      (0-30%)     │
 │                  ▼
 │ GOOD  ░░░░░░░░░░███████████████░░░░░░░░░░░░░░
 │                 (30-50%)      │
 │                               ▼
 │ DEGRADING ░░░░░░░░░░░░░░░░░░░████████████░░░░
 │                              (50-70%)   │
 │                                         ▼
 │ POOR  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█████
 │                                       (70%+)
 └────────────────────────────────────────────► 컨텍스트 사용률
  0%         30%         50%         70%     100%
```

### 1.4 출처 패턴

```yaml
get-shit-done:
  Context_Engineering:
    원칙: "Quality depends on context usage"
    레벨:
      - "PEAK (0-30%): Comprehensive, thorough"
      - "GOOD (30-50%): Confident, solid"
      - "DEGRADING (50-70%): Efficiency mode"
      - "POOR (70%+): Rushed, minimal"
    권장: "Start new plan at 50% context usage"
```

---

## 2. 상세 스펙

### 2.1 인터페이스 정의

```typescript
// src/core/context/interfaces/quality-curve.interface.ts

/**
 * 품질 레벨 열거형
 */
export enum QualityLevel {
  PEAK = 'peak',           // 0-30%: 포괄적, 철저함
  GOOD = 'good',           // 30-50%: 확신, 견고함
  DEGRADING = 'degrading', // 50-70%: 효율 모드
  POOR = 'poor',           // 70%+: 급한, 최소한
}

/**
 * 품질 레벨 정보
 */
export interface QualityLevelInfo {
  level: QualityLevel;
  label: string;
  description: string;
  rangeStart: number;        // 시작 퍼센트
  rangeEnd: number;          // 종료 퍼센트
  characteristics: string[];
  recommendations: string[];
  compressionStrategy: CompressionStrategy;
}

/**
 * 압축 전략
 */
export interface CompressionStrategy {
  name: string;
  tokenReduction: number;    // 예상 토큰 감소율 (0-1)
  qualityImpact: number;     // 품질 영향 (0-1, 높을수록 부정적)
  techniques: CompressionTechnique[];
}

/**
 * 압축 기법
 */
export interface CompressionTechnique {
  name: string;
  description: string;
  applicableTo: ('code' | 'text' | 'data' | 'all')[];
  tokenSaving: number;       // 예상 토큰 절감량
  enabled: boolean;
}

/**
 * 컨텍스트 상태
 */
export interface ContextState {
  totalTokens: number;
  usedTokens: number;
  usagePercent: number;
  qualityLevel: QualityLevel;
  remainingTokens: number;
  estimatedTasksRemaining: number;
  shouldStartNewPlan: boolean;
  warnings: ContextWarning[];
}

/**
 * 컨텍스트 경고
 */
export interface ContextWarning {
  type: 'usage' | 'quality' | 'budget' | 'efficiency';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestion?: string;
}

/**
 * 계획 권장사항
 */
export interface PlanRecommendation {
  shouldStartNew: boolean;
  reason?: string;
  estimatedTasksRemaining: number;
  qualityPrediction: QualityLevel;
  suggestions: string[];
}

/**
 * IQualityCurve 인터페이스
 */
export interface IQualityCurve {
  // 품질 레벨 조회
  getLevel(usagePercent: number): QualityLevel;
  getLevelInfo(level: QualityLevel): QualityLevelInfo;
  getCurrentLevel(): Promise<QualityLevel>;

  // 권장사항
  getRecommendations(level: QualityLevel): string[];
  getCompressionStrategy(level: QualityLevel): CompressionStrategy;
  getPlanRecommendation(usagePercent: number, tasksRemaining: number): PlanRecommendation;

  // 상태 분석
  analyzeContextState(used: number, total: number): ContextState;
  shouldStartNewPlan(usagePercent: number): boolean;
  estimateQualityDegradation(currentUsage: number, additionalTokens: number): QualityLevel;

  // 최적화
  suggestOptimizations(state: ContextState): OptimizationSuggestion[];
  calculateOptimalTaskCount(remainingTokens: number): number;

  // 이벤트
  onLevelChange(callback: (oldLevel: QualityLevel, newLevel: QualityLevel) => void): void;
}

/**
 * 최적화 제안
 */
export interface OptimizationSuggestion {
  type: 'compress' | 'summarize' | 'offload' | 'prioritize' | 'defer';
  description: string;
  estimatedSaving: number;    // 예상 토큰 절감
  priority: 'high' | 'medium' | 'low';
  applicable: boolean;
}
```

### 2.2 상수 및 설정값

```typescript
// src/core/context/constants/quality-curve.constants.ts

import { QualityLevel, QualityLevelInfo, CompressionTechnique } from '../interfaces/quality-curve.interface';

/**
 * 품질 레벨 임계값
 */
export const QUALITY_THRESHOLDS = {
  PEAK_END: 30,          // PEAK: 0-30%
  GOOD_END: 50,          // GOOD: 30-50%
  DEGRADING_END: 70,     // DEGRADING: 50-70%
  // POOR: 70%+
} as const;

/**
 * 품질 레벨 상세 정보
 */
export const QUALITY_LEVEL_INFO: Record<QualityLevel, QualityLevelInfo> = {
  [QualityLevel.PEAK]: {
    level: QualityLevel.PEAK,
    label: '최고 품질',
    description: '포괄적이고 철저한 분석 가능',
    rangeStart: 0,
    rangeEnd: 30,
    characteristics: [
      '전체 코드베이스 분석 가능',
      '상세한 설명과 예시 제공',
      '대안 솔루션 탐색 가능',
      '철저한 에러 핸들링',
      '완전한 문서화 지원',
    ],
    recommendations: [
      '복잡한 아키텍처 결정에 적합',
      '종합적인 코드 리뷰 수행',
      '새로운 기능 설계에 최적',
      '테스트 커버리지 확장',
    ],
    compressionStrategy: {
      name: 'none',
      tokenReduction: 0,
      qualityImpact: 0,
      techniques: [],
    },
  },

  [QualityLevel.GOOD]: {
    level: QualityLevel.GOOD,
    label: '양호 품질',
    description: '확신 있고 견고한 작업 가능',
    rangeStart: 30,
    rangeEnd: 50,
    characteristics: [
      '핵심 기능 구현에 충분',
      '적절한 설명 제공',
      '주요 에러 케이스 처리',
      '기본 문서화 지원',
    ],
    recommendations: [
      '일반적인 기능 구현에 적합',
      '버그 수정 작업 진행',
      '계획당 2-3개 태스크 권장',
      '새 계획 시작 고려 (50% 접근 시)',
    ],
    compressionStrategy: {
      name: 'light',
      tokenReduction: 0.1,
      qualityImpact: 0.05,
      techniques: [
        { name: 'remove_verbose_comments', description: '장황한 주석 제거', applicableTo: ['code'], tokenSaving: 50, enabled: true },
      ],
    },
  },

  [QualityLevel.DEGRADING]: {
    level: QualityLevel.DEGRADING,
    label: '품질 저하',
    description: '효율 모드 - 핵심에 집중',
    rangeStart: 50,
    rangeEnd: 70,
    characteristics: [
      '핵심 기능만 구현',
      '간결한 설명',
      '주요 에러만 처리',
      '최소 문서화',
    ],
    recommendations: [
      '⚠️ 새 계획 시작 강력 권장',
      '진행 중인 태스크만 완료',
      '복잡한 작업 연기',
      '출력 압축 활성화',
    ],
    compressionStrategy: {
      name: 'moderate',
      tokenReduction: 0.25,
      qualityImpact: 0.15,
      techniques: [
        { name: 'remove_verbose_comments', description: '장황한 주석 제거', applicableTo: ['code'], tokenSaving: 50, enabled: true },
        { name: 'summarize_explanations', description: '설명 요약', applicableTo: ['text'], tokenSaving: 100, enabled: true },
        { name: 'abbreviate_identifiers', description: '식별자 축약 (문서 내)', applicableTo: ['text'], tokenSaving: 30, enabled: true },
      ],
    },
  },

  [QualityLevel.POOR]: {
    level: QualityLevel.POOR,
    label: '낮은 품질',
    description: '급한 최소한의 작업만 가능',
    rangeStart: 70,
    rangeEnd: 100,
    characteristics: [
      '기본 기능만 구현',
      '최소한의 설명',
      '에러 핸들링 제한',
      '문서화 생략',
    ],
    recommendations: [
      '🚨 즉시 새 계획 시작 필수',
      '현재 태스크 빠르게 마무리',
      '새로운 작업 시작 금지',
      '최대 압축 모드 활성화',
    ],
    compressionStrategy: {
      name: 'aggressive',
      tokenReduction: 0.4,
      qualityImpact: 0.3,
      techniques: [
        { name: 'remove_all_comments', description: '모든 주석 제거', applicableTo: ['code'], tokenSaving: 80, enabled: true },
        { name: 'minimal_output', description: '최소 출력 모드', applicableTo: ['all'], tokenSaving: 200, enabled: true },
        { name: 'skip_examples', description: '예시 생략', applicableTo: ['text'], tokenSaving: 150, enabled: true },
        { name: 'code_only', description: '코드만 출력', applicableTo: ['code'], tokenSaving: 100, enabled: true },
      ],
    },
  },
};

/**
 * 계획 설정
 */
export const PLAN_CONFIG = {
  RECOMMENDED_TASKS_PER_PLAN: 3,     // 계획당 2-3개 태스크 권장
  TARGET_CONTEXT_USAGE: 50,          // 목표 컨텍스트 사용률 (%)
  NEW_PLAN_THRESHOLD: 50,            // 새 계획 시작 권장 임계값 (%)
  CRITICAL_THRESHOLD: 70,            // 즉시 새 계획 필요 임계값 (%)
  TOKENS_PER_TASK_ESTIMATE: 3000,    // 태스크당 예상 토큰
} as const;

/**
 * 경고 메시지 템플릿
 */
export const WARNING_TEMPLATES = {
  approaching_good: {
    type: 'usage' as const,
    severity: 'info' as const,
    message: '컨텍스트 사용률이 30%에 접근 중입니다.',
    suggestion: '계획을 검토하고 불필요한 컨텍스트를 정리하세요.',
  },
  entering_degrading: {
    type: 'quality' as const,
    severity: 'warning' as const,
    message: '⚠️ 품질 저하 구간 진입. 컨텍스트 사용률 50% 초과.',
    suggestion: '새 계획 시작을 강력히 권장합니다.',
  },
  entering_poor: {
    type: 'quality' as const,
    severity: 'critical' as const,
    message: '🚨 낮은 품질 구간 진입. 컨텍스트 사용률 70% 초과.',
    suggestion: '즉시 새 계획을 시작하세요. 새로운 작업을 시작하지 마세요.',
  },
  budget_critical: {
    type: 'budget' as const,
    severity: 'critical' as const,
    message: '🚨 토큰 예산이 거의 소진되었습니다.',
    suggestion: '현재 태스크를 빠르게 마무리하고 새 세션을 시작하세요.',
  },
};
```

---

## 3. 구현 가이드

### 3.1 파일 위치

```
src/core/context/
├── index.ts
├── interfaces/
│   ├── context.interface.ts
│   └── quality-curve.interface.ts
├── constants/
│   └── quality-curve.constants.ts
├── quality-curve.ts             # 메인 구현
└── compression-manager.ts       # 압축 전략 관리
```

### 3.2 클래스 구조

```typescript
// src/core/context/quality-curve.ts

import {
  IQualityCurve,
  QualityLevel,
  QualityLevelInfo,
  CompressionStrategy,
  ContextState,
  ContextWarning,
  PlanRecommendation,
  OptimizationSuggestion,
} from './interfaces/quality-curve.interface';
import {
  QUALITY_THRESHOLDS,
  QUALITY_LEVEL_INFO,
  PLAN_CONFIG,
  WARNING_TEMPLATES,
} from './constants/quality-curve.constants';

/**
 * QualityCurve
 *
 * 컨텍스트 사용률에 따른 품질 레벨 관리
 */
export class QualityCurve implements IQualityCurve {
  private levelChangeCallbacks: Array<(oldLevel: QualityLevel, newLevel: QualityLevel) => void> = [];
  private currentLevel: QualityLevel = QualityLevel.PEAK;
  private contextProvider?: () => Promise<{ used: number; total: number }>;

  constructor(contextProvider?: () => Promise<{ used: number; total: number }>) {
    this.contextProvider = contextProvider;
  }

  /**
   * 사용률에 따른 품질 레벨 반환
   */
  getLevel(usagePercent: number): QualityLevel {
    if (usagePercent < QUALITY_THRESHOLDS.PEAK_END) {
      return QualityLevel.PEAK;
    } else if (usagePercent < QUALITY_THRESHOLDS.GOOD_END) {
      return QualityLevel.GOOD;
    } else if (usagePercent < QUALITY_THRESHOLDS.DEGRADING_END) {
      return QualityLevel.DEGRADING;
    } else {
      return QualityLevel.POOR;
    }
  }

  /**
   * 품질 레벨 상세 정보 반환
   */
  getLevelInfo(level: QualityLevel): QualityLevelInfo {
    return QUALITY_LEVEL_INFO[level];
  }

  /**
   * 현재 품질 레벨 조회 (비동기)
   */
  async getCurrentLevel(): Promise<QualityLevel> {
    if (this.contextProvider) {
      const { used, total } = await this.contextProvider();
      const usagePercent = (used / total) * 100;
      const newLevel = this.getLevel(usagePercent);

      if (newLevel !== this.currentLevel) {
        this.notifyLevelChange(this.currentLevel, newLevel);
        this.currentLevel = newLevel;
      }

      return this.currentLevel;
    }

    return this.currentLevel;
  }

  /**
   * 품질 레벨별 권장사항 반환
   */
  getRecommendations(level: QualityLevel): string[] {
    return QUALITY_LEVEL_INFO[level].recommendations;
  }

  /**
   * 품질 레벨별 압축 전략 반환
   */
  getCompressionStrategy(level: QualityLevel): CompressionStrategy {
    return QUALITY_LEVEL_INFO[level].compressionStrategy;
  }

  /**
   * 계획 권장사항 반환
   */
  getPlanRecommendation(usagePercent: number, tasksRemaining: number): PlanRecommendation {
    const currentLevel = this.getLevel(usagePercent);
    const shouldStartNew = this.shouldStartNewPlan(usagePercent);

    // 남은 토큰으로 처리 가능한 태스크 수 추정
    const remainingCapacity = 100 - usagePercent;
    const estimatedTasksRemaining = Math.floor(
      (remainingCapacity / 100) * PLAN_CONFIG.RECOMMENDED_TASKS_PER_PLAN * 2
    );

    // 다음 태스크 완료 후 예상 품질 레벨
    const tokenPerTask = 100 / PLAN_CONFIG.RECOMMENDED_TASKS_PER_PLAN / 2;
    const nextUsage = usagePercent + tokenPerTask;
    const qualityPrediction = this.getLevel(nextUsage);

    const suggestions: string[] = [];

    if (shouldStartNew) {
      suggestions.push('새 계획을 시작하여 최적의 품질을 유지하세요.');
    }

    if (tasksRemaining > estimatedTasksRemaining) {
      suggestions.push(`남은 ${tasksRemaining}개 태스크 중 ${estimatedTasksRemaining}개만 현재 세션에서 처리 권장.`);
      suggestions.push('나머지 태스크는 새 세션에서 처리하세요.');
    }

    if (currentLevel === QualityLevel.DEGRADING || currentLevel === QualityLevel.POOR) {
      suggestions.push('출력 압축 전략 활성화를 권장합니다.');
    }

    return {
      shouldStartNew,
      reason: shouldStartNew
        ? `컨텍스트 사용률 ${usagePercent.toFixed(0)}%가 임계값 ${PLAN_CONFIG.NEW_PLAN_THRESHOLD}%를 초과했습니다.`
        : undefined,
      estimatedTasksRemaining,
      qualityPrediction,
      suggestions,
    };
  }

  /**
   * 컨텍스트 상태 분석
   */
  analyzeContextState(used: number, total: number): ContextState {
    const usagePercent = (used / total) * 100;
    const qualityLevel = this.getLevel(usagePercent);
    const remainingTokens = total - used;

    // 남은 토큰으로 처리 가능한 태스크 수
    const estimatedTasksRemaining = Math.floor(
      remainingTokens / PLAN_CONFIG.TOKENS_PER_TASK_ESTIMATE
    );

    // 경고 생성
    const warnings: ContextWarning[] = [];

    if (usagePercent >= 25 && usagePercent < 30) {
      warnings.push(WARNING_TEMPLATES.approaching_good);
    }

    if (usagePercent >= QUALITY_THRESHOLDS.GOOD_END && usagePercent < QUALITY_THRESHOLDS.GOOD_END + 5) {
      warnings.push(WARNING_TEMPLATES.entering_degrading);
    }

    if (usagePercent >= QUALITY_THRESHOLDS.DEGRADING_END && usagePercent < QUALITY_THRESHOLDS.DEGRADING_END + 5) {
      warnings.push(WARNING_TEMPLATES.entering_poor);
    }

    if (usagePercent >= 90) {
      warnings.push(WARNING_TEMPLATES.budget_critical);
    }

    return {
      totalTokens: total,
      usedTokens: used,
      usagePercent,
      qualityLevel,
      remainingTokens,
      estimatedTasksRemaining,
      shouldStartNewPlan: this.shouldStartNewPlan(usagePercent),
      warnings,
    };
  }

  /**
   * 새 계획 시작 여부 판단
   */
  shouldStartNewPlan(usagePercent: number): boolean {
    return usagePercent >= PLAN_CONFIG.NEW_PLAN_THRESHOLD;
  }

  /**
   * 품질 저하 예측
   */
  estimateQualityDegradation(currentUsage: number, additionalTokens: number): QualityLevel {
    const total = 100; // 가정: 100%가 전체
    const newUsage = currentUsage + (additionalTokens / (total * PLAN_CONFIG.TOKENS_PER_TASK_ESTIMATE) * 100);
    return this.getLevel(newUsage);
  }

  /**
   * 최적화 제안
   */
  suggestOptimizations(state: ContextState): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const level = state.qualityLevel;

    // 품질 저하 구간에서의 제안
    if (level === QualityLevel.DEGRADING || level === QualityLevel.POOR) {
      suggestions.push({
        type: 'compress',
        description: '출력 압축 활성화',
        estimatedSaving: 500,
        priority: 'high',
        applicable: true,
      });

      suggestions.push({
        type: 'summarize',
        description: '긴 설명을 요약으로 대체',
        estimatedSaving: 300,
        priority: 'medium',
        applicable: true,
      });
    }

    // 낮은 품질 구간에서의 추가 제안
    if (level === QualityLevel.POOR) {
      suggestions.push({
        type: 'defer',
        description: '복잡한 태스크 다음 세션으로 연기',
        estimatedSaving: 1000,
        priority: 'high',
        applicable: state.estimatedTasksRemaining < 2,
      });

      suggestions.push({
        type: 'prioritize',
        description: '필수 태스크만 우선 처리',
        estimatedSaving: 500,
        priority: 'high',
        applicable: true,
      });
    }

    // 토큰 부족 시 제안
    if (state.remainingTokens < PLAN_CONFIG.TOKENS_PER_TASK_ESTIMATE) {
      suggestions.push({
        type: 'offload',
        description: '히스토리 요약 및 새 세션 시작',
        estimatedSaving: state.usedTokens * 0.8,
        priority: 'high',
        applicable: true,
      });
    }

    return suggestions;
  }

  /**
   * 최적 태스크 수 계산
   */
  calculateOptimalTaskCount(remainingTokens: number): number {
    // 안전 마진 포함 (80%)
    const safeTokens = remainingTokens * 0.8;
    return Math.max(1, Math.floor(safeTokens / PLAN_CONFIG.TOKENS_PER_TASK_ESTIMATE));
  }

  /**
   * 레벨 변경 콜백 등록
   */
  onLevelChange(callback: (oldLevel: QualityLevel, newLevel: QualityLevel) => void): void {
    this.levelChangeCallbacks.push(callback);
  }

  // === Private Methods ===

  private notifyLevelChange(oldLevel: QualityLevel, newLevel: QualityLevel): void {
    for (const callback of this.levelChangeCallbacks) {
      try {
        callback(oldLevel, newLevel);
      } catch (error) {
        console.error('Level change callback error:', error);
      }
    }
  }
}
```

---

## 4. 사용 예시

### 4.1 기본 사용

```typescript
import { QualityCurve, QualityLevel } from '@/core/context';

const curve = new QualityCurve();

// 현재 사용률로 품질 레벨 확인
const usagePercent = 45;
const level = curve.getLevel(usagePercent);

console.log(`Current level: ${level}`); // 'good'

// 레벨 정보 조회
const info = curve.getLevelInfo(level);
console.log(`Label: ${info.label}`);
console.log(`Characteristics:`, info.characteristics);
console.log(`Recommendations:`, info.recommendations);
```

### 4.2 컨텍스트 상태 분석

```typescript
// 컨텍스트 상태 분석
const state = curve.analyzeContextState(60000, 128000);

console.log(`Usage: ${state.usagePercent.toFixed(1)}%`);
console.log(`Quality Level: ${state.qualityLevel}`);
console.log(`Remaining Tasks: ~${state.estimatedTasksRemaining}`);
console.log(`Should Start New Plan: ${state.shouldStartNewPlan}`);

// 경고 확인
for (const warning of state.warnings) {
  console.log(`[${warning.severity}] ${warning.message}`);
  if (warning.suggestion) {
    console.log(`  → ${warning.suggestion}`);
  }
}
```

### 4.3 계획 권장사항

```typescript
// 현재 상황에서 계획 권장사항 얻기
const recommendation = curve.getPlanRecommendation(55, 5);

if (recommendation.shouldStartNew) {
  console.log(`⚠️ ${recommendation.reason}`);
}

console.log(`Estimated tasks remaining: ${recommendation.estimatedTasksRemaining}`);
console.log(`Quality after next task: ${recommendation.qualityPrediction}`);

for (const suggestion of recommendation.suggestions) {
  console.log(`  - ${suggestion}`);
}
```

### 4.4 레벨 변경 모니터링

```typescript
// 레벨 변경 시 알림 받기
curve.onLevelChange((oldLevel, newLevel) => {
  console.log(`Quality level changed: ${oldLevel} → ${newLevel}`);

  if (newLevel === QualityLevel.DEGRADING) {
    console.log('⚠️ Entering degrading quality zone');
  } else if (newLevel === QualityLevel.POOR) {
    console.log('🚨 Critical: Quality is now poor. Start new session!');
  }
});
```

### 4.5 압축 전략 적용

```typescript
// 현재 레벨에 맞는 압축 전략 얻기
const strategy = curve.getCompressionStrategy(QualityLevel.DEGRADING);

console.log(`Compression strategy: ${strategy.name}`);
console.log(`Expected token reduction: ${(strategy.tokenReduction * 100).toFixed(0)}%`);
console.log(`Quality impact: ${(strategy.qualityImpact * 100).toFixed(0)}%`);

console.log('Techniques:');
for (const tech of strategy.techniques) {
  if (tech.enabled) {
    console.log(`  ✓ ${tech.name}: ${tech.description}`);
  }
}
```

### 4.6 최적화 제안

```typescript
const state = curve.analyzeContextState(80000, 100000);
const optimizations = curve.suggestOptimizations(state);

console.log('Optimization Suggestions:');
for (const opt of optimizations) {
  if (opt.applicable) {
    console.log(`[${opt.priority}] ${opt.type}: ${opt.description}`);
    console.log(`  Estimated saving: ~${opt.estimatedSaving} tokens`);
  }
}
```

---

## 5. 검증 계획

### 5.1 단위 테스트

```typescript
// tests/unit/context/quality-curve.test.ts

describe('QualityCurve', () => {
  let curve: QualityCurve;

  beforeEach(() => {
    curve = new QualityCurve();
  });

  describe('getLevel', () => {
    it('should return PEAK for 0-30%', () => {
      expect(curve.getLevel(0)).toBe(QualityLevel.PEAK);
      expect(curve.getLevel(15)).toBe(QualityLevel.PEAK);
      expect(curve.getLevel(29)).toBe(QualityLevel.PEAK);
    });

    it('should return GOOD for 30-50%', () => {
      expect(curve.getLevel(30)).toBe(QualityLevel.GOOD);
      expect(curve.getLevel(40)).toBe(QualityLevel.GOOD);
      expect(curve.getLevel(49)).toBe(QualityLevel.GOOD);
    });

    it('should return DEGRADING for 50-70%', () => {
      expect(curve.getLevel(50)).toBe(QualityLevel.DEGRADING);
      expect(curve.getLevel(60)).toBe(QualityLevel.DEGRADING);
      expect(curve.getLevel(69)).toBe(QualityLevel.DEGRADING);
    });

    it('should return POOR for 70%+', () => {
      expect(curve.getLevel(70)).toBe(QualityLevel.POOR);
      expect(curve.getLevel(85)).toBe(QualityLevel.POOR);
      expect(curve.getLevel(100)).toBe(QualityLevel.POOR);
    });
  });

  describe('shouldStartNewPlan', () => {
    it('should return false below 50%', () => {
      expect(curve.shouldStartNewPlan(30)).toBe(false);
      expect(curve.shouldStartNewPlan(49)).toBe(false);
    });

    it('should return true at or above 50%', () => {
      expect(curve.shouldStartNewPlan(50)).toBe(true);
      expect(curve.shouldStartNewPlan(75)).toBe(true);
    });
  });

  describe('analyzeContextState', () => {
    it('should calculate correct usage percent', () => {
      const state = curve.analyzeContextState(50000, 100000);
      expect(state.usagePercent).toBe(50);
    });

    it('should include warnings for degrading quality', () => {
      const state = curve.analyzeContextState(51000, 100000);
      expect(state.warnings.length).toBeGreaterThan(0);
      expect(state.warnings.some(w => w.severity === 'warning')).toBe(true);
    });

    it('should include critical warnings for poor quality', () => {
      const state = curve.analyzeContextState(71000, 100000);
      expect(state.warnings.some(w => w.severity === 'critical')).toBe(true);
    });
  });

  describe('getCompressionStrategy', () => {
    it('should return no compression for PEAK', () => {
      const strategy = curve.getCompressionStrategy(QualityLevel.PEAK);
      expect(strategy.tokenReduction).toBe(0);
      expect(strategy.techniques.length).toBe(0);
    });

    it('should return aggressive compression for POOR', () => {
      const strategy = curve.getCompressionStrategy(QualityLevel.POOR);
      expect(strategy.tokenReduction).toBeGreaterThan(0.3);
      expect(strategy.techniques.length).toBeGreaterThan(2);
    });
  });

  describe('onLevelChange', () => {
    it('should notify on level change', async () => {
      let notified = false;
      let oldLevel: QualityLevel | null = null;
      let newLevel: QualityLevel | null = null;

      const providerCurve = new QualityCurve(async () => ({ used: 60, total: 100 }));

      providerCurve.onLevelChange((old, curr) => {
        notified = true;
        oldLevel = old;
        newLevel = curr;
      });

      await providerCurve.getCurrentLevel();

      expect(notified).toBe(true);
      expect(oldLevel).toBe(QualityLevel.PEAK);
      expect(newLevel).toBe(QualityLevel.DEGRADING);
    });
  });
});
```

### 5.2 통합 테스트

```typescript
// tests/integration/context/quality-monitoring.test.ts

describe('Quality Monitoring Integration', () => {
  it('should integrate with context manager', async () => {
    const contextManager = new ContextManager();
    const curve = new QualityCurve(async () => ({
      used: contextManager.getUsedTokens(),
      total: contextManager.getTotalTokens(),
    }));

    // 시뮬레이션: 토큰 사용
    await contextManager.addContent('Hello world', 100);

    const level = await curve.getCurrentLevel();
    expect([QualityLevel.PEAK, QualityLevel.GOOD]).toContain(level);

    // 대량 토큰 사용
    await contextManager.addContent('Large content...', 50000);

    const newLevel = await curve.getCurrentLevel();
    expect([QualityLevel.DEGRADING, QualityLevel.POOR]).toContain(newLevel);
  });
});
```

---

## 6. 체크리스트

### 6.1 구현 완료 조건

```markdown
## QualityCurve 구현 체크리스트

### 핵심 기능
- [ ] 품질 레벨 판별 (PEAK/GOOD/DEGRADING/POOR)
- [ ] 레벨별 권장사항 제공
- [ ] 압축 전략 제공
- [ ] 새 계획 시작 권장 판단

### 상태 분석
- [ ] 컨텍스트 상태 분석
- [ ] 경고 생성
- [ ] 최적화 제안

### 이벤트
- [ ] 레벨 변경 콜백
- [ ] 비동기 레벨 조회

### 테스트
- [ ] 단위 테스트 커버리지 >80%
- [ ] 통합 테스트 완료

### 통합
- [ ] context/index.ts에 export 추가
- [ ] ContextManager와 연동
- [ ] TokenBudgetManager와 연동
```

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.0
  작성일: 2026-02-06
  상태: 활성 (Active)

변경_이력:
  v1.0: 초기 버전 - QualityCurve 상세 스펙 정의

다음_갱신:
  예정일: 구현 시작 시
  담당: 프로젝트 소유자
```
