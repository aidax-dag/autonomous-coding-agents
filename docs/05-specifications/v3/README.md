# v3 Specifications

> ACA Next Program 스펙 (MAL + Ticket/Feature Cycle + Agent Economy)

## 목적

v3는 기존 ACA v2 기반 위에 다음을 추가하는 프로그램 스펙이다.

1. `claude-code`, `codex`, `gemini-cli` 업데이트 추적 가능한 다중 엔진 추상화
2. Ticket 기반 작업 사이클의 강제와 자동화
3. Feature를 재사용 가능한 원자 단위 자산으로 관리하는 카탈로그
4. Agent Persona/Skill 기반 전문화 실행
5. 원격 Agent 연동(A2A/MCP) + 사용량 기반 경제 프로토콜(x402, escrow)

## 문서 구성

| ID | 문서 | 설명 |
|---|---|---|
| F021 | [F021-MAL.md](./F021-MAL.md) | Multi Agent Abstraction Layer 설계 |
| F022 | [F022-Ticket-Feature-Cycle.md](./F022-Ticket-Feature-Cycle.md) | Ticket/Feature 작업 사이클 설계 |
| F023 | [F023-Agent-Economy.md](./F023-Agent-Economy.md) | Agent 경제/마켓/보안/프라이버시 설계 |
| F024 | [F024-Program-Roadmap.md](./F024-Program-Roadmap.md) | 다중 프로젝트 실행 로드맵 |
| F025 | [F025-Feature-Management-Service.md](./F025-Feature-Management-Service.md) | Feature 관리 서비스 설계 |
| F026 | [F026-Ticket-Feature-Runtime-and-MCP-Enforcement.md](./F026-Ticket-Feature-Runtime-and-MCP-Enforcement.md) | Ticket/Feature 런타임 구현 + MCP 필수 게이트 |
| F027 | [F027-ACA-Platform-Final-Definition.md](./F027-ACA-Platform-Final-Definition.md) | 최종 범위 고정(v1/v1.1) + 제품 정체성/릴리스 경계 |

## 스키마

v3는 문서형 스펙뿐 아니라 기계 판독 가능한 스키마를 함께 유지한다.

- `schemas/ticket.schema.json`
- `schemas/feature.schema.json`
- `schemas/a2a-economic-contract.schema.json`

## 현재 코드베이스와 연결 포인트

- CLI 기반 LLM 브리지: `src/shared/llm/cli/`
- A2A 프로토콜 골격: `src/core/protocols/a2a/`
- MCP 통합: `src/core/mcp/`
- 문서 기반 Task Queue: `src/core/workspace/`
- SaaS/Billing 골격: `src/core/saas/`

## 상태

- 상태: In Progress (v3.1)
- 작성일: 2026-02-14
