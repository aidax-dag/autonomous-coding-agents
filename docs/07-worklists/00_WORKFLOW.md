# Workflow (Token-Minimized)

## Goal

프로젝트 완성을 위해 필요한 분석/구현 작업을, 최소 문서 읽기로 실행 가능하게 유지한다.

## Inputs (Always)

- `docs/_compact/README.md`
- `docs/07-worklists/10_STATUS_BASELINE.md`
- 선택한 트랙 문서 1개

## Execution Steps

1. `npm run docs:compact`
2. `npm run docs:query -- "<작업 키워드>"`
3. 상위 3~5개 파일만 로드
4. 선택한 트랙 문서의 체크리스트 구현
5. 테스트 실행
6. 트랙 문서의 Evidence 갱신

## Output Format (for each task)

- Status: `todo | doing | blocked | done`
- Diff scope: 변경 파일 경로
- Validation: 실행 명령 + 결과 한 줄
- Risk: 남은 리스크 한 줄

## Do Not

- `docs/` 전체를 통째로 프롬프트에 넣지 않는다.
- 상태 문서와 실제 코드가 다를 때 상태 문서를 신뢰하지 않는다.
- 트랙 문서 2개 이상을 동시에 진행하지 않는다.
