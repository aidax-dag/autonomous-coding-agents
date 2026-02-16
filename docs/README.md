# Documentation

> ACA(Autonomous Coding Agents) 프로젝트 문서

## Structure

```
docs/
├── 01-vision/           # 전략 및 비전
├── 02-architecture/     # 시스템 아키텍처
├── 03-guides/           # 사용자/개발자/운영자 가이드
├── 04-planning/         # 기획 및 분석
├── 05-specifications/   # 기능 스펙 문서
│   ├── v1/              # 리팩토링 v1
│   ├── v2/              # 기능별 스펙 (F001~F020)
│   └── v3/              # MAL/Ticket/Feature/Economy 확장 스펙
├── 06-roadmap/          # 로드맵 및 태스크
│   └── tasks/           # 상세 티켓 패키지
├── 07-worklists/        # 토큰 절약형 실행 작업문서
├── api/                 # API 명세
├── checklists/          # 스프린트/게이트 운영 체크리스트
└── memory/              # Instinct 저장소
```

---

## Token-Efficient Workflow

문서가 커서 LLM 토큰이 많이 소모될 때는 원문 전체를 읽기 전에 compact 인덱스를 먼저 사용하세요.

```bash
# 1) 문서 인덱스/요약 생성 (docs/_compact/README.md, docs/_compact/docs-index.json)
npm run docs:compact

# 2) 주제별로 관련 문서만 추출
npm run docs:query -- "architecture context token budget"
```

- `docs/_compact/README.md`: 전체 문서의 1줄 요약 + 크기/예상 토큰
- `docs/_compact/docs-index.json`: 자동 검색/필터링용 메타데이터
- 권장 흐름: `docs:query` 결과 상위 3~5개 문서만 선택해서 필요한 heading만 로드

---

## Quick Links

### 01. Vision (전략/비전)
| Document | Description |
|----------|-------------|
| [UNIFIED_VISION](./01-vision/UNIFIED_VISION.md) | 통합 비전 문서 (마스터) |
| [AI_CODING_AGENTS_COMPARISON](./01-vision/AI_CODING_AGENTS_COMPARISON.md) | AI 코딩 에이전트 비교 분석 |

### 02. Architecture (아키텍처)
| Document | Description |
|----------|-------------|
| [OVERVIEW](./02-architecture/OVERVIEW.md) | 아키텍처 개요 |
| [SYSTEM_DESIGN](./02-architecture/SYSTEM_DESIGN.md) | 시스템 설계 상세 (최신) |
| [MODULE_REFERENCE](./02-architecture/MODULE_REFERENCE.md) | 모듈 구조 참조 (DEPRECATED) |

### 03. Guides (가이드)
| Document | Description |
|----------|-------------|
| [USER_GUIDE](./03-guides/USER_GUIDE.md) | 설치/설정/사용 종합 가이드 |
| [CLI_USAGE](./03-guides/CLI_USAGE.md) | CLI 명령어 사용법 |
| [CODE_QUALITY](./03-guides/CODE_QUALITY.md) | 코드 품질 표준 (개발자 필독) |
| [TESTING](./03-guides/TESTING.md) | 테스트 가이드 |
| [IMPLEMENTATION_GUIDE](./03-guides/IMPLEMENTATION_GUIDE.md) | 구현 가이드 |
| [DEPLOYMENT](./03-guides/DEPLOYMENT.md) | 배포 가이드 |
| [DATABASE_SETUP](./03-guides/DATABASE_SETUP.md) | DB 엔진 설정 및 마이그레이션 |
| [OBSERVABILITY_GUIDE](./03-guides/OBSERVABILITY_GUIDE.md) | 모니터링 및 추적 운영 가이드 |
| [INTERACTIVE_MODE](./03-guides/INTERACTIVE_MODE.md) | 인터랙티브 모드 |
| [WEBHOOK_SETUP](./03-guides/WEBHOOK_SETUP.md) | GitHub 웹훅 설정 |

### 04. Planning (기획/분석)
| Document | Description |
|----------|-------------|
| [COMPETITIVE_ANALYSIS_AND_ENHANCEMENT_STRATEGY](./04-planning/COMPETITIVE_ANALYSIS_AND_ENHANCEMENT_STRATEGY.md) | 경쟁 분석 및 개선 전략 v6 |
| [COMPETITIVE_ANALYSIS_V3](./04-planning/COMPETITIVE_ANALYSIS_V3.md) | 경쟁 포지셔닝 분석 |
| [IMPLEMENTATION_PRIORITY_LIST](./04-planning/IMPLEMENTATION_PRIORITY_LIST.md) | 구현 우선순위 (Phase B~J 이력) |
| [SPEC_DRIVEN_DEVELOPMENT](./04-planning/SPEC_DRIVEN_DEVELOPMENT.md) | 스펙 기반 개발 방법론 |

### 05. Specifications (기능 스펙)

#### v2 - 기능별 스펙
| Document | Description |
|----------|-------------|
| [README](./05-specifications/v2/README.md) | v2 스펙 개요 |
| F001~F009 | Validation, Learning, Context, Agent 통합 |
| F010~F020 | Evals, Skills, DeepWorker, ACP, HUD, Benchmark, DocsGen, Brownfield, Instinct, DynamicPrompts, Checkpoint |

#### v3 - 프로그램 확장 스펙
| Document | Description |
|----------|-------------|
| [F021-MAL](./05-specifications/v3/F021-MAL.md) | 다중 엔진 추상화 레이어 |
| [F022-Ticket-Feature-Cycle](./05-specifications/v3/F022-Ticket-Feature-Cycle.md) | Ticket/Feature 작업 사이클 |
| [F023-Agent-Economy](./05-specifications/v3/F023-Agent-Economy.md) | Agent 마켓/정산 모델 |
| [F025-Feature-Management-Service](./05-specifications/v3/F025-Feature-Management-Service.md) | Feature 관리 서비스 |
| [F026-Ticket-Feature-Runtime-and-MCP-Enforcement](./05-specifications/v3/F026-Ticket-Feature-Runtime-and-MCP-Enforcement.md) | Ticket/Feature 런타임 + MCP 강제 |
| [F027-ACA-Platform-Final-Definition](./05-specifications/v3/F027-ACA-Platform-Final-Definition.md) | v1/v1.1 범위 최종본 |

### 06. Roadmap (로드맵)
| Document | Description |
|----------|-------------|
| [NEXT_TASKS](./06-roadmap/NEXT_TASKS.md) | 다음 태스크 목록 |
| [REFERENCE](./06-roadmap/REFERENCE.md) | 참조 문서 |
| [TASK2 Ticket Tree](./06-roadmap/tasks/TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE.md) | Epic-Capability-Feature-Ticket 구조 |
| E01~E07 Ticket Packs | v1 발행용 티켓 패키지 (57개 티켓) |

### 07. Checklists (운영 체크리스트)
| Document | Description |
|----------|-------------|
| [GATE_CHECKLIST](./checklists/GATE_CHECKLIST.md) | 단계별 게이트 승인 체크 |
| [IMPLEMENTATION_TEST_CHECKLIST](./checklists/IMPLEMENTATION_TEST_CHECKLIST.md) | 구현/테스트/보안 검증 체크 |
| [SPRINT_RESULT_ANALYSIS_CHECKLIST](./checklists/SPRINT_RESULT_ANALYSIS_CHECKLIST.md) | 결과정리 및 다음 요구사항 업데이트 체크 |

### 08. Worklists (토큰 절약형 실행 문서)
| Document | Description |
|----------|-------------|
| [07-worklists/README](./07-worklists/README.md) | 실행 문서 허브 |
| [00_WORKFLOW](./07-worklists/00_WORKFLOW.md) | 최소 토큰 실행 절차 |
| [10_STATUS_BASELINE](./07-worklists/10_STATUS_BASELINE.md) | 코드 기준 구현/갭 기준선 |
| [20_RUNTIME_AND_CONNECTORS](./07-worklists/20_RUNTIME_AND_CONNECTORS.md) | 런타임/외부 연동 작업리스트 |
| [30_ANALYZER_AND_GENERATOR_IMPLEMENTATION](./07-worklists/30_ANALYZER_AND_GENERATOR_IMPLEMENTATION.md) | 분석/문서생성 구현 작업리스트 |
| [40_BENCHMARK_AND_DEEPWORKER](./07-worklists/40_BENCHMARK_AND_DEEPWORKER.md) | 벤치마크/사전탐색 작업리스트 |
| [50_STUB_PRODUCTIONIZATION](./07-worklists/50_STUB_PRODUCTIONIZATION.md) | 스텁 제거/운영품질 작업리스트 |
| [60_DOC_SYNC_AND_TOKEN_POLICY](./07-worklists/60_DOC_SYNC_AND_TOKEN_POLICY.md) | 문서 동기화/토큰 정책 작업리스트 |

---

## Getting Started

| 대상 | 시작 문서 |
|------|----------|
| **새로운 사용자** | [USER_GUIDE](./03-guides/USER_GUIDE.md) → [CLI_USAGE](./03-guides/CLI_USAGE.md) |
| **프로젝트 이해** | [UNIFIED_VISION](./01-vision/UNIFIED_VISION.md) → [OVERVIEW](./02-architecture/OVERVIEW.md) |
| **개발자** | [CODE_QUALITY](./03-guides/CODE_QUALITY.md) → [SYSTEM_DESIGN](./02-architecture/SYSTEM_DESIGN.md) |
| **운영자** | [DEPLOYMENT](./03-guides/DEPLOYMENT.md) → [DATABASE_SETUP](./03-guides/DATABASE_SETUP.md) → [OBSERVABILITY_GUIDE](./03-guides/OBSERVABILITY_GUIDE.md) |
| **다음 개발** | [COMPETITIVE_ANALYSIS_AND_ENHANCEMENT_STRATEGY](./04-planning/COMPETITIVE_ANALYSIS_AND_ENHANCEMENT_STRATEGY.md) → [v3 Specs](./05-specifications/v3/README.md) |
| **작업 실행(토큰 최소화)** | [07-worklists/README](./07-worklists/README.md) → [00_WORKFLOW](./07-worklists/00_WORKFLOW.md) |
