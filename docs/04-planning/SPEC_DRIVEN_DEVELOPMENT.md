# Spec-Driven Development Guide

> **버전**: 1.0
> **작성일**: 2026-02-07
> **목적**: 체계적인 스펙 기반 개발 프로세스 정의

---

## 1. 개요

### 1.1 Spec-Driven Development란?

구현 전에 명확한 스펙(인터페이스, 동작, 검증 기준)을 정의하고, 해당 스펙을 충족하는 코드를 작성하는 개발 방법론.

```
Spec 정의 → 테스트 작성 → 구현 → 검증 → 문서화
```

### 1.2 이 프로젝트에서의 적용

| 단계 | 산출물 | 위치 |
|-----|-------|-----|
| 1. Spec 정의 | Interface + Types | `docs/05-specifications/v2/` |
| 2. 테스트 작성 | Test Cases | `tests/unit/core/` |
| 3. 구현 | Source Code | `src/core/` |
| 4. 검증 | Test Results | CI/CD |
| 5. 문서화 | API Docs | `docs/07-api/` |

---

## 2. 현재 상태 및 정리 필요 항목

### 2.1 문서 정리 대상

| 현재 상태 | 문제점 | 조치 |
|----------|--------|-----|
| `IMPROVEMENT_RECOMMENDATIONS.md` (v1) | v2.3과 중복 | 아카이브 이동 |
| `IMPROVEMENT_RECOMMENDATIONS_v2.md` | 버전 접미사 불필요 | 이름 정규화 |
| `FEATURE_IMPROVEMENTS.md` | 날짜 구버전 (01-24) | 최신화 또는 아카이브 |
| 분산된 스펙 정보 | 4개 문서에 흩어짐 | 단일 스펙 문서로 통합 |

### 2.2 현재 디렉토리 구조

```
docs/
├── 04-planning/
│   ├── _archive/              # ✅ 구버전 문서 보관
│   └── ...
├── 05-specifications/         # ✅ 스펙 문서 (통합)
│   ├── README.md
│   ├── v1/                    # 프로젝트 레벨 리팩토링 계획
│   └── v2/                    # Feature 별 상세 스펙
│       ├── F001-ConfidenceChecker.md
│       ├── F002-SelfCheckProtocol.md
│       ├── F003-GoalBackwardVerifier.md
│       ├── F004-ReflexionPattern.md
│       ├── F005-InstinctStore.md
│       └── F006-SolutionsCache.md
└── 07-api/                    # 🆕 API 문서 (구현 후)
```

---

## 3. 작업 리스트

### Phase 0: 문서 정리 (선행 작업)

| # | 작업 | 우선순위 | 상태 |
|---|-----|---------|------|
| 0.1 | `_archive/` 디렉토리 생성 | P0 | ✅ |
| 0.2 | `IMPROVEMENT_RECOMMENDATIONS.md` (v1) → `_archive/` 이동 | P0 | ✅ |
| 0.3 | `IMPROVEMENT_RECOMMENDATIONS_v2.md` → `IMPROVEMENT_RECOMMENDATIONS.md` 이름 변경 | P0 | ✅ |
| 0.4 | `FEATURE_IMPROVEMENTS.md` 검토 후 아카이브 여부 결정 | P1 | ✅ (유지) |
| 0.5 | `docs/05-specifications/v2/` 스펙 디렉토리 구조 생성 | P0 | ✅ |
| 0.6 | 스펙 문서 템플릿 작성 | P0 | ✅ |

### Phase 1: Validation 모듈 스펙 (P0)

| # | 작업 | 산출물 | 상태 |
|---|-----|-------|------|
| 1.1 | ConfidenceChecker 스펙 작성 | `F001-ConfidenceChecker.md` | ✅ |
| 1.2 | SelfCheckProtocol 스펙 작성 | `F002-SelfCheckProtocol.md` | ✅ |
| 1.3 | GoalBackwardVerifier 스펙 작성 | `F003-GoalBackwardVerifier.md` | ✅ |
| 1.4 | 테스트 케이스 정의 | `tests/unit/core/validation/` | ✅ |

### Phase 2: Learning 모듈 스펙 (P1)

| # | 작업 | 산출물 | 상태 |
|---|-----|-------|------|
| 2.1 | ReflexionPattern 스펙 작성 | `F004-ReflexionPattern.md` | ✅ |
| 2.2 | InstinctStore 스펙 작성 | `F005-InstinctStore.md` | ✅ |
| 2.3 | SolutionsCache 스펙 작성 | `F006-SolutionsCache.md` | ✅ |
| 2.4 | 테스트 케이스 정의 | `tests/unit/core/learning/` | ✅ |

### Phase 3: 구현 (✅ 완료)

| # | 작업 | 산출물 | 상태 |
|---|-----|-------|------|
| 3.1 | ConfidenceChecker 구현 | `src/core/validation/confidence-checker.ts` (11KB) | ✅ |
| 3.2 | SelfCheckProtocol 구현 | `src/core/validation/self-check-protocol.ts` (10KB) | ✅ |
| 3.3 | GoalBackwardVerifier 구현 | `src/core/validation/goal-backward-verifier.ts` (12KB) | ✅ |
| 3.4 | ReflexionPattern 구현 | `src/core/learning/reflexion-pattern.ts` (10KB) | ✅ |
| 3.5 | InstinctStore 구현 | `src/core/learning/instinct-store.ts` (22KB) | ✅ |
| 3.6 | SolutionsCache 구현 | `src/core/learning/solutions-cache.ts` (17KB) | ✅ |

---

## 4. 스펙 문서 템플릿

각 컴포넌트의 스펙 문서는 다음 구조를 따름:

```markdown
# [Component Name] Specification

> **Version**: 1.0
> **Status**: Draft | Review | Approved | Implemented
> **Last Updated**: YYYY-MM-DD

## 1. Overview
### 1.1 Purpose
### 1.2 Scope
### 1.3 Out of Scope

## 2. Interface Definition
### 2.1 Types
### 2.2 Interfaces
### 2.3 Enums/Constants

## 3. Behavioral Specification
### 3.1 Preconditions
### 3.2 Postconditions
### 3.3 Invariants
### 3.4 State Transitions (if applicable)

## 4. Error Handling
### 4.1 Error Types
### 4.2 Recovery Strategies

## 5. Test Cases
### 5.1 Unit Tests
### 5.2 Integration Tests
### 5.3 Edge Cases

## 6. Performance Requirements
### 6.1 Latency
### 6.2 Memory
### 6.3 Throughput

## 7. Dependencies
### 7.1 Internal
### 7.2 External

## 8. Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## 9. Open Questions
- Q1: ...

## Appendix
### A. Examples
### B. References
```

---

## 5. 의존성 그래프

```
Phase 0 (문서 정리)
    │
    ├──► Phase 1 (Validation 스펙)
    │         │
    │         ├──► 1.1 ConfidenceChecker ──► 3.1 구현
    │         ├──► 1.2 SelfCheckProtocol ──► 3.2 구현
    │         └──► 1.3 GoalBackwardVerifier ──► 3.3 구현
    │
    └──► Phase 2 (Learning 스펙)
              │
              ├──► 2.1 ReflexionPattern ──► 3.4 구현
              └──► 2.2 InstinctStore ──► 3.5 구현
```

---

## 6. 진행 상태 추적

### 6.1 상태 정의

| 상태 | 설명 | 이모지 |
|-----|------|-------|
| Not Started | 작업 시작 전 | ⏳ |
| In Progress | 작업 진행 중 | 🔄 |
| Review | 리뷰 대기 중 | 👀 |
| Approved | 승인됨 (스펙) / 완료 (구현) | ✅ |
| Blocked | 차단됨 | 🚫 |

### 6.2 진행률 대시보드

```
Phase 0: 문서 정리     [██████████] 100% (6/6)
Phase 1: Validation   [██████████] 100% (4/4)
Phase 2: Learning     [██████████] 100% (4/4)
Phase 3: 구현         [██████████] 100% (6/6)
────────────────────────────────────────
Overall:              [██████████] 100% (20/20)
```

---

## 7. 검증 프로세스

### 7.1 스펙 검증 체크리스트

```yaml
스펙_검증:
  완전성:
    - [ ] 모든 public 인터페이스 정의됨
    - [ ] 모든 에러 케이스 정의됨
    - [ ] 성능 요구사항 정의됨

  명확성:
    - [ ] 애매한 용어 없음
    - [ ] 예제 코드 포함
    - [ ] 경계 조건 명시

  테스트_가능성:
    - [ ] 모든 동작이 검증 가능
    - [ ] 테스트 케이스 정의됨
    - [ ] 성공 기준 측정 가능
```

### 7.2 구현 검증 체크리스트

```yaml
구현_검증:
  스펙_준수:
    - [ ] 모든 인터페이스 구현됨
    - [ ] 모든 에러 핸들링 구현됨
    - [ ] 성능 요구사항 충족

  코드_품질:
    - [ ] TypeScript strict mode 통과
    - [ ] ESLint 에러 없음
    - [ ] 테스트 커버리지 80%+

  통합:
    - [ ] 기존 시스템과 호환
    - [ ] 문서 업데이트됨
```

---

## 8. 다음 단계

### 완료된 작업 (2026-02-07)

**Phase 0: 문서 정리 (6/6 완료)**
1. [x] `_archive/` 디렉토리 생성
2. [x] `IMPROVEMENT_RECOMMENDATIONS.md` (v1) → `_archive/` 이동
3. [x] `IMPROVEMENT_RECOMMENDATIONS_v2.md` → 이름 변경
4. [x] `FEATURE_IMPROVEMENTS.md` 검토 → 유지 결정
5. [x] `docs/05-specifications/v2/` 스펙 문서 작성
6. [x] 스펙 문서 템플릿 적용

**Phase 1: Validation 스펙 (4/4 완료)**
1. [x] ConfidenceChecker 스펙 작성 (F001)
2. [x] SelfCheckProtocol 스펙 작성 (F002)
3. [x] GoalBackwardVerifier 스펙 작성 (F003)
4. [x] 테스트 케이스 정의 (`tests/unit/core/validation/`)

**Phase 2: Learning 스펙 (4/4 완료)**
1. [x] ReflexionPattern 스펙 작성 (F004)
2. [x] InstinctStore 스펙 작성 (F005)
3. [x] SolutionsCache 스펙 작성 (F006)
4. [x] 테스트 케이스 정의 (`tests/unit/core/learning/`)

### Phase 3: 구현 (✅ 완료 - 2026-02-06)

> **참고**: 구현은 스펙 문서 작성 전에 이미 완료되어 있었음

1. [x] ConfidenceChecker 구현 (3.1) - `src/core/validation/confidence-checker.ts`
2. [x] SelfCheckProtocol 구현 (3.2) - `src/core/validation/self-check-protocol.ts`
3. [x] GoalBackwardVerifier 구현 (3.3) - `src/core/validation/goal-backward-verifier.ts`
4. [x] ReflexionPattern 구현 (3.4) - `src/core/learning/reflexion-pattern.ts`
5. [x] InstinctStore 구현 (3.5) - `src/core/learning/instinct-store.ts`
6. [x] SolutionsCache 구현 (3.6) - `src/core/learning/solutions-cache.ts`

### 다음 단계 (P2/P3)

1. [ ] P2: Context 모듈 통합 (`src/core/context/`)
2. [ ] P3: Agent 통합 (`src/core/agents/`)

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.2
  작성일: 2026-02-07
  수정일: 2026-02-08
  상태: 완료 (P0/P1 Complete)

관련_문서:
  - IMPLEMENTATION_PRIORITY_LIST.md
  - CODE_STRUCTURE_IMPROVEMENT_PLAN.md
  - docs/05-specifications/v2/ (상세 Feature 스펙)

변경_이력:
  v1.2: 05-specs 디렉토리를 05-specifications/v2/로 통합 (2026-02-08)
  v1.1: Phase 3 구현 완료 상태 반영 (실제 코드 확인)
  v1.0: 초기 버전 - SDD 프로세스 정의
```
