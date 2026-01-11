import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  BaseLLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
} from '@/shared/llm/base-client';
import { LLMError, LLMRateLimitError, LLMTimeoutError } from '@/shared/errors/custom-errors';

/**
 * Gemini (Google) LLM Client
 *
 * Provides integration with Google's Gemini API.
 *
 * Feature: F1.6 - LLM API Client
 */

const DEFAULT_MODEL = 'gemini-2.0-flash';

const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  'gemini-2.0-flash': 1048576, // 1M tokens
  'gemini-2.0-flash-exp': 1048576, // 1M tokens
  'gemini-1.5-flash': 1048576, // 1M tokens
  'gemini-1.5-pro': 2097152, // 2M tokens
  'gemini-1.0-pro': 32768,
};

export class GeminiClient extends BaseLLMClient {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string, defaultModel: string = DEFAULT_MODEL) {
    super(apiKey, defaultModel);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  getProvider(): string {
    return 'gemini';
  }

  getMaxContextLength(model?: string): number {
    const modelName = model || this.defaultModel;
    return MODEL_CONTEXT_LENGTHS[modelName] || 1048576;
  }

  async chat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    this.validateMessages(messages);

    const model = this.getModel(options);
    const genModel = this.getGenerativeModel(model, options);

    try {
      const { systemInstruction, history, currentMessage } = this.formatMessages(messages);

      const chat = genModel.startChat({
        history: history.map((msg) => ({
          role: msg.role as 'user' | 'model',
          parts: [{ text: msg.content }],
        })),
        ...(systemInstruction && {
          systemInstruction: {
            role: 'user' as const,
            parts: [{ text: systemInstruction }],
          },
        }),
      });

      const result = await chat.sendMessage(currentMessage);
      const response = result.response;

      return {
        content: response.text(),
        model,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
        finishReason: response.candidates?.[0]?.finishReason || 'stop',
        metadata: {
          candidates: response.candidates,
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
    const genModel = this.getGenerativeModel(model, options);

    try {
      const { systemInstruction, history, currentMessage } = this.formatMessages(messages);

      const chat = genModel.startChat({
        history: history.map((msg) => ({
          role: msg.role as 'user' | 'model',
          parts: [{ text: msg.content }],
        })),
        ...(systemInstruction && {
          systemInstruction: {
            role: 'user' as const,
            parts: [{ text: systemInstruction }],
          },
        }),
      });

      let fullContent = '';
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
      let finishReason: string = 'stop';

      const result = await chat.sendMessageStream(currentMessage);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        fullContent += text;

        await callback({
          content: text,
          isComplete: false,
        });

        if (chunk.usageMetadata) {
          usage = {
            promptTokens: chunk.usageMetadata.promptTokenCount || 0,
            completionTokens: chunk.usageMetadata.candidatesTokenCount || 0,
            totalTokens: chunk.usageMetadata.totalTokenCount || 0,
          };
        }

        if (chunk.candidates?.[0]?.finishReason) {
          finishReason = chunk.candidates[0].finishReason;
        }
      }

      await callback({
        content: '',
        isComplete: true,
        usage,
      });

      return {
        content: fullContent,
        model,
        usage,
        finishReason,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get generative model with options
   */
  private getGenerativeModel(model: string, options?: LLMCompletionOptions): GenerativeModel {
    return this.client.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: options?.maxTokens,
        temperature: options?.temperature,
        topP: options?.topP,
        stopSequences: options?.stopSequences,
      },
    });
  }

  /**
   * Format messages for Gemini API
   * Gemini uses 'model' instead of 'assistant' and requires the last message to be from user
   */
  private formatMessages(messages: LLMMessage[]): {
    systemInstruction?: string;
    history: Array<{ role: string; content: string }>;
    currentMessage: string;
  } {
    const systemMessages = messages.filter((msg) => msg.role === 'system');
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

    const systemInstruction =
      systemMessages.length > 0
        ? systemMessages.map((msg) => msg.content).join('\n\n')
        : undefined;

    // Gemini requires alternating user/model messages, and the last message must be from user
    const history: Array<{ role: string; content: string }> = [];
    let currentMessage = '';

    for (let i = 0; i < conversationMessages.length; i++) {
      const msg = conversationMessages[i];
      const role = msg.role === 'assistant' ? 'model' : 'user';

      if (i === conversationMessages.length - 1) {
        // Last message should be the current message (must be user)
        if (role === 'user') {
          currentMessage = msg.content;
        } else {
          // If last message is not user, add it to history and create empty user message
          history.push({ role, content: msg.content });
          currentMessage = 'Please continue.';
        }
      } else {
        history.push({ role, content: msg.content });
      }
    }

    // If no user message was found, create one
    if (!currentMessage) {
      currentMessage = conversationMessages[conversationMessages.length - 1]?.content || 'Hello';
    }

    return { systemInstruction, history, currentMessage };
  }

  /**
   * Handle Gemini API errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      const message = error.message;

      // Rate limit error
      if (message.includes('429') || message.includes('quota') || message.includes('rate limit')) {
        return new LLMRateLimitError(`Gemini API rate limit exceeded: ${message}`, undefined, {
          originalError: message,
        });
      }

      // Timeout error
      if (message.includes('timeout') || message.includes('408')) {
        return new LLMTimeoutError(`Gemini API timeout: ${message}`, 30000, {
          originalError: message,
        });
      }

      // Server error (retryable)
      if (message.includes('500') || message.includes('503') || message.includes('server error')) {
        return new LLMError(`Gemini API server error: ${message}`, undefined, true, {
          originalError: message,
        });
      }

      // General API error
      return new LLMError(`Gemini API error: ${message}`, undefined, false, {
        originalError: message,
      });
    }

    // Unknown error
    return new LLMError(`Unexpected error: ${String(error)}`, undefined, false);
  }
}
