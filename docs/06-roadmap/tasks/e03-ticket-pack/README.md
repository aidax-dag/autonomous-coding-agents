# E03 Ticket Pack (Ready to Issue)

기준 문서:
- docs/06-roadmap/tasks/TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE.md
- docs/05-specifications/v3/F027-ACA-Platform-Final-Definition.md

## 목적

E03. IPC & Network Services (v1)에 대해 바로 GitHub/Jira에 발행 가능한 티켓 본문을 제공한다.

## 포함 티켓

### C07. IPC Manager

1. T0301.md - IPC envelope schema 정의
2. T0302.md - correlation-id 기반 라우팅 구현
3. T0303.md - IPC timeout/abort 처리

### C08. Network Manager

1. T0304.md - network health probe 구현
2. T0305.md - degraded mode policy 적용
3. T0306.md - online/offline 전환 테스트

## 발행 순서 권장

1. T0301 -> T0302 -> T0303
2. T0304 -> T0305 -> T0306

## 공용 템플릿

- templates/tickets/ISSUE_TEMPLATE_GITHUB_JIRA_COMMON.md
- templates/tickets/ISSUE_FIELD_MAPPING_GITHUB_JIRA.md
