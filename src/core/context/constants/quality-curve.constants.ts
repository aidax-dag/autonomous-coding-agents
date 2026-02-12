/**
 * QualityCurve Constants
 *
 * Quality thresholds, level info, and configuration values.
 *
 * @module core/context/constants
 */

import type {
  QualityLevelInfo,
  ContextWarning,
} from '../interfaces/quality-curve.interface';
import { QualityLevel } from '../interfaces/quality-curve.interface';

// ============================================================================
// Quality Thresholds
// ============================================================================

/**
 * Quality level thresholds (percentage boundaries)
 */
export const QUALITY_THRESHOLDS = {
  /** PEAK level ends at 30% */
  PEAK_END: 30,
  /** GOOD level ends at 50% */
  GOOD_END: 50,
  /** DEGRADING level ends at 70% */
  DEGRADING_END: 70,
  // POOR: 70%+
} as const;

// ============================================================================
// Plan Configuration
// ============================================================================

/**
 * Plan configuration values
 */
export const PLAN_CONFIG = {
  /** Recommended tasks per plan */
  RECOMMENDED_TASKS_PER_PLAN: 3,
  /** Target context usage percentage */
  TARGET_CONTEXT_USAGE: 50,
  /** Threshold for new plan recommendation */
  NEW_PLAN_THRESHOLD: 50,
  /** Critical threshold requiring immediate new plan */
  CRITICAL_THRESHOLD: 70,
  /** Estimated tokens per task */
  TOKENS_PER_TASK_ESTIMATE: 3000,
} as const;

// ============================================================================
// Quality Level Info
// ============================================================================

/**
 * Detailed information for each quality level
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
        {
          name: 'remove_verbose_comments',
          description: '장황한 주석 제거',
          applicableTo: ['code'],
          tokenSaving: 50,
          enabled: true,
        },
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
        {
          name: 'remove_verbose_comments',
          description: '장황한 주석 제거',
          applicableTo: ['code'],
          tokenSaving: 50,
          enabled: true,
        },
        {
          name: 'summarize_explanations',
          description: '설명 요약',
          applicableTo: ['text'],
          tokenSaving: 100,
          enabled: true,
        },
        {
          name: 'abbreviate_identifiers',
          description: '식별자 축약 (문서 내)',
          applicableTo: ['text'],
          tokenSaving: 30,
          enabled: true,
        },
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
        {
          name: 'remove_all_comments',
          description: '모든 주석 제거',
          applicableTo: ['code'],
          tokenSaving: 80,
          enabled: true,
        },
        {
          name: 'minimal_output',
          description: '최소 출력 모드',
          applicableTo: ['all'],
          tokenSaving: 200,
          enabled: true,
        },
        {
          name: 'skip_examples',
          description: '예시 생략',
          applicableTo: ['text'],
          tokenSaving: 150,
          enabled: true,
        },
        {
          name: 'code_only',
          description: '코드만 출력',
          applicableTo: ['code'],
          tokenSaving: 100,
          enabled: true,
        },
      ],
    },
  },
};

// ============================================================================
// Warning Templates
// ============================================================================

/**
 * Warning message templates
 */
export const WARNING_TEMPLATES: Record<string, ContextWarning> = {
  approaching_good: {
    type: 'usage',
    severity: 'info',
    message: '컨텍스트 사용률이 30%에 접근 중입니다.',
    suggestion: '계획을 검토하고 불필요한 컨텍스트를 정리하세요.',
  },
  entering_degrading: {
    type: 'quality',
    severity: 'warning',
    message: '⚠️ 품질 저하 구간 진입. 컨텍스트 사용률 50% 초과.',
    suggestion: '새 계획 시작을 강력히 권장합니다.',
  },
  entering_poor: {
    type: 'quality',
    severity: 'critical',
    message: '🚨 낮은 품질 구간 진입. 컨텍스트 사용률 70% 초과.',
    suggestion: '즉시 새 계획을 시작하세요. 새로운 작업을 시작하지 마세요.',
  },
  budget_critical: {
    type: 'budget',
    severity: 'critical',
    message: '🚨 토큰 예산이 거의 소진되었습니다.',
    suggestion: '현재 태스크를 빠르게 마무리하고 새 세션을 시작하세요.',
  },
};
