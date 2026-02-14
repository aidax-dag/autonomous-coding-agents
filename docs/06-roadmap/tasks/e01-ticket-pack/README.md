# E01 Ticket Pack (Ready to Issue)

기준 문서:
- `docs/06-roadmap/tasks/TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE.md`
- `docs/05-specifications/v3/F027-ACA-Platform-Final-Definition.md`

## 목적

`E01. MAL Core & Adapter SDK (v1)`에 대해 바로 GitHub/Jira에 발행 가능한 티켓 본문을 제공한다.

## 포함 티켓

### C01. MAL 추상화 계약

1. `T0101.md` - MAL contract interface 초안 작성
2. `T0102.md` - contract schema(JSON) 정의
3. `T0103.md` - contract validation test 작성

### C02. Adapter SDK

1. `T0104.md` - AdapterBase 구현
2. `T0105.md` - CapabilityRegistry 연동
3. `T0106.md` - Adapter SDK 문서/샘플 작성

### C03. Local Agent Adapters

1. `T0107.md` - Claude adapter MVP
2. `T0108.md` - Codex adapter MVP
3. `T0109.md` - Gemini adapter MVP
4. `T0110.md` - Ollama adapter MVP
5. `T0111.md` - 공통 adapter integration test

## 발행 순서 권장

1. `T0101` -> `T0102` -> `T0103`
2. `T0104` -> `T0105` -> `T0106`
3. `T0107`/`T0108`/`T0109`/`T0110` 병렬
4. `T0111` 최종 통합 검증

## 공용 템플릿

- `templates/tickets/ISSUE_TEMPLATE_GITHUB_JIRA_COMMON.md`
- `templates/tickets/ISSUE_FIELD_MAPPING_GITHUB_JIRA.md`
