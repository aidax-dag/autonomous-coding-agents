/**
 * Shared Module - Public API
 * @module shared
 *
 * Note: The './llm' submodule is excluded from this barrel because it
 * re-exports 'isCLIProvider' which conflicts with './config'.
 * Import LLM utilities directly from '@/shared/llm'.
 */

export * from './ci';
export * from './config';
export * from './github';
export * from './telemetry';
