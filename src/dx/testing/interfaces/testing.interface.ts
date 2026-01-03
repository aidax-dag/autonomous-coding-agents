/**
 * Testing Infrastructure Interfaces
 *
 * Provides testing utilities for agent development:
 * - Mock LLM client for deterministic tests
 * - Agent test runner
 * - Test fixtures and utilities
 *
 * @module dx/testing/interfaces
 */

import type { ITask, TaskResult, AgentType } from '../../../core/interfaces';

/**
 * Mock LLM response
 */
export interface MockResponse {
  /** Response content */
  content: string;
  /** Tool calls in the response */
  toolCalls?: MockToolCall[];
  /** Simulated delay in ms */
  delay?: number;
  /** Whether to stream the response */
  shouldStream?: boolean;
  /** Token usage for the response */
  tokenUsage?: MockTokenUsage;
}

/**
 * Mock tool call
 */
export interface MockToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Mock token usage
 */
export interface MockTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * LLM call record for verification
 */
export interface LLMCallRecord {
  id: string;
  timestamp: Date;
  messages: MockMessage[];
  response: MockResponse;
  duration: number;
  tokenUsage: MockTokenUsage;
}

/**
 * Mock message format
 */
export interface MockMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

/**
 * Call matcher for expectations
 */
export interface CallMatcher {
  /** Match by message content */
  messageContains?: string;
  /** Match by message regex */
  messageMatches?: RegExp;
  /** Match by role */
  role?: 'system' | 'user' | 'assistant';
  /** Custom matcher function */
  custom?: (record: LLMCallRecord) => boolean;
}

/**
 * Call expectation
 */
export interface CallExpectation {
  /** Number of times expected */
  times: (count: number) => CallExpectation;
  /** At least once */
  atLeastOnce: () => CallExpectation;
  /** Never called */
  never: () => CallExpectation;
  /** Verify the expectation */
  verify: () => void;
}

/**
 * Mock LLM Client Interface
 */
export interface IMockLLMClient {
  // === Mock Setup ===

  /**
   * Set response for a pattern
   */
  setResponse(pattern: string | RegExp, response: MockResponse): void;

  /**
   * Set sequence of responses
   */
  setResponseSequence(responses: MockResponse[]): void;

  /**
   * Set default response
   */
  setDefaultResponse(response: MockResponse): void;

  /**
   * Clear all mock responses
   */
  clearResponses(): void;

  // === Execution ===

  /**
   * Complete a prompt
   */
  complete(prompt: string, options?: MockLLMOptions): Promise<string>;

  /**
   * Stream a completion
   */
  stream(prompt: string, options?: MockLLMOptions): AsyncIterable<string>;

  /**
   * Chat completion
   */
  chat(messages: MockMessage[], options?: MockLLMOptions): Promise<MockResponse>;

  // === Verification ===

  /**
   * Get call history
   */
  getCallHistory(): LLMCallRecord[];

  /**
   * Create expectation for call matching
   */
  expectCall(matcher: CallMatcher): CallExpectation;

  /**
   * Verify all expectations
   */
  verifyAllExpectations(): void;

  /**
   * Get call count
   */
  getCallCount(): number;

  /**
   * Check if a pattern was called
   */
  wasCalled(matcher: CallMatcher): boolean;

  // === Simulation ===

  /**
   * Simulate an error
   */
  simulateError(error: Error): void;

  /**
   * Simulate latency
   */
  simulateLatency(ms: number): void;

  /**
   * Simulate stream interruption
   */
  simulateStreamInterruption(): void;

  /**
   * Clear simulations
   */
  clearSimulations(): void;

  // === Lifecycle ===

  /**
   * Reset all state
   */
  reset(): void;
}

/**
 * Mock LLM options
 */
export interface MockLLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * Agent test definition
 */
export interface AgentTest {
  /** Test name */
  name: string;
  /** Test description */
  description?: string;
  /** Agent type to test */
  agent: AgentType;
  /** Input task */
  input: Partial<ITask>;
  /** Expected output */
  expectedOutput?: Partial<TaskResult>;
  /** Expected tool calls */
  expectedToolCalls?: ExpectedToolCall[];
  /** Test timeout */
  timeout?: number;
  /** Tags for filtering */
  tags?: string[];
  /** Setup function */
  setup?: () => Promise<void>;
  /** Teardown function */
  teardown?: () => Promise<void>;
}

/**
 * Expected tool call
 */
export interface ExpectedToolCall {
  name: string;
  arguments?: Record<string, unknown>;
  times?: number;
}

/**
 * Agent test result
 */
export interface AgentTestResult {
  /** Test that was run */
  test: AgentTest;
  /** Whether test passed */
  passed: boolean;
  /** Actual output */
  actualOutput?: TaskResult;
  /** Error if failed */
  error?: Error;
  /** Duration in ms */
  duration: number;
  /** Tool calls made */
  toolCalls: MockToolCall[];
  /** LLM calls made */
  llmCalls: LLMCallRecord[];
}

/**
 * Agent test suite
 */
export interface AgentTestSuite {
  /** Suite name */
  name: string;
  /** Suite description */
  description?: string;
  /** Tests in suite */
  tests: AgentTest[];
  /** Suite setup */
  setup?: () => Promise<void>;
  /** Suite teardown */
  teardown?: () => Promise<void>;
  /** Tags for filtering */
  tags?: string[];
}

/**
 * Agent test suite result
 */
export interface AgentTestSuiteResult {
  /** Suite that was run */
  suite: AgentTestSuite;
  /** Results for each test */
  results: AgentTestResult[];
  /** Total duration */
  duration: number;
  /** Summary */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Agent scenario for multi-step testing
 */
export interface AgentScenario {
  /** Scenario name */
  name: string;
  /** Scenario description */
  description?: string;
  /** Steps in scenario */
  steps: ScenarioStep[];
  /** Scenario setup */
  setup?: () => Promise<void>;
  /** Scenario teardown */
  teardown?: () => Promise<void>;
}

/**
 * Scenario step
 */
export interface ScenarioStep {
  /** Step name */
  name: string;
  /** Agent type */
  agent: AgentType;
  /** Action to perform */
  action: string;
  /** Input data */
  input: unknown;
  /** Validation function */
  validate: (result: unknown) => boolean | Promise<boolean>;
  /** Timeout for step */
  timeout?: number;
}

/**
 * Scenario result
 */
export interface ScenarioResult {
  /** Scenario that was run */
  scenario: AgentScenario;
  /** Whether scenario passed */
  passed: boolean;
  /** Step results */
  stepResults: ScenarioStepResult[];
  /** Total duration */
  duration: number;
}

/**
 * Scenario step result
 */
export interface ScenarioStepResult {
  /** Step that was run */
  step: ScenarioStep;
  /** Whether step passed */
  passed: boolean;
  /** Result data */
  result?: unknown;
  /** Error if failed */
  error?: Error;
  /** Duration in ms */
  duration: number;
}

/**
 * Agent Test Runner Interface
 */
export interface IAgentTestRunner {
  // === Test Execution ===

  /**
   * Run a single test
   */
  runTest(test: AgentTest): Promise<AgentTestResult>;

  /**
   * Run a test suite
   */
  runSuite(suite: AgentTestSuite): Promise<AgentTestSuiteResult>;

  /**
   * Run a scenario
   */
  runScenario(scenario: AgentScenario): Promise<ScenarioResult>;

  // === Mock Configuration ===

  /**
   * Set the mock LLM client
   */
  setMockLLM(mock: IMockLLMClient): void;

  /**
   * Get the mock LLM client
   */
  getMockLLM(): IMockLLMClient;

  /**
   * Set mock tools
   */
  setMockTools(mocks: Map<string, MockTool>): void;

  // === Utilities ===

  /**
   * Create a test fixture
   */
  createFixture(type: AgentType): TestFixture;

  /**
   * Run tests matching tags
   */
  runByTags(tags: string[]): Promise<AgentTestSuiteResult>;
}

/**
 * Mock tool definition
 */
export interface MockTool {
  name: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Test fixture
 */
export interface TestFixture {
  /** Agent type */
  agentType: AgentType;
  /** Mock LLM */
  mockLLM: IMockLLMClient;
  /** Mock tools */
  mockTools: Map<string, MockTool>;
  /** Create task */
  createTask(overrides?: Partial<ITask>): ITask;
  /** Cleanup */
  cleanup(): Promise<void>;
}
