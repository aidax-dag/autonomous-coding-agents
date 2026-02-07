# Autonomous Coding Agents - 통합 비전 문서

> **버전**: 3.0 (통합 완료)
> **작성일**: 2026-01-25
> **상태**: 활성 전략 문서
> **최종 목표**: CEO인 인간 한 명과 AI 에이전트로 구성된 완전 자율 소프트웨어 회사 구축

---

## 목차

### Part 1: 비전 및 아키텍처
1. [핵심 비전](#1-핵심-비전)
2. [프로젝트 정체성](#2-프로젝트-정체성)
3. [목표 아키텍처](#3-목표-아키텍처)
4. [4 Layer 제품 아키텍처](#4-4-layer-제품-아키텍처)
5. [에이전트 조직 및 산출물 계약](#5-에이전트-조직-및-산출물-계약)
6. [온톨로지 설계](#6-온톨로지-설계)
7. [Knowledge Layer 기술 스택](#7-knowledge-layer-기술-스택)
8. [문서 주도 개발](#8-문서-주도-개발-hld--mld--lld)
9. [운영 원칙 6개](#9-운영-원칙-6개)
10. [10개 핵심 결정](#10-10개-핵심-결정)

### Part 2: 실행 계획
11. [타임라인 로드맵](#11-타임라인-로드맵)
12. [Phase 1 상세 실행 플랜](#12-phase-1-상세-실행-플랜)
13. [CLI 인터페이스 설계](#13-cli-인터페이스-설계)
14. [성공 지표](#14-성공-지표)
15. [리스크 및 대응 전략](#15-리스크-및-대응-전략)

### Part 3: 구현 상세 명세
16. [칸반 상태 머신 & 정책](#16-칸반-상태-머신--정책)
17. [권한 모델 (Level + Capability)](#17-권한-모델-level--capability)
18. [Graph SSOT 3계층 모델](#18-graph-ssot-3계층-모델)
19. [에이전트 스케줄러 설계](#19-에이전트-스케줄러-설계)
20. [Safety Fuse 룰 엔진](#20-safety-fuse-룰-엔진)
21. [Agent Manager v0 설계](#21-agent-manager-v0-설계)
22. [정책 파일 명세 (YAML)](#22-정책-파일-명세-yaml)

---

## 1. 핵심 비전

### 1.1 비전 선언

> **"CEO인 인간 한 명과 AI 에이전트로 구성된 완전 자율 소프트웨어 회사 구축"**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Human-in-the-Loop 진화 단계                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Level 0: 수동 개발                                                  │
│  [인간 개발자] ──────────────────────────────────────► [코드]        │
│                                                                      │
│  Level 1: AI 어시스턴트 (현재 대부분의 도구)                         │
│  [인간 개발자] ◄────► [AI 어시스턴트] ──────────────► [코드]         │
│      ▲ 주도권                                                        │
│                                                                      │
│  Level 2: AI 주도, 인간 승인 (MVP 12개월 목표)                       │
│  [인간 감독자] ◄─── [AI 개발팀] ──────────────────► [코드]           │
│      ▲ 승인/거부                ▲ 주도권                             │
│                                                                      │
│  Level 3: 완전 자율 (Enterprise 36개월 목표)                         │
│  [인간 CEO] ──► [AI 경영진] ──► [AI 개발팀] ──────► [제품]           │
│      ▲ 전략만         ▲ 운영 자율                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 핵심 가치 제안

| 현재 상태 | 목표 상태 |
|-----------|----------|
| 개발자 80시간/주 필요 | AI 24/7 자동 개발 |
| 인건비 $200K+/년 | LLM API 비용 $5K-20K/년 |
| 채용 3-6개월 소요 | 즉시 스케일 가능 |
| 휴가, 병가, 퇴사 리스크 | 무중단 운영 |
| 지식 유실 (이직 시) | 영구 지식 축적 |

### 1.3 설계 원칙

| 원칙 | 기존 AI 도구 | 우리의 접근 |
|------|-------------|-------------|
| **팀 시뮬레이션** | 하나의 슈퍼 에이전트 | 역할 분담된 전문 에이전트들 협업 |
| **방법론 우선** | 모델 성능에 의존 | Agile/Kanban 방법론 내장 |
| **지식 축적** | 세션 종료 시 손실 | 온톨로지 + 벡터 DB로 영구 지식 |
| **문서 주도 개발** | 코드 생성에 집중 | HLD → MLD → LLD 체계 |
| **계약 > 지능** | 똑똑한 모델에 의존 | 정의된 계약/게이트/권한이 우선 |

### 1.4 승리 조건 (핵심)

> **"지능"이 아니라 아래 4가지가 먼저다:**

1. **정의된 계약** - 산출물/게이트/권한이 명확히 정의됨
2. **정합성 (그래프)** - 모든 산출물이 연결되어 추적 가능
3. **재사용 경제 (Feature Store)** - 기능 단위로 저장/검색/조합
4. **측정 가능한 운영 루프** - KPI/SLO/비용이 항상 추적됨

---

## 2. 프로젝트 정체성

### 2.1 한 줄 정의

> **"제품 개발 조직(기획~운영)을 소프트웨어 에이전트로 구현하고, 온톨로지/피처 재사용/학습 루프를 통해 시간이 갈수록 개발 속도가 빨라지는 개발 전용 AI 플랫폼"**

### 2.2 핵심 차별점 3가지

1. **조직 시뮬레이션**: PM/PO/디자인/FE/BE/QA/인프라/보안 등 "역할 기반" 에이전트 팀이 칸반으로 협업
2. **온톨로지 기반 연결**: PRD ↔ IA ↔ UX ↔ API ↔ ERD ↔ 테스트 ↔ 배포 ↔ 운영 지표가 한 그래프로 묶임
3. **Feature 재사용 경제**: 기능을 "코드"가 아니라 Feature(설계+테스트+런타임 구성) 단위로 저장/검색/조합

### 2.3 2개의 서브 프로젝트

```
┌─────────────────────────────────────────────────────────────────────┐
│                        프로젝트 구조                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  A. 실행 엔진: autonomous-coding-agents (공장)                       │
│     └── 목표: 명령을 안전/일관되게 실행하는 코딩/리뷰/테스트/배포     │
│                                                                      │
│  B. 경영/운영 뇌: Agent Manager (공장장 + 경영진)                    │
│     └── 목표: 무엇을 만들지/어떻게 운영할지/비용과 리스크 관리        │
│                                                                      │
│  관계: B를 만들려면 A가 먼저 "제품화" 수준으로 안정돼야 함            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 목표 아키텍처

### 3.1 전체 시스템 구조 (최종 목표)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Autonomous Coding Platform                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Executive Layer                           │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │    │
│  │  │CTO Agent │ │COO Agent │ │CFO Agent │ │CMO Agent │        │    │
│  │  │기술 전략 │ │운영 효율 │ │비용 최적화│ │시장 분석 │        │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Product Layer                              │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │    │
│  │  │Product Owner│ │Product Mgr  │ │Tech PM      │            │    │
│  │  │비전/로드맵  │ │요구사항     │ │기술 스펙    │            │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │    │
│  │  ┌─────────────┐ ┌─────────────┐                            │    │
│  │  │BM Designer  │ │UX Designer  │                            │    │
│  │  │수익 모델    │ │사용자 경험  │                            │    │
│  │  └─────────────┘ └─────────────┘                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Development Layer                           │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │    │
│  │  │Frontend│ │Backend │ │ Infra  │ │Security│ │  QA    │    │    │
│  │  │React   │ │Node/Go │ │K8s/AWS │ │Audit   │ │Testing │    │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐                          │    │
│  │  │Mobile  │ │ Data   │ │  ML    │                          │    │
│  │  │iOS/And │ │Pipeline│ │ Model  │                          │    │
│  │  └────────┘ └────────┘ └────────┘                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Knowledge Layer                            │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │    │
│  │  │Ontology DB  │ │ Vector DB   │ │ Feature DB  │            │    │
│  │  │(Neo4j)      │ │(Pinecone)   │ │(PostgreSQL) │            │    │
│  │  │관계 그래프  │ │시맨틱 검색  │ │코드 재사용  │            │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │    │
│  │  ┌─────────────────────────────────────────────────┐        │    │
│  │  │              Document Repository                 │        │    │
│  │  │  HLD (아키텍처) → MLD (설계) → LLD (상세 스펙)  │        │    │
│  │  └─────────────────────────────────────────────────┘        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Execution Layer                            │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │    │
│  │  │ Kanban  │ │  Git/   │ │  CI/CD  │ │ Monitor │            │    │
│  │  │ Board   │ │ GitHub  │ │Pipeline │ │  Ops    │            │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      CLI Interface                           │    │
│  │  모든 Phase에서 CLI를 통한 제어 및 모니터링 지원              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 기술 스택

| 계층 | 기술 | 선정 이유 |
|------|------|----------|
| **Runtime** | Node.js 20+ | 비동기 처리, 생태계 |
| **Language** | TypeScript 5.0+ | 타입 안정성 |
| **Message Broker** | NATS | 경량, 고성능, 내장 JetStream |
| **Primary DB** | PostgreSQL + Prisma | 관계형 데이터, ORM, Feature Store |
| **Graph DB** | Neo4j | 온톨로지 관계 표현, SSOT |
| **Vector DB** | Pinecone/Weaviate | 시맨틱 검색, 유사도 검색 |
| **Cache** | Redis | 세션, 캐시 |
| **Process Mgmt** | PM2 | 프로세스 관리, 클러스터 |
| **LLM** | Claude/GPT/Gemini | 멀티 모델 지원 |
| **CLI** | Commander.js | CLI 인터페이스 |

---

## 4. 4 Layer 제품 아키텍처

복잡도를 관리하기 위해 제품을 4개 레이어로 분리하여 점진적으로 완성합니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     4 Layer Product Architecture                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Layer 4: Feature Store (재사용 가능한 기능 자산)                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Feature = 설계 + 테스트 + 코드 + 운영 구성                   │    │
│  │  - 요구사항(기능/성능)                                        │    │
│  │  - 설계(HLD/LLD)                                              │    │
│  │  - 테스트(TDD 케이스, k6, 보안 시나리오)                       │    │
│  │  - 구현(템플릿/모듈)                                          │    │
│  │  - 운영(대시보드/알람/런북)                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              ▲                                       │
│                              │                                       │
│  Layer 3: Ontology Graph (연결된 지식/증적 그래프)                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  "요구사항 → 설계 → 구현 → 테스트 → 배포 → 운영" 추적         │    │
│  │  - 변경 영향 분석(Impact Analysis) 자동화                      │    │
│  │  - Traceability 완전 보장                                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              ▲                                       │
│                              │                                       │
│  Layer 2: Agent Org (역할 기반 에이전트 팀)                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  PO/PM/TPM/디자인/FE/BE/QA/SRE/Sec/Architect                  │    │
│  │  - 각 역할이 만들어내는 "산출물 계약" 명확히 정의               │    │
│  │  - 예: PM은 PRD, Architect는 HLD, BE는 OpenAPI+ERD+테스트       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              ▲                                       │
│                              │                                       │
│  Layer 1: Workflow OS (칸반/아티팩트/승인흐름)                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  - Epic/Feature/Task/PR/Release를 모두 연결                    │    │
│  │  - WIP 제한, Definition of Ready/Done, 리뷰 게이트              │    │
│  │  - 산출물(PRD/HLD/LLD/Test/Runbook)을 자동 생성/검증           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

Layer 4까지 완성되면 "쓸수록 빨라지는" 효과가 현실이 됩니다.
```

---

## 5. 에이전트 조직 및 산출물 계약

### 5.1 Executive Agents (경영진) - Phase 4+

#### CTO Agent
```yaml
role: Chief Technology Officer
responsibilities:
  - 기술 전략 수립
  - 아키텍처 결정
  - 기술 부채 관리
  - 팀 역량 평가

personality:
  style: 분석적, 장기적 관점
  decision_making: 데이터 기반
  communication: 기술적 명확성

required_deliverables:
  - 기술 로드맵
  - 아키텍처 결정 기록 (ADR)
  - 기술 부채 백로그
  - 기술 스택 권고안
```

#### COO Agent
```yaml
role: Chief Operating Officer
responsibilities:
  - 개발 프로세스 최적화
  - 자원 할당
  - 병목 해소
  - SLA 관리

required_deliverables:
  - 프로세스 개선안
  - 리소스 재배치 계획
  - 운영 대시보드
  - SLA 보고서
```

#### CFO Agent
```yaml
role: Chief Financial Officer
responsibilities:
  - LLM API 비용 최적화
  - 인프라 비용 관리
  - ROI 분석
  - 예산 계획

required_deliverables:
  - 비용 보고서
  - 최적화 권고
  - 예산 예측
  - 비용-성능 분석
```

### 5.2 Product Agents (제품) - Phase 2+

#### Product Owner Agent
```yaml
role: Product Owner
required_deliverables:
  - 제품 로드맵
  - 우선순위화된 백로그
  - 릴리즈 노트
  - 스테이크홀더 커뮤니케이션
```

#### Product Manager Agent
```yaml
role: Product Manager
required_deliverables:
  - PRD (Product Requirements Document)
  - 사용자 스토리
  - 수락 기준 (Acceptance Criteria)
  - 기능 명세서
```

#### Technical Product Manager Agent
```yaml
role: Technical Product Manager
required_deliverables:
  - High-Level Design (HLD)
  - Mid-Level Design (MLD)
  - Low-Level Design (LLD)
  - API 스펙 (OpenAPI)
  - ERD
```

### 5.3 Development Agents (개발) - Phase 1+

| Agent | Role | Required Deliverables | Status |
|-------|------|----------------------|--------|
| **CoderAgent** | 코드 구현 | 소스 코드, 유닛 테스트, 코드 문서 | ✅ 구현됨 |
| **ReviewerAgent** | 코드 리뷰 | 리뷰 코멘트, 승인/거부 판정, 개선 제안 | ✅ 구현됨 |
| **RepoManagerAgent** | 워크플로우 조율 | PR 관리, 머지 결정, 브랜치 정책 | ✅ 구현됨 |
| **ArchitectAgent** | 아키텍처 설계 | HLD, 시스템 다이어그램, ADR | ⏳ 예정 |
| **QAAgent** | 품질 보증 | 테스트 계획, E2E 테스트, 커버리지 리포트 | ⏳ 예정 |
| **SecurityAgent** | 보안 감사 | 보안 스캔 결과, 취약점 리포트, 수정 권고 | ⏳ 예정 |
| **InfraAgent** | 인프라 관리 | IaC 코드, 배포 스크립트, 런북 | ⏳ 예정 |
| **FrontendAgent** | 프론트엔드 | UI 컴포넌트, 스타일, 접근성 검증 | ⏳ 예정 |
| **BackendAgent** | 백엔드 | API 구현, DB 마이그레이션, 성능 테스트 | ⏳ 예정 |

### 5.4 산출물 계약 매트릭스

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Deliverable Contract Matrix                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  역할          │ 필수 산출물              │ 검증 게이트              │
│  ─────────────┼─────────────────────────┼─────────────────────────  │
│  PM           │ PRD, User Stories        │ PO 승인                   │
│  Architect    │ HLD, ADR                 │ CTO 승인                  │
│  TPM          │ MLD, LLD, OpenAPI, ERD   │ Architect 리뷰            │
│  Backend      │ API 코드, 테스트, 마이그레이션│ Reviewer 승인         │
│  Frontend     │ UI 코드, 스토리북, 접근성 │ Reviewer 승인             │
│  QA           │ 테스트 계획, E2E 결과    │ 커버리지 80%+             │
│  Security     │ 보안 스캔, 취약점 리포트  │ 취약점 0개                │
│  Infra        │ IaC, 런북, 배포 스크립트  │ 스테이징 검증             │
│  SRE          │ SLO 정의, 알람 설정       │ 운영 체크리스트           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 온톨로지 설계

### 6.1 최소 온톨로지 엔티티 (MVP)

```yaml
Core Entities:
  Product:
    - id, name, description, status
    - relationships: has_many Domains, has_many Features

  Domain:
    - id, name, bounded_context
    - relationships: belongs_to Product, has_many Features

  Persona/Role:
    - id, name, type (PM/Dev/QA/etc.)
    - relationships: produces Artifacts, owns WorkItems

  Artifact:
    - types: PRD, IA, UX_Spec, HLD, MLD, LLD, OpenAPI, ERD, TestPlan, Runbook
    - relationships: created_by Role, implements Feature, version_controlled

  WorkItem:
    - types: Epic, Feature, Task, Bug, Risk
    - relationships: belongs_to Product, assigned_to Role, produces Artifacts

  CodeAsset:
    - types: Repo, Module, Package, Service, Endpoint
    - relationships: implements Feature, tested_by TestPlan

  RuntimeAsset:
    - types: Env, Secret, Pipeline, Deployment, SLO, Alert
    - relationships: deploys CodeAsset, monitors Service

  Evidence:
    - types: Decision(ADR), Review, TestResult, SecurityCheck, Incident
    - relationships: validates Artifact, proves compliance
```

### 6.2 핵심 관계 (Edges)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Ontology Relationships                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   PRD ─────────────────► Feature                                    │
│        implements                                                    │
│                                                                      │
│   Feature ─────────────► CodeAsset                                  │
│            implemented_by                                            │
│                                                                      │
│   CodeAsset ───────────► TestPlan/TestResult                        │
│              verified_by                                             │
│                                                                      │
│   Deployment ──────────► RuntimeAsset                               │
│               operates                                               │
│                                                                      │
│   Incident ────────────► SLO                                        │
│             violates                                                 │
│                                                                      │
│   ChangeRequest ───────► (PRD/HLD/LLD/API/ERD/Tests)               │
│                 impacts                                              │
│                                                                      │
│   ⚡ 이 관계를 잡는 순간, "자동 영향 분석 + 자동 재작업 지시" 가능   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 온톨로지 구조 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Knowledge Ontology Structure                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐         ┌──────────────┐                         │
│   │   Product    │────────►│   Feature    │                         │
│   │              │ has     │              │                         │
│   └──────────────┘         └──────┬───────┘                         │
│          │                        │                                  │
│          │ defines                │ implements                       │
│          ▼                        ▼                                  │
│   ┌──────────────┐         ┌──────────────┐                         │
│   │ BusinessModel│         │    Code      │                         │
│   └──────┬───────┘         └──────┬───────┘                         │
│          │                        │                                  │
│          │ drives                 │ tested_by                        │
│          ▼                        ▼                                  │
│   ┌──────────────┐         ┌──────────────┐                         │
│   │  UserStory   │◄───────►│    Test      │                         │
│   │              │ verifies│              │                         │
│   └──────────────┘         └──────────────┘                         │
│          │                        │                                  │
│          │ described_in           │ documents                        │
│          ▼                        ▼                                  │
│   ┌──────────────┐         ┌──────────────┐                         │
│   │   Design     │────────►│Documentation │                         │
│   │ (HLD/MLD/LLD)│ outputs │              │                         │
│   └──────────────┘         └──────────────┘                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Knowledge Layer 기술 스택

### 7.1 Graph + Vector 하이브리드 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Knowledge Layer Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Graph DB (Neo4j) - SSOT                   │    │
│  │  "정합성/추적/관계"의 단일 진실                               │    │
│  │  - 엔티티 간 관계 저장                                        │    │
│  │  - Impact Analysis 쿼리                                       │    │
│  │  - Traceability 보장                                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Vector DB (Pinecone/Weaviate)               │    │
│  │  "유사도 검색/재사용 후보 추천"                                │    │
│  │  - Feature 임베딩 저장                                        │    │
│  │  - 유사 Feature 검색                                          │    │
│  │  - 코드 패턴 매칭                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Feature Store (PostgreSQL)                   │    │
│  │  "재사용 가능한 기능 자산"                                     │    │
│  │  - Feature 메타데이터                                         │    │
│  │  - 버전 관리                                                  │    │
│  │  - 재사용 통계                                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Object Store (S3/MinIO)                    │    │
│  │  "산출물 원문(문서/스펙/로그)"                                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  왜 Graph가 먼저인가:                                                │
│  - 벡터만으로는 "이 변경이 어떤 테스트/배포/운영지표를 깨는지"        │
│    보장할 수 없음                                                    │
│  - 자동화된 조직은 정합성이 무너지면 즉시 사고로 이어짐               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Feature Store 스키마 v1 (PostgreSQL)

> **설계 원칙**: Feature는 "코드 조각"이 아니라 **Evidence 묶음(추적 가능한 증거 집합)**

```sql
-- =====================================================
-- CORE: features (중심 테이블)
-- Feature = 재사용 가능한 제품 자산
-- =====================================================
CREATE TABLE features (
    feature_id        TEXT PRIMARY KEY,  -- ULID 형식
    product_id        TEXT NOT NULL,
    domain_id         TEXT,

    -- Identity
    title             TEXT NOT NULL,
    summary           TEXT,
    status            TEXT NOT NULL,     -- draft | ready | in_progress | review | released | deprecated
    owner_role        TEXT,              -- PM | Architect | Backend | etc

    tags              TEXT[],

    -- Requirements (B섹션)
    functional_requirements JSONB,       -- Given/When/Then 형식 지원
    nonfunctional_requirements JSONB,    -- latency_slo, availability_slo, rpo/rto, cost_budget, security_level

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- feature_artifacts: 설계/문서/증적 연결 (C+G섹션)
-- 문서는 "링크"가 아니라 "Artifact ID"로 연결
-- =====================================================
CREATE TABLE feature_artifacts (
    id           BIGSERIAL PRIMARY KEY,
    feature_id   TEXT NOT NULL REFERENCES features(feature_id),
    artifact_type TEXT NOT NULL,         -- PRD | HLD | MLD | LLD | OpenAPI | ERD | TestPlan | Runbook | ADR
    artifact_id  TEXT NOT NULL,          -- 실제 문서/파일/그래프 노드 ID
    phase        TEXT NOT NULL,          -- design | implementation | operation | evidence
    required     BOOLEAN DEFAULT false,  -- v0/v1/v2 단계별 필수 여부
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_artifacts_feature ON feature_artifacts(feature_id);
CREATE INDEX idx_feature_artifacts_type ON feature_artifacts(artifact_type);

-- =====================================================
-- feature_implementations: 코드/서비스 연결 (D섹션)
-- =====================================================
CREATE TABLE feature_implementations (
    id           BIGSERIAL PRIMARY KEY,
    feature_id   TEXT NOT NULL REFERENCES features(feature_id),
    repo         TEXT,
    service      TEXT,
    code_path    TEXT,
    feature_flag TEXT,                   -- 런타임 토글
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_impl_feature ON feature_implementations(feature_id);

-- =====================================================
-- feature_tests: 테스트 연결 (E섹션)
-- =====================================================
CREATE TABLE feature_tests (
    id           BIGSERIAL PRIMARY KEY,
    feature_id   TEXT NOT NULL REFERENCES features(feature_id),
    test_type    TEXT,                   -- unit | integration | e2e | performance | security
    artifact_id  TEXT,
    mandatory    BOOLEAN DEFAULT false,  -- 필수 테스트 여부
    coverage     DECIMAL(5,2),
    last_run_at  TIMESTAMPTZ,
    last_result  TEXT,                   -- passed | failed | skipped
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_tests_feature ON feature_tests(feature_id);

-- =====================================================
-- feature_operations: 운영 연결 (F섹션)
-- 운영이 재사용의 핵심 - 대시보드/알람/런북/롤백
-- =====================================================
CREATE TABLE feature_operations (
    id              BIGSERIAL PRIMARY KEY,
    feature_id      TEXT NOT NULL REFERENCES features(feature_id),
    dashboard_id    TEXT,
    alert_id        TEXT,
    runbook_id      TEXT,
    rollback_plan   TEXT,
    oncall_notes    TEXT,
    known_failure_modes JSONB,           -- FMEA-lite
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_ops_feature ON feature_operations(feature_id);

-- =====================================================
-- patterns: 재사용 가능한 코드 패턴 (UseCase/Module 계층)
-- =====================================================
CREATE TABLE patterns (
    id             TEXT PRIMARY KEY,     -- ULID
    name           TEXT NOT NULL,
    tier           TEXT NOT NULL,        -- feature_pack | usecase_slice | module_component
    type           TEXT NOT NULL,        -- api, auth, crud, validation, etc.
    language       TEXT,
    framework      TEXT,
    code_template  TEXT,
    context        JSONB,
    success_rate   DECIMAL(5,2),
    usage_count    INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_patterns_tier ON patterns(tier);
CREATE INDEX idx_patterns_type ON patterns(type);

-- =====================================================
-- learnings: 학습 기록
-- =====================================================
CREATE TABLE learnings (
    id                   TEXT PRIMARY KEY,
    error_type           TEXT,
    error_message        TEXT,
    root_cause           TEXT,
    fix_applied          TEXT,
    prevention_checklist JSONB,
    frequency            INTEGER DEFAULT 1,
    last_occurred        TIMESTAMPTZ,
    related_features     TEXT[],
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- artifacts: 산출물 저장소
-- =====================================================
CREATE TABLE artifacts (
    artifact_id    TEXT PRIMARY KEY,
    feature_id     TEXT REFERENCES features(feature_id),
    type           TEXT NOT NULL,        -- prd, hld, mld, lld, openapi, erd, test_plan, runbook, adr
    content        TEXT,
    file_path      TEXT,
    version        TEXT,
    status         TEXT,                 -- draft, review, approved, obsolete
    created_by     TEXT,                 -- agent role
    approved_by    TEXT,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_artifacts_feature ON artifacts(feature_id);
CREATE INDEX idx_artifacts_type ON artifacts(type);

-- =====================================================
-- work_items: 작업 항목 (스케줄러 연동)
-- =====================================================
CREATE TABLE work_items (
    id                    TEXT PRIMARY KEY,
    feature_id            TEXT REFERENCES features(feature_id),
    type                  TEXT NOT NULL,   -- epic, feature, task, bug, risk, review, deploy
    work_type             TEXT,            -- code_implementation, security_review, staging_deploy 등
    title                 TEXT NOT NULL,
    description           TEXT,
    status                TEXT NOT NULL,   -- backlog, ready, in_progress, review, blocked, done
    priority              INTEGER,         -- 1-5 (높을수록 우선)

    -- 스케줄러 연동 필드
    required_role         TEXT,
    required_capabilities TEXT[],
    depends_on            TEXT[],          -- 선행 작업 ID 목록
    conflict_key          TEXT,            -- 동시 실행 방지 키

    -- Lease (중복 처리 방지)
    lease_owner           TEXT,
    lease_until           TIMESTAMPTZ,
    attempts              INTEGER DEFAULT 0,
    last_error            TEXT,

    -- 메타데이터
    assigned_to           TEXT,
    parent_id             TEXT REFERENCES work_items(id),
    sla_due_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_work_items_feature ON work_items(feature_id);
CREATE INDEX idx_work_items_status ON work_items(status);
CREATE INDEX idx_work_items_lease ON work_items(lease_owner, lease_until);

-- =====================================================
-- agents: 에이전트 레지스트리
-- =====================================================
CREATE TABLE agents (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    roles             TEXT[],
    capabilities      TEXT[],
    trust_level       INTEGER DEFAULT 2,  -- 0-5
    current_wip       INTEGER DEFAULT 0,
    health            TEXT DEFAULT 'healthy',  -- healthy, degraded, unhealthy
    cost_profile      JSONB,             -- 모델/인프라 비용 프로필
    last_heartbeat    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- assignments: 작업 할당 기록
-- =====================================================
CREATE TABLE assignments (
    id               TEXT PRIMARY KEY,
    work_item_id     TEXT NOT NULL REFERENCES work_items(id),
    agent_id         TEXT NOT NULL REFERENCES agents(id),
    decision_reason  TEXT,               -- 왜 이 에이전트인지
    score_breakdown  JSONB,              -- 점수 상세
    created_at       TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- audit_logs: 모든 결정 기록 (증적)
-- =====================================================
CREATE TABLE audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    actor        TEXT NOT NULL,          -- agent_id 또는 human_id
    action       TEXT NOT NULL,
    entity_type  TEXT,                   -- feature, work_item, deployment 등
    entity_id    TEXT,
    payload      JSONB,
    reason_codes TEXT[],
    explanation  TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor);
```

### 7.3 Feature 필수 필드 단계적 강제 규칙

```yaml
# v0 → v1 → v2 단계적 필수 강제
feature_validation:
  v0_mvp:
    description: "최소 기능 - 기본 정보 + 테스트 1개 이상"
    required:
      - title
      - functional_requirements
      - at_least_one_test
      - at_least_one_implementation
    enforcement: "create_time"

  v1_standard:
    description: "표준 - 설계 문서 + 성능/보안 테스트"
    required:
      - all_v0_fields
      - hld_artifact
      - acceptance_criteria_min_3
      - performance_or_security_test
    enforcement: "before_release"

  v2_production:
    description: "프로덕션 - 운영 준비 완료"
    required:
      - all_v1_fields
      - dashboard_configured
      - alert_configured
      - runbook_exists
      - rollback_plan_exists
    enforcement: "before_prod_deploy"
```

---

## 8. 문서 주도 개발 (HLD → MLD → LLD)

### 8.1 High-Level Design (HLD)
```markdown
# HLD: [Feature Name]

## 1. Overview
시스템 개요 및 목적

## 2. Architecture
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────►│    API      │────►│  Database   │
└─────────────┘     └─────────────┘     └─────────────┘

## 3. Key Decisions (ADR)
- 결정 1: [선택한 기술/패턴] - 이유: [근거]
- 결정 2: [선택한 기술/패턴] - 이유: [근거]

## 4. Non-Functional Requirements
- 성능: [목표 응답 시간, TPS]
- 가용성: [목표 SLA]
- 보안: [인증/인가 방식]
- 확장성: [스케일링 전략]

## 5. Constraints
- [제약 조건 1]
- [제약 조건 2]
```

### 8.2 Mid-Level Design (MLD)
```markdown
# MLD: [Feature Name]

## 1. Components
| 컴포넌트 | 책임 | 인터페이스 |
|---------|------|-----------|
| [이름] | [역할] | [API/이벤트] |

## 2. API Endpoints
| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| POST | /api/v1/users | UserCreateDTO | UserResponseDTO |

## 3. Data Flow
[시퀀스 다이어그램 또는 플로우차트]

## 4. Error Handling
| Error Code | Description | HTTP Status | Recovery |
|------------|-------------|-------------|----------|
| USR001 | User not found | 404 | Retry with valid ID |

## 5. Security Considerations
- 인증: [방식]
- 인가: [규칙]
- 데이터 보호: [암호화 방식]
```

### 8.3 Low-Level Design (LLD)
```markdown
# LLD: [Feature Name]

## 1. Implementation Details

### 1.1 [Component Name]
```typescript
interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

async function createUser(req: CreateUserRequest): Promise<User> {
  // Step 1: Validate input
  // Step 2: Hash password
  // Step 3: Create user record
  // Step 4: Send welcome email
  // Step 5: Return user
}
```

## 2. Database Schema
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 3. Test Cases
| ID | Scenario | Input | Expected | Priority |
|----|----------|-------|----------|----------|
| TC001 | Valid creation | valid data | 201 + user | P0 |
| TC002 | Duplicate email | existing email | 409 | P0 |
| TC003 | Invalid email format | bad email | 400 | P1 |
```

---

## 9. 운영 원칙 6개

CTO/COO/CFO/CMO 에이전트의 기반 룰입니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     6 Operating Principles                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. 안전 게이트 (Safety Gate)                                        │
│     └── 배포/보안/비용 폭증은 "자동 중단" 가능해야 함                 │
│                                                                      │
│  2. 증적 우선 (Evidence First)                                       │
│     └── 모든 결정은 ADR로 남고, 근거 링크(그래프)로 연결              │
│                                                                      │
│  3. 측정 가능성 (Measurability)                                      │
│     └── 리드타임/재작업률/결함률/비용/매출 지표를 항상 추적           │
│                                                                      │
│  4. 점진적 권한 상승 (Progressive Permission)                         │
│     └── 에이전트가 처음부터 prod 권한을 가지면 망함                   │
│     └── sandbox → staging → canary → production                      │
│                                                                      │
│  5. 실패 격리 (Failure Isolation)                                    │
│     └── 샌드박스/스테이징/카나리/롤백이 내장되어야 함                 │
│                                                                      │
│  6. 비용-성능 최적화 루프 (Cost-Performance Loop)                    │
│     └── 모델 호출/인프라 사용량/캐시 적중률을 최적화                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. 10개 핵심 결정

> **이 10개 결정이 완료되어 개발 착수 준비가 완료되었습니다.**

| # | 결정 항목 | 결정 내용 | 상태 |
|---|----------|----------|------|
| 1 | **Feature 표준 스키마** | Full 스키마 + 단계적 필수 강제 (v0→v1→v2) | ✅ 확정 |
| 2 | **산출물 계약** | 역할별 책임 산출물 정의 | ✅ 5.4절에 정의됨 |
| 3 | **칸반 규칙** | Dev WIP=1, Reviewer WIP=3, 게이트 3개 고정 | ✅ 확정 |
| 4 | **그래프 SSOT 범위** | 그래프=진실, 문서=증거, 벡터=추천 (3계층) | ✅ 확정 |
| 5 | **권한 모델** | Level(0-5) + Capability 단위 권한 | ✅ 확정 |
| 6 | **런타임 안전장치** | Change/Cost/Security 3중 퓨즈 + 자동 롤백 | ✅ 확정 |
| 7 | **재사용 단위** | Feature/UseCase/Module 3계층 저장 | ✅ 확정 |
| 8 | **평가 지표 가중치** | WSJF 변형 (BV+TC+RR)/JobSize - Penalties | ✅ 확정 |
| 9 | **고객 세그먼트** | 내부(dogfooding) → 스타트업 → 규제산업 | ✅ 확정 |
| 10 | **제품 패키징** | CLI 우선 → 플랫폼 → SaaS 순차 확장 | ✅ 확정 |

### 10.1 결정 상세 내용

```yaml
# 1. Feature 표준 스키마: Full + 단계적 강제
feature_schema:
  decision: "full"
  rationale: |
    재사용은 코드만으로 안 됨. 운영/지표/리스크/런북까지 포함해야 "자산화"
    코드만 저장 = "복붙", 설계+테스트+운영까지 저장 = "자산화"
  mandatory_fields_by_version:
    v0: [title, functional_requirements, at_least_one_test, code_connection]
    v1: [hld, acceptance_criteria, performance_or_security_test]
    v2: [dashboard, alert, runbook, rollback_plan]

# 3. 칸반 규칙: WIP 엄격 + 게이트 최소화
kanban_rules:
  decision: "strict_wip_minimal_gates"
  rationale: |
    에이전트 조직의 가장 큰 실패 원인 = "병렬 폭주"
    게이트 과다 = 리드타임 증가, 게이트 부족 = 품질 하락
  wip_limits:
    developer_agent: 1
    reviewer_agent: 3
    global_feature_limit: 15
  gates: ["Spec Gate", "Code Gate", "Release Gate"]  # 3개만

# 4. 그래프 SSOT 범위: 3계층 분리
ssot_layers:
  decision: "three_layer_separation"
  layers:
    graph_db: "SSOT - 정합성/추적/관계의 단일 진실"
    documents: "Evidence - 근거 원문 (PRD, HLD, LLD 등)"
    vector_db: "Discovery - 추천/검색/유사도"
  rationale: |
    벡터만으로는 "이 변경이 어떤 테스트/배포/운영지표를 깨는지" 보장 불가
    자동화 조직은 정합성이 무너지면 즉시 사고로 이어짐

# 5. 권한 모델: Level + Capability
permission_model:
  decision: "level_plus_capability"
  levels:
    L0_Observe: "읽기/분석/리포트"
    L1_Propose: "계획/설계/PR 제안 (코드 변경 없음)"
    L2_Build: "브랜치/커밋/PR 생성 (머지 불가)"
    L3_Validate: "스테이징 배포/테스트 실행 (롤백 가능)"
    L4_Release: "프로덕션 배포 '요청' (승인 필수)"
    L5_Operate: "운영 파라미터 조정/비용 최적화 (상한 내)"
  rationale: |
    레벨만 두면 "레벨3 에이전트가 무엇이든 다 함"
    Capability 단위로 권한을 쪼개야 안전

# 6. 런타임 안전장치: 3중 퓨즈
runtime_safety:
  decision: "triple_fuse_auto_recovery"
  fuses:
    change_fuse: "변경량 큰 PR/릴리스는 추가 검증 요구"
    cost_fuse: "모델 호출/인프라 비용/배포 횟수 상한"
    security_fuse: "secret 노출, auth 변경, 권한 확대 시 즉시 중단"
  recovery: "카나리 + 자동 롤백 표준화"
  rationale: |
    완전 자동화에서 사고는 0이 아님
    핵심은 사고가 나도 파국이 되지 않게 하는 격리/복구

# 7. 재사용 단위: 3계층
reuse_unit:
  decision: "three_tier_reuse"
  tiers:
    feature_pack: "최상위 - 설계+테스트+운영 포함 (로그인, 결제, 알림)"
    usecase_slice: "중간 - DDD 유스케이스 단위 (CreateOrder, SettlePayment)"
    module_component: "하위 - 라이브러리/헬퍼/공통 컴포넌트"
  rationale: |
    어떤 팀은 "전체 로그인 Feature"를,
    다른 팀은 "토큰 발급 유스케이스"만 재사용
    단일 단위로는 실패, 계층이 있어야 유효

# 8. 평가 지표 가중치
evaluation_weights:
  decision: "wsjf_variant"
  formula: "(BusinessValue + TimeCriticality + RiskReduction) / JobSize - CostPenalty - SecurityPenalty"
  weights:
    business_value: 1.0
    time_criticality: 0.9
    risk_reduction: 1.1
    job_size: 1.0
    cost_penalty: 1.0
    security_penalty: 1.2

# 9. 고객 세그먼트
customer_segment:
  decision: "internal_first"
  progression:
    phase_1: "내부 (dogfooding)"
    phase_2: "5-30명 스타트업"
    phase_3: "규제 산업 (금융/핀테크)"

# 10. 제품 패키징
product_packaging:
  decision: "cli_first"
  progression:
    phase_1: "CLI (개발자 도구)"
    phase_2: "플랫폼 (API + Dashboard)"
    phase_3: "SaaS (호스티드 서비스)"
```

---

## 11. 타임라인 로드맵

### 11.1 2단계 목표 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Timeline Overview                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  MVP (12개월): "개발 공장"을 제품화                                  │
│  ════════════════════════════════════════════════════════           │
│  │                                                                   │
│  ├── Phase 1 (0-2개월): 기반 시스템 + CLI + Feature Store v0        │
│  ├── Phase 2 (2-4개월): 에이전트 확장 + 산출물 계약 + HLD/MLD/LLD   │
│  ├── Phase 3 (4-8개월): Knowledge Layer (Neo4j + Pinecone)          │
│  └── Phase 4 (8-12개월): Orchestrator + 자율 워크플로우              │
│                                                                      │
│  Enterprise (12-36개월): "완전 자율 회사"                            │
│  ════════════════════════════════════════════════════════           │
│  │                                                                   │
│  ├── Phase 5 (12-18개월): Executive Agents (CTO/COO/CFO)            │
│  ├── Phase 6 (18-24개월): 다중 프로젝트 + 자율 리소스 관리           │
│  └── Phase 7 (24-36개월): Human-out-of-the-loop 달성                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.2 Phase별 상세

#### Phase 1: 기반 시스템 완성 (0-2개월)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 1: Foundation + CLI + Feature Store v0                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  목표: 3 에이전트 안정화 + CLI + Feature Store 스키마                │
│                                                                      │
│  에이전트:                                                           │
│  ✅ Coding Agent                                                     │
│  ✅ Reviewer Agent                                                   │
│  ✅ Repository Manager Agent                                         │
│                                                                      │
│  기능:                                                               │
│  🔄 PR 자동화 파이프라인                                             │
│  ⏳ 페르소나 시스템 도입                                             │
│  ⏳ Feature Store v0 스키마 (PostgreSQL)                             │
│  ⏳ 온톨로지 최소 관계 정의                                          │
│                                                                      │
│  CLI 기능:                                                           │
│  ⏳ 에이전트 실행/중지 (aca start/stop)                              │
│  ⏳ 상태 모니터링 (aca status)                                       │
│  ⏳ 로그 조회 (aca logs)                                             │
│                                                                      │
│  성공 지표:                                                          │
│  - 리드타임(요구→PR merge) 30-50% 단축                              │
│  - 회귀 버그 감소                                                    │
│  - 재작업률 감소                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Phase 2: 에이전트 확장 (2-4개월)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 2: Agent Expansion + Deliverable Contracts                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  목표: 제품/개발 에이전트 추가 + 산출물 계약 확립                     │
│                                                                      │
│  에이전트:                                                           │
│  ⏳ Architect Agent (HLD 생성)                                       │
│  ⏳ Technical PM Agent (MLD/LLD 생성)                                │
│  ⏳ QA Engineer Agent                                                │
│  ⏳ Security Engineer Agent                                          │
│                                                                      │
│  산출물 계약:                                                        │
│  ⏳ 역할별 필수 산출물 정의                                          │
│  ⏳ DoR/DoD 게이트 구현                                              │
│  ⏳ 승인 워크플로우                                                  │
│                                                                      │
│  CLI 기능:                                                           │
│  ⏳ 대화형 모드 (aca chat)                                           │
│  ⏳ 워크플로우 정의 (aca workflow)                                   │
│  ⏳ 문서 생성 (aca docs generate hld/mld/lld)                        │
│                                                                      │
│  성공 지표:                                                          │
│  - HLD 자동 생성 성공률 70%+                                         │
│  - 보안 리뷰 자동화                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Phase 3: 지식 레이어 구축 (4-8개월)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 3: Knowledge Layer (Neo4j + Pinecone)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  목표: 학습하는 시스템 구축                                           │
│                                                                      │
│  Knowledge Layer:                                                    │
│  ⏳ Neo4j 온톨로지 DB 통합 (SSOT)                                    │
│  ⏳ Pinecone/Weaviate Vector DB 통합                                │
│  ⏳ Feature Store 정식화                                             │
│  ⏳ Feature 재사용 시스템                                            │
│  ⏳ Impact Analysis 자동화                                           │
│  ⏳ 학습 피드백 루프                                                  │
│                                                                      │
│  CLI 기능:                                                           │
│  ⏳ Feature 검색 (aca knowledge search)                              │
│  ⏳ 영향 분석 (aca impact analyze)                                   │
│  ⏳ 학습 기록 조회 (aca learning history)                            │
│                                                                      │
│  성공 지표:                                                          │
│  - 유사 기능 구현 시간 50%+ 단축                                     │
│  - Feature 재사용률 30%+                                             │
│  - MTTR(운영 사고 분석 시간) 단축                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Phase 4: Orchestrator + 자율 워크플로우 (8-12개월)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 4: Orchestrator + Autonomous Workflow                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  목표: 에이전트 자동 선택 및 워크플로우 자율 실행                     │
│                                                                      │
│  Orchestrator:                                                       │
│  ⏳ 에이전트 자동 선택                                               │
│  ⏳ 작업 우선순위 자동 결정                                          │
│  ⏳ 리소스 자동 할당                                                 │
│  ⏳ 실패 자동 복구                                                   │
│                                                                      │
│  칸반 자동화:                                                        │
│  ⏳ Backlog → Ready 자동 이동                                        │
│  ⏳ Ready → In Progress 에이전트 가용 시                             │
│  ⏳ Review → Done 자동 승인 (조건 충족 시)                           │
│                                                                      │
│  성공 지표:                                                          │
│  - 자율 워크플로우 완료율 60%+                                       │
│  - 인간 개입 빈도: 매일 → 매주                                       │
│                                                                      │
│  ⭐ MVP 완료 ⭐                                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Phase 5-7: Enterprise (12-36개월)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 5-7: Enterprise - Full Autonomy                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Phase 5 (12-18개월): Executive Agents                               │
│  ────────────────────────────────────────────                        │
│  ⏳ CTO Agent (기술 전략 자동 수립)                                  │
│  ⏳ COO Agent (운영 효율 자동 최적화)                                │
│  ⏳ CFO Agent (비용 자동 관리)                                       │
│  ⏳ Agent Manager (전체 조율)                                        │
│                                                                      │
│  Phase 6 (18-24개월): 다중 프로젝트                                  │
│  ────────────────────────────────────────────                        │
│  ⏳ 다중 프로젝트 동시 관리                                           │
│  ⏳ 자율적 리소스 확장/축소                                           │
│  ⏳ A/B 실험 자동화                                                   │
│  ⏳ 비용 최적화 루프                                                  │
│                                                                      │
│  Phase 7 (24-36개월): Human-out-of-the-loop                          │
│  ────────────────────────────────────────────                        │
│  ⏳ 24/7 무중단 운영                                                  │
│  ⏳ 자기 개선 시스템                                                  │
│  ⏳ 비즈니스 의사결정 자동화                                          │
│  ⏳ CEO 전략만으로 프로덕트 개발                                       │
│                                                                      │
│  최종 성공 지표:                                                      │
│  - 인간 개입 빈도: 매주 이하                                          │
│  - 24/7 가동률: 99.9%                                                 │
│  - 개발 속도: 인간 대비 5x                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 12. Phase 1 상세 실행 플랜

### Week 1: Feature Store v0 + 기본 스키마

```yaml
목표: Feature Store의 기본 스키마와 테이블 생성

tasks:
  - name: "Feature Store 스키마 설계"
    description: |
      PostgreSQL에 features, patterns, learnings, artifacts, work_items 테이블 생성
    deliverable: "prisma/schema.prisma 또는 SQL DDL"

  - name: "Feature 최소 필드 정의"
    fields:
      - 목적 / 사용자 스토리
      - 기능 요구사항 / 성능 요구사항
      - HLD 링크 / LLD 링크
      - OpenAPI/ERD 링크
      - 테스트 케이스 목록
      - 배포/운영 체크리스트

  - name: "기본 CRUD API 구현"
    deliverable: "src/features/feature-store/ 모듈"

success_criteria:
  - [ ] Feature 생성/조회/수정/삭제 API 동작
  - [ ] 기본 테스트 통과
```

### Week 2: 역할 기반 산출물 계약 정의

```yaml
목표: 각 에이전트 역할별 필수 산출물과 검증 게이트 정의

tasks:
  - name: "산출물 계약 문서화"
    description: |
      PM/Architect/Dev/QA/SRE/Sec 각각 반드시 제출해야 하는 산출물 정의
    deliverable: "docs/contracts/deliverable-contracts.md"

  - name: "AgentPersona 인터페이스 구현"
    code: |
      interface AgentPersona {
        name: string;
        role: string;
        style: 'analytical' | 'creative' | 'practical' | 'cautious';
        expertise: string[];
        requiredDeliverables: string[];
        systemPrompt: string;
      }
    deliverable: "src/agents/base/types.ts 확장"

  - name: "기존 에이전트에 페르소나 적용"
    agents:
      - CoderAgent
      - ReviewerAgent
      - RepoManagerAgent

success_criteria:
  - [ ] 모든 역할의 산출물 계약 문서화 완료
  - [ ] AgentPersona 인터페이스 구현
  - [ ] 3개 에이전트에 페르소나 적용
```

### Week 3-4: 온톨로지 최소 관계 + CLI 기본

```yaml
목표: 온톨로지 그래프의 최소 관계 정의 및 CLI 기본 명령어 구현

tasks:
  - name: "온톨로지 최소 관계 정의"
    relationships:
      - PRD ↔ Feature
      - Feature ↔ CodeAsset
      - CodeAsset ↔ TestResult
      - Deployment ↔ SLO
    deliverable: "docs/ontology/minimal-relations.md"

  - name: "CLI 기본 명령어 구현"
    commands:
      - "aca start": 모든 에이전트 시작
      - "aca stop": 모든 에이전트 중지
      - "aca status": 에이전트 상태 조회
      - "aca logs [agent]": 로그 조회
    deliverable: "src/cli/ 모듈"

  - name: "Impact Analysis 기초 구현"
    description: "변경 시 영향받는 엔티티 추적 기능"
    deliverable: "src/knowledge/impact-analysis.ts"

success_criteria:
  - [ ] 최소 4개 관계 정의 및 문서화
  - [ ] CLI 4개 명령어 동작
  - [ ] 기본 Impact Analysis 쿼리 동작
```

### Phase 1 완료 체크리스트

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Phase 1 Completion Checklist                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Feature Store:                                                      │
│  [ ] PostgreSQL 스키마 생성 완료                                     │
│  [ ] CRUD API 동작                                                   │
│  [ ] 테스트 커버리지 70%+                                            │
│                                                                      │
│  에이전트:                                                           │
│  [ ] AgentPersona 인터페이스 구현                                    │
│  [ ] 3개 에이전트에 페르소나 적용                                    │
│  [ ] 산출물 계약 문서화                                              │
│                                                                      │
│  온톨로지:                                                           │
│  [ ] 최소 4개 관계 정의                                              │
│  [ ] Impact Analysis 기초 동작                                       │
│                                                                      │
│  CLI:                                                                │
│  [ ] aca start/stop/status/logs 동작                                 │
│                                                                      │
│  품질:                                                               │
│  [ ] lint 에러 0개                                                   │
│  [ ] 테스트 100% 통과                                                │
│  [ ] 문서 업데이트 완료                                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. CLI 인터페이스 설계

### 13.1 Phase별 CLI 명령어

```bash
# Phase 1: 기본 제어
aca start                    # 모든 에이전트 시작
aca stop                     # 모든 에이전트 중지
aca status                   # 에이전트 상태 조회
aca logs [agent]             # 로그 조회
aca agent [name] start|stop  # 개별 에이전트 제어

# Phase 2: 워크플로우
aca chat                     # 대화형 모드
aca workflow run [file.yaml] # 워크플로우 실행
aca workflow list            # 워크플로우 목록
aca docs generate [type]     # HLD/MLD/LLD 생성

# Phase 3: 지식 관리
aca knowledge search [query] # Feature 검색
aca knowledge stats          # 지식 베이스 통계
aca impact analyze [change]  # 변경 영향 분석
aca learning history         # 학습 기록 조회

# Phase 4: Orchestrator
aca orchestrate [goal]       # 목표 기반 자율 실행
aca kanban status            # 칸반 보드 상태
aca kanban move [item] [col] # 작업 이동

# Phase 5+: 경영진 제어
aca report [cto|coo|cfo]    # 경영진 보고서
aca cost dashboard           # 비용 대시보드
aca resources allocate       # 리소스 할당
aca autonomous enable|disable # 자율 모드 전환
aca ceo strategy [file]       # CEO 전략 입력
aca emergency stop            # 긴급 중지
```

### 13.2 CLI 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLI Architecture                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                        CLI Layer                              │  │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │  │
│   │  │ Command │ │  Chat   │ │Dashboard│ │ Config  │            │  │
│   │  │ Parser  │ │Interface│ │ Display │ │ Manager │            │  │
│   │  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                     API Gateway                               │  │
│   │  REST/gRPC interface to Agent Manager                         │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                     Agent System                              │  │
│   │  [Executive] → [Product] → [Development] → [Knowledge]       │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 14. 성공 지표

### 14.1 MVP 성공 지표 (12개월)

| 카테고리 | 지표 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---------|------|---------|---------|---------|---------|
| **속도** | 리드타임 단축 | 30% | 40% | 50% | 60% |
| **품질** | 회귀 버그 | -20% | -30% | -40% | -50% |
| **재사용** | Feature 재사용률 | 5% | 15% | 30% | 40% |
| **자동화** | PR 자동화율 | 50% | 65% | 80% | 90% |
| **개입** | 인간 개입 빈도 | 매시간 | 4시간 | 매일 | 매주 |

### 14.2 Enterprise 성공 지표 (36개월)

| 지표 | Phase 5 | Phase 6 | Phase 7 |
|------|---------|---------|---------|
| 개발 속도 (vs 인간) | 3x | 4x | 5x |
| 비용 절감 | 60% | 70% | 80% |
| 24/7 가동률 | 95% | 99% | 99.9% |
| 인간 개입 빈도 | 주 1회 | 월 2회 | 월 1회 |
| 자율 의사결정률 | 50% | 70% | 90% |

### 14.3 비즈니스 지표

```yaml
phase_1_success:
  lead_time_reduction: "30-50%"
  regression_bugs: "감소"
  rework_rate: "감소"

phase_3_success:
  similar_feature_implementation: "50%+ 시간 단축"
  mttr: "단축"
  feature_reuse_rate: "30%+"

phase_4_success:
  sprint_planning_automation: "자동화"
  output_per_cost_ratio: "증가"
  incident_prevention_rate: "증가"
```

---

## 15. 리스크 및 대응 전략

### 15.1 기술 리스크

| 리스크 | 영향 | 확률 | 대응 전략 |
|--------|------|------|----------|
| LLM 환각 | 높음 | 중간 | 다중 검증, 테스트 게이트, 산출물 계약 |
| API 비용 폭증 | 중간 | 높음 | CFO Agent 비용 모니터링, 캐싱, 로컬 모델 검토 |
| Knowledge Layer 복잡도 | 중간 | 중간 | 단계적 도입 (PostgreSQL → Neo4j → Pinecone) |
| 에이전트 충돌 | 중간 | 중간 | 명확한 역할 경계, 산출물 계약, COO Agent 조율 |
| 온톨로지 정합성 | 높음 | 중간 | Graph DB를 SSOT로, 검증 게이트 |

### 15.2 운영 리스크

| 리스크 | 영향 | 확률 | 대응 전략 |
|--------|------|------|----------|
| 무한 루프 | 높음 | 낮음 | 타임아웃, CLI 긴급 중지, 비용 상한 |
| 지식 오염 | 높음 | 낮음 | 검증 게이트, 버전 관리, 롤백 |
| 권한 남용 | 높음 | 낮음 | 점진적 권한 상승, 샌드박스, 승인 워크플로우 |
| 배포 실패 | 높음 | 중간 | 카나리 배포, 자동 롤백, 스테이징 검증 |

### 15.3 프로젝트 리스크

| 리스크 | 영향 | 확률 | 대응 전략 |
|--------|------|------|----------|
| 범위 확대 | 높음 | 높음 | Phase별 명확한 경계, 10개 결정 먼저 |
| 통합 문제 | 중간 | 중간 | 조기 통합 테스트, 온톨로지 관계 검증 |
| 기술 부채 | 중간 | 중간 | 리팩토링 시간 확보, 코드 리뷰 |
| 타임라인 지연 | 중간 | 중간 | 2주 단위 MVP 출하, 칸반 기반 진행 |

---

# Part 3: 구현 상세 명세

---

## 16. 칸반 상태 머신 & 정책

> **핵심**: 에이전트 조직의 가장 큰 실패 원인 = "병렬 폭주". WIP 통제가 생명.

### 16.1 Feature 상태 머신

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Feature State Machine                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌───────┐    DoR 충족    ┌───────┐   에이전트    ┌────────────┐   │
│   │ Draft │──────────────►│ Ready │───할당───────►│ InProgress │   │
│   └───────┘               └───────┘               └─────┬──────┘   │
│       ▲                                                 │          │
│       │                                                 │ 완료     │
│       │                                                 ▼          │
│       │ Rework          ┌──────────┐    승인     ┌──────────┐      │
│       └─────────────────┤  Review  │◄────────────┤ Released │      │
│                         └────┬─────┘             └────┬─────┘      │
│                              │                        │            │
│                              │ 폐기                   │ 폐기       │
│                              ▼                        ▼            │
│                         ┌──────────┐                               │
│                         │Deprecated│                               │
│                         └──────────┘                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 16.2 DoR (Definition of Ready) 최소 조건

```yaml
dor_requirements:
  mandatory:
    - prd_artifact_exists: true
    - acceptance_criteria_count: ">= 3"
    - test_plan_draft_exists: true
    - impact_analysis_summary: true  # 연결된 API/DB/서비스 리스트업

  validation:
    # 모든 조건 충족 시에만 Ready로 전이 가능
    all_required: true
    auto_check: true
    human_override: false  # DoR은 자동 검증만
```

### 16.3 DoD (Definition of Done) 최소 조건

```yaml
dod_requirements:
  mandatory:
    - ci_green: true                    # unit/integration 테스트 통과
    - security_scan_baseline: true      # dep scan + SAST 통과
    - staging_e2e_passed: true          # 스테이징에서 e2e 1회 이상 통과
    - rollback_plan_exists: true        # "어떻게 되돌릴지" 문서화

  validation:
    all_required: true
    auto_check: ["ci_green", "security_scan_baseline"]
    manual_check: ["staging_e2e_passed"]
    evidence_required: true
```

### 16.4 게이트 정의 (3개로 고정)

```yaml
gates:
  # Gate 1: Spec Gate (기획 완료)
  spec_gate:
    triggers_at: "Draft → Ready"
    checks:
      - prd_exists
      - acceptance_criteria_defined
      - test_plan_exists
      - impact_analysis_done
    approval: "auto"  # 조건 충족 시 자동 통과

  # Gate 2: Code Gate (개발 완료)
  code_gate:
    triggers_at: "InProgress → Review"
    checks:
      - ci_green
      - code_review_approved
      - security_scan_passed
      - test_coverage_threshold  # 설정값 이상
    approval: "auto"  # 조건 충족 시 자동 통과

  # Gate 3: Release Gate (배포 준비 완료)
  release_gate:
    triggers_at: "Review → Released"
    checks:
      - staging_validation_passed
      - rollback_plan_documented
      - monitoring_attached
      - prod_deploy_approved  # 이것만 수동 승인
    approval: "human_required"  # 프로덕션 배포는 인간 승인 필수
```

### 16.5 WIP 규칙 (시스템 레벨 강제)

```yaml
wip_policy:
  # 역할별 WIP 제한
  per_agent_role:
    developer_agent: 1      # 개발자는 동시 1개만 (폭주 방지)
    reviewer_agent: 3       # 리뷰어는 3개까지
    qa_agent: 2
    sec_agent: 2
    sre_agent: 2
    architect_agent: 2
    manager_agent: 5

  # 전역 WIP 제한
  global:
    max_in_progress_work_items: 60
    max_active_features: 15

  enforcement:
    level: "db_transaction"  # LLM에게 말로 하는 게 아니라 DB에서 강제
    violation_action: "queue_wait"  # 초과 시 대기열에서 대기
```

---

## 17. 권한 모델 (Level + Capability)

> **핵심**: "누가"가 아니라 "무엇을" 할 수 있는지가 안전

### 17.1 권한 레벨 (0-5)

```yaml
permission_levels:
  L0_Observe:
    description: "읽기/분석/리포트"
    allowed_actions:
      - repo.read
      - ci.read
      - deploy.read
      - billing.read
      - metrics.read

  L1_Propose:
    description: "계획/설계/PR 제안 (코드 변경 없음)"
    inherits: L0_Observe
    allowed_actions:
      - planning.prd
      - planning.hld
      - planning.test
      - review.comment

  L2_Build:
    description: "브랜치/커밋/PR 생성 (머지 불가)"
    inherits: L1_Propose
    allowed_actions:
      - repo.write.branch
      - repo.open_pr
      - ci.run

  L3_Validate:
    description: "스테이징 배포/테스트 실행 (롤백 가능)"
    inherits: L2_Build
    allowed_actions:
      - deploy.staging
      - test.evaluate
      - feature_flag.toggle.staging

  L4_Release:
    description: "프로덕션 배포 '요청' 가능 (승인 필수)"
    inherits: L3_Validate
    allowed_actions:
      - deploy.prod.request
      - repo.merge  # 승인 후에만

  L5_Operate:
    description: "운영 파라미터 조정/비용 최적화 실행 (상한 내)"
    inherits: L4_Release
    allowed_actions:
      - billing.optimize.within_budget
      - feature_flag.toggle.prod.approved
      - scaling.adjust.within_limits
```

### 17.2 Capability 상세 목록

```yaml
capabilities:
  # Repository
  repo:
    - repo.read
    - repo.write.branch
    - repo.open_pr
    - repo.merge
    - repo.delete.branch

  # CI/CD
  ci:
    - ci.read
    - ci.run
    - ci.configure

  # Deployment
  deploy:
    - deploy.read
    - deploy.staging
    - deploy.prod.request
    - deploy.prod.execute
    - deploy.rollback

  # Security
  security:
    - security.scan
    - security.review
    - security.respond

  # Feature Flags
  feature_flag:
    - feature_flag.read
    - feature_flag.toggle.staging
    - feature_flag.toggle.prod.approved

  # Billing
  billing:
    - billing.read
    - billing.optimize.within_budget

  # Planning
  planning:
    - planning.prd
    - planning.hld
    - planning.test
    - planning.cost_optimize
    - planning.release

  # Review
  review:
    - review.code
    - review.architecture
    - review.security
    - review.db
    - review.api_contract
    - review.auth
    - review.iam
    - review.comment

  # Test
  test:
    - test.run
    - test.evaluate

  # Secrets (특별 보호)
  secrets:
    - secrets.read.never     # 절대 읽기 불가
    - secrets.write.limited  # 제한된 쓰기
```

### 17.3 역할별 기본 권한 매핑

```yaml
role_permissions:
  developer_agent:
    level: 2
    capabilities:
      - repo.read
      - repo.write.branch
      - repo.open_pr
      - ci.run

  reviewer_agent:
    level: 3
    capabilities:
      - repo.read
      - review.code
      - ci.read

  qa_agent:
    level: 3
    capabilities:
      - ci.read
      - ci.run
      - deploy.staging
      - test.evaluate

  sec_agent:
    level: 3
    capabilities:
      - security.scan
      - security.review
      - security.respond
      - review.security
      - review.auth
      - review.iam
      - repo.read

  sre_agent:
    level: 3
    capabilities:
      - deploy.read
      - deploy.staging
      - deploy.rollback
      - planning.release

  architect_agent:
    level: 3
    capabilities:
      - repo.read
      - planning.hld
      - review.architecture
      - review.db
      - review.api_contract

  manager_agent:
    level: 4
    capabilities:
      - planning.prd
      - planning.cost_optimize
      - billing.read
      - deploy.prod.request

  release_manager_agent:
    level: 4
    capabilities:
      - deploy.prod.request
      - repo.merge
```

### 17.4 프로덕션 보호 정책

```yaml
prod_protection:
  deploy_policy:
    requires:
      - human_approval: true
      - feature_status: "review"
      - rollback_plan_exists: true
      - staging_validation_passed: true
    enforcement: "mandatory"
    bypass: "security_clearance_only"

  merge_policy:
    requires:
      - code_review_approved: true
      - ci_green: true
      - security_scan_passed: true
    enforcement: "mandatory"
```

---

## 18. Graph SSOT 3계층 모델

> **핵심**: 그래프=진실, 문서=증거, 벡터=추천

### 18.1 3계층 역할 분리

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SSOT 3-Layer Architecture                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Layer 1: Graph DB (Neo4j) - SSOT                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  "정합성/추적/관계"의 단일 진실                               │    │
│  │  • 엔티티 간 관계 저장                                        │    │
│  │  • Impact Analysis 쿼리                                       │    │
│  │  • Traceability 보장                                          │    │
│  │  • 변경 영향 분석의 근거                                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  Layer 2: Document Store (S3/PostgreSQL) - Evidence                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  "근거 원문" 저장                                             │    │
│  │  • PRD, HLD, MLD, LLD 원문                                    │    │
│  │  • OpenAPI 스펙, ERD                                          │    │
│  │  • 테스트 결과, 리뷰 기록                                      │    │
│  │  • 그래프 노드가 참조하는 실제 내용                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  Layer 3: Vector DB (Pinecone/Weaviate) - Discovery                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  "유사도 검색/재사용 후보 추천"                                 │    │
│  │  • Feature 임베딩 저장                                        │    │
│  │  • 유사 Feature 검색                                          │    │
│  │  • 코드 패턴 매칭                                             │    │
│  │  • 재사용 후보 추천                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  왜 Graph가 SSOT여야 하는가:                                         │
│  • 벡터만으로는 "이 변경이 어떤 테스트/배포/운영지표를 깨는지"        │
│    보장할 수 없음                                                    │
│  • 에이전트가 자동으로 작업을 분해/할당/재사용하려면                   │
│    "이 Feature가 어떤 API/DB/테스트/배포와 연결되는지"를             │
│    항상 정확히 알아야 함                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 18.2 Graph Node Types

```yaml
nodes:
  Feature:
    description: "재사용 가능한 제품 자산"
    properties:
      - id, title, status, owner_role
      - functional_requirements
      - nonfunctional_requirements

  Artifact:
    description: "산출물 (문서/스펙)"
    types: [PRD, HLD, MLD, LLD, OpenAPI, ERD, TestPlan, Runbook, ADR]
    properties:
      - id, type, version, status
      - content_ref (S3/DB 링크)

  CodeAsset:
    description: "코드 자산"
    types: [Repo, Module, Package, Service, Endpoint]
    properties:
      - id, type, path, language

  TestAsset:
    description: "테스트 자산"
    types: [TestPlan, TestCase, TestResult]
    properties:
      - id, type, coverage, last_result

  RuntimeAsset:
    description: "런타임 자산"
    types: [Env, Secret, Pipeline, Deployment, SLO, Alert]
    properties:
      - id, type, config

  Incident:
    description: "장애/이슈"
    properties:
      - id, severity, status, root_cause

  WorkItem:
    description: "작업 항목"
    types: [Epic, Feature, Task, Bug, Risk]
    properties:
      - id, type, status, priority
```

### 18.3 Graph Edge Types

```yaml
edges:
  # Feature 중심 관계
  IMPLEMENTED_BY:
    from: Feature
    to: CodeAsset
    description: "Feature가 CodeAsset으로 구현됨"

  DESCRIBED_BY:
    from: Feature
    to: Artifact
    description: "Feature가 Artifact로 문서화됨"

  VERIFIED_BY:
    from: Feature
    to: TestAsset
    description: "Feature가 TestAsset으로 검증됨"

  OPERATED_BY:
    from: Feature
    to: RuntimeAsset
    description: "Feature가 RuntimeAsset으로 운영됨"

  # 변경 영향 관계
  AFFECTS:
    from: Deployment
    to: Feature
    description: "배포가 Feature에 영향"

  IMPACTS:
    from: ChangeRequest
    to: [Feature, Artifact, CodeAsset]
    description: "변경 요청이 영향을 미침"

  # 장애 관계
  CAUSED_BY:
    from: Incident
    to: Feature
    description: "장애가 Feature로 인해 발생"

  VIOLATES:
    from: Incident
    to: SLO
    description: "장애가 SLO 위반"

  # 테스트 관계
  TESTED_BY:
    from: CodeAsset
    to: TestAsset
    description: "코드가 테스트로 검증됨"
```

### 18.4 핵심 쿼리 예시 (Cypher)

```cypher
-- 1. Feature의 모든 구현 코드 찾기
MATCH (f:Feature {id: $feature_id})-[:IMPLEMENTED_BY]->(c:CodeAsset)
RETURN c

-- 2. 코드 변경 시 영향받는 Feature 찾기
MATCH (c:CodeAsset {path: $code_path})<-[:IMPLEMENTED_BY]-(f:Feature)
RETURN f

-- 3. Feature 관련 모든 테스트 찾기
MATCH (f:Feature {id: $feature_id})-[:VERIFIED_BY]->(t:TestAsset)
RETURN t

-- 4. 장애 원인 Feature 추적
MATCH (i:Incident {id: $incident_id})-[:CAUSED_BY]->(f:Feature)
RETURN f

-- 5. 변경 영향 분석 (Impact Analysis)
MATCH (cr:ChangeRequest {id: $cr_id})-[:IMPACTS]->(entity)
RETURN entity

-- 6. Feature의 전체 연결 그래프
MATCH (f:Feature {id: $feature_id})-[r]-(connected)
RETURN f, r, connected

-- 7. SLO 위반 장애와 관련 Feature
MATCH (i:Incident)-[:VIOLATES]->(s:SLO),
      (i)-[:CAUSED_BY]->(f:Feature)
RETURN f, i, s
```

---

## 19. 에이전트 스케줄러 설계

> **핵심**: WIP 강제, 우선순위 공정성, 중복 처리 방지

### 19.1 스케줄러 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Agent Scheduler Architecture                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Event Bus     │───►│  Policy Engine  │───►│    Matcher      │  │
│  │  (NATS/Redis)   │    │  (Kanban/WIP/   │    │ (Role/Capability│  │
│  │                 │    │   Gate/Fuse)    │    │   /Trust/Load)  │  │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘  │
│         ▲                       │                       │           │
│         │                       ▼                       ▼           │
│  ┌──────┴────────┐    ┌─────────────────┐    ┌─────────────────┐   │
│  │  Work Queue   │    │ Leasing/Locking │    │   Audit Log     │   │
│  │ (PostgreSQL)  │◄───│   (중복 방지)    │───►│   (Evidence)    │   │
│  └───────────────┘    └─────────────────┘    └─────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 19.2 우선순위 스코어링 알고리즘

```yaml
priority_scoring:
  formula: |
    PriorityScore = base_priority * weight_base
                  + urgency * weight_urgency
                  + aging_bonus * weight_aging
                  - risk_penalty * weight_risk
                  - cost_penalty * weight_cost

  weights:
    weight_base: 1.0
    weight_urgency: 1.2
    weight_aging: 1.0
    weight_risk: 1.5
    weight_cost: 1.0

  components:
    base_priority:
      source: "PM/TPM이 부여"
      range: [1, 5]

    urgency:
      source: "SLA 임박 여부"
      calculation: |
        if due_in_minutes <= 120:
          urgency = 10
        elif due_in_minutes <= 480:
          urgency = 5
        else:
          urgency = 0

    aging_bonus:
      source: "대기 시간"
      calculation: "points_per_minute * wait_minutes"
      points_per_minute: 0.3
      max_points: 15  # Starvation 방지

    risk_penalty:
      source: "변경량/보안민감/권한상승"
      calculation: "fuse_evaluation_result"

    cost_penalty:
      source: "모델/인프라 비용 예측"
      calculation: "estimated_cost / budget_threshold"
```

### 19.3 에이전트 매칭 알고리즘

```yaml
agent_matching:
  # Step 1: 필터링 (Hard Filters)
  filters:
    require_all_capabilities: true
    require_role_match: true
    require_agent_health: true
    require_trust_level: true
    require_wip_capacity: true

  # Step 2: 신뢰 레벨 요구사항
  trust_requirements:
    design: 2
    implementation: 2
    review: 3
    security_review: 4
    staging_deploy: 3
    prod_deploy_request: 4
    incident_response: 4

  # Step 3: 랭킹 (Agent Score)
  ranking:
    formula: |
      AgentScore = skill_match * weight_skill
                 + trust_bonus * weight_trust
                 - load_penalty * weight_load
                 - cost_penalty * weight_cost
                 + locality_bonus * weight_locality

    weights:
      weight_skill: 1.5
      weight_trust: 1.0
      weight_load: 2.0
      weight_cost: 1.2
      weight_locality: 0.8

    locality:
      description: "최근 동일 repo/service 작업 경험"
      recent_success_window_hours: 48
      max_bonus: 5
```

### 19.4 Lease 메커니즘 (중복 처리 방지)

```yaml
leasing:
  mechanism:
    description: "WorkItem에 lease_owner, lease_until 필드"
    flow:
      1: "스케줄러가 할당 시 lease 획득"
      2: "에이전트가 heartbeat로 lease 갱신"
      3: "lease 만료 시 재큐잉 (오작동 복구)"

  configuration:
    lease_duration_seconds: 300
    heartbeat_grace_seconds: 30
    max_attempts: 5
    escalate_after_attempts: 3

  recovery:
    on_lease_expired:
      - set_status: "retryable"
      - increment_attempts: true
      - log_to_audit: true
    on_max_attempts_exceeded:
      - raise_escalation: true
      - target: "manager_agent"
```

### 19.5 에스컬레이션 규칙

```yaml
escalation_rules:
  - id: "REPEATED_FAILURE"
    when:
      condition: "attempts >= 3"
    then:
      action: "raise_escalation"
      target: "manager_agent"
      reason_code: "REPEATED_FAILURE"

  - id: "AGENT_STUCK"
    when:
      condition: "lease_expired_count >= 2"
    then:
      action: "raise_escalation"
      target: "sre_agent"
      reason_code: "AGENT_UNHEALTHY_OR_STUCK"

  - id: "BLOCKED_TOO_LONG"
    when:
      condition: "blocked_duration_minutes >= 240"
    then:
      action: "raise_escalation"
      target: "manager_agent"
      reason_code: "BLOCKED_TOO_LONG"
```

---

## 20. Safety Fuse 룰 엔진

> **핵심**: 사고 "예방"보다 "격리/복구"로 이김

### 20.1 3중 퓨즈 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Safety Fuse Architecture                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Signal Collectors                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │    │
│  │  │ git diff │  │ CI result│  │ dep scan │                   │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │    │
│  │       │             │             │                          │    │
│  │       └─────────────┴─────────────┘                          │    │
│  │                     │                                        │    │
│  └─────────────────────┼────────────────────────────────────────┘    │
│                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Rule Evaluator                            │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │    │
│  │  │Change Fuse │  │ Cost Fuse  │  │Security    │             │    │
│  │  │ 변경량 평가 │  │ 비용 평가   │  │Fuse 보안   │             │    │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘             │    │
│  │        │               │               │                     │    │
│  └────────┼───────────────┼───────────────┼─────────────────────┘    │
│           │               │               │                          │
│           └───────────────┴───────────────┘                          │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Decision Composer                           │    │
│  │   ALLOW | REQUIRE_CHECKS | BLOCK_SOFT | BLOCK_HARD          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Action Dispatcher                           │    │
│  │  차단/추가검증/승인요청/롤백 후속 액션 실행                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 20.2 Signal 수집

```yaml
signals:
  change:
    - files_changed: "변경된 파일 수"
    - lines_changed: "변경된 라인 수"
    - touched_paths: "auth/, crypto/, infra/, migrations/"
    - migration_detected: "DB 마이그레이션 여부"
    - api_breaking_change: "OpenAPI diff breaking 여부"
    - config_sensitive_change: "설정 파일 민감 변경"

  cost:
    - estimated_llm_cost_usd: "LLM 호출 비용 추정"
    - estimated_ci_minutes: "CI 소요 시간 추정"
    - deploy_count_last_hour: "최근 1시간 배포 횟수"
    - llm_spend_today_usd: "오늘 LLM 지출"
    - feature_spend_usd: "Feature 누적 비용"

  security:
    - secret_scan_hits: "시크릿 스캔 탐지 수"
    - dependency_critical_cve_count: "Critical CVE 수"
    - permission_scope_increase: "권한 범위 확대 여부"
    - crypto_code_touched: "암호화 코드 변경 여부"
    - auth_code_touched: "인증 코드 변경 여부"
    - sast_high_count: "SAST 고위험 발견 수"
```

### 20.3 룰 평가

```yaml
rules:
  change:
    - id: CHG_FILES_BLOCK
      when: { files_changed_gte: 80 }
      result: block_soft
      reason_code: "CHANGE_TOO_LARGE"

    - id: CHG_DB_MIGRATION
      when: { migration_detected: true }
      result: require_checks
      reason_code: "DB_MIGRATION_DETECTED"

    - id: CHG_API_BREAKING
      when: { api_breaking_change: true }
      result: block_soft
      reason_code: "API_BREAKING_CHANGE"

  cost:
    - id: COST_DAILY_BUDGET
      when: { llm_spend_today_usd_gte: 100 }
      result: block_soft
      reason_code: "DAILY_LLM_BUDGET_EXCEEDED"

    - id: COST_FEATURE_BUDGET
      when: { feature_spend_usd_gte: 20 }
      result: require_checks
      reason_code: "FEATURE_BUDGET_EXCEEDED"

    - id: COST_DEPLOY_RATE
      when: { deploy_count_last_hour_gte: 30 }
      result: block_soft
      reason_code: "DEPLOY_RATE_TOO_HIGH"

  security:
    - id: SEC_SECRET_LEAK
      when: { secret_scan_hits_gte: 1 }
      result: block_hard
      reason_code: "SECRET_LEAK_DETECTED"

    - id: SEC_CRITICAL_CVE
      when: { dependency_critical_cve_count_gte: 1 }
      result: block_hard
      reason_code: "CRITICAL_CVE_DETECTED"

    - id: SEC_PERMISSION_SCOPE
      when: { permission_scope_increase: true }
      result: require_checks
      reason_code: "PERMISSION_SCOPE_INCREASE"

    - id: SEC_AUTH_CODE
      when: { auth_code_touched: true }
      result: require_checks
      reason_code: "AUTH_CODE_TOUCHED"
```

### 20.4 결정 합성 (보수적)

```yaml
decision_composition:
  # 보수적 합성: 가장 엄격한 결과가 최종 결정
  rules:
    - if_any: ["block_hard"]
      result: "BLOCK_HARD"

    - if_any: ["block_soft"]
      result: "BLOCK_SOFT"

    - if_any: ["require_checks"]
      result: "REQUIRE_CHECKS"

    - otherwise: "ALLOW"

actions:
  on_allow:
    set_work_item_status: "ready"

  on_require_checks:
    set_work_item_status: "blocked"
    create_work_items:
      - type: "review"
        based_on: "triggered_rules"
    allow_release_by: "checks_completed"

  on_block_soft:
    set_work_item_status: "blocked"
    notify: ["manager_agent"]
    allow_release_by: "human_approval"

  on_block_hard:
    set_work_item_status: "blocked"
    notify: ["manager_agent", "sec_agent"]
    allow_release_by: "security_clearance_only"
```

### 20.5 자동 생성 WorkItems

```yaml
auto_work_items:
  # REQUIRE_CHECKS 발동 시 자동 생성
  on_require_checks:
    - trigger: "DB_MIGRATION_DETECTED"
      creates:
        - work_type: "db_migration_review"
          required_role: "architect_agent"
        - work_type: "staging_smoke_test"
          required_role: "qa_agent"

    - trigger: "AUTH_CODE_TOUCHED"
      creates:
        - work_type: "auth_security_review"
          required_role: "sec_agent"

    - trigger: "API_BREAKING_CHANGE"
      creates:
        - work_type: "api_contract_review"
          required_role: "architect_agent"
        - work_type: "compatibility_test"
          required_role: "qa_agent"

  # BLOCK 발동 시 자동 처리
  on_block:
    - add_comment_to_pr: true
    - create_incident_if_critical: true
    - notify_stakeholders: true
```

---

## 21. Agent Manager v0 설계

> **핵심**: "당신을 대체하는 운영/기획 매니저"의 v0

### 21.1 Agent Manager 역할

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Agent Manager v0 Architecture                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  입력:                                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  OKR/KPI    │ │   백로그     │ │  운영 지표   │ │  비용 지표   │   │
│  │  (CEO 목표) │ │(Feature DB) │ │(SLO/장애)   │ │(LLM/인프라) │   │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘   │
│         │               │               │               │           │
│         └───────────────┴───────────────┴───────────────┘           │
│                                   │                                  │
│                                   ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Agent Manager v0                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │    │
│  │  │ Goal     │ │ Backlog  │ │Prioritize│ │ Planner  │        │    │
│  │  │Interpreter│ │Synthesize│ │ (WSJF)  │ │ (DoR)    │        │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │    │
│  │        │             │            │            │             │    │
│  │        └─────────────┴────────────┴────────────┘             │    │
│  │                              │                                │    │
│  │  ┌──────────────┐    ┌──────────────┐                        │    │
│  │  │ Execution    │    │  Reporter    │                        │    │
│  │  │ Orchestrator │    │ (KPI/비용)   │                        │    │
│  │  └──────────────┘    └──────────────┘                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                   │                                  │
│                                   ▼                                  │
│  출력:                                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ 우선순위화   │ │ WorkItem   │ │  실행 보고   │ │ 정책 개선안  │   │
│  │   Feature   │ │   백로그    │ │(속도/품질)  │ │  (임계치)   │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 21.2 실행 플로우

```yaml
execution_flow:
  step_0_input:
    description: "입력 수집"
    inputs:
      - okr_kpi: "CEO 목표"
      - current_backlog: "Feature Store 백로그"
      - runtime_metrics: "SLO/장애 지표"
      - cost_metrics: "LLM/인프라 비용"
      - recent_history: "변경/릴리스 히스토리"

  step_1_generate:
    description: "후보 Feature 생성"
    sources:
      - operational: "장애/성능/비용 개선 Feature"
      - product: "신규 기능/전환 개선 Feature"
      - technical: "리팩토링/테스트 강화 Feature"
      - security: "보안 강화 Feature"
    output: "candidate_features[]"

  step_2_prioritize:
    description: "WSJF 기반 점수화"
    method: "wsjf_variant"
    output: "prioritized_features[]"
    select: "top_n"  # 상위 N개 선택

  step_3_plan:
    description: "DoR 충족 계획"
    for_each: "selected_feature"
    tasks:
      - generate_prd_draft: true
      - define_acceptance_criteria: true
      - create_test_plan: true
      - run_impact_analysis: true
    if_dor_not_met:
      action: "create_design_work_items"

  step_4_execute:
    description: "WorkItem 등록 및 모니터링"
    actions:
      - register_work_items: "scheduler"
      - monitor_progress: true
      - handle_fuse_blocks: true
      - adjust_on_bottleneck: true

  step_5_report:
    description: "리포트 및 학습"
    outputs:
      - kpi_report: ["lead_time", "defect_rate", "cost"]
      - improvement_suggestions: true
      - policy_tweak_recommendations: true
```

### 21.3 우선순위 모델 (WSJF 변형)

```yaml
prioritization:
  formula: |
    Score = (BV + TC + RR) / JobSize - CostPenalty - SecurityPenalty

  components:
    business_value:
      description: "비즈니스 가치 (매출/유저 영향)"
      range: [0, 10]
      weight: 1.0

    time_criticality:
      description: "시간 민감도 (지금 안 하면 손해)"
      range: [0, 10]
      weight: 0.9

    risk_reduction:
      description: "리스크 감소 (기술부채/운영리스크)"
      range: [0, 10]
      weight: 1.1

    job_size:
      description: "구현 규모 (스토리 포인트)"
      range: [1, 13]  # 피보나치
      weight: 1.0

    cost_penalty:
      description: "모델/CI/인프라 비용"
      range: [0, 10]
      weight: 1.0

    security_penalty:
      description: "민감 영역 터치"
      range: [0, 10]
      weight: 1.2

  constraints:
    max_high_risk_per_cycle: 1
    enforce_stability_quota: true  # 장애 급증 시
```

### 21.4 인간 개입 (Human-in-the-loop) 최소화

```yaml
human_approval_points:
  # v0에서 인간이 승인해야 하는 포인트 (3개만)
  approval_a:
    name: "상위 Feature 선택 승인"
    scope: "per_cycle"
    description: "이번 사이클에 실행할 상위 3개 Feature 확인"

  approval_b:
    name: "프로덕션 배포 승인"
    scope: "per_release"
    description: "프로덕션 배포 실행 전 확인"

  approval_c:
    name: "비용 상한 변경 승인"
    scope: "per_change"
    description: "예산 초과 또는 상한 변경 시 확인"

  everything_else:
    description: "그 외 모든 결정은 Agent Manager가 자동 처리"
    audit: "모든 결정을 Audit Log로 남겨 추적 가능하게"
```

### 21.5 리포트 KPI

```yaml
reporting_kpis:
  speed:
    - lead_time_minutes: "요구사항 → 배포까지 시간"
    - cycle_time_minutes: "착수 → 완료까지 시간"
    - deploy_frequency: "배포 빈도"

  quality:
    - rework_rate: "재작업률"
    - defect_escape_rate: "결함 이탈률"
    - ci_failure_rate: "CI 실패율"
    - test_coverage: "테스트 커버리지"

  cost:
    - llm_spend_usd: "LLM 비용"
    - ci_minutes: "CI 소요 시간"
    - infra_cost: "인프라 비용"

  reliability:
    - mttr_minutes: "평균 복구 시간"
    - incident_count: "장애 수"
    - slo_compliance: "SLO 준수율"

  output_format:
    includes:
      - selected_features_with_scores
      - execution_timeline
      - fuse_events_summary
      - cost_breakdown
      - policy_improvement_suggestions
```

---

## 22. 정책 파일 명세 (YAML)

> **핵심**: 정책 = 코드. 사람이 읽을 수 있고, 버전 관리되며, 즉시 적용 가능해야 함.

### 22.1 scheduler_policy.yaml

```yaml
# scheduler_policy.yaml
# Purpose: Enforce WIP limits, select work items fairly, and match them to agents safely.

version: 1

scheduler:
  mode:
    event_driven: true
    polling_fallback: true

  loop:
    polling_interval_ms: 1500
    batch_size: 50
    blocked_backoff_seconds: 60

  leasing:
    lease_duration_seconds: 300
    heartbeat_grace_seconds: 30
    max_attempts: 5
    escalate_after_attempts: 3

wip:
  per_agent_role:
    developer_agent: 1
    reviewer_agent: 3
    qa_agent: 2
    sec_agent: 2
    sre_agent: 2
    architect_agent: 2
    manager_agent: 5

  global:
    max_in_progress_work_items: 60
    max_active_features: 15

selection:
  eligible_statuses: ["ready", "retryable"]

  aging_bonus:
    enabled: true
    points_per_minute: 0.3
    max_points: 15

  priority_score:
    weights:
      base_priority: 1.0
      urgency: 1.2
      aging_bonus: 1.0
      risk_penalty: 1.5
      cost_penalty: 1.0

  urgency:
    enabled: true
    due_threshold_minutes: 120
    max_boost: 10

matching:
  hard_filters:
    require_all_capabilities: true
    require_role_match: true
    require_agent_health: true
    require_trust_level: true

  trust:
    min_trust_by_work_type:
      design: 2
      implementation: 2
      review: 3
      security_review: 4
      staging_deploy: 3
      prod_deploy_request: 4
      incident_response: 4

  ranking:
    weights:
      skill_match: 1.5
      trust_bonus: 1.0
      load_penalty: 2.0
      cost_penalty: 1.2
      locality_bonus: 0.8

    locality:
      enabled: true
      recent_success_window_hours: 48
      max_bonus: 5

    cost:
      enabled: true
      max_penalty: 8

gating:
  dependency_enforcement: true
  conflict_keys:
    enabled: true
    mode: "exclusive"

escalation:
  rules:
    - when:
        condition: "attempts >= 3"
      then:
        action: "raise_escalation"
        target: "manager_agent"
        reason_code: "REPEATED_FAILURE"
    - when:
        condition: "lease_expired_count >= 2"
      then:
        action: "raise_escalation"
        target: "sre_agent"
        reason_code: "AGENT_UNHEALTHY_OR_STUCK"

audit:
  enabled: true
  record_fields:
    - "decision_reason_codes"
    - "decision_explanation"
    - "candidate_agents"
    - "selected_agent"
    - "priority_score_breakdown"
    - "agent_score_breakdown"
```

### 22.2 fuse_policy.yaml

```yaml
# fuse_policy.yaml
# Purpose: Evaluate risk signals and decide ALLOW / REQUIRE_CHECKS / BLOCK_SOFT / BLOCK_HARD.

version: 1

signals:
  change:
    collect:
      - files_changed
      - lines_changed
      - touched_paths
      - migration_detected
      - api_breaking_change
      - config_sensitive_change

  cost:
    collect:
      - estimated_llm_cost_usd
      - estimated_ci_minutes
      - deploy_count_last_hour
      - llm_spend_today_usd
      - feature_spend_usd

  security:
    collect:
      - secret_scan_hits
      - dependency_critical_cve_count
      - permission_scope_increase
      - crypto_code_touched
      - auth_code_touched
      - sast_high_count

rules:
  change:
    - id: CHG_FILES_BLOCK_SOFT
      when:
        files_changed_gte: 80
      result: block_soft
      reason_code: "CHANGE_TOO_LARGE"
      action:
        create_work_items:
          - type: "review"
            work_type: "architect_review"
            required_role: "architect_agent"
          - type: "test"
            work_type: "integration_test"
            required_role: "qa_agent"

    - id: CHG_DB_MIGRATION_REQUIRE
      when:
        migration_detected: true
      result: require_checks
      reason_code: "DB_MIGRATION_DETECTED"
      action:
        create_work_items:
          - type: "review"
            work_type: "db_migration_review"
            required_role: "architect_agent"
          - type: "test"
            work_type: "staging_smoke_test"
            required_role: "qa_agent"

    - id: CHG_API_BREAKING_BLOCK_SOFT
      when:
        api_breaking_change: true
      result: block_soft
      reason_code: "API_BREAKING_CHANGE"
      action:
        create_work_items:
          - type: "review"
            work_type: "api_contract_review"
            required_role: "architect_agent"

  cost:
    - id: COST_DAILY_LLM_BUDGET_BLOCK_SOFT
      when:
        llm_spend_today_usd_gte: 100
      result: block_soft
      reason_code: "DAILY_LLM_BUDGET_EXCEEDED"
      action:
        notify:
          - target: "manager_agent"
            message: "Daily LLM budget exceeded."

    - id: COST_FEATURE_BUDGET_REQUIRE
      when:
        feature_spend_usd_gte: 20
      result: require_checks
      reason_code: "FEATURE_BUDGET_EXCEEDED"

    - id: COST_DEPLOY_RATE_BLOCK_SOFT
      when:
        deploy_count_last_hour_gte: 30
      result: block_soft
      reason_code: "DEPLOY_RATE_TOO_HIGH"

  security:
    - id: SEC_SECRET_LEAK_BLOCK_HARD
      when:
        secret_scan_hits_gte: 1
      result: block_hard
      reason_code: "SECRET_LEAK_DETECTED"
      action:
        create_work_items:
          - type: "response"
            work_type: "secret_incident_response"
            required_role: "sec_agent"
        notify:
          - target: "manager_agent"
            message: "Secret leak detected. Hard-block enforced."

    - id: SEC_CRITICAL_CVE_BLOCK_HARD
      when:
        dependency_critical_cve_count_gte: 1
      result: block_hard
      reason_code: "CRITICAL_CVE_DETECTED"

    - id: SEC_PERMISSION_SCOPE_REQUIRE
      when:
        permission_scope_increase: true
      result: require_checks
      reason_code: "PERMISSION_SCOPE_INCREASE"

    - id: SEC_AUTH_CODE_REQUIRE
      when:
        auth_code_touched: true
      result: require_checks
      reason_code: "AUTH_CODE_TOUCHED"

decision:
  compose:
    - if_any: ["block_hard"]
      result: "BLOCK_HARD"
    - if_any: ["block_soft"]
      result: "BLOCK_SOFT"
    - if_any: ["require_checks"]
      result: "REQUIRE_CHECKS"
    - otherwise: "ALLOW"

actions:
  on_allow:
    set_work_item_status: "ready"
  on_require_checks:
    set_work_item_status: "blocked"
    allow_release_by: "checks_completed"
  on_block_soft:
    set_work_item_status: "blocked"
    allow_release_by: "human_approval"
  on_block_hard:
    set_work_item_status: "blocked"
    allow_release_by: "security_clearance_only"
```

### 22.3 manager_policy.yaml

```yaml
# manager_policy.yaml
# Purpose: Convert CEO goals into prioritized features and orchestrate execution.

version: 1

manager:
  operating_mode:
    direct_code_changes: false
    uses_scheduler_only: true
    respects_fuses: true

  approval_points:
    - name: "top_features_selection"
      required: true
      scope: "per_cycle"
    - name: "production_deploy"
      required: true
      scope: "per_release"
    - name: "budget_change"
      required: true
      scope: "per_change"

cycle:
  cadence_days: 14
  max_features_to_execute: 3
  max_features_to_plan: 10

inputs:
  required:
    - okr_kpi
    - product_context
    - current_backlog
    - runtime_metrics
    - recent_incidents
    - cost_metrics

backlog_generation:
  sources:
    - type: "product_growth"
      enabled: true
    - type: "operational_stability"
      enabled: true
    - type: "tech_debt"
      enabled: true
    - type: "security_posture"
      enabled: true

  deduplication:
    enabled: true
    methods: ["graph_overlap", "vector_similarity"]
    vector_similarity_threshold: 0.86

prioritization:
  model:
    type: "wsjf_variant"

  weights:
    business_value: 1.0
    time_criticality: 0.9
    risk_reduction: 1.1
    job_size: 1.0
    cost_penalty: 1.0
    security_penalty: 1.2

  scoring_ranges:
    business_value: [0, 10]
    time_criticality: [0, 10]
    risk_reduction: [0, 10]
    job_size: [1, 13]
    cost_penalty: [0, 10]
    security_penalty: [0, 10]

  constraints:
    max_high_risk_features_per_cycle: 1
    enforce_stability_quota_on_incident_spike: true

planning:
  dor_enforcement:
    enabled: true
    dor_minimum:
      - "prd_exists"
      - "acceptance_criteria_min_3"
      - "test_plan_exists"
      - "impact_analysis_exists"

  decomposition:
    work_item_templates:
      - name: "design_pack"
        applies_to: ["all"]
        creates:
          - work_type: "prd_update"
            required_role: "manager_agent"
          - work_type: "hld_draft"
            required_role: "architect_agent"
          - work_type: "test_plan_draft"
            required_role: "qa_agent"

      - name: "implementation_pack"
        applies_to: ["implementation"]
        creates:
          - work_type: "code_implementation"
            required_role: "developer_agent"
          - work_type: "code_review"
            required_role: "reviewer_agent"
          - work_type: "security_review"
            required_role: "sec_agent"

      - name: "release_pack"
        applies_to: ["release"]
        creates:
          - work_type: "staging_deploy"
            required_role: "sre_agent"
          - work_type: "e2e_validation"
            required_role: "qa_agent"
          - work_type: "prod_deploy_request"
            required_role: "release_manager_agent"

execution:
  monitoring:
    enabled: true
    triggers:
      - name: "review_queue_overflow"
        when:
          reviewer_wip_utilization_gte: 0.9
        then:
          action: "split_work_items"
          reason_code: "REVIEW_BOTTLENECK"
      - name: "blocked_too_long"
        when:
          blocked_duration_minutes_gte: 240
        then:
          action: "escalate"
          target: "manager_agent"
          reason_code: "BLOCKED_TOO_LONG"

reporting:
  kpis:
    - lead_time_minutes
    - rework_rate
    - defect_escape_rate
    - ci_failure_rate
    - llm_spend_usd
    - deploy_frequency
    - mttr_minutes

  outputs:
    - type: "cycle_report"
      include:
        - "selected_features"
        - "score_breakdown"
        - "execution_timeline"
        - "fuse_events"
        - "cost_summary"
        - "recommend_policy_tweaks"
```

---

## 부록: 반복 질문 템플릿

> **매 2주 사이클마다 사용**

```yaml
cycle_questions:
  why:
    question: "이번 사이클에서 반드시 해결할 '비용/시간/품질' 문제는 무엇인가?"

  who:
    question: "그 문제로 가장 고통받는 1차 고객은 누구인가?"
    options:
      - 내부 (dogfooding)
      - 5-30명 스타트업
      - 규제 산업 (금융/핀테크)

  what:
    question: "고객이 '돈 내고' 쓰는 최소 기능(MVP)은 무엇인가?"

  how:
    question: "온톨로지/피처 저장/에이전트 협업 중 어떤 한 축이 핵심 레버인가?"

  proof:
    question: "성공을 어떻게 수치로 증명할 건가?"
    metrics:
      - 리드타임
      - 버그율
      - 재작업률
      - 운영비
```

---

## 문서 관리

### 버전 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2026-01-24 | 초기 VISION.md 작성 |
| 2.0 | 2026-01-24 | 통합 버전 (CLI 포함) |
| 3.0 | 2026-01-25 | 다른 LLM 분석 통합 (10개 결정, 산출물 계약, 온톨로지 엔티티, Week별 실행 플랜) |
| 4.0 | 2026-01-25 | 구현 상세 명세 추가 (10개 결정 확정, Feature Store v1, 칸반 정책, 권한 모델, Graph SSOT, 스케줄러, Safety Fuse, Agent Manager v0, 정책 파일 3종) |

### 관련 문서

- `docs/VISION.md` → 이 문서로 대체 (아카이브)
- `docs/planning/VISION.md` → 삭제 (통합됨)
- `docs/planning/FEATURE_IMPROVEMENTS.md` → 이 문서의 로드맵과 연계

---

*이 문서는 프로젝트의 공식 비전 문서로, CEO 전략에 따라 업데이트됩니다.*
*2주 단위 사이클로 MVP를 지속 출하하며, 질문 루프를 통해 방향을 검증합니다.*
