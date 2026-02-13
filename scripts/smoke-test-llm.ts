#!/usr/bin/env ts-node
/**
 * Smoke Test: Real LLM API Verification
 *
 * Manual verification script that tests the full executor pipeline
 * with a real LLM API key. Not part of automated tests.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx ts-node scripts/smoke-test-llm.ts
 *   OPENAI_API_KEY=sk-...   npx ts-node scripts/smoke-test-llm.ts
 *
 * @module scripts
 */

/* eslint-disable no-console */

import { createLLMClient, type ILLMClient } from '../src/shared/llm';
import { createTeamAgentLLMAdapter } from '../src/core/orchestrator/llm/team-agent-llm';
import { PlanningOutputSchema } from '../src/core/orchestrator/llm/planning-llm';
import { DeepReviewOutputSchema } from '../src/core/orchestrator/llm/code-quality-llm';

// ============================================================================
// Helpers
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  summary?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: () => Promise<string>,
): Promise<void> {
  const start = Date.now();
  try {
    const summary = await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration, summary });
    console.log(`  PASS  ${name} (${duration}ms)`);
    if (summary) console.log(`        ${summary}`);
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, duration, error });
    console.log(`  FAIL  ${name} (${duration}ms)`);
    console.log(`        Error: ${error}`);
  }
}

function detectProvider(): { provider: 'claude' | 'openai'; apiKey: string } {
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'claude', apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY };
  }
  throw new Error(
    'No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.',
  );
}

// ============================================================================
// Test Scenarios
// ============================================================================

async function main(): Promise<void> {
  console.log('\n=== LLM Smoke Test ===\n');

  // Detect provider
  let client: ILLMClient;
  try {
    const { provider, apiKey } = detectProvider();
    console.log(`Provider: ${provider}`);
    client = createLLMClient(provider, apiKey);
    console.log(`Model: ${client.getDefaultModel()}\n`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // --- Test 1: Basic LLM Connection ---
  await runTest('Basic LLM connection', async () => {
    const result = await client.chat([
      { role: 'user', content: 'Reply with exactly: "OK"' },
    ], { maxTokens: 10 });

    if (!result.content) throw new Error('Empty response');
    return `Response: "${result.content.trim()}" | Tokens: ${result.usage.totalTokens}`;
  });

  // --- Test 2: Planning Executor ---
  await runTest('Planning executor (structured output)', async () => {
    const adapter = createTeamAgentLLMAdapter({
      client,
      temperature: 0.3,
      maxTokens: 2048,
      retryAttempts: 2,
    });

    const response = await adapter.execute(
      `You are a planning expert. Decompose the given goal into a structured plan.
Output JSON with: title, summary, tasks (array of { title, type, targetTeam, description }).
Valid types: feature, bugfix, refactor, test, review, documentation, infrastructure, analysis, planning, design.
Valid targetTeams: orchestrator, planning, design, development, frontend, backend, qa, code-quality, infrastructure, pm, issue-response.
Wrap your JSON in a \`\`\`json code block.`,
      'Create a simple string utility library with capitalize and trim functions.',
      PlanningOutputSchema,
    );

    const { parsed } = response;
    return `Plan: "${parsed.title}" | Tasks: ${parsed.tasks.length} | Model: ${response.model}`;
  });

  // --- Test 3: Code Review Skill ---
  await runTest('Code review skill (structured output)', async () => {
    const adapter = createTeamAgentLLMAdapter({
      client,
      temperature: 0.3,
      maxTokens: 2048,
      retryAttempts: 2,
    });

    const sampleCode = `
function processData(data) {
  var result = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i] != null) {
      result.push(data[i].toString());
    }
  }
  return result;
}`;

    const response = await adapter.execute(
      `You are a senior code reviewer. Analyze the code for patterns, security, performance, and maintainability.
Output JSON with: summary, findings (array of { type, severity, category, message, file, lineStart }),
metrics ({ complexity, maintainability, testability, security, overall } each 0-100),
approved (boolean), reason (string), actionItems (array of strings).
Valid types: pattern, security, performance, maintainability, best-practice.
Valid severities: critical, major, minor, suggestion.
Wrap your JSON in a \`\`\`json code block.`,
      `## Code to Review\n\`\`\`javascript\n${sampleCode}\n\`\`\``,
      DeepReviewOutputSchema,
    );

    const { parsed } = response;
    return `Findings: ${parsed.findings.length} | Score: ${parsed.metrics.overall} | Approved: ${parsed.approved}`;
  });

  // --- Test 4: Error Handling (empty input) ---
  await runTest('Error handling (graceful failure)', async () => {
    const adapter = createTeamAgentLLMAdapter({
      client,
      temperature: 0.3,
      maxTokens: 256,
      retryAttempts: 1,
    });

    try {
      await adapter.execute(
        'Return a JSON with title and summary fields. Wrap in ```json code block.',
        '',
        PlanningOutputSchema,
      );
      return 'LLM handled empty input gracefully';
    } catch (err) {
      return `Expected failure: ${err instanceof Error ? err.message.slice(0, 80) : 'unknown'}`;
    }
  });

  // --- Summary ---
  console.log('\n=== Results ===\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Time: ${totalTime}ms\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    for (const r of results.filter((t) => !t.passed)) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
    process.exit(1);
  }

  console.log('All smoke tests passed!\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
