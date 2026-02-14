# F025 - Feature Management Service

## 배경

Ticket 완료 산출물을 재사용 가능한 Feature 자산으로 축적하려면, 등록/조회 수준을 넘어 버전관리와 운영 관리 API가 필요하다.

## 구현 목표

1. Feature를 원자 단위 자산으로 등록/조회/수정/상태관리.
2. 자동 버전 증가 + 버전 히스토리 + 롤백.
3. 라벨 관리/조회 + 옵션(언어/도메인/제약) 필터링.
4. Human/Agent 리뷰 기록.
5. 재사용 횟수/최근 사용 시점 추적.

## 현재 구현

런타임:
- `src/core/ticketing/ticket-feature-service.ts`
- `src/api/routes/ticket-feature-cycle.ts`

핵심 필드:
- `featureId`, `managementNumber`
- `title`, `background`, `problem`
- `requirements`, `verificationChecklist`
- `artifactLinks`, `usageGuideLinks`
- `labels`, `options`, `status`, `version`
- `reviews`, `sourceTickets`
- `usageCount`, `lastUsedAt`
- `versionHistory`

## API 범위 (구현 기준)

기본 관리:
1. `POST /api/features`
2. `GET /api/features`
3. `GET /api/features/:featureId`
4. `PUT /api/features/:featureId`
5. `PUT /api/features/:featureId/status`
6. `POST /api/features/:featureId/reviews`

운영 관리:
1. `GET /api/features/labels`
2. `PUT /api/features/:featureId/labels`
3. `GET /api/features/:featureId/versions`
4. `PUT /api/features/:featureId/rollback`
5. `POST /api/features/:featureId/use`
6. `GET /api/features/management/summary`

## 버전 관리 규칙

1. Feature 수정 시 버전이 자동 patch 증가(`x.y.z -> x.y.z+1`).
2. 수정 내용은 `versionHistory`에 스냅샷으로 기록.
3. 롤백은 과거 버전 스냅샷을 복원하고 새 버전으로 재기록.

## Ticket 연계

1. `PUT /api/tickets/:ticketId/complete`에서 `registerFeature=true` 옵션으로 Feature 자동 등록 지원.
2. Ticket 검증 조건(artifact/review/status) 불충족 시 완료 차단.

## 상태

- 상태: Implemented (v3.1)
- 작성일: 2026-02-14
