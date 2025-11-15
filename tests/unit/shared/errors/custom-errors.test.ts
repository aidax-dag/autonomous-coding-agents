import {
  AgentError,
  ErrorCode,
  ConfigError,
  LLMError,
  LLMRateLimitError,
  LLMTimeoutError,
  GitHubError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitError,
  GitMergeConflictError,
  MessageBrokerError,
  MessageValidationError,
  DatabaseError,
  AgentTimeoutError,
  ImplementationError,
  MaxTurnsExceededError,
  ValidationError,
  isAgentError,
  isRetryableError,
  getErrorCode,
  wrapError,
  createHTTPError,
  retryWithBackoff,
} from '@/shared/errors/custom-errors';

/**
 * Custom Error Classes Tests
 *
 * Tests structured error handling and retry logic.
 *
 * Feature: F1.5 - Error Handling
 */

describe('Custom Error Classes', () => {
  describe('AgentError', () => {
    it('should create error with all properties', () => {
      const error = new AgentError(
        'Test error',
        ErrorCode.INTERNAL_ERROR,
        true,
        { key: 'value' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AgentError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.retryable).toBe(true);
      expect(error.context).toEqual({ key: 'value' });
      expect(error.timestamp).toBeLessThanOrEqual(Date.now());
      expect(error.stack).toBeDefined();
    });

    it('should have correct name', () => {
      const error = new AgentError('Test', ErrorCode.INTERNAL_ERROR);
      expect(error.name).toBe('AgentError');
    });

    it('should serialize to JSON', () => {
      const error = new AgentError(
        'Test error',
        ErrorCode.INTERNAL_ERROR,
        true,
        { key: 'value' }
      );

      const json = error.toJSON();
      expect(json.name).toBe('AgentError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(json.retryable).toBe(true);
      expect(json.context).toEqual({ key: 'value' });
      expect(json.stack).toBeDefined();
    });

    it('should convert to string', () => {
      const error = new AgentError(
        'Test error',
        ErrorCode.INTERNAL_ERROR,
        false,
        { key: 'value' }
      );

      const str = error.toString();
      expect(str).toContain('INTERNAL_ERROR');
      expect(str).toContain('Test error');
      expect(str).toContain('key');
    });
  });

  describe('ConfigError', () => {
    it('should create config error', () => {
      const error = new ConfigError('Invalid config', { field: 'apiKey' });

      expect(error).toBeInstanceOf(ConfigError);
      expect(error).toBeInstanceOf(AgentError);
      expect(error.code).toBe(ErrorCode.CONFIG_INVALID);
      expect(error.retryable).toBe(false);
      expect(error.context).toEqual({ field: 'apiKey' });
    });
  });

  describe('LLMError', () => {
    it('should create LLM error with default values', () => {
      const error = new LLMError('API call failed');

      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe(ErrorCode.LLM_API_ERROR);
      expect(error.retryable).toBe(true);
    });

    it('should create LLM error with custom code', () => {
      const error = new LLMError(
        'Context too long',
        ErrorCode.LLM_CONTEXT_LENGTH_EXCEEDED,
        false
      );

      expect(error.code).toBe(ErrorCode.LLM_CONTEXT_LENGTH_EXCEEDED);
      expect(error.retryable).toBe(false);
    });
  });

  describe('LLMRateLimitError', () => {
    it('should create rate limit error with retry after', () => {
      const error = new LLMRateLimitError('Rate limited', 60000);

      expect(error).toBeInstanceOf(LLMRateLimitError);
      expect(error.code).toBe(ErrorCode.LLM_RATE_LIMIT);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(60000);
      expect(error.context?.retryAfter).toBe(60000);
    });
  });

  describe('LLMTimeoutError', () => {
    it('should create timeout error', () => {
      const error = new LLMTimeoutError('Request timed out', 30000);

      expect(error).toBeInstanceOf(LLMTimeoutError);
      expect(error.code).toBe(ErrorCode.LLM_TIMEOUT);
      expect(error.retryable).toBe(true);
      expect(error.context?.timeoutMs).toBe(30000);
    });
  });

  describe('GitHubError', () => {
    it('should create GitHub error with status code', () => {
      const error = new GitHubError('API error', 500);

      expect(error).toBeInstanceOf(GitHubError);
      expect(error.code).toBe(ErrorCode.GITHUB_API_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.context?.statusCode).toBe(500);
    });

    it('should create GitHub error with custom code', () => {
      const error = new GitHubError(
        'Auth failed',
        401,
        ErrorCode.GITHUB_AUTH_ERROR,
        false
      );

      expect(error.code).toBe(ErrorCode.GITHUB_AUTH_ERROR);
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
    });
  });

  describe('GitHubRateLimitError', () => {
    it('should create rate limit error with reset time', () => {
      const resetAt = Date.now() + 3600000;
      const error = new GitHubRateLimitError('Rate limited', resetAt);

      expect(error).toBeInstanceOf(GitHubRateLimitError);
      expect(error.code).toBe(ErrorCode.GITHUB_RATE_LIMIT);
      expect(error.statusCode).toBe(429);
      expect(error.resetAt).toBe(resetAt);
      expect(error.retryable).toBe(true);
    });
  });

  describe('GitHubNotFoundError', () => {
    it('should create not found error', () => {
      const error = new GitHubNotFoundError('owner/repo');

      expect(error).toBeInstanceOf(GitHubNotFoundError);
      expect(error.code).toBe(ErrorCode.GITHUB_NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('owner/repo');
      expect(error.retryable).toBe(false);
    });
  });

  describe('GitError', () => {
    it('should create git error', () => {
      const error = new GitError('Git operation failed');

      expect(error).toBeInstanceOf(GitError);
      expect(error.code).toBe(ErrorCode.GIT_OPERATION_FAILED);
      expect(error.retryable).toBe(false);
    });
  });

  describe('GitMergeConflictError', () => {
    it('should create merge conflict error', () => {
      const files = ['src/file1.ts', 'src/file2.ts'];
      const error = new GitMergeConflictError('Merge conflict detected', files);

      expect(error).toBeInstanceOf(GitMergeConflictError);
      expect(error.code).toBe(ErrorCode.GIT_MERGE_CONFLICT);
      expect(error.conflictingFiles).toEqual(files);
      expect(error.message).toContain('Merge conflict detected');
      expect(error.retryable).toBe(false);
    });
  });

  describe('MessageBrokerError', () => {
    it('should create message broker error', () => {
      const error = new MessageBrokerError('Connection failed');

      expect(error).toBeInstanceOf(MessageBrokerError);
      expect(error.code).toBe(ErrorCode.MESSAGE_BROKER_ERROR);
      expect(error.retryable).toBe(true);
    });
  });

  describe('MessageValidationError', () => {
    it('should create validation error with errors list', () => {
      const validationErrors = ['Missing field: id', 'Invalid type: payload'];
      const error = new MessageValidationError(validationErrors);

      expect(error).toBeInstanceOf(MessageValidationError);
      expect(error.code).toBe(ErrorCode.MESSAGE_VALIDATION_ERROR);
      expect(error.validationErrors).toEqual(validationErrors);
      expect(error.message).toContain('Missing field: id');
      expect(error.retryable).toBe(false);
    });
  });

  describe('DatabaseError', () => {
    it('should create database error', () => {
      const error = new DatabaseError('Query failed');

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.retryable).toBe(false);
    });
  });

  describe('AgentTimeoutError', () => {
    it('should create agent timeout error', () => {
      const error = new AgentTimeoutError('CODER', 240000);

      expect(error).toBeInstanceOf(AgentTimeoutError);
      expect(error.code).toBe(ErrorCode.AGENT_TIMEOUT);
      expect(error.message).toContain('CODER');
      expect(error.message).toContain('240000ms');
      expect(error.retryable).toBe(false);
    });
  });

  describe('ImplementationError', () => {
    it('should create implementation error', () => {
      const error = new ImplementationError('Implementation failed');

      expect(error).toBeInstanceOf(ImplementationError);
      expect(error.code).toBe(ErrorCode.IMPLEMENTATION_FAILED);
      expect(error.retryable).toBe(true);
    });
  });

  describe('MaxTurnsExceededError', () => {
    it('should create max turns exceeded error', () => {
      const error = new MaxTurnsExceededError(51, 50);

      expect(error).toBeInstanceOf(MaxTurnsExceededError);
      expect(error.code).toBe(ErrorCode.IMPLEMENTATION_MAX_TURNS_EXCEEDED);
      expect(error.message).toContain('51/50');
      expect(error.retryable).toBe(false);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field', () => {
      const error = new ValidationError('Invalid email format', 'email');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.field).toBe('email');
      expect(error.retryable).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('should identify AgentError', () => {
      const agentError = new AgentError('Test', ErrorCode.INTERNAL_ERROR);
      const normalError = new Error('Test');

      expect(isAgentError(agentError)).toBe(true);
      expect(isAgentError(normalError)).toBe(false);
      expect(isAgentError('string')).toBe(false);
      expect(isAgentError(null)).toBe(false);
    });

    it('should identify retryable errors', () => {
      const retryableError = new LLMError('Test');
      const nonRetryableError = new ConfigError('Test');

      expect(isRetryableError(retryableError)).toBe(true);
      expect(isRetryableError(nonRetryableError)).toBe(false);
      expect(isRetryableError(new Error('Test'))).toBe(false);
    });

    it('should get error code', () => {
      const agentError = new LLMError('Test');
      const normalError = new Error('Test');

      expect(getErrorCode(agentError)).toBe(ErrorCode.LLM_API_ERROR);
      expect(getErrorCode(normalError)).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(getErrorCode('string')).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('Error Wrapping', () => {
    it('should wrap Error as AgentError', () => {
      const originalError = new Error('Original error');
      const wrapped = wrapError(originalError);

      expect(wrapped).toBeInstanceOf(AgentError);
      expect(wrapped.message).toBe('Original error');
      expect(wrapped.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(wrapped.context?.originalError).toBeDefined();
    });

    it('should wrap non-Error as AgentError', () => {
      const wrapped = wrapError('String error');

      expect(wrapped).toBeInstanceOf(AgentError);
      expect(wrapped.message).toBe('String error');
    });

    it('should not wrap AgentError', () => {
      const originalError = new LLMError('LLM error');
      const wrapped = wrapError(originalError);

      expect(wrapped).toBe(originalError);
    });

    it('should use custom message when wrapping', () => {
      const originalError = new Error('Original');
      const wrapped = wrapError(originalError, 'Custom message');

      expect(wrapped.message).toBe('Custom message');
    });
  });

  describe('HTTP Error Creation', () => {
    it('should create rate limit error for 429', () => {
      const error = createHTTPError(429, 'Rate limited');

      expect(error).toBeInstanceOf(GitHubRateLimitError);
      expect(error.code).toBe(ErrorCode.GITHUB_RATE_LIMIT);
    });

    it('should create not found error for 404', () => {
      const error = createHTTPError(404, 'Not found');

      expect(error).toBeInstanceOf(GitHubNotFoundError);
      expect(error.code).toBe(ErrorCode.GITHUB_NOT_FOUND);
    });

    it('should create retryable error for 5xx', () => {
      const error = createHTTPError(500, 'Server error');

      expect(error).toBeInstanceOf(GitHubError);
      expect(error.retryable).toBe(true);
    });

    it('should create non-retryable error for 4xx', () => {
      const error = createHTTPError(400, 'Bad request');

      expect(error).toBeInstanceOf(GitHubError);
      expect(error.retryable).toBe(false);
    });
  });

  describe('Retry with Backoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new LLMError('Temporary error'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const fn = jest.fn().mockRejectedValue(new ConfigError('Config error'));

      await expect(
        retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 10 })
      ).rejects.toThrow('Config error');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new LLMError('Always fails'));

      await expect(
        retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 10 })
      ).rejects.toThrow('Always fails');

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use custom shouldRetry function', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Retry this'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        shouldRetry: (error) =>
          error instanceof Error && error.message === 'Retry this',
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new LLMError('Error 1'))
        .mockRejectedValueOnce(new LLMError('Error 2'))
        .mockResolvedValue('success');

      const startTime = Date.now();

      const result = await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      });

      const elapsed = Date.now() - startTime;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      // Should have waited at least 100ms + 200ms = 300ms
      expect(elapsed).toBeGreaterThanOrEqual(250);
    });

    it('should respect maxDelayMs', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new LLMError('Error'))
        .mockResolvedValue('success');

      await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 10000,
        maxDelayMs: 100,
      });

      expect(fn).toHaveBeenCalledTimes(2);
      // Should not wait 10 seconds
    });
  });
});
