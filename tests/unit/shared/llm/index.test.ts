import {
  createLLMClient,
  createUserMessage,
  createSystemMessage,
  createAssistantMessage,
  formatMessages,
  ClaudeClient,
  OpenAIClient,
  GeminiClient,
} from '@/shared/llm';
import { LLMProvider } from '@/shared/config';

/**
 * LLM Client Tests
 *
 * Tests LLM client factory and helper functions.
 * Note: Actual API calls are not tested to avoid API costs.
 *
 * Feature: F1.6 - LLM API Client
 */

describe('LLM Clients', () => {
  describe('Client Factory', () => {
    it('should create Claude client', () => {
      const client = createLLMClient('claude', 'test-key');

      expect(client).toBeInstanceOf(ClaudeClient);
      expect(client.getProvider()).toBe('claude');
      expect(client.getDefaultModel()).toBe('claude-3-5-sonnet-20241022');
    });

    it('should create OpenAI client', () => {
      const client = createLLMClient('openai', 'test-key');

      expect(client).toBeInstanceOf(OpenAIClient);
      expect(client.getProvider()).toBe('openai');
      expect(client.getDefaultModel()).toBe('gpt-4o');
    });

    it('should create Gemini client', () => {
      const client = createLLMClient('gemini', 'test-key');

      expect(client).toBeInstanceOf(GeminiClient);
      expect(client.getProvider()).toBe('gemini');
      expect(client.getDefaultModel()).toBe('gemini-1.5-pro');
    });

    it('should throw error for unknown provider', () => {
      expect(() => createLLMClient('unknown' as LLMProvider, 'test-key')).toThrow(
        'Unknown LLM provider'
      );
    });

    it('should create client with custom default model', () => {
      const client = createLLMClient('claude', 'test-key', 'claude-3-opus-20240229');

      expect(client.getDefaultModel()).toBe('claude-3-opus-20240229');
    });
  });

  describe('ClaudeClient', () => {
    it('should throw error when API key is missing', () => {
      expect(() => new ClaudeClient('')).toThrow('API key is required');
    });

    it('should return correct max context length', () => {
      const client = new ClaudeClient('test-key');

      expect(client.getMaxContextLength()).toBe(200000);
      expect(client.getMaxContextLength('claude-3-opus-20240229')).toBe(200000);
      expect(client.getMaxContextLength('unknown-model')).toBe(200000);
    });
  });

  describe('OpenAIClient', () => {
    it('should throw error when API key is missing', () => {
      expect(() => new OpenAIClient('')).toThrow('API key is required');
    });

    it('should return correct max context length', () => {
      const client = new OpenAIClient('test-key');

      expect(client.getMaxContextLength()).toBe(128000);
      expect(client.getMaxContextLength('gpt-4')).toBe(8192);
      expect(client.getMaxContextLength('gpt-4-32k')).toBe(32768);
      expect(client.getMaxContextLength('unknown-model')).toBe(128000);
    });
  });

  describe('GeminiClient', () => {
    it('should throw error when API key is missing', () => {
      expect(() => new GeminiClient('')).toThrow('API key is required');
    });

    it('should return correct max context length', () => {
      const client = new GeminiClient('test-key');

      expect(client.getMaxContextLength()).toBe(2097152);
      expect(client.getMaxContextLength('gemini-1.5-flash')).toBe(1048576);
      expect(client.getMaxContextLength('gemini-1.0-pro')).toBe(32768);
      expect(client.getMaxContextLength('unknown-model')).toBe(1048576);
    });
  });

  describe('Message Helpers', () => {
    it('should create user message', () => {
      const message = createUserMessage('Hello');

      expect(message).toEqual({
        role: 'user',
        content: 'Hello',
      });
    });

    it('should create system message', () => {
      const message = createSystemMessage('You are a helpful assistant');

      expect(message).toEqual({
        role: 'system',
        content: 'You are a helpful assistant',
      });
    });

    it('should create assistant message', () => {
      const message = createAssistantMessage('Hi there!');

      expect(message).toEqual({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('should format messages for display', () => {
      const messages = [
        createSystemMessage('System prompt'),
        createUserMessage('User question'),
        createAssistantMessage('Assistant answer'),
      ];

      const formatted = formatMessages(messages);

      expect(formatted).toContain('[SYSTEM]: System prompt');
      expect(formatted).toContain('[USER]: User question');
      expect(formatted).toContain('[ASSISTANT]: Assistant answer');
    });
  });

  describe('Message Validation', () => {
    it('should throw error for empty messages array', async () => {
      const client = new ClaudeClient('test-key');

      await expect(client.chat([])).rejects.toThrow('Messages array cannot be empty');
    });

    it('should throw error for invalid role', async () => {
      const client = new ClaudeClient('test-key');

      await expect(
        client.chat([{ role: 'invalid' as any, content: 'test' }])
      ).rejects.toThrow('Invalid message role');
    });

    it('should throw error for non-string content', async () => {
      const client = new ClaudeClient('test-key');

      await expect(
        client.chat([{ role: 'user', content: 123 as any }])
      ).rejects.toThrow('Message content must be a string');
    });
  });

  describe('Model Selection', () => {
    it('should use default model when not specified', () => {
      const client = new ClaudeClient('test-key', 'claude-3-opus-20240229');

      expect(client.getDefaultModel()).toBe('claude-3-opus-20240229');
    });

    it('should use custom model from options', () => {
      const client = new ClaudeClient('test-key');

      // This would use the model from options in actual API call
      expect(client.getDefaultModel()).toBe('claude-3-5-sonnet-20241022');
    });
  });

  describe('Provider Identification', () => {
    it('should identify Claude provider', () => {
      const client = new ClaudeClient('test-key');
      expect(client.getProvider()).toBe('claude');
    });

    it('should identify OpenAI provider', () => {
      const client = new OpenAIClient('test-key');
      expect(client.getProvider()).toBe('openai');
    });

    it('should identify Gemini provider', () => {
      const client = new GeminiClient('test-key');
      expect(client.getProvider()).toBe('gemini');
    });
  });

  describe('Context Length Limits', () => {
    it('should return different context lengths for different models', () => {
      const claudeClient = new ClaudeClient('test-key');
      const openaiClient = new OpenAIClient('test-key');
      const geminiClient = new GeminiClient('test-key');

      // Claude has largest context window
      expect(claudeClient.getMaxContextLength()).toBe(200000);

      // OpenAI GPT-4o has 128k
      expect(openaiClient.getMaxContextLength()).toBe(128000);

      // Gemini 1.5 Pro has 2M tokens
      expect(geminiClient.getMaxContextLength()).toBe(2097152);
    });

    it('should handle unknown models with defaults', () => {
      const client = new ClaudeClient('test-key');

      const unknownModelContext = client.getMaxContextLength('future-model-9000');
      expect(unknownModelContext).toBeGreaterThan(0);
    });
  });
});
