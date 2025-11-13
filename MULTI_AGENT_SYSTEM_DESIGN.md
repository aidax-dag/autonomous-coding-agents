# Multi-Agent 자율 코딩 시스템 설계

## 📋 프로젝트 개요

3개의 주요 AI CLI 도구(Claude Code, Codex, Gemini CLI)의 아키텍처를 분석하여, 24/7 자율적으로 동작하는 Multi-agent 코딩 자동화 시스템을 구축합니다.

### 목표
- **휴먼 개입 최소화**: 초기 요구사항 정의 후 에이전트들이 자율적으로 완성
- **24/7 자동 개발**: 백그라운드에서 지속 실행되는 에이전트들
- **자동 코드 리뷰 & 머지**: PR 생성 → 리뷰 → 수정 → 머지까지 자동화
- **순환 구조**: 다음 작업을 자동으로 이어가는 지속적 개발 사이클

---

## 🏗️ 아키텍처 분석 요약

### 1. Claude Code (Anthropic)
**핵심 특징**:
- 마크다운 기반 플러그인 시스템 (agents/, commands/, hooks/)
- Task 도구를 통한 sub-agent 패턴
- Hook 시스템으로 도구 실행 전/후 로직 삽입
- 미니파이된 배포로 소스 코드 비공개

**활용 가능 패턴**:
- Agent 도구로 전문화된 서브 에이전트 호출
- 마크다운으로 정의된 에이전트 템플릿
- PreToolUse/PostToolUse 훅으로 워크플로우 제어

### 2. Codex (OpenAI - Rust)
**핵심 특징**:
- Rust 기반 고성능 아키텍처
- 이벤트 기반 SQ/EQ (Submission Queue / Event Queue) 패턴
- Sub-agent delegate 패턴 (`codex_delegate.rs`)
- Tool orchestrator로 승인, 샌드박스, 재시도 관리
- OAuth2 + API Key 인증, 토큰 자동 갱신

**활용 가능 패턴**:
- 큐 기반 에이전트 간 통신 (비동기 메시지 패싱)
- Sub-agent 패턴으로 코드리뷰 에이전트 구현
- Tool orchestrator 패턴을 통한 안전한 실행

### 3. Gemini CLI (Google - TypeScript)
**핵심 특징**:
- Agent Executor 시스템 (`executor.ts`)
- Agent Registry로 에이전트 관리
- Subagent Tool Wrapper로 에이전트를 도구화
- MCP (Model Context Protocol) 통합
- 이벤트 기반 Message Bus
- 체크포인팅으로 세션 영속화

**활용 가능 패턴**:
- AgentDefinition 구조체로 에이전트 정의
- Agent Registry에 등록 후 이름으로 호출
- complete_task 도구로 명시적 종료
- MCP를 통한 외부 도구 확장

---

## 🎯 시스템 아키텍처 설계

### 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        Message Broker                             │
│                    (Redis / NATS / RabbitMQ)                      │
└───────┬──────────────────┬──────────────────┬────────────────────┘
        │                  │                  │
┌───────▼──────┐   ┌──────▼───────┐   ┌──────▼────────┐
│   코딩        │   │  코드리뷰     │   │   레포관리     │
│   에이전트    │   │  에이전트     │   │   에이전트     │
└───────┬──────┘   └──────┬───────┘   └──────┬────────┘
        │                  │                  │
        └──────────────────┴──────────────────┘
                          │
                  ┌───────▼────────┐
                  │  State Storage  │
                  │  (PostgreSQL)   │
                  └────────────────┘
```

---

## 🤖 에이전트 설계

### 1. 코딩 에이전트 (Coding Agent)

**역할**:
- 사용자 요구사항 분석
- 개발 플랜 및 기능 리스트 작성
- 기능 단위 구현
- 기능 브랜치 생성 및 PR 생성
- 코드리뷰 피드백 반영 및 수정

**상태 머신**:
```
IDLE → ANALYZING_REQUIREMENTS → PLANNING →
IMPLEMENTING_FEATURE → CREATING_PR →
WAITING_FOR_REVIEW → ADDRESSING_FEEDBACK →
FEATURE_COMPLETE → (다음 기능으로)
```

**입력 메시지**:
- `START_PROJECT` - 초기 요구사항
- `REVIEW_COMMENTS_RECEIVED` - 코드리뷰 피드백
- `PR_MERGED` - 머지 완료 알림
- `CONTINUE_NEXT_FEATURE` - 다음 작업 진행

**출력 메시지**:
- `PR_CREATED` - PR 생성 완료 (PR URL 포함)
- `COMMITS_PUSHED` - 추가 커밋 푸시 완료
- `ALL_FEATURES_COMPLETE` - 모든 기능 완료

**핵심 도구**:
- LLM API (Claude/GPT-4/Gemini)
- File operations (Read, Write, Edit)
- Git operations (branch, commit, push)
- GitHub API (PR 생성, 코멘트 조회)

**구현 전략**:
- Gemini CLI의 Agent Executor 패턴 사용
- 기능 리스트를 내부 상태로 관리
- 각 기능 완료 시 `complete_task` 호출 후 다음 기능 시작
- Task 도구로 하위 분석 에이전트 호출

---

### 2. 코드리뷰 에이전트 (Code Review Agent)

**역할**:
- Repository PR 리스트 모니터링 (폴링 또는 webhook)
- 새 PR 감지 시 자동 코드 리뷰 수행
- 리뷰 코멘트 작성
- 새 커밋 감지 시 재검토
- 모든 이슈 해결 시 Approve 및 머지 승인

**상태 머신**:
```
IDLE → MONITORING_PRS → PR_DETECTED →
REVIEWING_CODE → COMMENTS_POSTED →
WAITING_FOR_UPDATES → RE_REVIEWING →
APPROVING → REVIEW_COMPLETE
```

**입력 메시지**:
- `PR_CREATED` - 새 PR 생성 감지
- `NEW_COMMITS_PUSHED` - 새 커밋 감지

**출력 메시지**:
- `REVIEW_COMMENTS_POSTED` - 리뷰 코멘트 작성 완료
- `REVIEW_APPROVED` - 리뷰 승인
- `CHANGES_REQUESTED` - 수정 요청

**핵심 도구**:
- GitHub API (PR 조회, 코멘트 작성, Approve)
- LLM API (코드 분석)
- Git operations (diff 조회, 변경사항 분석)
- code-reviewer 스킬 (Claude Code 플러그인)

**구현 전략**:
- Codex의 sub-agent delegate 패턴 활용
- 폴링 루프 (예: 1분마다 PR 리스트 확인)
- 또는 GitHub Webhook + HTTP 서버
- PR 번호별 리뷰 세션 관리
- 멀티턴 대화로 여러 파일 리뷰

---

### 3. 레포관리 에이전트 (Repository Manager Agent)

**역할**:
- PR 상태 모니터링 (Open, Review Comments, Approved)
- 코드리뷰 코멘트를 코딩 에이전트에게 전달
- PR 머지 후 브랜치 동기화 (git pull)
- 코딩 에이전트에게 다음 작업 지시
- 에러 핸들링 및 재시도 로직

**상태 머신**:
```
IDLE → MONITORING_REPO → COMMENTS_DETECTED →
NOTIFYING_CODER → WAITING_FOR_FIX →
MERGE_DETECTED → SYNCING_BRANCH →
TRIGGERING_NEXT_TASK
```

**입력 메시지**:
- `REVIEW_COMMENTS_POSTED` - 리뷰 코멘트 작성됨
- `REVIEW_APPROVED` - 리뷰 승인됨
- `PR_MERGED` - PR 머지됨 (자체 감지 또는 webhook)

**출력 메시지**:
- `REVIEW_COMMENTS_RECEIVED` → 코딩 에이전트
- `PR_MERGED` → 코딩 에이전트
- `CONTINUE_NEXT_FEATURE` → 코딩 에이전트

**핵심 도구**:
- GitHub API (PR 상태 조회, 머지 수행)
- Git operations (pull, checkout)
- Message broker client (Redis/NATS)

**구현 전략**:
- 이벤트 기반 조정자 (Orchestrator) 역할
- Codex의 SQ/EQ 패턴으로 이벤트 큐 관리
- 상태 머신으로 PR 라이프사이클 추적
- 에러 발생 시 알림 및 재시도

---

## 📡 에이전트 간 통신 메커니즘

### 옵션 1: Message Broker (권장)

**Redis Pub/Sub 또는 NATS**

```typescript
// 메시지 포맷
interface AgentMessage {
  id: string;              // 메시지 고유 ID
  timestamp: number;       // 타임스탬프
  from: AgentType;         // 발신 에이전트
  to: AgentType;           // 수신 에이전트
  type: MessageType;       // 메시지 타입
  payload: Record<string, any>;  // 데이터
  correlationId?: string;  // 관련 작업 ID
}

enum AgentType {
  CODER = 'coder',
  REVIEWER = 'reviewer',
  REPO_MANAGER = 'repo_manager'
}

enum MessageType {
  PR_CREATED = 'pr_created',
  REVIEW_COMMENTS_POSTED = 'review_comments_posted',
  REVIEW_APPROVED = 'review_approved',
  PR_MERGED = 'pr_merged',
  CONTINUE_NEXT_FEATURE = 'continue_next_feature',
  // ...
}
```

**장점**:
- 에이전트 간 완전한 디커플링
- 확장 가능 (에이전트 추가 용이)
- 메시지 영속화 가능
- 재시도 및 에러 핸들링 용이

**구현 예시** (NATS):
```typescript
import { connect, StringCodec } from 'nats';

const nc = await connect({ servers: 'nats://localhost:4222' });
const sc = StringCodec();

// 코딩 에이전트 - PR 생성 메시지 발행
await nc.publish('agent.reviewer', sc.encode(JSON.stringify({
  type: 'PR_CREATED',
  payload: { prUrl: 'https://github.com/...', prNumber: 123 }
})));

// 코드리뷰 에이전트 - 메시지 구독
const sub = nc.subscribe('agent.reviewer');
for await (const msg of sub) {
  const message = JSON.parse(sc.decode(msg.data));
  if (message.type === 'PR_CREATED') {
    await reviewPullRequest(message.payload.prNumber);
  }
}
```

---

### 옵션 2: 공유 데이터베이스 (Polling)

**PostgreSQL + 이벤트 테이블**

```sql
CREATE TABLE agent_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  from_agent VARCHAR(50) NOT NULL,
  to_agent VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_events_pending ON agent_events(to_agent, status)
WHERE status = 'pending';
```

**장점**:
- 간단한 구현
- 이벤트 히스토리 자동 저장
- SQL 쿼리로 디버깅 용이

**단점**:
- 폴링 오버헤드
- 실시간성 낮음
- DB 부하

---

### 옵션 3: 파일 시스템 기반 (간단한 프로토타입용)

**공유 디렉토리 + 파일 워치**

```
~/agent-workspace/
  messages/
    coder/
      inbox/
      outbox/
    reviewer/
      inbox/
      outbox/
    repo_manager/
      inbox/
      outbox/
```

**장점**:
- 외부 의존성 없음
- 디버깅 매우 쉬움
- 로컬 개발 용이

**단점**:
- 확장성 제한
- 분산 환경 불가
- 파일 동기화 이슈

---

## 🔄 전체 워크플로우

### 1단계: 초기 시작
```
휴먼: "사용자 인증 기능이 있는 블로그 시스템 만들어줘"
       → 코딩 에이전트에게 START_PROJECT 메시지 전달
```

### 2단계: 플랜 수립
```
코딩 에이전트:
  1. 요구사항 분석
  2. 기능 리스트 생성:
     - Feature 1: 사용자 회원가입/로그인
     - Feature 2: 블로그 포스트 CRUD
     - Feature 3: 댓글 기능
     - Feature 4: 마크다운 에디터
  3. 각 기능의 상세 플랜 작성
```

### 3단계: 기능 개발 (Feature 1)
```
코딩 에이전트:
  1. 새 브랜치 생성: feature/user-auth
  2. 코드 구현 (DB 모델, API, 프론트엔드)
  3. 커밋 및 푸시
  4. PR 생성
  5. 메시지 발행: PR_CREATED → 레포관리 에이전트
```

### 4단계: 코드 리뷰
```
레포관리 에이전트:
  - PR_CREATED 메시지 수신
  - 메시지 전달: PR_CREATED → 코드리뷰 에이전트

코드리뷰 에이전트:
  1. PR #123 분석
  2. 코드 리뷰 수행
  3. 코멘트 작성:
     - "users.py:42 - SQL injection 취약점 있음"
     - "auth.py:15 - 비밀번호 해싱 추가 필요"
  4. 메시지 발행: REVIEW_COMMENTS_POSTED → 레포관리 에이전트
```

### 5단계: 피드백 반영
```
레포관리 에이전트:
  - REVIEW_COMMENTS_POSTED 메시지 수신
  - 메시지 전달: REVIEW_COMMENTS_RECEIVED → 코딩 에이전트

코딩 에이전트:
  1. 리뷰 코멘트 조회
  2. 각 코멘트 분석 및 수정
  3. 새 커밋 푸시
  4. 메시지 발행: COMMITS_PUSHED → 레포관리 에이전트
```

### 6단계: 재검토
```
레포관리 에이전트:
  - COMMITS_PUSHED 메시지 수신
  - 메시지 전달: NEW_COMMITS_PUSHED → 코드리뷰 에이전트

코드리뷰 에이전트:
  1. 새 커밋 분석
  2. 이전 코멘트 해결 확인
  3. 모든 이슈 해결 시 Approve
  4. 메시지 발행: REVIEW_APPROVED → 레포관리 에이전트
```

### 7단계: PR 머지 및 다음 작업
```
레포관리 에이전트:
  1. REVIEW_APPROVED 메시지 수신
  2. PR 스쿼시 머지 수행
  3. 로컬 브랜치 main으로 전환
  4. git pull 수행
  5. 메시지 발행: PR_MERGED → 코딩 에이전트
  6. 메시지 발행: CONTINUE_NEXT_FEATURE → 코딩 에이전트

코딩 에이전트:
  - Feature 2로 이동하여 3단계부터 반복
```

### 8단계: 완료
```
코딩 에이전트:
  - 모든 기능 완료 시
  - 메시지 발행: ALL_FEATURES_COMPLETE
  - 휴먼에게 알림 (선택적)
```

---

## 🛠️ 기술 스택 제안

### 언어 선택

**옵션 A: TypeScript (권장)**
- Gemini CLI 코드베이스 직접 활용 가능
- Agent Executor 패턴 재사용
- Node.js 생태계 풍부
- 빠른 프로토타이핑

**옵션 B: Rust**
- Codex 코드베이스 활용
- 높은 성능 및 안정성
- 복잡한 동시성 제어 가능
- 학습 곡선 높음

**옵션 C: Python**
- AI/ML 생태계 최적화
- 간단한 구현
- 많은 GitHub API 라이브러리
- 성능은 상대적으로 낮음

---

### 핵심 라이브러리

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",       // Claude API
    "openai": "^4.75.0",                   // OpenAI API
    "@google/generative-ai": "^0.21.0",   // Gemini API
    "octokit": "^4.0.2",                   // GitHub API
    "nats": "^2.29.1",                     // Message broker
    "ioredis": "^5.4.2",                   // Redis client
    "zod": "^3.24.1",                      // Schema validation
    "simple-git": "^3.27.0",               // Git operations
    "tsx": "^4.19.2",                      // TypeScript execution
    "winston": "^3.17.0"                   // Logging
  }
}
```

---

## 🚀 구현 단계

### Phase 1: 기초 인프라 (1-2주)
1. **메시지 브로커 설정**
   - NATS 서버 설치 및 구성
   - 메시지 스키마 정의 (Zod)
   - 기본 pub/sub 라이브러리 구현

2. **공통 유틸리티**
   - LLM API 클라이언트 래퍼
   - GitHub API 클라이언트 래퍼
   - Git 작업 유틸리티
   - 로깅 및 에러 핸들링

3. **상태 관리**
   - PostgreSQL 스키마 설계
   - ORM 설정 (Prisma 또는 TypeORM)
   - 작업 상태 영속화

---

### Phase 2: 코딩 에이전트 MVP (2-3주)
1. **기본 기능**
   - 요구사항 분석 (LLM 호출)
   - 플랜 생성 및 저장
   - 간단한 코드 생성

2. **Git 통합**
   - 브랜치 생성/전환
   - 파일 쓰기 및 커밋
   - 원격 푸시

3. **PR 생성**
   - GitHub API로 PR 생성
   - PR 템플릿 적용
   - 메시지 발행

4. **피드백 반영**
   - 코멘트 조회
   - 수정 사항 구현
   - 추가 커밋

---

### Phase 3: 코드리뷰 에이전트 (2주)
1. **PR 모니터링**
   - 폴링 메커니즘 구현
   - 새 PR 감지

2. **코드 분석**
   - Diff 조회 및 파싱
   - LLM 기반 코드 리뷰
   - 리뷰 코멘트 생성

3. **재검토**
   - 새 커밋 감지
   - 이전 코멘트 해결 확인
   - Approve/Request Changes

---

### Phase 4: 레포관리 에이전트 (1주)
1. **이벤트 라우팅**
   - 메시지 수신 및 전달
   - 상태 머신 구현

2. **PR 머지**
   - Approved PR 자동 머지
   - 브랜치 동기화

3. **작업 조정**
   - 다음 작업 트리거
   - 에러 핸들링

---

### Phase 5: 통합 및 백그라운드 실행 (1-2주)
1. **통합 테스트**
   - 전체 워크플로우 E2E 테스트
   - 에러 시나리오 테스트

2. **Tmux 통합**
   - 각 에이전트를 별도 tmux 세션에서 실행
   - 자동 재시작 스크립트

3. **모니터링**
   - 헬스 체크 엔드포인트
   - 로그 집계
   - 알림 설정 (Slack/Discord)

---

### Phase 6: 고급 기능 (선택적)
1. **병렬 작업**
   - 여러 기능 동시 개발
   - 여러 PR 동시 리뷰

2. **지능형 우선순위**
   - 중요도 기반 작업 스케줄링
   - 의존성 분석

3. **학습 및 개선**
   - 리뷰 품질 피드백
   - 코드 스타일 학습

---

## 🔒 안전장치 및 제약사항

### 1. 승인 메커니즘
- 첫 PR 생성 시 휴먼 승인 필요
- 위험한 작업(DB 마이그레이션, 의존성 변경) 알림
- 머지 전 최종 승인 옵션

### 2. Rate Limiting
- LLM API 호출 제한
- GitHub API rate limit 준수
- 실패 시 exponential backoff

### 3. 롤백 메커니즘
- 각 단계별 체크포인트
- 문제 발생 시 이전 상태로 복원
- 수동 개입 가능

### 4. 보안
- API 키 안전한 저장 (환경변수, secret manager)
- 민감한 정보 로그에서 제외
- Sandboxing (선택적)

---

## 📊 성공 메트릭

1. **자동화율**: 전체 개발 사이클 중 자동화된 비율
2. **리뷰 품질**: 코드리뷰 코멘트의 유효성
3. **완성 시간**: 초기 요구사항부터 머지까지 소요 시간
4. **에러율**: 에이전트 간 통신 실패율
5. **휴먼 개입**: 필요한 수동 개입 횟수

---

## 🎬 시작 방법

### 1. tmux로 각 에이전트 실행

```bash
# 코딩 에이전트 세션
tmux new-session -d -s coder 'npm run agent:coder'

# 코드리뷰 에이전트 세션
tmux new-session -d -s reviewer 'npm run agent:reviewer'

# 레포관리 에이전트 세션
tmux new-session -d -s repo-manager 'npm run agent:repo-manager'

# 세션 목록 확인
tmux ls

# 특정 세션에 attach
tmux attach -t coder
```

### 2. 작업 시작

```bash
# REST API 또는 CLI로 초기 요구사항 전달
curl -X POST http://localhost:3000/api/start-project \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "사용자 인증 기능이 있는 블로그 시스템",
    "repository": "https://github.com/username/blog-system",
    "branch": "main"
  }'
```

### 3. 모니터링

```bash
# 로그 모니터링
tail -f logs/coder.log
tail -f logs/reviewer.log
tail -f logs/repo-manager.log

# 상태 확인
curl http://localhost:3000/api/status
```

---

## 📝 다음 단계

1. ✅ **3개 프로젝트 분석 완료**
2. ✅ **아키텍처 설계 완료**
3. ⬜ **메시지 브로커 선택 및 프로토타입**
4. ⬜ **코딩 에이전트 기본 구조 구현**
5. ⬜ **통신 메커니즘 프로토타입**
6. ⬜ **E2E 테스트**

---

## ❓ 예상 Q&A

**Q: 이게 정말 가능한가요?**
A: 네! 분석한 3개 프로젝트가 이미 단일 에이전트로 복잡한 작업을 수행하고 있습니다.
   이를 특화된 여러 에이전트로 분리하고 메시지 브로커로 연결하면 충분히 가능합니다.

**Q: 비용은 얼마나 들까요?**
A: LLM API 호출이 주요 비용입니다. 중간 크기 프로젝트 기준:
   - 코딩: $5-20 per feature (길이에 따라)
   - 리뷰: $1-5 per PR
   - 하루 종일 돌려도 $50-200 정도 (활동량에 따라)

**Q: 에이전트가 무한 루프에 빠지면?**
A: 안전장치 필요:
   - 최대 턴 수 제한 (Gemini CLI의 max_turns처럼)
   - 타임아웃 설정
   - Loop detection (같은 코드 반복 수정 감지)

**Q: 코드 품질은?**
A: 초기엔 단순한 기능만 가능하지만:
   - 코드리뷰 에이전트가 품질 관리
   - 테스트 자동 실행 추가 가능
   - 점진적으로 더 복잡한 기능 학습

**Q: tmux 대신 다른 방법은?**
A: 가능합니다:
   - systemd 서비스 (Linux)
   - PM2 (Node.js)
   - Docker Compose
   - Kubernetes (대규모)
   - Background jobs (celery, bull)

---

## 📚 참고 자료

### 분석된 프로젝트
- [Claude Code](https://github.com/anthropics/claude-code)
- [Codex CLI](https://github.com/openai/codex)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)

### 관련 기술
- [NATS.io](https://nats.io/) - Message broker
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [GitHub REST API](https://docs.github.com/en/rest)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Google Gemini API](https://ai.google.dev/gemini-api/docs)

---

**이 시스템은 실현 가능하며, 이미 존재하는 검증된 패턴들을 조합한 것입니다.**

다음은 어떤 단계부터 시작하실까요?
