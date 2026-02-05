# Refactor v2 - Feature Specifications

> **버전**: 1.0
> **작성일**: 2026-02-06
> **상태**: 활성 (Active)

---

## 개요

이 디렉토리는 autonomous-coding-agents 프로젝트의 리팩토링 v2 기능 명세서를 포함합니다.
각 문서는 구현해야 할 기능의 상세 스펙, 검증 방법, 테스트 계획을 담고 있습니다.

---

## Feature 목록

### P0 - 즉시 구현 (Critical Path)

| 문서 | 기능명 | 모듈 | 상태 | 예상 ROI |
|-----|-------|-----|------|---------|
| [F001](./F001-ConfidenceChecker.md) | ConfidenceChecker | validation/ | ⏳ 대기 | 25-250x |
| [F002](./F002-SelfCheckProtocol.md) | SelfCheckProtocol | validation/ | ⏳ 대기 | 환각 탐지 |
| [F003](./F003-GoalBackwardVerifier.md) | GoalBackwardVerifier | validation/ | ⏳ 대기 | 완료 검증 |

### P1 - 단기 구현 (High Value)

| 문서 | 기능명 | 모듈 | 상태 | 효과 |
|-----|-------|-----|------|------|
| [F004](./F004-ReflexionPattern.md) | ReflexionPattern | learning/ | ⏳ 대기 | 에러 재발 <10% |
| [F005](./F005-InstinctStore.md) | InstinctStore | learning/ | ⏳ 대기 | 패턴 학습 |
| [F006](./F006-SolutionsCache.md) | SolutionsCache | learning/ | ⏳ 대기 | 0토큰 조회 |

### P2 - 중기 구현 (Optimization)

| 문서 | 기능명 | 모듈 | 상태 | 효과 |
|-----|-------|-----|------|------|
| [F007](./F007-QualityCurve.md) | QualityCurve | context/ | ⏳ 대기 | 품질 개선 |
| [F008](./F008-ContextModule.md) | Context Module 통합 | context/ | ⏳ 대기 | 기능 통합 |

### P3 - 장기 구현 (Consolidation)

| 문서 | 기능명 | 모듈 | 상태 | 효과 |
|-----|-------|-----|------|------|
| [F009](./F009-AgentConsolidation.md) | Agent 통합 | agents/ | ⏳ 대기 | 코드 통합 |

---

## 우선순위 및 의존성 그래프

```
                    ┌─────────────────┐
                    │   기초 설정     │
                    │   (완료)        │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ F001            │  │ F004            │  │ F007            │
│ Confidence      │  │ Reflexion       │  │ Quality         │
│ Checker (P0)    │  │ Pattern (P1)    │  │ Curve (P2)      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ F002            │  │ F005            │  │ F008            │
│ SelfCheck       │  │ Instinct        │  │ Context         │
│ Protocol (P0)   │  │ Store (P1)      │  │ Module (P2)     │
└────────┬────────┘  └────────┬────────┘  └─────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│ F003            │  │ F006            │
│ GoalBackward    │  │ Solutions       │
│ Verifier (P0)   │  │ Cache (P1)      │
└────────┬────────┘  └─────────────────┘
         │
         └──────────────────┬──────────────────┐
                            ▼                  │
                   ┌─────────────────┐         │
                   │ F009            │ ◀───────┘
                   │ Agent           │
                   │ Consolidation   │
                   │ (P3)            │
                   └─────────────────┘
```

---

## 타임라인

```
Feb W1        Feb W2-3       Feb W4-Mar W2    Mar W3+         Q2+
───────       ─────────      ─────────────    ───────         ────

┌─────┐      ┌──────────┐   ┌──────────┐    ┌──────────┐    ┌──────────┐
│기초 │  →   │ P0       │ → │ P1       │ →  │ P2       │ →  │ P3       │
│설정 │      │ F001-003 │   │ F004-006 │    │ F007-008 │    │ F009     │
└─────┘      └──────────┘   └──────────┘    └──────────┘    └──────────┘

✅ 완료       ⏳ 2-3주       ⏳ 3-4주        ⏳ 2-3주        ⏳ 6주+
```

---

## 문서 구조 가이드

각 Feature 문서는 다음 구조를 따릅니다:

```markdown
# FXXX - Feature Name

## 1. 개요
   - 목적, 배경, 출처 패턴

## 2. 상세 스펙
   - 인터페이스 정의
   - 데이터 구조
   - 상수/설정값

## 3. 구현 가이드
   - 파일 위치
   - 클래스/함수 구조
   - 의존성

## 4. 사용 예시
   - 코드 예시
   - 통합 방법

## 5. 검증 계획
   - 단위 테스트
   - 통합 테스트
   - 성능 테스트

## 6. 체크리스트
   - 구현 완료 조건
```

---

## 관련 문서

- [IMPLEMENTATION_PRIORITY_LIST.md](../planning/IMPLEMENTATION_PRIORITY_LIST.md)
- [IMPROVEMENT_RECOMMENDATIONS_v2.md](../planning/IMPROVEMENT_RECOMMENDATIONS_v2.md)
- [CODE_STRUCTURE_IMPROVEMENT_PLAN.md](../planning/CODE_STRUCTURE_IMPROVEMENT_PLAN.md)

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.0
  작성일: 2026-02-06
  상태: 활성 (Active)

변경_이력:
  v1.0: 초기 버전 - Feature 목록 및 구조 정의

다음_갱신:
  예정일: Feature 추가/변경 시
  담당: 프로젝트 소유자
```
