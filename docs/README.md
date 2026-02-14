# Documentation

> CodeAvengers 프로젝트 문서

## 📁 Structure

```
docs/
├── 01-vision/           # 전략 및 비전
├── 02-architecture/     # 시스템 아키텍처
├── 03-guides/           # 사용자 가이드
├── 04-planning/         # 기획 및 분석
├── 05-specifications/   # 기능 스펙 문서
│   ├── v1/              # 리팩토링 v1
│   ├── v2/              # 리팩토링 v2 (기능별)
│   └── v3/              # MAL/Ticket/Feature/Economy 확장 스펙
├── 06-roadmap/          # 로드맵 및 태스크
│   └── tasks/           # 상세 태스크
└── checklists/          # 스프린트/게이트 운영 체크리스트
```

---

## 📚 Quick Links

### 01. Vision (전략/비전)
| Document | Description |
|----------|-------------|
| [VISION](./01-vision/VISION.md) | 프로젝트 비전 및 목표 |
| [UNIFIED_VISION](./01-vision/UNIFIED_VISION.md) | 통합 비전 문서 |
| [AI_CODING_AGENTS_COMPARISON](./01-vision/AI_CODING_AGENTS_COMPARISON.md) | AI 코딩 에이전트 비교 분석 |

### 02. Architecture (아키텍처)
| Document | Description |
|----------|-------------|
| [OVERVIEW](./02-architecture/OVERVIEW.md) | 아키텍처 개요 |
| [SYSTEM_DESIGN](./02-architecture/SYSTEM_DESIGN.md) | 시스템 설계 상세 |
| [MODULE_REFERENCE](./02-architecture/MODULE_REFERENCE.md) | 모듈 구조 참조 |

### 03. Guides (운영 가이드)
| Document | Description |
|----------|-------------|
| [CLI_USAGE](./03-guides/CLI_USAGE.md) | CLI 명령어 사용법 |
| [CODE_QUALITY](./03-guides/CODE_QUALITY.md) | 코드 품질 표준 (개발자 필독) |
| [DEPLOYMENT](./03-guides/DEPLOYMENT.md) | 배포 가이드 |
| [TESTING](./03-guides/TESTING.md) | 테스트 가이드 |
| [WEBHOOK_SETUP](./03-guides/WEBHOOK_SETUP.md) | GitHub 웹훅 설정 |
| [INTERACTIVE_MODE](./03-guides/INTERACTIVE_MODE.md) | 인터랙티브 모드 |
| [IMPLEMENTATION_GUIDE](./03-guides/IMPLEMENTATION_GUIDE.md) | 구현 가이드 |

### 04. Planning (기획/분석)
| Document | Description |
|----------|-------------|
| [PROJECT_ANALYSIS_REPORT](./04-planning/PROJECT_ANALYSIS_REPORT.md) | 프로젝트 분석 리포트 |
| [IMPROVEMENT_RECOMMENDATIONS](./04-planning/IMPROVEMENT_RECOMMENDATIONS.md) | 개선 권고사항 v1 |
| [IMPROVEMENT_RECOMMENDATIONS_v2](./04-planning/IMPROVEMENT_RECOMMENDATIONS_v2.md) | 개선 권고사항 v2 |
| [FEATURE_IMPROVEMENTS](./04-planning/FEATURE_IMPROVEMENTS.md) | 기능 개선 계획 |
| [CODE_STRUCTURE_IMPROVEMENT_PLAN](./04-planning/CODE_STRUCTURE_IMPROVEMENT_PLAN.md) | 코드 구조 개선 계획 |
| [IMPLEMENTATION_PRIORITY_LIST](./04-planning/IMPLEMENTATION_PRIORITY_LIST.md) | 구현 우선순위 |

### 05. Specifications (기능 스펙)

#### v1 - 리팩토링 계획
| Document | Description |
|----------|-------------|
| [00_PROJECT_SUMMARY](./05-specifications/v1/00_PROJECT_SUMMARY_AND_NEXT_STEPS.md) | 프로젝트 요약 및 다음 단계 |
| [01_MODULE_FEATURE](./05-specifications/v1/01_MODULE_FEATURE_SPECIFICATION.md) | 모듈 기능 스펙 |
| [02_TECHNICAL_DESIGN](./05-specifications/v1/02_TECHNICAL_DESIGN_PATTERNS.md) | 기술 설계 패턴 |
| [03_IMPLEMENTATION](./05-specifications/v1/03_IMPLEMENTATION_DETAILS.md) | 구현 상세 |
| [04_ROADMAP](./05-specifications/v1/04_IMPLEMENTATION_ROADMAP.md) | 구현 로드맵 |

#### v2 - 기능별 스펙
| Document | Description |
|----------|-------------|
| [README](./05-specifications/v2/README.md) | v2 스펙 개요 |
| [F001-ConfidenceChecker](./05-specifications/v2/F001-ConfidenceChecker.md) | 신뢰도 검증 모듈 |
| [F002-SelfCheckProtocol](./05-specifications/v2/F002-SelfCheckProtocol.md) | 자가 점검 프로토콜 |
| [F003-GoalBackwardVerifier](./05-specifications/v2/F003-GoalBackwardVerifier.md) | 목표 역방향 검증 |
| [F004-ReflexionPattern](./05-specifications/v2/F004-ReflexionPattern.md) | 리플렉션 패턴 |
| [F005-InstinctStore](./05-specifications/v2/F005-InstinctStore.md) | 인스팅트 저장소 |
| [F006-SolutionsCache](./05-specifications/v2/F006-SolutionsCache.md) | 솔루션 캐시 |
| [F007-QualityCurve](./05-specifications/v2/F007-QualityCurve.md) | 품질 곡선 추적 |
| [F008-ContextModule](./05-specifications/v2/F008-ContextModule.md) | 컨텍스트 모듈 |
| [F009-AgentConsolidation](./05-specifications/v2/F009-AgentConsolidation.md) | 에이전트 통합 |

#### v3 - 프로그램 확장 스펙
| Document | Description |
|----------|-------------|
| [README](./05-specifications/v3/README.md) | v3 스펙 개요 |
| [F021-MAL](./05-specifications/v3/F021-MAL.md) | 다중 엔진 추상화 레이어 |
| [F022-Ticket-Feature-Cycle](./05-specifications/v3/F022-Ticket-Feature-Cycle.md) | Ticket 실행/검증/리뷰 + Feature 재사용 |
| [F023-Agent-Economy](./05-specifications/v3/F023-Agent-Economy.md) | Agent 마켓/정산/프라이버시 모델 |
| [F024-Program-Roadmap](./05-specifications/v3/F024-Program-Roadmap.md) | 다중 프로젝트 단계 로드맵 |

### 06. Roadmap (로드맵)
| Document | Description |
|----------|-------------|
| [ROADMAP](./06-roadmap/ROADMAP.md) | 전체 개발 로드맵 |
| [STATUS](./06-roadmap/STATUS.md) | 현재 진행 상황 |
| [NEXT_STEPS](./06-roadmap/NEXT_STEPS.md) | 다음 단계 액션 아이템 |
| [NEXT_TASKS](./06-roadmap/NEXT_TASKS.md) | 다음 태스크 목록 |
| [P5_PLATFORM](./06-roadmap/P5_PLATFORM.md) | P5 플랫폼 계획 |
| [REFERENCE](./06-roadmap/REFERENCE.md) | 참조 문서 |

#### Tasks
| Document | Description |
|----------|-------------|
| [TASK1_IMPLEMENTATION_PLAN](./06-roadmap/tasks/TASK1_IMPLEMENTATION_PLAN.md) | Task 1 구현 계획 |
| [TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE](./06-roadmap/tasks/TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE.md) | E-C-F-T 세분화 트리 |
| [E01_TICKET_PACK](./06-roadmap/tasks/e01-ticket-pack/README.md) | E01 실제 발행용 티켓 패키지 |
| [E02_TICKET_PACK](./06-roadmap/tasks/e02-ticket-pack/README.md) | E02 실제 발행용 티켓 패키지 |
| [E03_TICKET_PACK](./06-roadmap/tasks/e03-ticket-pack/README.md) | E03 실제 발행용 티켓 패키지 |
| [E04_TICKET_PACK](./06-roadmap/tasks/e04-ticket-pack/README.md) | E04 실제 발행용 티켓 패키지 |
| [E05_TICKET_PACK](./06-roadmap/tasks/e05-ticket-pack/README.md) | E05 실제 발행용 티켓 패키지 |
| [E06_TICKET_PACK](./06-roadmap/tasks/e06-ticket-pack/README.md) | E06 실제 발행용 티켓 패키지 (v1/v1.1) |
| [E07_TICKET_PACK](./06-roadmap/tasks/e07-ticket-pack/README.md) | E07 실제 발행용 티켓 패키지 |

### 07. Checklists (운영 체크리스트)
| Document | Description |
|----------|-------------|
| [README](./checklists/README.md) | 체크리스트 사용 가이드 |
| [GATE_CHECKLIST](./checklists/GATE_CHECKLIST.md) | 단계별 게이트 승인 체크 |
| [IMPLEMENTATION_TEST_CHECKLIST](./checklists/IMPLEMENTATION_TEST_CHECKLIST.md) | 구현/테스트/보안 검증 체크 |
| [SPRINT_RESULT_ANALYSIS_CHECKLIST](./checklists/SPRINT_RESULT_ANALYSIS_CHECKLIST.md) | 결과정리 및 다음 요구사항 업데이트 체크 |

### 08. Ticket Templates (티켓 템플릿)
| Document | Description |
|----------|-------------|
| [README](../templates/tickets/README.md) | 템플릿 사용 가이드 |
| [TICKET_TEMPLATE](../templates/tickets/TICKET_TEMPLATE.md) | 일반 티켓 템플릿 |
| [FEATURE_TICKET_TEMPLATE](../templates/tickets/FEATURE_TICKET_TEMPLATE.md) | Feature 전용 티켓 템플릿 |
| [REQUIREMENT_UPDATE_TEMPLATE](../templates/tickets/REQUIREMENT_UPDATE_TEMPLATE.md) | 스프린트 인계용 요구사항 템플릿 |
| [ISSUE_TEMPLATE_GITHUB_JIRA_COMMON](../templates/tickets/ISSUE_TEMPLATE_GITHUB_JIRA_COMMON.md) | GitHub/Jira 공용 티켓 템플릿 |
| [ISSUE_FIELD_MAPPING_GITHUB_JIRA](../templates/tickets/ISSUE_FIELD_MAPPING_GITHUB_JIRA.md) | GitHub/Jira 공용 필드 매핑 |

---

## 🚀 Getting Started

| 대상 | 시작 문서 |
|------|----------|
| **새로운 사용자** | [CLI Usage](./03-guides/CLI_USAGE.md) |
| **프로젝트 이해** | [VISION](./01-vision/VISION.md) → [OVERVIEW](./02-architecture/OVERVIEW.md) |
| **배포 담당자** | [Deployment](./03-guides/DEPLOYMENT.md) |
| **개발자** | [CODE_QUALITY](./03-guides/CODE_QUALITY.md) → [SYSTEM_DESIGN](./02-architecture/SYSTEM_DESIGN.md) |
| **기여자** | [PROJECT_ANALYSIS_REPORT](./04-planning/PROJECT_ANALYSIS_REPORT.md) → [Specifications](./05-specifications/v3/README.md) |

---

## 📊 Document Statistics

| Category | Count |
|----------|-------|
| Vision | 3 |
| Architecture | 4 |
| Guides | 7 |
| Planning | 8 |
| Specifications | 21 |
| Roadmap | 8 |
| Checklists | 4 |
| **Total** | **55** |
