# 구현 언어 선택 가이드

## 📊 현재 설정: TypeScript ✅

프로젝트는 현재 **TypeScript (Node.js 20+)** 로 설정되어 있습니다.

---

## 🎯 TypeScript를 선택한 이유

### 1. 분석한 3개 프로젝트 중 가장 적합

**Gemini CLI 코드베이스 직접 활용 가능**:
- Agent Executor 패턴 검증됨 (`executor.ts` 1,099 lines)
- Agent Registry 시스템
- Subagent Tool Wrapper
- 이미 프로덕션에서 동작 중

**Claude Code**:
- 미니파이된 배포 (소스 비공개)
- 참고만 가능

**Codex**:
- Rust 기반 (고성능이지만 학습 곡선 높음)
- 복잡한 타입 시스템

### 2. 개발 속도

```typescript
// TypeScript - 간결하고 빠른 프로토타이핑
interface AgentMessage {
  id: string;
  type: MessageType;
  payload: Record<string, any>;
}

async function sendMessage(msg: AgentMessage): Promise<void> {
  await nats.publish('agent.coder', JSON.stringify(msg));
}
```

vs

```rust
// Rust - 타입 안전하지만 보일러플레이트 많음
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentMessage {
    pub id: String,
    pub message_type: MessageType,
    pub payload: serde_json::Value,
}

pub async fn send_message(msg: &AgentMessage) -> Result<(), NatsError> {
    let nc = nats::connect("nats://localhost:4222")?;
    nc.publish("agent.coder", serde_json::to_vec(&msg)?)?;
    Ok(())
}
```

### 3. 생태계 및 라이브러리

**Node.js 생태계가 AI 도구에 최적**:
- `@anthropic-ai/sdk` - 공식 Claude SDK
- `openai` - 공식 OpenAI SDK
- `@google/generative-ai` - 공식 Gemini SDK
- `octokit` - GitHub API (완벽한 타입 지원)
- `simple-git` - Git 작업
- `nats` - NATS 클라이언트

**Rust/Python 대비**:
- Rust: LLM SDK 품질이 낮음 (커뮤니티 제작)
- Python: 타입 안정성 낮음, 동시성 제한

### 4. 타입 안정성

```typescript
// 컴파일 타임에 모든 에러 발견
const message: AgentMessage = {
  id: '123',
  type: 'PR_CREATED',
  payload: { prNumber: 42 }
};

// ❌ 타입 에러 - 즉시 발견
message.type = 'INVALID_TYPE'; // Error: Type '"INVALID_TYPE"' is not assignable

// ✅ 자동 완성
message.payload. // IDE가 가능한 필드 제안
```

### 5. 동시성 처리

```typescript
// async/await로 간단한 동시성
const [llmResponse, prData, diffData] = await Promise.all([
  llm.chat(messages),
  github.getPR(prNumber),
  github.getDiff(prNumber)
]);

// 에이전트 3개 동시 실행
await Promise.all([
  startCoderAgent(),
  startReviewerAgent(),
  startRepoManagerAgent()
]);
```

### 6. MVP 속도

**3-4개월 MVP 목표**에 TypeScript가 최적:
- 빠른 반복 개발
- 풍부한 타입 지원
- 디버깅 용이
- 테스트 쉬움

---

## 🔄 다른 언어 옵션 (선택 가능)

### 옵션 A: TypeScript (현재 선택) ⭐

**장점**:
- ✅ 빠른 개발 속도 (MVP 3-4개월 가능)
- ✅ 타입 안정성 (80% 이상)
- ✅ 풍부한 LLM SDK
- ✅ GitHub/Git 라이브러리 완벽
- ✅ 동시성 간단 (async/await)
- ✅ Gemini CLI 패턴 재사용

**단점**:
- ❌ Rust 대비 성능 낮음 (하지만 I/O bound라 큰 차이 없음)
- ❌ Python 대비 AI 라이브러리 적음 (하지만 LLM API만 쓰므로 문제없음)

**추천 대상**:
- MVP 빠르게 만들고 싶은 경우
- 타입 안정성 중요한 경우
- JavaScript/TypeScript 경험 있는 경우
- 3-4개월 내 출시 목표

---

### 옵션 B: Rust

**장점**:
- ✅ 최고 성능 (Codex가 Rust로 작성됨)
- ✅ 메모리 안전성
- ✅ 동시성 우수 (tokio)
- ✅ 타입 안정성 100%

**단점**:
- ❌ 학습 곡선 매우 높음
- ❌ 개발 속도 느림 (TypeScript의 2-3배 시간)
- ❌ LLM SDK 품질 낮음 (커뮤니티 제작)
- ❌ 보일러플레이트 많음

**예상 구현 시간**:
- TypeScript: 3-4개월 → Rust: **6-9개월**

**추천 대상**:
- Rust 전문가
- 최고 성능 필요 (하지만 이 시스템은 I/O bound라 큰 차이 없음)
- 장기 프로젝트 (6개월+)

---

### 옵션 C: Python

**장점**:
- ✅ 가장 간단한 문법
- ✅ AI/ML 생태계 최고
- ✅ 빠른 프로토타이핑

**단점**:
- ❌ 타입 안정성 낮음 (mypy 써도 50-60%)
- ❌ 동시성 제한 (GIL)
- ❌ 런타임 에러 많음
- ❌ 대규모 코드베이스 관리 어려움

**예상 문제**:
```python
# Python - 런타임에만 에러 발견
message = {
    "id": "123",
    "type": "PR_CREATED",
    "payload": {"prNumber": 42}
}

# ❌ 오타 - 런타임에만 발견
if message["typ"] == "PR_CREATED":  # KeyError!
    pass

# ❌ 타입 불일치 - 런타임에만 발견
message["payload"]["prNumber"] = "not a number"  # 나중에 int() 에러!
```

**추천 대상**:
- Python 전문가
- 작은 프로토타입 (1-2개월)
- ML 모델 학습 필요한 경우 (하지만 이 프로젝트는 LLM API만 씀)

---

## 📊 비교표

| 항목 | TypeScript | Rust | Python |
|------|------------|------|--------|
| **개발 속도** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **타입 안정성** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **런타임 성능** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **LLM SDK 품질** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **GitHub API** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **동시성** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **MVP 적합성** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **유지보수성** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **학습 곡선** | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **커뮤니티** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**종합 점수**:
- TypeScript: **44/50** ⭐
- Rust: **33/50**
- Python: **38/50**

---

## 💡 혼합 사용 가능 (미래)

나중에 성능이 중요한 부분만 다른 언어로:

```
autonomous-coding-agents/ (TypeScript)
├── src/
│   ├── agents/              # TypeScript
│   ├── shared/              # TypeScript
│   └── performance-critical/ # Rust로 재작성 (선택)
│       └── diff-parser/     # 대용량 diff 파싱
```

**WASM으로 통합**:
```typescript
// TypeScript에서 Rust 모듈 호출
import { parseLargeDiff } from './wasm/diff-parser.wasm';

const diff = await parseLargeDiff(hugeString); // Rust로 처리
```

---

## 🎯 최종 권장사항

### MVP 단계 (현재-6개월)

**➡️ TypeScript 사용 (현재 설정 유지)**

**이유**:
1. 3-4개월 내 MVP 출시 가능
2. Gemini CLI 패턴 직접 활용
3. 타입 안정성으로 버그 최소화
4. LLM SDK 완벽 지원
5. 팀 확장 시 개발자 구하기 쉬움

### 성장 단계 (6개월-1년)

**필요시 일부만 Rust로 전환**:
- 대용량 파일 파싱
- 복잡한 diff 분석
- 병렬 처리 최적화

하지만 대부분은 TypeScript로 충분!

---

## 🔄 언어 변경 원한다면?

### Python으로 변경하고 싶다면

```bash
# 1. 새 브랜치 생성
git checkout -b experiment/python-version

# 2. 설정 파일 변경
# - package.json → requirements.txt
# - tsconfig.json → pyproject.toml
# - Prisma → SQLAlchemy

# 3. 구현 시작
# - src/ 디렉토리 구조는 동일
# - .ts 대신 .py
```

**예상 시간**: 설정 변경 1-2일

### Rust로 변경하고 싶다면

```bash
# 1. 새 브랜치 생성
git checkout -b experiment/rust-version

# 2. Cargo 프로젝트 초기화
cargo init --lib

# 3. 의존성 추가
# Cargo.toml에 추가
# - tokio (async runtime)
# - reqwest (HTTP client)
# - serde (serialization)

# 4. 구현 시작
# src/lib.rs 부터
```

**예상 시간**: 설정 변경 3-5일, 전체 구현 6-9개월

---

## 📝 결론

**현재 TypeScript 설정을 유지하는 것을 강력히 권장합니다.**

**이유**:
1. ✅ MVP 3-4개월 목표에 최적
2. ✅ 타입 안정성 우수
3. ✅ Gemini CLI 패턴 활용
4. ✅ 풍부한 생태계
5. ✅ 팀 확장 용이

**언어 변경을 원하신다면 지금 결정하세요!**
- 구현 시작 전에 변경하는 것이 가장 쉽습니다
- 구현 중 변경은 2-3주 손실
- 구현 후 변경은 전체 재작성

**질문**: TypeScript로 진행할까요, 아니면 다른 언어로 변경할까요?
