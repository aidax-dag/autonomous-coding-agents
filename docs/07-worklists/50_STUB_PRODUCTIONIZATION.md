# Worklist: Stub Productionization

## Scope

Agent/Skill 모듈의 기본 스텁 출력을 운영 기준으로 정리하고, LLM 미연결 상황에서도 품질 저하를 제한한다.

## Priority Targets

- `src/core/skills/skills/*.ts` 의 "Default stub output"
- `src/core/orchestrator/agents/*-agent.ts` 의 "placeholder for LLM integration"
- `src/core/orchestrator/agents/code-quality-agent.ts` 의 TODO 테스트 코드 생성

## Tasks

### S1. Skill Fallback Contracts

- Status: `done`
- Objective: 스킬별 fallback 출력 스키마를 명시하고 최소 품질 기준 적용
- Acceptance:
  - 각 skill output에 `confidence`, `limitations`, `nextActions` 필드 포함
  - no-op 문구만 반환하는 출력 제거

### S2. Team Agent Fallback Quality

- Status: `done`
- Objective: LLM 미활성 시에도 작업 가능한 분석 결과를 반환
- Acceptance:
  - development/qa/security/debugging/documentation agent fallback이 파일 근거를 포함
  - placeholder 문자열 제거

### S3. Stub Detection Gate 강화

- Status: `done`
- Objective: placeholder 반환이 릴리스 경로로 들어가지 않게 검증 훅 강화
- Acceptance:
  - `stub-detector`에 agent/skill fallback 패턴 규칙 추가
  - CI에서 critical stub 검출 시 실패

## Validation Commands

```bash
npm test -- tests/unit/core/orchestrator/agents
npm test -- tests/unit/core/skills
npm test -- tests/unit/core/validation/stub-detector.test.ts
```

## Evidence

- S1: `src/core/skills/skill-fallback.ts` (14 skill types), 33 tests passed
- S2: `src/core/orchestrator/agents/agent-fallback.ts` (10 agent types), 50 tests passed
- S3: `src/core/validation/stub-detector.ts` (6 detection patterns), tests passed
- All 7,149 tests passed (2026-02-16)
