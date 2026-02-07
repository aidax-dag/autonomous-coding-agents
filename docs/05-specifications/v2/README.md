# Refactor v2 - Feature Specifications

> **버전**: 1.2
> **작성일**: 2026-02-06
> **상태**: 활성 (Active)
> **코드 대조 기준일**: 2026-02-06

---

## 개요

이 디렉토리는 autonomous-coding-agents 프로젝트의 리팩토링 v2 기능 명세서를 포함합니다.
각 문서는 `As-Is`(현재 코드 상태)와 `To-Be`(목표 설계/리팩토링 계획)를 함께 다룹니다.

---

## 문서 해석 기준

- `As-Is`: 현재 저장소 코드/테스트 기준의 실제 동작과 구조
- `To-Be`: 리팩토링 완료 시점의 목표 구조 및 마이그레이션 계획
- 판단 우선순위:
  - `런타임/동작 정확성`: 코드 + 테스트 우선
  - `아키텍처 방향성`: 문서(To-Be) 우선

---

## 코드 대조 스냅샷 (As-Is, 2026-02-06)

| 문서 | 기능 | 현재 코드 상태 | 비고 |
|-----|------|---------------|------|
| F001 | ConfidenceChecker | ✅ 구현됨 | 단위 테스트 존재 |
| F002 | SelfCheckProtocol | ✅ 구현됨 | 단위 테스트 존재 |
| F003 | GoalBackwardVerifier | ⚠️ 구현됨(부분 완화) | WIRED 검증이 문서 목표 대비 완화 |
| F004 | ReflexionPattern | ✅ 구현됨 | 단위 테스트 존재 |
| F005 | InstinctStore | ✅ 구현됨 | 단위 테스트 존재 |
| F006 | SolutionsCache | ✅ 구현됨 | 단위 테스트 존재 |
| F007 | QualityCurve | ✅ 구현됨 | 단위 테스트 존재 |
| F008 | Context Module 통합 | ✅ 구현됨 | `core/context` 통합 모듈 존재 |
| F009 | Agent 통합 | ⚠️ 부분 구현 | 구조 통합은 진행 중(분산 상태) |

---

## Feature 목록

### P0 - 즉시 구현 (Critical Path)

| 문서 | 기능명 | 모듈 | To-Be 상태 | 예상 ROI |
|-----|-------|-----|------|---------|
| [F001](./F001-ConfidenceChecker.md) | ConfidenceChecker | validation/ | ⏳ 대기 | 25-250x |
| [F002](./F002-SelfCheckProtocol.md) | SelfCheckProtocol | validation/ | ⏳ 대기 | 환각 탐지 |
| [F003](./F003-GoalBackwardVerifier.md) | GoalBackwardVerifier | validation/ | ⏳ 대기 | 완료 검증 |

### P1 - 단기 구현 (High Value)

| 문서 | 기능명 | 모듈 | To-Be 상태 | 효과 |
|-----|-------|-----|------|------|
| [F004](./F004-ReflexionPattern.md) | ReflexionPattern | learning/ | ⏳ 대기 | 에러 재발 <10% |
| [F005](./F005-InstinctStore.md) | InstinctStore | learning/ | ⏳ 대기 | 패턴 학습 |
| [F006](./F006-SolutionsCache.md) | SolutionsCache | learning/ | ⏳ 대기 | 0토큰 조회 |

### P2 - 중기 구현 (Optimization)

| 문서 | 기능명 | 모듈 | To-Be 상태 | 효과 |
|-----|-------|-----|------|------|
| [F007](./F007-QualityCurve.md) | QualityCurve | context/ | ⏳ 대기 | 품질 개선 |
| [F008](./F008-ContextModule.md) | Context Module 통합 | context/ | ⏳ 대기 | 기능 통합 |

### P3 - 장기 구현 (Consolidation)

| 문서 | 기능명 | 모듈 | To-Be 상태 | 효과 |
|-----|-------|-----|------|------|
| [F009](./F009-AgentConsolidation.md) | Agent 통합 | agents/ | ⏳ 대기 | 코드 통합 |

---

## 우선순위 및 의존성 그래프

```
                    ┌──────────────────────┐
                    │ 기초 설정 (완료)      │
                    └──────────┬───────────┘
                               ▼
                 ┌────────────────────────────┐
                 │ P0: F001 → F002 → F003    │
                 └──────────┬─────────────────┘
                            ▼
                 ┌────────────────────────────┐
                 │ P1: F004                   │
                 └───────┬───────────┬────────┘
                         ▼           ▼
                   ┌──────────┐ ┌──────────┐
                   │ F005     │ │ F006     │
                   └─────┬────┘ └─────┬────┘
                         └──────┬──────┘
                                ▼
                 ┌────────────────────────────┐
                 │ P2: F007 → F008            │
                 │ (P0 + P1 완료 후 착수)     │
                 └──────────┬─────────────────┘
                            ▼
                 ┌────────────────────────────┐
                 │ P3: F009                   │
                 │ (P0 + P1 + P2 완료 후)     │
                 └────────────────────────────┘
```

---

## 타임라인 (To-Be)

```
기준일: 2026-02-06 (금), 아래 일정은 리팩토링 목표 계획입니다.

기초 설정      2026-02-02 ~ 2026-02-06    ✅ 완료
P0 (F001-003)  2026-02-09 ~ 2026-02-27    ⏳ 2-3주
P1 (F004-006)  2026-03-02 ~ 2026-03-27    ⏳ 3-4주
P2 (F007-008)  2026-03-30 ~ 2026-04-17    ⏳ 2-3주 (P0, P1 완료 후)
P3 (F009)      2026-04-20 ~ 2026-05-29+   ⏳ 6주+ (P0, P1, P2 완료 후)
```

---

## 문서 구조 가이드

각 Feature 문서는 다음 **기본 구조를 권장**하며, 필요 시 확장 섹션을 추가할 수 있습니다:

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

## (선택) 마이그레이션 가이드/전략
   - 단계별 전환 계획
   - 하위 호환성 전략

## (선택) 리스크 관리
   - 리스크 식별/영향도
   - 완화 전략

## 문서 메타데이터
   - 버전, 상태, 변경 이력
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
  버전: 1.2
  작성일: 2026-02-06
  상태: 활성 (Active)

변경_이력:
  v1.2: As-Is/To-Be 해석 기준 및 코드 대조 스냅샷 추가
  v1.1: 의존성 그래프/타임라인/문서 구조 가이드 일관성 보강
  v1.0: 초기 버전 - Feature 목록 및 구조 정의

다음_갱신:
  예정일: Feature 추가/변경 시
  담당: 프로젝트 소유자
```
