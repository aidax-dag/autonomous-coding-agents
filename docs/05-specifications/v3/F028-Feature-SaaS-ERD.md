# F028 Appendix A - Feature SaaS ERD (Detailed)

## 목적

`F028-Feature-SaaS-Design.md`의 DB 설계를 ERD 관점으로 상세화한다.
이 문서는 구현 전 DB 설계 리뷰 기준 문서다.

## ERD (Mermaid)

```mermaid
erDiagram
  ORGANIZATIONS ||--o{ PROJECTS : owns
  ORGANIZATIONS ||--o{ FEATURES : owns
  ORGANIZATIONS ||--o{ API_KEYS : issues
  ORGANIZATIONS ||--o{ AUDIT_LOGS : records

  PROJECTS ||--o{ FEATURES : contains

  FEATURES ||--o{ FEATURE_VERSIONS : snapshots
  FEATURES ||--o{ FEATURE_OPTIONS : has
  FEATURES ||--o{ FEATURE_ARTIFACTS : links
  FEATURES ||--o{ FEATURE_USAGE_EVENTS : tracked_by
  FEATURES ||--o{ FEATURE_REVIEWS : reviewed_by
  FEATURES ||--o{ FEATURE_LABELS : tagged_with

  ORGANIZATIONS {
    uuid id PK
    text name
    timestamptz created_at
  }

  PROJECTS {
    uuid id PK
    uuid organization_id FK
    text name
    text external_ref
    timestamptz created_at
  }

  FEATURES {
    uuid id PK
    uuid organization_id FK
    uuid project_id FK
    text feature_key UK
    text management_number UK
    text title
    text background
    text problem
    text status
    int latest_version
    bigint usage_count
    timestamptz last_used_at
    text created_by
    timestamptz created_at
    timestamptz updated_at
  }

  FEATURE_VERSIONS {
    uuid id PK
    uuid feature_id FK
    int version_no UK
    text change_summary
    jsonb payload
    text checksum
    text created_by
    timestamptz created_at
  }

  FEATURE_LABELS {
    uuid feature_id FK
    text label PK
  }

  FEATURE_OPTIONS {
    uuid id PK
    uuid feature_id FK
    text option_key
    text option_value
  }

  FEATURE_ARTIFACTS {
    uuid id PK
    uuid feature_id FK
    text artifact_type
    text url
    jsonb metadata
    timestamptz created_at
  }

  FEATURE_USAGE_EVENTS {
    uuid id PK
    uuid feature_id FK
    text ticket_id
    text actor
    jsonb context
    timestamptz used_at
  }

  FEATURE_REVIEWS {
    uuid id PK
    uuid feature_id FK
    text reviewer
    text decision
    text comment
    timestamptz reviewed_at
  }

  API_KEYS {
    uuid id PK
    uuid organization_id FK
    text key_hash
    text role
    text status
    timestamptz expires_at
    timestamptz created_at
  }

  AUDIT_LOGS {
    uuid id PK
    uuid organization_id FK
    text actor
    text action
    text entity_type
    text entity_id
    jsonb before_data
    jsonb after_data
    timestamptz created_at
  }
```

## 정합성 규칙

1. `features(organization_id, feature_key)`는 유니크해야 한다.
2. `feature_versions(feature_id, version_no)`는 유니크해야 한다.
3. Feature 상태 변경/버전 생성/롤백은 `audit_logs`에 append 되어야 한다.
4. 조직 경계를 넘는 참조(FK)는 허용하지 않는다.

## 인덱스 권장

1. `idx_features_org_status_updated_at` on `(organization_id, status, updated_at desc)`
2. `idx_feature_versions_feature_version_no_desc` on `(feature_id, version_no desc)`
3. `idx_feature_usage_events_feature_used_at_desc` on `(feature_id, used_at desc)`
4. `idx_feature_labels_label` on `(label)`
5. `idx_audit_logs_org_created_at_desc` on `(organization_id, created_at desc)`

## 리뷰 체크리스트

1. 멀티테넌시 경계가 모든 FK에서 보장되는가?
2. 버전 충돌/중복 버전 생성 가능성이 차단되는가?
3. 검색/요약 쿼리 인덱스가 p95 목표를 지원하는가?
4. 감사 로그 누락 경로가 없는가?

## 상태

- 상태: Draft
- 작성일: 2026-02-15
