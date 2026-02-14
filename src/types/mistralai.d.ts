/**
 * Type declarations for @mistralai/mistralai
 *
 * Provides minimal type definitions for the Mistral AI SDK.
 * Install the package with: npm install @mistralai/mistralai
 */

declare module '@mistralai/mistralai' {
  interface MistralMessage {
    role: string;
    content: string;
  }

  interface MistralChatCompletionChoice {
    message: {
      content: string | null;
    };
    finishReason: string | null;
  }

  interface MistralUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }

  interface MistralChatCompletionResponse {
    id?: string;
    model?: string;
    created?: number;
    choices?: MistralChatCompletionChoice[];
    usage?: MistralUsage;
  }

  interface MistralChatStreamChunk {
    data: {
      id?: string;
      model?: string;
      choices?: Array<{
        delta?: {
          content?: string | null;
        };
        finishReason?: string | null;
      }>;
      usage?: MistralUsage;
    };
  }

  interface MistralChatCompleteParams {
    model: string;
    messages: MistralMessage[];
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stop?: string[];
  }

  interface MistralChatStreamResult {
    [Symbol.asyncIterator](): AsyncIterator<MistralChatStreamChunk>;
  }

  interface MistralChat {
    complete(params: MistralChatCompleteParams): Promise<MistralChatCompletionResponse>;
    stream(params: MistralChatCompleteParams): Promise<MistralChatStreamResult>;
  }

  interface MistralConfig {
    apiKey: string;
  }

  export class Mistral {
    chat: MistralChat;
    constructor(config: MistralConfig);
  }
}
