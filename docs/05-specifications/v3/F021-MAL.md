# F021 - Multi Agent Abstraction Layer (MAL)

## 배경

ACA는 이미 `claude-cli`, `codex-cli`, `gemini-cli` 실행 클라이언트를 보유하고 있으나(`src/shared/llm/cli/`), 현재 구조는 "LLM 호출 어댑터" 중심이다.

요구사항은 이를 넘어 다음을 필요로 한다.

1. 엔진 업데이트를 빠르게 추적할 수 있는 호환 계층
2. 도구 호출/세션/이벤트까지 포함한 IPC 표준화
3. 로컬/원격 Agent 모두 동일한 계약으로 실행

## 문제

현재는 다음 공백이 있다.

1. 엔진별 capability 협상 계층 부재
2. 엔진 업그레이드 영향도를 자동 진단하는 계약 테스트 부재
3. Ticket/Feature Cycle과 엔진 실행 계층 간 표준 이벤트 계약 부재

## 목표

1. 엔진 독립적 실행 계약 정의
2. 엔진 버전 변경 시 자동 적합성 검증
3. A2A/MCP/로컬 프로세스를 동일 인터페이스로 통합

## 아키텍처

### 1) MAL Control Plane

- 역할: 엔진 등록, capability 협상, 정책 적용, 라우팅
- 핵심 객체:
  - `EngineRegistry`
  - `CapabilityMatrix`
  - `ExecutionPolicy`
  - `CompatibilityGate`

### 2) Engine Adapter Layer

- `ClaudeCodeAdapter`
- `CodexAdapter`
- `GeminiCliAdapter`

공통 인터페이스:

- `startSession(context)`
- `executeTask(taskEnvelope)`
- `streamEvents(subscriber)`
- `invokeTool(toolCall)`
- `shutdownSession(sessionId)`

### 3) Transport Layer (IPC)

- Local process: stdio JSON-RPC + structured event stream
- Remote process: HTTP/SSE + signed request envelope
- A2A bridge: `src/core/protocols/a2a/`와 양방향 매핑
- MCP bridge: MCP tool/resource를 MAL Tool Contract로 매핑

### 4) Compatibility Pipeline

- 단계:
  1. 엔진 버전 감지
  2. Capability probe 실행
  3. Contract test 실행
  4. Pass 시 rollout, Fail 시 fallback

- 결과:
  - `compatible`
  - `degraded` (부분 기능)
  - `blocked` (업데이트 보류)

## 데이터 계약

### EngineCapability

- session resume 지원 여부
- plan/review 모드 지원 여부
- tool approval model
- sub-agent/task delegation model
- skill/prompt injection model
- cost/token telemetry granularity

### TaskExecutionEnvelope

- ticketId
- featureId(optional)
- personaProfileId
- acceptanceCriteria
- budgetCap(tokens, cost)
- auditContext(traceId, actor)

## 보안

1. Adapter는 raw shell 권한을 직접 가지지 않고 Policy Gateway를 통해 실행
2. 엔진별 credential은 Vault/Keyring으로 격리
3. Event payload는 PII/secret redaction 후 저장

## 구현 단계

1. `MAL-MVP`
   - 기존 `src/shared/llm/cli/*`를 Adapter contract로 래핑
   - Ticket 실행 이벤트 표준화
2. `MAL-Compat`
   - 엔진 버전 호환성 테스트 자동화
3. `MAL-Remote`
   - 원격 Agent endpoint 지원 + A2A 라우팅 연계

## 완료 기준

1. 동일 Ticket를 3개 엔진에서 같은 계약으로 실행 가능
2. 엔진 업데이트 시 CI 호환성 리포트 생성
3. 실패 시 fallback 정책 자동 동작
