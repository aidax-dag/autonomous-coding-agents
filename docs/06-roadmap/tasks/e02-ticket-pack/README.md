# E02 Ticket Pack (Ready to Issue)

기준 문서:
- `docs/06-roadmap/tasks/TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE.md`
- `docs/05-specifications/v3/F027-ACA-Platform-Final-Definition.md`

## 목적

`E02. Runtime Kernel (v1)`에 대해 바로 GitHub/Jira에 발행 가능한 티켓 본문을 제공한다.

## 포함 티켓

### C04. Ticket Workflow Engine

1. `T0201.md` - 상태 전이 정책 확정
2. `T0202.md` - gate validation 모듈 구현
3. `T0203.md` - role-based assignment 구현

### C05. Job Scheduler & Queue

1. `T0204.md` - queue model 구현
2. `T0205.md` - priority/QoS 룰 구현
3. `T0206.md` - cancel/pause/resume 처리

### C06. tmux Job Lifecycle

1. `T0207.md` - tmux session manager 구현
2. `T0208.md` - session checkpoint 저장/복구
3. `T0209.md` - 장애 복구 시나리오 테스트

## 발행 순서 권장

1. `T0201` -> `T0202` -> `T0203`
2. `T0204` -> `T0205` -> `T0206`
3. `T0207` -> `T0208` -> `T0209`

## 공용 템플릿

- `templates/tickets/ISSUE_TEMPLATE_GITHUB_JIRA_COMMON.md`
- `templates/tickets/ISSUE_FIELD_MAPPING_GITHUB_JIRA.md`
