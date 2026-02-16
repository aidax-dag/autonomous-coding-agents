# Worklist: Doc Sync and Token Policy

## Scope

문서와 코드 상태 불일치를 줄이고, 이후 작업에서 토큰 사용을 지속적으로 제한한다.

## Tasks

### D1. Stale Document Sync

- Status: `todo`
- Target:
  - `docs/04-planning/COMPETITIVE_ANALYSIS_AND_ENHANCEMENT_STRATEGY.md`
- Objective:
  - Ticket/Feature runtime, MCP gate, OpenAPI 반영 상태를 최신 코드 기준으로 수정
- Acceptance:
  - 구현 근거 파일 경로가 문서에 포함
  - "미구현" 표기가 실제 코드와 일치

### D2. Compact Index Refresh Rule

- Status: `todo`
- Objective:
  - 문서 변경 시 compact index를 같이 갱신하는 규칙 확정
- Acceptance:
  - PR 체크리스트에 `npm run docs:compact` 포함
  - `docs/_compact/README.md` generated timestamp 최신화

### D3. Task Doc Update Rule

- Status: `todo`
- Objective:
  - 구현 완료 시 해당 트랙 문서 Evidence만 업데이트하도록 표준화
- Acceptance:
  - 트랙 문서별 Status/Evidence 섹션 최신화
  - 불필요한 장문 회고 문서 생성 금지

## Validation Commands

```bash
npm run docs:compact
npm run docs:query -- "stale status ticket feature runtime"
```

## Evidence

- Pending
