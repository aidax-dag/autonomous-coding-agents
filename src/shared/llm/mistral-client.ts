import { Mistral } from '@mistralai/mistralai';
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
 * Mistral AI LLM Client
 *
 * Provides integration with Mistral AI's API.
 *
 * Feature: F-4 - Additional LLM Providers
 */

const DEFAULT_MODEL = 'mistral-large-latest';

const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  'mistral-large-latest': 128000,
  'mistral-medium-latest': 32000,
  'mistral-small-latest': 32000,
  'codestral-latest': 32000,
  'open-mistral-nemo': 128000,
};

export class MistralClient extends BaseLLMClient {
  private client: Mistral;

  constructor(apiKey: string, defaultModel: string = DEFAULT_MODEL) {
    super(apiKey, defaultModel);
    this.client = new Mistral({ apiKey });
  }

  getProvider(): string {
    return 'mistral';
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
      const response = await this.client.chat.complete({
        model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
        topP: options?.topP,
        stop: options?.stopSequences,
      });

      const choice = response.choices?.[0];
      if (!choice || !choice.message) {
        throw new Error('No response from Mistral');
      }

      return {
        content: (choice.message.content as string) || '',
        model: response.model || model,
        usage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
          totalTokens: response.usage?.totalTokens || 0,
        },
        finishReason: choice.finishReason || 'stop',
        metadata: {
          id: response.id,
          created: response.created,
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

      const stream = await this.client.chat.stream({
        model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
        topP: options?.topP,
        stop: options?.stopSequences,
      });

      for await (const event of stream) {
        const chunk = event.data;
        const delta = chunk.choices?.[0]?.delta;
        const chunkFinishReason = chunk.choices?.[0]?.finishReason;

        if (delta?.content) {
          const content = delta.content as string;
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
            promptTokens: chunk.usage.promptTokens || 0,
            completionTokens: chunk.usage.completionTokens || 0,
            totalTokens: chunk.usage.totalTokens || 0,
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
   * Handle Mistral API errors
   */
  private handleError(error: unknown): Error {
    logger.warn('Mistral API error', { error: error instanceof Error ? error.message : String(error) });

    if (error instanceof Error) {
      const message = error.message;

      // Rate limit error
      if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
        return new LLMRateLimitError(
          `Mistral API rate limit exceeded: ${message}`,
          undefined,
          { originalError: message }
        );
      }

      // Timeout error
      if (message.includes('timeout') || message.includes('408')) {
        return new LLMTimeoutError(`Mistral API timeout: ${message}`, 30000, {
          originalError: message,
        });
      }

      // Server error (retryable)
      if (message.includes('500') || message.includes('503') || message.includes('server error')) {
        return new LLMError(`Mistral API server error: ${message}`, undefined, true, {
          originalError: message,
        });
      }

      // General API error
      return new LLMError(`Mistral API error: ${message}`, undefined, false, {
        originalError: message,
      });
    }

    // Unknown error
    return new LLMError(`Unexpected error: ${String(error)}`, undefined, false);
  }
}

/**
 * Factory function to create a Mistral client
 */
export function createMistralClient(apiKey: string, defaultModel?: string): MistralClient {
  return new MistralClient(apiKey, defaultModel);
}
