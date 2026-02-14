# F027 - ACA Platform Final Definition (v1/v1.1 Scope Lock)

## 1. 문서 목적

이 문서는 ACA의 제품 정체성과 릴리스 경계를 최종 확정한다.
향후 기능 세분화(Epic -> Capability -> Feature -> Ticket)의 기준 문서로 사용한다.

## 2. 최종 한줄 정의

ACA는 티켓-게이트 기반으로 다수 Agent Client를 MAL Adapter로 통합 실행하고, 결과를 재사용 가능한 Feature 자산으로 축적하는 Agent Runtime Framework다.

## 3. 확정 결정사항 (Final)

1. v1 범위는 Builder 전용으로 고정한다.
2. Jira Adapter는 옵션으로 지원하되 v1.1 범위로 한다.
3. Remote Agent 신뢰 모델은 Marketplace 등록 심사 시스템을 통해 확보한다.
4. Personal Agent는 설계만 선행하고 구현은 로드맵 후속으로 둔다.

## 4. 제품 정체성

ACA는 단일 Agent나 단순 클라이언트가 아니라 플랫폼이다.

플랫폼 구성:

1. Runtime Kernel (티켓 워크사이클/상태머신/스케줄러)
2. MAL/HAL (Agent Adapter 추상화)
3. System Services (IPC/Network/Policy/Cost/Trace/Debug)
4. Framework APIs (상위 오케스트레이터 호출 계층)
5. Interfaces (CLI/Web/API)

## 5. 제품 라인 전략

### 5.1 Line A - ACA Builder (Primary, v1)

목표:
- Product building 자동화
- Feature 자산 재사용으로 시간/토큰 절감

핵심 범위:
- Ticket gate cycle
- MAL 기반 멀티 Agent 실행
- Feature catalog 운영
- 로깅/추적/디버깅/비용 통제

### 5.2 Line B - ACA Personal Agent (Design-only)

목표:
- 일정/메시지/콘텐츠/보안 대응 등 사용자 대리 작업

v1/v1.1 범위:
- 설계 문서만 작성
- 구현/배포는 후속 로드맵 단계로 이관

## 6. 핵심 아키텍처 원칙

1. 상위 레이어는 Agent 종류를 몰라야 한다(완전 추상화).
2. 로컬/원격 Agent 차이는 Adapter 내부에서만 처리한다.
3. 모든 실행은 Ticket 단위의 atomic job으로 쪼갠다.
4. 장기 작업은 tmux 기반 job lifecycle로 관리한다.
5. 상태 전이/명령/응답/비용/오류를 추적 가능하게 기록한다.

## 7. 필수 포함 기능 (Must-have)

1. Capability Registry
- Agent별 성능/비용/제약/전문화 메타데이터 등록

2. Scheduler + QoS
- 우선순위, 병렬도, 타임아웃, 재시도, 취소

3. Reliability Layer
- idempotency key, retry/backoff, circuit breaker

4. Replay Debugger
- 실행 trace 기반 재현/분석

5. Policy Engine
- 보안/비용/데이터 반출/권한 정책 강제

6. Cost Governor
- 예산 초과 시 모델/에이전트 fallback

7. IPC Manager + Network Manager
- 프로세스 통신 + 네트워크 상태 기반 동작 전략

8. Message History Tracking
- 검색 가능한 요청/응답/이벤트 히스토리

## 8. 티켓 시스템 정책 (Provider)

1. 내부 Ticket 모델이 Source of Truth다.
2. Provider는 Adapter 방식으로 연결한다.
3. 기본 Provider는 GitHub로 한다.
4. Jira는 옵션 Provider로 v1.1에서 지원한다.
5. 민감정보는 내부 저장, 외부에는 요약/참조 중심 동기화 원칙을 적용한다.

## 9. Remote Agent 신뢰 모델 정책

Remote Agent 호출은 Marketplace 심사 기반 신뢰 모델을 전제로 한다.

심사 기준(초안):

1. 신원/소유권 검증
2. Adapter 계약 적합성(CTS)
3. 보안/정책 위반 검사
4. 성능/품질/오류율 기준
5. 로그/감사 가능성

심사 통과 후에만 신뢰 등급을 부여하고, 호출 허용 범위를 정책으로 제어한다.

## 10. 릴리스 경계

### 10.1 v1 (Builder only)

포함:
- MAL core + local agent adapters
- Ticket gate cycle
- Feature catalog core
- IPC/Network/Trace/Debug/Cost 기초 계층
- GitHub provider adapter

제외:
- Jira provider
- Remote agent trust registry production 운영
- Personal agent 구현

### 10.2 v1.1

추가:
- Jira provider adapter (선택형)
- provider 정책/동기화 모드 고도화

### 10.3 v2+ (Roadmap)

후속:
- Marketplace 기반 remote trust system 운영 적용
- Personal agent 구현 단계 착수

## 11. 운영 방법론/게이트 규칙

고정 사이클:

요구사항 -> 기능정의 -> 설계 -> 스펙정의 -> 구현 -> 테스트 -> 결과정리 및 분석 -> 새로운 요구사항 업데이트

강제 게이트:

요구사항/기능정의/설계/스펙정의 승인 전 구현 금지.

## 12. 성공 지표 (v1/v1.1)

1. Ticket 리드타임 단축
2. Feature 재사용률 증가
3. 티켓당 토큰/비용 절감
4. 병렬 작업 성공률/복구율
5. 정책 위반 0건 목표

## 13. 연계 문서

1. `docs/05-specifications/v3/F021-MAL.md`
2. `docs/05-specifications/v3/F022-Ticket-Feature-Cycle.md`
3. `docs/05-specifications/v3/F025-Feature-Management-Service.md`
4. `docs/05-specifications/v3/F026-Ticket-Feature-Runtime-and-MCP-Enforcement.md`
5. `docs/06-roadmap/tasks/TASK2_EPIC_CAPABILITY_FEATURE_TICKET_TREE.md`

## 14. 상태

- 상태: Finalized for planning
- 작성일: 2026-02-15
