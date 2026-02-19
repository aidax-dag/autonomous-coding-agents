/**
 * Ollama Client
 *
 * LLM client that uses the Ollama REST API for completions.
 * Requires Ollama to be installed and running locally.
 *
 * Usage:
 *   - Install: https://ollama.ai/download
 *   - Start server: ollama serve
 *   - Pull models: ollama pull llama3
 */

import {
  ILLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
  LLMStreamChunk,
} from '../base-client';
import { OllamaServerError, CLIResponseError } from './errors';

/**
 * Ollama API response structure
 */
interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama streaming chunk
 */
interface OllamaStreamChunk {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Ollama tags response (list models)
 */
interface OllamaTagsResponse {
  models: Array<{
    name: string;
    size: number;
    modified_at: string;
  }>;
}

/**
 * Default configuration
 */
const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3';
const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Context length mapping (approximate values)
 */
const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  llama3: 8192,
  'llama3:8b': 8192,
  'llama3:70b': 8192,
  'llama3.1': 128000,
  'llama3.1:8b': 128000,
  'llama3.1:70b': 128000,
  'llama3.2': 128000,
  mistral: 32768,
  'mistral:7b': 32768,
  mixtral: 32768,
  'mixtral:8x7b': 32768,
  codellama: 16384,
  'codellama:7b': 16384,
  'codellama:13b': 16384,
  'codellama:34b': 16384,
  deepseek: 16384,
  'deepseek-coder': 16384,
  qwen: 32768,
  'qwen:7b': 32768,
  'qwen:14b': 32768,
  phi: 2048,
  'phi:2b': 2048,
  gemma: 8192,
  'gemma:2b': 8192,
  'gemma:7b': 8192,
};

/**
 * Ollama REST API Client
 */
export class OllamaClient implements ILLMClient {
  private readonly host: string;
  private defaultModel: string;
  private readonly defaultContextLength = 8192;

  constructor(defaultModel?: string, host?: string) {
    this.host = host || DEFAULT_HOST;
    this.defaultModel = defaultModel || DEFAULT_MODEL;
  }

  /**
   * Get provider name
   */
  getProvider(): string {
    return 'ollama';
  }

  /**
   * Get default model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Get maximum context length
   */
  getMaxContextLength(model?: string): number {
    const modelName = model || this.defaultModel;
    // Check exact match first
    if (MODEL_CONTEXT_LENGTHS[modelName]) {
      return MODEL_CONTEXT_LENGTHS[modelName];
    }
    // Check base model name
    const baseModel = modelName.split(':')[0];
    return MODEL_CONTEXT_LENGTHS[baseModel] || this.defaultContextLength;
  }

  /**
   * Check if Ollama server is running and get available models
   */
  async checkServer(): Promise<{ available: boolean; models: string[]; error?: string }> {
    try {
      const response = await fetch(`${this.host}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          available: false,
          models: [],
          error: `Server returned status ${response.status}`,
        };
      }

      const data = (await response.json()) as OllamaTagsResponse;
      return {
        available: true,
        models: data.models.map((m) => m.name),
      };
    } catch (error) {
      return {
        available: false,
        models: [],
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Extract system prompt from messages
   */
  private extractSystemPrompt(messages: LLMMessage[]): string | undefined {
    const systemMessages = messages.filter((m) => m.role === 'system');
    if (systemMessages.length === 0) {
      return undefined;
    }
    return systemMessages.map((m) => m.content).join('\n\n');
  }

  /**
   * Extract last user message
   */
  private extractLastUserMessage(messages: LLMMessage[]): string {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      throw new Error('No user message found in messages');
    }
    return userMessages[userMessages.length - 1].content;
  }

  /**
   * Chat completion
   */
  async chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    // Check server availability first
    const serverStatus = await this.checkServer();
    if (!serverStatus.available) {
      throw new OllamaServerError(serverStatus.error);
    }

    const model = options?.model || this.defaultModel;
    const systemPrompt = this.extractSystemPrompt(messages);
    const userMessage = this.extractLastUserMessage(messages);

    // Build request body
    const requestBody: Record<string, unknown> = {
      model,
      prompt: userMessage,
      stream: false,
    };

    // Add system prompt if present
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    // Add options if specified
    if (options?.temperature !== undefined) {
      requestBody.options = {
        ...(requestBody.options as Record<string, unknown> | undefined),
        temperature: options.temperature,
      };
    }

    if (options?.maxTokens !== undefined) {
      requestBody.options = {
        ...(requestBody.options as Record<string, unknown> | undefined),
        num_predict: options.maxTokens,
      };
    }

    const timeoutMs = options?.timeout || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    if (timeout.unref) {
      timeout.unref();
    }

    try {
      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new CLIResponseError('ollama', errorText, response.status);
      }

      const data = (await response.json()) as OllamaGenerateResponse;

      return {
        content: data.response.trim(),
        model: data.model,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        finishReason: data.done ? 'stop' : 'length',
        metadata: {
          totalDuration: data.total_duration,
          loadDuration: data.load_duration,
          promptEvalDuration: data.prompt_eval_duration,
          evalDuration: data.eval_duration,
        },
      };
    } catch (error) {
      if (error instanceof CLIResponseError || error instanceof OllamaServerError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new CLIResponseError('ollama', `Request timed out after ${timeoutMs}ms`);
      }

      throw new OllamaServerError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Chat completion with streaming
   */
  async chatStream(
    messages: LLMMessage[],
    callback: LLMStreamCallback,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    // Check server availability first
    const serverStatus = await this.checkServer();
    if (!serverStatus.available) {
      throw new OllamaServerError(serverStatus.error);
    }

    const model = options?.model || this.defaultModel;
    const systemPrompt = this.extractSystemPrompt(messages);
    const userMessage = this.extractLastUserMessage(messages);

    // Build request body
    const requestBody: Record<string, unknown> = {
      model,
      prompt: userMessage,
      stream: true,
    };

    // Add system prompt if present
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    // Add options if specified
    if (options?.temperature !== undefined) {
      requestBody.options = {
        ...(requestBody.options as Record<string, unknown> | undefined),
        temperature: options.temperature,
      };
    }

    if (options?.maxTokens !== undefined) {
      requestBody.options = {
        ...(requestBody.options as Record<string, unknown> | undefined),
        num_predict: options.maxTokens,
      };
    }

    const timeoutMs = options?.timeout || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    if (timeout.unref) {
      timeout.unref();
    }

    try {
      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new CLIResponseError('ollama', errorText, response.status);
      }

      if (!response.body) {
        throw new CLIResponseError('ollama', 'No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let fullContent = '';
      let finalData: OllamaStreamChunk | null = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const text = decoder.decode(value);
        const lines = text.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const chunk = JSON.parse(line) as OllamaStreamChunk;
            fullContent += chunk.response;

            // Emit chunk to callback
            const streamChunk: LLMStreamChunk = {
              content: chunk.response,
              isComplete: chunk.done,
            };
            await callback(streamChunk);

            if (chunk.done) {
              finalData = chunk;
            }
          } catch {
            // Skip non-JSON lines
            continue;
          }
        }
      }

      // Emit final completion chunk
      const completeChunk: LLMStreamChunk = {
        content: '',
        isComplete: true,
        usage: finalData
          ? {
              promptTokens: finalData.prompt_eval_count || 0,
              completionTokens: finalData.eval_count || 0,
              totalTokens: (finalData.prompt_eval_count || 0) + (finalData.eval_count || 0),
            }
          : undefined,
      };
      await callback(completeChunk);

      return {
        content: fullContent.trim(),
        model: finalData?.model || model,
        usage: {
          promptTokens: finalData?.prompt_eval_count || 0,
          completionTokens: finalData?.eval_count || 0,
          totalTokens: (finalData?.prompt_eval_count || 0) + (finalData?.eval_count || 0),
        },
        finishReason: 'stop',
        metadata: {
          totalDuration: finalData?.total_duration,
        },
      };
    } catch (error) {
      if (error instanceof CLIResponseError || error instanceof OllamaServerError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new CLIResponseError('ollama', `Request timed out after ${timeoutMs}ms`);
      }

      throw new OllamaServerError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
}
