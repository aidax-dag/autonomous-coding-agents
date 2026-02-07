# Specifications

> 기능 스펙 및 리팩토링 문서

## Structure

```
05-specifications/
├── v1/    # 리팩토링 계획 v1 (프로젝트 전체 관점)
└── v2/    # 리팩토링 계획 v2 (기능별 상세 스펙)
```

## v1 - Project-Level Refactoring

프로젝트 전체 관점에서의 리팩토링 계획 문서입니다.

| # | Document | Description |
|---|----------|-------------|
| 00 | [PROJECT_SUMMARY](./v1/00_PROJECT_SUMMARY_AND_NEXT_STEPS.md) | 프로젝트 요약 및 다음 단계 |
| 01 | [MODULE_FEATURE](./v1/01_MODULE_FEATURE_SPECIFICATION.md) | 모듈 기능 스펙 |
| 02 | [TECHNICAL_DESIGN](./v1/02_TECHNICAL_DESIGN_PATTERNS.md) | 기술 설계 패턴 |
| 03 | [IMPLEMENTATION](./v1/03_IMPLEMENTATION_DETAILS.md) | 구현 상세 |
| 04 | [ROADMAP](./v1/04_IMPLEMENTATION_ROADMAP.md) | 구현 로드맵 |

## v2 - Feature-Level Specifications

개별 기능 단위의 상세 스펙 문서입니다.

| ID | Feature | Description |
|----|---------|-------------|
| F001 | [ConfidenceChecker](./v2/F001-ConfidenceChecker.md) | 신뢰도 검증 모듈 |
| F002 | [SelfCheckProtocol](./v2/F002-SelfCheckProtocol.md) | 자가 점검 프로토콜 |
| F003 | [GoalBackwardVerifier](./v2/F003-GoalBackwardVerifier.md) | 목표 역방향 검증 |
| F004 | [ReflexionPattern](./v2/F004-ReflexionPattern.md) | 리플렉션 패턴 |
| F005 | [InstinctStore](./v2/F005-InstinctStore.md) | 인스팅트 저장소 |
| F006 | [SolutionsCache](./v2/F006-SolutionsCache.md) | 솔루션 캐시 |
| F007 | [QualityCurve](./v2/F007-QualityCurve.md) | 품질 곡선 추적 |
| F008 | [ContextModule](./v2/F008-ContextModule.md) | 컨텍스트 모듈 |
| F009 | [AgentConsolidation](./v2/F009-AgentConsolidation.md) | 에이전트 통합 |

## Reading Order

1. **v1 문서를 먼저 읽기** → 전체 아키텍처와 방향성 이해
2. **v2 문서로 상세 확인** → 개별 기능 구현 상세 확인
