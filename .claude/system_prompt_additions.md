# System Prompt Additions for Code Quality

## Code Quality Standards for TypeScript Multi-Agent System

NEVER write production code that contains:

1. **throw statements in normal operation paths** - always return proper error objects or use Result pattern
2. **resource leaks** - every opened connection/file/stream must be properly closed
3. **data corruption potential** - all state transitions must preserve data integrity
4. **inconsistent error handling patterns** - establish and follow single pattern across all agents
5. **unhandled promise rejections** - all async operations must have proper error handling
6. **any type usage** - use proper typing or unknown with type guards

ALWAYS:

1. **Write comprehensive tests BEFORE implementing features**
2. **Include schema validation for all external data (Zod)**
3. **Use proper type guards for runtime type checking**
4. **Document known bugs immediately and fix them before continuing**
5. **Implement proper separation of concerns**
6. **Use static analysis tools (ESLint, TypeScript strict mode) before considering code complete**
7. **Properly type all async operations with explicit Promise types**
8. **Close all resources in finally blocks or use try-with-resources pattern**

---

## Development Process Guards

### TESTING REQUIREMENTS:

- Write failing tests first (TDD), then implement to make them pass
- Never commit code with test.skip() for bugs - fix the bugs
- Include property-based testing for data structures (fast-check)
- Test error handling paths, not just happy paths
- Validate all edge cases and boundary conditions
- Test timeout scenarios for async operations
- Test cleanup/teardown in all cases

### ARCHITECTURE REQUIREMENTS:

- **Explicit error handling** - no silent failures or ignored promises
- **Type safety** - strict TypeScript with no any types
- **Performance conscious** - avoid unnecessary object copies, use streaming for large data
- **API design** - consistent patterns across all agents and shared modules
- **Resource management** - proper cleanup of connections, file handles, timers
- **Async safety** - proper cancellation, timeout handling, race condition prevention

### REVIEW CHECKPOINTS:

Before marking any code complete, verify:

1. **No TypeScript errors** (`npm run type-check` passes)
2. **No ESLint warnings** (`npm run lint` passes)
3. **All tests pass** (including integration and E2E)
4. **No unhandled promise rejections**
5. **All resources properly cleaned up** (connections, timers, event listeners)
6. **Error handling is comprehensive and consistent**
7. **Code is modular and follows Single Responsibility Principle**
8. **Documentation matches implementation**
9. **No memory leaks** (event listeners removed, streams closed)
10. **Schema validation for all external inputs**

---

## TypeScript-Specific Quality Standards

### ERROR HANDLING:

#### Custom Error Classes:
```typescript
// DO THIS - Custom error hierarchy
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly retryable: boolean,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class LLMError extends AgentError {
  constructor(message: string, public readonly provider: string) {
    super(message, 'LLM_ERROR', true);
  }
}

export class GitHubError extends AgentError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'GITHUB_ERROR', statusCode === 429);
  }
}
```

#### Async Error Handling:
```typescript
// DO THIS - Proper async error handling
async function processMessage(msg: AgentMessage): Promise<void> {
  try {
    await validateMessage(msg);
    await handleMessage(msg);
  } catch (error) {
    if (error instanceof AgentError && error.retryable) {
      await retryWithBackoff(() => handleMessage(msg));
    } else {
      logger.error('Non-retryable error', { error, messageId: msg.id });
      throw error;
    }
  }
}

// NEVER DO THIS - Silent failure
async function badProcessMessage(msg: AgentMessage): Promise<void> {
  try {
    await handleMessage(msg);
  } catch (error) {
    console.log('Error occurred'); // ❌ No action taken
  }
}

// NEVER DO THIS - Unhandled rejection
async function worseProcessMessage(msg: AgentMessage): Promise<void> {
  handleMessage(msg); // ❌ Promise not awaited, errors unhandled
}
```

#### Result Pattern (Optional):
```typescript
// DO THIS - Result type for explicit error handling
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function safeOperation(): Promise<Result<Data>> {
  try {
    const data = await riskyOperation();
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}

// Usage
const result = await safeOperation();
if (result.ok) {
  console.log(result.value); // ✅ Type-safe access
} else {
  logger.error(result.error); // ✅ Explicit error handling
}
```

---

### TYPE SAFETY:

#### Strict Configuration:
```typescript
// tsconfig.json - REQUIRED settings
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

#### Type Guards:
```typescript
// DO THIS - Runtime type validation
function isAgentMessage(value: unknown): value is AgentMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'payload' in value
  );
}

// Better - Use Zod for complex validation
import { z } from 'zod';

const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['PR_CREATED', 'REVIEW_COMMENTS_POSTED', 'PR_MERGED']),
  payload: z.record(z.unknown()),
  timestamp: z.number(),
});

type AgentMessage = z.infer<typeof AgentMessageSchema>;

// Usage
function handleMessage(data: unknown): void {
  const result = AgentMessageSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Invalid message', result.error);
  }
  const message = result.data; // ✅ Type-safe
  // Process message...
}
```

#### Avoid any:
```typescript
// NEVER DO THIS
function processData(data: any): void { // ❌
  console.log(data.someField); // No type safety
}

// DO THIS
function processData(data: unknown): void {
  if (isValidData(data)) {
    console.log(data.someField); // ✅ Type-safe after guard
  }
}

// OR THIS
function processData<T extends DataSchema>(data: T): void {
  console.log(data.someField); // ✅ Generic constraint
}
```

---

### RESOURCE MANAGEMENT:

#### Connection Cleanup:
```typescript
// DO THIS - Proper resource cleanup
export class NatsClient {
  private connection: NatsConnection | null = null;

  async connect(url: string): Promise<void> {
    this.connection = await connect({ servers: url });
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
      this.connection = null;
    }
  }

  // Ensure cleanup on process exit
  private setupCleanupHandlers(): void {
    const cleanup = async () => {
      await this.close();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('beforeExit', cleanup);
  }
}
```

#### Timer Cleanup:
```typescript
// DO THIS - Clear timers
export class PollingService {
  private intervalId: NodeJS.Timeout | null = null;

  start(callback: () => Promise<void>, intervalMs: number): void {
    this.intervalId = setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        logger.error('Polling error', { error });
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

#### Event Listener Cleanup:
```typescript
// DO THIS - Remove event listeners
export class EventEmitterService {
  private emitter = new EventEmitter();
  private handlers = new Map<string, Function>();

  on(event: string, handler: Function): void {
    this.handlers.set(event, handler);
    this.emitter.on(event, handler);
  }

  cleanup(): void {
    for (const [event, handler] of this.handlers) {
      this.emitter.off(event, handler);
    }
    this.handlers.clear();
  }
}
```

---

### ASYNC PATTERNS:

#### Promise.all for Concurrent Operations:
```typescript
// DO THIS - Concurrent independent operations
async function loadData(): Promise<Data> {
  const [llmResponse, prData, diffData] = await Promise.all([
    llm.chat(messages),
    github.getPR(prNumber),
    github.getDiff(prNumber),
  ]);

  return combine(llmResponse, prData, diffData);
}

// NEVER DO THIS - Sequential when concurrent is possible
async function slowLoadData(): Promise<Data> {
  const llmResponse = await llm.chat(messages); // ❌ Waits unnecessarily
  const prData = await github.getPR(prNumber);   // ❌ Could run in parallel
  const diffData = await github.getDiff(prNumber); // ❌
  return combine(llmResponse, prData, diffData);
}
```

#### Timeout Handling:
```typescript
// DO THIS - Timeout for long operations
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

// Usage
const result = await withTimeout(
  llm.chat(messages),
  30000,
  'LLM request timed out after 30s'
);
```

#### Cancellation with AbortSignal:
```typescript
// DO THIS - Support cancellation
async function fetchWithCancel(
  url: string,
  signal: AbortSignal
): Promise<Response> {
  const response = await fetch(url, { signal });

  if (signal.aborted) {
    throw new AbortError('Request was cancelled');
  }

  return response;
}

// Usage
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetchWithCancel(url, controller.signal);
} catch (error) {
  if (error instanceof AbortError) {
    logger.info('Request cancelled');
  }
}
```

---

### SCHEMA VALIDATION (Zod):

```typescript
// DO THIS - Validate all external inputs
import { z } from 'zod';

// API Response Schema
const GitHubPRSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1).max(256),
  state: z.enum(['open', 'closed', 'merged']),
  body: z.string().nullable(),
  head: z.object({
    ref: z.string(),
    sha: z.string().regex(/^[a-f0-9]{40}$/),
  }),
  base: z.object({
    ref: z.string(),
  }),
  created_at: z.string().datetime(),
});

type GitHubPR = z.infer<typeof GitHubPRSchema>;

// Environment Variables Schema
const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GITHUB_TOKEN: z.string().min(1),
  NATS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
}).refine(
  (data) => data.ANTHROPIC_API_KEY || data.OPENAI_API_KEY,
  { message: 'At least one LLM API key is required' }
);

export const env = EnvSchema.parse(process.env);

// LLM Response Validation
const LLMResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});

async function callLLM(prompt: string): Promise<LLMResponse> {
  const rawResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4',
    messages: [{ role: 'user', content: prompt }],
  });

  // Validate response structure
  const response = LLMResponseSchema.parse(rawResponse);
  return response;
}
```

---

## Critical Patterns to Avoid

### DANGEROUS PATTERNS:

```typescript
// NEVER DO THIS - Throwing in async without catch
async function badAsync(): Promise<void> {
  throw new Error('This will cause unhandled rejection'); // ❌
}

// NEVER DO THIS - Using any type
function processData(data: any): void { // ❌
  console.log(data.field);
}

// NEVER DO THIS - Silent catch
async function silentError(): Promise<void> {
  try {
    await riskyOperation();
  } catch (error) {
    // ❌ No logging, no handling, just swallowed
  }
}

// NEVER DO THIS - Unvalidated external data
async function handleWebhook(req: Request): Promise<void> {
  const data = req.body; // ❌ No validation
  await processWebhookData(data);
}

// NEVER DO THIS - Promise not awaited
async function forgottenPromise(): Promise<void> {
  riskyOperation(); // ❌ Promise ignored
  console.log('Done'); // Runs before riskyOperation completes
}

// NEVER DO THIS - Resource leak
async function resourceLeak(): Promise<void> {
  const connection = await createConnection();
  await doWork(connection);
  // ❌ Connection never closed
}

// NEVER DO THIS - Race condition
class Counter {
  private count = 0;

  async increment(): Promise<void> {
    const current = this.count; // ❌ Race condition
    await someAsyncOperation();
    this.count = current + 1;
  }
}
```

### PREFERRED PATTERNS:

```typescript
// DO THIS - Proper async error handling
async function goodAsync(): Promise<void> {
  try {
    await riskyOperation();
  } catch (error) {
    logger.error('Operation failed', { error });
    throw new AgentError('Failed to complete operation', 'OP_FAILED', true);
  }
}

// DO THIS - Proper typing
function processData(data: unknown): void {
  const validated = DataSchema.parse(data); // ✅ Validated
  console.log(validated.field);
}

// DO THIS - Logged and re-thrown
async function properError(): Promise<void> {
  try {
    await riskyOperation();
  } catch (error) {
    logger.error('Risky operation failed', {
      error,
      context: { /* relevant data */ }
    });
    throw error; // ✅ Re-throw after logging
  }
}

// DO THIS - Schema validation
async function handleWebhook(req: Request): Promise<void> {
  const result = WebhookSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid webhook payload', result.error);
  }
  await processWebhookData(result.data); // ✅ Type-safe
}

// DO THIS - Await all promises
async function rememberedPromise(): Promise<void> {
  await riskyOperation(); // ✅ Awaited
  console.log('Done'); // Runs after completion
}

// DO THIS - Resource cleanup with try-finally
async function properCleanup(): Promise<void> {
  const connection = await createConnection();
  try {
    await doWork(connection);
  } finally {
    await connection.close(); // ✅ Always closed
  }
}

// DO THIS - Lock for critical sections
import { Mutex } from 'async-mutex';

class Counter {
  private count = 0;
  private mutex = new Mutex();

  async increment(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const current = this.count; // ✅ Protected
      await someAsyncOperation();
      this.count = current + 1;
    });
  }
}
```

---

## Testing Standards

### COMPREHENSIVE TEST COVERAGE:

```typescript
// DO THIS - Comprehensive test structure
describe('CoderAgent', () => {
  let agent: CoderAgent;
  let mockLLM: jest.Mocked<LLMClient>;
  let mockGitHub: jest.Mocked<GitHubClient>;

  beforeEach(() => {
    mockLLM = createMockLLMClient();
    mockGitHub = createMockGitHubClient();
    agent = new CoderAgent(mockLLM, mockGitHub);
  });

  afterEach(async () => {
    await agent.cleanup(); // ✅ Cleanup after each test
  });

  describe('analyzeRequirements', () => {
    it('should parse simple requirements into features', async () => {
      // Arrange
      const requirements = 'Build a user authentication system';
      mockLLM.chat.mockResolvedValue(mockFeatureList);

      // Act
      const features = await agent.analyzeRequirements(requirements);

      // Assert
      expect(features).toHaveLength(1);
      expect(features[0].title).toBe('User Authentication System');
      expect(mockLLM.chat).toHaveBeenCalledTimes(1);
    });

    it('should handle LLM errors gracefully', async () => {
      // Arrange
      mockLLM.chat.mockRejectedValue(new LLMError('Rate limited', 'claude'));

      // Act & Assert
      await expect(
        agent.analyzeRequirements('test')
      ).rejects.toThrow(LLMError);
    });

    it('should retry on retryable errors', async () => {
      // Arrange
      mockLLM.chat
        .mockRejectedValueOnce(new LLMError('Rate limited', 'claude'))
        .mockResolvedValueOnce(mockFeatureList);

      // Act
      const features = await agent.analyzeRequirements('test');

      // Assert
      expect(features).toHaveLength(1);
      expect(mockLLM.chat).toHaveBeenCalledTimes(2);
    });

    it('should validate LLM response schema', async () => {
      // Arrange
      mockLLM.chat.mockResolvedValue({ invalid: 'response' });

      // Act & Assert
      await expect(
        agent.analyzeRequirements('test')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('resource cleanup', () => {
    it('should close all connections on cleanup', async () => {
      // Arrange
      await agent.start();

      // Act
      await agent.cleanup();

      // Assert
      expect(mockLLM.close).toHaveBeenCalled();
      expect(mockGitHub.close).toHaveBeenCalled();
    });
  });
});
```

### INTEGRATION TESTS:

```typescript
// tests/integration/e2e-workflow.test.ts
describe('E2E Workflow', () => {
  let natsClient: NatsClient;
  let db: PrismaClient;

  beforeAll(async () => {
    // Setup real infrastructure (Docker Compose)
    natsClient = new NatsClient();
    await natsClient.connect('nats://localhost:4222');

    db = new PrismaClient();
    await db.$connect();
  });

  afterAll(async () => {
    await natsClient.close();
    await db.$disconnect();
  });

  it('should complete full PR cycle: create -> review -> merge', async () => {
    // This test runs against real NATS and PostgreSQL
    const jobId = await createTestJob(db);

    // Start agents
    const coder = new CoderAgent();
    const reviewer = new ReviewerAgent();
    const repoManager = new RepoManagerAgent();

    await Promise.all([
      coder.start(),
      reviewer.start(),
      repoManager.start(),
    ]);

    try {
      // Trigger workflow
      await natsClient.publish('agent.coder', {
        type: 'START_PROJECT',
        payload: { jobId },
      });

      // Wait for completion (with timeout)
      const result = await waitForMessage(
        'agent.repo-manager',
        'ALL_FEATURES_COMPLETE',
        60000
      );

      expect(result).toBeDefined();

      // Verify database state
      const job = await db.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('COMPLETED');
    } finally {
      await Promise.all([
        coder.stop(),
        reviewer.stop(),
        repoManager.stop(),
      ]);
    }
  }, 120000); // 2 minute timeout
});
```

### PROPERTY-BASED TESTING:

```typescript
import fc from 'fast-check';

describe('FeaturePrioritizer', () => {
  it('should always return sorted features', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.uuid(),
          priority: fc.integer({ min: 1, max: 100 }),
          title: fc.string(),
        })),
        (features) => {
          const sorted = prioritizeFeatures(features);

          // Check sorted order
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i - 1].priority).toBeLessThanOrEqual(sorted[i].priority);
          }

          // Check all features included
          expect(sorted).toHaveLength(features.length);
        }
      )
    );
  });
});
```

---

## Documentation Standards

### CODE DOCUMENTATION:

```typescript
/**
 * Analyzes user requirements and generates a structured feature plan.
 *
 * @param requirements - Natural language description of project requirements
 * @param options - Optional configuration for analysis
 * @returns Array of features with titles, descriptions, and priorities
 *
 * @throws {LLMError} If LLM API call fails after retries
 * @throws {ValidationError} If LLM response doesn't match expected schema
 *
 * @example
 * ```typescript
 * const agent = new CoderAgent();
 * const features = await agent.analyzeRequirements(
 *   'Build a blog with user authentication'
 * );
 * console.log(features[0].title); // "User Authentication System"
 * ```
 *
 * @remarks
 * This method makes multiple LLM API calls and may take 10-30 seconds.
 * Automatic retry with exponential backoff for rate limits.
 *
 * @internal
 * Uses the following prompt template: {@link REQUIREMENTS_ANALYSIS_PROMPT}
 */
async analyzeRequirements(
  requirements: string,
  options?: AnalysisOptions
): Promise<Feature[]> {
  // Implementation
}
```

### ERROR DOCUMENTATION:

```typescript
/**
 * Custom error for LLM-related failures.
 *
 * @example
 * ```typescript
 * if (response.status === 429) {
 *   throw new LLMError('Rate limited', 'claude');
 * }
 * ```
 */
export class LLMError extends AgentError {
  /**
   * Creates an LLMError instance.
   *
   * @param message - Human-readable error description
   * @param provider - LLM provider that failed (claude | openai | gemini)
   */
  constructor(
    message: string,
    public readonly provider: LLMProvider
  ) {
    super(message, 'LLM_ERROR', true); // Always retryable
  }
}
```

---

## Multi-Agent Specific Patterns

### MESSAGE HANDLING:

```typescript
// DO THIS - Type-safe message handling
type MessageHandler<T extends MessageType> = (
  payload: MessagePayload[T]
) => Promise<void>;

class MessageRouter {
  private handlers = new Map<MessageType, MessageHandler<any>>();

  on<T extends MessageType>(
    type: T,
    handler: MessageHandler<T>
  ): void {
    this.handlers.set(type, handler);
  }

  async route(message: AgentMessage): Promise<void> {
    const handler = this.handlers.get(message.type);
    if (!handler) {
      throw new Error(`No handler for message type: ${message.type}`);
    }

    try {
      await handler(message.payload);
    } catch (error) {
      logger.error('Message handling failed', {
        messageType: message.type,
        messageId: message.id,
        error,
      });
      throw error;
    }
  }
}

// Usage
const router = new MessageRouter();

router.on('PR_CREATED', async (payload: PRCreatedPayload) => {
  await reviewPR(payload.prNumber);
});

router.on('REVIEW_APPROVED', async (payload: ReviewApprovedPayload) => {
  await mergePR(payload.prNumber);
});
```

### STATE MACHINE:

```typescript
// DO THIS - Type-safe state machine
type CoderState =
  | 'IDLE'
  | 'ANALYZING_REQUIREMENTS'
  | 'PLANNING'
  | 'IMPLEMENTING_FEATURE'
  | 'CREATING_PR'
  | 'WAITING_FOR_REVIEW'
  | 'ADDRESSING_FEEDBACK'
  | 'FEATURE_COMPLETE';

type StateTransition = {
  from: CoderState;
  to: CoderState;
  event: string;
};

const VALID_TRANSITIONS: StateTransition[] = [
  { from: 'IDLE', to: 'ANALYZING_REQUIREMENTS', event: 'START_PROJECT' },
  { from: 'ANALYZING_REQUIREMENTS', to: 'PLANNING', event: 'REQUIREMENTS_ANALYZED' },
  { from: 'PLANNING', to: 'IMPLEMENTING_FEATURE', event: 'PLAN_READY' },
  // ... more transitions
];

class CoderAgent {
  private state: CoderState = 'IDLE';

  async transitionTo(newState: CoderState, event: string): Promise<void> {
    const transition = VALID_TRANSITIONS.find(
      (t) => t.from === this.state && t.to === newState && t.event === event
    );

    if (!transition) {
      throw new InvalidStateTransitionError(
        `Cannot transition from ${this.state} to ${newState} on ${event}`
      );
    }

    logger.info('State transition', {
      from: this.state,
      to: newState,
      event,
    });

    this.state = newState;

    // Persist state to database
    await this.db.agentState.update({
      where: { agentType: 'CODER' },
      data: { state: newState },
    });
  }
}
```

---

## Performance Patterns

### STREAMING FOR LARGE DATA:

```typescript
// DO THIS - Stream large diffs instead of loading in memory
import { pipeline } from 'stream/promises';

async function streamDiff(prNumber: number): Promise<void> {
  const diffStream = await github.getDiffStream(prNumber);
  const parser = new DiffParser();
  const analyzer = new DiffAnalyzer();

  await pipeline(
    diffStream,
    parser,
    analyzer,
    async function* (chunks) {
      for await (const chunk of chunks) {
        yield await processChunk(chunk);
      }
    }
  );
}

// NEVER DO THIS - Loading huge diff into memory
async function loadEntireDiff(prNumber: number): Promise<void> {
  const diff = await github.getDiff(prNumber); // ❌ Could be 100MB+
  const lines = diff.split('\n'); // ❌ Memory spike
  // Process...
}
```

### CACHING:

```typescript
// DO THIS - Cache expensive operations
import { LRUCache } from 'lru-cache';

const prCache = new LRUCache<number, GitHubPR>({
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
});

async function getPR(prNumber: number): Promise<GitHubPR> {
  const cached = prCache.get(prNumber);
  if (cached) {
    logger.debug('PR cache hit', { prNumber });
    return cached;
  }

  const pr = await github.getPR(prNumber);
  prCache.set(prNumber, pr);
  return pr;
}
```

---

## Monitoring and Observability

### STRUCTURED LOGGING:

```typescript
// DO THIS - Structured logging with context
import { logger } from '@shared/logging/logger';

logger.info('PR created', {
  agent: 'coder',
  jobId: job.id,
  featureId: feature.id,
  prNumber: pr.number,
  prUrl: pr.url,
  duration: Date.now() - startTime,
});

logger.error('LLM request failed', {
  agent: 'coder',
  provider: 'claude',
  model: 'claude-sonnet-4',
  error: error.message,
  stack: error.stack,
  retryCount: 3,
});

// NEVER DO THIS - Unstructured console.log
console.log('PR created:', prNumber); // ❌
console.error('Error:', error); // ❌
```

### METRICS:

```typescript
// DO THIS - Track important metrics
class MetricsCollector {
  private counters = new Map<string, number>();
  private timers = new Map<string, number[]>();

  incrementCounter(name: string, value = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  recordTiming(name: string, durationMs: number): void {
    const timings = this.timers.get(name) || [];
    timings.push(durationMs);
    this.timers.set(name, timings);
  }

  async getMetrics(): Promise<Record<string, unknown>> {
    return {
      counters: Object.fromEntries(this.counters),
      timings: Object.fromEntries(
        Array.from(this.timers).map(([name, values]) => [
          name,
          {
            count: values.length,
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            p50: percentile(values, 50),
            p95: percentile(values, 95),
            p99: percentile(values, 99),
          },
        ])
      ),
    };
  }
}

// Usage
const metrics = new MetricsCollector();

async function createPR(): Promise<void> {
  const start = Date.now();
  try {
    await github.createPR(/* ... */);
    metrics.incrementCounter('pr.created.success');
  } catch (error) {
    metrics.incrementCounter('pr.created.failure');
    throw error;
  } finally {
    metrics.recordTiming('pr.created.duration', Date.now() - start);
  }
}
```

---

This system prompt establishes TypeScript-specific quality standards for the Multi-Agent Coding System, ensuring type safety, proper error handling, resource management, and comprehensive testing while maintaining the rigor of the original Rust guidelines.
