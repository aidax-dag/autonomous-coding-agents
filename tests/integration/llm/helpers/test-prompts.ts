/**
 * Predefined Test Prompts for LLM Integration Tests
 *
 * Simple prompts designed to produce short, deterministic-ish responses
 * that are easy to validate without exact string matching.
 */

/** Simple arithmetic prompt. Expected response contains '4'. */
export const SIMPLE_MATH = 'What is 2+2? Reply with just the number.';

/** Short greeting prompt. Expected response is roughly 3 words. */
export const SIMPLE_GREETING = 'Say hello in exactly 3 words.';

/**
 * JSON output prompt. Expected response is a valid JSON object
 * with keys 'name' and 'age'.
 */
export const JSON_OUTPUT =
  'Return a JSON object with keys "name" (string) and "age" (number). ' +
  'Output only the JSON, no markdown fences, no explanation.';

/**
 * A prompt with a known approximate token count (~50 tokens)
 * for validating that token counting is in a reasonable range.
 */
export const TOKEN_COUNTER =
  'Explain in one sentence why the sky appears blue during the day. ' +
  'Keep your answer under 30 words.';

/**
 * Empty-ish prompt to test edge case handling.
 * Some providers reject truly empty content, so we use a minimal prompt.
 */
export const MINIMAL_PROMPT = 'Hi';
