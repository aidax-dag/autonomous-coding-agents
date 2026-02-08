/**
 * Base CLI Client Tests
 */

import {
  BaseCLIClient,
} from '../../../../../src/shared/llm/cli/base-cli-client';
import type {
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
} from '../../../../../src/shared/llm/base-client';

// ============================================================================
// Concrete test implementation
// ============================================================================

class TestCLIClient extends BaseCLIClient {
  protected readonly cliCommand = 'test-cli';
  protected readonly providerName = 'test-provider';
  protected readonly defaultContextLength = 8192;

  protected getDefaultModelForProvider(): string {
    return 'test-default-model';
  }

  protected buildArgs(_messages: LLMMessage[], _options?: LLMCompletionOptions): string[] {
    return ['--test'];
  }

  protected parseResponse(output: string): LLMCompletionResult {
    return {
      content: output,
      model: this.getModel(),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
    };
  }

  protected isAuthenticationError(error: string): boolean {
    return error.includes('not authenticated');
  }

  protected isRateLimitError(error: string): boolean {
    return error.includes('rate limit');
  }

  // Expose protected methods for testing
  public testFormatMessagesAsPrompt(messages: LLMMessage[]): string {
    return this.formatMessagesAsPrompt(messages);
  }

  public testExtractSystemPrompt(messages: LLMMessage[]): string | undefined {
    return this.extractSystemPrompt(messages);
  }

  public testExtractLastUserMessage(messages: LLMMessage[]): string {
    return this.extractLastUserMessage(messages);
  }

  public testValidateMessages(messages: LLMMessage[]): void {
    this.validateMessages(messages);
  }

  public testGetModel(options?: LLMCompletionOptions): string {
    return this.getModel(options);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseCLIClient', () => {
  let client: TestCLIClient;

  beforeEach(() => {
    client = new TestCLIClient();
  });

  // ==========================================================================
  // Constructor & Accessors
  // ==========================================================================

  describe('constructor', () => {
    it('should use default model from provider', () => {
      expect(client.getDefaultModel()).toBe('test-default-model');
    });

    it('should accept custom default model', () => {
      const custom = new TestCLIClient('custom-model');
      expect(custom.getDefaultModel()).toBe('custom-model');
    });
  });

  describe('getProvider', () => {
    it('should return provider name', () => {
      expect(client.getProvider()).toBe('test-provider');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return default context length', () => {
      expect(client.getMaxContextLength()).toBe(8192);
    });
  });

  // ==========================================================================
  // formatMessagesAsPrompt
  // ==========================================================================

  describe('formatMessagesAsPrompt', () => {
    it('should format system messages as context', () => {
      const result = client.testFormatMessagesAsPrompt([
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' },
      ]);
      expect(result).toContain('Be helpful');
      expect(result).toContain('User: Hello');
    });

    it('should format user and assistant messages', () => {
      const result = client.testFormatMessagesAsPrompt([
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' },
        { role: 'user', content: 'Follow up' },
      ]);
      expect(result).toContain('User: Question');
      expect(result).toContain('Assistant: Answer');
      expect(result).toContain('User: Follow up');
    });

    it('should join multiple system messages', () => {
      const result = client.testFormatMessagesAsPrompt([
        { role: 'system', content: 'Rule 1' },
        { role: 'system', content: 'Rule 2' },
        { role: 'user', content: 'Hi' },
      ]);
      expect(result).toContain('Rule 1');
      expect(result).toContain('Rule 2');
    });

    it('should handle messages without system prompt', () => {
      const result = client.testFormatMessagesAsPrompt([
        { role: 'user', content: 'Hello' },
      ]);
      expect(result).toContain('User: Hello');
      expect(result).not.toContain('undefined');
    });
  });

  // ==========================================================================
  // extractSystemPrompt
  // ==========================================================================

  describe('extractSystemPrompt', () => {
    it('should return system prompt', () => {
      const result = client.testExtractSystemPrompt([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ]);
      expect(result).toBe('You are helpful');
    });

    it('should join multiple system messages', () => {
      const result = client.testExtractSystemPrompt([
        { role: 'system', content: 'Rule A' },
        { role: 'system', content: 'Rule B' },
      ]);
      expect(result).toBe('Rule A\n\nRule B');
    });

    it('should return undefined when no system messages', () => {
      expect(client.testExtractSystemPrompt([
        { role: 'user', content: 'Hi' },
      ])).toBeUndefined();
    });
  });

  // ==========================================================================
  // extractLastUserMessage
  // ==========================================================================

  describe('extractLastUserMessage', () => {
    it('should return last user message', () => {
      const result = client.testExtractLastUserMessage([
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Reply' },
        { role: 'user', content: 'Second' },
      ]);
      expect(result).toBe('Second');
    });

    it('should throw when no user messages', () => {
      expect(() => client.testExtractLastUserMessage([
        { role: 'system', content: 'system' },
      ])).toThrow('No user message');
    });
  });

  // ==========================================================================
  // validateMessages
  // ==========================================================================

  describe('validateMessages', () => {
    it('should accept valid messages', () => {
      expect(() => client.testValidateMessages([
        { role: 'user', content: 'hello' },
      ])).not.toThrow();
    });

    it('should throw for empty array', () => {
      expect(() => client.testValidateMessages([])).toThrow('cannot be empty');
    });

    it('should throw for invalid role', () => {
      expect(() => client.testValidateMessages([
        { role: 'bot' as any, content: 'x' },
      ])).toThrow('Invalid message role');
    });

    it('should throw for non-string content', () => {
      expect(() => client.testValidateMessages([
        { role: 'user', content: 42 as any },
      ])).toThrow('content must be a string');
    });
  });

  // ==========================================================================
  // getModel
  // ==========================================================================

  describe('getModel', () => {
    it('should return option model when provided', () => {
      expect(client.testGetModel({ model: 'custom' })).toBe('custom');
    });

    it('should return default model when no option', () => {
      expect(client.testGetModel()).toBe('test-default-model');
    });
  });
});
