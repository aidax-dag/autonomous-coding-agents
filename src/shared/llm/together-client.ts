import OpenAI from 'openai';
import {
  BaseLLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
} from '@/shared/llm/base-client';
import { LLMError, LLMRateLimitError, LLMTimeoutError } from '@/shared/errors/custom-errors';
import { logger } from '@/shared/logging/logger';

/**
 * Together AI LLM Client
 *
 * Provides integration with Together AI's API via OpenAI-compatible endpoint.
 *
 * Feature: F-4 - Additional LLM Providers
 */

const DEFAULT_MODEL = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
const BASE_URL = 'https://api.together.xyz/v1';

const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': 128000,
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': 128000,
  'Qwen/Qwen2.5-72B-Instruct-Turbo': 32768,
};

export class TogetherClient extends BaseLLMClient {
  private client: OpenAI;

  constructor(apiKey: string, defaultModel: string = DEFAULT_MODEL) {
    super(apiKey, defaultModel);
    this.client = new OpenAI({ apiKey, baseURL: BASE_URL });
  }

  getProvider(): string {
    return 'together';
  }

  getMaxContextLength(model?: string): number {
    const modelName = model || this.defaultModel;
    return MODEL_CONTEXT_LENGTHS[modelName] || 128000;
  }

  async chat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    this.validateMessages(messages);

    const model = this.getModel(options);

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        top_p: options?.topP,
        stop: options?.stopSequences,
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from Together AI');
      }

      return {
        content: choice.message.content || '',
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        finishReason: choice.finish_reason || 'stop',
        metadata: {
          id: response.id,
          created: response.created,
          systemFingerprint: response.system_fingerprint,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async chatStream(
    messages: LLMMessage[],
    callback: LLMStreamCallback,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    this.validateMessages(messages);

    const model = this.getModel(options);

    try {
      let fullContent = '';
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
      let finishReason: string = 'stop';
      let modelName = model;

      const stream = await this.client.chat.completions.create({
        model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        top_p: options?.topP,
        stop: options?.stopSequences,
        stream: true,
        stream_options: {
          include_usage: true,
        },
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const chunkFinishReason = chunk.choices[0]?.finish_reason;

        if (delta?.content) {
          const content = delta.content;
          fullContent += content;

          await callback({
            content,
            isComplete: false,
          });
        }

        if (chunkFinishReason) {
          finishReason = chunkFinishReason;
        }

        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0,
          };
        }

        if (chunk.model) {
          modelName = chunk.model;
        }
      }

      await callback({
        content: '',
        isComplete: true,
        usage,
      });

      return {
        content: fullContent,
        model: modelName,
        usage,
        finishReason,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle Together AI API errors
   */
  private handleError(error: unknown): Error {
    logger.warn('Together AI API error', { error: error instanceof Error ? error.message : String(error) });
    if (error instanceof OpenAI.APIError) {
      const status = error.status;

      // Rate limit error
      if (status === 429) {
        const retryAfter = error.headers?.['retry-after']
          ? parseInt(error.headers['retry-after'], 10) * 1000
          : undefined;

        return new LLMRateLimitError(
          `Together AI API rate limit exceeded: ${error.message}`,
          retryAfter,
          {
            status,
            type: error.type,
            code: error.code,
          }
        );
      }

      // Timeout error
      if (status === 408 || error.message.includes('timeout')) {
        return new LLMTimeoutError(`Together AI API timeout: ${error.message}`, 30000, {
          status,
          type: error.type,
          code: error.code,
        });
      }

      // General API error
      return new LLMError(
        `Together AI API error: ${error.message}`,
        undefined,
        status ? status >= 500 : false,
        {
          status,
          type: error.type,
          code: error.code,
        }
      );
    }

    // Unknown error
    return new LLMError(`Unexpected error: ${String(error)}`, undefined, false);
  }
}

/**
 * Factory function to create a Together AI client
 */
export function createTogetherClient(apiKey: string, defaultModel?: string): TogetherClient {
  return new TogetherClient(apiKey, defaultModel);
}
