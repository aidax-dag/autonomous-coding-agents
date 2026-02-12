# F016 -- DocsGenerator

> Generates HLD/MLD/LLD architecture documents from codebase analysis using pluggable content analyzers.

## 1. Purpose

DocsGenerator provides a structured pipeline for producing three tiers of architecture documentation -- High-Level Design (HLD), Mid-Level Design (MLD), and Low-Level Design (LLD) -- from codebase analysis. It accepts a pluggable `ContentAnalyzer` function so that the actual analysis logic (e.g., LLM-backed or static-analysis-backed) can be swapped without changing the formatting and orchestration layer. When no analyzer is provided, stub documents are generated with placeholder content derived from the file path.

## 2. Interface

```typescript
type DocLevel = 'HLD' | 'MLD' | 'LLD';

interface ModuleDescriptor {
  name: string;
  path: string;
  description: string;
  exports: string[];
  dependencies: string[];
  loc: number;
}

interface ModuleRelation {
  source: string;
  target: string;
  type: 'imports' | 'extends' | 'implements' | 'uses';
}

interface HLDContent {
  systemName: string;
  overview: string;
  components: ModuleDescriptor[];
  relationships: ModuleRelation[];
  decisions: string[];
  techStack: string[];
}

interface MLDContent {
  moduleName: string;
  overview: string;
  subComponents: ModuleDescriptor[];
  interfaces: string[];
  dataFlow: string[];
  errorHandling: string[];
}

interface LLDContent {
  componentName: string;
  description: string;
  signatures: string[];
  ioTypes: string[];
  algorithms: string[];
  edgeCases: string[];
}

interface GeneratedDoc {
  level: DocLevel;
  title: string;
  content: string;       // Markdown output
  generatedAt: string;   // ISO timestamp
  sourceFiles: string[];
}

interface DocGeneratorOptions {
  levels?: DocLevel[];
  modules?: string[];
  includeExamples?: boolean;
  maxDepth?: number;
}

interface IDocsGenerator {
  generateHLD(rootPath: string, options?: DocGeneratorOptions): Promise<GeneratedDoc>;
  generateMLD(modulePath: string, options?: DocGeneratorOptions): Promise<GeneratedDoc>;
  generateLLD(componentPath: string, options?: DocGeneratorOptions): Promise<GeneratedDoc>;
  generateAll(rootPath: string, options?: DocGeneratorOptions): Promise<GeneratedDoc[]>;
}
```

## 3. Implementation

- **Class**: `DocsGenerator` implements `IDocsGenerator`
- **Factory**: `createDocsGenerator(config?: DocsGeneratorConfig): DocsGenerator`
- **Pluggable analyzer**: `ContentAnalyzer` -- async function `(path, level, options?) => { hld?, mld?, lld? }`
- **Configuration** (`DocsGeneratorConfig`):
  - `analyzer?` -- custom content analyzer function
  - `defaults?` -- default `DocGeneratorOptions` (fallback: `{ levels: ['HLD', 'MLD', 'LLD'] }`)

**Key behaviors:**

- Each `generate*` method merges caller options with constructor defaults.
- If a custom analyzer is provided and returns content for the requested level, that content is formatted into Markdown. Otherwise a stub is produced.
- `generateAll` iterates over the requested levels and delegates to the individual `generate*` methods.
- Formatting methods (`formatHLD`, `formatMLD`, `formatLLD`) produce structured Markdown with headings for components, tech stack, decisions, interfaces, data flow, signatures, and edge cases.
- The system name / module name is extracted from the last path segment when using stubs.

## 4. Dependencies

**Depends on:**

- No external modules. Self-contained with only its own interface types.

**Depended on by:**

- Orchestrator or CLI tooling that needs automated documentation generation.
- Potentially consumed by HUD Dashboard for documentation freshness metrics.

## 5. Testing

- **Test file**: `tests/unit/core/docs-generator/docs-generator.test.ts`
- **Test count**: 19 tests
- **Key test scenarios**:
  - Constructor with default and custom config
  - Stub HLD/MLD/LLD generation when no analyzer is provided
  - Custom analyzer integration for all three levels
  - Fallback to stub when analyzer returns no content for the requested level
  - Markdown formatting of components, tech stack, interfaces, signatures, edge cases
  - `generateAll` respects `levels` option and constructor defaults
  - Factory function `createDocsGenerator` passes config correctly
