# Technical Design & Patterns
## Autonomous Coding Agents - 기술적 설계 및 디자인 패턴

> 작성일: 2026-01-25
> 버전: 1.0
> 목적: 상용 프로덕트 수준의 기술적 설계 및 아키텍처 패턴 정의

---

## 1. Architecture Overview

### 1.1 System Architecture (Layered + Event-Driven Hybrid)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Layer                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  REST API   │  │  WebSocket  │  │     CLI     │  │   Web UI    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                           Application Layer                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Orchestrator                                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │Task Router │  │  Workflow  │  │ DAG Engine │  │  Scheduler │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                            Agent Layer                                       │
│  ┌───────────────────────────────┐  ┌───────────────────────────────┐      │
│  │     Executive Agents          │  │       Worker Agents            │      │
│  │  ┌─────┐ ┌────┐ ┌──────────┐ │  │  ┌──────┐ ┌────────┐ ┌────┐   │      │
│  │  │ CTO │ │ PM │ │ Architect│ │  │  │Coder │ │Reviewer│ │ QA │   │      │
│  │  └─────┘ └────┘ └──────────┘ │  │  └──────┘ └────────┘ └────┘   │      │
│  └───────────────────────────────┘  └───────────────────────────────┘      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                            Core Layer                                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Document  │  │  Knowledge │  │ Self-Improv│  │ Operations │            │
│  │  Generator │  │   Manager  │  │   System   │  │   Manager  │            │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘            │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                        Infrastructure Layer                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  NATS   │ │PostgreSQL│ │  Neo4j  │ │ Vector  │ │  Redis  │ │   LLM   │  │
│  │JetStream│ │(Prisma)  │ │  Graph  │ │   DB    │ │  Cache  │ │   API   │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 핵심 아키텍처 원칙

| 원칙 | 설명 | 적용 영역 |
|------|------|----------|
| **Event-Driven** | 모든 상태 변화는 이벤트로 전파 | Agent 간 통신 |
| **CQRS** | 명령과 쿼리 분리 | Task 관리 |
| **Event Sourcing** | 이벤트 기반 상태 재구성 | Audit, Recovery |
| **Microkernel** | 핵심 기능 + 플러그인 확장 | Tool System |
| **Layered** | 계층별 책임 분리 | 전체 구조 |

---

## 2. Design Patterns

### 2.1 Creational Patterns

#### 2.1.1 Factory Pattern - Agent Creation

**목적**: 에이전트 유형에 따른 인스턴스 생성 캡슐화

```typescript
// src/agents/factory/agent-factory.ts

interface AgentFactory {
  createAgent(type: AgentType, config: AgentConfig): BaseAgent
}

class ConcreteAgentFactory implements AgentFactory {
  private readonly registry: Map<AgentType, new (config: AgentConfig) => BaseAgent>

  constructor() {
    this.registry = new Map([
      [AgentType.CODER, CoderAgent],
      [AgentType.REVIEWER, ReviewerAgent],
      [AgentType.QA, QAAgent],
      [AgentType.CTO, CTOAgent],
      [AgentType.PM, PMAgent],
      [AgentType.ARCHITECT, ArchitectAgent],
    ])
  }

  createAgent(type: AgentType, config: AgentConfig): BaseAgent {
    const AgentClass = this.registry.get(type)
    if (!AgentClass) {
      throw new UnknownAgentTypeError(type)
    }
    return new AgentClass(config)
  }

  registerAgent(type: AgentType, agentClass: new (config: AgentConfig) => BaseAgent): void {
    this.registry.set(type, agentClass)
  }
}

// Usage
const factory = new ConcreteAgentFactory()
const coder = factory.createAgent(AgentType.CODER, coderConfig)
```

#### 2.1.2 Builder Pattern - Document Construction

**목적**: 복잡한 문서 객체의 단계별 구성

```typescript
// src/core/documents/builders/hld-builder.ts

interface HLDBuilder {
  setProjectInfo(info: ProjectInfo): this
  setArchitecture(arch: Architecture): this
  setTechStack(stack: TechStack): this
  setNFR(nfr: NFRSpec): this
  setRisks(risks: Risk[]): this
  build(): HLDDocument
}

class ConcreteHLDBuilder implements HLDBuilder {
  private document: Partial<HLDDocument> = {}

  setProjectInfo(info: ProjectInfo): this {
    this.document.projectName = info.name
    this.document.projectDescription = info.description
    this.document.objectives = info.objectives
    return this
  }

  setArchitecture(arch: Architecture): this {
    this.document.architectureType = arch.type
    this.document.systemDiagram = arch.diagram
    this.document.components = arch.components
    return this
  }

  setTechStack(stack: TechStack): this {
    this.document.technologyStack = stack.decisions
    return this
  }

  setNFR(nfr: NFRSpec): this {
    this.document.nfr = nfr
    return this
  }

  setRisks(risks: Risk[]): this {
    this.document.risks = risks
    return this
  }

  build(): HLDDocument {
    this.validate()
    return this.document as HLDDocument
  }

  private validate(): void {
    const required = ['projectName', 'architectureType', 'technologyStack']
    for (const field of required) {
      if (!(field in this.document)) {
        throw new ValidationError(`Missing required field: ${field}`)
      }
    }
  }
}

// Director
class HLDDirector {
  constructor(private builder: HLDBuilder) {}

  constructMinimalHLD(project: Project): HLDDocument {
    return this.builder
      .setProjectInfo(project.info)
      .setArchitecture(project.architecture)
      .setTechStack(project.techStack)
      .build()
  }

  constructFullHLD(project: Project): HLDDocument {
    return this.builder
      .setProjectInfo(project.info)
      .setArchitecture(project.architecture)
      .setTechStack(project.techStack)
      .setNFR(project.nfr)
      .setRisks(project.risks)
      .build()
  }
}
```

#### 2.1.3 Singleton Pattern - System Services

**목적**: 전역 서비스의 단일 인스턴스 보장

```typescript
// src/infrastructure/knowledge/knowledge-manager.ts

class KnowledgeManager {
  private static instance: KnowledgeManager | null = null
  private neo4jClient: Neo4jClient
  private vectorStore: VectorStore

  private constructor(config: KnowledgeConfig) {
    this.neo4jClient = new Neo4jClient(config.neo4j)
    this.vectorStore = new VectorStore(config.vector)
  }

  static getInstance(config?: KnowledgeConfig): KnowledgeManager {
    if (!KnowledgeManager.instance) {
      if (!config) {
        throw new Error('Configuration required for first initialization')
      }
      KnowledgeManager.instance = new KnowledgeManager(config)
    }
    return KnowledgeManager.instance
  }

  static resetInstance(): void {
    KnowledgeManager.instance = null
  }

  // Methods...
}
```

---

### 2.2 Structural Patterns

#### 2.2.1 Adapter Pattern - LLM Provider Abstraction

**목적**: 다양한 LLM 프로바이더를 통일된 인터페이스로 추상화

```typescript
// src/infrastructure/llm/adapters/

// Target Interface
interface LLMProvider {
  complete(prompt: string, options: CompletionOptions): Promise<CompletionResult>
  chat(messages: Message[], options: ChatOptions): Promise<ChatResult>
  embed(text: string): Promise<number[]>
  getTokenCount(text: string): number
}

// Adaptee - OpenAI
class OpenAIAdapter implements LLMProvider {
  private client: OpenAI

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey })
  }

  async complete(prompt: string, options: CompletionOptions): Promise<CompletionResult> {
    const response = await this.client.completions.create({
      model: options.model || 'gpt-4-turbo',
      prompt,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    })

    return {
      text: response.choices[0].text,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
      },
    }
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResult> {
    const response = await this.client.chat.completions.create({
      model: options.model || 'gpt-4-turbo',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    })

    return {
      message: {
        role: 'assistant',
        content: response.choices[0].message.content || '',
      },
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
      },
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return response.data[0].embedding
  }

  getTokenCount(text: string): number {
    // Use tiktoken or approximation
    return Math.ceil(text.length / 4)
  }
}

// Adaptee - Anthropic
class AnthropicAdapter implements LLMProvider {
  private client: Anthropic

  constructor(config: AnthropicConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
  }

  async complete(prompt: string, options: CompletionOptions): Promise<CompletionResult> {
    // Map to Anthropic's message API
    return this.chat([{ role: 'user', content: prompt }], options as ChatOptions)
      .then(result => ({
        text: result.message.content,
        usage: result.usage,
      }))
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResult> {
    const response = await this.client.messages.create({
      model: options.model || 'claude-3-opus-20240229',
      max_tokens: options.maxTokens || 4096,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    return {
      message: {
        role: 'assistant',
        content: response.content[0].type === 'text' ? response.content[0].text : '',
      },
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
    }
  }

  async embed(text: string): Promise<number[]> {
    // Anthropic doesn't have embeddings, use fallback
    throw new UnsupportedOperationError('Anthropic does not support embeddings')
  }

  getTokenCount(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

// Factory for creating adapters
class LLMProviderFactory {
  static create(provider: 'openai' | 'anthropic' | 'google', config: LLMConfig): LLMProvider {
    switch (provider) {
      case 'openai':
        return new OpenAIAdapter(config as OpenAIConfig)
      case 'anthropic':
        return new AnthropicAdapter(config as AnthropicConfig)
      case 'google':
        return new GoogleAdapter(config as GoogleConfig)
      default:
        throw new UnknownProviderError(provider)
    }
  }
}
```

#### 2.2.2 Decorator Pattern - Agent Capabilities

**목적**: 에이전트에 동적으로 기능 추가

```typescript
// src/agents/decorators/

// Base Component
interface Agent {
  execute(task: Task): Promise<TaskResult>
  getCapabilities(): Capability[]
}

// Concrete Component
class BaseCoderAgent implements Agent {
  async execute(task: Task): Promise<TaskResult> {
    // Base implementation
    return { success: true, output: 'code' }
  }

  getCapabilities(): Capability[] {
    return ['code_generation', 'syntax_validation']
  }
}

// Base Decorator
abstract class AgentDecorator implements Agent {
  protected agent: Agent

  constructor(agent: Agent) {
    this.agent = agent
  }

  async execute(task: Task): Promise<TaskResult> {
    return this.agent.execute(task)
  }

  getCapabilities(): Capability[] {
    return this.agent.getCapabilities()
  }
}

// Concrete Decorators
class LoggingDecorator extends AgentDecorator {
  private logger: Logger

  constructor(agent: Agent, logger: Logger) {
    super(agent)
    this.logger = logger
  }

  async execute(task: Task): Promise<TaskResult> {
    this.logger.info(`Starting task: ${task.id}`)
    const startTime = Date.now()

    try {
      const result = await this.agent.execute(task)
      this.logger.info(`Task ${task.id} completed in ${Date.now() - startTime}ms`)
      return result
    } catch (error) {
      this.logger.error(`Task ${task.id} failed: ${error.message}`)
      throw error
    }
  }
}

class RetryDecorator extends AgentDecorator {
  private retryEngine: RetryEngine
  private policy: RetryPolicy

  constructor(agent: Agent, retryEngine: RetryEngine, policy: RetryPolicy) {
    super(agent)
    this.retryEngine = retryEngine
    this.policy = policy
  }

  async execute(task: Task): Promise<TaskResult> {
    return this.retryEngine.executeWithRetry(
      () => this.agent.execute(task),
      this.policy
    )
  }
}

class MetricsDecorator extends AgentDecorator {
  private metrics: MetricsCollector

  constructor(agent: Agent, metrics: MetricsCollector) {
    super(agent)
    this.metrics = metrics
  }

  async execute(task: Task): Promise<TaskResult> {
    const timer = this.metrics.startTimer('agent_task_duration')

    try {
      const result = await this.agent.execute(task)
      timer.observe({ status: 'success' })
      this.metrics.increment('agent_task_total', { status: 'success' })
      return result
    } catch (error) {
      timer.observe({ status: 'error' })
      this.metrics.increment('agent_task_total', { status: 'error' })
      throw error
    }
  }
}

// Usage - Compose decorators
const baseAgent = new BaseCoderAgent()
const decoratedAgent = new MetricsDecorator(
  new RetryDecorator(
    new LoggingDecorator(baseAgent, logger),
    retryEngine,
    retryPolicy
  ),
  metrics
)
```

#### 2.2.3 Facade Pattern - External Service Integration

**목적**: 복잡한 하위 시스템에 대한 단순화된 인터페이스

```typescript
// src/infrastructure/knowledge/knowledge-facade.ts

class KnowledgeFacade {
  private neo4j: Neo4jClient
  private vector: VectorStore
  private featureReuse: FeatureReuseEngine
  private embedder: EmbeddingService

  constructor(config: KnowledgeConfig) {
    this.neo4j = new Neo4jClient(config.neo4j)
    this.vector = new VectorStore(config.vector)
    this.featureReuse = new FeatureReuseEngine(this.neo4j, this.vector)
    this.embedder = new EmbeddingService(config.embedding)
  }

  // Simplified API for common operations

  async indexProject(projectPath: string): Promise<IndexingResult> {
    // Complex coordination of multiple subsystems
    const files = await this.scanProject(projectPath)

    for (const file of files) {
      // 1. Parse and extract entities
      const entities = await this.parseFile(file)

      // 2. Store in Neo4j
      for (const entity of entities) {
        await this.neo4j.storeEntity(entity)
      }

      // 3. Generate embeddings and store in vector DB
      for (const entity of entities) {
        const embedding = await this.embedder.embed(entity.code)
        await this.vector.upsert(entity.id, embedding, entity.metadata)
      }
    }

    // 4. Build relationships
    await this.buildRelationships()

    return { filesIndexed: files.length, entitiesCreated: /* count */ }
  }

  async findSimilarCode(query: string): Promise<SimilarCode[]> {
    // Simple API hiding complexity
    const embedding = await this.embedder.embed(query)
    const vectorResults = await this.vector.search(embedding, 10)

    // Enrich with graph data
    const enrichedResults = await Promise.all(
      vectorResults.map(async result => {
        const graphData = await this.neo4j.query(
          'MATCH (e:Entity {id: $id})-[r]->(related) RETURN e, r, related',
          { id: result.id }
        )
        return { ...result, relationships: graphData }
      })
    )

    return enrichedResults
  }

  async getReusablePatternsFor(requirement: string): Promise<ReusableCode[]> {
    return this.featureReuse.findReusableCode(requirement)
  }

  // Private helper methods...
}
```

#### 2.2.4 Composite Pattern - Workflow Tasks

**목적**: 개별 태스크와 복합 태스크를 동일하게 처리

```typescript
// src/core/orchestration/tasks/

// Component
interface WorkflowTask {
  id: string
  execute(context: ExecutionContext): Promise<TaskResult>
  getEstimatedDuration(): number
  getDependencies(): string[]
}

// Leaf
class AtomicTask implements WorkflowTask {
  constructor(
    public id: string,
    private handler: TaskHandler,
    private dependencies: string[] = []
  ) {}

  async execute(context: ExecutionContext): Promise<TaskResult> {
    return this.handler.handle(context)
  }

  getEstimatedDuration(): number {
    return this.handler.estimateDuration()
  }

  getDependencies(): string[] {
    return this.dependencies
  }
}

// Composite
class CompositeTask implements WorkflowTask {
  private children: WorkflowTask[] = []

  constructor(
    public id: string,
    private executionStrategy: 'sequential' | 'parallel' = 'sequential'
  ) {}

  add(task: WorkflowTask): void {
    this.children.push(task)
  }

  remove(taskId: string): void {
    this.children = this.children.filter(t => t.id !== taskId)
  }

  async execute(context: ExecutionContext): Promise<TaskResult> {
    if (this.executionStrategy === 'parallel') {
      const results = await Promise.all(
        this.children.map(child => child.execute(context))
      )
      return this.aggregateResults(results)
    }

    // Sequential execution
    const results: TaskResult[] = []
    for (const child of this.children) {
      const result = await child.execute(context)
      results.push(result)
      context.previousResults.set(child.id, result)
    }
    return this.aggregateResults(results)
  }

  getEstimatedDuration(): number {
    if (this.executionStrategy === 'parallel') {
      return Math.max(...this.children.map(c => c.getEstimatedDuration()))
    }
    return this.children.reduce((sum, c) => sum + c.getEstimatedDuration(), 0)
  }

  getDependencies(): string[] {
    return [...new Set(this.children.flatMap(c => c.getDependencies()))]
  }

  private aggregateResults(results: TaskResult[]): TaskResult {
    const success = results.every(r => r.success)
    return {
      success,
      output: results.map(r => r.output),
      errors: results.flatMap(r => r.errors || []),
    }
  }
}

// Usage
const implementationWorkflow = new CompositeTask('implementation', 'sequential')

const analysisPhase = new CompositeTask('analysis', 'parallel')
analysisPhase.add(new AtomicTask('analyze-requirements', requirementAnalyzer))
analysisPhase.add(new AtomicTask('analyze-codebase', codebaseAnalyzer))

const designPhase = new AtomicTask('create-design', designGenerator, ['analysis'])

const codingPhase = new CompositeTask('coding', 'parallel')
codingPhase.add(new AtomicTask('generate-code', codeGenerator, ['create-design']))
codingPhase.add(new AtomicTask('generate-tests', testGenerator, ['create-design']))

implementationWorkflow.add(analysisPhase)
implementationWorkflow.add(designPhase)
implementationWorkflow.add(codingPhase)
```

---

### 2.3 Behavioral Patterns

#### 2.3.1 Strategy Pattern - LLM Selection

**목적**: 런타임에 LLM 선택 알고리즘 교체

```typescript
// src/infrastructure/llm/strategies/

// Strategy Interface
interface LLMSelectionStrategy {
  select(task: Task, providers: LLMProvider[]): LLMProvider
}

// Concrete Strategies
class CostOptimizedStrategy implements LLMSelectionStrategy {
  private costMap: Map<string, number>

  constructor(costMap: Map<string, number>) {
    this.costMap = costMap
  }

  select(task: Task, providers: LLMProvider[]): LLMProvider {
    // Sort by cost and return cheapest capable provider
    const capableProviders = providers.filter(p =>
      this.canHandle(p, task.complexity)
    )

    return capableProviders.sort((a, b) =>
      (this.costMap.get(a.name) || Infinity) - (this.costMap.get(b.name) || Infinity)
    )[0]
  }

  private canHandle(provider: LLMProvider, complexity: TaskComplexity): boolean {
    // Logic to determine if provider can handle task complexity
    return true
  }
}

class QualityOptimizedStrategy implements LLMSelectionStrategy {
  private qualityRanking: string[]

  constructor(qualityRanking: string[]) {
    this.qualityRanking = qualityRanking
  }

  select(task: Task, providers: LLMProvider[]): LLMProvider {
    // Return highest quality provider that's available
    for (const name of this.qualityRanking) {
      const provider = providers.find(p => p.name === name)
      if (provider && provider.isAvailable()) {
        return provider
      }
    }
    throw new NoAvailableProviderError()
  }
}

class LoadBalancedStrategy implements LLMSelectionStrategy {
  private usageCounts: Map<string, number> = new Map()

  select(task: Task, providers: LLMProvider[]): LLMProvider {
    // Round-robin with availability check
    const availableProviders = providers.filter(p => p.isAvailable())

    return availableProviders.sort((a, b) =>
      (this.usageCounts.get(a.name) || 0) - (this.usageCounts.get(b.name) || 0)
    )[0]
  }

  recordUsage(providerName: string): void {
    this.usageCounts.set(
      providerName,
      (this.usageCounts.get(providerName) || 0) + 1
    )
  }
}

// Context
class LLMSelector {
  private strategy: LLMSelectionStrategy
  private providers: LLMProvider[]

  constructor(strategy: LLMSelectionStrategy, providers: LLMProvider[]) {
    this.strategy = strategy
    this.providers = providers
  }

  setStrategy(strategy: LLMSelectionStrategy): void {
    this.strategy = strategy
  }

  selectProvider(task: Task): LLMProvider {
    return this.strategy.select(task, this.providers)
  }
}
```

#### 2.3.2 Observer Pattern - Event System

**목적**: 이벤트 기반 느슨한 결합

```typescript
// src/infrastructure/events/

// Subject
interface EventEmitter {
  subscribe(eventType: string, handler: EventHandler): Subscription
  unsubscribe(subscription: Subscription): void
  publish(event: DomainEvent): Promise<void>
}

// Observer
type EventHandler = (event: DomainEvent) => Promise<void> | void

// Subscription handle
interface Subscription {
  id: string
  unsubscribe(): void
}

// Implementation
class NATSEventEmitter implements EventEmitter {
  private nc: NatsConnection
  private handlers: Map<string, Set<{ id: string; handler: EventHandler }>>

  constructor(config: NATSConfig) {
    this.handlers = new Map()
  }

  async connect(): Promise<void> {
    this.nc = await connect(config)
    // Set up NATS subscriptions for each event type
  }

  subscribe(eventType: string, handler: EventHandler): Subscription {
    const id = crypto.randomUUID()

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
      // Create NATS subscription
      this.nc.subscribe(eventType, {
        callback: async (err, msg) => {
          if (err) return
          const event = JSON.parse(msg.data.toString())
          await this.notifyHandlers(eventType, event)
        }
      })
    }

    this.handlers.get(eventType)!.add({ id, handler })

    return {
      id,
      unsubscribe: () => this.unsubscribe({ id, unsubscribe: () => {} })
    }
  }

  unsubscribe(subscription: Subscription): void {
    for (const handlers of this.handlers.values()) {
      for (const h of handlers) {
        if (h.id === subscription.id) {
          handlers.delete(h)
          return
        }
      }
    }
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.nc.publish(event.type, JSON.stringify(event))
  }

  private async notifyHandlers(eventType: string, event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(eventType)
    if (!handlers) return

    await Promise.all(
      Array.from(handlers).map(h => h.handler(event))
    )
  }
}

// Domain Events
interface DomainEvent {
  id: string
  type: string
  timestamp: Date
  payload: unknown
  metadata: EventMetadata
}

interface EventMetadata {
  correlationId: string
  causationId?: string
  userId?: string
  agentId?: string
}

// Event Types
class TaskCreatedEvent implements DomainEvent {
  readonly type = 'task.created'

  constructor(
    public id: string,
    public timestamp: Date,
    public payload: { task: Task },
    public metadata: EventMetadata
  ) {}
}

class CodeGeneratedEvent implements DomainEvent {
  readonly type = 'code.generated'

  constructor(
    public id: string,
    public timestamp: Date,
    public payload: { taskId: string; code: string; files: string[] },
    public metadata: EventMetadata
  ) {}
}
```

#### 2.3.3 Command Pattern - Task Execution

**목적**: 요청을 객체로 캡슐화하여 큐잉, 로깅, 실행 취소 지원

```typescript
// src/core/commands/

// Command Interface
interface Command {
  execute(): Promise<CommandResult>
  undo(): Promise<void>
  canUndo(): boolean
}

// Concrete Commands
class GenerateCodeCommand implements Command {
  private generatedFiles: string[] = []

  constructor(
    private coder: CoderAgent,
    private spec: CodeSpec,
    private fileSystem: FileSystem
  ) {}

  async execute(): Promise<CommandResult> {
    const result = await this.coder.generateCode(this.spec)

    // Save generated files
    for (const file of result.files) {
      await this.fileSystem.write(file.path, file.content)
      this.generatedFiles.push(file.path)
    }

    return { success: true, output: this.generatedFiles }
  }

  async undo(): Promise<void> {
    // Remove generated files
    for (const path of this.generatedFiles) {
      await this.fileSystem.delete(path)
    }
    this.generatedFiles = []
  }

  canUndo(): boolean {
    return this.generatedFiles.length > 0
  }
}

class ReviewCodeCommand implements Command {
  private reviewResult: ReviewResult | null = null

  constructor(
    private reviewer: ReviewerAgent,
    private code: Code
  ) {}

  async execute(): Promise<CommandResult> {
    this.reviewResult = await this.reviewer.review(this.code)
    return { success: true, output: this.reviewResult }
  }

  async undo(): Promise<void> {
    // Reviews are read-only, nothing to undo
    this.reviewResult = null
  }

  canUndo(): boolean {
    return false
  }
}

// Invoker
class CommandInvoker {
  private history: Command[] = []
  private position = -1

  async execute(command: Command): Promise<CommandResult> {
    const result = await command.execute()

    // Clear redo history
    this.history = this.history.slice(0, this.position + 1)

    this.history.push(command)
    this.position++

    return result
  }

  async undo(): Promise<void> {
    if (this.position < 0) {
      throw new Error('Nothing to undo')
    }

    const command = this.history[this.position]
    if (!command.canUndo()) {
      throw new Error('Command cannot be undone')
    }

    await command.undo()
    this.position--
  }

  async redo(): Promise<void> {
    if (this.position >= this.history.length - 1) {
      throw new Error('Nothing to redo')
    }

    this.position++
    await this.history[this.position].execute()
  }

  canUndo(): boolean {
    return this.position >= 0 && this.history[this.position].canUndo()
  }

  canRedo(): boolean {
    return this.position < this.history.length - 1
  }
}
```

#### 2.3.4 State Pattern - Agent Lifecycle

**목적**: 에이전트 상태에 따른 행동 변화

```typescript
// src/agents/states/

// State Interface
interface AgentState {
  name: string
  enter(agent: StatefulAgent): Promise<void>
  exit(agent: StatefulAgent): Promise<void>
  handleTask(agent: StatefulAgent, task: Task): Promise<TaskResult>
  handleHealthCheck(agent: StatefulAgent): HealthStatus
}

// Concrete States
class IdleState implements AgentState {
  name = 'IDLE'

  async enter(agent: StatefulAgent): Promise<void> {
    agent.emit('state:idle')
  }

  async exit(agent: StatefulAgent): Promise<void> {}

  async handleTask(agent: StatefulAgent, task: Task): Promise<TaskResult> {
    await agent.transitionTo(new BusyState())
    return agent.processTask(task)
  }

  handleHealthCheck(agent: StatefulAgent): HealthStatus {
    return { status: 'healthy', state: this.name }
  }
}

class BusyState implements AgentState {
  name = 'BUSY'

  async enter(agent: StatefulAgent): Promise<void> {
    agent.emit('state:busy')
  }

  async exit(agent: StatefulAgent): Promise<void> {}

  async handleTask(agent: StatefulAgent, task: Task): Promise<TaskResult> {
    // Queue the task or reject
    throw new AgentBusyError('Agent is currently processing another task')
  }

  handleHealthCheck(agent: StatefulAgent): HealthStatus {
    return {
      status: 'healthy',
      state: this.name,
      currentTask: agent.getCurrentTask()
    }
  }
}

class ErrorState implements AgentState {
  name = 'ERROR'

  constructor(private error: Error) {}

  async enter(agent: StatefulAgent): Promise<void> {
    agent.emit('state:error', this.error)
  }

  async exit(agent: StatefulAgent): Promise<void> {
    // Cleanup error state
  }

  async handleTask(agent: StatefulAgent, task: Task): Promise<TaskResult> {
    throw new AgentErrorStateError('Agent is in error state')
  }

  handleHealthCheck(agent: StatefulAgent): HealthStatus {
    return {
      status: 'unhealthy',
      state: this.name,
      error: this.error.message
    }
  }
}

class RecoveringState implements AgentState {
  name = 'RECOVERING'

  async enter(agent: StatefulAgent): Promise<void> {
    agent.emit('state:recovering')
    // Start recovery process
    try {
      await agent.performRecovery()
      await agent.transitionTo(new IdleState())
    } catch (error) {
      await agent.transitionTo(new ErrorState(error))
    }
  }

  async exit(agent: StatefulAgent): Promise<void> {}

  async handleTask(agent: StatefulAgent, task: Task): Promise<TaskResult> {
    throw new AgentRecoveringError('Agent is recovering')
  }

  handleHealthCheck(agent: StatefulAgent): HealthStatus {
    return { status: 'degraded', state: this.name }
  }
}

// Context
class StatefulAgent extends BaseAgent {
  private state: AgentState = new IdleState()

  async transitionTo(newState: AgentState): Promise<void> {
    await this.state.exit(this)
    this.state = newState
    await this.state.enter(this)
  }

  async handleTask(task: Task): Promise<TaskResult> {
    return this.state.handleTask(this, task)
  }

  getHealthStatus(): HealthStatus {
    return this.state.handleHealthCheck(this)
  }
}
```

#### 2.3.5 Chain of Responsibility - Error Handling

**목적**: 에러를 처리할 수 있는 핸들러 체인

```typescript
// src/infrastructure/resilience/error-chain/

// Handler Interface
interface ErrorHandler {
  setNext(handler: ErrorHandler): ErrorHandler
  handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult>
}

// Base Handler
abstract class BaseErrorHandler implements ErrorHandler {
  private nextHandler: ErrorHandler | null = null

  setNext(handler: ErrorHandler): ErrorHandler {
    this.nextHandler = handler
    return handler
  }

  async handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    if (this.canHandle(error)) {
      return this.doHandle(error, context)
    }

    if (this.nextHandler) {
      return this.nextHandler.handle(error, context)
    }

    // No handler could process the error
    return { handled: false, error }
  }

  protected abstract canHandle(error: Error): boolean
  protected abstract doHandle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult>
}

// Concrete Handlers
class TransientErrorHandler extends BaseErrorHandler {
  constructor(private retryEngine: RetryEngine) {
    super()
  }

  protected canHandle(error: Error): boolean {
    return error instanceof TransientError || error.code === 'ECONNRESET'
  }

  protected async doHandle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    try {
      const result = await this.retryEngine.executeWithRetry(
        context.operation,
        { maxAttempts: 3, baseDelayMs: 1000 }
      )
      return { handled: true, result }
    } catch (retryError) {
      return { handled: false, error: retryError }
    }
  }
}

class RateLimitHandler extends BaseErrorHandler {
  protected canHandle(error: Error): boolean {
    return error instanceof RateLimitError || error.statusCode === 429
  }

  protected async doHandle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    const retryAfter = error.retryAfter || 60000
    await delay(retryAfter)

    try {
      const result = await context.operation()
      return { handled: true, result }
    } catch (retryError) {
      return { handled: false, error: retryError }
    }
  }
}

class FallbackHandler extends BaseErrorHandler {
  constructor(private fallbackProviders: Map<string, () => Promise<any>>) {
    super()
  }

  protected canHandle(error: Error): boolean {
    return error instanceof ServiceUnavailableError
  }

  protected async doHandle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    const fallback = this.fallbackProviders.get(context.service)
    if (!fallback) {
      return { handled: false, error }
    }

    try {
      const result = await fallback()
      return { handled: true, result }
    } catch (fallbackError) {
      return { handled: false, error: fallbackError }
    }
  }
}

class LoggingHandler extends BaseErrorHandler {
  constructor(private logger: Logger) {
    super()
  }

  protected canHandle(error: Error): boolean {
    return true // Always log
  }

  protected async doHandle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    this.logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      context,
    })
    return { handled: false, error }
  }
}

// Usage
const errorChain = new TransientErrorHandler(retryEngine)
errorChain
  .setNext(new RateLimitHandler())
  .setNext(new FallbackHandler(fallbacks))
  .setNext(new LoggingHandler(logger))

// Process error
const result = await errorChain.handle(error, context)
```

---

### 2.4 Architectural Patterns

#### 2.4.1 CQRS (Command Query Responsibility Segregation)

**목적**: 읽기와 쓰기 모델 분리로 최적화

```typescript
// src/core/cqrs/

// Command Side
interface CommandBus {
  dispatch(command: Command): Promise<CommandResult>
  register(commandType: string, handler: CommandHandler): void
}

class SimpleCommandBus implements CommandBus {
  private handlers = new Map<string, CommandHandler>()

  register(commandType: string, handler: CommandHandler): void {
    this.handlers.set(commandType, handler)
  }

  async dispatch(command: Command): Promise<CommandResult> {
    const handler = this.handlers.get(command.type)
    if (!handler) {
      throw new UnknownCommandError(command.type)
    }
    return handler.handle(command)
  }
}

// Commands
interface CreateTaskCommand {
  type: 'CreateTask'
  payload: {
    projectId: string
    description: string
    priority: Priority
  }
}

interface AssignTaskCommand {
  type: 'AssignTask'
  payload: {
    taskId: string
    agentId: string
  }
}

// Command Handlers
class CreateTaskHandler implements CommandHandler {
  constructor(
    private taskRepo: TaskRepository,
    private eventBus: EventBus
  ) {}

  async handle(command: CreateTaskCommand): Promise<CommandResult> {
    const task = Task.create(
      command.payload.projectId,
      command.payload.description,
      command.payload.priority
    )

    await this.taskRepo.save(task)
    await this.eventBus.publish(new TaskCreatedEvent(task))

    return { success: true, taskId: task.id }
  }
}

// Query Side
interface QueryBus {
  execute<T>(query: Query): Promise<T>
  register(queryType: string, handler: QueryHandler): void
}

// Queries
interface GetTaskStatusQuery {
  type: 'GetTaskStatus'
  taskId: string
}

interface GetProjectMetricsQuery {
  type: 'GetProjectMetrics'
  projectId: string
  period: Period
}

// Query Handlers (can use denormalized read models)
class GetTaskStatusHandler implements QueryHandler {
  constructor(private readModel: TaskReadModel) {}

  async handle(query: GetTaskStatusQuery): Promise<TaskStatusDTO> {
    return this.readModel.getStatus(query.taskId)
  }
}

// Read Model (denormalized for fast queries)
class TaskReadModel {
  private cache: Map<string, TaskStatusDTO> = new Map()

  constructor(private eventBus: EventBus) {
    // Subscribe to events to update read model
    eventBus.subscribe('task.*', this.handleEvent.bind(this))
  }

  async getStatus(taskId: string): Promise<TaskStatusDTO> {
    const cached = this.cache.get(taskId)
    if (cached) return cached

    // Fallback to database
    return this.fetchFromDB(taskId)
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    // Update cache based on events
    switch (event.type) {
      case 'task.created':
        this.cache.set(event.payload.task.id, this.toDTO(event.payload.task))
        break
      case 'task.updated':
        const existing = this.cache.get(event.payload.taskId)
        if (existing) {
          this.cache.set(event.payload.taskId, { ...existing, ...event.payload.updates })
        }
        break
    }
  }
}
```

#### 2.4.2 Event Sourcing

**목적**: 상태 변화를 이벤트 시퀀스로 저장

```typescript
// src/core/event-sourcing/

// Event Store
interface EventStore {
  append(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void>
  read(streamId: string, fromVersion?: number): Promise<DomainEvent[]>
  subscribe(streamId: string, handler: EventHandler): Subscription
}

class NATSEventStore implements EventStore {
  private nc: NatsConnection
  private js: JetStreamClient

  async append(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void> {
    for (const event of events) {
      await this.js.publish(streamId, JSON.stringify({
        ...event,
        version: expectedVersion ? ++expectedVersion : undefined,
      }))
    }
  }

  async read(streamId: string, fromVersion = 0): Promise<DomainEvent[]> {
    const consumer = await this.js.consumers.get(streamId)
    const messages = await consumer.fetch({ max_messages: 1000 })

    const events: DomainEvent[] = []
    for await (const msg of messages) {
      const event = JSON.parse(msg.data.toString())
      if (event.version >= fromVersion) {
        events.push(event)
      }
      msg.ack()
    }

    return events
  }
}

// Aggregate
abstract class AggregateRoot {
  private uncommittedEvents: DomainEvent[] = []
  protected version = 0

  protected apply(event: DomainEvent): void {
    this.when(event)
    this.version++
    this.uncommittedEvents.push(event)
  }

  protected abstract when(event: DomainEvent): void

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents]
  }

  clearUncommittedEvents(): void {
    this.uncommittedEvents = []
  }

  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.when(event)
      this.version++
    }
  }
}

// Task Aggregate
class TaskAggregate extends AggregateRoot {
  private id: string
  private status: TaskStatus
  private assignedAgent: string | null = null

  static create(id: string, description: string, priority: Priority): TaskAggregate {
    const task = new TaskAggregate()
    task.apply(new TaskCreatedEvent(id, { description, priority }))
    return task
  }

  assign(agentId: string): void {
    if (this.status !== 'pending') {
      throw new InvalidOperationError('Task is not pending')
    }
    this.apply(new TaskAssignedEvent(this.id, { agentId }))
  }

  complete(result: TaskResult): void {
    if (this.status !== 'in_progress') {
      throw new InvalidOperationError('Task is not in progress')
    }
    this.apply(new TaskCompletedEvent(this.id, { result }))
  }

  protected when(event: DomainEvent): void {
    switch (event.type) {
      case 'task.created':
        this.id = event.id
        this.status = 'pending'
        break
      case 'task.assigned':
        this.assignedAgent = event.payload.agentId
        this.status = 'in_progress'
        break
      case 'task.completed':
        this.status = 'completed'
        break
    }
  }
}

// Repository
class EventSourcedTaskRepository {
  constructor(private eventStore: EventStore) {}

  async save(task: TaskAggregate): Promise<void> {
    const events = task.getUncommittedEvents()
    await this.eventStore.append(`task-${task.id}`, events, task.version)
    task.clearUncommittedEvents()
  }

  async getById(id: string): Promise<TaskAggregate> {
    const events = await this.eventStore.read(`task-${id}`)
    const task = new TaskAggregate()
    task.loadFromHistory(events)
    return task
  }
}
```

#### 2.4.3 Saga Pattern - Distributed Transactions

**목적**: 분산 트랜잭션의 일관성 보장

```typescript
// src/core/sagas/

// Saga Step
interface SagaStep<T> {
  name: string
  execute(context: T): Promise<StepResult>
  compensate(context: T): Promise<void>
}

// Saga Orchestrator
class SagaOrchestrator<T> {
  private steps: SagaStep<T>[] = []
  private executedSteps: SagaStep<T>[] = []

  addStep(step: SagaStep<T>): this {
    this.steps.push(step)
    return this
  }

  async execute(context: T): Promise<SagaResult> {
    for (const step of this.steps) {
      try {
        const result = await step.execute(context)
        this.executedSteps.push(step)

        if (!result.success) {
          await this.compensate(context)
          return { success: false, failedStep: step.name }
        }
      } catch (error) {
        await this.compensate(context)
        return { success: false, failedStep: step.name, error }
      }
    }

    return { success: true }
  }

  private async compensate(context: T): Promise<void> {
    // Compensate in reverse order
    for (const step of this.executedSteps.reverse()) {
      try {
        await step.compensate(context)
      } catch (error) {
        // Log compensation failure but continue
        console.error(`Compensation failed for ${step.name}:`, error)
      }
    }
    this.executedSteps = []
  }
}

// Implementation Saga
interface ImplementationContext {
  requirement: Requirement
  design?: Design
  code?: Code
  tests?: TestCode
  review?: ReviewResult
}

class ImplementationSaga {
  private orchestrator: SagaOrchestrator<ImplementationContext>

  constructor(
    private designer: ArchitectAgent,
    private coder: CoderAgent,
    private qa: QAAgent,
    private reviewer: ReviewerAgent,
    private git: GitService
  ) {
    this.orchestrator = new SagaOrchestrator<ImplementationContext>()
      .addStep(new CreateDesignStep(designer))
      .addStep(new GenerateCodeStep(coder))
      .addStep(new GenerateTestsStep(qa))
      .addStep(new ReviewCodeStep(reviewer))
      .addStep(new CommitCodeStep(git))
  }

  async run(requirement: Requirement): Promise<ImplementationResult> {
    const context: ImplementationContext = { requirement }
    const result = await this.orchestrator.execute(context)

    if (result.success) {
      return { success: true, code: context.code!, tests: context.tests! }
    }

    return { success: false, failedAt: result.failedStep, error: result.error }
  }
}

// Saga Steps
class CreateDesignStep implements SagaStep<ImplementationContext> {
  name = 'CreateDesign'

  constructor(private designer: ArchitectAgent) {}

  async execute(context: ImplementationContext): Promise<StepResult> {
    context.design = await this.designer.createLLD(context.requirement)
    return { success: true }
  }

  async compensate(context: ImplementationContext): Promise<void> {
    // Delete created design documents
    context.design = undefined
  }
}

class GenerateCodeStep implements SagaStep<ImplementationContext> {
  name = 'GenerateCode'

  constructor(private coder: CoderAgent) {}

  async execute(context: ImplementationContext): Promise<StepResult> {
    context.code = await this.coder.implementFromLLD(context.design!)
    return { success: true }
  }

  async compensate(context: ImplementationContext): Promise<void> {
    // Delete generated code files
    if (context.code) {
      for (const file of context.code.files) {
        await fs.unlink(file.path)
      }
    }
    context.code = undefined
  }
}

class CommitCodeStep implements SagaStep<ImplementationContext> {
  name = 'CommitCode'
  private commitHash?: string

  constructor(private git: GitService) {}

  async execute(context: ImplementationContext): Promise<StepResult> {
    this.commitHash = await this.git.commit(
      context.code!.files.map(f => f.path),
      `feat: ${context.requirement.title}`
    )
    return { success: true }
  }

  async compensate(context: ImplementationContext): Promise<void> {
    // Revert the commit
    if (this.commitHash) {
      await this.git.revert(this.commitHash)
    }
  }
}
```

---

## 3. Infrastructure Patterns

### 3.1 Circuit Breaker Implementation

```typescript
// src/infrastructure/resilience/circuit-breaker.ts

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  failureThreshold: number
  successThreshold: number
  timeout: number
  volumeThreshold: number
}

class CircuitBreaker {
  private state = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private lastFailureTime: number | null = null
  private requestCount = 0

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN
      } else {
        throw new CircuitOpenError('Circuit breaker is open')
      }
    }

    this.requestCount++

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - (this.lastFailureTime || 0) >= this.options.timeout
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.options.successThreshold) {
        this.reset()
      }
    } else {
      this.failureCount = 0
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      this.trip()
    } else if (
      this.requestCount >= this.options.volumeThreshold &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.trip()
    }
  }

  private trip(): void {
    this.state = CircuitState.OPEN
    this.successCount = 0
  }

  private reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.requestCount = 0
  }

  getState(): CircuitState {
    return this.state
  }
}
```

### 3.2 Rate Limiter

```typescript
// src/infrastructure/rate-limiter.ts

interface RateLimiterOptions {
  maxRequests: number
  windowMs: number
}

class TokenBucketRateLimiter {
  private tokens: number
  private lastRefill: number

  constructor(private options: RateLimiterOptions) {
    this.tokens = options.maxRequests
    this.lastRefill = Date.now()
  }

  async acquire(): Promise<boolean> {
    this.refill()

    if (this.tokens > 0) {
      this.tokens--
      return true
    }

    return false
  }

  async waitForToken(): Promise<void> {
    while (!(await this.acquire())) {
      await delay(100)
    }
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    const tokensToAdd = Math.floor(
      (elapsed / this.options.windowMs) * this.options.maxRequests
    )

    this.tokens = Math.min(this.options.maxRequests, this.tokens + tokensToAdd)
    this.lastRefill = now
  }
}

// Usage with LLM calls
class RateLimitedLLMProvider implements LLMProvider {
  constructor(
    private provider: LLMProvider,
    private rateLimiter: TokenBucketRateLimiter
  ) {}

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResult> {
    await this.rateLimiter.waitForToken()
    return this.provider.chat(messages, options)
  }
}
```

---

## 4. Data Patterns

### 4.1 Repository Pattern

```typescript
// src/infrastructure/repositories/

// Generic Repository Interface
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>
  findAll(filter?: Partial<T>): Promise<T[]>
  save(entity: T): Promise<void>
  delete(id: ID): Promise<void>
}

// Task Repository
interface TaskRepository extends Repository<Task, string> {
  findByStatus(status: TaskStatus): Promise<Task[]>
  findByAgent(agentId: string): Promise<Task[]>
  findPending(): Promise<Task[]>
}

// Prisma Implementation
class PrismaTaskRepository implements TaskRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Task | null> {
    const data = await this.prisma.task.findUnique({ where: { id } })
    return data ? this.toDomain(data) : null
  }

  async findAll(filter?: Partial<Task>): Promise<Task[]> {
    const data = await this.prisma.task.findMany({
      where: filter ? this.toFilter(filter) : undefined,
    })
    return data.map(this.toDomain)
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    const data = await this.prisma.task.findMany({
      where: { status },
    })
    return data.map(this.toDomain)
  }

  async findByAgent(agentId: string): Promise<Task[]> {
    const data = await this.prisma.task.findMany({
      where: { assignedAgentId: agentId },
    })
    return data.map(this.toDomain)
  }

  async findPending(): Promise<Task[]> {
    const data = await this.prisma.task.findMany({
      where: { status: 'PENDING' },
      orderBy: { priority: 'desc' },
    })
    return data.map(this.toDomain)
  }

  async save(task: Task): Promise<void> {
    await this.prisma.task.upsert({
      where: { id: task.id },
      create: this.toData(task),
      update: this.toData(task),
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.task.delete({ where: { id } })
  }

  private toDomain(data: PrismaTask): Task {
    return new Task(
      data.id,
      data.description,
      data.status as TaskStatus,
      data.priority as Priority,
      data.assignedAgentId,
      data.createdAt,
      data.updatedAt
    )
  }

  private toData(task: Task): Prisma.TaskCreateInput {
    return {
      id: task.id,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedAgentId: task.assignedAgentId,
    }
  }

  private toFilter(filter: Partial<Task>): Prisma.TaskWhereInput {
    // Convert domain filter to Prisma filter
    return filter as Prisma.TaskWhereInput
  }
}
```

### 4.2 Unit of Work Pattern

```typescript
// src/infrastructure/unit-of-work.ts

interface UnitOfWork {
  tasks: TaskRepository
  agents: AgentRepository
  projects: ProjectRepository

  begin(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
}

class PrismaUnitOfWork implements UnitOfWork {
  private tx: Prisma.TransactionClient | null = null

  tasks: TaskRepository
  agents: AgentRepository
  projects: ProjectRepository

  constructor(private prisma: PrismaClient) {
    this.tasks = new PrismaTaskRepository(prisma)
    this.agents = new PrismaAgentRepository(prisma)
    this.projects = new PrismaProjectRepository(prisma)
  }

  async begin(): Promise<void> {
    // Prisma doesn't have explicit begin, but we prepare for transaction
  }

  async commit(): Promise<void> {
    // In Prisma, we use interactive transactions
  }

  async rollback(): Promise<void> {
    // Handled by transaction abort
  }

  async execute<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const transactionalUow = new PrismaUnitOfWork(tx as PrismaClient)
      return work(transactionalUow)
    })
  }
}

// Usage
const uow = new PrismaUnitOfWork(prisma)

await uow.execute(async (work) => {
  const task = await work.tasks.findById('task-1')
  task.complete(result)
  await work.tasks.save(task)

  const agent = await work.agents.findById('agent-1')
  agent.releaseTask()
  await work.agents.save(agent)
})
```

---

## 5. Testing Patterns

### 5.1 Test Fixtures

```typescript
// tests/fixtures/

class TaskFixture {
  static create(overrides: Partial<Task> = {}): Task {
    return new Task(
      overrides.id ?? `task-${Date.now()}`,
      overrides.description ?? 'Test task description',
      overrides.status ?? 'pending',
      overrides.priority ?? 'medium',
      overrides.assignedAgentId ?? null,
      overrides.createdAt ?? new Date(),
      overrides.updatedAt ?? new Date()
    )
  }

  static createPending(): Task {
    return this.create({ status: 'pending' })
  }

  static createInProgress(agentId: string): Task {
    return this.create({
      status: 'in_progress',
      assignedAgentId: agentId,
    })
  }

  static createCompleted(): Task {
    return this.create({ status: 'completed' })
  }
}

class AgentFixture {
  static create(overrides: Partial<AgentConfig> = {}): CoderAgent {
    return new CoderAgent({
      id: overrides.id ?? `agent-${Date.now()}`,
      name: overrides.name ?? 'Test Agent',
      type: AgentType.CODER,
      ...overrides,
    })
  }
}
```

### 5.2 Mock Objects

```typescript
// tests/mocks/

class MockLLMProvider implements LLMProvider {
  private responses: Map<string, ChatResult> = new Map()

  setResponse(promptPattern: string, response: ChatResult): void {
    this.responses.set(promptPattern, response)
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResult> {
    const lastMessage = messages[messages.length - 1].content

    for (const [pattern, response] of this.responses) {
      if (lastMessage.includes(pattern)) {
        return response
      }
    }

    return {
      message: { role: 'assistant', content: 'Mock response' },
      usage: { promptTokens: 10, completionTokens: 5 },
    }
  }

  async complete(prompt: string, options: CompletionOptions): Promise<CompletionResult> {
    return { text: 'Mock completion', usage: { promptTokens: 5, completionTokens: 3 } }
  }

  async embed(text: string): Promise<number[]> {
    // Return deterministic mock embedding
    return Array(384).fill(0).map((_, i) => Math.sin(i + text.length))
  }

  getTokenCount(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

class MockEventBus implements EventEmitter {
  private publishedEvents: DomainEvent[] = []

  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event)
  }

  subscribe(eventType: string, handler: EventHandler): Subscription {
    return { id: 'mock', unsubscribe: () => {} }
  }

  unsubscribe(subscription: Subscription): void {}

  getPublishedEvents(): DomainEvent[] {
    return this.publishedEvents
  }

  clearEvents(): void {
    this.publishedEvents = []
  }
}
```

---

## 6. Summary

### Design Patterns Usage Map

| Pattern | Category | Module | Purpose |
|---------|----------|--------|---------|
| Factory | Creational | Agent Factory | 에이전트 생성 |
| Builder | Creational | Document Builder | 문서 구성 |
| Singleton | Creational | Knowledge Manager | 전역 서비스 |
| Adapter | Structural | LLM Adapters | 프로바이더 통합 |
| Decorator | Structural | Agent Decorators | 기능 확장 |
| Facade | Structural | Knowledge Facade | API 단순화 |
| Composite | Structural | Workflow Tasks | 태스크 계층 |
| Strategy | Behavioral | LLM Selection | 알고리즘 교체 |
| Observer | Behavioral | Event System | 이벤트 처리 |
| Command | Behavioral | Task Execution | 명령 캡슐화 |
| State | Behavioral | Agent Lifecycle | 상태 관리 |
| Chain of Responsibility | Behavioral | Error Handling | 에러 처리 |
| CQRS | Architectural | Task Management | 읽기/쓰기 분리 |
| Event Sourcing | Architectural | Audit/Recovery | 이벤트 기반 상태 |
| Saga | Architectural | Distributed Tx | 트랜잭션 관리 |

### Implementation Priority

1. **P0 (Core)**: Factory, Adapter, Observer, Strategy, Repository
2. **P1 (Enhanced)**: Decorator, Command, State, Circuit Breaker
3. **P2 (Advanced)**: CQRS, Event Sourcing, Saga, Builder
