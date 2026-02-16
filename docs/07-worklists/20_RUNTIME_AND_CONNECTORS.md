# Worklist: Runtime and Connectors

## Scope

Ticket/Feature 사이클을 "로컬 JSON 저장" 수준에서 "운영 가능한 통합 런타임"으로 올린다.

## Out of Scope

- UI 리디자인
- Agent Economy 결제/정산
- 신규 LLM 모델 추가

## Tasks

### R1. External Sync Adapter (GitHub/Jira)

- Status: `done`
- Objective: Ticket 상태 전이를 외부 이슈 트래커와 동기화
- Entry points:
  - `src/core/ticketing/ticket-feature-service.ts`
  - `src/api/routes/ticket-feature-cycle.ts`
- Deliverables:
  - external sync 인터페이스 (`syncTicket`, `syncStatus`, `syncReview`)
  - GitHub adapter
  - Jira adapter (옵션)
  - 실패 재시도/백오프 정책
- Acceptance:
  - Ticket 상태 변경 시 adapter hook 호출
  - 외부 API 실패 시 내부 상태와 에러 로그 분리 저장
  - 동기화 끔/켬 환경설정 지원

### R2. Ticket/Feature Storage Abstraction

- Status: `done`
- Objective: `store.json` 직접 접근 제거, persistence 어댑터로 교체
- Entry points:
  - `src/core/ticketing/ticket-feature-service.ts`
  - `src/core/persistence/*`
- Deliverables:
  - `TicketFeatureRepository` interface
  - JSON adapter (기존 호환)
  - SQLite/PostgreSQL adapter
- Acceptance:
  - 서비스는 repository interface만 사용
  - 기존 API 테스트 통과
  - 데이터 마이그레이션 스크립트 제공

### R3. MCP Gate Hardening

- Status: `done`
- Objective: MCP readiness 검증 사유를 관측 가능하게 확장
- Entry points:
  - `src/core/ticketing/ticket-feature-service.ts`
  - `src/core/mcp/*`
- Deliverables:
  - gate failure reason code
  - readiness telemetry
  - health endpoint 연동(선택)
- Acceptance:
  - start/complete 실패 시 reason code 반환
  - 로그와 API 에러 본문에서 동일한 원인 추적 가능

## Validation Commands

```bash
npm test -- tests/unit/api/routes/ticket-feature-cycle.test.ts
npm test -- tests/unit/core/ticketing/repositories
npm test -- tests/unit/core/ticketing/sync
npm test -- tests/unit/core/ticketing/mcp-gate.test.ts
```

## Evidence

- R1: `src/core/ticketing/sync/` (4 files), tests 41 passed
- R2: `src/core/ticketing/repositories/` (4 files), `src/core/ticketing/interfaces/` (1 file), tests 30 passed
- R3: `src/core/ticketing/mcp-gate.ts`, tests 21 passed
- All 7,149 tests passed (2026-02-16)
