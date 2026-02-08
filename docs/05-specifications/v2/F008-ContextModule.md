# F008 - Context Module 통합

> **우선순위**: P2 (Optimization)
> **모듈**: `src/core/context/`
> **상태**: ✅ 완료
> **의존성**: F007 (QualityCurve)
> **리스크**: Medium (기존 코드 이동 필요)
> **현재 코드 상태**: ✅ 통합 완료 (1,963줄), 단위 테스트 106개 통과

---

## 1. 개요

### 1.1 목적

Context Module 통합은 **현재 4곳에 분산된 컨텍스트 관리 기능을 단일 모듈로 통합**하는 작업입니다. 이를 통해 코드 중복을 제거하고, 일관된 API를 제공하며, 유지보수성을 크게 향상시킵니다.

### 1.2 현재 분산 상태

```
현재 (4곳 분산):
├── dx/token-budget/              # TokenBudgetManager
│   ├── token-budget-manager.ts
│   └── index.ts
│
├── dx/output-optimizer/          # OutputOptimizer
│   ├── output-optimizer.ts
│   └── index.ts
│
├── core/hooks/token-optimizer/   # TokenOptimizerHook
│   └── token-optimizer.hook.ts
│
└── core/hooks/context-monitor/   # ContextMonitorHook
    └── context-monitor.hook.ts
```

### 1.3 통합 후 구조

```
통합 후:
└── core/context/                 # 통합 모듈
    ├── index.ts                  # 통합 export
    ├── interfaces/
    │   └── context.interface.ts  # 통합 인터페이스
    │
    ├── token-budget-manager.ts   # dx/token-budget에서 이동
    ├── context-monitor.ts        # hooks/context-monitor에서 통합
    ├── output-optimizer.ts       # dx/output-optimizer에서 이동
    ├── compaction-strategy.ts    # 압축 전략 (신규)
    └── quality-curve.ts          # F007에서 구현
```

### 1.4 핵심 가치

| 측면 | 현재 | 통합 후 |
|-----|-----|--------|
| 코드 위치 | 4곳 분산 | 1곳 집중 |
| API 일관성 | 제각각 | 통합 인터페이스 |
| 의존성 관리 | 복잡 | 단순화 |
| 신규 기능 배치 | 혼란 | 명확 |
| 테스트 | 분산 | 집중 |

---

## 2. 상세 스펙

### 2.1 통합 인터페이스 정의

```typescript
// src/core/context/interfaces/context.interface.ts

import { QualityLevel, QualityLevelInfo, ContextState } from './quality-curve.interface';

/**
 * 토큰 예산 설정
 */
export interface TokenBudgetConfig {
  maxTokens: number;            // 최대 토큰 수
  warningThreshold: number;     // 경고 임계값 (%)
  criticalThreshold: number;    // 위험 임계값 (%)
  reserveTokens: number;        // 예약 토큰 (응답용)
}

/**
 * 토큰 사용 통계
 */
export interface TokenUsageStats {
  total: number;
  used: number;
  remaining: number;
  usagePercent: number;
  reserved: number;
  available: number;            // remaining - reserved
}

/**
 * 출력 최적화 설정
 */
export interface OutputOptimizerConfig {
  enabled: boolean;
  maxOutputLength: number;      // 최대 출력 길이
  compressionLevel: 'none' | 'light' | 'moderate' | 'aggressive';
  preserveCodeBlocks: boolean;
  preserveImportantInfo: boolean;
}

/**
 * 압축 결과
 */
export interface CompressionResult {
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  savedTokens: number;
  compressionRatio: number;
  techniques: string[];
}

/**
 * 컨텍스트 요약 요청
 */
export interface SummarizationRequest {
  content: string;
  targetTokens: number;
  preserveKeys?: string[];      // 보존할 키워드
  context?: string;             // 추가 컨텍스트
}

/**
 * 컨텍스트 이벤트
 */
export type ContextEvent =
  | 'usage-warning'
  | 'usage-critical'
  | 'quality-degraded'
  | 'budget-exceeded'
  | 'compression-applied';

/**
 * 컨텍스트 이벤트 핸들러
 */
export type ContextEventHandler = (data: ContextEventData) => void;

/**
 * 컨텍스트 이벤트 데이터
 */
export interface ContextEventData {
  event: ContextEvent;
  timestamp: Date;
  usageStats: TokenUsageStats;
  qualityLevel: QualityLevel;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * IContextManager 통합 인터페이스
 */
export interface IContextManager {
  // 토큰 예산 관리
  getUsageStats(): TokenUsageStats;
  setMaxTokens(max: number): void;
  addTokens(count: number): void;
  releaseTokens(count: number): void;
  hasAvailableTokens(required: number): boolean;

  // 품질 관리
  getQualityLevel(): QualityLevel;
  getQualityInfo(): QualityLevelInfo;
  getContextState(): ContextState;
  shouldStartNewPlan(): boolean;

  // 출력 최적화
  optimizeOutput(output: string): Promise<CompressionResult>;
  setCompressionLevel(level: 'none' | 'light' | 'moderate' | 'aggressive'): void;
  summarize(request: SummarizationRequest): Promise<string>;

  // 압축 전략
  getCompressionStrategy(): CompressionStrategy;
  applyCompression(content: string): Promise<string>;

  // 이벤트
  on(event: ContextEvent, handler: ContextEventHandler): void;
  off(event: ContextEvent, handler: ContextEventHandler): void;

  // 설정
  configure(config: Partial<ContextManagerConfig>): void;
  getConfig(): ContextManagerConfig;
}

/**
 * 통합 설정
 */
export interface ContextManagerConfig {
  tokenBudget: TokenBudgetConfig;
  outputOptimizer: OutputOptimizerConfig;
  qualityCurve: {
    enabled: boolean;
    autoAdjust: boolean;
  };
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    checkInterval: number;      // ms
  };
}
```

### 2.2 상수 및 기본 설정

```typescript
// src/core/context/constants/context.constants.ts

import { ContextManagerConfig } from '../interfaces/context.interface';

/**
 * 기본 컨텍스트 관리자 설정
 */
export const DEFAULT_CONTEXT_CONFIG: ContextManagerConfig = {
  tokenBudget: {
    maxTokens: 128000,          // Claude 3 기준
    warningThreshold: 70,
    criticalThreshold: 85,
    reserveTokens: 4000,        // 응답용 예약
  },
  outputOptimizer: {
    enabled: true,
    maxOutputLength: 10000,
    compressionLevel: 'light',
    preserveCodeBlocks: true,
    preserveImportantInfo: true,
  },
  qualityCurve: {
    enabled: true,
    autoAdjust: true,
  },
  monitoring: {
    enabled: true,
    logLevel: 'info',
    checkInterval: 30000,       // 30초
  },
};

/**
 * 압축 레벨별 설정
 */
export const COMPRESSION_LEVELS = {
  none: {
    tokenReduction: 0,
    techniques: [],
  },
  light: {
    tokenReduction: 0.1,
    techniques: ['remove_redundant_whitespace', 'shorten_verbose_text'],
  },
  moderate: {
    tokenReduction: 0.25,
    techniques: ['remove_redundant_whitespace', 'shorten_verbose_text', 'summarize_explanations', 'abbreviate_common_terms'],
  },
  aggressive: {
    tokenReduction: 0.4,
    techniques: ['remove_redundant_whitespace', 'shorten_verbose_text', 'summarize_explanations', 'abbreviate_common_terms', 'remove_examples', 'minimal_formatting'],
  },
} as const;

/**
 * 모델별 토큰 제한
 */
export const MODEL_TOKEN_LIMITS = {
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-2.1': 200000,
  'claude-2.0': 100000,
  'claude-instant': 100000,
  'default': 128000,
} as const;
```

---

## 3. 구현 가이드

### 3.1 파일 위치 및 구조

```
src/core/context/
├── index.ts                     # 통합 export
├── context-manager.ts           # 메인 통합 클래스
├── interfaces/
│   ├── context.interface.ts     # 통합 인터페이스
│   └── quality-curve.interface.ts
├── constants/
│   ├── context.constants.ts
│   └── quality-curve.constants.ts
│
├── token-budget-manager.ts      # dx/token-budget에서 이동
├── output-optimizer.ts          # dx/output-optimizer에서 이동
├── context-monitor.ts           # hooks/context-monitor 통합
├── compaction-strategy.ts       # 신규: 압축 전략
└── quality-curve.ts             # F007 구현
```

### 3.2 통합 클래스 구현

```typescript
// src/core/context/context-manager.ts

import {
  IContextManager,
  ContextManagerConfig,
  TokenUsageStats,
  CompressionResult,
  SummarizationRequest,
  ContextEvent,
  ContextEventHandler,
  ContextEventData,
} from './interfaces/context.interface';
import {
  QualityLevel,
  QualityLevelInfo,
  ContextState,
  CompressionStrategy,
} from './interfaces/quality-curve.interface';
import { DEFAULT_CONTEXT_CONFIG } from './constants/context.constants';
import { TokenBudgetManager } from './token-budget-manager';
import { OutputOptimizer } from './output-optimizer';
import { ContextMonitor } from './context-monitor';
import { CompactionStrategy } from './compaction-strategy';
import { QualityCurve } from './quality-curve';

/**
 * ContextManager
 *
 * 통합 컨텍스트 관리 클래스
 * - 토큰 예산 관리
 * - 품질 레벨 관리
 * - 출력 최적화
 * - 압축 전략
 */
export class ContextManager implements IContextManager {
  private config: ContextManagerConfig;
  private tokenManager: TokenBudgetManager;
  private optimizer: OutputOptimizer;
  private monitor: ContextMonitor;
  private compactor: CompactionStrategy;
  private qualityCurve: QualityCurve;

  private eventHandlers: Map<ContextEvent, Set<ContextEventHandler>>;
  private monitorInterval?: NodeJS.Timer;

  constructor(config?: Partial<ContextManagerConfig>) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
    this.eventHandlers = new Map();

    // 하위 컴포넌트 초기화
    this.tokenManager = new TokenBudgetManager(this.config.tokenBudget);
    this.optimizer = new OutputOptimizer(this.config.outputOptimizer);
    this.compactor = new CompactionStrategy();
    this.qualityCurve = new QualityCurve(async () => ({
      used: this.tokenManager.getUsedTokens(),
      total: this.tokenManager.getMaxTokens(),
    }));

    // 모니터 초기화
    this.monitor = new ContextMonitor({
      onWarning: (stats) => this.emit('usage-warning', stats),
      onCritical: (stats) => this.emit('usage-critical', stats),
      onQualityDegraded: (level) => this.emitQualityEvent(level),
    });

    // 이벤트 핸들러 맵 초기화
    const events: ContextEvent[] = [
      'usage-warning',
      'usage-critical',
      'quality-degraded',
      'budget-exceeded',
      'compression-applied',
    ];
    for (const event of events) {
      this.eventHandlers.set(event, new Set());
    }

    // 품질 레벨 변경 모니터링
    this.qualityCurve.onLevelChange((oldLevel, newLevel) => {
      if (this.isQualityDegraded(oldLevel, newLevel)) {
        this.emitQualityEvent(newLevel);
      }
    });

    // 모니터링 시작
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }
  }

  // === 토큰 예산 관리 ===

  getUsageStats(): TokenUsageStats {
    const total = this.tokenManager.getMaxTokens();
    const used = this.tokenManager.getUsedTokens();
    const reserved = this.config.tokenBudget.reserveTokens;

    return {
      total,
      used,
      remaining: total - used,
      usagePercent: (used / total) * 100,
      reserved,
      available: Math.max(0, total - used - reserved),
    };
  }

  setMaxTokens(max: number): void {
    this.tokenManager.setMaxTokens(max);
  }

  addTokens(count: number): void {
    this.tokenManager.addTokens(count);
    this.checkBudget();
  }

  releaseTokens(count: number): void {
    this.tokenManager.releaseTokens(count);
  }

  hasAvailableTokens(required: number): boolean {
    const stats = this.getUsageStats();
    return stats.available >= required;
  }

  // === 품질 관리 ===

  getQualityLevel(): QualityLevel {
    const stats = this.getUsageStats();
    return this.qualityCurve.getLevel(stats.usagePercent);
  }

  getQualityInfo(): QualityLevelInfo {
    return this.qualityCurve.getLevelInfo(this.getQualityLevel());
  }

  getContextState(): ContextState {
    const stats = this.getUsageStats();
    return this.qualityCurve.analyzeContextState(stats.used, stats.total);
  }

  shouldStartNewPlan(): boolean {
    const stats = this.getUsageStats();
    return this.qualityCurve.shouldStartNewPlan(stats.usagePercent);
  }

  // === 출력 최적화 ===

  async optimizeOutput(output: string): Promise<CompressionResult> {
    const level = this.getQualityLevel();
    const strategy = this.qualityCurve.getCompressionStrategy(level);

    const result = await this.optimizer.optimize(output, {
      level: this.config.outputOptimizer.compressionLevel,
      preserveCodeBlocks: this.config.outputOptimizer.preserveCodeBlocks,
      techniques: strategy.techniques.filter(t => t.enabled).map(t => t.name),
    });

    if (result.savedTokens > 0) {
      this.emit('compression-applied', {
        savedTokens: result.savedTokens,
        ratio: result.compressionRatio,
      });
    }

    return result;
  }

  setCompressionLevel(level: 'none' | 'light' | 'moderate' | 'aggressive'): void {
    this.config.outputOptimizer.compressionLevel = level;
  }

  async summarize(request: SummarizationRequest): Promise<string> {
    return this.optimizer.summarize(request);
  }

  // === 압축 전략 ===

  getCompressionStrategy(): CompressionStrategy {
    return this.qualityCurve.getCompressionStrategy(this.getQualityLevel());
  }

  async applyCompression(content: string): Promise<string> {
    const strategy = this.getCompressionStrategy();
    return this.compactor.apply(content, strategy);
  }

  // === 이벤트 ===

  on(event: ContextEvent, handler: ContextEventHandler): void {
    this.eventHandlers.get(event)?.add(handler);
  }

  off(event: ContextEvent, handler: ContextEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  // === 설정 ===

  configure(config: Partial<ContextManagerConfig>): void {
    this.config = { ...this.config, ...config };

    // 하위 컴포넌트 재설정
    if (config.tokenBudget) {
      this.tokenManager.configure(config.tokenBudget);
    }
    if (config.outputOptimizer) {
      this.optimizer.configure(config.outputOptimizer);
    }
    if (config.monitoring) {
      this.restartMonitoring();
    }
  }

  getConfig(): ContextManagerConfig {
    return { ...this.config };
  }

  // === 리소스 정리 ===

  dispose(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }

  // === Private Methods ===

  private emit(event: ContextEvent, details?: Record<string, unknown>): void {
    const stats = this.getUsageStats();
    const level = this.getQualityLevel();

    const data: ContextEventData = {
      event,
      timestamp: new Date(),
      usageStats: stats,
      qualityLevel: level,
      message: this.getEventMessage(event, stats, level),
      details,
    };

    for (const handler of this.eventHandlers.get(event) ?? []) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Context event handler error for ${event}:`, error);
      }
    }
  }

  private emitQualityEvent(level: QualityLevel): void {
    const info = this.qualityCurve.getLevelInfo(level);
    this.emit('quality-degraded', {
      level,
      label: info.label,
      recommendations: info.recommendations,
    });
  }

  private isQualityDegraded(oldLevel: QualityLevel, newLevel: QualityLevel): boolean {
    const order = [QualityLevel.PEAK, QualityLevel.GOOD, QualityLevel.DEGRADING, QualityLevel.POOR];
    return order.indexOf(newLevel) > order.indexOf(oldLevel);
  }

  private checkBudget(): void {
    const stats = this.getUsageStats();

    if (stats.usagePercent >= this.config.tokenBudget.criticalThreshold) {
      this.emit('usage-critical');
    } else if (stats.usagePercent >= this.config.tokenBudget.warningThreshold) {
      this.emit('usage-warning');
    }

    if (stats.available <= 0) {
      this.emit('budget-exceeded');
    }
  }

  private getEventMessage(event: ContextEvent, stats: TokenUsageStats, level: QualityLevel): string {
    switch (event) {
      case 'usage-warning':
        return `컨텍스트 사용률 경고: ${stats.usagePercent.toFixed(1)}%`;
      case 'usage-critical':
        return `컨텍스트 사용률 위험: ${stats.usagePercent.toFixed(1)}%`;
      case 'quality-degraded':
        return `품질 레벨 저하: ${level}`;
      case 'budget-exceeded':
        return '토큰 예산 초과';
      case 'compression-applied':
        return '출력 압축 적용됨';
      default:
        return event;
    }
  }

  private startMonitoring(): void {
    this.monitorInterval = setInterval(
      () => this.monitor.check(this.getUsageStats(), this.getQualityLevel()),
      this.config.monitoring.checkInterval
    );
  }

  private restartMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }
  }
}
```

### 3.3 마이그레이션 전략

```typescript
// src/core/context/migration.ts

/**
 * 마이그레이션 가이드
 *
 * 이전 경로 → 새 경로
 * dx/token-budget → core/context
 * dx/output-optimizer → core/context
 * hooks/context-monitor → core/context
 */

// 레거시 호환성을 위한 re-export
// dx/token-budget/index.ts
export { TokenBudgetManager } from '../../core/context';
/** @deprecated Use import from '@/core/context' instead */
console.warn('dx/token-budget is deprecated. Use @/core/context instead.');

// dx/output-optimizer/index.ts
export { OutputOptimizer } from '../../core/context';
/** @deprecated Use import from '@/core/context' instead */
console.warn('dx/output-optimizer is deprecated. Use @/core/context instead.');
```

---

## 4. 사용 예시

### 4.1 기본 사용

```typescript
import { ContextManager } from '@/core/context';

const ctx = new ContextManager();

// 토큰 사용 추적
ctx.addTokens(5000);

// 상태 확인
const stats = ctx.getUsageStats();
console.log(`Used: ${stats.used}/${stats.total} (${stats.usagePercent.toFixed(1)}%)`);
console.log(`Available: ${stats.available}`);

// 품질 레벨 확인
const level = ctx.getQualityLevel();
const info = ctx.getQualityInfo();
console.log(`Quality: ${info.label}`);
```

### 4.2 이벤트 기반 모니터링

```typescript
const ctx = new ContextManager();

// 경고 이벤트 핸들링
ctx.on('usage-warning', (data) => {
  console.log(`⚠️ ${data.message}`);
  console.log(`Current usage: ${data.usageStats.usagePercent.toFixed(1)}%`);
});

ctx.on('quality-degraded', (data) => {
  console.log(`📉 Quality degraded to: ${data.qualityLevel}`);
  console.log('Recommendations:');
  for (const rec of data.details?.recommendations ?? []) {
    console.log(`  - ${rec}`);
  }
});

ctx.on('budget-exceeded', () => {
  console.log('🚨 Token budget exceeded! Start new session.');
});
```

### 4.3 출력 최적화

```typescript
const ctx = new ContextManager();

// 긴 출력 최적화
const longOutput = '... very long content ...';
const result = await ctx.optimizeOutput(longOutput);

console.log(`Original: ${result.originalTokens} tokens`);
console.log(`Compressed: ${result.compressedTokens} tokens`);
console.log(`Saved: ${result.savedTokens} tokens (${(result.compressionRatio * 100).toFixed(0)}%)`);
console.log(`Techniques used: ${result.techniques.join(', ')}`);
```

### 4.4 조건부 압축

```typescript
const ctx = new ContextManager();

// 품질 레벨에 따라 자동 압축
const content = 'Some content to potentially compress';
const state = ctx.getContextState();

if (state.qualityLevel === QualityLevel.POOR) {
  // 낮은 품질 구간에서는 공격적 압축
  ctx.setCompressionLevel('aggressive');
  const compressed = await ctx.applyCompression(content);
  console.log('Applied aggressive compression');
} else if (state.qualityLevel === QualityLevel.DEGRADING) {
  // 저하 구간에서는 중간 압축
  ctx.setCompressionLevel('moderate');
  const compressed = await ctx.applyCompression(content);
  console.log('Applied moderate compression');
}
```

### 4.5 계획 관리 통합

```typescript
const ctx = new ContextManager();

// 새 계획 시작 여부 확인
if (ctx.shouldStartNewPlan()) {
  console.log('⚠️ Recommend starting a new plan');

  const state = ctx.getContextState();
  for (const warning of state.warnings) {
    console.log(`[${warning.severity}] ${warning.message}`);
    if (warning.suggestion) {
      console.log(`  → ${warning.suggestion}`);
    }
  }
}
```

---

## 5. 마이그레이션 가이드

### 5.1 마이그레이션 단계

```yaml
단계:
  1_준비:
    작업:
      - core/context/ 디렉토리 생성
      - 통합 인터페이스 정의
      - 테스트 케이스 작성 (통합 후 동작 검증용)
    검증:
      - 인터페이스 정의 완료
      - 테스트 케이스 커버리지 확인

  2_복사:
    작업:
      - dx/token-budget/ → core/context/token-budget-manager.ts
      - dx/output-optimizer/ → core/context/output-optimizer.ts
      - 기존 위치에 @deprecated 주석 추가
    검증:
      - 새 위치에서 import 가능
      - 기존 위치에서 deprecation 경고 발생

  3_통합:
    작업:
      - context-monitor 통합
      - quality-curve 추가 (F007)
      - compaction-strategy 추가
      - ContextManager 통합 클래스 구현
    검증:
      - 통합 클래스 기능 테스트
      - 하위 컴포넌트 연동 확인

  4_전환:
    작업:
      - 의존성 업데이트 (import 경로 변경)
      - 레거시 re-export 설정 (하위 호환성)
      - 문서 업데이트
    검증:
      - 기존 코드 동작 확인
      - deprecation 경고 확인

  5_정리:
    작업:
      - 6개월 후 레거시 re-export 제거
      - 기존 디렉토리 삭제
      - 문서 최종 업데이트
    검증:
      - 레거시 코드 완전 제거
      - 테스트 통과
```

### 5.2 Import 경로 변경

```typescript
// 이전 (deprecated)
import { TokenBudgetManager } from '@/dx/token-budget';
import { OutputOptimizer } from '@/dx/output-optimizer';

// 이후 (권장)
import {
  ContextManager,
  TokenBudgetManager,
  OutputOptimizer,
  QualityCurve,
} from '@/core/context';

// 통합 사용 (권장)
import { ContextManager } from '@/core/context';
const ctx = new ContextManager();
// 개별 컴포넌트 대신 통합 인터페이스 사용
```

### 5.3 레거시 re-export 설정

```typescript
// dx/token-budget/index.ts (레거시 호환)
/**
 * @deprecated Use `import { TokenBudgetManager } from '@/core/context'` instead.
 * This module will be removed in version X.0.
 */
export { TokenBudgetManager } from '../../core/context';

// 런타임 경고 (개발 모드에서만)
if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATED] dx/token-budget is deprecated. ' +
    'Use import from @/core/context instead. ' +
    'This will be removed in version X.0.'
  );
}
```

---

## 6. 검증 계획

### 6.1 단위 테스트

```typescript
// tests/unit/context/context-manager.test.ts

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager({
      tokenBudget: { maxTokens: 100000, warningThreshold: 70, criticalThreshold: 85, reserveTokens: 4000 },
    });
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('token management', () => {
    it('should track token usage correctly', () => {
      manager.addTokens(30000);
      const stats = manager.getUsageStats();

      expect(stats.used).toBe(30000);
      expect(stats.remaining).toBe(70000);
      expect(stats.usagePercent).toBe(30);
    });

    it('should calculate available tokens with reserve', () => {
      manager.addTokens(90000);
      const stats = manager.getUsageStats();

      expect(stats.available).toBe(6000); // 10000 remaining - 4000 reserve
    });
  });

  describe('quality management', () => {
    it('should return correct quality level based on usage', () => {
      manager.addTokens(25000); // 25%
      expect(manager.getQualityLevel()).toBe(QualityLevel.PEAK);

      manager.addTokens(15000); // 40%
      expect(manager.getQualityLevel()).toBe(QualityLevel.GOOD);

      manager.addTokens(20000); // 60%
      expect(manager.getQualityLevel()).toBe(QualityLevel.DEGRADING);

      manager.addTokens(15000); // 75%
      expect(manager.getQualityLevel()).toBe(QualityLevel.POOR);
    });
  });

  describe('events', () => {
    it('should emit warning event at threshold', () => {
      let eventReceived = false;

      manager.on('usage-warning', () => {
        eventReceived = true;
      });

      manager.addTokens(71000); // 71% > 70% warning threshold

      expect(eventReceived).toBe(true);
    });

    it('should emit critical event at threshold', () => {
      let eventReceived = false;

      manager.on('usage-critical', () => {
        eventReceived = true;
      });

      manager.addTokens(86000); // 86% > 85% critical threshold

      expect(eventReceived).toBe(true);
    });
  });
});
```

### 6.2 통합 테스트

```typescript
// tests/integration/context/migration.test.ts

describe('Context Module Migration', () => {
  it('should maintain backward compatibility with legacy imports', () => {
    // 레거시 import가 여전히 동작하는지 확인
    const { TokenBudgetManager: LegacyTokenManager } = require('@/dx/token-budget');
    const { TokenBudgetManager: NewTokenManager } = require('@/core/context');

    expect(LegacyTokenManager).toBe(NewTokenManager);
  });

  it('should provide unified interface', () => {
    const ctx = new ContextManager();

    // 토큰 관리
    expect(typeof ctx.getUsageStats).toBe('function');
    expect(typeof ctx.addTokens).toBe('function');

    // 품질 관리
    expect(typeof ctx.getQualityLevel).toBe('function');
    expect(typeof ctx.shouldStartNewPlan).toBe('function');

    // 출력 최적화
    expect(typeof ctx.optimizeOutput).toBe('function');
    expect(typeof ctx.applyCompression).toBe('function');

    // 이벤트
    expect(typeof ctx.on).toBe('function');
    expect(typeof ctx.off).toBe('function');
  });
});
```

---

## 7. 체크리스트

### 7.1 구현 완료 조건

```markdown
## Context Module 통합 체크리스트

### 준비
- [ ] core/context/ 디렉토리 생성
- [ ] 통합 인터페이스 정의
- [ ] 상수/설정 정의

### 마이그레이션
- [ ] TokenBudgetManager 이동
- [ ] OutputOptimizer 이동
- [ ] ContextMonitor 통합
- [ ] CompactionStrategy 구현
- [ ] QualityCurve 통합 (F007)

### 통합 클래스
- [ ] ContextManager 구현
- [ ] 이벤트 시스템 구현
- [ ] 모니터링 시스템 구현

### 하위 호환성
- [ ] 레거시 re-export 설정
- [ ] deprecation 경고 추가
- [ ] 문서 업데이트

### 테스트
- [ ] 단위 테스트 커버리지 >80%
- [ ] 통합 테스트 완료
- [ ] 마이그레이션 테스트

### 정리 (6개월 후)
- [ ] 레거시 코드 제거
- [ ] 문서 최종 업데이트
```

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.0
  작성일: 2026-02-06
  상태: 활성 (Active)

변경_이력:
  v1.0: 초기 버전 - Context Module 통합 스펙 정의

다음_갱신:
  예정일: 구현 시작 시
  담당: 프로젝트 소유자
```
