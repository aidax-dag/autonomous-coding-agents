# E07 Ticket Pack (SaaS-First, Design Gate First)

기준 문서:
- docs/06-roadmap/tasks/TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE.md
- docs/05-specifications/v3/F027-ACA-Platform-Final-Definition.md
- docs/05-specifications/v3/F028-Feature-SaaS-Design.md

## 목적

E07을 문서/로컬 중심이 아닌 DB 기반 Feature SaaS 중심으로 재정렬한다.
핵심 원칙은 설계(DB/API/ACA 연동) 승인 전 구현 금지다.

## 재정렬 원칙

1. Phase A: 설계 산출물 고정
2. Phase B: 설계 검증/정합성 검증
3. Phase C: 구현(별도 실행, 본 패키지 승인 이후)

## 설계 우선 발행 순서

### Phase A - Core Design

1. T0701.md - Feature DB 스키마/도메인 설계
2. T0702.md - Feature API/검색 계약 설계
3. T0703.md - ACA 연동(MCP/SDK/동기화) 설계

### Phase B - Integrity & Operations Design

1. T0704.md - 버전 스냅샷 정합성 설계 검증
2. T0705.md - 롤백 정책 설계 검증
3. T0706.md - usage telemetry 설계 검증

## 게이트

1. T0701~T0703 승인 전 구현 티켓 시작 금지
2. T0704~T0706 승인 전 운영 적용 금지
3. 모든 티켓은 설계 산출물 링크를 필수로 첨부

## 공용 템플릿

- templates/tickets/ISSUE_TEMPLATE_GITHUB_JIRA_COMMON.md
- templates/tickets/ISSUE_FIELD_MAPPING_GITHUB_JIRA.md
