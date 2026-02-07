# 02-architecture

> 시스템 아키텍처 및 설계 문서

## 문서 목록

| 문서 | 설명 | 대상 |
|------|------|------|
| [OVERVIEW.md](./OVERVIEW.md) | 아키텍처 개요, Agent OS 패러다임, 기술 스택 | 전체 |
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | 디렉토리 구조, 인터페이스, 컴포넌트 상세 | 개발자 |
| [MODULE_REFERENCE.md](./MODULE_REFERENCE.md) | 모듈 구조 템플릿, 구현 패턴 | 개발자 |

## 읽기 순서

1. **[OVERVIEW.md](./OVERVIEW.md)** - 전체 아키텍처 이해 (10분)
2. **[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)** - 상세 설계 확인 (20분)
3. **[MODULE_REFERENCE.md](./MODULE_REFERENCE.md)** - 구현 시 참조 (필요시)

## 핵심 아키텍처

### Agent OS 패러다임

```
Traditional OS              Agent OS
─────────────────────────────────────────────
Hardware (CPU, Memory)  →   LLM Providers (Claude, GPT, Gemini)
Process                 →   Agent
Thread                  →   Task
IPC                     →   Document-based Task Queue
File System             →   Knowledge Store
Scheduler               →   Kernel Scheduler
System Calls            →   Tool Invocations
```

### 시스템 레이어

```
┌─────────────────────────────────────────┐
│  Client Layer (CLI, Desktop, Web)       │
├─────────────────────────────────────────┤
│  API Layer (REST, GraphQL, WebSocket)   │
├─────────────────────────────────────────┤
│  Security Layer (Auth, Audit, Secrets)  │
├─────────────────────────────────────────┤
│  Core Domain Layer (Orchestrator, etc.) │
├─────────────────────────────────────────┤
│  Agent Layer (Coder, Reviewer, etc.)    │
├─────────────────────────────────────────┤
│  Team Layer (Frontend, Backend, QA)     │
├─────────────────────────────────────────┤
│  Tool & Plugin Layer (LSP, Git, MCP)    │
├─────────────────────────────────────────┤
│  Kernel Layer (Scheduler, Security)     │
├─────────────────────────────────────────┤
│  Infrastructure (LLM, NATS, PostgreSQL) │
└─────────────────────────────────────────┘
```

### Core Agents

| Agent | Role | Model |
|-------|------|-------|
| Coder | 코드 구현, 리팩토링 | Claude Sonnet |
| Reviewer | 코드 리뷰, 품질 검증 | Claude Sonnet |
| Architect | 설계, 문서 분석 | Claude Opus |
| Tester | TDD, 테스트 작성 | Claude Sonnet |
| DocWriter | 문서 생성 | Gemini |
| Explorer | 코드베이스 탐색 | Claude Haiku |
| Librarian | 레퍼런스 조회 | Claude Haiku |

## 관련 문서

- [01-vision/](../01-vision/) - 프로젝트 비전
- [03-guides/](../03-guides/) - 사용자 가이드
- [05-specifications/](../05-specifications/) - 기능 스펙
- [06-roadmap/](../06-roadmap/) - 개발 로드맵
