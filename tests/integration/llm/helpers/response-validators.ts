/**
 * Response Validators for LLM Integration Tests
 *
 * Assertion helpers that validate real LLM API responses
 * against expected structural and content constraints.
 */

import type { LLMCompletionResult } from '../../../../src/shared/llm/base-client';

/**
 * Validates that a response is a non-empty string without obvious error markers.
 */
export function validateBasicResponse(result: LLMCompletionResult): void {
  expect(result).toBeDefined();
  expect(typeof result.content).toBe('string');
  expect(result.content.trim().length).toBeGreaterThan(0);

  // Check for common error markers in response content
  const errorMarkers = ['internal server error', 'rate limit exceeded', 'ECONNREFUSED'];
  const lowerContent = result.content.toLowerCase();
  for (const marker of errorMarkers) {
    expect(lowerContent).not.toContain(marker);
  }
}

/**
 * Validates that token usage counts are present and positive.
 */
export function validateTokenCounts(result: LLMCompletionResult): void {
  expect(result.usage).toBeDefined();
  expect(result.usage.promptTokens).toBeGreaterThan(0);
  expect(result.usage.completionTokens).toBeGreaterThan(0);
  expect(result.usage.totalTokens).toBeGreaterThanOrEqual(
    result.usage.promptTokens + result.usage.completionTokens
  );
}

/**
 * Validates that the response content is valid JSON.
 * Optionally checks that the parsed object has expected keys.
 */
export function validateJsonResponse(
  result: LLMCompletionResult,
  expectedKeys?: string[]
): Record<string, unknown> {
  let parsed: Record<string, unknown>;
  try {
    // Strip markdown code fences if present
    let content = result.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error(`Response is not valid JSON: ${result.content.substring(0, 200)}`);
  }

  if (expectedKeys) {
    for (const key of expectedKeys) {
      expect(parsed).toHaveProperty(key);
    }
  }

  return parsed;
}

/**
 * Validates that a response was returned within an acceptable time window.
 */
export function validateResponseTime(startTime: number, maxMs: number): void {
  const elapsed = Date.now() - startTime;
  expect(elapsed).toBeLessThan(maxMs);
}

/**
 * Validates that provider metadata is present and reasonable.
 */
export function assertProviderMetadata(result: LLMCompletionResult): void {
  expect(result.model).toBeDefined();
  expect(typeof result.model).toBe('string');
  expect(result.model.length).toBeGreaterThan(0);
  expect(result.finishReason).toBeDefined();
  expect(typeof result.finishReason).toBe('string');
}
