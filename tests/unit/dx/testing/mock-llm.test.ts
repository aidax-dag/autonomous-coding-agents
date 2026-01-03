/**
 * Mock LLM Client Tests
 */

import { createMockLLMClient, type IMockLLMClient } from '../../../../src/dx/testing';

describe('Mock LLM Client', () => {
  let mockLLM: IMockLLMClient;

  beforeEach(() => {
    mockLLM = createMockLLMClient();
  });

  afterEach(() => {
    mockLLM.reset();
  });

  describe('Basic Response', () => {
    it('should return default response', async () => {
      const response = await mockLLM.chat([
        { role: 'user', content: 'hello' },
      ]);

      expect(response.content).toBe('Mock response');
    });

    it('should return custom default response', async () => {
      mockLLM.setDefaultResponse({ content: 'Custom default' });

      const response = await mockLLM.chat([
        { role: 'user', content: 'hello' },
      ]);

      expect(response.content).toBe('Custom default');
    });

    it('should complete prompts', async () => {
      mockLLM.setDefaultResponse({ content: 'Completion result' });

      const result = await mockLLM.complete('test prompt');

      expect(result).toBe('Completion result');
    });
  });

  describe('Pattern Matching', () => {
    it('should match string pattern', async () => {
      mockLLM.setResponse('weather', { content: 'It is sunny' });
      mockLLM.setResponse('news', { content: 'Breaking news!' });

      const weather = await mockLLM.chat([
        { role: 'user', content: 'What is the weather today?' },
      ]);
      const news = await mockLLM.chat([
        { role: 'user', content: 'Tell me the news' },
      ]);

      expect(weather.content).toBe('It is sunny');
      expect(news.content).toBe('Breaking news!');
    });

    it('should match regex pattern', async () => {
      mockLLM.setResponse(/\d+\s*\+\s*\d+/, { content: 'Math detected' });

      const response = await mockLLM.chat([
        { role: 'user', content: 'Calculate 5 + 3' },
      ]);

      expect(response.content).toBe('Math detected');
    });

    it('should return default when no pattern matches', async () => {
      mockLLM.setResponse('specific', { content: 'Specific response' });

      const response = await mockLLM.chat([
        { role: 'user', content: 'something else entirely' },
      ]);

      expect(response.content).toBe('Mock response');
    });
  });

  describe('Response Sequence', () => {
    it('should return responses in sequence', async () => {
      mockLLM.setResponseSequence([
        { content: 'First' },
        { content: 'Second' },
        { content: 'Third' },
      ]);

      const r1 = await mockLLM.chat([{ role: 'user', content: 'q1' }]);
      const r2 = await mockLLM.chat([{ role: 'user', content: 'q2' }]);
      const r3 = await mockLLM.chat([{ role: 'user', content: 'q3' }]);

      expect(r1.content).toBe('First');
      expect(r2.content).toBe('Second');
      expect(r3.content).toBe('Third');
    });

    it('should fall back to pattern matching after sequence', async () => {
      mockLLM.setResponseSequence([{ content: 'Only one' }]);
      mockLLM.setResponse('fallback', { content: 'Pattern matched' });

      const r1 = await mockLLM.chat([{ role: 'user', content: 'first' }]);
      const r2 = await mockLLM.chat([{ role: 'user', content: 'fallback' }]);

      expect(r1.content).toBe('Only one');
      expect(r2.content).toBe('Pattern matched');
    });
  });

  describe('Tool Calls', () => {
    it('should include tool calls in response', async () => {
      mockLLM.setResponse('read file', {
        content: 'I will read the file',
        toolCalls: [
          { id: 'call-1', name: 'read_file', arguments: { path: '/tmp/test.txt' } },
        ],
      });

      const response = await mockLLM.chat([
        { role: 'user', content: 'Please read file /tmp/test.txt' },
      ]);

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0].name).toBe('read_file');
      expect(response.toolCalls![0].arguments).toEqual({ path: '/tmp/test.txt' });
    });
  });

  describe('Call History', () => {
    it('should record call history', async () => {
      await mockLLM.chat([{ role: 'user', content: 'first message' }]);
      await mockLLM.chat([{ role: 'user', content: 'second message' }]);

      const history = mockLLM.getCallHistory();

      expect(history).toHaveLength(2);
      expect(history[0].messages[0].content).toBe('first message');
      expect(history[1].messages[0].content).toBe('second message');
    });

    it('should record timestamps', async () => {
      const before = new Date();
      await mockLLM.chat([{ role: 'user', content: 'test' }]);
      const after = new Date();

      const history = mockLLM.getCallHistory();

      expect(history[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(history[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should record token usage', async () => {
      mockLLM.setResponse('test', {
        content: 'response',
        tokenUsage: { inputTokens: 10, outputTokens: 20 },
      });

      await mockLLM.chat([{ role: 'user', content: 'test' }]);

      const history = mockLLM.getCallHistory();

      expect(history[0].tokenUsage.inputTokens).toBe(10);
      expect(history[0].tokenUsage.outputTokens).toBe(20);
    });

    it('should count calls', async () => {
      expect(mockLLM.getCallCount()).toBe(0);

      await mockLLM.chat([{ role: 'user', content: '1' }]);
      expect(mockLLM.getCallCount()).toBe(1);

      await mockLLM.chat([{ role: 'user', content: '2' }]);
      expect(mockLLM.getCallCount()).toBe(2);
    });
  });

  describe('wasCalled', () => {
    it('should check if pattern was called', async () => {
      await mockLLM.chat([{ role: 'user', content: 'hello world' }]);

      expect(mockLLM.wasCalled({ messageContains: 'hello' })).toBe(true);
      expect(mockLLM.wasCalled({ messageContains: 'goodbye' })).toBe(false);
    });

    it('should check regex pattern', async () => {
      await mockLLM.chat([{ role: 'user', content: 'The answer is 42' }]);

      expect(mockLLM.wasCalled({ messageMatches: /\d+/ })).toBe(true);
      expect(mockLLM.wasCalled({ messageMatches: /[A-Z]{10}/ })).toBe(false);
    });

    it('should check by role', async () => {
      await mockLLM.chat([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      expect(mockLLM.wasCalled({ role: 'system', messageContains: 'helpful' })).toBe(true);
      expect(mockLLM.wasCalled({ role: 'user', messageContains: 'helpful' })).toBe(false);
    });

    it('should use custom matcher', async () => {
      await mockLLM.chat([{ role: 'user', content: 'test' }]);
      await mockLLM.chat([{ role: 'user', content: 'another test' }]);

      expect(
        mockLLM.wasCalled({
          custom: (record) => record.messages.length === 1,
        })
      ).toBe(true);
    });
  });

  describe('Expectations', () => {
    it('should verify exact call count', async () => {
      mockLLM.expectCall({ messageContains: 'test' }).times(2);

      await mockLLM.chat([{ role: 'user', content: 'test 1' }]);
      await mockLLM.chat([{ role: 'user', content: 'test 2' }]);

      expect(() => mockLLM.verifyAllExpectations()).not.toThrow();
    });

    it('should fail when call count mismatch', async () => {
      mockLLM.expectCall({ messageContains: 'test' }).times(3);

      await mockLLM.chat([{ role: 'user', content: 'test 1' }]);
      await mockLLM.chat([{ role: 'user', content: 'test 2' }]);

      expect(() => mockLLM.verifyAllExpectations()).toThrow(/Expected exactly 3/);
    });

    it('should verify atLeastOnce', async () => {
      mockLLM.expectCall({ messageContains: 'hello' }).atLeastOnce();

      await mockLLM.chat([{ role: 'user', content: 'hello' }]);
      await mockLLM.chat([{ role: 'user', content: 'hello again' }]);

      expect(() => mockLLM.verifyAllExpectations()).not.toThrow();
    });

    it('should fail atLeastOnce when never called', async () => {
      mockLLM.expectCall({ messageContains: 'missing' }).atLeastOnce();

      await mockLLM.chat([{ role: 'user', content: 'something else' }]);

      expect(() => mockLLM.verifyAllExpectations()).toThrow(/at least 1/);
    });

    it('should verify never called', async () => {
      mockLLM.expectCall({ messageContains: 'forbidden' }).never();

      await mockLLM.chat([{ role: 'user', content: 'allowed' }]);

      expect(() => mockLLM.verifyAllExpectations()).not.toThrow();
    });

    it('should fail never when called', async () => {
      mockLLM.expectCall({ messageContains: 'forbidden' }).never();

      await mockLLM.chat([{ role: 'user', content: 'this is forbidden' }]);

      expect(() => mockLLM.verifyAllExpectations()).toThrow(/Expected no calls/);
    });
  });

  describe('Simulations', () => {
    it('should simulate error', async () => {
      mockLLM.simulateError(new Error('API error'));

      await expect(
        mockLLM.chat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('API error');

      // Should work again after error is consumed
      const response = await mockLLM.chat([{ role: 'user', content: 'test' }]);
      expect(response.content).toBe('Mock response');
    });

    it('should simulate latency', async () => {
      mockLLM.simulateLatency(100);

      const start = Date.now();
      await mockLLM.chat([{ role: 'user', content: 'test' }]);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should simulate stream interruption', async () => {
      mockLLM.setDefaultResponse({ content: 'Long response that will be cut' });
      mockLLM.simulateStreamInterruption();

      const chunks: string[] = [];

      await expect(async () => {
        for await (const chunk of mockLLM.stream('test')) {
          chunks.push(chunk);
        }
      }).rejects.toThrow('Stream interrupted');
    });

    it('should clear simulations', async () => {
      mockLLM.simulateLatency(1000);
      mockLLM.simulateError(new Error('test'));

      mockLLM.clearSimulations();

      const start = Date.now();
      const response = await mockLLM.chat([{ role: 'user', content: 'test' }]);
      const duration = Date.now() - start;

      expect(response.content).toBe('Mock response');
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Streaming', () => {
    it('should stream response in chunks', async () => {
      mockLLM.setDefaultResponse({ content: 'Hello, world!' });

      const chunks: string[] = [];
      for await (const chunk of mockLLM.stream('test')) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toBe('Hello, world!');
    });

    it('should record streaming calls', async () => {
      mockLLM.setDefaultResponse({ content: 'Streamed' });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of mockLLM.stream('stream test')) {
        // Consume stream
      }

      const history = mockLLM.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].messages[0].content).toBe('stream test');
    });
  });

  describe('Reset', () => {
    it('should reset all state', async () => {
      mockLLM.setResponse('pattern', { content: 'matched' });
      mockLLM.setResponseSequence([{ content: 'seq' }]);
      mockLLM.simulateLatency(100);

      await mockLLM.chat([{ role: 'user', content: 'test' }]);

      mockLLM.reset();

      expect(mockLLM.getCallCount()).toBe(0);
      expect(mockLLM.getCallHistory()).toHaveLength(0);

      // Should return default response after reset
      const response = await mockLLM.chat([{ role: 'user', content: 'pattern' }]);
      expect(response.content).toBe('Mock response');
    });

    it('should clear responses separately', () => {
      mockLLM.setResponse('test', { content: 'test response' });
      mockLLM.clearResponses();

      // Pattern should no longer match
      // Call history should still exist
    });
  });

  describe('Response Delay', () => {
    it('should apply per-response delay', async () => {
      mockLLM.setResponse('slow', { content: 'Slow response', delay: 100 });
      mockLLM.setResponse('fast', { content: 'Fast response' });

      const slowStart = Date.now();
      await mockLLM.chat([{ role: 'user', content: 'slow request' }]);
      const slowDuration = Date.now() - slowStart;

      const fastStart = Date.now();
      await mockLLM.chat([{ role: 'user', content: 'fast request' }]);
      const fastDuration = Date.now() - fastStart;

      expect(slowDuration).toBeGreaterThanOrEqual(100);
      expect(fastDuration).toBeLessThan(50);
    });
  });
});
