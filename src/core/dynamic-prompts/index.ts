/**
 * Dynamic Prompts Module
 *
 * @module core/dynamic-prompts
 */

export type {
  IPromptRegistry,
  IPromptRenderer,
  PromptTemplate,
  PromptContext,
  RenderedPrompt,
} from './interfaces/dynamic-prompts.interface';

export {
  PromptRegistry,
  createPromptRegistry,
} from './prompt-registry';

export {
  PromptRenderer,
  createPromptRenderer,
  type PromptRendererConfig,
} from './prompt-renderer';
