# Priority Execution Plan: Agent OS 구현 우선순위

## 실행 우선순위 요약

### 긴급도 × 중요도 매트릭스

```
                        중요도 높음
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        │  [2] 팀 구조 기반  │  [1] CLI LLM 통합 │
        │      구축         │      (차단 해결)   │
        │                   │                   │
긴급도  ├───────────────────┼───────────────────┤ 긴급도
낮음    │                   │                   │ 높음
        │  [4] Agent OS     │  [3] 품질 측정    │
        │      커널         │      실제화       │
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                        중요도 낮음
```

---

## 권장 실행 순서

| 순위 | 작업 | 이유 | 예상 기간 |
|:---:|------|------|:--------:|
| **1** | CLI LLM 통합 | API 차단 문제 즉시 해결. 프로젝트 진행의 전제조건 | 1주 |
| **2** | 문서 기반 작업 큐 | 팀 시스템의 기반. 모든 팀 간 통신의 근간 | 1주 |
| **3** | BaseTeam + Planning Team | 첫 번째 팀. PRD → 태스크 분해 자동화 | 1주 |
| **4** | Development Team | 실제 코드 생성. 핵심 가치 전달 | 2주 |
| **5** | 품질 측정 실제화 | Mock → 실제 도구 연동. 신뢰성 확보 | 1주 |
| **6** | QA + Code Quality Team | 품질 보장. 완성도 향상 | 2주 |
| **7** | 워크플로우 엔진 | 팀 간 자동 조율. 효율성 극대화 | 1주 |
| **8** | 나머지 팀 + Agent OS | 고도화. 장기 비전 실현 | 2개월+ |

---

## 의존성 그래프

```
CLI LLM 통합 ─────────────────────────────────────────┐
     │                                                │
     ▼                                                │
문서 기반 작업 큐 ──────────────────────┐              │
     │                                 │              │
     ▼                                 │              │
BaseTeam 추상화 ──────────────────┐    │              │
     │                            │    │              │
     ├──► Planning Team ──────────┼────┼──► 워크플로우 엔진
     │         │                  │    │              │
     │         ▼                  │    │              │
     ├──► Development Team ───────┤    │              │
     │         │                  │    │              │
     │         ▼                  │    │              │
     └──► QA Team ────────────────┘    │              │
               │                       │              │
               ▼                       ▼              ▼
         품질 측정 실제화 ──────► Code Quality Team ──► Agent OS
```

---

## Phase 1: CLI LLM 통합 (우선순위 1)

### 목표
API Key 차단 문제를 해결하기 위해 구독 계정 기반 CLI 프로그램을 통한 LLM 연동 지원

### 지원 CLI

| CLI | 버전 | 명령어 | 출력 형식 |
|-----|------|--------|----------|
| claude | 2.1.4 | `claude -p --output-format json` | JSON |
| codex | 0.76.0 | `codex exec --json` | JSONL |
| gemini | 0.22.5 | `gemini -o json "query"` | JSON |
| ollama | 0.13.5 | REST API (localhost:11434) | JSON |

### 구현 파일 구조

```
src/shared/llm/cli/
├── index.ts                 # CLI 클라이언트 export
├── base-cli-client.ts       # 추상 기본 클래스
├── claude-cli-client.ts     # Claude CLI 구현
├── codex-cli-client.ts      # Codex CLI 구현
├── gemini-cli-client.ts     # Gemini CLI 구현
├── ollama-client.ts         # Ollama REST API 구현
└── errors.ts                # CLI 전용 에러 클래스

src/shared/llm/
├── index.ts                 # 통합 export (수정)
└── ...기존 파일들

tests/unit/shared/llm/cli/
├── base-cli-client.test.ts
├── claude-cli-client.test.ts
├── codex-cli-client.test.ts
├── gemini-cli-client.test.ts
└── ollama-client.test.ts
```

### 상세 작업 목록

#### 1.1 기반 구조
- [ ] `CLINotFoundError`, `CLIAuthenticationError`, `CLITimeoutError`, `CLIRateLimitError` 에러 클래스
- [ ] `BaseCLIClient` 추상 클래스
  - [ ] `executeCommand(args, input)` - CLI 실행 유틸리티
  - [ ] `parseResponse(output)` - 응답 파싱 (추상)
  - [ ] `buildArgs(messages, options)` - 인자 구성 (추상)
  - [ ] `checkAvailability()` - CLI 가용성 검사
- [ ] 타임아웃 처리
- [ ] 시그널 핸들링 (SIGTERM, SIGINT)

#### 1.2 Claude CLI Client
- [ ] `ClaudeCLIClient` 클래스 구현
- [ ] JSON 응답 파싱 (`result`, `usage`)
- [ ] 시스템 프롬프트 지원 (`--system-prompt`)
- [ ] 모델 선택 지원 (`--model`)
- [ ] 에러 응답 처리 (`is_error: true`)

#### 1.3 Codex CLI Client
- [ ] `CodexCLIClient` 클래스 구현
- [ ] JSONL 이벤트 스트림 파싱
- [ ] `agent_message` 이벤트에서 응답 추출
- [ ] `turn.completed` 이벤트에서 usage 추출
- [ ] 모델 선택 지원 (`-m/--model`)

#### 1.4 Gemini CLI Client
- [ ] `GeminiCLIClient` 클래스 구현
- [ ] JSON 응답 파싱 (`response`, `stats`)
- [ ] 모델 선택 지원 (`-m/--model`)
- [ ] stdin 입력 지원

#### 1.5 Ollama Client
- [ ] `OllamaClient` 클래스 구현 (REST API)
- [ ] 서버 상태 확인 (`GET /api/tags`)
- [ ] 생성 요청 (`POST /api/generate`)
- [ ] 스트리밍 지원 (`stream: true/false`)

#### 1.6 통합
- [ ] `LLMProvider` 타입 확장
- [ ] `createLLMClient` 팩토리 수정
- [ ] CLI 옵션 확장 (`--provider claude-cli` 등)
- [ ] 기존 테스트 호환성 유지

### 검증 체크리스트
- [ ] `runner create prd.md -p claude-cli -v` 성공
- [ ] `runner create prd.md -p codex-cli -v` 성공
- [ ] `runner create prd.md -p gemini-cli -v` 성공
- [ ] `runner create prd.md -p ollama -m llama3 -v` 성공
- [ ] CLI 미설치 시 적절한 에러 메시지
- [ ] 인증 실패 시 적절한 에러 메시지
- [ ] 전체 테스트 스위트 통과

---

## Phase 2: 문서 기반 작업 큐 (우선순위 2)

### 목표
팀 간 비동기 작업 전달을 위한 파일 시스템 기반 메시지 큐 구현

### 구현 파일 구조

```
src/core/workspace/
├── index.ts
├── workspace-manager.ts     # 워크스페이스 관리
├── document-queue.ts        # 문서 기반 큐
├── task-document.ts         # 작업 문서 스키마
└── task-document-parser.ts  # Markdown/YAML 파서

.agent-workspace/            # 런타임 워크스페이스
├── inbox/
│   ├── planning/
│   ├── design/
│   ├── development/
│   │   ├── frontend/
│   │   └── backend/
│   ├── qa/
│   └── support/
├── outbox/
├── in-progress/
├── knowledge/
└── metrics/
```

### 상세 작업 목록
- [ ] WorkspaceManager 클래스
- [ ] TaskDocument 스키마 (TypeScript + Zod)
- [ ] DocumentQueue (publish/subscribe/acknowledge)
- [ ] TaskDocumentParser (Markdown + YAML frontmatter)
- [ ] 파일 감시 (fs.watch)

---

## Phase 3: Team System (우선순위 3-4)

### 목표
팀 에이전트 시스템 구현 및 핵심 팀 배치

### 구현 파일 구조

```
src/core/teams/
├── index.ts
├── base-team.ts             # 팀 추상 클래스
├── team-registry.ts         # 팀 레지스트리
├── team-types.ts            # 팀 타입 enum
├── planning/
│   ├── planning-team.ts
│   └── agents/
├── development/
│   ├── development-team.ts
│   ├── frontend-team.ts
│   ├── backend-team.ts
│   └── agents/
├── qa/
│   ├── qa-team.ts
│   └── agents/
└── code-quality/
    ├── code-quality-team.ts
    └── agents/
```

---

## Phase 4-8: 후속 작업

### Phase 5: 품질 측정 실제화
- Mock 함수 → 실제 도구 연동
- Jest/Vitest 커버리지 파싱
- ESLint 결과 파싱
- npm audit 연동

### Phase 6: QA + Code Quality Team
- 테스트 자동 생성
- 코드 리뷰 자동화
- 리팩토링 제안

### Phase 7: 워크플로우 엔진
- YAML 워크플로우 정의
- 조건부 실행
- 병렬 실행

### Phase 8: Agent OS 커널
- 고급 스케줄러
- 리소스 관리
- 보안 모듈

---

## 마일스톤

| 시점 | 달성 목표 | 검증 방법 |
|------|----------|----------|
| **1주차** | CLI LLM 4종 동작 | `runner create -p claude-cli` 성공 |
| **2주차** | 문서 큐 동작 | inbox → outbox 흐름 확인 |
| **1개월** | Planning + Dev Team | PRD → 코드 자동 생성 |
| **2개월** | 전체 팀 + 품질 측정 | 품질 80% 프로젝트 완성 |
| **3개월** | 워크플로우 자동화 | 복잡 프로젝트 자율 완성 |
| **6개월** | Agent OS 완성 | 인간 개입 최소화 |

---

## 관련 문서

- [Agent OS Vision](./AGENT_OS_VISION.md) - 전체 비전 및 철학
- [CLI LLM Integration Plan](./CLI_LLM_INTEGRATION_PLAN.md) - CLI 통합 상세
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) - 구현 로드맵 상세
