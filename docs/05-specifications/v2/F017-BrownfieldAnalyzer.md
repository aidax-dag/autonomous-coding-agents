# F017 -- BrownfieldAnalyzer

> Analyzes existing codebases to assess structure, patterns, technical debt, and overall project health.

## 1. Purpose

BrownfieldAnalyzer provides a systematic framework for evaluating legacy and existing codebases before an autonomous agent begins work on them. It produces a comprehensive analysis covering codebase metrics (LOC, file counts, language distribution), identified code patterns, technical debt items with severity ratings, dependency health, and an overall health score. Like DocsGenerator, it uses a pluggable executor so that the actual analysis can be backed by an LLM, static analysis tool, or any other provider.

## 2. Interface

```typescript
interface CodePattern {
  name: string;
  category: 'architectural' | 'design' | 'implementation' | 'testing';
  occurrences: number;
  locations: string[];
  confidence: number;  // 0-1
}

interface TechDebtItem {
  type: 'code-smell' | 'outdated-dep' | 'missing-tests' | 'poor-naming' | 'dead-code' | 'complexity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  files: string[];
  effort: 'trivial' | 'small' | 'medium' | 'large';
}

interface DependencyAnalysis {
  directDeps: number;
  devDeps: number;
  outdated: string[];
  unused: string[];
  duplicates: string[];
}

interface CodebaseMetrics {
  totalLoc: number;
  totalFiles: number;
  languages: Record<string, number>;
  avgFileSize: number;
  largestFiles: Array<{ path: string; loc: number }>;
  testCoverageEstimate: number;  // 0-100
}

interface BrownfieldAnalysis {
  projectName: string;
  analyzedAt: string;
  metrics: CodebaseMetrics;
  patterns: CodePattern[];
  techDebt: TechDebtItem[];
  dependencies: DependencyAnalysis;
  recommendations: string[];
  healthScore: number;  // 0-100
}

interface BrownfieldOptions {
  analyzeDeps?: boolean;
  detectPatterns?: boolean;
  scanTechDebt?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
}

interface IBrownfieldAnalyzer {
  analyze(rootPath: string, options?: BrownfieldOptions): Promise<BrownfieldAnalysis>;
  getMetrics(rootPath: string): Promise<CodebaseMetrics>;
  scanTechDebt(rootPath: string): Promise<TechDebtItem[]>;
  detectPatterns(rootPath: string): Promise<CodePattern[]>;
}
```

## 3. Implementation

- **Class**: `BrownfieldAnalyzer` implements `IBrownfieldAnalyzer`
- **Factory**: `createBrownfieldAnalyzer(config?: BrownfieldAnalyzerConfig): BrownfieldAnalyzer`
- **Pluggable executor**: `AnalysisExecutor` -- async function `(rootPath, options?) => BrownfieldAnalysis`
- **Configuration** (`BrownfieldAnalyzerConfig`):
  - `executor?` -- custom analysis executor for LLM-backed or tool-backed analysis
  - `defaults?` -- default `BrownfieldOptions` (fallback: `{ analyzeDeps: true, detectPatterns: true, scanTechDebt: true, maxFiles: 1000 }`)

**Key behaviors:**

- `analyze()` merges caller options with constructor defaults. If an executor is provided, it delegates entirely to it. Otherwise, it composes results from the stub `getMetrics`, `scanTechDebt`, and `detectPatterns` methods based on option flags.
- **Health score calculation** (`calculateHealthScore`): Starts at 100, deducts 15 per critical debt item, 8 per high, 3 per medium, and 10 if test coverage estimate is below 50%. Score is clamped to 0-100.
- Project name is extracted from the last segment of the root path.
- Stub methods return zero/empty defaults, making the module safe to use without a real analyzer for testing and scaffolding.

## 4. Dependencies

**Depends on:**

- No external modules. Self-contained with only its own interface types.

**Depended on by:**

- Orchestrator's pre-exploration phase, which uses brownfield analysis to understand a codebase before planning.
- DeepWorker's `PreExploration` component may consume this for initial codebase assessment.

## 5. Testing

- **Test file**: `tests/unit/core/brownfield/brownfield-analyzer.test.ts`
- **Test count**: 17 tests
- **Key test scenarios**:
  - Constructor with default and custom config
  - Stub analysis returning project name from path and health score of 90 (0% coverage deduction)
  - Custom executor integration with full analysis data
  - Options merging (defaults + caller overrides)
  - Conditional tech debt scan and pattern detection based on flags
  - Stub `getMetrics`, `scanTechDebt`, `detectPatterns` returning empty defaults
  - Health score deductions for tech debt severity and low test coverage
  - Score clamping between 0-100
  - Factory function `createBrownfieldAnalyzer` passes config correctly
