/**
 * Mock LLM Client Implementation
 *
 * Provides a deterministic LLM client for testing agents.
 *
 * @module dx/testing/impl
 */

import type {
  IMockLLMClient,
  MockResponse,
  MockMessage,
  MockLLMOptions,
  LLMCallRecord,
  MockTokenUsage,
  CallMatcher,
  CallExpectation,
} from '../interfaces/testing.interface';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Response matcher
 */
interface ResponseMatcher {
  pattern: string | RegExp;
  response: MockResponse;
}

/**
 * Expectation tracker
 */
class ExpectationTracker implements CallExpectation {
  private expectedCount?: number;
  private atLeast = false;
  private neverCalled = false;
  private actualCount = 0;

  constructor(private matcher: CallMatcher, private records: () => LLMCallRecord[]) {}

  times(count: number): CallExpectation {
    this.expectedCount = count;
    return this;
  }

  atLeastOnce(): CallExpectation {
    this.atLeast = true;
    this.expectedCount = 1;
    return this;
  }

  never(): CallExpectation {
    this.neverCalled = true;
    this.expectedCount = 0;
    return this;
  }

  verify(): void {
    const records = this.records();
    this.actualCount = records.filter((r) => this.matchesRecord(r)).length;

    if (this.neverCalled && this.actualCount > 0) {
      throw new Error(`Expected no calls matching criteria but found ${this.actualCount}`);
    }

    if (this.atLeast && this.actualCount < (this.expectedCount ?? 1)) {
      throw new Error(
        `Expected at least ${this.expectedCount} calls matching criteria but found ${this.actualCount}`
      );
    }

    if (this.expectedCount !== undefined && !this.atLeast && this.actualCount !== this.expectedCount) {
      throw new Error(
        `Expected exactly ${this.expectedCount} calls matching criteria but found ${this.actualCount}`
      );
    }
  }

  private matchesRecord(record: LLMCallRecord): boolean {
    const { matcher } = this;

    // Check custom matcher first
    if (matcher.custom) {
      return matcher.custom(record);
    }

    // Check message content
    for (const message of record.messages) {
      if (matcher.role && message.role !== matcher.role) {
        continue;
      }

      if (matcher.messageContains && message.content.includes(matcher.messageContains)) {
        return true;
      }

      if (matcher.messageMatches && matcher.messageMatches.test(message.content)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Mock LLM Client Implementation
 */
export class MockLLMClient implements IMockLLMClient {
  private responseMatchers: ResponseMatcher[] = [];
  private responseSequence: MockResponse[] = [];
  private sequenceIndex = 0;
  private defaultResponse: MockResponse = { content: 'Mock response' };
  private callHistory: LLMCallRecord[] = [];
  private expectations: ExpectationTracker[] = [];

  // Simulations
  private simulatedError?: Error;
  private simulatedLatency = 0;
  private simulateInterruption = false;

  // === Mock Setup ===

  /**
   * Set response for a pattern
   */
  setResponse(pattern: string | RegExp, response: MockResponse): void {
    this.responseMatchers.push({ pattern, response });
  }

  /**
   * Set sequence of responses
   */
  setResponseSequence(responses: MockResponse[]): void {
    this.responseSequence = [...responses];
    this.sequenceIndex = 0;
  }

  /**
   * Set default response
   */
  setDefaultResponse(response: MockResponse): void {
    this.defaultResponse = response;
  }

  /**
   * Clear all mock responses
   */
  clearResponses(): void {
    this.responseMatchers = [];
    this.responseSequence = [];
    this.sequenceIndex = 0;
    this.defaultResponse = { content: 'Mock response' };
  }

  // === Execution ===

  /**
   * Complete a prompt
   */
  async complete(prompt: string, options?: MockLLMOptions): Promise<string> {
    const response = await this.chat([{ role: 'user', content: prompt }], options);
    return response.content;
  }

  /**
   * Stream a completion
   */
  async *stream(prompt: string, _options?: MockLLMOptions): AsyncIterable<string> {
    // Check for simulated error
    if (this.simulatedError) {
      const error = this.simulatedError;
      this.simulatedError = undefined;
      throw error;
    }

    // Get response
    const response = await this.getResponse(prompt);

    // Apply latency
    if (response.delay || this.simulatedLatency) {
      await sleep(response.delay ?? this.simulatedLatency);
    }

    // Stream characters
    const content = response.content;
    const chunkSize = 10;

    for (let i = 0; i < content.length; i += chunkSize) {
      // Check for interruption
      if (this.simulateInterruption) {
        this.simulateInterruption = false;
        throw new Error('Stream interrupted');
      }

      yield content.slice(i, i + chunkSize);
      await sleep(10); // Small delay between chunks
    }

    // Record the call
    this.recordCall([{ role: 'user', content: prompt }], response);
  }

  /**
   * Chat completion
   */
  async chat(messages: MockMessage[], _options?: MockLLMOptions): Promise<MockResponse> {
    // Check for simulated error
    if (this.simulatedError) {
      const error = this.simulatedError;
      this.simulatedError = undefined;
      throw error;
    }

    // Get last user message for matching
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const prompt = lastUserMessage?.content ?? '';

    // Get response
    const response = await this.getResponse(prompt);

    // Apply latency
    if (response.delay || this.simulatedLatency) {
      await sleep(response.delay ?? this.simulatedLatency);
    }

    // Record the call
    this.recordCall(messages, response);

    return response;
  }

  // === Verification ===

  /**
   * Get call history
   */
  getCallHistory(): LLMCallRecord[] {
    return [...this.callHistory];
  }

  /**
   * Create expectation for call matching
   */
  expectCall(matcher: CallMatcher): CallExpectation {
    const expectation = new ExpectationTracker(matcher, () => this.callHistory);
    this.expectations.push(expectation);
    return expectation;
  }

  /**
   * Verify all expectations
   */
  verifyAllExpectations(): void {
    for (const expectation of this.expectations) {
      expectation.verify();
    }
    this.expectations = [];
  }

  /**
   * Get call count
   */
  getCallCount(): number {
    return this.callHistory.length;
  }

  /**
   * Check if a pattern was called
   */
  wasCalled(matcher: CallMatcher): boolean {
    return this.callHistory.some((record) => {
      if (matcher.custom) {
        return matcher.custom(record);
      }

      for (const message of record.messages) {
        if (matcher.role && message.role !== matcher.role) {
          continue;
        }

        if (matcher.messageContains && message.content.includes(matcher.messageContains)) {
          return true;
        }

        if (matcher.messageMatches && matcher.messageMatches.test(message.content)) {
          return true;
        }
      }

      return false;
    });
  }

  // === Simulation ===

  /**
   * Simulate an error
   */
  simulateError(error: Error): void {
    this.simulatedError = error;
  }

  /**
   * Simulate latency
   */
  simulateLatency(ms: number): void {
    this.simulatedLatency = ms;
  }

  /**
   * Simulate stream interruption
   */
  simulateStreamInterruption(): void {
    this.simulateInterruption = true;
  }

  /**
   * Clear simulations
   */
  clearSimulations(): void {
    this.simulatedError = undefined;
    this.simulatedLatency = 0;
    this.simulateInterruption = false;
  }

  // === Lifecycle ===

  /**
   * Reset all state
   */
  reset(): void {
    this.clearResponses();
    this.clearSimulations();
    this.callHistory = [];
    this.expectations = [];
  }

  // === Private Methods ===

  private async getResponse(prompt: string): Promise<MockResponse> {
    // Check sequence first
    if (this.responseSequence.length > 0 && this.sequenceIndex < this.responseSequence.length) {
      return this.responseSequence[this.sequenceIndex++];
    }

    // Check pattern matchers
    for (const matcher of this.responseMatchers) {
      if (typeof matcher.pattern === 'string') {
        if (prompt.includes(matcher.pattern)) {
          return matcher.response;
        }
      } else if (matcher.pattern.test(prompt)) {
        return matcher.response;
      }
    }

    // Return default
    return this.defaultResponse;
  }

  private recordCall(messages: MockMessage[], response: MockResponse): void {
    const tokenUsage: MockTokenUsage = response.tokenUsage ?? {
      inputTokens: messages.reduce((sum, m) => sum + m.content.length / 4, 0),
      outputTokens: response.content.length / 4,
    };

    const record: LLMCallRecord = {
      id: generateId(),
      timestamp: new Date(),
      messages: [...messages],
      response,
      duration: response.delay ?? 0,
      tokenUsage,
    };

    this.callHistory.push(record);
  }
}

/**
 * Create a new Mock LLM Client
 */
export function createMockLLMClient(): IMockLLMClient {
  return new MockLLMClient();
}
