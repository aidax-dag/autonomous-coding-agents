# Feature Improvements Roadmap

> **버전**: 1.0
> **작성일**: 2026-01-24
> **목적**: UNIFIED_VISION.md 실현을 위한 구체적인 기능 개선 계획

---

## 1. 현재 코드베이스 분석

### 1.1 구현 완료된 에이전트

| 에이전트 | 파일 | 코드 라인 | 핵심 기능 |
|----------|------|----------|----------|
| **BaseAgent** | `base/agent.ts` | ~460줄 | 생명주기, 메트릭, 이벤트 발행 |
| **CoderAgent** | `coder/coder-agent.ts` | ~570줄 | LLM 코드 생성, Git 작업, 검증 |
| **ReviewerAgent** | `reviewer/reviewer-agent.ts` | ~565줄 | PR 리뷰, CI 체크, GitHub 통합 |
| **RepoManagerAgent** | `repo-manager/repo-manager-agent.ts` | ~520줄 | 워크플로우 조율, PR 라이프사이클 |

### 1.2 강점 분석

```typescript
// ✅ 잘 구현된 패턴들

// 1. Zod 기반 강력한 validation
const ImplementationPayloadSchema = z.object({
  repository: z.object({ owner: z.string().min(1), ... }),
  ...
});

// 2. 체계적인 에러 처리
if (!validationResult.success) {
  throw new AgentError(
    'Invalid implementation request payload',
    ErrorCode.VALIDATION_ERROR,
    false,
    { errors: validationResult.error.errors }
  );
}

// 3. Retry with Backoff
private async retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> { ... }

// 4. 이벤트 기반 통신
await this.publishEvent({
  type: AgentEventType.TASK_COMPLETED,
  agentId: this.config.id,
  ...
});
```

### 1.3 개선 필요 영역

| 영역 | 현재 상태 | 개선 필요 사항 |
|------|----------|---------------|
| **페르소나** | 미구현 | AgentConfig에 persona 필드 추가 |
| **문서 생성** | 미구현 | HLD/MLD/LLD Generator 모듈 |
| **지식 저장** | 미구현 | Knowledge Layer (PostgreSQL MVP) |
| **학습** | 로깅만 | 구조화된 에러/패턴 저장 |
| **재사용** | 미구현 | Feature Store |
| **Orchestrator** | RepoManager가 부분적 수행 | 전용 Orchestrator 에이전트 |

---

## 2. Phase 1 기능 개선 (필수)

### 2.1 에이전트 페르소나 시스템

**목표**: 각 에이전트에 고유한 성격과 전문성 부여

**구현 위치**: `src/agents/base/types.ts`

```typescript
// 추가할 인터페이스
export interface AgentPersona {
  name: string;
  title: string;
  style: 'analytical' | 'creative' | 'practical' | 'cautious';
  expertise: string[];
  communication: 'formal' | 'casual' | 'technical';
  systemPromptTemplate: string;
}

// AgentConfig 확장
export interface AgentConfig {
  // ... 기존 필드
  persona?: AgentPersona;
}
```

**적용 예시**:

```typescript
// src/agents/coder/personas/senior-engineer.ts
export const seniorEngineerPersona: AgentPersona = {
  name: 'Alex',
  title: 'Senior Software Engineer',
  style: 'practical',
  expertise: ['TypeScript', 'Node.js', 'Clean Code', 'TDD'],
  communication: 'technical',
  systemPromptTemplate: `
You are {{name}}, a {{title}} with 10+ years of experience.

Your approach:
- Write clean, well-tested TypeScript code
- Follow SOLID principles and Clean Architecture
- Prefer simple solutions over complex architectures
- Always consider edge cases and error handling

Expertise areas: {{expertise}}
`,
};
```

**작업 항목**:
- [ ] `AgentPersona` 인터페이스 정의
- [ ] `AgentConfig`에 `persona` 필드 추가
- [ ] `BaseAgent`에서 페르소나 기반 시스템 프롬프트 생성
- [ ] 3개 에이전트 기본 페르소나 정의
- [ ] 테스트 추가

**예상 작업량**: 2-3일

---

### 2.2 시스템 프롬프트 개선

**목표**: 페르소나 기반 동적 시스템 프롬프트 생성

**현재 상태** (`coder-agent.ts:294-296`):
```typescript
{
  role: 'system',
  content: 'You are an expert software engineer. Generate clean, well-tested TypeScript code.',
}
```

**개선안**:

```typescript
// src/agents/base/prompt-builder.ts
export class PromptBuilder {
  private persona: AgentPersona;
  private context: Record<string, string>;

  constructor(persona: AgentPersona) {
    this.persona = persona;
    this.context = {
      name: persona.name,
      title: persona.title,
      expertise: persona.expertise.join(', '),
    };
  }

  buildSystemPrompt(): string {
    return this.interpolate(this.persona.systemPromptTemplate, this.context);
  }

  buildTaskPrompt(task: Task, additionalContext?: Record<string, string>): string {
    // 태스크 유형에 따른 프롬프트 생성
    const context = { ...this.context, ...additionalContext };
    // ...
  }

  private interpolate(template: string, context: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
  }
}
```

**작업 항목**:
- [ ] `PromptBuilder` 클래스 구현
- [ ] 각 에이전트에 PromptBuilder 통합
- [ ] 태스크 유형별 프롬프트 템플릿 정의
- [ ] 기존 하드코딩된 프롬프트 마이그레이션
- [ ] 테스트 추가

**예상 작업량**: 3-4일

---

### 2.3 에러 학습 시스템 (기초)

**목표**: 반복 에러 감지 및 학습

**현재 상태**: 로깅만 (`AgentError` → 로그 출력)

**개선안**:

```typescript
// src/shared/learning/error-tracker.ts
export interface ErrorRecord {
  id: string;
  errorType: string;
  errorMessage: string;
  context: Record<string, unknown>;
  agentType: AgentType;
  taskType: string;
  fixApplied?: string;
  frequency: number;
  lastOccurred: Date;
  resolved: boolean;
}

export class ErrorTracker {
  private storage: ErrorStorage; // PostgreSQL 또는 인메모리

  async recordError(error: AgentError, task: Task): Promise<void> {
    const existing = await this.findSimilarError(error);

    if (existing) {
      await this.incrementFrequency(existing.id);
    } else {
      await this.createNewRecord(error, task);
    }
  }

  async findSimilarError(error: AgentError): Promise<ErrorRecord | null> {
    // 에러 유형과 메시지 패턴으로 유사 에러 검색
  }

  async getFrequentErrors(limit: number = 10): Promise<ErrorRecord[]> {
    // 빈도순 상위 에러 반환
  }

  async markResolved(errorId: string, fix: string): Promise<void> {
    // 해결책 기록
  }
}
```

**작업 항목**:
- [ ] `ErrorRecord` 인터페이스 정의
- [ ] `ErrorTracker` 클래스 구현 (인메모리 먼저)
- [ ] `BaseAgent`에 ErrorTracker 통합
- [ ] 에러 발생 시 자동 기록
- [ ] 빈도 분석 API 추가
- [ ] 테스트 추가

**예상 작업량**: 3-4일

---

### 2.4 메트릭 강화

**목표**: 더 상세한 운영 지표 수집

**현재 상태** (`base/agent.ts:373-394`):
```typescript
getHealth(): HealthStatus {
  return {
    healthy: ...,
    tasksProcessed: this.tasksProcessed,
    tasksFailed: this.tasksFailed,
    averageTaskDuration,
    errorRate,
    ...
  };
}
```

**개선안**:

```typescript
// src/shared/metrics/metrics-collector.ts
export interface DetailedMetrics extends HealthStatus {
  // 성능 지표
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;

  // LLM 지표
  llmCalls: number;
  llmTokensUsed: number;
  llmCost: number;
  llmErrorRate: number;

  // 품질 지표
  reviewApprovalRate: number;
  codeValidationSuccessRate: number;

  // 리소스 지표
  memoryUsage: number;
  cpuUsage: number;
}

export class MetricsCollector {
  private latencies: number[] = [];
  private llmMetrics: LLMMetrics = { calls: 0, tokens: 0, cost: 0, errors: 0 };

  recordLatency(duration: number): void {
    this.latencies.push(duration);
    // 최근 1000개만 유지
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }
  }

  recordLLMCall(tokens: number, cost: number, success: boolean): void {
    this.llmMetrics.calls++;
    this.llmMetrics.tokens += tokens;
    this.llmMetrics.cost += cost;
    if (!success) this.llmMetrics.errors++;
  }

  getPercentile(p: number): number {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  getDetailedMetrics(): DetailedMetrics {
    return {
      p50Latency: this.getPercentile(50),
      p95Latency: this.getPercentile(95),
      p99Latency: this.getPercentile(99),
      llmCalls: this.llmMetrics.calls,
      llmTokensUsed: this.llmMetrics.tokens,
      llmCost: this.llmMetrics.cost,
      llmErrorRate: this.llmMetrics.calls > 0
        ? this.llmMetrics.errors / this.llmMetrics.calls * 100
        : 0,
      ...
    };
  }
}
```

**작업 항목**:
- [ ] `DetailedMetrics` 인터페이스 정의
- [ ] `MetricsCollector` 클래스 구현
- [ ] `BaseAgent`에 MetricsCollector 통합
- [ ] LLM 호출 시 메트릭 기록
- [ ] Prometheus 호환 출력 형식 추가
- [ ] 테스트 추가

**예상 작업량**: 2-3일

---

## 3. Phase 2 기능 개선 (권장)

### 3.1 HLD/MLD/LLD 문서 생성 시스템

**목표**: 요구사항에서 설계 문서 자동 생성

**아키텍처**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Document Generation Pipeline                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐                                                  │
│  │ Requirements   │                                                  │
│  │ (input)        │                                                  │
│  └───────┬────────┘                                                  │
│          │                                                           │
│          ▼                                                           │
│  ┌────────────────┐    ┌────────────────┐                           │
│  │ HLD Generator  │───►│ HLD Document   │                           │
│  │ (LLM + 템플릿) │    │ - Overview     │                           │
│  └───────┬────────┘    │ - Architecture │                           │
│          │             │ - Components   │                           │
│          │             │ - Decisions    │                           │
│          │             └────────────────┘                           │
│          ▼                                                           │
│  ┌────────────────┐    ┌────────────────┐                           │
│  │ MLD Generator  │───►│ MLD Document   │                           │
│  │ (LLM + 템플릿) │    │ - APIs         │                           │
│  └───────┬────────┘    │ - Data Models  │                           │
│          │             │ - Interfaces   │                           │
│          │             │ - Error Codes  │                           │
│          │             └────────────────┘                           │
│          ▼                                                           │
│  ┌────────────────┐    ┌────────────────┐                           │
│  │ LLD Generator  │───►│ LLD Document   │                           │
│  │ (LLM + 템플릿) │    │ - Functions    │                           │
│  └────────────────┘    │ - DB Schema    │                           │
│                        │ - Test Cases   │                           │
│                        │ - Code Snippets│                           │
│                        └────────────────┘                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**핵심 인터페이스**:

```typescript
// src/core/documentation/types.ts
export interface HLDDocument {
  version: string;
  createdAt: Date;
  overview: {
    summary: string;
    goals: string[];
    scope: string;
    outOfScope: string[];
  };
  architecture: {
    diagram: string; // Mermaid or PlantUML
    components: Component[];
    dataFlow: DataFlow[];
    integrations: Integration[];
  };
  decisions: ArchitectureDecision[];
  constraints: string[];
  risks: Risk[];
}

export interface MLDDocument {
  version: string;
  hldReference: string;
  apis: APISpec[];
  dataModels: DataModel[];
  interfaces: InterfaceSpec[];
  errorCodes: ErrorCode[];
  sequenceDiagrams: string[];
}

export interface LLDDocument {
  version: string;
  mldReference: string;
  functions: FunctionSpec[];
  dbSchema: {
    tables: TableSchema[];
    indexes: Index[];
    migrations: Migration[];
  };
  testCases: TestCase[];
  codeSnippets: CodeSnippet[];
}
```

**작업 항목**:
- [ ] 문서 타입 인터페이스 정의
- [ ] HLD 템플릿 및 Generator 구현
- [ ] MLD 템플릿 및 Generator 구현
- [ ] LLD 템플릿 및 Generator 구현
- [ ] 문서 유효성 검증 로직
- [ ] 피드백 기반 문서 개선 루프
- [ ] 테스트 추가

**예상 작업량**: 2주

---

### 3.2 ArchitectAgent 구현

**목표**: 설계 문서 생성 전담 에이전트

**파일 구조**:
```
src/agents/architect/
├── index.ts
├── architect-agent.ts
├── personas/
│   └── system-architect.ts
├── generators/
│   ├── hld-generator.ts
│   ├── mld-generator.ts
│   └── lld-generator.ts
└── templates/
    ├── hld-template.md
    ├── mld-template.md
    └── lld-template.md
```

**ArchitectAgent 핵심 코드**:

```typescript
// src/agents/architect/architect-agent.ts
export class ArchitectAgent extends BaseAgent {
  private hldGenerator: HLDGenerator;
  private mldGenerator: MLDGenerator;
  private lldGenerator: LLDGenerator;

  getAgentType(): AgentType {
    return AgentType.ARCHITECT;
  }

  async processTask(task: Task): Promise<TaskResult> {
    const taskType = (task as DesignTask).payload.documentType;

    switch (taskType) {
      case 'HLD':
        return this.generateHLD(task);
      case 'MLD':
        return this.generateMLD(task);
      case 'LLD':
        return this.generateLLD(task);
      case 'FULL':
        return this.generateFullDesign(task);
      default:
        throw new AgentError('Unknown document type', ErrorCode.VALIDATION_ERROR);
    }
  }

  private async generateHLD(task: Task): Promise<TaskResult> {
    const requirements = (task as DesignTask).payload.requirements;
    const hld = await this.hldGenerator.generate(requirements);
    return {
      taskId: task.id,
      status: TaskStatus.COMPLETED,
      success: true,
      data: { document: hld, type: 'HLD' },
    };
  }

  private async generateFullDesign(task: Task): Promise<TaskResult> {
    const requirements = (task as DesignTask).payload.requirements;

    // HLD → MLD → LLD 순차 생성
    const hld = await this.hldGenerator.generate(requirements);
    const mld = await this.mldGenerator.generate(hld);
    const lld = await this.lldGenerator.generate(mld);

    return {
      taskId: task.id,
      status: TaskStatus.COMPLETED,
      success: true,
      data: {
        documents: { hld, mld, lld },
        type: 'FULL_DESIGN'
      },
    };
  }
}
```

**작업 항목**:
- [ ] `AgentType.ARCHITECT` 추가
- [ ] ArchitectAgent 기본 구조 구현
- [ ] HLD/MLD/LLD Generator 통합
- [ ] 시스템 아키텍트 페르소나 정의
- [ ] NATS 토픽 설정
- [ ] RepoManagerAgent에서 ArchitectAgent 호출 로직 추가
- [ ] 테스트 추가

**예상 작업량**: 1.5주

---

### 3.3 TesterAgent 구현

**목표**: 테스트 자동화 전담 에이전트

**핵심 기능**:
1. 테스트 케이스 자동 생성
2. 테스트 실행 및 결과 분석
3. 커버리지 보고서 생성
4. 실패 테스트 디버깅 제안

**작업 항목**:
- [ ] `AgentType.TESTER` 추가
- [ ] TesterAgent 기본 구조 구현
- [ ] 테스트 케이스 생성 로직
- [ ] Jest/Vitest 실행 통합
- [ ] 커버리지 분석 로직
- [ ] 테스트 추가

**예상 작업량**: 1주

---

## 4. Phase 3 기능 개선 (선택)

### 4.1 Knowledge Layer MVP

**목표**: PostgreSQL 기반 지식 저장 시스템

**스키마**:

```sql
-- 프로젝트
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  repository_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 기능
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  code_paths TEXT[],
  tags TEXT[],
  embedding VECTOR(1536), -- OpenAI embedding (Phase 4에서 활성화)
  reuse_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 패턴
CREATE TABLE patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  pattern_type VARCHAR(50), -- 'design', 'code', 'test', 'error'
  language VARCHAR(50),
  code_template TEXT,
  context JSONB,
  success_rate DECIMAL(5,2) DEFAULT 100.00,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 학습 기록
CREATE TABLE learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type VARCHAR(100),
  error_message TEXT,
  fix_applied TEXT,
  agent_type VARCHAR(50),
  task_type VARCHAR(50),
  frequency INTEGER DEFAULT 1,
  resolved BOOLEAN DEFAULT false,
  last_occurred TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_features_project ON features(project_id);
CREATE INDEX idx_features_tags ON features USING GIN(tags);
CREATE INDEX idx_patterns_type ON patterns(pattern_type);
CREATE INDEX idx_learnings_error_type ON learnings(error_type);
```

**Repository 구현**:

```typescript
// src/shared/knowledge/feature-repository.ts
export class FeatureRepository {
  constructor(private db: PrismaClient) {}

  async create(feature: CreateFeatureDTO): Promise<Feature> {
    return this.db.feature.create({ data: feature });
  }

  async findSimilar(description: string, limit: number = 5): Promise<Feature[]> {
    // Phase 3: 태그 기반 검색
    // Phase 4: 벡터 유사도 검색으로 업그레이드
    const tags = this.extractTags(description);
    return this.db.feature.findMany({
      where: { tags: { hasSome: tags } },
      orderBy: { reuse_count: 'desc' },
      take: limit,
    });
  }

  async incrementReuseCount(featureId: string): Promise<void> {
    await this.db.feature.update({
      where: { id: featureId },
      data: { reuse_count: { increment: 1 } },
    });
  }

  private extractTags(description: string): string[] {
    // 간단한 키워드 추출 (Phase 4에서 LLM 기반으로 개선)
    const keywords = description.toLowerCase().match(/\b\w{4,}\b/g) || [];
    return [...new Set(keywords)].slice(0, 10);
  }
}
```

**작업 항목**:
- [ ] Prisma 스키마 정의
- [ ] 마이그레이션 생성
- [ ] Repository 클래스 구현
- [ ] 에이전트에서 Knowledge Layer 연동
- [ ] CLI에서 지식 조회 명령 추가
- [ ] 테스트 추가

**예상 작업량**: 1.5주

---

## 5. 우선순위 및 일정

### 5.1 MoSCoW 분류

| 우선순위 | 기능 | 예상 작업량 |
|----------|------|------------|
| **Must** | 페르소나 시스템 | 2-3일 |
| **Must** | 시스템 프롬프트 개선 | 3-4일 |
| **Must** | 에러 학습 (기초) | 3-4일 |
| **Should** | 메트릭 강화 | 2-3일 |
| **Should** | HLD/MLD/LLD 생성 | 2주 |
| **Should** | ArchitectAgent | 1.5주 |
| **Could** | TesterAgent | 1주 |
| **Could** | Knowledge Layer MVP | 1.5주 |

### 5.2 실행 일정

```
Week 1-2:
├── [Must] 페르소나 시스템 구현
├── [Must] 시스템 프롬프트 개선
└── [Must] 에러 학습 시스템 (기초)

Week 3-4:
├── [Should] 메트릭 강화
├── [Should] HLD/MLD/LLD 설계
└── [Should] HLD Generator POC

Week 5-6:
├── [Should] MLD/LLD Generator
├── [Should] ArchitectAgent 기본 구현
└── [Could] TesterAgent 시작

Week 7-8:
├── [Could] TesterAgent 완료
├── [Could] Knowledge Layer 스키마
└── [Could] Feature Repository 구현
```

---

## 6. 성공 지표

### 6.1 Phase 1 완료 기준

| 지표 | 목표값 | 측정 방법 |
|------|--------|----------|
| 페르소나 적용률 | 100% | 모든 에이전트에 페르소나 설정 |
| 에러 추적률 | 100% | 모든 에러가 ErrorTracker에 기록 |
| 테스트 커버리지 | 80%+ | Jest coverage report |
| 코드 품질 | 0 lint errors | ESLint 결과 |

### 6.2 Phase 2 완료 기준

| 지표 | 목표값 | 측정 방법 |
|------|--------|----------|
| HLD 생성 성공률 | 70%+ | 수동 검토 |
| MLD 일관성 | 80%+ | HLD 대비 일치율 |
| ArchitectAgent 응답 시간 | <60초 | 성능 테스트 |

### 6.3 Phase 3 완료 기준

| 지표 | 목표값 | 측정 방법 |
|------|--------|----------|
| Feature 재사용률 | 10%+ | 유사 Feature 매칭 성공률 |
| Knowledge 조회 시간 | <100ms | 성능 테스트 |
| 패턴 저장률 | 100% | 성공 케이스 자동 저장 |

---

## 7. 리스크 및 대응

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| LLM 비용 증가 | 높음 | 중 | 캐싱, 로컬 모델 검토 |
| 문서 품질 불일치 | 중 | 중 | 검증 게이트, 피드백 루프 |
| 복잡도 증가 | 중 | 높음 | 단순화 우선, 점진적 추가 |
| 테스트 부족 | 중 | 높음 | TDD 적용, 커버리지 목표 |

---

## 8. 다음 단계

### 즉시 실행 (오늘)

1. [ ] `AgentPersona` 인터페이스 `types.ts`에 추가
2. [ ] `PromptBuilder` 클래스 기본 구조 생성
3. [ ] 기존 테스트 실행 및 상태 확인

### 이번 주

1. [ ] 페르소나 시스템 구현 완료
2. [ ] Coder/Reviewer/RepoManager 페르소나 정의
3. [ ] 시스템 프롬프트 마이그레이션

### 다음 주

1. [ ] 에러 학습 시스템 구현
2. [ ] 메트릭 강화 구현
3. [ ] HLD Generator POC 시작

---

*이 문서는 UNIFIED_VISION.md와 함께 관리되며, 진행 상황에 따라 업데이트됩니다.*
