# E06 Ticket Pack (Ready to Issue)

기준 문서:
- docs/06-roadmap/tasks/TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE.md
- docs/05-specifications/v3/F027-ACA-Platform-Final-Definition.md

## 목적

E06. Ticket Provider Adapters에 대해 바로 GitHub/Jira에 발행 가능한 티켓 본문을 제공한다.

## 포함 티켓

### C15. GitHub Provider (v1)

1. T0601.md - github mapper 구현
2. T0602.md - sync mode(push/pull) 구현
3. T0603.md - github sync integration test

### C16. Jira Provider (v1.1)

1. T0604.md - jira connector contract 정의
2. T0605.md - jira mapper 구현
3. T0606.md - jira sync integration test
4. T0607.md - provider option UI/API 반영

## 발행 순서 권장

1. T0601 -> T0602 -> T0603
2. T0604 -> T0605 -> T0606 -> T0607

## 릴리스 매핑

- v1: C15 (GitHub Provider)
- v1.1: C16 (Jira Provider)

## 공용 템플릿

- templates/tickets/ISSUE_TEMPLATE_GITHUB_JIRA_COMMON.md
- templates/tickets/ISSUE_FIELD_MAPPING_GITHUB_JIRA.md
