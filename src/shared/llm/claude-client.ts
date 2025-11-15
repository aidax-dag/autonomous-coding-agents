import Anthropic from '@anthropic-ai/sdk';
import {
  BaseLLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
} from '@/shared/llm/base-client';
import { LLMError, LLMRateLimitError, LLMTimeoutError } from '@/shared/errors/custom-errors';

/**
 * Claude (Anthropic) LLM Client
 *
 * Provides integration with Anthropic's Claude API.
 *
 * Feature: F1.6 - LLM API Client
 */

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-sonnet-20240620': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
};

export class ClaudeClient extends BaseLLMClient {
  private client: Anthropic;

  constructor(apiKey: string, defaultModel: string = DEFAULT_MODEL) {
    super(apiKey, defaultModel);
    this.client = new Anthropic({ apiKey });
  }

  getProvider(): string {
    return 'claude';
  }

  getMaxContextLength(model?: string): number {
    const modelName = model || this.defaultModel;
    return MODEL_CONTEXT_LENGTHS[modelName] || 200000;
  }

  async chat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    this.validateMessages(messages);

    const model = this.getModel(options);
    const { systemMessage, userMessages } = this.separateMessages(messages);

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature,
        top_p: options?.topP,
        stop_sequences: options?.stopSequences,
        system: systemMessage,
        messages: userMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      });

      return {
        content: this.extractContent(response),
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: response.stop_reason || 'stop',
        metadata: {
          id: response.id,
          type: response.type,
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
    const { systemMessage, userMessages } = this.separateMessages(messages);

    try {
      let fullContent = '';
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
      let finishReason: string = 'stop';
      let modelName = model;

      const stream = await this.client.messages.create({
        model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature,
        top_p: options?.topP,
        stop_sequences: options?.stopSequences,
        system: systemMessage,
        messages: userMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            const chunk = event.delta.text;
            fullContent += chunk;

            await callback({
              content: chunk,
              isComplete: false,
            });
          }
        } else if (event.type === 'message_start') {
          modelName = event.message.model;
          usage.promptTokens = event.message.usage.input_tokens;
        } else if (event.type === 'message_delta') {
          usage.completionTokens = event.usage.output_tokens;
          finishReason = event.delta.stop_reason || 'stop';
        }
      }

      usage.totalTokens = usage.promptTokens + usage.completionTokens;

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
   * Separate system messages from user/assistant messages
   * Claude API requires system messages to be passed separately
   */
  private separateMessages(messages: LLMMessage[]): {
    systemMessage?: string;
    userMessages: LLMMessage[];
  } {
    const systemMessages = messages.filter((msg) => msg.role === 'system');
    const userMessages = messages.filter((msg) => msg.role !== 'system');

    const systemMessage =
      systemMessages.length > 0
        ? systemMessages.map((msg) => msg.content).join('\n\n')
        : undefined;

    return { systemMessage, userMessages };
  }

  /**
   * Extract text content from response
   */
  private extractContent(response: Anthropic.Message): string {
    const textBlocks = response.content.filter((block) => block.type === 'text');
    return textBlocks.map((block) => (block as Anthropic.TextBlock).text).join('');
  }

  /**
   * Handle Anthropic API errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof Anthropic.APIError) {
      const status = error.status;

      // Rate limit error
      if (status === 429) {
        const retryAfter = error.headers?.['retry-after']
          ? parseInt(error.headers['retry-after'], 10) * 1000
          : undefined;

        return new LLMRateLimitError(
          `Claude API rate limit exceeded: ${error.message}`,
          retryAfter,
          {
            status,
          }
        );
      }

      // Timeout error
      if (status === 408 || error.message.includes('timeout')) {
        return new LLMTimeoutError(`Claude API timeout: ${error.message}`, 30000, {
          status,
        });
      }

      // General API error
      return new LLMError(
        `Claude API error: ${error.message}`,
        undefined,
        status ? status >= 500 : false,
        {
          status,
        }
      );
    }

    // Unknown error
    return new LLMError(`Unexpected error: ${String(error)}`, undefined, false);
  }
}
