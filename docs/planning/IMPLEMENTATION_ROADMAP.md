# Implementation Roadmap: Agent OS 진화 계획

## 현재 상태 분석

### 보유 자산
```
✅ 구현 완료:
├── TaskDecomposer: PRD → 태스크 분해
├── ProjectStore: 프로젝트 상태 관리 (FileSystem/Memory)
├── Daemon: 24/7 실행 루프
├── CompletionDetector: 품질 게이트 평가
├── AutonomousRunner: 통합 오케스트레이터
├── Tool System: 50+ 도구 (File, Git, Shell, LSP, AST)
├── Agent Types: 9개 정의 (구현 미완)
└── CLI: 기본 명령어

⚠️ 부분 구현:
├── LLM 클라이언트: API 방식만 (CLI 미지원)
├── Agent Factory: 인터페이스만 정의
├── Quality Checks: Mock 반환
└── MCP Integration: 구조만 존재

❌ 미구현:
├── CLI LLM 클라이언트 (claude, codex, gemini)
├── 팀 에이전트 시스템
├── 문서 기반 작업 큐
├── 팀 간 통신 프로토콜
├── 실시간 품질 측정
└── 지식 관리 시스템
```

---

## Phase 1: CLI LLM Integration (우선순위: 긴급)

### 1.1 Base CLI Client 구현
```
파일: src/shared/llm/cli/base-cli-client.ts

작업:
├── [ ] BaseCLIClient 추상 클래스 생성
│   ├── executeCommand(args, input): Promise<string>
│   ├── parseResponse(output): LLMCompletionResult
│   └── buildArgs(messages, options): string[]
│
├── [ ] CLI 실행 유틸리티
│   ├── spawn wrapper with timeout
│   ├── stdout/stderr 처리
│   └── signal handling (SIGTERM, SIGINT)
│
├── [ ] 에러 타입 정의
│   ├── CLINotFoundError
│   ├── CLIAuthenticationError
│   ├── CLITimeoutError
│   └── CLIRateLimitError
│
└── [ ] CLI 가용성 검사
    ├── which <cli> 확인
    ├── 버전 파싱
    └── 인증 상태 확인

테스트:
├── tests/unit/shared/llm/cli/base-cli-client.test.ts
└── Mock CLI 실행 테스트
```

### 1.2 Claude CLI Client
```
파일: src/shared/llm/cli/claude-cli-client.ts

작업:
├── [ ] ClaudeCLIClient 구현
│   ├── 명령어: claude -p --output-format json
│   ├── 시스템 프롬프트: --system-prompt
│   └── 모델 선택: --model
│
├── [ ] JSON 응답 파싱
│   ├── result 추출
│   ├── usage 매핑 (input_tokens, output_tokens)
│   └── error 처리 (is_error: true)
│
└── [ ] 스트리밍 지원 (선택)
    └── --output-format stream-json

검증:
├── [ ] echo "test" | claude -p --output-format json
├── [ ] 시스템 프롬프트 동작 확인
└── [ ] 에러 응답 처리 확인
```

### 1.3 Codex CLI Client
```
파일: src/shared/llm/cli/codex-cli-client.ts

작업:
├── [ ] CodexCLIClient 구현
│   ├── 명령어: codex exec --json
│   └── 모델 선택: -m/--model
│
├── [ ] JSONL 파싱 (이벤트 스트림)
│   ├── thread.started → session_id 추출
│   ├── item.completed (type=agent_message) → 응답 추출
│   └── turn.completed → usage 추출
│
└── [ ] 에러 처리
    └── 인증 실패, 타임아웃 등

검증:
├── [ ] echo "test" | codex exec --json -
├── [ ] JSONL 파싱 정확도 확인
└── [ ] 긴 응답 처리 확인
```

### 1.4 Gemini CLI Client
```
파일: src/shared/llm/cli/gemini-cli-client.ts

작업:
├── [ ] GeminiCLIClient 구현
│   ├── 명령어: gemini -o json "query"
│   └── 모델 선택: -m/--model
│
├── [ ] JSON 응답 파싱
│   ├── response 추출
│   └── stats.models.<model>.tokens 매핑
│
└── [ ] stdin 입력 지원

검증:
├── [ ] gemini -o json "test"
└── [ ] 복잡한 프롬프트 테스트
```

### 1.5 Ollama Client
```
파일: src/shared/llm/cli/ollama-client.ts

작업:
├── [ ] OllamaClient 구현 (REST API)
│   ├── 엔드포인트: POST /api/generate
│   ├── 모델 선택 필수
│   └── 스트리밍: stream: true/false
│
├── [ ] 서버 상태 확인
│   ├── GET /api/tags (모델 목록)
│   └── 서버 미실행 시 에러 처리
│
└── [ ] 응답 파싱
    ├── response 추출
    └── prompt_eval_count, eval_count 매핑

검증:
├── [ ] ollama serve 실행 상태 확인
├── [ ] 설치된 모델로 테스트
└── [ ] 스트리밍 테스트
```

### 1.6 Provider 통합
```
파일: src/shared/llm/index.ts, src/core/runner/autonomous-runner.ts

작업:
├── [ ] LLMProvider 타입 확장
│   └── 'claude-cli' | 'codex-cli' | 'gemini-cli' | 'ollama'
│
├── [ ] createLLMClient 팩토리 수정
│   └── CLI provider 분기 추가
│
└── [ ] CLI 옵션 확장
    ├── --provider claude-cli
    ├── --provider codex-cli
    ├── --provider gemini-cli
    └── --provider ollama

검증:
├── [ ] runner create prd.md -p claude-cli -v
├── [ ] runner create prd.md -p codex-cli -v
├── [ ] runner create prd.md -p ollama -m llama3 -v
└── [ ] E2E 테스트 전체 통과
```

---

## Phase 2: Team Agent System

### 2.1 Team 기본 구조
```
파일: src/core/teams/

작업:
├── [ ] BaseTeam 추상 클래스
│   ├── team metadata (name, type, agents)
│   ├── inbox/outbox 관리
│   ├── 작업 처리 루프
│   └── 팀 간 통신 인터페이스
│
├── [ ] TeamRegistry
│   ├── 팀 등록/조회
│   └── 팀 타입별 관리
│
├── [ ] TeamType enum
│   ├── PLANNING
│   ├── DESIGN
│   ├── DEVELOPMENT
│   ├── QA
│   ├── INFRASTRUCTURE
│   ├── CODE_QUALITY
│   └── ISSUE_RESPONSE
│
└── [ ] 팀 설정 스키마
    └── config/teams.yaml
```

### 2.2 문서 기반 작업 시스템
```
파일: src/core/workspace/

작업:
├── [ ] WorkspaceManager
│   ├── 디렉토리 구조 초기화
│   ├── inbox/outbox/in-progress 관리
│   └── 파일 감시 (watch)
│
├── [ ] TaskDocument 스키마
│   ├── 메타데이터 필드
│   ├── 컨텍스트 섹션
│   ├── 작업 로그
│   └── 결과물 섹션
│
├── [ ] DocumentQueue
│   ├── publish(team, task)
│   ├── subscribe(team, handler)
│   └── acknowledge(taskId)
│
└── [ ] TaskDocumentParser
    ├── Markdown 파싱
    └── YAML 프론트매터 처리
```

### 2.3 핵심 팀 구현
```
Planning Team:
├── [ ] PlanningTeam 클래스
├── [ ] ProductAnalystAgent
├── [ ] UserStoryWriterAgent
└── [ ] AcceptanceCriteriaAgent

Development Team:
├── [ ] DevelopmentTeam 클래스
├── [ ] FrontendTeam (하위)
│   ├── ComponentDeveloperAgent
│   └── StateManagerAgent
└── [ ] BackendTeam (하위)
    ├── APIDeveloperAgent
    └── BusinessLogicAgent

QA Team:
├── [ ] QATeam 클래스
├── [ ] TestPlannerAgent
├── [ ] TestWriterAgent
└── [ ] E2ETesterAgent

Code Quality Team:
├── [ ] CodeQualityTeam 클래스
├── [ ] CodeReviewerAgent
├── [ ] RefactorerAgent
└── [ ] TechDebtTrackerAgent
```

### 2.4 워크플로우 엔진
```
파일: src/core/workflow/

작업:
├── [ ] WorkflowEngine
│   ├── YAML 워크플로우 파싱
│   ├── 단계 실행 관리
│   └── 조건부 분기 처리
│
├── [ ] WorkflowDefinition 스키마
│   ├── trigger
│   ├── steps[]
│   └── conditions
│
└── [ ] WorkflowExecutor
    ├── 순차 실행
    ├── 병렬 실행
    └── 에러 처리/롤백
```

---

## Phase 3: Quality & Intelligence

### 3.1 실제 품질 측정 구현
```
현재 Mock 함수들 실제 구현:

├── [ ] checkTestCoverage()
│   ├── Jest/Vitest 커버리지 리포트 파싱
│   ├── 라인/브랜치/함수 커버리지
│   └── 임계값 설정
│
├── [ ] checkCodeQuality()
│   ├── ESLint 결과 파싱
│   ├── 복잡도 계산 (cyclomatic)
│   └── 코드 스멜 감지
│
├── [ ] checkDocumentation()
│   ├── JSDoc/TSDoc 커버리지
│   ├── README 존재 여부
│   └── API 문서화 수준
│
├── [ ] checkSecurity()
│   ├── npm audit 결과
│   ├── OWASP 체크리스트
│   └── secrets 감지
│
└── [ ] checkPerformance()
    ├── 번들 사이즈
    ├── 빌드 시간
    └── 런타임 벤치마크
```

### 3.2 메트릭 시스템
```
파일: src/core/metrics/

작업:
├── [ ] MetricsCollector
│   ├── 실시간 메트릭 수집
│   ├── 시계열 저장
│   └── 집계 쿼리
│
├── [ ] QualityDashboard
│   ├── 프로젝트 점수 계산
│   ├── 트렌드 분석
│   └── 리포트 생성
│
└── [ ] AlertSystem
    ├── 품질 임계값 알림
    └── 진행 상황 알림
```

### 3.3 지식 관리 시스템
```
파일: src/core/knowledge/

작업:
├── [ ] KnowledgeStore
│   ├── 아키텍처 결정 기록 (ADR)
│   ├── 코드 패턴 저장
│   └── 학습된 교훈
│
├── [ ] PatternMatcher
│   ├── 유사 문제 검색
│   └── 해결책 추천
│
└── [ ] VectorDB 통합 (선택)
    ├── 임베딩 생성
    └── 시맨틱 검색
```

---

## Phase 4: Agent OS 커널

### 4.1 고급 스케줄러
```
작업:
├── [ ] PriorityScheduler
├── [ ] FairShareScheduler
├── [ ] DeadlineScheduler
└── [ ] CostAwareScheduler
```

### 4.2 리소스 관리
```
작업:
├── [ ] LLM 쿼타 관리
├── [ ] 비용 추적
├── [ ] 토큰 예산
└── [ ] 프로바이더 로드밸런싱
```

### 4.3 보안 모듈
```
작업:
├── [ ] 권한 시스템
├── [ ] 샌드박싱
├── [ ] 감사 로깅
└── [ ] 시크릿 관리
```

---

## 우선순위 작업 목록 (즉시 시작)

### 이번 주
```
1. [ ] BaseCLIClient 구현 (2시간)
2. [ ] ClaudeCLIClient 구현 (2시간)
3. [ ] CodexCLIClient 구현 (2시간)
4. [ ] GeminiCLIClient 구현 (1시간)
5. [ ] OllamaClient 구현 (1시간)
6. [ ] Provider 통합 및 CLI 옵션 (2시간)
7. [ ] 단위 테스트 작성 (2시간)
8. [ ] E2E 검증 (2시간)
```

### 다음 주
```
1. [ ] BaseTeam 추상 클래스
2. [ ] WorkspaceManager
3. [ ] TaskDocument 스키마
4. [ ] DocumentQueue
5. [ ] PlanningTeam 프로토타입
6. [ ] DevelopmentTeam 프로토타입
```

### 이번 달
```
1. [ ] 전체 팀 구조 완성
2. [ ] 워크플로우 엔진
3. [ ] 실제 품질 측정 구현
4. [ ] 메트릭 대시보드
```

---

## 검증 체크리스트

### Phase 1 검증
```
CLI LLM Integration:
├── [ ] claude-cli: runner create + run 성공
├── [ ] codex-cli: runner create + run 성공
├── [ ] gemini-cli: runner create + run 성공
├── [ ] ollama: runner create + run 성공
├── [ ] 에러 처리: CLI 미설치 시 적절한 메시지
├── [ ] 에러 처리: 인증 실패 시 적절한 메시지
├── [ ] 에러 처리: Rate limit 시 재시도
└── [ ] 전체 테스트 스위트 통과
```

### Phase 2 검증
```
Team System:
├── [ ] 팀 생성 및 등록
├── [ ] 작업 문서 생성
├── [ ] inbox/outbox 흐름
├── [ ] 팀 간 작업 전달
├── [ ] 워크플로우 실행
└── [ ] 전체 프로젝트 흐름 완주
```

### Phase 3 검증
```
Quality System:
├── [ ] 테스트 커버리지 측정 정확도
├── [ ] 코드 품질 점수 계산
├── [ ] 품질 게이트 통과/실패
├── [ ] 대시보드 데이터 표시
└── [ ] 알림 시스템 동작
```

---

## 기술 부채 해결

### 높은 우선순위
```
1. [ ] Mock 품질 체크 함수들 실제 구현
2. [ ] Agent 인터페이스 구현체 완성
3. [ ] MCP 통합 완료
4. [ ] 에러 복구 로직 강화
```

### 중간 우선순위
```
1. [ ] 스토리지 쿼리 최적화
2. [ ] 로깅 구조화 (structured logging)
3. [ ] 성능 프로파일링
4. [ ] 메모리 누수 점검
```

### 낮은 우선순위
```
1. [ ] 코드 문서화 보완
2. [ ] 예제 프로젝트 추가
3. [ ] 설치 가이드 작성
4. [ ] 기여 가이드 작성
```

---

## 성공 지표

### 단기 (1개월)
- CLI LLM 4종 모두 동작
- 간단한 PRD로 E2E 실행 성공
- 테스트 커버리지 80% 이상

### 중기 (3개월)
- 핵심 팀 4개 동작
- 워크플로우 자동화 구현
- 실제 품질 측정 동작
- 중간 복잡도 프로젝트 자율 완성

### 장기 (6개월)
- 전체 팀 구조 완성
- Agent OS 커널 기능 구현
- 복잡한 프로젝트 90% 자율 완성
- 인간 개입 최소화 달성
