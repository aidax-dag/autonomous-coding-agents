# Autonomous Coding Agents - Architecture Overview

> AI 에이전트 팀이 문서 기반으로 소프트웨어를 자율적으로 개발하는 플랫폼

## 1. Project Vision

### 1.1 Core Concept
```
"문서만 정의하면, AI 팀이 완벽하게 구현한다"

PRD 작성 → AI 팀 자율 개발 → 코드 리뷰 → 테스트 → 배포
     ↑                                              ↓
     └──────────── 피드백 반영 ←────────────────────┘
```

### 1.2 Key Objectives
1. **완전 자동화 개발 파이프라인**: 문서 → 코드 → 리뷰 → 테스트 → 배포
2. **멀티 플랫폼 지원**: CLI → Desktop App → Web Service
3. **SOLID 기반 확장 가능 아키텍처**: 플러그인, 에이전트, 도구 확장
4. **TDD/Spec Driven Development**: 문서 = 테스트 스펙 = 구현 검증
5. **Enterprise Ready**: SSO, 멀티 리포, 팀 관리, 감사 로그

### 1.3 Value Proposition

| Traditional | CodeAvengers |
|-------------|--------------|
| 문서 작성 → 수동 구현 | 문서 작성 → 자동 구현 |
| 코드 리뷰 대기 | AI 즉시 리뷰 |
| 수동 테스트 작성 | 자동 TDD |
| 기능별 수동 커밋 | 자동 커밋/PR |
| 수동 보안 검사 | 자동 보안 스캔 |

---

## 2. Agent OS Paradigm

### 2.1 Concept
운영체제(OS)가 하드웨어 자원을 추상화하듯이, **Agent OS**는 LLM 자원을 추상화하고 에이전트 프로세스를 관리한다.

```
Traditional OS                    Agent OS
─────────────────────────────────────────────────────────
Hardware (CPU, Memory)      →     LLM Providers (Claude, GPT, Gemini)
Process                     →     Agent
Thread                      →     Task
IPC (Inter-Process Comm)    →     Document-based Task Queue / A2A Protocol
File System                 →     Knowledge Store / Project Memory
Scheduler                   →     Kernel Scheduler
System Calls                →     Tool Invocations
Security Module             →     Permission Manager + Audit System
```

### 2.2 Team Hierarchy
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CEO Orchestrator                               │
│                    (전략적 의사결정, 리소스 배분)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│   Planning    │         │  Development  │         │   Quality     │
│     Team      │         │   Division    │         │  Assurance    │
└───────────────┘         └───────────────┘         └───────────────┘
        │                         │                         │
        │              ┌──────────┼──────────┐              │
        ▼              ▼          ▼          ▼              ▼
┌─────────────┐ ┌───────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐
│  Architect  │ │ Frontend  │ │Backend │ │Fullstack│ │  QA Team    │
│  Explorer   │ │   Team    │ │  Team  │ │  Team  │ │ CodeQuality │
│  Librarian  │ └───────────┘ └────────┘ └────────┘ └─────────────┘
└─────────────┘
```

---

## 3. System Architecture

### 3.1 Layer Overview
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Layer                                   │
│              CLI  │  Desktop (Tauri)  │  Web Dashboard (Next.js)        │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                          API Layer                                       │
│          REST API  │  GraphQL  │  WebSocket  │  Rate Limiting           │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                       Security Layer                                     │
│    Authentication  │  Authorization  │  Audit  │  Secrets Management    │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                       Core Domain Layer                                  │
│    Orchestrator │ Workflow │ Session │ Quality │ Enterprise Services    │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                       Agent Layer                                        │
│    Coder │ Reviewer │ Architect │ Tester │ DocWriter │ Explorer         │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                       Team Layer                                         │
│    Frontend │ Backend │ Fullstack │ QA │ Planning │ CodeQuality         │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                      Tool & Plugin Layer                                 │
│    LSP │ AST-Grep │ Git │ Shell │ File │ MCP │ Web Search               │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                       Kernel Layer                                       │
│    Scheduler │ Process Manager │ Resource Manager │ Security Module     │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                     Infrastructure Layer                                 │
│    LLM Clients │ NATS │ PostgreSQL │ Redis │ GitHub API                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 SOLID Principles Application

| Principle | Application |
|-----------|-------------|
| **S**ingle Responsibility | 각 서비스/에이전트는 단일 책임 |
| **O**pen/Closed | 플러그인/훅으로 확장, 코어 수정 불필요 |
| **L**iskov Substitution | 에이전트 인터페이스 일관성 |
| **I**nterface Segregation | 역할별 작은 인터페이스 |
| **D**ependency Inversion | 추상화 의존, 구현체 주입 |

---

## 4. Agent System

### 4.1 Core Agents

> **Note**: Agent architecture has been refactored. All agents are now in `src/core/orchestrator/agents/` (Planning, Development, QA, CodeQuality).

| Agent | Role | Recommended Model |
|-------|------|-------------------|
| **Coder** | 코드 구현, 리팩토링 | Claude Sonnet |
| **Reviewer** | 코드 리뷰, 품질 검증 | Claude Sonnet |
| **Architect** | 설계, 문서 분석, 모듈 분해 | Claude Opus |
| **Tester** | TDD, 테스트 작성/실행 | Claude Sonnet |
| **DocWriter** | 문서 생성, 업데이트 | Gemini |
| **Explorer** | 코드베이스 탐색, 검색 | Claude Haiku |
| **Librarian** | 공식 문서, 레퍼런스 조회 | Claude Haiku |

### 4.2 Agent Teams

| Team | Description | Agents |
|------|-------------|--------|
| **Frontend Team** | UI/UX 개발, 컴포넌트 | Coder, Reviewer, Tester |
| **Backend Team** | API, 서비스 개발 | Coder, Reviewer, Tester |
| **Fullstack Team** | 전체 스택 통합 | Coder, Reviewer, Architect |
| **QA Team** | 품질 보증, 테스트 | Tester, Reviewer |
| **Planning Team** | 요구사항, 설계 | Architect, Explorer |
| **CodeQuality Team** | 코드 품질 관리 | Reviewer, Analyzer |

### 4.3 Orchestrator System

| Component | Role |
|-----------|------|
| **CEO Orchestrator** | 최상위 의사결정, 팀 조율 |
| **Task Router** | 작업 라우팅, 에이전트 선택 |
| **Task Decomposer** | 복잡한 작업 분해 |
| **Agent Manager** | 에이전트 라이프사이클 관리 |

---

## 5. Technology Stack

### 5.1 Core
- **Language**: TypeScript 5.x (Strict Mode)
- **Runtime**: Bun / Node.js
- **Architecture**: SOLID + Clean Architecture + DDD
- **Testing**: Jest (2,374 tests, 97 suites)
- **CI/CD**: GitHub Actions

### 5.2 AI/LLM Integration

#### API Clients
| Provider | Client | Purpose |
|----------|--------|---------|
| Anthropic | Claude Client | Primary implementation |
| OpenAI | OpenAI Client | Review, alternative |
| Google | Gemini Client | Documentation, review |

#### CLI Clients
| CLI | Version | Purpose |
|-----|---------|---------|
| claude | 2.1.4+ | Claude CLI integration |
| codex | 0.76.0+ | OpenAI Codex CLI |
| gemini | 0.22.5+ | Gemini CLI |
| ollama | 0.13.5+ | Local LLM support |

### 5.3 Infrastructure
- **Message Broker**: NATS (JetStream)
- **Database**: PostgreSQL + Prisma
- **Cache**: Redis
- **Process Manager**: PM2 / Daemon
- **Monitoring**: Prometheus + Grafana

### 5.4 Tools
- **LSP**: Language Server Protocol integration
- **AST-Grep**: AST-based code analysis
- **MCP**: Model Context Protocol servers
- **Git**: Version control operations
- **Web Search**: Real-time information retrieval

---

## 6. Key Features

### 6.1 Implemented Features

| Category | Features |
|----------|----------|
| **Core** | Agents, Teams, Orchestrator, Workflow Engine |
| **Tools** | LSP, AST-Grep, Git, Shell, File, MCP, Web Search |
| **Hooks** | 11 hooks (session-recovery, token-optimizer, etc.) |
| **Quality** | Code quality checker, Security checker, Completion detector |
| **Security** | Audit system, Permission manager, Secrets detection |
| **Enterprise** | SSO, Team management, Multi-repo support |
| **API** | REST, GraphQL, WebSocket, Rate limiting |
| **LLM** | API clients + CLI clients (4 providers) |

### 6.2 Hook System

| Hook | Purpose |
|------|---------|
| session-recovery | 세션 복구 및 상태 관리 |
| token-optimizer | 토큰 사용량 최적화 |
| context-monitor | 컨텍스트 모니터링 |
| mcp-health-monitor | MCP 서버 상태 모니터링 |
| auto-compaction | 자동 컴팩션 |
| comment-checker | 주석 검사 |
| pre-commit | 커밋 전 검증 |
| post-commit | 커밋 후 처리 |
| task-completion | 작업 완료 처리 |
| pr-creation | PR 생성 자동화 |
| ci-status | CI 상태 모니터링 |

---

## 7. Related Documents

- [System Design](./SYSTEM_DESIGN.md) - 상세 시스템 설계
- [Module Reference](./MODULE_REFERENCE.md) - 모듈 설계 참조
- [Roadmap](../06-roadmap/ROADMAP.md) - 구현 로드맵
- [Status](../06-roadmap/STATUS.md) - 현재 진행 상황
- [Testing Guide](../03-guides/TESTING.md) - 테스트 가이드
