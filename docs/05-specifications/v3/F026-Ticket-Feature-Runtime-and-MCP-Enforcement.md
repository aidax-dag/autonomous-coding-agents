# F026 - Ticket/Feature Runtime and MCP Enforcement

## 배경

F022/F025 스펙을 실제 동작 시스템으로 연결하기 위해, Ticket 기반 Working Cycle과 Feature 카탈로그를 API/스토리지 레벨에서 강제하는 런타임이 필요하다.

## 구현 범위

1. Ticket lifecycle 런타임 서비스
2. Feature 카탈로그 런타임 서비스
3. Ticket -> Feature 자동 등록
4. MCP 연결 필수 게이트(기본 활성화)
5. OpenAPI 문서 레지스트리 반영

## 구현 위치

- `src/core/ticketing/ticket-feature-service.ts`
- `src/api/routes/ticket-feature-cycle.ts`
- `src/api/server.ts`
- `src/api/docs/endpoint-registry.ts`

## Working Cycle 강제 규칙

1. 상태 전이 규칙:
- `created -> in_progress/pending/cancelled`
- `in_progress -> pending/reviewing/cancelled`
- `pending -> in_progress/reviewing/cancelled`
- `reviewing -> in_progress/completed/cancelled`

2. 완료 게이트:
- 상태가 `reviewing` 이어야 함
- artifact 최소 1개 필요
- review 최소 1개 필요
- `changes_requested` 리뷰가 있으면 완료 차단
- reviewer assignee가 있으면 전원 승인 필요

3. 실행 기록:
- startedAt/endedAt, issues, artifacts, reviews 저장
- 파일 기반 스토어: `data/ticket-cycle/store.json` (기본)

## API 적용 범위

Ticket:
- `POST /api/tickets`
- `GET /api/tickets`
- `GET /api/tickets/:ticketId`
- `PUT /api/tickets/:ticketId/start`
- `PUT /api/tickets/:ticketId/status`
- `POST /api/tickets/:ticketId/artifacts`
- `POST /api/tickets/:ticketId/issues`
- `POST /api/tickets/:ticketId/reviews`
- `PUT /api/tickets/:ticketId/complete`
- `POST /api/tickets/:ticketId/register-feature`

Feature:
- `POST /api/features`
- `GET /api/features`
- `GET /api/features/labels`
- `GET /api/features/management/summary`
- `GET /api/features/:featureId`
- `GET /api/features/:featureId/versions`
- `PUT /api/features/:featureId`
- `PUT /api/features/:featureId/labels`
- `PUT /api/features/:featureId/rollback`
- `POST /api/features/:featureId/use`
- `PUT /api/features/:featureId/status`
- `POST /api/features/:featureId/reviews`

## MCP 필수 적용 정책

기본 정책:
- Ticket 실행 시작(`start`)과 완료(`complete`) 시 MCP 연결 상태를 검사한다.
- MCP 연결이 확인되지 않으면 요청을 거부한다.

설정:
- `ACA_REQUIRE_MCP_FOR_TICKET_CYCLE` (기본: `true`)
- `ACA_TICKET_DATA_DIR` (ticket store 경로 변경)

예외:
- 개발/테스트 목적에서만 `ACA_REQUIRE_MCP_FOR_TICKET_CYCLE=false` 허용.

## 검증

- `tests/unit/api/routes/ticket-feature-cycle.test.ts`
- `tests/unit/api/docs/api-docs.test.ts`
- `tests/unit/api/docs/openapi-serve.test.ts`

## 상태

- 상태: Implemented (v3.1)
- 작성일: 2026-02-14
