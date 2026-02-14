# E04 Ticket Pack (Ready to Issue)

기준 문서:
- docs/06-roadmap/tasks/TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE.md
- docs/05-specifications/v3/F027-ACA-Platform-Final-Definition.md

## 목적

E04. Reliability, Policy, Cost (v1)에 대해 바로 GitHub/Jira에 발행 가능한 티켓 본문을 제공한다.

## 포함 티켓

### C09. Reliability Layer

1. T0401.md - idempotency store 구현
2. T0402.md - retry policy engine 구현
3. T0403.md - circuit breaker 룰 구현

### C10. Policy Engine

1. T0404.md - policy rule schema 정의
2. T0405.md - pre-execution policy check 구현
3. T0406.md - violation audit log 구현

### C11. Cost Governor

1. T0407.md - budget ledger 구현
2. T0408.md - model/agent fallback 전략 구현
3. T0409.md - 비용 리포트 API 추가

## 발행 순서 권장

1. T0401 -> T0402 -> T0403
2. T0404 -> T0405 -> T0406
3. T0407 -> T0408 -> T0409

## 공용 템플릿

- templates/tickets/ISSUE_TEMPLATE_GITHUB_JIRA_COMMON.md
- templates/tickets/ISSUE_FIELD_MAPPING_GITHUB_JIRA.md
