# F006 - SolutionsCache

> **우선순위**: P1 (High Value)
> **모듈**: `src/core/learning/`
> **상태**: ⏳ 대기
> **의존성**: F004 (ReflexionPattern)
> **효과**: 0토큰 조회 (캐시 히트 시)
> **현재 코드 상태 (As-Is, 2026-02-06)**: ✅ 구현 및 단위 테스트 존재

---

## 1. 개요

### 1.1 목적

SolutionsCache는 **ReflexionPattern의 학습 결과를 빠르게 조회하기 위한 캐시 시스템**입니다. 에러 시그니처를 키로 사용하여 O(1) 조회를 가능하게 하며, 캐시 히트 시 0토큰으로 즉시 해결책을 제공합니다.

### 1.2 핵심 가치

| 측면 | 설명 |
|-----|------|
| 즉시 조회 | 에러 시그니처 해싱으로 O(1) 조회 |
| 0토큰 비용 | 캐시 히트 시 추가 LLM 호출 불필요 |
| 메모리 효율 | LRU 기반 캐시 크기 관리 |
| 영속화 | 세션 간 캐시 유지 (solutions_learned.jsonl) |

### 1.3 아키텍처 관계

```
┌─────────────────────┐
│   ReflexionPattern  │
│   (에러 학습)        │
└──────────┬──────────┘
           │ learn(), lookup()
           ▼
┌─────────────────────┐
│   SolutionsCache    │
│   (빠른 조회)        │
└──────────┬──────────┘
           │ persist(), load()
           ▼
┌─────────────────────┐
│solutions_learned.jsonl│
│   (영속 저장소)       │
└─────────────────────┘
```

---

## 2. 상세 스펙

### 2.1 인터페이스 정의

```typescript
// src/core/learning/interfaces/solutions-cache.interface.ts

/**
 * 캐시된 솔루션 엔트리
 */
export interface CachedSolution {
  signature: string;             // 에러 시그니처 (키)
  solution: string;              // 해결책
  rootCause: string;             // 근본 원인
  prevention: string[];          // 예방 체크리스트
  errorType: string;             // 에러 타입
  errorMessagePattern: string;   // 정규화된 에러 메시지 패턴
  hits: number;                  // 조회 횟수
  successCount: number;          // 성공 횟수
  failureCount: number;          // 실패 횟수
  createdAt: Date;
  lastAccessedAt: Date;
  metadata?: CacheSolutionMetadata;
}

/**
 * 캐시 솔루션 메타데이터
 */
export interface CacheSolutionMetadata {
  tags?: string[];
  context?: string;
  relatedSolutions?: string[];   // 관련 솔루션 시그니처
  confidence?: number;           // 솔루션 신뢰도
  source?: 'manual' | 'learned' | 'imported';
}

/**
 * 캐시 조회 결과
 */
export interface CacheLookupResult {
  found: boolean;
  solution?: CachedSolution;
  similarity?: number;           // 퍼지 매칭 시 유사도
  alternatives?: CachedSolution[]; // 대안 솔루션들
}

/**
 * 캐시 통계
 */
export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  avgSuccessRate: number;
  memoryUsage: number;           // bytes
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

/**
 * 캐시 설정
 */
export interface CacheConfig {
  maxSize: number;               // 최대 엔트리 수
  ttlMs: number;                 // Time-to-live (밀리초)
  persistPath: string;           // 영속화 경로
  autoSaveInterval: number;      // 자동 저장 간격 (밀리초)
  enableFuzzyMatching: boolean;  // 퍼지 매칭 활성화
  fuzzyThreshold: number;        // 퍼지 매칭 임계값 (0-1)
}

/**
 * ISolutionsCache 인터페이스
 */
export interface ISolutionsCache {
  // 조회
  get(signature: string): Promise<CacheLookupResult>;
  getByError(error: Error): Promise<CacheLookupResult>;
  findSimilar(signature: string, limit?: number): Promise<CachedSolution[]>;

  // 저장
  set(solution: CachedSolution): Promise<void>;
  setFromLearned(learned: LearnedSolution): Promise<void>;

  // 피드백
  recordSuccess(signature: string): Promise<void>;
  recordFailure(signature: string): Promise<void>;

  // 관리
  delete(signature: string): Promise<boolean>;
  clear(): Promise<void>;
  prune(): Promise<number>;      // 오래된 엔트리 정리

  // 영속화
  persist(): Promise<void>;
  load(): Promise<void>;

  // 통계
  getStats(): Promise<CacheStats>;
  getTopSolutions(limit?: number): Promise<CachedSolution[]>;

  // 이벤트
  on(event: CacheEvent, handler: CacheEventHandler): void;
  off(event: CacheEvent, handler: CacheEventHandler): void;
}

/**
 * 캐시 이벤트
 */
export type CacheEvent = 'hit' | 'miss' | 'evict' | 'persist' | 'load';

/**
 * 캐시 이벤트 핸들러
 */
export type CacheEventHandler = (data: CacheEventData) => void;

/**
 * 캐시 이벤트 데이터
 */
export interface CacheEventData {
  event: CacheEvent;
  signature?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}
```

### 2.2 상수 및 설정값

```typescript
// src/core/learning/constants/solutions-cache.constants.ts

/**
 * 기본 캐시 설정
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 1000,                    // 최대 1000개 엔트리
  ttlMs: 30 * 24 * 60 * 60 * 1000,  // 30일
  persistPath: 'docs/memory/solutions_learned.jsonl',
  autoSaveInterval: 5 * 60 * 1000,  // 5분
  enableFuzzyMatching: true,
  fuzzyThreshold: 0.8,
};

/**
 * LRU 캐시 설정
 */
export const LRU_CONFIG = {
  maxSize: 500,                     // 메모리 내 최대 엔트리
  updateAgeOnGet: true,             // 조회 시 age 업데이트
  dispose: 'lru',                   // 제거 정책
} as const;

/**
 * 퍼지 매칭 설정
 */
export const FUZZY_MATCHING_CONFIG = {
  algorithm: 'levenshtein',         // 유사도 알고리즘
  maxDistance: 0.3,                 // 최대 편집 거리 비율
  weightBySuccessRate: true,        // 성공률 가중치
  maxAlternatives: 5,               // 최대 대안 수
} as const;

/**
 * 정리(Pruning) 설정
 */
export const PRUNING_CONFIG = {
  minHits: 1,                       // 최소 조회 횟수
  minSuccessRate: 0.3,              // 최소 성공률
  maxAge: 90 * 24 * 60 * 60 * 1000, // 최대 90일
  keepTopN: 100,                    // 상위 N개는 항상 유지
} as const;
```

---

## 3. 구현 가이드

### 3.1 파일 위치

```
src/core/learning/
├── index.ts
├── interfaces/
│   ├── learning.interface.ts
│   └── solutions-cache.interface.ts
├── constants/
│   └── solutions-cache.constants.ts
├── solutions-cache.ts           # 메인 구현
├── cache-storage.ts             # JSONL 스토리지
└── signature-matcher.ts         # 시그니처 매칭
```

### 3.2 클래스 구조

```typescript
// src/core/learning/solutions-cache.ts

import { LRUCache } from 'lru-cache';
import {
  ISolutionsCache,
  CachedSolution,
  CacheLookupResult,
  CacheStats,
  CacheConfig,
  CacheEvent,
  CacheEventHandler,
  CacheEventData,
} from './interfaces/solutions-cache.interface';
import {
  DEFAULT_CACHE_CONFIG,
  LRU_CONFIG,
  FUZZY_MATCHING_CONFIG,
  PRUNING_CONFIG,
} from './constants/solutions-cache.constants';
import { CacheStorage } from './cache-storage';
import { SignatureMatcher } from './signature-matcher';
import { generateErrorSignature } from './reflexion-pattern';

/**
 * SolutionsCache
 *
 * 학습된 솔루션을 빠르게 조회하기 위한 캐시 시스템
 */
export class SolutionsCache implements ISolutionsCache {
  private memoryCache: LRUCache<string, CachedSolution>;
  private storage: CacheStorage;
  private matcher: SignatureMatcher;
  private config: CacheConfig;
  private eventHandlers: Map<CacheEvent, Set<CacheEventHandler>>;

  // 통계
  private totalHits: number = 0;
  private totalMisses: number = 0;

  // 자동 저장 타이머
  private autoSaveTimer?: NodeJS.Timer;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.eventHandlers = new Map();

    // LRU 캐시 초기화
    this.memoryCache = new LRUCache({
      max: LRU_CONFIG.maxSize,
      updateAgeOnGet: LRU_CONFIG.updateAgeOnGet,
      dispose: (value, key) => this.onEvict(key, value),
    });

    // 스토리지 및 매처 초기화
    this.storage = new CacheStorage(this.config.persistPath);
    this.matcher = new SignatureMatcher(FUZZY_MATCHING_CONFIG);

    // 이벤트 핸들러 맵 초기화
    for (const event of ['hit', 'miss', 'evict', 'persist', 'load'] as CacheEvent[]) {
      this.eventHandlers.set(event, new Set());
    }

    // 자동 저장 설정
    this.setupAutoSave();
  }

  /**
   * 시그니처로 솔루션 조회
   */
  async get(signature: string): Promise<CacheLookupResult> {
    // 1. 정확한 매칭 시도
    const exact = this.memoryCache.get(signature);
    if (exact) {
      this.totalHits++;
      exact.hits++;
      exact.lastAccessedAt = new Date();
      this.emit('hit', { signature });

      return {
        found: true,
        solution: exact,
        similarity: 1.0,
      };
    }

    // 2. 퍼지 매칭 시도 (활성화된 경우)
    if (this.config.enableFuzzyMatching) {
      const alternatives = await this.findSimilar(signature);
      if (alternatives.length > 0) {
        const best = alternatives[0];
        const similarity = this.matcher.calculateSimilarity(signature, best.signature);

        if (similarity >= this.config.fuzzyThreshold) {
          this.totalHits++;
          best.hits++;
          best.lastAccessedAt = new Date();
          this.emit('hit', { signature, details: { fuzzy: true, similarity } });

          return {
            found: true,
            solution: best,
            similarity,
            alternatives: alternatives.slice(1),
          };
        }
      }
    }

    // 3. 캐시 미스
    this.totalMisses++;
    this.emit('miss', { signature });

    return {
      found: false,
      alternatives: await this.findSimilar(signature, FUZZY_MATCHING_CONFIG.maxAlternatives),
    };
  }

  /**
   * Error 객체로 솔루션 조회
   */
  async getByError(error: Error): Promise<CacheLookupResult> {
    const signature = generateErrorSignature(error);
    return this.get(signature);
  }

  /**
   * 유사한 솔루션 찾기
   */
  async findSimilar(signature: string, limit: number = 5): Promise<CachedSolution[]> {
    const allSolutions = Array.from(this.memoryCache.values());
    return this.matcher.findSimilar(allSolutions, signature, limit);
  }

  /**
   * 솔루션 저장
   */
  async set(solution: CachedSolution): Promise<void> {
    // 메모리 캐시에 저장
    this.memoryCache.set(solution.signature, {
      ...solution,
      lastAccessedAt: new Date(),
    });
  }

  /**
   * LearnedSolution에서 캐시 엔트리 생성
   */
  async setFromLearned(learned: LearnedSolution): Promise<void> {
    const cached: CachedSolution = {
      signature: generateErrorSignature({
        name: learned.errorType,
        message: learned.errorMessage,
      } as Error),
      solution: learned.solution,
      rootCause: learned.rootCause,
      prevention: learned.prevention,
      errorType: learned.errorType,
      errorMessagePattern: this.normalizeErrorMessage(learned.errorMessage),
      hits: 0,
      successCount: learned.successCount,
      failureCount: learned.failureCount,
      createdAt: learned.createdAt,
      lastAccessedAt: new Date(),
      metadata: {
        source: 'learned',
        confidence: this.calculateConfidence(learned),
      },
    };

    await this.set(cached);
  }

  /**
   * 성공 기록
   */
  async recordSuccess(signature: string): Promise<void> {
    const solution = this.memoryCache.get(signature);
    if (solution) {
      solution.successCount++;
      solution.lastAccessedAt = new Date();
    }
  }

  /**
   * 실패 기록
   */
  async recordFailure(signature: string): Promise<void> {
    const solution = this.memoryCache.get(signature);
    if (solution) {
      solution.failureCount++;
      solution.lastAccessedAt = new Date();
    }
  }

  /**
   * 솔루션 삭제
   */
  async delete(signature: string): Promise<boolean> {
    return this.memoryCache.delete(signature);
  }

  /**
   * 캐시 전체 삭제
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * 오래된 엔트리 정리
   */
  async prune(): Promise<number> {
    const now = Date.now();
    const toRemove: string[] = [];

    // 상위 N개 솔루션 식별 (제거 보호)
    const topSolutions = await this.getTopSolutions(PRUNING_CONFIG.keepTopN);
    const protectedSignatures = new Set(topSolutions.map(s => s.signature));

    for (const [signature, solution] of this.memoryCache.entries()) {
      // 상위 N개는 보호
      if (protectedSignatures.has(signature)) continue;

      // TTL 초과
      const age = now - solution.createdAt.getTime();
      if (age > PRUNING_CONFIG.maxAge) {
        toRemove.push(signature);
        continue;
      }

      // 성공률 미달
      const total = solution.successCount + solution.failureCount;
      if (total > 0) {
        const successRate = solution.successCount / total;
        if (successRate < PRUNING_CONFIG.minSuccessRate && solution.hits < PRUNING_CONFIG.minHits) {
          toRemove.push(signature);
        }
      }
    }

    // 삭제 실행
    for (const signature of toRemove) {
      this.memoryCache.delete(signature);
    }

    return toRemove.length;
  }

  /**
   * 캐시 영속화
   */
  async persist(): Promise<void> {
    const solutions = Array.from(this.memoryCache.values());
    await this.storage.save(solutions);
    this.emit('persist', { details: { count: solutions.length } });
  }

  /**
   * 캐시 로드
   */
  async load(): Promise<void> {
    const solutions = await this.storage.load();

    for (const solution of solutions) {
      this.memoryCache.set(solution.signature, solution);
    }

    this.emit('load', { details: { count: solutions.length } });
  }

  /**
   * 통계 조회
   */
  async getStats(): Promise<CacheStats> {
    const entries = Array.from(this.memoryCache.values());
    const total = this.totalHits + this.totalMisses;

    let totalSuccess = 0;
    let totalFailure = 0;
    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;

    for (const entry of entries) {
      totalSuccess += entry.successCount;
      totalFailure += entry.failureCount;

      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    return {
      totalEntries: entries.length,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: total > 0 ? this.totalHits / total : 0,
      avgSuccessRate: (totalSuccess + totalFailure) > 0
        ? totalSuccess / (totalSuccess + totalFailure)
        : 0,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * 상위 솔루션 조회
   */
  async getTopSolutions(limit: number = 10): Promise<CachedSolution[]> {
    const entries = Array.from(this.memoryCache.values());

    // 스코어 계산: 히트수 * 성공률
    const scored = entries.map(entry => {
      const total = entry.successCount + entry.failureCount;
      const successRate = total > 0 ? entry.successCount / total : 0.5;
      return {
        entry,
        score: entry.hits * successRate,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
  }

  /**
   * 이벤트 리스너 등록
   */
  on(event: CacheEvent, handler: CacheEventHandler): void {
    this.eventHandlers.get(event)?.add(handler);
  }

  /**
   * 이벤트 리스너 해제
   */
  off(event: CacheEvent, handler: CacheEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * 리소스 정리
   */
  async dispose(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    await this.persist();
  }

  // === Private Helper Methods ===

  private emit(event: CacheEvent, data?: Partial<CacheEventData>): void {
    const eventData: CacheEventData = {
      event,
      timestamp: new Date(),
      ...data,
    };

    for (const handler of this.eventHandlers.get(event) ?? []) {
      try {
        handler(eventData);
      } catch (error) {
        console.error(`Cache event handler error for ${event}:`, error);
      }
    }
  }

  private onEvict(key: string, value: CachedSolution): void {
    this.emit('evict', { signature: key, details: { hits: value.hits } });
  }

  private setupAutoSave(): void {
    if (this.config.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(
        () => this.persist().catch(console.error),
        this.config.autoSaveInterval
      );
    }
  }

  private normalizeErrorMessage(message: string): string {
    return message
      .replace(/\d+/g, 'N')           // 숫자 → N
      .replace(/['"][^'"]+['"]/g, 'STR') // 문자열 → STR
      .replace(/\/[^\s]+/g, 'PATH')   // 경로 → PATH
      .replace(/0x[0-9a-f]+/gi, 'HEX') // 16진수 → HEX
      .slice(0, 200);
  }

  private calculateConfidence(learned: LearnedSolution): number {
    const total = learned.successCount + learned.failureCount;
    if (total === 0) return 0.5;

    return learned.successCount / total;
  }

  private estimateMemoryUsage(): number {
    // 대략적인 메모리 사용량 추정 (바이트)
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      size += JSON.stringify(entry).length * 2; // UTF-16
    }
    return size;
  }
}
```

### 3.3 캐시 스토리지 구현

```typescript
// src/core/learning/cache-storage.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { CachedSolution } from './interfaces/solutions-cache.interface';

/**
 * JSONL 기반 캐시 스토리지
 */
export class CacheStorage {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * 캐시 데이터 저장 (JSONL 형식)
   */
  async save(solutions: CachedSolution[]): Promise<void> {
    // 디렉토리 생성
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    // JSONL 형식으로 저장
    const lines = solutions.map(s => JSON.stringify({
      ...s,
      createdAt: s.createdAt.toISOString(),
      lastAccessedAt: s.lastAccessedAt.toISOString(),
    }));

    await fs.writeFile(this.filePath, lines.join('\n'), 'utf-8');
  }

  /**
   * 캐시 데이터 로드 (JSONL 형식)
   */
  async load(): Promise<CachedSolution[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      return lines.map(line => {
        const parsed = JSON.parse(line);
        return {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          lastAccessedAt: new Date(parsed.lastAccessedAt),
        };
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []; // 파일이 없으면 빈 배열 반환
      }
      throw error;
    }
  }

  /**
   * 단일 솔루션 추가 (append)
   */
  async append(solution: CachedSolution): Promise<void> {
    const line = JSON.stringify({
      ...solution,
      createdAt: solution.createdAt.toISOString(),
      lastAccessedAt: solution.lastAccessedAt.toISOString(),
    });

    await fs.appendFile(this.filePath, line + '\n', 'utf-8');
  }

  /**
   * 파일 존재 여부 확인
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 4. 사용 예시

### 4.1 기본 사용

```typescript
import { SolutionsCache } from '@/core/learning';

const cache = new SolutionsCache();

// 캐시 로드 (시작 시)
await cache.load();

// 에러 발생 시 캐시 조회
try {
  await someOperation();
} catch (error) {
  const result = await cache.getByError(error);

  if (result.found) {
    console.log('Found cached solution!');
    console.log('Solution:', result.solution.solution);
    console.log('Root cause:', result.solution.rootCause);
    console.log('Prevention:', result.solution.prevention);

    // 솔루션 적용...

    // 결과 기록
    await cache.recordSuccess(result.solution.signature);
  } else {
    console.log('No cached solution found');
    if (result.alternatives?.length) {
      console.log('Consider these alternatives:');
      for (const alt of result.alternatives) {
        console.log(`  - ${alt.solution} (similarity: ${alt.similarity})`);
      }
    }
  }
}
```

### 4.2 ReflexionPattern과 통합

```typescript
import { ReflexionPattern, SolutionsCache } from '@/core/learning';

class LearningSystem {
  private reflexion: ReflexionPattern;
  private cache: SolutionsCache;

  constructor() {
    this.reflexion = new ReflexionPattern();
    this.cache = new SolutionsCache();
  }

  async handleError(error: Error): Promise<string | null> {
    // 1. 캐시에서 빠른 조회 시도
    const cacheResult = await this.cache.getByError(error);

    if (cacheResult.found) {
      console.log('Cache hit! 0 tokens used.');
      return cacheResult.solution.solution;
    }

    // 2. 캐시 미스 → ReflexionPattern 조회
    console.log('Cache miss. Checking learned solutions...');
    const learned = await this.reflexion.lookup(error);

    if (learned) {
      // 캐시에 추가
      await this.cache.setFromLearned(learned);
      return learned.solution;
    }

    // 3. 새로운 에러 → 학습 필요
    return null;
  }

  async learnSolution(error: Error, solution: string, rootCause: string): Promise<void> {
    // ReflexionPattern에 학습
    await this.reflexion.learn(error, solution, rootCause);

    // 캐시에도 추가
    const learned = await this.reflexion.lookup(error);
    if (learned) {
      await this.cache.setFromLearned(learned);
    }
  }
}
```

### 4.3 이벤트 모니터링

```typescript
const cache = new SolutionsCache();

// 이벤트 핸들러 등록
cache.on('hit', (data) => {
  console.log(`Cache hit: ${data.signature}`);
});

cache.on('miss', (data) => {
  console.log(`Cache miss: ${data.signature}`);
});

cache.on('evict', (data) => {
  console.log(`Evicted: ${data.signature} (hits: ${data.details?.hits})`);
});

// 통계 모니터링
setInterval(async () => {
  const stats = await cache.getStats();
  console.log(`Cache stats: ${stats.totalEntries} entries, ${(stats.hitRate * 100).toFixed(1)}% hit rate`);
}, 60000);
```

### 4.4 유지보수 작업

```typescript
// 정기 정리 작업
async function maintainCache(cache: SolutionsCache): Promise<void> {
  // 오래된 엔트리 정리
  const pruned = await cache.prune();
  console.log(`Pruned ${pruned} old entries`);

  // 통계 확인
  const stats = await cache.getStats();
  console.log(`Cache status: ${stats.totalEntries} entries, ${(stats.hitRate * 100).toFixed(1)}% hit rate`);

  // 상위 솔루션 확인
  const top = await cache.getTopSolutions(5);
  console.log('Top solutions:');
  for (const s of top) {
    console.log(`  - ${s.errorType}: ${s.hits} hits, ${(s.successCount / (s.successCount + s.failureCount) * 100).toFixed(0)}% success`);
  }

  // 영속화
  await cache.persist();
}
```

---

## 5. 검증 계획

### 5.1 단위 테스트

```typescript
// tests/unit/learning/solutions-cache.test.ts

describe('SolutionsCache', () => {
  let cache: SolutionsCache;

  beforeEach(async () => {
    cache = new SolutionsCache({
      persistPath: '/tmp/test-solutions.jsonl',
      autoSaveInterval: 0, // 테스트에서는 자동 저장 비활성화
    });
  });

  afterEach(async () => {
    await cache.dispose();
  });

  describe('get/set', () => {
    it('should store and retrieve solution by signature', async () => {
      const solution: CachedSolution = {
        signature: 'TypeError:undefined_is_not_a_function',
        solution: 'Check if function exists before calling',
        rootCause: 'Function reference is undefined',
        prevention: ['Add null check', 'Use optional chaining'],
        errorType: 'TypeError',
        errorMessagePattern: 'undefined is not a function',
        hits: 0,
        successCount: 0,
        failureCount: 0,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await cache.set(solution);
      const result = await cache.get(solution.signature);

      expect(result.found).toBe(true);
      expect(result.solution?.solution).toBe(solution.solution);
    });

    it('should return not found for unknown signature', async () => {
      const result = await cache.get('unknown_signature');

      expect(result.found).toBe(false);
    });
  });

  describe('fuzzy matching', () => {
    it('should find similar solutions when exact match not found', async () => {
      await cache.set({
        signature: 'TypeError:cannot_read_property_x_of_undefined',
        solution: 'Add null check',
        rootCause: 'Object is undefined',
        prevention: [],
        errorType: 'TypeError',
        errorMessagePattern: "cannot read property 'x' of undefined",
        hits: 10,
        successCount: 8,
        failureCount: 2,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      });

      const result = await cache.get('TypeError:cannot_read_property_y_of_undefined');

      expect(result.found).toBe(true);
      expect(result.similarity).toBeGreaterThan(0.8);
    });
  });

  describe('recording', () => {
    it('should track success and failure', async () => {
      const solution: CachedSolution = {
        signature: 'test_signature',
        solution: 'test solution',
        rootCause: 'test cause',
        prevention: [],
        errorType: 'Error',
        errorMessagePattern: 'test',
        hits: 0,
        successCount: 0,
        failureCount: 0,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await cache.set(solution);

      await cache.recordSuccess('test_signature');
      await cache.recordSuccess('test_signature');
      await cache.recordFailure('test_signature');

      const result = await cache.get('test_signature');

      expect(result.solution?.successCount).toBe(2);
      expect(result.solution?.failureCount).toBe(1);
    });
  });

  describe('stats', () => {
    it('should track hit rate correctly', async () => {
      await cache.set({
        signature: 'known',
        solution: 'solution',
        rootCause: 'cause',
        prevention: [],
        errorType: 'Error',
        errorMessagePattern: 'known',
        hits: 0,
        successCount: 0,
        failureCount: 0,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      });

      await cache.get('known');  // hit
      await cache.get('known');  // hit
      await cache.get('unknown'); // miss

      const stats = await cache.getStats();

      expect(stats.hitRate).toBeCloseTo(0.67, 1);
    });
  });

  describe('persistence', () => {
    it('should persist and reload data', async () => {
      await cache.set({
        signature: 'persist_test',
        solution: 'test solution',
        rootCause: 'test cause',
        prevention: ['step1', 'step2'],
        errorType: 'Error',
        errorMessagePattern: 'test',
        hits: 5,
        successCount: 3,
        failureCount: 1,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      });

      await cache.persist();

      // 새 인스턴스로 로드
      const newCache = new SolutionsCache({
        persistPath: '/tmp/test-solutions.jsonl',
        autoSaveInterval: 0,
      });

      await newCache.load();

      const result = await newCache.get('persist_test');

      expect(result.found).toBe(true);
      expect(result.solution?.hits).toBe(5);
      expect(result.solution?.prevention).toEqual(['step1', 'step2']);

      await newCache.dispose();
    });
  });
});
```

### 5.2 성능 테스트

```typescript
// tests/performance/solutions-cache.perf.test.ts

describe('SolutionsCache Performance', () => {
  it('should lookup in under 1ms for 1000 entries', async () => {
    const cache = new SolutionsCache({ autoSaveInterval: 0 });

    // 1000개 엔트리 생성
    for (let i = 0; i < 1000; i++) {
      await cache.set({
        signature: `signature_${i}`,
        solution: `solution ${i}`,
        rootCause: `cause ${i}`,
        prevention: [],
        errorType: 'Error',
        errorMessagePattern: `pattern ${i}`,
        hits: 0,
        successCount: 0,
        failureCount: 0,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      });
    }

    // 조회 성능 측정
    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      await cache.get(`signature_${Math.floor(Math.random() * 1000)}`);
    }

    const elapsed = performance.now() - start;
    const avgTime = elapsed / 100;

    expect(avgTime).toBeLessThan(1); // 1ms 미만
  });

  it('should maintain hit rate above 80% for repeated queries', async () => {
    const cache = new SolutionsCache({ autoSaveInterval: 0 });

    // 100개 솔루션 생성
    for (let i = 0; i < 100; i++) {
      await cache.set({
        signature: `signature_${i}`,
        solution: `solution ${i}`,
        rootCause: `cause ${i}`,
        prevention: [],
        errorType: 'Error',
        errorMessagePattern: `pattern ${i}`,
        hits: 0,
        successCount: 0,
        failureCount: 0,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      });
    }

    // 80%는 기존 시그니처, 20%는 새 시그니처 조회
    for (let i = 0; i < 1000; i++) {
      if (Math.random() < 0.8) {
        await cache.get(`signature_${Math.floor(Math.random() * 100)}`);
      } else {
        await cache.get(`new_signature_${i}`);
      }
    }

    const stats = await cache.getStats();

    expect(stats.hitRate).toBeGreaterThan(0.75); // 75% 이상
  });
});
```

---

## 6. 체크리스트

### 6.1 구현 완료 조건

```markdown
## SolutionsCache 구현 체크리스트

### 핵심 기능
- [ ] LRU 기반 메모리 캐시
- [ ] 정확한 시그니처 매칭
- [ ] 퍼지 매칭 (유사도 기반)
- [ ] 성공/실패 기록

### 영속화
- [ ] JSONL 형식 저장
- [ ] 자동 저장 기능
- [ ] 로드 시 데이터 복원

### 관리
- [ ] 통계 수집 (hit rate, success rate)
- [ ] 오래된 엔트리 정리 (prune)
- [ ] 이벤트 시스템

### 테스트
- [ ] 단위 테스트 커버리지 >80%
- [ ] 성능 테스트 (1ms 미만 조회)
- [ ] 영속화 테스트

### 통합
- [ ] ReflexionPattern과 연동
- [ ] learning/index.ts에 export 추가
```

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.0
  작성일: 2026-02-06
  상태: 활성 (Active)

변경_이력:
  v1.0: 초기 버전 - SolutionsCache 상세 스펙 정의

다음_갱신:
  예정일: 구현 시작 시
  담당: 프로젝트 소유자
```
