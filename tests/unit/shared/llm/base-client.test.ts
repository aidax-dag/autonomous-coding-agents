/**
 * Base LLM Client Tests
 */

import {
  BaseLLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
  createUserMessage,
  createSystemMessage,
  createAssistantMessage,
  formatMessages,
} from '../../../../src/shared/llm/base-client';

// ============================================================================
// Concrete test implementation
// ============================================================================

class TestLLMClient extends BaseLLMClient {
  getProvider(): string {
    return 'test-provider';
  }

  async chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    this.validateMessages(messages);
    return {
      content: 'response',
      model: this.getModel(options),
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    };
  }

  async chatStream(
    messages: LLMMessage[],
    _callback: LLMStreamCallback,
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletionResult> {
    this.validateMessages(messages);
    return {
      content: 'streamed',
      model: this.getModel(options),
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    };
  }

  getMaxContextLength(_model?: string): number {
    return 4096;
  }

  // Expose protected methods for testing
  public testValidateMessages(messages: LLMMessage[]): void {
    this.validateMessages(messages);
  }

  public testGetModel(options?: LLMCompletionOptions): string {
    return this.getModel(options);
  }
}

// ============================================================================
// Constructor
// ============================================================================

describe('BaseLLMClient', () => {
  describe('constructor', () => {
    it('should accept valid api key and model', () => {
      const client = new TestLLMClient('sk-test', 'gpt-4');
      expect(client.getDefaultModel()).toBe('gpt-4');
    });

    it('should throw for empty api key', () => {
      expect(() => new TestLLMClient('', 'gpt-4')).toThrow('API key is required');
    });
  });

  // ==========================================================================
  // getDefaultModel
  // ==========================================================================

  describe('getDefaultModel', () => {
    it('should return the configured model', () => {
      const client = new TestLLMClient('sk-test', 'claude-3');
      expect(client.getDefaultModel()).toBe('claude-3');
    });
  });

  // ==========================================================================
  // getProvider
  // ==========================================================================

  describe('getProvider', () => {
    it('should return provider name from implementation', () => {
      const client = new TestLLMClient('sk-test', 'gpt-4');
      expect(client.getProvider()).toBe('test-provider');
    });
  });

  // ==========================================================================
  // validateMessages
  // ==========================================================================

  describe('validateMessages', () => {
    let client: TestLLMClient;

    beforeEach(() => {
      client = new TestLLMClient('sk-test', 'gpt-4');
    });

    it('should accept valid messages', () => {
      expect(() =>
        client.testValidateMessages([{ role: 'user', content: 'hello' }]),
      ).not.toThrow();
    });

    it('should accept all valid roles', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
        { role: 'assistant', content: 'ast' },
      ];
      expect(() => client.testValidateMessages(messages)).not.toThrow();
    });

    it('should throw for empty array', () => {
      expect(() => client.testValidateMessages([])).toThrow('cannot be empty');
    });

    it('should throw for invalid role', () => {
      expect(() =>
        client.testValidateMessages([{ role: 'invalid' as any, content: 'x' }]),
      ).toThrow('Invalid message role');
    });

    it('should throw for non-string content', () => {
      expect(() =>
        client.testValidateMessages([{ role: 'user', content: 123 as any }]),
      ).toThrow('content must be a string');
    });
  });

  // ==========================================================================
  // getModel
  // ==========================================================================

  describe('getModel', () => {
    let client: TestLLMClient;

    beforeEach(() => {
      client = new TestLLMClient('sk-test', 'default-model');
    });

    it('should return option model when provided', () => {
      expect(client.testGetModel({ model: 'custom-model' })).toBe('custom-model');
    });

    it('should return default model when no option', () => {
      expect(client.testGetModel()).toBe('default-model');
    });

    it('should return default model when option has no model', () => {
      expect(client.testGetModel({ temperature: 0.5 })).toBe('default-model');
    });
  });

  // ==========================================================================
  // chat & chatStream
  // ==========================================================================

  describe('chat', () => {
    it('should return completion result', async () => {
      const client = new TestLLMClient('sk-test', 'gpt-4');
      const result = await client.chat([{ role: 'user', content: 'hi' }]);
      expect(result.content).toBe('response');
      expect(result.model).toBe('gpt-4');
      expect(result.finishReason).toBe('stop');
    });

    it('should use custom model from options', async () => {
      const client = new TestLLMClient('sk-test', 'gpt-4');
      const result = await client.chat(
        [{ role: 'user', content: 'hi' }],
        { model: 'gpt-3.5' },
      );
      expect(result.model).toBe('gpt-3.5');
    });
  });

  describe('chatStream', () => {
    it('should return completion result', async () => {
      const client = new TestLLMClient('sk-test', 'gpt-4');
      const callback = jest.fn();
      const result = await client.chatStream(
        [{ role: 'user', content: 'hi' }],
        callback,
      );
      expect(result.content).toBe('streamed');
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

describe('createUserMessage', () => {
  it('should create user message', () => {
    const msg = createUserMessage('hello');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('hello');
  });
});

describe('createSystemMessage', () => {
  it('should create system message', () => {
    const msg = createSystemMessage('system prompt');
    expect(msg.role).toBe('system');
    expect(msg.content).toBe('system prompt');
  });
});

describe('createAssistantMessage', () => {
  it('should create assistant message', () => {
    const msg = createAssistantMessage('response');
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('response');
  });
});

describe('formatMessages', () => {
  it('should format messages with role labels', () => {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];
    const formatted = formatMessages(messages);
    expect(formatted).toContain('[SYSTEM]: sys');
    expect(formatted).toContain('[USER]: usr');
  });

  it('should join messages with double newlines', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ];
    const formatted = formatMessages(messages);
    expect(formatted).toBe('[USER]: a\n\n[ASSISTANT]: b');
  });

  it('should handle empty array', () => {
    expect(formatMessages([])).toBe('');
  });
});
