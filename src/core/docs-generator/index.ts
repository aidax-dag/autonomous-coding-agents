/**
 * Documentation Generator Module
 *
 * @module core/docs-generator
 */

export type {
  IDocsGenerator,
  DocLevel,
  DocGeneratorOptions,
  GeneratedDoc,
  ModuleDescriptor,
  ModuleRelation,
  HLDContent,
  MLDContent,
  LLDContent,
} from './interfaces/docs-generator.interface';

export {
  DocsGenerator,
  createDocsGenerator,
  type DocsGeneratorConfig,
  type ContentAnalyzer,
} from './docs-generator';

export { createDefaultAnalyzer } from './code-analyzer';
