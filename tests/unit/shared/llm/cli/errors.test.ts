/**
 * CLI Error Classes Tests
 */

import {
  CLIError,
  CLINotFoundError,
  CLIAuthenticationError,
  CLITimeoutError,
  CLIRateLimitError,
  CLIResponseError,
  OllamaServerError,
  CLIParseError,
} from '../../../../../src/shared/llm/cli/errors';

describe('CLIError', () => {
  it('should store cli name and cause', () => {
    const cause = new Error('root');
    const err = new CLIError('msg', 'claude', cause);
    expect(err.name).toBe('CLIError');
    expect(err.message).toBe('msg');
    expect(err.cli).toBe('claude');
    expect(err.cause).toBe(cause);
  });

  it('should be an instance of Error', () => {
    expect(new CLIError('x', 'y')).toBeInstanceOf(Error);
  });
});

describe('CLINotFoundError', () => {
  it('should include CLI name and install instructions', () => {
    const err = new CLINotFoundError('codex');
    expect(err.name).toBe('CLINotFoundError');
    expect(err.cli).toBe('codex');
    expect(err.message).toContain("'codex' not found");
    expect(err.message).toContain('Installation instructions');
  });

  it('should extend CLIError', () => {
    expect(new CLINotFoundError('x')).toBeInstanceOf(CLIError);
  });
});

describe('CLIAuthenticationError', () => {
  it('should include CLI name', () => {
    const err = new CLIAuthenticationError('claude');
    expect(err.name).toBe('CLIAuthenticationError');
    expect(err.message).toContain("'claude' not authenticated");
  });

  it('should include details when provided', () => {
    const err = new CLIAuthenticationError('claude', 'token expired');
    expect(err.message).toContain('token expired');
  });

  it('should not include Details when not provided', () => {
    const err = new CLIAuthenticationError('claude');
    expect(err.message).not.toContain('Details:');
  });
});

describe('CLITimeoutError', () => {
  it('should include timeout duration', () => {
    const err = new CLITimeoutError('gemini', 30000);
    expect(err.name).toBe('CLITimeoutError');
    expect(err.timeoutMs).toBe(30000);
    expect(err.message).toContain('30000ms');
  });
});

describe('CLIRateLimitError', () => {
  it('should handle with retry after', () => {
    const err = new CLIRateLimitError('claude', 5000);
    expect(err.name).toBe('CLIRateLimitError');
    expect(err.retryAfterMs).toBe(5000);
    expect(err.message).toContain('5000ms');
  });

  it('should handle without retry after', () => {
    const err = new CLIRateLimitError('claude');
    expect(err.retryAfterMs).toBeUndefined();
    expect(err.message).toContain('rate limit');
  });
});

describe('CLIResponseError', () => {
  it('should include response and exit code', () => {
    const err = new CLIResponseError('ollama', 'bad model', 1);
    expect(err.name).toBe('CLIResponseError');
    expect(err.response).toBe('bad model');
    expect(err.exitCode).toBe(1);
    expect(err.message).toContain('bad model');
  });
});

describe('OllamaServerError', () => {
  it('should default to ollama CLI', () => {
    const err = new OllamaServerError();
    expect(err.name).toBe('OllamaServerError');
    expect(err.cli).toBe('ollama');
    expect(err.message).toContain('not running');
  });

  it('should include details when provided', () => {
    const err = new OllamaServerError('connection refused');
    expect(err.message).toContain('connection refused');
  });
});

describe('CLIParseError', () => {
  it('should include output and cause', () => {
    const cause = new Error('JSON parse failed');
    const err = new CLIParseError('claude', 'raw output', cause);
    expect(err.name).toBe('CLIParseError');
    expect(err.output).toBe('raw output');
    expect(err.message).toContain('JSON parse failed');
  });

  it('should handle missing cause', () => {
    const err = new CLIParseError('claude', 'output');
    expect(err.message).toContain('Unknown error');
  });
});
