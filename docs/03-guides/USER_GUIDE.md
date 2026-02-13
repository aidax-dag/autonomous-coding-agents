# 사용자 가이드

> Autonomous Coding Agents (ACA) 설치부터 사용까지

---

## 목차

1. [시스템 요구사항](#시스템-요구사항)
2. [설치](#설치)
3. [환경 설정](#환경-설정)
4. [빠른 시작](#빠른-시작)
5. [CLI 명령어](#cli-명령어)
6. [인터랙티브 모드](#인터랙티브-모드)
7. [설정 옵션](#설정-옵션)
8. [멀티모델 라우팅](#멀티모델-라우팅)
9. [LLM CLI 통합](#llm-cli-통합)
10. [트러블슈팅](#트러블슈팅)

---

## 시스템 요구사항

| 항목 | 최소 버전 |
|------|----------|
| Node.js | 20+ |
| npm | 10+ |
| Git | 2.x |
| OS | macOS, Linux, Windows (WSL) |

**LLM API 키** (하나 이상 필수):
- Anthropic (Claude) API Key
- OpenAI API Key
- Google Gemini API Key

---

## 설치

```bash
# 1. 저장소 클론
git clone https://github.com/aidax-dag/autonomous-coding-agents.git
cd autonomous-coding-agents

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 API 키와 GitHub 토큰 설정

# 4. 빌드
npm run build

# 5. CLI 전역 등록 (선택)
npm link
```

빌드 후 `multi-agent` 명령어를 사용할 수 있습니다.

---

## 환경 설정

### 필수 환경 변수

```bash
# LLM 프로바이더 (claude, openai, gemini 중 택 1)
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-xxx

# GitHub 설정
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=your-username
```

### 선택 환경 변수

```bash
# LLM 설정
LLM_MODEL=claude-sonnet-4-5-20250929   # 특정 모델 지정
LLM_MAX_TOKENS=4096                     # 최대 토큰 수
LLM_TEMPERATURE=0.7                     # 창의성 (0.0~1.0)

# 에이전트 설정
MAX_CONCURRENT_TASKS=3                  # 동시 실행 작업 수
MAX_CONCURRENT_FEATURES=3               # 동시 기능 구현 수
MAX_TURNS_PER_FEATURE=50                # 기능당 최대 턴 수
AGENT_TIMEOUT_MINUTES=240               # 에이전트 타임아웃 (분)
TASK_TIMEOUT=300000                     # 작업 타임아웃 (ms)

# 기능 플래그
ENABLE_VALIDATION=false                 # 검증 훅 활성화
ENABLE_LEARNING=false                   # 학습 기능 활성화
ENABLE_CONTEXT_MANAGEMENT=false         # 컨텍스트 최적화
USE_REAL_QUALITY_TOOLS=false            # 실제 품질 도구 사용

# 로깅
LOG_LEVEL=info                          # error | warn | info | debug
LOG_TO_FILE=true
LOG_DIR=./logs

# 작업 디렉토리
WORK_DIR=/tmp/autonomous-coding-agents
NODE_ENV=development
```

---

## 빠른 시작

### 1. 프로젝트 시작

```bash
multi-agent start-project \
  --repo https://github.com/myorg/my-app \
  --requirements "REST API로 사용자 관리 시스템 구현" \
  --priority high

# 출력: Task ID: task-1234567890-abc123
```

### 2. 상태 확인

```bash
multi-agent job-status task-1234567890-abc123
```

### 3. 실시간 모니터링

```bash
multi-agent interactive task-1234567890-abc123
```

### 4. 기능 추가

```bash
multi-agent submit-feature \
  --repo https://github.com/myorg/my-app \
  --title "비밀번호 재설정" \
  --description "이메일을 통한 비밀번호 재설정 기능" \
  --priority normal
```

---

## CLI 명령어

### start-project

새 자율 코딩 프로젝트를 시작합니다.

```bash
multi-agent start-project \
  --repo <repository-url> \
  --requirements "<요구사항>" \
  [--branch main] \
  [--priority normal|high|urgent]
```

### submit-feature

기존 프로젝트에 기능 요청을 제출합니다.

```bash
multi-agent submit-feature \
  --repo <repository-url> \
  --title "<제목>" \
  --description "<설명>" \
  [--requirements "req1,req2"] \
  [--priority normal]
```

### job-status

작업 상태를 조회합니다.

```bash
multi-agent job-status <task-id>

# 표시: Task ID, Status (PENDING/IN_PROGRESS/COMPLETED/FAILED),
# Priority, 타임스탬프, 결과/에러 상세
```

### list-jobs

모든 활성 작업을 목록 표시합니다.

```bash
multi-agent list-jobs [--status pending|in_progress|completed|failed] [--limit 10]
```

### analyze

코드를 분석합니다 (ESLint, TypeScript).

```bash
multi-agent analyze [directory] [--format text|markdown|json] [--output <file>]
```

### auto-fix

코드 이슈를 자동으로 수정하고 PR을 생성합니다.

```bash
multi-agent auto-fix --repo <path> --owner <name> --name <name> \
  [--branch main] [--no-pr] [--no-issue]
```

**필수**: `GITHUB_TOKEN` 환경 변수

### health

시스템 상태를 확인합니다.

```bash
multi-agent health [--url http://localhost:3000]
```

---

## 인터랙티브 모드

에이전트와 실시간으로 상호작용하며 작업을 모니터링합니다.

```bash
multi-agent interactive <task-id>
```

### 명령어

| 명령어 | 설명 |
|--------|------|
| `/help` | 도움말 표시 |
| `/status` | 현재 시스템 상태 확인 |
| `/pending` | 대기 중인 피드백 요청 확인 |
| `/respond <id> <choice> [msg]` | 에이전트 피드백에 응답 |
| `/pause` | 작업 일시 중지 |
| `/resume` | 작업 재개 |
| `/quit` | 인터랙티브 모드 종료 |

상세: [INTERACTIVE_MODE.md](./INTERACTIVE_MODE.md)

---

## 설정 옵션

프로그래밍 방식으로 설정할 수 있는 옵션입니다.

### LLM 설정

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `llm.provider` | string | `claude` | LLM 프로바이더 (`claude`, `openai`, `gemini`, `claude-cli`, `codex-cli`, `gemini-cli`, `ollama`) |
| `llm.anthropicApiKey` | string | - | Anthropic API 키 |
| `llm.openaiApiKey` | string | - | OpenAI API 키 |
| `llm.geminiApiKey` | string | - | Gemini API 키 |
| `llm.ollamaHost` | string | - | Ollama 호스트 URL |
| `llm.defaultModel` | string | - | 모델 오버라이드 |

### GitHub 설정

| 옵션 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `github.token` | string | O | GitHub Personal Access Token |
| `github.owner` | string | O | GitHub 사용자명/조직 |
| `github.repo` | string | - | 특정 저장소 지정 |

### 에이전트 설정

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `agent.autoMergeEnabled` | boolean | `false` | 자동 병합 |
| `agent.humanApprovalRequired` | boolean | `true` | 사람 승인 필요 |
| `agent.maxConcurrentFeatures` | number | `3` | 최대 동시 기능 수 |
| `agent.timeoutMinutes` | number | `240` | 에이전트 타임아웃 (분) |
| `agent.maxTurnsPerFeature` | number | `50` | 기능당 최대 턴 |

### 로깅 설정

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `logging.level` | string | `info` | 로그 레벨 (`error`, `warn`, `info`, `debug`) |
| `logging.toFile` | boolean | `true` | 파일 로그 활성화 |
| `logging.directory` | string | `./logs` | 로그 디렉토리 |

---

## 멀티모델 라우팅

여러 LLM을 에이전트 역할에 따라 자동으로 선택합니다.

### 활성화

```bash
ROUTING_ENABLED=true
ROUTING_BUDGET_LIMIT=50.00  # 비용 제한 (USD, 선택)
```

### 에이전트별 모델 매핑

설정 파일이나 환경 변수로 에이전트별 모델을 지정할 수 있습니다:

```json
{
  "routing": {
    "enabled": true,
    "defaultProfile": "balanced",
    "budgetLimit": 50.00,
    "agentModelMap": {
      "planning": "claude-sonnet-4-5-20250929",
      "development": "gpt-4o",
      "qa": "gemini-2.0-flash"
    }
  }
}
```

### 라우팅 전략

| 전략 | 설명 |
|------|------|
| Capability-based | 모델 능력에 따라 선택 |
| Complexity-based | 작업 복잡도에 따라 선택 |
| Cost-optimized | 비용 최적화 |
| Composite | 위 전략 가중 평균 (기본) |

---

## LLM CLI 통합

외부 LLM CLI 도구와 통합됩니다.

### 지원 CLI

| CLI | 최소 버전 | 설명 |
|-----|----------|------|
| claude | 2.1.4+ | Anthropic Claude CLI |
| codex | 0.76.0+ | OpenAI Codex CLI |
| gemini | 0.22.5+ | Google Gemini CLI |
| ollama | 0.13.5+ | 로컬 LLM (Ollama) |

### 사용법

```bash
# Claude CLI로 코드 생성
multi-agent generate --cli claude --prompt "REST API 생성"

# Codex CLI로 리팩토링
multi-agent refactor --cli codex --file src/app.ts

# Gemini CLI로 문서 생성
multi-agent docs --cli gemini --target ./src

# Ollama로 로컬 LLM 사용
multi-agent generate --cli ollama --model llama3 --prompt "테스트 생성"
```

### CLI 자동 선택 우선순위

1. `CODEAVENGERS_DEFAULT_CLI` 환경 변수
2. 설정 파일의 `defaultCli`
3. 설치된 CLI 순서: claude > codex > gemini > ollama

---

## 트러블슈팅

### API 키 오류

```
Error: Authentication failed
```

- `.env` 파일의 API 키가 유효한지 확인
- `LLM_PROVIDER`와 해당 API 키가 일치하는지 확인
- API 사용량 제한에 도달하지 않았는지 확인

### 빌드 오류

```bash
# TypeScript 오류 확인
npm run type-check

# 의존성 재설치
rm -rf node_modules && npm install

# 빌드
npm run build
```

### 에이전트 타임아웃

작업이 오래 걸리는 경우:

```bash
# 타임아웃 증가
AGENT_TIMEOUT_MINUTES=480
TASK_TIMEOUT=600000
```

### 로그 확인

```bash
# 로그 디렉토리 확인
ls -la ./logs/

# 최근 에러 로그 확인
grep "error" ./logs/*.log | tail -20
```

### 일반적인 문제

| 문제 | 해결책 |
|------|--------|
| `Module not found` | `npm install` 후 `npm run build` |
| `ECONNREFUSED` | 네트워크 연결 및 API 엔드포인트 확인 |
| 에이전트 응답 없음 | 로그 확인, API 키 유효성 검증 |
| 메모리 초과 | `MAX_CONCURRENT_TASKS` 줄이기 |
| 권한 오류 | `GITHUB_TOKEN` 스코프 확인 (repo, workflow) |

---

## 개발 모드 명령어

```bash
# 개발 모드 (자동 리로드)
npm run dev

# CLI 직접 실행 (빌드 없이)
npm run cli -- start-project --repo ...

# 테스트 실행
npm test

# 테스트 (감시 모드)
npm run test:watch

# 테스트 커버리지
npm run test:coverage

# 코드 린트
npm run lint

# 코드 포맷
npm run format
```

---

## 프로덕션 배포

프로덕션 환경 배포는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

**주요 프로덕션 설정 차이점:**

| 항목 | 개발 | 프로덕션 |
|------|------|----------|
| `NODE_ENV` | development | production |
| `LLM_TEMPERATURE` | 0.7 | 0.3 |
| `ENABLE_VALIDATION` | false | true |
| `ENABLE_LEARNING` | false | true |
| `USE_REAL_QUALITY_TOOLS` | false | true |
| `MAX_CONCURRENT_TASKS` | 1 | 5 |
| `LOG_LEVEL` | info | warn |

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [CLI_USAGE.md](./CLI_USAGE.md) | CLI 명령어 상세 |
| [INTERACTIVE_MODE.md](./INTERACTIVE_MODE.md) | 인터랙티브 모드 상세 |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 프로덕션 배포 |
| [TESTING.md](./TESTING.md) | 테스트 가이드 |
| [CODE_QUALITY.md](./CODE_QUALITY.md) | 코드 품질 표준 |
| [WEBHOOK_SETUP.md](./WEBHOOK_SETUP.md) | GitHub 웹훅 설정 |
| [OpenAPI 스펙](../api/openapi.yaml) | REST API 문서 |
