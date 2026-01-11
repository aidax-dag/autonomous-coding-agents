# CLI LLM Integration Plan

## 1. 개요

### 1.1 목적
기존 API Key 방식 외에 CLI 프로그램(claude, gemini, ollama)을 통한 LLM 연동 지원

### 1.2 배경
- API Key: 별도 발급, 사용량 과금, Rate Limit 엄격
- CLI: 구독 계정 인증, 구독료 포함, Rate Limit 여유

### 1.3 지원 CLI 현황

| CLI | 버전 | Non-Interactive | Output Format | 상태 |
|-----|------|-----------------|---------------|------|
| claude | 2.1.4 | `-p/--print` | json, stream-json, text | ✅ 검증완료 |
| gemini | 0.22.5 | positional query | json, stream-json, text | ✅ 검증완료 |
| ollama | 0.13.5 | REST API (localhost:11434) | json | ✅ 검증완료 |
| openai | 2.14.0 | API wrapper만 제공 | - | ❌ CLI 인증 미지원 |

---

## 2. CLI 출력 형식 분석

### 2.1 Claude CLI (`claude -p --output-format json`)
```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "result": "응답 내용",
  "session_id": "uuid",
  "total_cost_usd": 0.55,
  "usage": {
    "input_tokens": 2,
    "output_tokens": 5,
    "cache_creation_input_tokens": 50792,
    "cache_read_input_tokens": 13895
  }
}
```

### 2.2 Gemini CLI (`gemini -o json "query"`)
```json
{
  "session_id": "uuid",
  "response": "응답 내용",
  "stats": {
    "models": {
      "gemini-2.5-flash-lite": {
        "tokens": {
          "input": 3296,
          "candidates": 55,
          "total": 3481
        }
      }
    }
  }
}
```

### 2.3 Ollama REST API (`POST /api/generate`)
```json
{
  "model": "llama3",
  "response": "응답 내용",
  "done": true,
  "total_duration": 5000000000,
  "prompt_eval_count": 10,
  "eval_count": 50
}
```

---

## 3. 아키텍처 설계

### 3.1 Provider 확장

```typescript
// 기존
type LLMProvider = 'claude' | 'openai' | 'gemini' | 'mock';

// 확장
type LLMProvider =
  // API Key 방식
  | 'claude' | 'openai' | 'gemini'
  // CLI 방식
  | 'claude-cli' | 'gemini-cli' | 'ollama'
  // 테스트
  | 'mock';
```

### 3.2 클래스 구조

```
src/shared/llm/
├── base-client.ts          # 기존 BaseLLMClient (API)
├── claude-client.ts        # Claude API
├── openai-client.ts        # OpenAI API
├── gemini-client.ts        # Gemini API
├── cli/                    # 새로 추가
│   ├── base-cli-client.ts  # BaseCLIClient (공통 로직)
│   ├── claude-cli-client.ts
│   ├── gemini-cli-client.ts
│   └── ollama-cli-client.ts
└── index.ts                # 통합 export
```

### 3.3 BaseCLIClient 인터페이스

```typescript
abstract class BaseCLIClient implements ILLMClient {
  protected abstract readonly cliCommand: string;
  protected abstract readonly outputFormat: string;

  // 공통 기능
  protected async executeCommand(args: string[], input?: string): Promise<string>;
  protected abstract parseResponse(output: string): LLMCompletionResult;
  protected abstract buildArgs(messages: LLMMessage[], options?: LLMCompletionOptions): string[];

  // ILLMClient 구현
  async chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult>;
  async chatStream(messages: LLMMessage[], callback: LLMStreamCallback, options?: LLMCompletionOptions): Promise<LLMCompletionResult>;
}
```

---

## 4. 구현 계획

### Phase 1: 기반 구조 (1단계)

#### 4.1.1 BaseCLIClient 구현
- [ ] CLI 실행 유틸리티 (spawn, exec wrapper)
- [ ] 타임아웃 처리
- [ ] 에러 핸들링 (CLI not found, auth error, etc.)
- [ ] 스트리밍 출력 처리

#### 4.1.2 CLI 가용성 검사
```typescript
interface CLIAvailability {
  available: boolean;
  version?: string;
  authenticated?: boolean;
  error?: string;
}

async function checkCLIAvailability(cli: 'claude' | 'gemini' | 'ollama'): Promise<CLIAvailability>;
```

### Phase 2: 개별 CLI 클라이언트 (2단계)

#### 4.2.1 ClaudeCLIClient
- [ ] `-p --output-format json` 모드 구현
- [ ] 시스템 프롬프트: `--system-prompt`
- [ ] 모델 선택: `--model`
- [ ] 스트리밍: `--output-format stream-json`

#### 4.2.2 GeminiCLIClient
- [ ] `-o json` 모드 구현
- [ ] 모델 선택: `-m/--model`
- [ ] 스트리밍: `-o stream-json`

#### 4.2.3 OllamaCLIClient
- [ ] REST API 기반 구현 (localhost:11434)
- [ ] `/api/generate` 엔드포인트 사용
- [ ] 모델 선택 지원
- [ ] 스트리밍: `stream: true`

### Phase 3: 통합 및 CLI 옵션 (3단계)

#### 4.3.1 Factory 함수 확장
```typescript
function createLLMClient(provider: LLMProvider, options?: LLMClientOptions): BaseLLMClient | BaseCLIClient;
```

#### 4.3.2 CLI 옵션 확장
```bash
# 기존
runner create prd.md -p claude        # API
runner create prd.md -p gemini        # API

# 확장
runner create prd.md -p claude-cli    # CLI
runner create prd.md -p gemini-cli    # CLI
runner create prd.md -p ollama        # Local
runner create prd.md -p ollama -m llama3  # 모델 지정
```

---

## 5. 검증 계획

### 5.1 단위 테스트

#### 5.1.1 CLI 실행 테스트
```typescript
describe('BaseCLIClient', () => {
  it('should execute CLI command and return output', async () => {
    const client = new MockCLIClient();
    const result = await client.executeCommand(['--version']);
    expect(result).toContain('version');
  });

  it('should handle CLI not found error', async () => {
    const client = new NonExistentCLIClient();
    await expect(client.chat([...])).rejects.toThrow('CLI not found');
  });

  it('should handle timeout', async () => {
    const client = new SlowCLIClient({ timeout: 100 });
    await expect(client.chat([...])).rejects.toThrow('timeout');
  });
});
```

#### 5.1.2 응답 파싱 테스트
```typescript
describe('ClaudeCLIClient', () => {
  it('should parse JSON response correctly', () => {
    const response = `{"type":"result","result":"hello","usage":{"input_tokens":5,"output_tokens":10}}`;
    const parsed = client.parseResponse(response);
    expect(parsed.content).toBe('hello');
    expect(parsed.usage.promptTokens).toBe(5);
  });

  it('should handle error response', () => {
    const response = `{"type":"result","is_error":true,"result":"Authentication failed"}`;
    expect(() => client.parseResponse(response)).toThrow('Authentication failed');
  });
});
```

### 5.2 통합 테스트

#### 5.2.1 실제 CLI 호출 테스트 (조건부 실행)
```typescript
describe('ClaudeCLIClient Integration', () => {
  beforeAll(async () => {
    const available = await checkCLIAvailability('claude');
    if (!available.authenticated) {
      console.log('Skipping: Claude CLI not authenticated');
      return;
    }
  });

  it('should complete simple prompt', async () => {
    const client = new ClaudeCLIClient();
    const result = await client.chat([
      { role: 'user', content: 'Say "test" and nothing else' }
    ]);
    expect(result.content.toLowerCase()).toContain('test');
  });
});
```

#### 5.2.2 E2E 테스트
```typescript
describe('Runner with CLI Provider', () => {
  it('should create project with claude-cli', async () => {
    const runner = createAutonomousRunnerByProvider('claude-cli');
    const project = await runner.createProject(simplePRD);
    expect(project.tasks.length).toBeGreaterThan(0);
  });

  it('should run tasks with ollama', async () => {
    const runner = createAutonomousRunnerByProvider('ollama', {}, { model: 'llama3' });
    // ... 실행 테스트
  });
});
```

### 5.3 수동 검증 체크리스트

#### 5.3.1 Claude CLI
- [ ] `runner create prd.md -p claude-cli -v` 실행 성공
- [ ] `runner run <project-id> -p claude-cli -v` 실행 성공
- [ ] 에러 시 적절한 메시지 출력
- [ ] Ctrl+C로 중단 시 정상 종료

#### 5.3.2 Gemini CLI
- [ ] `runner create prd.md -p gemini-cli -v` 실행 성공
- [ ] `runner run <project-id> -p gemini-cli -v` 실행 성공

#### 5.3.3 Ollama
- [ ] `ollama serve` 실행 상태 확인
- [ ] `runner create prd.md -p ollama -m llama3 -v` 실행 성공
- [ ] 모델 미설치 시 적절한 에러 메시지

---

## 6. 에러 처리 전략

### 6.1 CLI 관련 에러

| 에러 유형 | 감지 방법 | 처리 |
|----------|----------|------|
| CLI 미설치 | `which` 실패 | `CLINotFoundError` throw |
| 인증 실패 | exit code / stderr | `CLIAuthenticationError` throw |
| 타임아웃 | process timeout | `CLITimeoutError` throw |
| Rate Limit | JSON 응답 파싱 | `CLIRateLimitError` throw |
| Ollama 서버 미실행 | connection refused | `OllamaServerError` throw |

### 6.2 에러 클래스 정의
```typescript
// src/shared/errors/cli-errors.ts
export class CLINotFoundError extends Error {
  constructor(cli: string) {
    super(`CLI '${cli}' not found. Please install it first.`);
  }
}

export class CLIAuthenticationError extends Error {
  constructor(cli: string) {
    super(`CLI '${cli}' not authenticated. Run '${cli}' to login.`);
  }
}
```

---

## 7. 타임라인

| Phase | 작업 | 예상 시간 |
|-------|------|----------|
| 1 | BaseCLIClient + 유틸리티 | 2-3시간 |
| 2 | 개별 CLI 클라이언트 (3개) | 3-4시간 |
| 3 | 통합 + CLI 옵션 | 1-2시간 |
| 4 | 테스트 작성 | 2-3시간 |
| 5 | 수동 검증 + 버그 수정 | 1-2시간 |
| **총** | | **9-14시간** |

---

## 8. 리스크 및 대응

### 8.1 기술적 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| CLI 버전 호환성 | 출력 형식 변경 가능 | 버전별 파서 분기 |
| 스트리밍 파싱 복잡도 | stream-json 처리 어려움 | 우선 non-streaming 구현 |
| Ollama 서버 의존성 | 별도 프로세스 관리 필요 | 서버 상태 체크 로직 |

### 8.2 우선순위

1. **claude-cli** (가장 많이 사용, 출력 형식 명확)
2. **ollama** (로컬 실행, 비용 없음)
3. **gemini-cli** (추가 지원)

---

## 9. 결정 필요 사항

1. **스트리밍 지원 범위**: 초기 버전에서 스트리밍 지원할지?
   - Option A: Non-streaming만 우선 구현
   - Option B: 처음부터 스트리밍 포함

2. **Ollama 서버 관리**:
   - Option A: 사용자가 직접 `ollama serve` 실행
   - Option B: 필요시 자동 시작

3. **CLI 버전 검증**:
   - Option A: 최소 버전만 체크
   - Option B: 엄격한 버전 호환성 체크

---

## 10. 참고 자료

- Claude CLI: https://docs.anthropic.com/en/docs/claude-code
- Gemini CLI: https://github.com/anthropics/anthropic-tools/gemini-cli
- Ollama API: https://github.com/ollama/ollama/blob/main/docs/api.md
