/**
 * Documentation Generator Interfaces
 *
 * Defines abstractions for generating HLD (High-Level Design),
 * MLD (Mid-Level Design), and LLD (Low-Level Design) documents
 * from codebase analysis.
 *
 * @module core/docs-generator/interfaces
 */

/**
 * Documentation detail levels
 */
export type DocLevel = 'HLD' | 'MLD' | 'LLD';

/**
 * Module/component descriptor for docs
 */
export interface ModuleDescriptor {
  /** Module name */
  name: string;
  /** Module path */
  path: string;
  /** Module description */
  description: string;
  /** Public API surface */
  exports: string[];
  /** Dependencies */
  dependencies: string[];
  /** LOC count */
  loc: number;
}

/**
 * Relationship between modules
 */
export interface ModuleRelation {
  /** Source module */
  source: string;
  /** Target module */
  target: string;
  /** Relationship type */
  type: 'imports' | 'extends' | 'implements' | 'uses';
}

/**
 * HLD content — system-level architecture
 */
export interface HLDContent {
  /** System name */
  systemName: string;
  /** System overview */
  overview: string;
  /** Major components */
  components: ModuleDescriptor[];
  /** Component relationships */
  relationships: ModuleRelation[];
  /** Architecture decisions */
  decisions: string[];
  /** Technology stack */
  techStack: string[];
}

/**
 * MLD content — module-level design
 */
export interface MLDContent {
  /** Module name */
  moduleName: string;
  /** Module overview */
  overview: string;
  /** Sub-components */
  subComponents: ModuleDescriptor[];
  /** Interfaces defined */
  interfaces: string[];
  /** Data flow description */
  dataFlow: string[];
  /** Error handling strategy */
  errorHandling: string[];
}

/**
 * LLD content — implementation-level detail
 */
export interface LLDContent {
  /** Component name */
  componentName: string;
  /** Detailed description */
  description: string;
  /** Class/function signatures */
  signatures: string[];
  /** Input/output types */
  ioTypes: string[];
  /** Algorithm descriptions */
  algorithms: string[];
  /** Edge cases */
  edgeCases: string[];
}

/**
 * Generated document
 */
export interface GeneratedDoc {
  /** Document level */
  level: DocLevel;
  /** Document title */
  title: string;
  /** Markdown content */
  content: string;
  /** Generation timestamp */
  generatedAt: string;
  /** Source files analyzed */
  sourceFiles: string[];
}

/**
 * Generation options
 */
export interface DocGeneratorOptions {
  /** Levels to generate */
  levels?: DocLevel[];
  /** Focus on specific modules */
  modules?: string[];
  /** Include code examples */
  includeExamples?: boolean;
  /** Max depth for analysis */
  maxDepth?: number;
}

/**
 * Documentation generator interface
 */
export interface IDocsGenerator {
  /** Generate HLD from codebase analysis */
  generateHLD(rootPath: string, options?: DocGeneratorOptions): Promise<GeneratedDoc>;

  /** Generate MLD for a specific module */
  generateMLD(modulePath: string, options?: DocGeneratorOptions): Promise<GeneratedDoc>;

  /** Generate LLD for a specific component */
  generateLLD(componentPath: string, options?: DocGeneratorOptions): Promise<GeneratedDoc>;

  /** Generate all levels */
  generateAll(rootPath: string, options?: DocGeneratorOptions): Promise<GeneratedDoc[]>;
}
