# Status Baseline (2026-02-15)

## Why this exists

일부 계획 문서는 이미 구현된 기능을 미구현으로 표기하고 있다. 구현 전 기준선을 먼저 맞춘다.

## Verified Implemented

- Ticket/Feature API 라우트 존재
  - `src/api/routes/ticket-feature-cycle.ts`
- Ticket/Feature 서비스 로직 존재
  - `src/core/ticketing/ticket-feature-service.ts`
- MCP 필수 게이트 존재 (시작/완료 시 검증)
  - `src/core/ticketing/ticket-feature-service.ts`
- OpenAPI endpoint registry 반영됨
  - `src/api/docs/endpoint-registry.ts`
- Ticket/Feature API 단위 테스트 존재
  - `tests/unit/api/routes/ticket-feature-cycle.test.ts`

## Verified Gaps (Code-first)

- 외부 티켓 양방향 동기화 부재 (GitHub/Jira connector 없음)
- Ticket/Feature 저장소가 JSON 파일 기반 (`data/ticket-cycle/store.json`)으로 DB 통합 미완료
- Brownfield analyzer 기본 구현이 스텁
  - `src/core/brownfield/brownfield-analyzer.ts`
- Docs generator 기본 구현이 스텁
  - `src/core/docs-generator/docs-generator.ts`
- Benchmark runner 기본 loader/executor 부재 시 무의미한 결과
  - `src/core/benchmark/benchmark-runner.ts`
- Pre-exploration 기본 구현이 최소 결과 반환
  - `src/core/deep-worker/pre-exploration.ts`

## Documents known to be stale

- (없음 — v7 업데이트로 모든 전략 문서가 코드 상태와 동기화됨, 2026-02-16)

## Baseline Rule

- 구현 상태 판단은 항상 코드와 테스트를 우선한다.
- 계획 문서와 충돌 시 `10_STATUS_BASELINE.md`를 먼저 갱신하고 구현을 진행한다.
