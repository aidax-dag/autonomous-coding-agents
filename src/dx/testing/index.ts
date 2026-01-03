/**
 * Testing Infrastructure Module
 *
 * Provides testing utilities for agent development:
 * - Mock LLM client for deterministic tests
 * - Agent test runner
 * - Test fixtures and utilities
 *
 * @module dx/testing
 *
 * @example
 * ```typescript
 * import { createMockLLMClient } from '@/dx/testing';
 *
 * // Create mock LLM client
 * const mockLLM = createMockLLMClient();
 *
 * // Set up response patterns
 * mockLLM.setResponse('analyze code', {
 *   content: 'The code looks good',
 *   toolCalls: [{ id: '1', name: 'read_file', arguments: { path: 'src/main.ts' } }],
 * });
 *
 * // Set response sequence for multi-turn
 * mockLLM.setResponseSequence([
 *   { content: 'First response' },
 *   { content: 'Second response' },
 *   { content: 'Third response' },
 * ]);
 *
 * // Execute and verify
 * const response = await mockLLM.chat([
 *   { role: 'user', content: 'analyze code in main.ts' },
 * ]);
 *
 * // Check call history
 * expect(mockLLM.getCallCount()).toBe(1);
 * expect(mockLLM.wasCalled({ messageContains: 'analyze' })).toBe(true);
 *
 * // Set up expectations
 * mockLLM.expectCall({ messageContains: 'review' }).atLeastOnce();
 * mockLLM.expectCall({ messageMatches: /test/i }).times(2);
 *
 * // Run tests...
 *
 * // Verify all expectations
 * mockLLM.verifyAllExpectations();
 *
 * // Simulate errors and latency
 * mockLLM.simulateError(new Error('API rate limit'));
 * mockLLM.simulateLatency(1000);
 *
 * // Reset for next test
 * mockLLM.reset();
 * ```
 */

// Interfaces
export {
  type IMockLLMClient,
  type MockResponse,
  type MockToolCall,
  type MockTokenUsage,
  type MockMessage,
  type MockLLMOptions,
  type LLMCallRecord,
  type CallMatcher,
  type CallExpectation,
  type IAgentTestRunner,
  type AgentTest,
  type AgentTestResult,
  type AgentTestSuite,
  type AgentTestSuiteResult,
  type AgentScenario,
  type ScenarioStep,
  type ScenarioResult,
  type ScenarioStepResult,
  type ExpectedToolCall,
  type MockTool,
  type TestFixture,
} from './interfaces/testing.interface';

// Implementation
export { MockLLMClient, createMockLLMClient } from './impl/mock-llm.impl';
