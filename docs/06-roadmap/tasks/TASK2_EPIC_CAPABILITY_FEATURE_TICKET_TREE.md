# Task 2 - Epic -> Capability -> Feature -> Ticket Tree (Final Scope Based)

> 기준 문서: `docs/05-specifications/v3/F027-ACA-Platform-Final-Definition.md`

## 0. 범위 고정

1. v1: Builder only
2. v1.1: Jira adapter 추가 (옵션)
3. Remote trust model: Marketplace 심사 시스템 완성 시 운영 적용
4. Personal Agent: 설계만 진행, 구현은 후속 로드맵

## 1. 트리 구조 규칙

1. Epic: 제품 가치 단위
2. Capability: Epic을 구성하는 플랫폼 역량
3. Feature: Capability를 구현 가능한 기능 단위로 분해한 항목
4. Ticket: 실제 수행 가능한 atomic 작업 단위

---

## E01. MAL Core & Adapter SDK (v1)

### C01. MAL 추상화 계약

Feature:

1. F0101 AgentEndpoint 표준 계약 (`submit/status/cancel/result`)
2. F0102 Adapter lifecycle 계약 (`init/health/shutdown`)

Tickets:

1. T0101 MAL contract interface 초안 작성
2. T0102 contract schema(JSON) 정의
3. T0103 contract validation test 작성

### C02. Adapter SDK

Feature:

1. F0103 Adapter SDK 기본 클래스
2. F0104 Adapter capability registration

Tickets:

1. T0104 AdapterBase 구현
2. T0105 CapabilityRegistry 연동
3. T0106 Adapter SDK 문서/샘플 작성

### C03. Local Agent Adapters

Feature:

1. F0105 Claude adapter
2. F0106 Codex adapter
3. F0107 Gemini adapter
4. F0108 Ollama adapter

Tickets:

1. T0107 Claude adapter MVP
2. T0108 Codex adapter MVP
3. T0109 Gemini adapter MVP
4. T0110 Ollama adapter MVP
5. T0111 공통 adapter integration test

---

## E02. Runtime Kernel (v1)

### C04. Ticket Workflow Engine

Feature:

1. F0201 상태머신 + 게이트 엔진
2. F0202 Planner/Executor/Reviewer role pipeline

Tickets:

1. T0201 상태 전이 정책 확정
2. T0202 gate validation 모듈 구현
3. T0203 role-based assignment 구현

### C05. Job Scheduler & Queue

Feature:

1. F0203 우선순위 큐
2. F0204 병렬 실행 제어

Tickets:

1. T0204 queue model 구현
2. T0205 priority/QoS 룰 구현
3. T0206 cancel/pause/resume 처리

### C06. tmux Job Lifecycle

Feature:

1. F0205 장기 작업 세션 관리
2. F0206 재시작 후 세션 복구

Tickets:

1. T0207 tmux session manager 구현
2. T0208 session checkpoint 저장/복구
3. T0209 장애 복구 시나리오 테스트

---

## E03. IPC & Network Services (v1)

### C07. IPC Manager

Feature:

1. F0301 프로세스 통신 채널 관리
2. F0302 request/response correlation

Tickets:

1. T0301 IPC envelope schema 정의
2. T0302 correlation-id 기반 라우팅 구현
3. T0303 IPC timeout/abort 처리

### C08. Network Manager

Feature:

1. F0303 네트워크 상태 감지
2. F0304 상태 기반 동작 전환 전략

Tickets:

1. T0304 network health probe 구현
2. T0305 degraded mode policy 적용
3. T0306 online/offline 전환 테스트

---

## E04. Reliability, Policy, Cost (v1)

### C09. Reliability Layer

Feature:

1. F0401 idempotency key
2. F0402 retry/backoff/circuit breaker

Tickets:

1. T0401 idempotency store 구현
2. T0402 retry policy engine 구현
3. T0403 circuit breaker 룰 구현

### C10. Policy Engine

Feature:

1. F0403 실행 정책 평가(보안/데이터/권한)
2. F0404 정책 위반 차단/보류

Tickets:

1. T0404 policy rule schema 정의
2. T0405 pre-execution policy check 구현
3. T0406 violation audit log 구현

### C11. Cost Governor

Feature:

1. F0405 예산/한도 관리
2. F0406 예산 초과 시 fallback 라우팅

Tickets:

1. T0407 budget ledger 구현
2. T0408 model/agent fallback 전략 구현
3. T0409 비용 리포트 API 추가

---

## E05. Observability, History, Debug (v1)

### C12. Message History Tracking

Feature:

1. F0501 요청/응답/상태 전이 히스토리 저장
2. F0502 검색/필터 조회

Tickets:

1. T0501 history event schema 정의
2. T0502 history store 구현
3. T0503 history query API 구현

### C13. Replay Debugger

Feature:

1. F0503 실행 trace 재현
2. F0504 실패 구간 분석 도구

Tickets:

1. T0504 trace recorder 구현
2. T0505 replay runner 구현
3. T0506 replay diff analyzer 구현

### C14. Monitoring Dashboard

Feature:

1. F0505 runtime health/queue/cost 시각화
2. F0506 ticket/job 진행 상태 시각화

Tickets:

1. T0507 runtime metrics API 정리
2. T0508 dashboard panels 추가
3. T0509 alert rule 초안 구성

---

## E06. Ticket Provider Adapters

### C15. GitHub Provider (v1)

Feature:

1. F0601 GitHub Issue/Project 동기화
2. F0602 내부 ticket 매핑 표준화

Tickets:

1. T0601 github mapper 구현
2. T0602 sync mode(push/pull) 구현
3. T0603 github sync integration test

### C16. Jira Provider (v1.1)

Feature:

1. F0603 Jira Issue/Workflow 동기화
2. F0604 내부 ticket 매핑 표준화

Tickets:

1. T0604 jira connector contract 정의
2. T0605 jira mapper 구현
3. T0606 jira sync integration test
4. T0607 provider option UI/API 반영

---

## E07. Feature Asset Platform (v1)

### C17. Feature Catalog Core

Feature:

1. F0701 feature 등록/조회/수정/상태 관리
2. F0702 라벨/옵션 기반 검색

Tickets:

1. T0701 feature CRUD 보완
2. T0702 labels/options filter 최적화
3. T0703 feature management summary 보강

### C18. Version & Reuse

Feature:

1. F0703 version history/rollback
2. F0704 usage tracking

Tickets:

1. T0704 version snapshot 정합성 검증
2. T0705 rollback 정책 테스트
3. T0706 usage telemetry 연동

---

## E08. Remote Agent Trust Integration (Roadmap)

### C19. Marketplace 심사 연동 전제

Feature:

1. F0801 심사 상태 조회 연동
2. F0802 신뢰 등급 기반 호출 정책

Tickets:

1. T0801 trust-grade contract 정의
2. T0802 trust policy evaluator 구현
3. T0803 미승인 remote agent 차단 룰

주의:
- Marketplace 심사 시스템이 먼저 제공되어야 운영 활성화.

---

## E09. Personal Agent (Design-only, Roadmap)

### C20. 설계 산출물

Feature:

1. F0901 Personal domain model
2. F0902 권한/동의/위험 정책 설계
3. F0903 Android-style agent runtime 확장 설계

Tickets:

1. T0901 personal architecture spec 작성
2. T0902 consent/risk policy spec 작성
3. T0903 rollout roadmap 문서화

제약:
- v1/v1.1에는 구현 티켓을 생성하지 않는다.

---

## 2. 릴리스 매핑

### v1 (Builder only)

포함 Epic:
- E01, E02, E03, E04, E05, E06(C15), E07

### v1.1

추가 Epic:
- E06(C16 Jira Provider)

### v2+

후속 Epic:
- E08(Remote Trust 운영)
- E09(Personal Agent 구현 전환 가능)

---

## 3. 진행 규칙

1. 티켓은 항상 게이트 순서를 따른다.
2. Feature는 재사용 가능성을 먼저 검토한다.
3. 정책/보안/비용/디버깅 요건 없는 기능은 완료 처리하지 않는다.
4. `changes_requested` 리뷰가 남아 있으면 완료 금지.

## 4. 상태

- 상태: Ready for ticket generation
- 작성일: 2026-02-15
