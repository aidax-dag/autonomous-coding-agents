# F024 - Program Roadmap (Multi-Project)

## 프로그램 구성

1. `Project A` - ACA Core v3
2. `Project B` - Agent Exchange Service
3. `Project C` - Economic Settlement Service
4. `Project D` - Agent Builder Studio

## Phase 0 - Foundation

기간: 2~4주

산출물:

1. MAL 계약 확정
2. Ticket/Feature 스키마 확정
3. A2A Economic Contract 스키마 확정
4. 위험 목록(법/보안/운영)과 완화 계획

## Phase 1 - ACA Core v3

기간: 4~8주

산출물:

1. MAL MVP (claude-code/codex/gemini-cli)
2. Ticket Cycle 강제 파이프라인
3. Feature Catalog v1
4. GitHub/Jira Connector v1

성공 지표:

1. Ticket 완료 리드타임 30% 단축
2. 재사용 Feature 적용률 40% 이상
3. 반복 구현 토큰 25% 절감

## Phase 2 - Remote Agent Exchange

기간: 4~6주

산출물:

1. Agent 등록/검색/호출 API
2. Persona Agent 배포/버전 관리
3. 평판/품질 지표 수집

성공 지표:

1. 원격 Agent 호출 성공률 95%+
2. SLA 위반율 5% 미만

## Phase 3 - Economic Settlement

기간: 6~10주

산출물:

1. x402 연동 결제 게이트
2. escrow state machine
3. on-chain proof anchoring
4. 분쟁 처리 워크플로우

성공 지표:

1. 정산 자동화율 90%+
2. 분쟁 처리 평균 시간 목표치 달성

## Phase 4 - Agent Builder Studio

기간: 6~10주

산출물:

1. Persona Agent 설계 도구
2. 테스트/평가/배포 파이프라인
3. 정책 기반 공개 범위 제어

성공 지표:

1. 신규 Agent 생성 리드타임 50% 절감
2. 재사용 가능한 Persona 템플릿 증가

## 운영 원칙

1. 스펙 우선(문서 + 스키마 + 계약 테스트)
2. Ticket 우선(작업은 모두 Ticket 단위)
3. 검증 우선(완료 전 자동+리뷰 게이트)
4. 재사용 우선(완료물은 Feature로 축적)
