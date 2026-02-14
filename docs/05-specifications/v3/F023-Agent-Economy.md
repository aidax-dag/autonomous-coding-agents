# F023 - Agent Economy, Privacy, and Secure Collaboration

## 배경

단순 Skill 파일 공유는 중복/품질 편차/프라이버시 리스크가 크다. 목표는 "Skill 원문 판매"가 아니라 "Persona가 적용된 Agent 서비스 사용" 중심 경제를 만드는 것이다.

## 목표

1. 원격 Agent 호출 시장 지원
2. 사용량 기반 정산(x402)
3. 합의/에스크로/분쟁 추적 가능한 계약 모델
4. 프라이버시 보호와 악의적 행위 감사 가능성 확보

## 핵심 원칙

1. 원문 Skill은 공개하지 않는다.
2. 요청자는 명세와 수용 기준을 계약으로 먼저 제시한다.
3. 응답자는 예상 비용/검토 조건을 제시한다.
4. 양측 합의 후 에스크로 락을 걸고 실행한다.
5. 결과 검증 후 정산한다.

## 아키텍처 분리

### A. ACA Core (오케스트레이션)

- Ticket/Feature/MAL/A2A/MCP 실행 책임

### B. Agent Exchange Service (신규 프로젝트)

- Agent 등록/검색/평판/호출 라우팅
- Persona Agent의 서비스 엔드포인트 관리

### C. Economic Settlement Service (신규 프로젝트)

- x402 결제 연동
- escrow contract lifecycle
- on-chain proof anchoring

## 계약 프로토콜 (A2A-Economic Contract)

계약 단계:

1. `proposal`
2. `counter_proposal` (optional)
3. `accepted`
4. `escrow_locked`
5. `in_execution`
6. `delivered`
7. `verified`
8. `settled` / `disputed`

계약 필수 요소:

1. 작업 명세 해시
2. 수용 기준 해시
3. 가격/통화/결제 조건
4. 기한 및 타임아웃
5. 증빙 아티팩트 링크
6. 분쟁 해결 정책

## 프라이버시/보안

1. Agent 호출 데이터는 최소 공개 원칙 적용
2. 비식별 이벤트 로그 + 영지식/해시 앵커 방식 검토
3. 고유 Persona는 로컬/보안영역에서 관리하고 원문 export 금지 모드 지원
4. 악성 호출 차단을 위한 trust score + rate limit + policy denylist 적용

## 기술 메모

1. x402는 결제 채널로 사용하고, 실제 계약 상태 전이는 별도 상태머신으로 관리
2. 블록체인은 "모든 데이터 저장"이 아니라 "감사 가능한 핵심 증거 앵커"로 사용
3. A2A payload는 암호화 전송 + 서명 검증 필수

## 완료 기준

1. 원격 Agent 호출 시 선합의/에스크로/정산 플로우 동작
2. 호출/결과/정산에 대한 감사 추적 가능
3. Skill 원문 비공개 상태에서도 서비스 사용 가능
