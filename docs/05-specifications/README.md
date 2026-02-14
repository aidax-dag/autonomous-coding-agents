# Specifications

> 기능 스펙 및 리팩토링 문서 (Single Source of Truth)

## Structure

```
05-specifications/
├── v1/    # 리팩토링 계획 v1 (프로젝트 전체 관점)
├── v2/    # Feature별 상세 스펙 (구현 가이드 포함)
└── v3/    # MAL + Ticket/Feature Cycle + Agent Economy
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

개별 기능 단위의 상세 스펙 문서입니다. 인터페이스, 동작 스펙, 구현 가이드를 포함합니다.

### P0 - Validation 모듈 (✅ 완료)

| ID | Feature | Description | 상태 |
|----|---------|-------------|------|
| F001 | [ConfidenceChecker](./v2/F001-ConfidenceChecker.md) | 사전 실행 신뢰도 검사 | ✅ |
| F002 | [SelfCheckProtocol](./v2/F002-SelfCheckProtocol.md) | 사후 실행 자체 검사 | ✅ |
| F003 | [GoalBackwardVerifier](./v2/F003-GoalBackwardVerifier.md) | 목표 역방향 검증 | ✅ |

### P1 - Learning 모듈 (✅ 완료)

| ID | Feature | Description | 상태 |
|----|---------|-------------|------|
| F004 | [ReflexionPattern](./v2/F004-ReflexionPattern.md) | 에러 학습 시스템 | ✅ |
| F005 | [InstinctStore](./v2/F005-InstinctStore.md) | Instinct 기반 학습 | ✅ |
| F006 | [SolutionsCache](./v2/F006-SolutionsCache.md) | 빠른 조회 캐시 | ✅ |

### P2 - Context 모듈 (✅ 완료)

| ID | Feature | Description | 상태 |
|----|---------|-------------|------|
| F007 | [QualityCurve](./v2/F007-QualityCurve.md) | 품질 곡선 추적 | ✅ |
| F008 | [ContextModule](./v2/F008-ContextModule.md) | 컨텍스트 모듈 | ✅ |

### P3 - Agent 모듈 (✅ 완료)

| ID | Feature | Description | 상태 |
|----|---------|-------------|------|
| F009 | [AgentConsolidation](./v2/F009-AgentConsolidation.md) | 에이전트 통합 | ✅ |

## v3 - Program-Level Next Architecture

ACA를 Ticket 기반 Product Builder + 재사용 Feature 자산 + Agent Economy로 확장하기 위한 프로그램 스펙 문서입니다.

| ID | Feature | Description | 상태 |
|----|---------|-------------|------|
| F021 | [MAL](./v3/F021-MAL.md) | Multi Agent Abstraction Layer | 🟡 Draft |
| F022 | [Ticket/Feature Cycle](./v3/F022-Ticket-Feature-Cycle.md) | Ticket 기반 실행 + Feature 재사용 관리 | 🟡 Draft |
| F023 | [Agent Economy](./v3/F023-Agent-Economy.md) | 원격 Agent 마켓/프라이버시/정산 계약 | 🟡 Draft |
| F024 | [Program Roadmap](./v3/F024-Program-Roadmap.md) | 다중 프로젝트 단계별 실행 계획 | 🟡 Draft |
| F025 | [Feature Management Service](./v3/F025-Feature-Management-Service.md) | Feature 카탈로그 운영 서비스 설계/구현 | 🟢 Implemented |
| F026 | [Ticket/Feature Runtime + MCP Enforcement](./v3/F026-Ticket-Feature-Runtime-and-MCP-Enforcement.md) | Ticket/Feature 런타임 구현과 MCP 필수 정책 | 🟢 Implemented |
| F027 | [ACA Platform Final Definition](./v3/F027-ACA-Platform-Final-Definition.md) | v1/v1.1 범위 고정 + 제품 정체성/게이트/로드맵 경계 | 🟢 Finalized |

보조 문서:

- [v3 Overview](./v3/README.md)
- `schemas/ticket.schema.json`
- `schemas/feature.schema.json`
- `schemas/a2a-economic-contract.schema.json`

## Reading Order

1. **v1 문서를 먼저 읽기** → 전체 아키텍처와 방향성 이해
2. **v2 문서로 상세 확인** → 개별 기능 구현 상세 확인
3. **v3 문서로 확장 계획 확인** → MAL/Ticket/Feature/Economy 프로그램 설계 확인

## 관련 문서

- [SPEC_DRIVEN_DEVELOPMENT.md](../04-planning/SPEC_DRIVEN_DEVELOPMENT.md) - SDD 프로세스
- [IMPLEMENTATION_PRIORITY_LIST.md](../04-planning/IMPLEMENTATION_PRIORITY_LIST.md) - 구현 우선순위
- [tests/unit/core/](../../tests/unit/core/) - 단위 테스트

---

```yaml
문서_정보:
  수정일: 2026-02-14
  변경_이력:
    - "F027 최종 정의 문서 추가 (v1 Builder 고정, Jira v1.1, Remote Trust/Personal Agent 정책 확정)"
    - "v3 스펙 섹션 확장 (F021~F026)"
    - "P3 구조 통합 완료 (2026-02-08)"
    - "P3 핵심 구현 완료 상태 반영 (2026-02-08)"
    - "05-specs/ 디렉토리를 v2/로 통합 (2026-02-08)"
    - "구현 상태 표시 추가"
```
