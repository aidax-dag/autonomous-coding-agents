# Feature List - Multi-Agent 자율 코딩 시스템

## 📌 Feature 우선순위 분류

### MoSCoW Method
- **Must Have (P0)**: 시스템 동작에 필수적인 핵심 기능
- **Should Have (P1)**: 중요하지만 초기 버전에서 생략 가능
- **Could Have (P2)**: 있으면 좋지만 선택적
- **Won't Have (P3)**: 미래 버전에서 고려

---

## 🎯 Phase 1: 기초 인프라 (P0 - Must Have)

### F1.1: 메시지 브로커 시스템
**Priority**: P0
**Epic**: Infrastructure
**Estimated Effort**: 3-5 days

**User Story**:
As a system architect, I need a reliable message broker so that agents can communicate asynchronously and independently.

**Acceptance Criteria**:
- [ ] NATS 서버 설치 및 구성 완료
- [ ] 기본 Pub/Sub 패턴 구현
- [ ] 메시지 직렬화/역직렬화 (JSON)
- [ ] Connection 재시도 로직 구현
- [ ] 헬스 체크 기능

**Technical Details**:
```typescript
interface MessageBrokerConfig {
  servers: string[];
  reconnectTimeWait?: number;
  maxReconnectAttempts?: number;
}
```

**Dependencies**: None
**Blockers**: None

---

### F1.2: 메시지 스키마 정의
**Priority**: P0
**Epic**: Infrastructure
**Estimated Effort**: 2-3 days

**User Story**:
As a developer, I need strongly-typed message schemas so that agents can communicate with type safety and validation.

**Acceptance Criteria**:
- [ ] Zod 스키마로 모든 메시지 타입 정의
- [ ] AgentMessage 기본 인터페이스 구현
- [ ] MessageType enum 정의 (15개 이상)
- [ ] Payload 타입별 스키마 정의
- [ ] 스키마 검증 유틸리티 함수

**Technical Details**:
```typescript
const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number(),
  from: AgentTypeSchema,
  to: AgentTypeSchema,
  type: MessageTypeSchema,
  payload: z.record(z.any()),
  correlationId: z.string().optional()
});
```

**Dependencies**: F1.1
**Blockers**: None

---

### F1.3: 공통 로깅 시스템
**Priority**: P0
**Epic**: Infrastructure
**Estimated Effort**: 2-3 days

**User Story**:
As an operator, I need structured logging so that I can debug and monitor agent behavior.

**Acceptance Criteria**:
- [ ] Winston 로거 설정
- [ ] 로그 레벨 정의 (debug, info, warn, error)
- [ ] 파일 로테이션 설정 (daily, 30일 보관)
- [ ] 에이전트별 로그 분리
- [ ] JSON 형식 로그 출력

**Technical Details**:
- 로그 디렉토리: `logs/`
- 파일명 패턴: `{agent-name}-{date}.log`
- 최대 파일 크기: 100MB

**Dependencies**: None
**Blockers**: None

---

### F1.4: 환경 설정 관리
**Priority**: P0
**Epic**: Infrastructure
**Estimated Effort**: 2 days

**User Story**:
As a developer, I need centralized configuration management so that I can easily adjust system behavior without code changes.

**Acceptance Criteria**:
- [ ] `.env` 파일 지원
- [ ] 환경별 설정 (dev, staging, prod)
- [ ] API 키 안전한 저장 및 로드
- [ ] 설정 검증 (필수 값 체크)
- [ ] 타입 안전한 설정 접근

**Technical Details**:
```typescript
interface Config {
  nats: NatsConfig;
  github: GithubConfig;
  llm: LLMConfig;
  database: DatabaseConfig;
  agents: AgentsConfig;
}
```

**Dependencies**: None
**Blockers**: None

---

### F1.5: 에러 핸들링 시스템
**Priority**: P0
**Epic**: Infrastructure
**Estimated Effort**: 2-3 days

**User Story**:
As a developer, I need consistent error handling so that failures are properly logged, reported, and recovered.

**Acceptance Criteria**:
- [ ] 커스텀 에러 클래스 정의
- [ ] 글로벌 에러 핸들러 구현
- [ ] 에러 분류 (Retriable, Fatal, UserError)
- [ ] Exponential backoff 재시도 로직
- [ ] 에러 알림 메커니즘 (선택적)

**Technical Details**:
```typescript
class AgentError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public retryable: boolean,
    public context?: Record<string, any>
  ) {}
}
```

**Dependencies**: F1.3
**Blockers**: None

---

### F1.6: LLM API 클라이언트 래퍼
**Priority**: P0
**Epic**: Infrastructure
**Estimated Effort**: 3-4 days

**User Story**:
As an agent developer, I need a unified LLM API client so that I can interact with multiple LLM providers (Claude, GPT, Gemini) with a consistent interface.

**Acceptance Criteria**:
- [ ] Provider 추상화 인터페이스
- [ ] Claude API 클라이언트 구현
- [ ] OpenAI API 클라이언트 구현
- [ ] Gemini API 클라이언트 구현
- [ ] Rate limiting 처리
- [ ] 스트리밍 응답 지원
- [ ] 재시도 로직 (429, 500 에러)
- [ ] 토큰 카운팅

**Technical Details**:
```typescript
interface LLMClient {
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
  stream(messages: Message[], options?: ChatOptions): AsyncGenerator<string>;
  countTokens(text: string): number;
}
```

**Dependencies**: F1.4, F1.5
**Blockers**: None

---

### F1.7: GitHub API 클라이언트 래퍼
**Priority**: P0
**Epic**: Infrastructure
**Estimated Effort**: 3-4 days

**User Story**:
As an agent developer, I need a GitHub API client so that agents can create PRs, review code, and manage repositories.

**Acceptance Criteria**:
- [ ] Octokit 기반 클라이언트 구현
- [ ] 인증 처리 (Personal Access Token, GitHub App)
- [ ] PR 생성/조회/업데이트 API
- [ ] PR 리뷰 생성/조회 API
- [ ] 코멘트 작성 API
- [ ] PR 머지 API
- [ ] Diff 조회 API
- [ ] Rate limit 처리

**Technical Details**:
```typescript
interface GitHubClient {
  createPullRequest(options: CreatePROptions): Promise<PullRequest>;
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest>;
  createReview(prNumber: number, review: ReviewData): Promise<Review>;
  mergePullRequest(prNumber: number, method: 'merge' | 'squash' | 'rebase'): Promise<void>;
  getDiff(prNumber: number): Promise<string>;
}
```

**Dependencies**: F1.4, F1.5
**Blockers**: None

---

### F1.8: Git 작업 유틸리티
**Priority**: P0
**Epic**: Infrastructure
**Estimated Effort**: 2-3 days

**User Story**:
As a coding agent, I need Git utilities so that I can perform branch operations, commits, and pushes programmatically.

**Acceptance Criteria**:
- [ ] simple-git 기반 래퍼 구현
- [ ] 브랜치 생성/전환
- [ ] 파일 스테이징 (add)
- [ ] 커밋 (with custom author)
- [ ] 원격 푸시
- [ ] Git pull
- [ ] 현재 상태 조회 (status)
- [ ] 에러 핸들링 (merge conflict 등)

**Technical Details**:
```typescript
interface GitOperations {
  createBranch(name: string): Promise<void>;
  checkoutBranch(name: string): Promise<void>;
  addFiles(patterns: string[]): Promise<void>;
  commit(message: string, author?: Author): Promise<void>;
  push(remote: string, branch: string): Promise<void>;
  pull(remote: string, branch: string): Promise<void>;
  getStatus(): Promise<GitStatus>;
}
```

**Dependencies**: F1.5
**Blockers**: None

---

### F1.9: 데이터베이스 스키마 및 ORM 설정
**Priority**: P0
**Epic**: Infrastructure
**Estimated Effort**: 3-4 days

**User Story**:
As a system architect, I need a database to persist agent state, jobs, and messages so that the system can recover from crashes and maintain history.

**Acceptance Criteria**:
- [ ] PostgreSQL 스키마 설계
- [ ] Prisma ORM 설정
- [ ] 테이블: jobs, features, agent_state, messages, pr_reviews
- [ ] 마이그레이션 스크립트
- [ ] 시드 데이터 (선택적)
- [ ] 연결 풀 설정

**Technical Details**:
```prisma
model Job {
  id            String   @id @default(uuid())
  requirements  String
  repository    String
  branch        String
  status        JobStatus
  features      Feature[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Feature {
  id          String   @id @default(uuid())
  jobId       String
  job         Job      @relation(fields: [jobId], references: [id])
  title       String
  description String
  status      FeatureStatus
  prNumber    Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Dependencies**: F1.4
**Blockers**: None

---

## 🤖 Phase 2: 코딩 에이전트 MVP (P0 - Must Have)

### F2.1: 코딩 에이전트 기본 구조
**Priority**: P0
**Epic**: Coding Agent
**Estimated Effort**: 3-5 days

**User Story**:
As a user, I need a coding agent that can analyze requirements and generate a development plan.

**Acceptance Criteria**:
- [ ] Agent 클래스 구현
- [ ] 메시지 수신 루프
- [ ] 상태 머신 구현 (8개 상태)
- [ ] 상태 전환 로직
- [ ] DB에 상태 영속화
- [ ] Graceful shutdown

**Technical Details**:
```typescript
enum CodingAgentState {
  IDLE = 'idle',
  ANALYZING_REQUIREMENTS = 'analyzing_requirements',
  PLANNING = 'planning',
  IMPLEMENTING_FEATURE = 'implementing_feature',
  CREATING_PR = 'creating_pr',
  WAITING_FOR_REVIEW = 'waiting_for_review',
  ADDRESSING_FEEDBACK = 'addressing_feedback',
  FEATURE_COMPLETE = 'feature_complete'
}

class CodingAgent {
  async processMessage(message: AgentMessage): Promise<void>;
  async transitionTo(state: CodingAgentState): Promise<void>;
  async run(): Promise<void>;
}
```

**Dependencies**: F1.1, F1.2, F1.9
**Blockers**: None

---

### F2.2: 요구사항 분석 기능
**Priority**: P0
**Epic**: Coding Agent
**Estimated Effort**: 3-4 days

**User Story**:
As a coding agent, I need to analyze user requirements and extract actionable features.

**Acceptance Criteria**:
- [ ] LLM 프롬프트 설계 (요구사항 → 기능 리스트)
- [ ] 구조화된 출력 (JSON)
- [ ] 기능별 상세 플랜 생성
- [ ] 우선순위 결정
- [ ] 의존성 분석
- [ ] DB에 Job 및 Feature 저장

**Technical Details**:
```typescript
interface RequirementsAnalysis {
  features: FeaturePlan[];
  techStack: TechStack;
  architecture: ArchitectureDecision[];
}

interface FeaturePlan {
  title: string;
  description: string;
  priority: number;
  estimatedComplexity: 'low' | 'medium' | 'high';
  dependencies: string[];
  tasks: string[];
}
```

**Dependencies**: F1.6, F2.1
**Blockers**: None

---

### F2.3: 코드 생성 기능
**Priority**: P0
**Epic**: Coding Agent
**Estimated Effort**: 5-7 days

**User Story**:
As a coding agent, I need to generate code based on feature plans.

**Acceptance Criteria**:
- [ ] 프롬프트 설계 (기능 플랜 → 코드)
- [ ] 멀티턴 대화로 복잡한 기능 구현
- [ ] 파일 시스템 컨텍스트 제공
- [ ] 기존 코드베이스 이해
- [ ] 여러 파일에 걸친 변경사항 처리
- [ ] 코드 검증 (syntax check)

**Technical Details**:
```typescript
interface CodeGeneration {
  files: FileChange[];
  dependencies: Dependency[];
  migrations?: Migration[];
}

interface FileChange {
  path: string;
  action: 'create' | 'update' | 'delete';
  content?: string;
  diff?: string;
}
```

**Dependencies**: F1.6, F2.2
**Blockers**: None

---

### F2.4: Git 브랜치 및 커밋 관리
**Priority**: P0
**Epic**: Coding Agent
**Estimated Effort**: 2-3 days

**User Story**:
As a coding agent, I need to create feature branches and commit changes.

**Acceptance Criteria**:
- [ ] 브랜치 이름 자동 생성 (feature/{sanitized-title})
- [ ] 파일 변경사항 스테이징
- [ ] 의미 있는 커밋 메시지 생성
- [ ] Author 정보 설정
- [ ] 원격 브랜치에 푸시
- [ ] 에러 처리 (충돌 등)

**Technical Details**:
```typescript
interface CommitOptions {
  message: string;
  author: {
    name: string;
    email: string;
  };
  files: string[];
}
```

**Dependencies**: F1.8, F2.3
**Blockers**: None

---

### F2.5: PR 생성 기능
**Priority**: P0
**Epic**: Coding Agent
**Estimated Effort**: 2-3 days

**User Story**:
As a coding agent, I need to create pull requests after implementing features.

**Acceptance Criteria**:
- [ ] PR 제목 자동 생성
- [ ] PR 설명 생성 (what, why, how)
- [ ] 변경사항 요약
- [ ] 라벨 자동 추가 (feature, enhancement 등)
- [ ] PR 생성 후 메시지 발행 (PR_CREATED)
- [ ] PR URL 저장

**Technical Details**:
```typescript
interface PRCreationOptions {
  title: string;
  body: string;
  head: string;  // feature branch
  base: string;  // main/master
  labels?: string[];
}
```

**Dependencies**: F1.7, F2.4
**Blockers**: None

---

### F2.6: 코드리뷰 피드백 반영
**Priority**: P0
**Epic**: Coding Agent
**Estimated Effort**: 4-5 days

**User Story**:
As a coding agent, I need to address code review comments and update the PR.

**Acceptance Criteria**:
- [ ] GitHub PR 코멘트 조회
- [ ] 각 코멘트 분석 (LLM)
- [ ] 수정 사항 구현
- [ ] 추가 커밋 생성
- [ ] 원격 푸시
- [ ] 메시지 발행 (COMMITS_PUSHED)
- [ ] 해결된 코멘트 마킹 (선택적)

**Technical Details**:
```typescript
interface ReviewFeedback {
  commentId: string;
  path: string;
  line: number;
  body: string;
  resolved: boolean;
}

interface FeedbackResolution {
  commentId: string;
  action: 'fixed' | 'wontfix' | 'discussion';
  changes?: FileChange[];
}
```

**Dependencies**: F1.7, F2.3
**Blockers**: None

---

## 🔍 Phase 3: 코드리뷰 에이전트 (P0 - Must Have)

### F3.1: 코드리뷰 에이전트 기본 구조
**Priority**: P0
**Epic**: Code Review Agent
**Estimated Effort**: 3-4 days

**User Story**:
As a system, I need a code review agent that monitors PRs and performs automated reviews.

**Acceptance Criteria**:
- [ ] Agent 클래스 구현
- [ ] 메시지 수신 루프
- [ ] 상태 머신 구현 (8개 상태)
- [ ] PR 별 세션 관리
- [ ] DB에 리뷰 상태 영속화
- [ ] Graceful shutdown

**Technical Details**:
```typescript
enum ReviewAgentState {
  IDLE = 'idle',
  MONITORING_PRS = 'monitoring_prs',
  PR_DETECTED = 'pr_detected',
  REVIEWING_CODE = 'reviewing_code',
  COMMENTS_POSTED = 'comments_posted',
  WAITING_FOR_UPDATES = 'waiting_for_updates',
  RE_REVIEWING = 're_reviewing',
  APPROVING = 'approving',
  REVIEW_COMPLETE = 'review_complete'
}
```

**Dependencies**: F1.1, F1.2, F1.9
**Blockers**: None

---

### F3.2: PR 모니터링 (폴링)
**Priority**: P0
**Epic**: Code Review Agent
**Estimated Effort**: 2-3 days

**User Story**:
As a code review agent, I need to detect when new PRs are created or updated.

**Acceptance Criteria**:
- [ ] 메시지 기반 PR 감지 (PR_CREATED)
- [ ] 폴백: 폴링 메커니즘 (1분 간격)
- [ ] 새 PR 필터링
- [ ] 이미 리뷰한 PR 스킵
- [ ] 새 커밋 감지
- [ ] DB에 PR 상태 저장

**Technical Details**:
```typescript
interface PRMonitorState {
  prNumber: number;
  lastCommitSha: string;
  reviewStatus: 'pending' | 'in_progress' | 'completed';
  lastCheckedAt: Date;
}
```

**Dependencies**: F1.7, F3.1
**Blockers**: None

---

### F3.3: Diff 분석 기능
**Priority**: P0
**Epic**: Code Review Agent
**Estimated Effort**: 3-4 days

**User Story**:
As a code review agent, I need to analyze code changes in a PR.

**Acceptance Criteria**:
- [ ] Unified diff 파싱
- [ ] 파일별 변경사항 추출
- [ ] 변경 타입 분류 (added, modified, deleted)
- [ ] 코드 블록 추출
- [ ] 컨텍스트 라인 포함
- [ ] 큰 diff 처리 (청킹)

**Technical Details**:
```typescript
interface DiffAnalysis {
  files: FileDiff[];
  stats: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  chunks: DiffChunk[];
}
```

**Dependencies**: F1.7, F3.1
**Blockers**: None

---

### F3.4: 자동 코드 리뷰 (LLM 기반)
**Priority**: P0
**Epic**: Code Review Agent
**Estimated Effort**: 5-7 days

**User Story**:
As a code review agent, I need to review code changes and provide constructive feedback.

**Acceptance Criteria**:
- [ ] 프롬프트 설계 (코드 리뷰어 persona)
- [ ] 파일별 리뷰 수행
- [ ] 이슈 분류 (bug, performance, style, security)
- [ ] 심각도 레벨 (critical, major, minor, nit)
- [ ] 개선 제안 생성
- [ ] 코드 예제 제공
- [ ] 긍정적 피드백 포함

**Technical Details**:
```typescript
interface ReviewComment {
  path: string;
  line: number;
  body: string;
  severity: 'critical' | 'major' | 'minor' | 'nit';
  category: 'bug' | 'performance' | 'style' | 'security' | 'best-practice';
  suggestedChange?: string;
}
```

**Dependencies**: F1.6, F3.3
**Blockers**: None

---

### F3.5: GitHub 리뷰 코멘트 작성
**Priority**: P0
**Epic**: Code Review Agent
**Estimated Effort**: 2-3 days

**User Story**:
As a code review agent, I need to post review comments to GitHub PRs.

**Acceptance Criteria**:
- [ ] PR Review API 호출
- [ ] 라인별 코멘트 작성
- [ ] 전체 리뷰 요약 작성
- [ ] Review 상태 설정 (COMMENT, REQUEST_CHANGES, APPROVE)
- [ ] 코멘트 그룹화 (같은 파일)
- [ ] 메시지 발행 (REVIEW_COMMENTS_POSTED)

**Technical Details**:
```typescript
interface CreateReviewOptions {
  prNumber: number;
  event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE';
  body: string;  // 전체 리뷰 요약
  comments: ReviewComment[];
}
```

**Dependencies**: F1.7, F3.4
**Blockers**: None

---

### F3.6: 재검토 기능
**Priority**: P0
**Epic**: Code Review Agent
**Estimated Effort**: 3-4 days

**User Story**:
As a code review agent, I need to re-review PRs after new commits are pushed.

**Acceptance Criteria**:
- [ ] 새 커밋 감지 (메시지 또는 폴링)
- [ ] 증분 diff 분석 (이전 리뷰 이후)
- [ ] 이전 코멘트 해결 여부 확인
- [ ] 새로운 이슈 탐지
- [ ] 해결된 코멘트 마킹
- [ ] 모든 이슈 해결 시 Approve

**Technical Details**:
```typescript
interface ReReviewContext {
  previousCommitSha: string;
  newCommitSha: string;
  previousComments: ReviewComment[];
  resolvedComments: string[];
  newIssues: ReviewComment[];
}
```

**Dependencies**: F3.3, F3.4, F3.5
**Blockers**: None

---

### F3.7: PR Approve 및 머지 준비
**Priority**: P0
**Epic**: Code Review Agent
**Estimated Effort**: 2 days

**User Story**:
As a code review agent, I need to approve PRs when all issues are resolved.

**Acceptance Criteria**:
- [ ] 모든 critical/major 이슈 해결 확인
- [ ] Approve 리뷰 작성
- [ ] 메시지 발행 (REVIEW_APPROVED)
- [ ] DB에 리뷰 완료 상태 저장

**Technical Details**:
```typescript
interface ApprovalDecision {
  approved: boolean;
  reason: string;
  unresolvedIssues: ReviewComment[];
}
```

**Dependencies**: F3.6
**Blockers**: None

---

## 🔧 Phase 4: 레포관리 에이전트 (P0 - Must Have)

### F4.1: 레포관리 에이전트 기본 구조
**Priority**: P0
**Epic**: Repository Manager Agent
**Estimated Effort**: 2-3 days

**User Story**:
As a system, I need a repository manager agent that coordinates between coding and review agents.

**Acceptance Criteria**:
- [ ] Agent 클래스 구현
- [ ] 메시지 수신 루프
- [ ] 상태 머신 구현
- [ ] 이벤트 라우팅 로직
- [ ] DB에 상태 영속화
- [ ] Graceful shutdown

**Technical Details**:
```typescript
enum RepoManagerState {
  IDLE = 'idle',
  MONITORING_REPO = 'monitoring_repo',
  COMMENTS_DETECTED = 'comments_detected',
  NOTIFYING_CODER = 'notifying_coder',
  WAITING_FOR_FIX = 'waiting_for_fix',
  MERGE_DETECTED = 'merge_detected',
  SYNCING_BRANCH = 'syncing_branch',
  TRIGGERING_NEXT_TASK = 'triggering_next_task'
}
```

**Dependencies**: F1.1, F1.2, F1.9
**Blockers**: None

---

### F4.2: 메시지 라우팅
**Priority**: P0
**Epic**: Repository Manager Agent
**Estimated Effort**: 2-3 days

**User Story**:
As a repository manager, I need to route messages between coding and review agents.

**Acceptance Criteria**:
- [ ] PR_CREATED → 코드리뷰 에이전트로 전달
- [ ] REVIEW_COMMENTS_POSTED → 코딩 에이전트로 전달
- [ ] COMMITS_PUSHED → 코드리뷰 에이전트로 전달
- [ ] REVIEW_APPROVED → 자체 처리 (머지)
- [ ] 메시지 변환 및 enrichment
- [ ] 메시지 히스토리 저장

**Technical Details**:
```typescript
class MessageRouter {
  async route(message: AgentMessage): Promise<void>;
  async transform(message: AgentMessage, context: Context): Promise<AgentMessage>;
}
```

**Dependencies**: F4.1
**Blockers**: None

---

### F4.3: PR 자동 머지
**Priority**: P0
**Epic**: Repository Manager Agent
**Estimated Effort**: 2-3 days

**User Story**:
As a repository manager, I need to automatically merge approved PRs.

**Acceptance Criteria**:
- [ ] REVIEW_APPROVED 메시지 수신 처리
- [ ] PR 상태 최종 확인 (CI 통과 등)
- [ ] 스쿼시 머지 수행
- [ ] 머지 성공/실패 처리
- [ ] 메시지 발행 (PR_MERGED)
- [ ] 에러 시 알림

**Technical Details**:
```typescript
interface MergeOptions {
  prNumber: number;
  method: 'merge' | 'squash' | 'rebase';
  commitTitle?: string;
  commitMessage?: string;
  deleteSourceBranch?: boolean;
}
```

**Dependencies**: F1.7, F4.1
**Blockers**: None

---

### F4.4: 브랜치 동기화
**Priority**: P0
**Epic**: Repository Manager Agent
**Estimated Effort**: 2 days

**User Story**:
As a repository manager, I need to sync local branches after PR merges.

**Acceptance Criteria**:
- [ ] PR 머지 후 main 브랜치로 전환
- [ ] git pull 수행
- [ ] 로컬 상태 업데이트
- [ ] 코딩 에이전트에게 알림

**Technical Details**:
```typescript
async function syncAfterMerge(prNumber: number): Promise<void> {
  await git.checkout('main');
  await git.pull('origin', 'main');
  await publishMessage({ type: 'BRANCH_SYNCED', payload: { prNumber } });
}
```

**Dependencies**: F1.8, F4.3
**Blockers**: None

---

### F4.5: 다음 작업 트리거
**Priority**: P0
**Epic**: Repository Manager Agent
**Estimated Effort**: 2 days

**User Story**:
As a repository manager, I need to trigger the next feature implementation after a PR is merged.

**Acceptance Criteria**:
- [ ] PR 머지 및 동기화 완료 확인
- [ ] 다음 기능 조회 (DB에서 pending features)
- [ ] CONTINUE_NEXT_FEATURE 메시지 발행
- [ ] 모든 기능 완료 시 ALL_FEATURES_COMPLETE 발행

**Technical Details**:
```typescript
async function triggerNextFeature(jobId: string): Promise<void> {
  const nextFeature = await db.feature.findFirst({
    where: { jobId, status: 'pending' },
    orderBy: { priority: 'asc' }
  });

  if (nextFeature) {
    await publishMessage({
      type: 'CONTINUE_NEXT_FEATURE',
      payload: { featureId: nextFeature.id }
    });
  } else {
    await publishMessage({ type: 'ALL_FEATURES_COMPLETE', payload: { jobId } });
  }
}
```

**Dependencies**: F1.9, F4.4
**Blockers**: None

---

## 🔗 Phase 5: 통합 및 백그라운드 실행 (P0 - Must Have)

### F5.1: E2E 워크플로우 테스트
**Priority**: P0
**Epic**: Integration
**Estimated Effort**: 5-7 days

**User Story**:
As a developer, I need end-to-end tests to ensure the entire workflow works correctly.

**Acceptance Criteria**:
- [ ] 테스트 리포지토리 설정
- [ ] Mock LLM 응답 (또는 실제 API with small prompts)
- [ ] 전체 워크플로우 자동화 테스트
- [ ] 각 단계 검증 (PR 생성, 리뷰, 머지)
- [ ] 에러 시나리오 테스트 (실패 복구)
- [ ] 성능 측정

**Technical Details**:
```typescript
describe('E2E Workflow', () => {
  it('should complete full feature implementation cycle', async () => {
    // 1. Start project
    // 2. Wait for PR creation
    // 3. Wait for review comments
    // 4. Wait for fixes
    // 5. Wait for approval
    // 6. Wait for merge
    // 7. Verify next feature starts
  });
});
```

**Dependencies**: F2.x, F3.x, F4.x
**Blockers**: None

---

### F5.2: Process Manager 통합 (PM2 또는 tmux)
**Priority**: P0
**Epic**: Integration
**Estimated Effort**: 2-3 days

**User Story**:
As an operator, I need a process manager to run agents in the background 24/7.

**Acceptance Criteria**:
- [ ] PM2 ecosystem 파일 작성
- [ ] 또는 tmux 실행 스크립트 작성
- [ ] 각 에이전트별 프로세스 분리
- [ ] 자동 재시작 설정
- [ ] 로그 관리 설정
- [ ] 헬스 체크 스크립트

**Technical Details**:
```json
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'coder-agent',
      script: 'dist/agents/coder/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' }
    },
    // ... reviewer, repo-manager
  ]
};
```

**Dependencies**: F2.1, F3.1, F4.1
**Blockers**: None

---

### F5.3: 헬스 체크 및 모니터링
**Priority**: P0
**Epic**: Integration
**Estimated Effort**: 2-3 days

**User Story**:
As an operator, I need health check endpoints to monitor agent status.

**Acceptance Criteria**:
- [ ] HTTP 헬스 체크 서버 (Express)
- [ ] 각 에이전트 상태 조회 API
- [ ] NATS 연결 상태 체크
- [ ] DB 연결 상태 체크
- [ ] 마지막 활동 시간 추적
- [ ] Prometheus 메트릭 (선택적)

**Technical Details**:
```typescript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    agents: {
      coder: await checkAgentHealth('coder'),
      reviewer: await checkAgentHealth('reviewer'),
      repoManager: await checkAgentHealth('repo-manager')
    },
    dependencies: {
      nats: await checkNatsHealth(),
      database: await checkDatabaseHealth()
    }
  };
  res.json(health);
});
```

**Dependencies**: F1.1, F1.9
**Blockers**: None

---

### F5.4: CLI 인터페이스
**Priority**: P0
**Epic**: Integration
**Estimated Effort**: 2-3 days

**User Story**:
As a user, I need a CLI to start projects and monitor progress.

**Acceptance Criteria**:
- [ ] Commander.js 기반 CLI
- [ ] `start-project` 명령어
- [ ] `list-jobs` 명령어
- [ ] `job-status <job-id>` 명령어
- [ ] `stop-job <job-id>` 명령어
- [ ] Pretty 출력 (chalk, ora)

**Technical Details**:
```bash
# 사용 예시
multi-agent start-project --repo https://github.com/user/repo \
  --requirements "Build a blog with auth"

multi-agent list-jobs

multi-agent job-status abc-123

multi-agent stop-job abc-123
```

**Dependencies**: F1.9
**Blockers**: None

---

### F5.5: 알림 시스템
**Priority**: P1
**Epic**: Integration
**Estimated Effort**: 2-3 days

**User Story**:
As a user, I want to receive notifications when important events occur (PR created, all features complete, errors).

**Acceptance Criteria**:
- [ ] Slack webhook 지원
- [ ] Discord webhook 지원
- [ ] 이메일 알림 (선택적)
- [ ] 알림 레벨 설정 (info, warning, error)
- [ ] 알림 템플릿

**Technical Details**:
```typescript
interface NotificationOptions {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  url?: string;
}

async function sendNotification(options: NotificationOptions): Promise<void>;
```

**Dependencies**: F1.4
**Blockers**: None

---

## 🚀 Phase 6: 고급 기능 (P1/P2 - Should/Could Have)

### F6.1: 병렬 기능 개발
**Priority**: P1
**Epic**: Advanced Features
**Estimated Effort**: 5-7 days

**User Story**:
As a system, I want to develop multiple independent features in parallel to reduce total completion time.

**Acceptance Criteria**:
- [ ] 의존성 그래프 분석
- [ ] 독립적인 기능 식별
- [ ] 여러 코딩 에이전트 인스턴스 실행
- [ ] 브랜치 충돌 방지
- [ ] 병렬 PR 관리
- [ ] 머지 순서 조정

**Dependencies**: All Phase 2-4
**Blockers**: None

---

### F6.2: 지능형 우선순위 조정
**Priority**: P2
**Epic**: Advanced Features
**Estimated Effort**: 3-4 days

**User Story**:
As a system, I want to dynamically adjust feature priorities based on importance and dependencies.

**Acceptance Criteria**:
- [ ] 우선순위 알고리즘 구현
- [ ] 의존성 기반 스케줄링
- [ ] 사용자 피드백 반영
- [ ] 우선순위 재계산

**Dependencies**: F2.2
**Blockers**: None

---

### F6.3: 테스트 자동 실행
**Priority**: P1
**Epic**: Advanced Features
**Estimated Effort**: 3-4 days

**User Story**:
As a code review agent, I want to run tests automatically before approving PRs.

**Acceptance Criteria**:
- [ ] CI/CD 상태 확인
- [ ] 로컬 테스트 실행 (선택적)
- [ ] 테스트 실패 시 코멘트 작성
- [ ] 커버리지 확인

**Dependencies**: F3.7
**Blockers**: None

---

### F6.4: 코드 스타일 학습
**Priority**: P2
**Epic**: Advanced Features
**Estimated Effort**: 5-7 days

**User Story**:
As a coding agent, I want to learn the project's code style to generate consistent code.

**Acceptance Criteria**:
- [ ] 기존 코드베이스 분석
- [ ] 스타일 패턴 추출
- [ ] 프롬프트에 스타일 가이드 추가
- [ ] ESLint/Prettier 설정 준수

**Dependencies**: F2.3
**Blockers**: None

---

### F6.5: 대화형 피드백
**Priority**: P2
**Epic**: Advanced Features
**Estimated Effort**: 3-5 days

**User Story**:
As a user, I want to provide feedback during development to adjust the direction.

**Acceptance Criteria**:
- [ ] 사용자 입력 대기 메커니즘
- [ ] 대화형 CLI 모드
- [ ] 피드백을 다음 작업에 반영
- [ ] 피드백 히스토리 저장

**Dependencies**: F5.4
**Blockers**: None

---

### F6.6: GitHub Webhook 지원
**Priority**: P1
**Epic**: Advanced Features
**Estimated Effort**: 2-3 days

**User Story**:
As a system, I want to use GitHub webhooks instead of polling for real-time PR events.

**Acceptance Criteria**:
- [ ] Webhook 수신 HTTP 서버
- [ ] PR opened 이벤트 처리
- [ ] PR updated 이벤트 처리
- [ ] Review submitted 이벤트 처리
- [ ] 보안 (HMAC 검증)

**Dependencies**: F3.2
**Blockers**: None

---

### F6.7: 리뷰 품질 개선 (Fine-tuning)
**Priority**: P2
**Epic**: Advanced Features
**Estimated Effort**: 7-10 days

**User Story**:
As a system, I want to improve review quality over time based on human feedback.

**Acceptance Criteria**:
- [ ] 리뷰 피드백 수집
- [ ] Few-shot 예제 구축
- [ ] 프롬프트 개선
- [ ] 리뷰 품질 메트릭 추적

**Dependencies**: F3.4
**Blockers**: None

---

### F6.8: 멀티 리포지토리 지원
**Priority**: P2
**Epic**: Advanced Features
**Estimated Effort**: 3-5 days

**User Story**:
As a user, I want to run the system on multiple repositories simultaneously.

**Acceptance Criteria**:
- [ ] 리포지토리별 격리
- [ ] 리포지토리별 설정
- [ ] 리소스 제한 (rate limiting)
- [ ] 리포지토리 간 우선순위

**Dependencies**: F4.1
**Blockers**: None

---

## 📊 Feature Summary

### By Priority
- **P0 (Must Have)**: 39 features
- **P1 (Should Have)**: 4 features
- **P2 (Could Have)**: 5 features
- **Total**: 48 features

### By Phase
- **Phase 1 (Infrastructure)**: 9 features (P0)
- **Phase 2 (Coding Agent)**: 6 features (P0)
- **Phase 3 (Review Agent)**: 7 features (P0)
- **Phase 4 (Repo Manager)**: 5 features (P0)
- **Phase 5 (Integration)**: 5 features (P0)
- **Phase 6 (Advanced)**: 8 features (P1/P2)

### Estimated Timeline
- **Phase 1**: 3-4 weeks
- **Phase 2**: 3-4 weeks
- **Phase 3**: 2-3 weeks
- **Phase 4**: 1-2 weeks
- **Phase 5**: 2-3 weeks
- **MVP (Phase 1-5)**: ~11-16 weeks (~3-4 months)
- **With Advanced Features**: +4-6 weeks

---

## 🎯 MVP Feature Set (Phase 1-5)

For initial launch, focus on these 26 P0 features:

### Infrastructure (9)
✅ F1.1-F1.9

### Coding Agent (6)
✅ F2.1-F2.6

### Review Agent (7)
✅ F3.1-F3.7

### Repo Manager (5)
✅ F4.1-F4.5

### Integration (5)
✅ F5.1-F5.5 (excluding F5.5 notification if time-constrained)

This MVP will deliver the core autonomous coding workflow: Requirements → Plan → Implement → Review → Fix → Merge → Repeat.
