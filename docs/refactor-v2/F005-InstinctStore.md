# F005 - InstinctStore

> **우선순위**: P1 (High Value)
> **모듈**: `src/core/learning/`
> **상태**: ⏳ 대기
> **의존성**: F004 (ReflexionPattern), learning 인터페이스
> **출처 패턴**: everything-claude-code (Instinct System)

---

## 1. 개요

### 1.1 목적

InstinctStore는 **신뢰도 기반 패턴 학습 시스템**으로, 스킬보다 작고 유연한 학습 단위를 관리합니다. 세션 관찰, 레포지토리 분석, 사용자 교정을 통해 패턴을 학습하고, 충분한 신뢰도가 축적되면 스킬/명령어/에이전트로 진화할 수 있습니다.

### 1.2 핵심 가치

| 측면 | 설명 |
|-----|------|
| 점진적 학습 | 관찰 → 가설 → 검증 → 확립의 자연스러운 학습 과정 |
| 신뢰도 스케일 | 0.3(제안) ~ 0.9(핵심 행동) 범위의 세분화된 신뢰도 |
| 진화 메커니즘 | 고신뢰도 패턴의 자동 클러스터링 및 상위 구조 승격 |
| 개인화 | 사용자별 선호도와 코딩 스타일 반영 |

### 1.3 출처 패턴

```yaml
everything-claude-code:
  Instinct_System:
    핵심_개념: "신뢰도 기반 행동 패턴"
    신뢰도_범위: "0.3-0.9"
    진화_경로: "instinct → skill → command → agent"
    저장_위치: "~/.claude/homunculus/instincts/"
```

---

## 2. 상세 스펙

### 2.1 인터페이스 정의

```typescript
// src/core/learning/interfaces/instinct-store.interface.ts

/**
 * Instinct 데이터 구조
 *
 * 스킬보다 작은 학습 단위
 * 관찰 → 가설 → 검증 → 확립의 학습 과정
 */
export interface Instinct {
  id: string;                    // UUID v4
  trigger: string;               // "when writing new functions"
  action: string;                // "Use functional patterns over classes"
  confidence: number;            // 0.3-0.9
  domain: InstinctDomain;        // "code-style", "testing", "git", etc.
  source: InstinctSource;        // 학습 출처
  evidence: string[];            // 증거 목록
  usageCount: number;            // 적용 횟수
  successCount: number;          // 성공 횟수
  failureCount: number;          // 실패 횟수
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  metadata?: InstinctMetadata;
}

/**
 * Instinct 도메인
 */
export type InstinctDomain =
  | 'code-style'      // 코딩 스타일
  | 'testing'         // 테스트 관련
  | 'git'             // Git 워크플로우
  | 'documentation'   // 문서화
  | 'architecture'    // 아키텍처 패턴
  | 'debugging'       // 디버깅 전략
  | 'performance'     // 성능 최적화
  | 'security'        // 보안 패턴
  | 'workflow'        // 작업 흐름
  | 'communication'   // 커뮤니케이션
  | 'custom';         // 사용자 정의

/**
 * Instinct 출처
 */
export type InstinctSource =
  | 'session-observation'  // 세션 관찰
  | 'repo-analysis'        // 레포지토리 분석
  | 'user-correction'      // 사용자 교정
  | 'explicit-teaching'    // 명시적 가르침
  | 'pattern-inference';   // 패턴 추론

/**
 * Instinct 메타데이터
 */
export interface InstinctMetadata {
  projectContext?: string;       // 프로젝트 컨텍스트
  languageContext?: string[];    // 관련 언어
  frameworkContext?: string[];   // 관련 프레임워크
  tags?: string[];               // 태그
  notes?: string;                // 메모
  relatedInstincts?: string[];   // 관련 instinct IDs
}

/**
 * 신뢰도 레벨 정의
 */
export const CONFIDENCE_LEVELS = {
  TENTATIVE: 0.3,     // 제안만, 강제 아님
  MODERATE: 0.5,      // 관련 시 적용
  STRONG: 0.7,        // 자동 승인
  NEAR_CERTAIN: 0.9,  // 핵심 행동
} as const;

/**
 * 신뢰도 레벨 타입
 */
export type ConfidenceLevel = keyof typeof CONFIDENCE_LEVELS;

/**
 * 신뢰도 조정 설정
 */
export interface ConfidenceAdjustment {
  reinforceAmount: number;  // 강화 시 증가량 (default: 0.05)
  correctAmount: number;    // 교정 시 감소량 (default: 0.10)
  decayRate: number;        // 미사용 시 감쇠율 (default: 0.01/week)
  minConfidence: number;    // 최소 신뢰도 (default: 0.1)
  maxConfidence: number;    // 최대 신뢰도 (default: 0.95)
}

/**
 * Instinct 필터 조건
 */
export interface InstinctFilter {
  domain?: InstinctDomain | InstinctDomain[];
  source?: InstinctSource | InstinctSource[];
  minConfidence?: number;
  maxConfidence?: number;
  minUsageCount?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  searchText?: string;
  tags?: string[];
}

/**
 * Instinct 진화 결과
 */
export interface InstinctEvolution {
  type: 'skill' | 'command' | 'agent';
  sourceInstincts: string[];     // 진화에 사용된 instinct IDs
  suggestedName: string;
  suggestedDescription: string;
  confidence: number;            // 평균 신뢰도
  pattern: string;               // 추출된 공통 패턴
  createdAt: Date;
}

/**
 * IInstinctStore 인터페이스
 */
export interface IInstinctStore {
  // CRUD 작업
  create(instinct: Omit<Instinct, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'successCount' | 'failureCount'>): Promise<Instinct>;
  get(id: string): Promise<Instinct | null>;
  update(id: string, updates: Partial<Omit<Instinct, 'id' | 'createdAt'>>): Promise<Instinct | null>;
  delete(id: string): Promise<boolean>;

  // 검색 및 매칭
  findMatching(context: string, domain?: InstinctDomain): Promise<Instinct[]>;
  findByFilter(filter: InstinctFilter): Promise<Instinct[]>;
  findSimilar(instinct: Instinct, threshold?: number): Promise<Instinct[]>;

  // 신뢰도 조정
  reinforce(id: string): Promise<Instinct | null>;   // 신뢰도 +0.05
  correct(id: string): Promise<Instinct | null>;     // 신뢰도 -0.10
  decay(): Promise<number>;                          // 미사용 instinct 감쇠

  // 사용 기록
  recordUsage(id: string, success: boolean): Promise<void>;

  // 진화 메커니즘
  evolve(threshold: number): Promise<InstinctEvolution[]>;
  cluster(domain?: InstinctDomain): Promise<InstinctCluster[]>;

  // 내보내기/가져오기
  export(filter?: InstinctFilter): Promise<Instinct[]>;
  import(instincts: Instinct[]): Promise<ImportResult>;

  // 통계
  getStats(): Promise<InstinctStats>;
  getConfidenceDistribution(): Promise<Map<ConfidenceLevel, number>>;
}

/**
 * Instinct 클러스터
 */
export interface InstinctCluster {
  id: string;
  name: string;
  instincts: string[];           // instinct IDs
  commonPattern: string;
  averageConfidence: number;
  domain: InstinctDomain;
  evolutionReady: boolean;       // 진화 가능 여부
}

/**
 * Import 결과
 */
export interface ImportResult {
  imported: number;
  skipped: number;
  merged: number;
  errors: string[];
}

/**
 * Instinct 통계
 */
export interface InstinctStats {
  total: number;
  byDomain: Record<InstinctDomain, number>;
  bySource: Record<InstinctSource, number>;
  byConfidenceLevel: Record<ConfidenceLevel, number>;
  averageConfidence: number;
  totalUsageCount: number;
  successRate: number;
  evolutionCandidates: number;
}
```

### 2.2 상수 및 설정값

```typescript
// src/core/learning/constants/instinct.constants.ts

/**
 * Instinct 저장 설정
 */
export const INSTINCT_STORAGE_CONFIG = {
  // 저장 경로
  BASE_DIR: '~/.claude/homunculus/instincts/',
  DOMAIN_SUBDIRS: true,          // 도메인별 서브디렉토리 사용
  FILE_EXTENSION: '.json',

  // 파일 구조
  INDEX_FILE: 'index.json',
  BACKUP_DIR: 'backups/',
  MAX_BACKUPS: 5,
} as const;

/**
 * 신뢰도 조정 기본값
 */
export const DEFAULT_CONFIDENCE_ADJUSTMENT: ConfidenceAdjustment = {
  reinforceAmount: 0.05,
  correctAmount: 0.10,
  decayRate: 0.01,
  minConfidence: 0.1,
  maxConfidence: 0.95,
};

/**
 * 초기 신뢰도 설정
 */
export const INITIAL_CONFIDENCE_BY_SOURCE: Record<InstinctSource, number> = {
  'session-observation': 0.3,    // 관찰은 낮은 신뢰도로 시작
  'repo-analysis': 0.4,          // 분석은 약간 높게
  'user-correction': 0.6,        // 사용자 교정은 높게
  'explicit-teaching': 0.7,      // 명시적 가르침은 더 높게
  'pattern-inference': 0.35,     // 추론은 낮게
};

/**
 * 진화 임계값
 */
export const EVOLUTION_THRESHOLDS = {
  MIN_CONFIDENCE: 0.8,           // 최소 신뢰도
  MIN_USAGE_COUNT: 10,           // 최소 사용 횟수
  MIN_SUCCESS_RATE: 0.8,         // 최소 성공률
  MIN_CLUSTER_SIZE: 3,           // 최소 클러스터 크기
  SIMILARITY_THRESHOLD: 0.7,     // 유사도 임계값
} as const;

/**
 * 매칭 설정
 */
export const MATCHING_CONFIG = {
  MAX_RESULTS: 10,               // 최대 결과 수
  MIN_RELEVANCE: 0.5,            // 최소 관련성
  BOOST_RECENT: true,            // 최근 사용 우선
  BOOST_HIGH_CONFIDENCE: true,   // 높은 신뢰도 우선
} as const;

/**
 * 감쇠 설정
 */
export const DECAY_CONFIG = {
  INTERVAL_DAYS: 7,              // 감쇠 주기 (일)
  MAX_DECAY: 0.3,                // 최대 감쇠량
  PROTECTION_THRESHOLD: 0.8,     // 보호 임계값 (이상은 감쇠 안함)
  MIN_DAYS_BEFORE_DECAY: 14,     // 감쇠 시작 전 최소 기간
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
│   └── instinct-store.interface.ts
├── constants/
│   └── instinct.constants.ts
├── instinct-store.ts            # 메인 구현
├── instinct-matcher.ts          # 컨텍스트 매칭
├── instinct-evolver.ts          # 진화 메커니즘
└── instinct-storage.ts          # 파일 시스템 저장
```

### 3.2 클래스 구조

```typescript
// src/core/learning/instinct-store.ts

import { v4 as uuidv4 } from 'uuid';
import {
  IInstinctStore,
  Instinct,
  InstinctDomain,
  InstinctFilter,
  InstinctEvolution,
  InstinctCluster,
  InstinctStats,
  ConfidenceLevel,
  ConfidenceAdjustment,
  ImportResult,
  CONFIDENCE_LEVELS,
} from './interfaces/instinct-store.interface';
import {
  DEFAULT_CONFIDENCE_ADJUSTMENT,
  INITIAL_CONFIDENCE_BY_SOURCE,
  EVOLUTION_THRESHOLDS,
  MATCHING_CONFIG,
  DECAY_CONFIG,
} from './constants/instinct.constants';
import { InstinctStorage } from './instinct-storage';
import { InstinctMatcher } from './instinct-matcher';
import { InstinctEvolver } from './instinct-evolver';

/**
 * InstinctStore
 *
 * 신뢰도 기반 패턴 학습 시스템
 */
export class InstinctStore implements IInstinctStore {
  private storage: InstinctStorage;
  private matcher: InstinctMatcher;
  private evolver: InstinctEvolver;
  private confidenceConfig: ConfidenceAdjustment;

  constructor(
    storagePath?: string,
    confidenceConfig?: Partial<ConfidenceAdjustment>,
  ) {
    this.storage = new InstinctStorage(storagePath);
    this.matcher = new InstinctMatcher();
    this.evolver = new InstinctEvolver();
    this.confidenceConfig = {
      ...DEFAULT_CONFIDENCE_ADJUSTMENT,
      ...confidenceConfig,
    };
  }

  /**
   * 새 Instinct 생성
   */
  async create(
    input: Omit<Instinct, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'successCount' | 'failureCount'>
  ): Promise<Instinct> {
    // 초기 신뢰도 결정
    const initialConfidence = input.confidence ??
      INITIAL_CONFIDENCE_BY_SOURCE[input.source] ??
      CONFIDENCE_LEVELS.TENTATIVE;

    const instinct: Instinct = {
      ...input,
      id: uuidv4(),
      confidence: this.clampConfidence(initialConfidence),
      usageCount: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storage.save(instinct);
    return instinct;
  }

  /**
   * Instinct 조회
   */
  async get(id: string): Promise<Instinct | null> {
    return this.storage.load(id);
  }

  /**
   * Instinct 업데이트
   */
  async update(
    id: string,
    updates: Partial<Omit<Instinct, 'id' | 'createdAt'>>
  ): Promise<Instinct | null> {
    const existing = await this.storage.load(id);
    if (!existing) return null;

    const updated: Instinct = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    if (updates.confidence !== undefined) {
      updated.confidence = this.clampConfidence(updates.confidence);
    }

    await this.storage.save(updated);
    return updated;
  }

  /**
   * Instinct 삭제
   */
  async delete(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  /**
   * 컨텍스트 기반 매칭
   */
  async findMatching(
    context: string,
    domain?: InstinctDomain
  ): Promise<Instinct[]> {
    const allInstincts = await this.storage.loadAll();
    const filtered = domain
      ? allInstincts.filter(i => i.domain === domain)
      : allInstincts;

    return this.matcher.findMatching(filtered, context, MATCHING_CONFIG);
  }

  /**
   * 필터 기반 검색
   */
  async findByFilter(filter: InstinctFilter): Promise<Instinct[]> {
    const allInstincts = await this.storage.loadAll();
    return this.applyFilter(allInstincts, filter);
  }

  /**
   * 유사 Instinct 찾기
   */
  async findSimilar(instinct: Instinct, threshold: number = 0.7): Promise<Instinct[]> {
    const allInstincts = await this.storage.loadAll();
    return this.matcher.findSimilar(
      allInstincts.filter(i => i.id !== instinct.id),
      instinct,
      threshold
    );
  }

  /**
   * 신뢰도 강화 (+0.05)
   */
  async reinforce(id: string): Promise<Instinct | null> {
    const instinct = await this.storage.load(id);
    if (!instinct) return null;

    const newConfidence = this.clampConfidence(
      instinct.confidence + this.confidenceConfig.reinforceAmount
    );

    return this.update(id, { confidence: newConfidence });
  }

  /**
   * 신뢰도 교정 (-0.10)
   */
  async correct(id: string): Promise<Instinct | null> {
    const instinct = await this.storage.load(id);
    if (!instinct) return null;

    const newConfidence = this.clampConfidence(
      instinct.confidence - this.confidenceConfig.correctAmount
    );

    return this.update(id, { confidence: newConfidence });
  }

  /**
   * 미사용 Instinct 감쇠
   */
  async decay(): Promise<number> {
    const allInstincts = await this.storage.loadAll();
    let decayedCount = 0;

    const now = new Date();
    const minDecayDate = new Date(
      now.getTime() - DECAY_CONFIG.MIN_DAYS_BEFORE_DECAY * 24 * 60 * 60 * 1000
    );

    for (const instinct of allInstincts) {
      // 보호 임계값 이상은 감쇠하지 않음
      if (instinct.confidence >= DECAY_CONFIG.PROTECTION_THRESHOLD) continue;

      // 최근 생성된 것은 감쇠하지 않음
      if (instinct.createdAt > minDecayDate) continue;

      const lastUsed = instinct.lastUsedAt ?? instinct.createdAt;
      const daysSinceUse = Math.floor(
        (now.getTime() - lastUsed.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysSinceUse >= DECAY_CONFIG.INTERVAL_DAYS) {
        const decayAmount = Math.min(
          this.confidenceConfig.decayRate * Math.floor(daysSinceUse / DECAY_CONFIG.INTERVAL_DAYS),
          DECAY_CONFIG.MAX_DECAY
        );

        const newConfidence = this.clampConfidence(instinct.confidence - decayAmount);

        if (newConfidence < instinct.confidence) {
          await this.update(instinct.id, { confidence: newConfidence });
          decayedCount++;
        }
      }
    }

    return decayedCount;
  }

  /**
   * 사용 기록
   */
  async recordUsage(id: string, success: boolean): Promise<void> {
    const instinct = await this.storage.load(id);
    if (!instinct) return;

    const updates: Partial<Instinct> = {
      usageCount: instinct.usageCount + 1,
      lastUsedAt: new Date(),
    };

    if (success) {
      updates.successCount = instinct.successCount + 1;
    } else {
      updates.failureCount = instinct.failureCount + 1;
    }

    await this.update(id, updates);
  }

  /**
   * 진화 메커니즘
   */
  async evolve(threshold: number = EVOLUTION_THRESHOLDS.MIN_CONFIDENCE): Promise<InstinctEvolution[]> {
    const allInstincts = await this.storage.loadAll();
    const candidates = allInstincts.filter(i =>
      i.confidence >= threshold &&
      i.usageCount >= EVOLUTION_THRESHOLDS.MIN_USAGE_COUNT &&
      this.calculateSuccessRate(i) >= EVOLUTION_THRESHOLDS.MIN_SUCCESS_RATE
    );

    return this.evolver.evolve(candidates);
  }

  /**
   * 클러스터링
   */
  async cluster(domain?: InstinctDomain): Promise<InstinctCluster[]> {
    const allInstincts = await this.storage.loadAll();
    const filtered = domain
      ? allInstincts.filter(i => i.domain === domain)
      : allInstincts;

    return this.evolver.cluster(filtered);
  }

  /**
   * 내보내기
   */
  async export(filter?: InstinctFilter): Promise<Instinct[]> {
    const allInstincts = await this.storage.loadAll();
    return filter ? this.applyFilter(allInstincts, filter) : allInstincts;
  }

  /**
   * 가져오기
   */
  async import(instincts: Instinct[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      merged: 0,
      errors: [],
    };

    for (const instinct of instincts) {
      try {
        const existing = await this.storage.load(instinct.id);

        if (existing) {
          // 병합: 더 높은 신뢰도 유지, 사용 횟수 합산
          const merged = this.mergeInstincts(existing, instinct);
          await this.storage.save(merged);
          result.merged++;
        } else {
          await this.storage.save(instinct);
          result.imported++;
        }
      } catch (error) {
        result.errors.push(`Failed to import ${instinct.id}: ${error}`);
        result.skipped++;
      }
    }

    return result;
  }

  /**
   * 통계 조회
   */
  async getStats(): Promise<InstinctStats> {
    const allInstincts = await this.storage.loadAll();

    const stats: InstinctStats = {
      total: allInstincts.length,
      byDomain: {} as Record<InstinctDomain, number>,
      bySource: {} as Record<InstinctSource, number>,
      byConfidenceLevel: {} as Record<ConfidenceLevel, number>,
      averageConfidence: 0,
      totalUsageCount: 0,
      successRate: 0,
      evolutionCandidates: 0,
    };

    // 집계
    let totalSuccess = 0;
    let totalFailure = 0;

    for (const instinct of allInstincts) {
      // 도메인별
      stats.byDomain[instinct.domain] = (stats.byDomain[instinct.domain] ?? 0) + 1;

      // 출처별
      stats.bySource[instinct.source] = (stats.bySource[instinct.source] ?? 0) + 1;

      // 신뢰도 레벨별
      const level = this.getConfidenceLevel(instinct.confidence);
      stats.byConfidenceLevel[level] = (stats.byConfidenceLevel[level] ?? 0) + 1;

      // 합계
      stats.averageConfidence += instinct.confidence;
      stats.totalUsageCount += instinct.usageCount;
      totalSuccess += instinct.successCount;
      totalFailure += instinct.failureCount;

      // 진화 후보
      if (
        instinct.confidence >= EVOLUTION_THRESHOLDS.MIN_CONFIDENCE &&
        instinct.usageCount >= EVOLUTION_THRESHOLDS.MIN_USAGE_COUNT
      ) {
        stats.evolutionCandidates++;
      }
    }

    // 평균 계산
    if (allInstincts.length > 0) {
      stats.averageConfidence /= allInstincts.length;
    }

    if (totalSuccess + totalFailure > 0) {
      stats.successRate = totalSuccess / (totalSuccess + totalFailure);
    }

    return stats;
  }

  /**
   * 신뢰도 분포 조회
   */
  async getConfidenceDistribution(): Promise<Map<ConfidenceLevel, number>> {
    const allInstincts = await this.storage.loadAll();
    const distribution = new Map<ConfidenceLevel, number>();

    for (const level of Object.keys(CONFIDENCE_LEVELS) as ConfidenceLevel[]) {
      distribution.set(level, 0);
    }

    for (const instinct of allInstincts) {
      const level = this.getConfidenceLevel(instinct.confidence);
      distribution.set(level, (distribution.get(level) ?? 0) + 1);
    }

    return distribution;
  }

  // === Private Helper Methods ===

  private clampConfidence(value: number): number {
    return Math.max(
      this.confidenceConfig.minConfidence,
      Math.min(this.confidenceConfig.maxConfidence, value)
    );
  }

  private calculateSuccessRate(instinct: Instinct): number {
    const total = instinct.successCount + instinct.failureCount;
    return total > 0 ? instinct.successCount / total : 0;
  }

  private getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= CONFIDENCE_LEVELS.NEAR_CERTAIN) return 'NEAR_CERTAIN';
    if (confidence >= CONFIDENCE_LEVELS.STRONG) return 'STRONG';
    if (confidence >= CONFIDENCE_LEVELS.MODERATE) return 'MODERATE';
    return 'TENTATIVE';
  }

  private applyFilter(instincts: Instinct[], filter: InstinctFilter): Instinct[] {
    return instincts.filter(i => {
      if (filter.domain) {
        const domains = Array.isArray(filter.domain) ? filter.domain : [filter.domain];
        if (!domains.includes(i.domain)) return false;
      }

      if (filter.source) {
        const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
        if (!sources.includes(i.source)) return false;
      }

      if (filter.minConfidence !== undefined && i.confidence < filter.minConfidence) {
        return false;
      }

      if (filter.maxConfidence !== undefined && i.confidence > filter.maxConfidence) {
        return false;
      }

      if (filter.minUsageCount !== undefined && i.usageCount < filter.minUsageCount) {
        return false;
      }

      if (filter.createdAfter && i.createdAt < filter.createdAfter) {
        return false;
      }

      if (filter.createdBefore && i.createdAt > filter.createdBefore) {
        return false;
      }

      if (filter.searchText) {
        const text = filter.searchText.toLowerCase();
        const searchable = `${i.trigger} ${i.action}`.toLowerCase();
        if (!searchable.includes(text)) return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const instinctTags = i.metadata?.tags ?? [];
        if (!filter.tags.some(t => instinctTags.includes(t))) return false;
      }

      return true;
    });
  }

  private mergeInstincts(existing: Instinct, incoming: Instinct): Instinct {
    return {
      ...existing,
      confidence: Math.max(existing.confidence, incoming.confidence),
      usageCount: existing.usageCount + incoming.usageCount,
      successCount: existing.successCount + incoming.successCount,
      failureCount: existing.failureCount + incoming.failureCount,
      evidence: [...new Set([...existing.evidence, ...incoming.evidence])],
      updatedAt: new Date(),
      metadata: {
        ...existing.metadata,
        ...incoming.metadata,
        tags: [...new Set([
          ...(existing.metadata?.tags ?? []),
          ...(incoming.metadata?.tags ?? []),
        ])],
      },
    };
  }
}
```

---

## 4. 사용 예시

### 4.1 기본 사용

```typescript
import { InstinctStore, CONFIDENCE_LEVELS } from '@/core/learning';

const store = new InstinctStore();

// Instinct 생성
const instinct = await store.create({
  trigger: 'when writing new functions',
  action: 'Use functional patterns over classes',
  confidence: CONFIDENCE_LEVELS.TENTATIVE,
  domain: 'code-style',
  source: 'session-observation',
  evidence: [
    'User preferred arrow functions in auth.ts',
    'User refactored class to function in utils.ts',
  ],
});

console.log(`Created instinct: ${instinct.id}`);
```

### 4.2 컨텍스트 매칭

```typescript
// 현재 컨텍스트에 맞는 instinct 찾기
const context = `
  I'm about to write a new utility function.
  The function should validate user input.
`;

const matches = await store.findMatching(context, 'code-style');

for (const match of matches) {
  console.log(`Suggestion (${(match.confidence * 100).toFixed(0)}%): ${match.action}`);
}
```

### 4.3 신뢰도 조정

```typescript
// 사용자가 제안을 수락한 경우
await store.reinforce(instinct.id);
await store.recordUsage(instinct.id, true);

// 사용자가 제안을 거부한 경우
await store.correct(instinct.id);
await store.recordUsage(instinct.id, false);
```

### 4.4 진화 및 클러스터링

```typescript
// 진화 가능한 패턴 찾기
const evolutions = await store.evolve();

for (const evolution of evolutions) {
  console.log(`Evolution opportunity: ${evolution.type}`);
  console.log(`  - Name: ${evolution.suggestedName}`);
  console.log(`  - Pattern: ${evolution.pattern}`);
  console.log(`  - Based on ${evolution.sourceInstincts.length} instincts`);
}

// 도메인별 클러스터링
const clusters = await store.cluster('code-style');

for (const cluster of clusters) {
  console.log(`Cluster: ${cluster.name}`);
  console.log(`  - Size: ${cluster.instincts.length}`);
  console.log(`  - Ready for evolution: ${cluster.evolutionReady}`);
}
```

### 4.5 통계 및 분석

```typescript
const stats = await store.getStats();

console.log('Instinct Statistics:');
console.log(`  - Total: ${stats.total}`);
console.log(`  - Average confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);
console.log(`  - Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
console.log(`  - Evolution candidates: ${stats.evolutionCandidates}`);

const distribution = await store.getConfidenceDistribution();
console.log('Confidence Distribution:');
for (const [level, count] of distribution) {
  console.log(`  - ${level}: ${count}`);
}
```

---

## 5. 검증 계획

### 5.1 단위 테스트

```typescript
// tests/unit/learning/instinct-store.test.ts

describe('InstinctStore', () => {
  let store: InstinctStore;

  beforeEach(() => {
    store = new InstinctStore('/tmp/test-instincts');
  });

  describe('create', () => {
    it('should create instinct with initial confidence based on source', async () => {
      const instinct = await store.create({
        trigger: 'test trigger',
        action: 'test action',
        domain: 'code-style',
        source: 'session-observation',
        evidence: [],
      });

      expect(instinct.id).toBeDefined();
      expect(instinct.confidence).toBe(0.3); // TENTATIVE
    });

    it('should respect explicit confidence', async () => {
      const instinct = await store.create({
        trigger: 'test trigger',
        action: 'test action',
        confidence: 0.7,
        domain: 'code-style',
        source: 'user-correction',
        evidence: [],
      });

      expect(instinct.confidence).toBe(0.7);
    });
  });

  describe('reinforce', () => {
    it('should increase confidence by 0.05', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        confidence: 0.5,
        domain: 'testing',
        source: 'repo-analysis',
        evidence: [],
      });

      const reinforced = await store.reinforce(instinct.id);

      expect(reinforced?.confidence).toBe(0.55);
    });

    it('should not exceed max confidence', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        confidence: 0.94,
        domain: 'testing',
        source: 'explicit-teaching',
        evidence: [],
      });

      const reinforced = await store.reinforce(instinct.id);

      expect(reinforced?.confidence).toBe(0.95); // maxConfidence
    });
  });

  describe('correct', () => {
    it('should decrease confidence by 0.10', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        confidence: 0.5,
        domain: 'testing',
        source: 'repo-analysis',
        evidence: [],
      });

      const corrected = await store.correct(instinct.id);

      expect(corrected?.confidence).toBe(0.4);
    });

    it('should not go below min confidence', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        confidence: 0.15,
        domain: 'testing',
        source: 'pattern-inference',
        evidence: [],
      });

      const corrected = await store.correct(instinct.id);

      expect(corrected?.confidence).toBe(0.1); // minConfidence
    });
  });

  describe('findMatching', () => {
    it('should find relevant instincts by context', async () => {
      await store.create({
        trigger: 'writing functions',
        action: 'use functional patterns',
        confidence: 0.7,
        domain: 'code-style',
        source: 'user-correction',
        evidence: [],
      });

      const matches = await store.findMatching('I am writing a new function');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].trigger).toContain('function');
    });
  });

  describe('evolve', () => {
    it('should identify evolution candidates', async () => {
      // 고신뢰도, 고사용량 instinct 여러 개 생성
      for (let i = 0; i < 5; i++) {
        const instinct = await store.create({
          trigger: `functional pattern ${i}`,
          action: 'use pure functions',
          confidence: 0.85,
          domain: 'code-style',
          source: 'user-correction',
          evidence: [],
        });

        // 사용 횟수 시뮬레이션
        for (let j = 0; j < 15; j++) {
          await store.recordUsage(instinct.id, true);
        }
      }

      const evolutions = await store.evolve();

      expect(evolutions.length).toBeGreaterThan(0);
    });
  });
});
```

### 5.2 통합 테스트

```typescript
// tests/integration/learning/instinct-lifecycle.test.ts

describe('Instinct Lifecycle', () => {
  it('should complete full lifecycle: create → use → reinforce → evolve', async () => {
    const store = new InstinctStore();

    // 1. Create
    const instinct = await store.create({
      trigger: 'writing tests',
      action: 'use descriptive test names',
      domain: 'testing',
      source: 'session-observation',
      evidence: ['observed in test file'],
    });

    expect(instinct.confidence).toBe(0.3);

    // 2. Use and reinforce multiple times
    for (let i = 0; i < 20; i++) {
      await store.recordUsage(instinct.id, true);
      await store.reinforce(instinct.id);
    }

    // 3. Check updated confidence
    const updated = await store.get(instinct.id);
    expect(updated?.confidence).toBeGreaterThan(0.8);
    expect(updated?.usageCount).toBe(20);

    // 4. Check evolution eligibility
    const evolutions = await store.evolve();
    const hasThisInstinct = evolutions.some(e =>
      e.sourceInstincts.includes(instinct.id)
    );

    expect(hasThisInstinct).toBe(true);
  });
});
```

### 5.3 성능 테스트

```typescript
// tests/performance/instinct-store.perf.test.ts

describe('InstinctStore Performance', () => {
  it('should handle 1000 instincts efficiently', async () => {
    const store = new InstinctStore();

    // Create 1000 instincts
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      await store.create({
        trigger: `trigger ${i}`,
        action: `action ${i}`,
        domain: 'code-style',
        source: 'repo-analysis',
        evidence: [],
      });
    }

    const createTime = Date.now() - start;
    expect(createTime).toBeLessThan(5000); // 5초 이내

    // Search performance
    const searchStart = Date.now();
    await store.findMatching('writing function');
    const searchTime = Date.now() - searchStart;

    expect(searchTime).toBeLessThan(100); // 100ms 이내
  });
});
```

---

## 6. 체크리스트

### 6.1 구현 완료 조건

```markdown
## InstinctStore 구현 체크리스트

### 핵심 기능
- [ ] Instinct CRUD 작업 구현
- [ ] 신뢰도 조정 로직 (reinforce/correct/decay)
- [ ] 컨텍스트 매칭 알고리즘
- [ ] 필터 기반 검색

### 진화 메커니즘
- [ ] 클러스터링 알고리즘
- [ ] 진화 후보 식별
- [ ] 진화 결과 생성

### 저장소
- [ ] 파일 시스템 저장소 구현
- [ ] 인덱스 관리
- [ ] 백업/복원 기능

### 테스트
- [ ] 단위 테스트 커버리지 >80%
- [ ] 통합 테스트 완료
- [ ] 성능 테스트 통과 (1000 instincts < 5s)

### 문서화
- [ ] JSDoc 주석 완료
- [ ] 사용 예시 문서
- [ ] API 레퍼런스

### 통합
- [ ] learning/index.ts에 export 추가
- [ ] ReflexionPattern과 연동
- [ ] SolutionsCache와 연동
```

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.0
  작성일: 2026-02-06
  상태: 활성 (Active)

변경_이력:
  v1.0: 초기 버전 - InstinctStore 상세 스펙 정의

다음_갱신:
  예정일: 구현 시작 시
  담당: 프로젝트 소유자
```
