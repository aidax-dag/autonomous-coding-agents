# F022 - Ticket/Feature Working Cycle

## 배경

요구사항의 핵심은 "모든 작업을 Ticket 기반으로 추적 가능하게 수행"하고, 결과를 Feature 자산으로 축적해 재사용함으로써 시간/토큰 비용을 절감하는 것이다.

ACA는 이미 문서 기반 Task Queue(`src/core/workspace/`)를 갖고 있으므로, 이를 Ticket 시스템으로 확장한다.

## 목표

1. Ticket 필수 필드 강제
2. Planner/Executor/Reviewer 분리
3. 검증 게이트 통과 후에만 완료
4. 산출물 링크와 재사용 가능한 Feature 등록 자동화

## Ticket 필수 필드

각 Ticket는 아래를 필수로 가진다.

1. 배경
2. 문제점
3. 상세 작업 설명
4. 기대 결과물
5. 검증 방법 및 조건
6. 생성 시각
7. 상태

상태 enum:

- `created`
- `in_progress`
- `pending`
- `reviewing`
- `completed`
- `cancelled`

추가 추적 필드:

- 실행 시작/종료 시각
- 실행 Agent
- 결과물 링크 목록
- 이슈/리스크 로그
- 리뷰어별 판정(`approved`/`changes_requested`)

## Working Cycle

1. Ticket 생성(Planner Agent)
2. Ticket 할당/수행(Executor Agent)
3. 검증 자동화(Test/Lint/Security/Spec)
4. 리뷰 단계(Review Agents + Human optional)
5. 완료 또는 수정 재진입

## Planner vs Executor 분리

1. Planner는 구현자가 문맥을 정확히 이해할 수 있는 수준으로 명세 작성
2. Executor는 명세 기반으로 실행 로그/산출물/이슈를 업데이트
3. Planner와 Executor는 동일 Agent일 수도 있으나 기본 정책은 분리

## Feature화 규칙

Ticket 완료 시 조건 충족하면 Feature Catalog에 등록한다.

조건:

1. 재사용 가능한 산출물 존재
2. 사용법 문서 존재
3. 검증 체크리스트와 통과 근거 존재

등록 메타데이터:

- feature title
- background/problem
- requirement/constraints
- artifacts
- usage guide
- labels/options
- version
- review status

## 외부 티켓 시스템 연동

연결 대상:

1. GitHub Projects / Issues
2. Jira

Connector 표준 동작:

1. 외부 티켓 -> 내부 `ticket.schema.json` 정규화
2. 내부 상태 변경 -> 외부 상태 양방향 동기화
3. 검증/리뷰 코멘트 자동 반영

## 자동화 Agent 역할

1. `TicketPlannerAgent`
2. `TicketExecutorAgent`
3. `TicketVerifierAgent`
4. `TicketReviewerAgent`
5. `FeatureRegistrarAgent`

## 완료 기준

1. Ticket의 필수 필드 누락 시 생성 차단
2. 검증 조건 미충족 시 완료 차단
3. 완료 Ticket 중 재사용 가능 건은 Feature Catalog에 자동 등록
4. GitHub/Jira 상태와 내부 상태 일치율 99% 이상
