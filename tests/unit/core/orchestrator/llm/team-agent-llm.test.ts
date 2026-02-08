/**
 * Team Agent LLM Adapter Tests
 */

import { z } from 'zod';
import {
  TeamAgentLLMAdapter,
  formatTaskForPrompt,
  createTeamAgentLLMAdapter,
} from '../../../../../src/core/orchestrator/llm/team-agent-llm';
import type { ILLMClient, LLMCompletionResult } from '../../../../../src/shared/llm/base-client';
import { createTask } from '../../../../../src/core/workspace/task-document';

// ============================================================================
// Helpers
// ============================================================================

function makeCompletionResult(content: string): LLMCompletionResult {
  return {
    content,
    model: 'test-model',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
  };
}

function makeMockClient(overrides: Partial<ILLMClient> = {}): ILLMClient {
  return {
    getProvider: jest.fn().mockReturnValue('test'),
    getDefaultModel: jest.fn().mockReturnValue('test-model'),
    chat: jest.fn().mockResolvedValue(makeCompletionResult('{"result": "ok"}')),
    chatStream: jest.fn().mockResolvedValue(makeCompletionResult('streamed')),
    getMaxContextLength: jest.fn().mockReturnValue(4096),
    ...overrides,
  };
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return createTask({
    title: 'Test Task',
    type: 'feature',
    from: 'orchestrator',
    to: 'development',
    content: 'Implement feature X',
    ...overrides,
  });
}

// ============================================================================
// TeamAgentLLMAdapter
// ============================================================================

describe('TeamAgentLLMAdapter', () => {
  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should use defaults from client', () => {
      const client = makeMockClient();
      const adapter = new TeamAgentLLMAdapter({ client });
      expect(adapter.getClient()).toBe(client);
    });

    it('should accept custom config', () => {
      const client = makeMockClient();
      const adapter = new TeamAgentLLMAdapter({
        client,
        model: 'custom-model',
        temperature: 0.5,
        maxTokens: 8192,
        retryAttempts: 5,
        retryDelay: 2000,
      });
      expect(adapter.getClient()).toBe(client);
    });
  });

  // ==========================================================================
  // execute
  // ==========================================================================

  describe('execute', () => {
    it('should call client.chat and parse JSON response', async () => {
      const client = makeMockClient({
        chat: jest.fn().mockResolvedValue(makeCompletionResult('{"name": "test"}')),
      });
      const adapter = new TeamAgentLLMAdapter({ client });
      const schema = z.object({ name: z.string() });

      const result = await adapter.execute('system', 'user', schema);
      expect(result.parsed).toEqual({ name: 'test' });
      expect(result.raw).toBe('{"name": "test"}');
      expect(result.model).toBe('test-model');
    });

    it('should extract JSON from code blocks', async () => {
      const client = makeMockClient({
        chat: jest.fn().mockResolvedValue(
          makeCompletionResult('```json\n{"value": 42}\n```'),
        ),
      });
      const adapter = new TeamAgentLLMAdapter({ client });
      const schema = z.object({ value: z.number() });

      const result = await adapter.execute('sys', 'usr', schema);
      expect(result.parsed).toEqual({ value: 42 });
    });

    it('should throw for invalid JSON', async () => {
      const client = makeMockClient({
        chat: jest.fn().mockResolvedValue(makeCompletionResult('not json')),
      });
      const adapter = new TeamAgentLLMAdapter({ client });
      const schema = z.object({ x: z.number() });

      await expect(adapter.execute('sys', 'usr', schema)).rejects.toThrow('Failed to parse');
    });

    it('should pass options to client', async () => {
      const chatMock = jest.fn().mockResolvedValue(makeCompletionResult('{"ok": true}'));
      const client = makeMockClient({ chat: chatMock });
      const adapter = new TeamAgentLLMAdapter({ client, temperature: 0.3 });
      const schema = z.object({ ok: z.boolean() });

      await adapter.execute('sys', 'usr', schema, { maxTokens: 1000 });

      expect(chatMock).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ maxTokens: 1000, temperature: 0.3 }),
      );
    });
  });

  // ==========================================================================
  // executeRaw
  // ==========================================================================

  describe('executeRaw', () => {
    it('should return raw LLM result', async () => {
      const client = makeMockClient();
      const adapter = new TeamAgentLLMAdapter({ client });

      const result = await adapter.executeRaw('system', 'user');
      expect(result.content).toBe('{"result": "ok"}');
      expect(result.model).toBe('test-model');
    });
  });

  // ==========================================================================
  // executeWithHistory
  // ==========================================================================

  describe('executeWithHistory', () => {
    it('should include conversation history', async () => {
      const chatMock = jest.fn().mockResolvedValue(makeCompletionResult('{"done": true}'));
      const client = makeMockClient({ chat: chatMock });
      const adapter = new TeamAgentLLMAdapter({ client });
      const schema = z.object({ done: z.boolean() });

      const history = [
        { role: 'user' as const, content: 'first question' },
        { role: 'assistant' as const, content: 'first answer' },
        { role: 'user' as const, content: 'follow up' },
      ];

      await adapter.executeWithHistory('system', history, schema);

      const messages = chatMock.mock.calls[0][0];
      expect(messages).toHaveLength(4); // system + 3 history
      expect(messages[0].role).toBe('system');
      expect(messages[1].content).toBe('first question');
    });
  });

  // ==========================================================================
  // Retry logic
  // ==========================================================================

  describe('retry logic', () => {
    it('should retry on retryable errors', async () => {
      const chatMock = jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('503 Service Unavailable'), {}))
        .mockResolvedValueOnce(makeCompletionResult('{"ok": true}'));

      const client = makeMockClient({ chat: chatMock });
      const adapter = new TeamAgentLLMAdapter({ client, retryDelay: 1 });
      const schema = z.object({ ok: z.boolean() });

      const result = await adapter.execute('sys', 'usr', schema);
      expect(result.parsed).toEqual({ ok: true });
      expect(chatMock).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const chatMock = jest.fn().mockRejectedValue(new Error('Invalid API key'));

      const client = makeMockClient({ chat: chatMock });
      const adapter = new TeamAgentLLMAdapter({ client, retryDelay: 1 });

      await expect(adapter.executeRaw('sys', 'usr')).rejects.toThrow('Invalid API key');
      expect(chatMock).toHaveBeenCalledTimes(1);
    });

    it('should throw after exhausting retries', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.name = 'LLMTimeoutError';
      const chatMock = jest.fn().mockRejectedValue(timeoutError);

      const client = makeMockClient({ chat: chatMock });
      const adapter = new TeamAgentLLMAdapter({ client, retryAttempts: 2, retryDelay: 1 });

      await expect(adapter.executeRaw('sys', 'usr')).rejects.toThrow('timeout');
      expect(chatMock).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================================
// formatTaskForPrompt
// ============================================================================

describe('formatTaskForPrompt', () => {
  it('should include task title', () => {
    const task = makeTask();
    const prompt = formatTaskForPrompt(task);
    expect(prompt).toContain('## Task: Test Task');
  });

  it('should include type, priority, and from', () => {
    const task = makeTask({ priority: 'high' });
    const prompt = formatTaskForPrompt(task);
    expect(prompt).toContain('**Type**: feature');
    expect(prompt).toContain('**Priority**: high');
    expect(prompt).toContain('**From**: orchestrator');
  });

  it('should include tags when present', () => {
    const task = makeTask({ tags: ['urgent', 'security'] });
    const prompt = formatTaskForPrompt(task);
    expect(prompt).toContain('**Tags**: urgent, security');
  });

  it('should not include tags line when empty', () => {
    const task = makeTask();
    const prompt = formatTaskForPrompt(task);
    expect(prompt).not.toContain('**Tags**');
  });

  it('should include description content', () => {
    const task = makeTask({ content: 'Build the login page' });
    const prompt = formatTaskForPrompt(task);
    expect(prompt).toContain('### Description');
    expect(prompt).toContain('Build the login page');
  });
});

// ============================================================================
// createTeamAgentLLMAdapter
// ============================================================================

describe('createTeamAgentLLMAdapter', () => {
  it('should create adapter instance', () => {
    const client = makeMockClient();
    const adapter = createTeamAgentLLMAdapter({ client });
    expect(adapter).toBeInstanceOf(TeamAgentLLMAdapter);
  });
});
