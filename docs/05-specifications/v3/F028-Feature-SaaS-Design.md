# F028 - Feature SaaS Design (DB Schema + API + ACA Integration)

## 1. 목적

Feature를 문서가 아닌 중앙 DB 기반 SaaS로 관리하고,
`autonomous-coding-agents`(ACA)가 해당 SaaS를 공식 Source of Truth로 사용하도록 설계를 확정한다.

## 2. 범위

포함:
1. Feature SaaS 도메인/데이터 모델
2. DB 스키마 설계
3. API 설계
4. ACA 연동 설계(SDK/MCP/런타임 플로우)

제외:
1. 실제 코드 구현
2. 운영 인프라 배포
3. 결제/마켓플레이스 정산 구현

## 3. 설계 원칙

1. Feature SoT는 SaaS DB다.
2. ACA는 로컬 저장소를 캐시로만 사용한다.
3. 설계 승인 전 구현 금지.
4. 멀티테넌시/권한/감사 로그를 기본 전제로 설계한다.

## 4. 도메인 모델

핵심 엔티티:
1. `organizations`
2. `projects`
3. `features`
4. `feature_versions`
5. `feature_labels`
6. `feature_options`
7. `feature_artifacts`
8. `feature_usage_events`
9. `feature_reviews`
10. `api_keys`
11. `audit_logs`

핵심 관계:
1. org 1:N projects
2. project 1:N features
3. feature 1:N feature_versions
4. feature N:M labels
5. feature 1:N options/artifacts/reviews/usage_events

## 5. DB 스키마 설계

## 5.1 테이블 초안

```sql
create table organizations (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  name text not null,
  external_ref text,
  created_at timestamptz not null default now()
);

create table features (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  project_id uuid not null references projects(id),
  feature_key text not null,
  management_number text not null,
  title text not null,
  background text,
  problem text,
  status text not null,
  latest_version int not null default 1,
  usage_count bigint not null default 0,
  last_used_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, feature_key),
  unique (organization_id, management_number)
);

create table feature_versions (
  id uuid primary key,
  feature_id uuid not null references features(id),
  version_no int not null,
  change_summary text,
  payload jsonb not null,
  checksum text not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (feature_id, version_no)
);

create table feature_labels (
  feature_id uuid not null references features(id),
  label text not null,
  primary key (feature_id, label)
);

create table feature_options (
  id uuid primary key,
  feature_id uuid not null references features(id),
  option_key text not null,
  option_value text not null,
  unique (feature_id, option_key)
);

create table feature_artifacts (
  id uuid primary key,
  feature_id uuid not null references features(id),
  artifact_type text not null,
  url text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table feature_usage_events (
  id uuid primary key,
  feature_id uuid not null references features(id),
  ticket_id text,
  actor text,
  context jsonb,
  used_at timestamptz not null default now()
);

create table feature_reviews (
  id uuid primary key,
  feature_id uuid not null references features(id),
  reviewer text not null,
  decision text not null,
  comment text,
  reviewed_at timestamptz not null default now()
);

create table api_keys (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  key_hash text not null,
  role text not null,
  status text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
```

## 5.2 인덱스/정합성

1. `features(organization_id, status, updated_at desc)`
2. `feature_usage_events(feature_id, used_at desc)`
3. `feature_versions(feature_id, version_no desc)`
4. 모든 쓰기 트랜잭션에서 `audit_logs` append

## 6. API 설계

기본:
1. `POST /v1/features`
2. `GET /v1/features`
3. `GET /v1/features/{featureId}`
4. `PATCH /v1/features/{featureId}`
5. `POST /v1/features/{featureId}/versions`
6. `POST /v1/features/{featureId}/rollback`

운영:
1. `POST /v1/features/{featureId}/usage-events`
2. `POST /v1/features/{featureId}/reviews`
3. `GET /v1/features/summary`
4. `GET /v1/features/search`

조회 필터:
1. `labels`
2. `options`
3. `status`
4. `updatedAfter`
5. `projectId`
6. `q`

응답 원칙:
1. `featureId`, `featureKey`, `managementNumber` 고정 제공
2. `latestVersion`, `usageCount`, `lastUsedAt` 포함
3. `versionHistory`는 기본 축약, 상세는 version API 사용

## 7. ACA 연동 설계

## 7.1 연동 방식

1. `FeatureRegistryClient` (HTTP SDK)
2. `MCP tool wrappers` (`feature.search`, `feature.register`, `feature.use`)
3. Ticket 완료 시 Feature 자동 등록 플로우

## 7.2 ACA 런타임 플로우

1. Ticket 시작 전: `feature.search`로 재사용 후보 조회
2. Ticket 완료 시: 산출물/검증 링크 포함 `feature.register`
3. 재사용 시: `feature.use` 이벤트 기록
4. 실패 시: 로컬 큐에 임시 적재 후 재전송

## 7.3 로컬 캐시 정책

1. 캐시는 읽기 최적화 용도
2. 캐시 미스 시 SaaS 조회
3. 충돌 시 SaaS 데이터 우선
4. 오프라인 모드는 read-only fallback

## 8. 보안/권한 설계

1. API Key + 조직 범위 RBAC (`admin`, `writer`, `reader`)
2. 민감 데이터 필드 마스킹
3. 감사 로그 필수
4. Provider 외부 동기화 시 요약/참조만 전송

## 9. 비기능 요구사항

1. 검색 p95 < 500ms (기본 필터)
2. 쓰기 API p95 < 700ms
3. 데이터 무결성: version 충돌 0 허용
4. 감사 로그 누락 0 허용

## 10. 설계 게이트 (구현 전 필수)

1. DB 스키마 리뷰 승인
2. API 계약 리뷰 승인
3. ACA 연동 시퀀스 리뷰 승인
4. 보안/권한 모델 리뷰 승인

## 11. 산출물 링크 규칙

1. 모든 Feature는 코드/문서/검증 링크를 최소 1개 이상 가져야 한다.
2. 링크 유효성 검증 실패 시 등록 거부.

## 12. 부속 산출물 (Draft)

1. DB ERD 상세본: `docs/05-specifications/v3/F028-Feature-SaaS-ERD.md`
2. OpenAPI 초안: `docs/api/feature-saas.openapi.yaml`
3. ACA MCP tool contract 초안(JSON schema): `schemas/feature-mcp-tool-contract.schema.json`

## 13. 상태

- 상태: Design Draft (Pre-Implementation)
- 작성일: 2026-02-15
