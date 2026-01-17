/**
 * CLI LLM Client Error Classes
 *
 * Custom error types for CLI-based LLM client operations.
 */

/**
 * Base error class for CLI LLM operations
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly cli: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Error thrown when the CLI executable is not found
 */
export class CLINotFoundError extends CLIError {
  constructor(cli: string) {
    super(
      `CLI '${cli}' not found. Please install it first.\n` +
        `Installation instructions:\n` +
        `  - claude: npm install -g @anthropic-ai/claude-code\n` +
        `  - codex: npm install -g @openai/codex\n` +
        `  - gemini: npm install -g @anthropic-ai/gemini-cli\n` +
        `  - ollama: https://ollama.ai/download`,
      cli
    );
    this.name = 'CLINotFoundError';
  }
}

/**
 * Error thrown when CLI authentication fails
 */
export class CLIAuthenticationError extends CLIError {
  constructor(cli: string, details?: string) {
    super(
      `CLI '${cli}' not authenticated. Please login first.\n` +
        `Run '${cli}' interactively to authenticate.` +
        (details ? `\nDetails: ${details}` : ''),
      cli
    );
    this.name = 'CLIAuthenticationError';
  }
}

/**
 * Error thrown when CLI execution times out
 */
export class CLITimeoutError extends CLIError {
  constructor(
    cli: string,
    public readonly timeoutMs: number
  ) {
    super(`CLI '${cli}' execution timed out after ${timeoutMs}ms`, cli);
    this.name = 'CLITimeoutError';
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class CLIRateLimitError extends CLIError {
  public readonly retryAfterMs?: number;

  constructor(cli: string, retryAfterMs?: number) {
    super(
      `CLI '${cli}' rate limit exceeded.` +
        (retryAfterMs ? ` Retry after ${retryAfterMs}ms.` : ''),
      cli
    );
    this.name = 'CLIRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Error thrown when CLI returns an error response
 */
export class CLIResponseError extends CLIError {
  constructor(
    cli: string,
    public readonly response: string,
    public readonly exitCode?: number
  ) {
    super(`CLI '${cli}' returned an error: ${response}`, cli);
    this.name = 'CLIResponseError';
  }
}

/**
 * Error thrown when Ollama server is not running
 */
export class OllamaServerError extends CLIError {
  constructor(details?: string) {
    super(
      `Ollama server is not running. Start it with 'ollama serve'.` +
        (details ? `\nDetails: ${details}` : ''),
      'ollama'
    );
    this.name = 'OllamaServerError';
  }
}

/**
 * Error thrown when parsing CLI output fails
 */
export class CLIParseError extends CLIError {
  constructor(
    cli: string,
    public readonly output: string,
    cause?: Error
  ) {
    super(`Failed to parse CLI '${cli}' output: ${cause?.message || 'Unknown error'}`, cli, cause);
    this.name = 'CLIParseError';
  }
}
