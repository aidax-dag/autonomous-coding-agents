/**
 * Mock Runner
 *
 * Creates an OrchestratorRunner with a mock LLM client for testing.
 * Extracted from orchestrator-runner.ts to keep production code lean.
 *
 * @module core/orchestrator/mock-runner
 */

import type { ILLMClient } from '@/shared/llm';
import type { PlanningOutput } from './agents/planning-agent';
import type { DevelopmentOutput } from './agents/development-agent';
import type { QAOutput } from './agents/qa-agent';
import { OrchestratorRunner, createOrchestratorRunner } from './orchestrator-runner';

/**
 * Create a runner with mock LLM for testing
 */
export function createMockRunner(options?: {
  workspaceDir?: string;
  projectContext?: string;
}): OrchestratorRunner {
  const mockClient: ILLMClient = {
    getProvider: () => 'mock',
    getDefaultModel: () => 'mock-model',
    getMaxContextLength: () => 128000,
    chat: async (messages) => {
      const lastMessage = messages[messages.length - 1];
      const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';

      let response: string;
      if (content.includes('planning') || content.includes('plan')) {
        const planOutput: PlanningOutput = {
          title: 'Mock Plan',
          summary: 'Mock planning output',
          tasks: [
            {
              title: 'Task 1',
              type: 'feature',
              targetTeam: 'development',
              description: 'First task',
            },
          ],
        };
        response = JSON.stringify(planOutput);
      } else if (content.includes('develop') || content.includes('implement')) {
        const devOutput: DevelopmentOutput = {
          summary: 'Mock development output',
          filesModified: [
            { path: 'src/test.ts', action: 'created', description: 'Test file' },
          ],
        };
        response = JSON.stringify(devOutput);
      } else if (content.includes('test') || content.includes('qa')) {
        const qaOutput: QAOutput = {
          summary: 'Mock QA output',
          approved: true,
          testResults: { total: 1, passed: 1, failed: 0, skipped: 0, tests: [] },
        };
        response = JSON.stringify(qaOutput);
      } else {
        response = JSON.stringify({ summary: 'Mock response' });
      }

      return {
        content: `\`\`\`json\n${response}\n\`\`\``,
        model: 'mock-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      };
    },
    chatStream: async (messages, callback) => {
      const result = await mockClient.chat(messages);
      await callback({ content: result.content, isComplete: true, usage: result.usage });
      return result;
    },
  };

  return createOrchestratorRunner({
    llmClient: mockClient,
    workspaceDir: options?.workspaceDir,
    projectContext: options?.projectContext,
    enableLLM: true,
  });
}
