/**
 * Eval Runner
 *
 * Loads eval definitions from YAML files and executes them against
 * registered evaluators. Supports filtering by category, severity, and tags.
 *
 * @module core/evals
 */

import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import type {
  IEvalRunner,
  IEvaluator,
  EvalDefinition,
  EvalResult,
  EvalSuiteResult,
  EvalContext,
  EvalRunnerConfig,
  EvalCategory,
  EvalSeverity,
  ToolCallRecord,
} from './interfaces/eval.interface.js';
import { DEFAULT_EVAL_CONFIG } from './interfaces/eval.interface.js';
import { createCodeQualityEvaluator } from './evaluators/code-quality.evaluator.js';
import { createTaskCompletionEvaluator } from './evaluators/task-completion.evaluator.js';
import { createToolUsageEvaluator } from './evaluators/tool-usage.evaluator.js';

/**
 * Callback invoked to execute an eval case and return agent output
 */
export type EvalExecutor = (definition: EvalDefinition) => Promise<{
  output: string;
  toolCalls: ToolCallRecord[];
  filesModified: string[];
  duration: number;
}>;

/**
 * Behavioral Eval Runner
 *
 * Orchestrates eval lifecycle: load → filter → execute → evaluate → report
 */
export class EvalRunner implements IEvalRunner {
  private readonly config: Required<
    Omit<EvalRunnerConfig, 'categories' | 'severities' | 'tags'>
  > & {
    categories?: EvalCategory[];
    severities?: EvalSeverity[];
    tags?: string[];
  };

  private readonly evaluators: Map<string, IEvaluator> = new Map();
  private definitions: EvalDefinition[] = [];
  private executor?: EvalExecutor;

  constructor(config: EvalRunnerConfig) {
    this.config = {
      ...DEFAULT_EVAL_CONFIG,
      ...config,
    };

    // Register built-in evaluators
    this.registerEvaluator(createCodeQualityEvaluator());
    this.registerEvaluator(createTaskCompletionEvaluator());
    this.registerEvaluator(createToolUsageEvaluator());
  }

  /**
   * Set the executor callback for running eval cases
   */
  setExecutor(executor: EvalExecutor): void {
    this.executor = executor;
  }

  /**
   * Register a custom evaluator
   */
  registerEvaluator(evaluator: IEvaluator): void {
    this.evaluators.set(evaluator.name, evaluator);
  }

  /**
   * Load eval definitions from a directory or file
   */
  async loadDefinitions(path: string): Promise<EvalDefinition[]> {
    const definitions: EvalDefinition[] = [];

    if (path.endsWith('.yaml') || path.endsWith('.yml')) {
      const defs = await this.loadYamlFile(path);
      definitions.push(...defs);
    } else {
      // Load all YAML files from directory
      const files = await readdir(path).catch(() => [] as string[]);
      const yamlFiles = files.filter(
        (f) => extname(f) === '.yaml' || extname(f) === '.yml',
      );

      for (const file of yamlFiles) {
        const defs = await this.loadYamlFile(join(path, file));
        definitions.push(...defs);
      }
    }

    // Apply filters
    const filtered = this.filterDefinitions(definitions);
    this.definitions = filtered;

    if (this.config.verbose) {
      console.log(`Loaded ${filtered.length} eval definitions (${definitions.length} total)`);
    }

    return filtered;
  }

  /**
   * Run a single eval definition
   */
  async runEval(definition: EvalDefinition): Promise<EvalResult> {
    const evaluator = this.findEvaluator(definition.category);
    if (!evaluator) {
      return {
        evalId: definition.id,
        passed: false,
        severity: definition.severity,
        score: 0,
        details: `No evaluator registered for category: ${definition.category}`,
        duration: 0,
        assertions: [],
        error: `No evaluator for category: ${definition.category}`,
      };
    }

    try {
      const context = await this.createEvalContext(definition);
      return await evaluator.evaluate(context);
    } catch (error) {
      return {
        evalId: definition.id,
        passed: false,
        severity: definition.severity,
        score: 0,
        details: `Eval execution error: ${error instanceof Error ? error.message : String(error)}`,
        duration: 0,
        assertions: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run all evals in a named suite (category)
   */
  async runSuite(suiteName: string): Promise<EvalSuiteResult> {
    const suiteDefinitions = this.definitions.filter(
      (d) => d.category === suiteName || d.tags?.includes(suiteName),
    );
    return this.executeDefinitions(suiteName, suiteDefinitions);
  }

  /**
   * Run all loaded eval definitions
   */
  async runAll(): Promise<EvalSuiteResult> {
    return this.executeDefinitions('all', this.definitions);
  }

  /**
   * Get loaded definitions
   */
  getDefinitions(): EvalDefinition[] {
    return [...this.definitions];
  }

  // =========================================================================
  // Private
  // =========================================================================

  private async executeDefinitions(
    suiteName: string,
    definitions: EvalDefinition[],
  ): Promise<EvalSuiteResult> {
    const startTime = Date.now();
    const results: EvalResult[] = [];

    for (const definition of definitions) {
      if (this.config.verbose) {
        console.log(`Running eval: ${definition.id} (${definition.severity})`);
      }
      const result = await this.runEval(definition);
      results.push(result);
    }

    const alwaysResults = results.filter((r) => r.severity === 'ALWAYS_PASSES');
    const usuallyResults = results.filter((r) => r.severity === 'USUALLY_PASSES');

    const alwaysPassRate =
      alwaysResults.length > 0
        ? alwaysResults.filter((r) => r.passed).length / alwaysResults.length
        : 1;

    const usuallyPassRate =
      usuallyResults.length > 0
        ? usuallyResults.filter((r) => r.passed).length / usuallyResults.length
        : 1;

    const regressions = results.filter((r) => !r.passed && r.severity === 'ALWAYS_PASSES');

    return {
      suiteName,
      totalEvals: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      alwaysPassRate,
      usuallyPassRate,
      regressions,
      results,
      duration: Date.now() - startTime,
    };
  }

  private async loadYamlFile(filePath: string): Promise<EvalDefinition[]> {
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseYaml(content) as unknown;

    if (!parsed || typeof parsed !== 'object') return [];

    // Support single definition or array
    const raw = Array.isArray(parsed)
      ? (parsed as Record<string, unknown>[])
      : 'evals' in (parsed as Record<string, unknown>)
        ? ((parsed as Record<string, unknown>).evals as Record<string, unknown>[])
        : [parsed as Record<string, unknown>];

    return raw.map((item) => this.normalizeDefinition(item));
  }

  private normalizeDefinition(raw: Record<string, unknown>): EvalDefinition {
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? raw.id ?? ''),
      category: (raw.category as EvalCategory) ?? 'task_completion',
      severity: (raw.severity as 'ALWAYS_PASSES' | 'USUALLY_PASSES') ?? 'USUALLY_PASSES',
      input: (raw.input as EvalDefinition['input']) ?? { prompt: '' },
      expectedBehavior: (raw.expectedBehavior as EvalDefinition['expectedBehavior']) ??
        (raw.expected_behavior as EvalDefinition['expectedBehavior']) ?? {},
      timeout: Number(raw.timeout ?? this.config.defaultTimeout),
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    };
  }

  private filterDefinitions(definitions: EvalDefinition[]): EvalDefinition[] {
    return definitions.filter((d) => {
      if (this.config.categories && !this.config.categories.includes(d.category)) return false;
      if (this.config.severities && !this.config.severities.includes(d.severity)) return false;
      if (this.config.tags) {
        const hasTags = d.tags && d.tags.some((t) => this.config.tags!.includes(t));
        if (!hasTags) return false;
      }
      return true;
    });
  }

  private findEvaluator(category: EvalCategory): IEvaluator | undefined {
    for (const evaluator of this.evaluators.values()) {
      if (evaluator.categories.includes(category)) return evaluator;
    }
    return undefined;
  }

  private async createEvalContext(definition: EvalDefinition): Promise<EvalContext> {
    if (this.executor) {
      const { output, toolCalls, filesModified, duration } =
        await this.executor(definition);
      return {
        definition,
        output,
        toolCalls,
        filesModified,
        duration,
        workspaceDir: this.config.workspaceDir,
      };
    }

    // No executor set — return empty context for offline evaluation
    return {
      definition,
      output: '',
      toolCalls: [],
      filesModified: [],
      duration: 0,
      workspaceDir: this.config.workspaceDir,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface EvalRunnerOptions {
  /** Directory containing eval definitions */
  definitionsDir: string;
  /** Workspace directory for running evals */
  workspaceDir: string;
  /** Default timeout in ms */
  defaultTimeout?: number;
  /** Only run evals matching these categories */
  categories?: EvalCategory[];
  /** Only run evals matching these severities */
  severities?: EvalSeverity[];
  /** Only run evals matching these tags */
  tags?: string[];
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Create an EvalRunner with default evaluators
 */
export function createEvalRunner(options: EvalRunnerOptions): EvalRunner {
  return new EvalRunner(options);
}
