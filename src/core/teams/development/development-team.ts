/**
 * Development Team
 *
 * Base class for development teams (Frontend, Backend, Fullstack).
 * Handles code generation, implementation, and debugging tasks.
 *
 * Feature: Team System
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TeamType,
  TeamCapability,
  TeamConfig,
  TaskDocument,
  TaskResult,
  TaskArtifact,
  AgentRole,
  TEAM_CAPABILITIES,
} from '../team-types';
import { BaseTeam, createRole } from '../base-team';

// ============================================================================
// Types
// ============================================================================

/**
 * Development team configuration
 */
export interface DevelopmentTeamConfig extends Partial<TeamConfig> {
  /** Programming languages supported */
  languages: string[];
  /** Frameworks supported */
  frameworks: string[];
  /** Enable test generation */
  generateTests: boolean;
  /** Test coverage target (0-100) */
  coverageTarget: number;
  /** Enable code documentation */
  generateDocs: boolean;
  /** Code style guide */
  styleGuide?: string;
  /** Enable linting */
  enableLinting: boolean;
}

/**
 * Code generation result
 */
export interface CodeGenerationResult {
  /** Generated files */
  files: GeneratedFile[];
  /** Test files */
  testFiles: GeneratedFile[];
  /** Documentation */
  documentation?: string;
  /** Dependencies to install */
  dependencies: DependencySpec[];
  /** Implementation notes */
  notes: string[];
}

/**
 * Generated file
 */
export interface GeneratedFile {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** File language */
  language: string;
  /** Lines of code */
  linesOfCode: number;
  /** Is test file */
  isTest: boolean;
}

/**
 * Dependency specification
 */
export interface DependencySpec {
  /** Package name */
  name: string;
  /** Version (semver) */
  version: string;
  /** Is dev dependency */
  isDev: boolean;
}

/**
 * Code analysis result
 */
export interface CodeAnalysisResult {
  /** Complexity score (1-10) */
  complexity: number;
  /** Estimated lines of code */
  estimatedLOC: number;
  /** Required skills */
  requiredSkills: string[];
  /** Suggested approach */
  approach: string;
  /** Potential challenges */
  challenges: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_DEVELOPMENT_CONFIG: DevelopmentTeamConfig = {
  languages: ['typescript', 'javascript'],
  frameworks: ['react', 'node', 'express'],
  generateTests: true,
  coverageTarget: 80,
  generateDocs: true,
  enableLinting: true,
};

// ============================================================================
// Agent Roles
// ============================================================================

const DEVELOPER_ROLE: AgentRole = createRole(
  'Software Developer',
  'Writes clean, maintainable code following best practices',
  `You are a Software Developer agent. Your role is to:
1. Analyze requirements and design solutions
2. Write clean, efficient, and maintainable code
3. Follow established coding standards and patterns
4. Implement error handling and edge cases
5. Write inline documentation and comments

When writing code:
- Follow SOLID principles
- Use meaningful variable and function names
- Keep functions small and focused
- Handle errors gracefully
- Consider performance implications`,
  {
    capabilities: [TeamCapability.CODE_GENERATION, TeamCapability.DEBUGGING],
    tools: ['read', 'write', 'edit', 'bash'],
  }
);

const TESTER_ROLE: AgentRole = createRole(
  'Test Engineer',
  'Creates comprehensive tests for code quality',
  `You are a Test Engineer agent. Your role is to:
1. Design test strategies and test cases
2. Write unit tests with good coverage
3. Create integration tests for components
4. Identify edge cases and error scenarios
5. Ensure tests are maintainable and clear

Testing principles:
- Test behavior, not implementation
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Aim for high coverage on critical paths`,
  {
    capabilities: [TeamCapability.TEST_GENERATION, TeamCapability.DEBUGGING],
    tools: ['read', 'write', 'bash'],
  }
);

const REVIEWER_ROLE: AgentRole = createRole(
  'Code Reviewer',
  'Reviews code for quality, security, and best practices',
  `You are a Code Reviewer agent. Your role is to:
1. Review code for correctness and logic errors
2. Check adherence to coding standards
3. Identify security vulnerabilities
4. Suggest improvements and optimizations
5. Ensure code is maintainable

Review focus areas:
- Logic correctness
- Error handling
- Security implications
- Performance considerations
- Code readability`,
  {
    capabilities: [TeamCapability.CODE_REVIEW, TeamCapability.REFACTORING],
    tools: ['read', 'analyze'],
  }
);

// ============================================================================
// Development Team Base Class
// ============================================================================

/**
 * Base class for development teams
 *
 * @example
 * ```typescript
 * class FrontendTeam extends DevelopmentTeam {
 *   constructor(config: DevelopmentTeamConfig) {
 *     super({
 *       ...config,
 *       type: TeamType.FRONTEND,
 *       languages: ['typescript', 'javascript', 'css'],
 *       frameworks: ['react', 'vue', 'angular'],
 *     });
 *   }
 * }
 * ```
 */
export abstract class DevelopmentTeam extends BaseTeam {
  /** Development-specific configuration */
  protected readonly devConfig: DevelopmentTeamConfig;

  /** Generated code statistics */
  protected codeStats = {
    totalFiles: 0,
    totalLinesOfCode: 0,
    totalTestFiles: 0,
    totalTestLines: 0,
  };

  constructor(config: DevelopmentTeamConfig & { type: TeamType }) {
    const fullConfig: TeamConfig = {
      id: config.id || `dev-${uuidv4().slice(0, 8)}`,
      name: config.name || 'Development Team',
      type: config.type,
      capabilities: TEAM_CAPABILITIES[config.type] || [
        TeamCapability.CODE_GENERATION,
        TeamCapability.TEST_GENERATION,
        TeamCapability.DEBUGGING,
        TeamCapability.REFACTORING,
      ],
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      taskTimeoutMs: config.taskTimeoutMs || 600000, // 10 minutes for dev tasks
      autoRetry: config.autoRetry ?? true,
      maxRetries: config.maxRetries ?? 2,
      metadata: config.metadata || {},
    };

    super(fullConfig);
    this.devConfig = { ...DEFAULT_DEVELOPMENT_CONFIG, ...config };
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  protected override async initializeMembers(): Promise<void> {
    this.addMember(DEVELOPER_ROLE);

    if (this.devConfig.generateTests) {
      this.addMember(TESTER_ROLE);
    }

    this.addMember(REVIEWER_ROLE);
  }

  // ============================================================================
  // Task Processing
  // ============================================================================

  protected override async processTask(task: TaskDocument): Promise<TaskResult> {
    const startTime = Date.now();
    this.tokenCounter = 0;

    try {
      let result: CodeGenerationResult;

      switch (task.type) {
        case 'implementation':
        case 'development':
        case 'code':
          result = await this.processImplementation(task);
          break;
        case 'bug_fix':
        case 'fix':
          result = await this.processBugFix(task);
          break;
        case 'refactor':
          result = await this.processRefactor(task);
          break;
        case 'feature':
          result = await this.processFeature(task);
          break;
        default:
          result = await this.processGenericDev(task);
      }

      // Update statistics
      this.updateCodeStats(result);

      // Create artifacts
      const artifacts = this.createArtifacts(task, result);

      return {
        taskId: task.id,
        success: true,
        outputs: {
          codeGeneration: result,
          filesGenerated: result.files.length,
          testsGenerated: result.testFiles.length,
          dependencies: result.dependencies,
        },
        subtasks: [],
        artifacts,
        duration: Date.now() - startTime,
        tokensUsed: this.tokenCounter,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        outputs: {},
        subtasks: [],
        artifacts: [],
        duration: Date.now() - startTime,
        tokensUsed: this.tokenCounter,
        error: error as Error,
      };
    }
  }

  // ============================================================================
  // Processing Methods
  // ============================================================================

  /**
   * Process implementation task
   */
  protected async processImplementation(task: TaskDocument): Promise<CodeGenerationResult> {
    const analysis = this.analyzeTask(task);
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];
    const dependencies: DependencySpec[] = [];
    const notes: string[] = [];

    // Generate main implementation file
    const mainFile = this.generateImplementationFile(task, analysis);
    files.push(mainFile);

    // Generate tests if enabled
    if (this.devConfig.generateTests) {
      const tests = this.generateTestFile(task, mainFile);
      testFiles.push(tests);
    }

    // Detect dependencies
    dependencies.push(...this.detectDependencies(task, analysis));

    // Add implementation notes
    notes.push(`Implementation for: ${task.title}`);
    notes.push(`Complexity: ${analysis.complexity}/10`);
    notes.push(`Estimated LOC: ${analysis.estimatedLOC}`);

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? this.generateDocumentation(task, files)
        : undefined,
      dependencies,
      notes,
    };
  }

  /**
   * Process bug fix task
   */
  protected async processBugFix(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];
    const notes: string[] = [];

    // Analyze the bug
    const bugAnalysis = this.analyzeBug(task);

    // Generate fix
    const fixFile = this.generateBugFix(task, bugAnalysis);
    files.push(fixFile);

    // Generate regression test
    if (this.devConfig.generateTests) {
      const regressionTest = this.generateRegressionTest(task, bugAnalysis);
      testFiles.push(regressionTest);
    }

    notes.push(`Bug fix for: ${task.title}`);
    notes.push(`Root cause: ${bugAnalysis.rootCause}`);
    notes.push(`Fix approach: ${bugAnalysis.fixApproach}`);

    return {
      files,
      testFiles,
      dependencies: [],
      notes,
    };
  }

  /**
   * Process refactoring task
   */
  protected async processRefactor(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];
    const notes: string[] = [];

    // Analyze refactoring scope
    const refactorAnalysis = this.analyzeRefactoring(task);

    // Generate refactored code
    const refactoredFile = this.generateRefactoredCode(task, refactorAnalysis);
    files.push(refactoredFile);

    notes.push(`Refactoring: ${task.title}`);
    notes.push(`Pattern applied: ${refactorAnalysis.pattern}`);
    notes.push(`Improvement: ${refactorAnalysis.improvement}`);

    return {
      files,
      testFiles: [],
      dependencies: [],
      notes,
    };
  }

  /**
   * Process feature task
   */
  protected async processFeature(task: TaskDocument): Promise<CodeGenerationResult> {
    const analysis = this.analyzeTask(task);
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];
    const dependencies: DependencySpec[] = [];

    // Generate feature implementation (may include multiple files)
    const featureFiles = this.generateFeatureFiles(task, analysis);
    files.push(...featureFiles);

    // Generate comprehensive tests
    if (this.devConfig.generateTests) {
      for (const file of featureFiles) {
        const tests = this.generateTestFile(task, file);
        testFiles.push(tests);
      }
    }

    // Detect new dependencies
    dependencies.push(...this.detectDependencies(task, analysis));

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? this.generateDocumentation(task, files)
        : undefined,
      dependencies,
      notes: [`Feature: ${task.title}`, `Files generated: ${files.length}`],
    };
  }

  /**
   * Process generic development task
   */
  protected async processGenericDev(task: TaskDocument): Promise<CodeGenerationResult> {
    return this.processImplementation(task);
  }

  // ============================================================================
  // Code Generation Helpers
  // ============================================================================

  /**
   * Analyze task for implementation
   */
  protected analyzeTask(task: TaskDocument): CodeAnalysisResult {
    const description = `${task.title} ${task.description}`.toLowerCase();

    // Estimate complexity
    let complexity = 3;
    const complexityIndicators = [
      'complex', 'multiple', 'integration', 'security',
      'authentication', 'authorization', 'database', 'api',
      'async', 'concurrent', 'distributed', 'cache',
    ];

    for (const indicator of complexityIndicators) {
      if (description.includes(indicator)) {
        complexity = Math.min(10, complexity + 1);
      }
    }

    // Estimate LOC
    const baseLOC = 50;
    const estimatedLOC = Math.round(baseLOC * (complexity / 3));

    // Determine required skills
    const requiredSkills = this.determineRequiredSkills(description);

    return {
      complexity,
      estimatedLOC,
      requiredSkills,
      approach: this.suggestApproach(task, complexity),
      challenges: this.identifyChallenges(description),
    };
  }

  /**
   * Determine required skills from description
   */
  protected determineRequiredSkills(description: string): string[] {
    const skills: string[] = [];

    const skillMap: Record<string, string> = {
      'react': 'React',
      'vue': 'Vue.js',
      'angular': 'Angular',
      'node': 'Node.js',
      'express': 'Express.js',
      'database': 'Database',
      'sql': 'SQL',
      'mongodb': 'MongoDB',
      'api': 'REST API',
      'graphql': 'GraphQL',
      'auth': 'Authentication',
      'test': 'Testing',
      'css': 'CSS/Styling',
      'typescript': 'TypeScript',
    };

    for (const [keyword, skill] of Object.entries(skillMap)) {
      if (description.includes(keyword)) {
        skills.push(skill);
      }
    }

    return skills.length > 0 ? skills : ['General Development'];
  }

  /**
   * Suggest implementation approach
   */
  protected suggestApproach(_task: TaskDocument, complexity: number): string {
    if (complexity <= 3) {
      return 'Straightforward implementation with standard patterns';
    } else if (complexity <= 6) {
      return 'Modular approach with clear separation of concerns';
    } else {
      return 'Iterative development with incremental testing';
    }
  }

  /**
   * Identify potential challenges
   */
  protected identifyChallenges(description: string): string[] {
    const challenges: string[] = [];

    if (description.includes('performance')) {
      challenges.push('Performance optimization required');
    }
    if (description.includes('security')) {
      challenges.push('Security considerations critical');
    }
    if (description.includes('integration')) {
      challenges.push('Third-party integration complexity');
    }
    if (description.includes('legacy')) {
      challenges.push('Legacy code compatibility');
    }
    if (description.includes('migration')) {
      challenges.push('Data migration handling');
    }

    return challenges;
  }

  /**
   * Generate implementation file
   */
  protected generateImplementationFile(
    task: TaskDocument,
    analysis: CodeAnalysisResult
  ): GeneratedFile {
    const fileName = this.generateFileName(task.title);
    const language = this.devConfig.languages[0] || 'typescript';
    const content = this.generateCodeContent(task, analysis, language);

    return {
      path: `src/${fileName}.${this.getFileExtension(language)}`,
      content,
      language,
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate test file
   */
  protected generateTestFile(task: TaskDocument, mainFile: GeneratedFile): GeneratedFile {
    const testFileName = mainFile.path.replace('src/', 'tests/').replace(/\.\w+$/, '.test$&');
    const content = this.generateTestContent(task, mainFile);

    return {
      path: testFileName,
      content,
      language: mainFile.language,
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  /**
   * Generate feature files (multiple files for a feature)
   */
  protected generateFeatureFiles(
    task: TaskDocument,
    analysis: CodeAnalysisResult
  ): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const baseName = this.generateFileName(task.title);
    const language = this.devConfig.languages[0] || 'typescript';

    // Main implementation
    files.push({
      path: `src/${baseName}.${this.getFileExtension(language)}`,
      content: this.generateCodeContent(task, analysis, language),
      language,
      linesOfCode: analysis.estimatedLOC,
      isTest: false,
    });

    // Types/Interfaces (for TypeScript)
    if (language === 'typescript') {
      files.push({
        path: `src/${baseName}.types.ts`,
        content: this.generateTypesContent(task),
        language,
        linesOfCode: Math.round(analysis.estimatedLOC * 0.3),
        isTest: false,
      });
    }

    return files;
  }

  /**
   * Analyze bug for fix
   */
  protected analyzeBug(task: TaskDocument): { rootCause: string; fixApproach: string } {
    const description = task.description.toLowerCase();

    let rootCause = 'Logic error in implementation';
    let fixApproach = 'Correct the logic and add validation';

    if (description.includes('null') || description.includes('undefined')) {
      rootCause = 'Null/undefined reference';
      fixApproach = 'Add null checks and proper initialization';
    } else if (description.includes('async') || description.includes('promise')) {
      rootCause = 'Async/promise handling issue';
      fixApproach = 'Fix async flow and error handling';
    } else if (description.includes('type') || description.includes('cast')) {
      rootCause = 'Type mismatch';
      fixApproach = 'Correct type definitions and conversions';
    }

    return { rootCause, fixApproach };
  }

  /**
   * Generate bug fix file
   */
  protected generateBugFix(
    task: TaskDocument,
    analysis: { rootCause: string; fixApproach: string }
  ): GeneratedFile {
    const fileName = this.generateFileName(`fix-${task.title}`);
    const language = this.devConfig.languages[0] || 'typescript';

    const content = `/**
 * Bug Fix: ${task.title}
 *
 * Root Cause: ${analysis.rootCause}
 * Fix Approach: ${analysis.fixApproach}
 */

// TODO: Implement bug fix
// Original issue: ${task.description}

export function fix() {
  // Fix implementation here
}
`;

    return {
      path: `src/fixes/${fileName}.${this.getFileExtension(language)}`,
      content,
      language,
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate regression test
   */
  protected generateRegressionTest(
    task: TaskDocument,
    _analysis: { rootCause: string; fixApproach: string }
  ): GeneratedFile {
    const fileName = this.generateFileName(`regression-${task.title}`);
    const language = this.devConfig.languages[0] || 'typescript';

    const content = `/**
 * Regression Test: ${task.title}
 *
 * Ensures the bug does not reoccur.
 */

describe('Regression: ${task.title}', () => {
  it('should not exhibit the original bug behavior', () => {
    // Test that verifies the fix
    expect(true).toBe(true);
  });

  it('should handle edge cases correctly', () => {
    // Edge case tests
    expect(true).toBe(true);
  });
});
`;

    return {
      path: `tests/regression/${fileName}.test.${this.getFileExtension(language)}`,
      content,
      language,
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  /**
   * Analyze refactoring task
   */
  protected analyzeRefactoring(task: TaskDocument): { pattern: string; improvement: string } {
    const description = task.description.toLowerCase();

    let pattern = 'General cleanup';
    let improvement = 'Improved code organization';

    if (description.includes('extract')) {
      pattern = 'Extract Method/Class';
      improvement = 'Better separation of concerns';
    } else if (description.includes('rename')) {
      pattern = 'Rename';
      improvement = 'Improved readability';
    } else if (description.includes('split')) {
      pattern = 'Split Component';
      improvement = 'Reduced complexity';
    } else if (description.includes('consolidate') || description.includes('merge')) {
      pattern = 'Consolidate';
      improvement = 'Reduced duplication';
    }

    return { pattern, improvement };
  }

  /**
   * Generate refactored code
   */
  protected generateRefactoredCode(
    task: TaskDocument,
    analysis: { pattern: string; improvement: string }
  ): GeneratedFile {
    const fileName = this.generateFileName(`refactored-${task.title}`);
    const language = this.devConfig.languages[0] || 'typescript';

    const content = `/**
 * Refactored: ${task.title}
 *
 * Pattern: ${analysis.pattern}
 * Improvement: ${analysis.improvement}
 */

// TODO: Implement refactored code

export {};
`;

    return {
      path: `src/${fileName}.${this.getFileExtension(language)}`,
      content,
      language,
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Detect dependencies from task
   */
  protected detectDependencies(
    task: TaskDocument,
    _analysis: CodeAnalysisResult
  ): DependencySpec[] {
    const deps: DependencySpec[] = [];
    const description = `${task.title} ${task.description}`.toLowerCase();

    const depMap: Record<string, { name: string; version: string; isDev: boolean }> = {
      'react': { name: 'react', version: '^18.2.0', isDev: false },
      'express': { name: 'express', version: '^4.18.0', isDev: false },
      'axios': { name: 'axios', version: '^1.6.0', isDev: false },
      'lodash': { name: 'lodash', version: '^4.17.0', isDev: false },
      'zod': { name: 'zod', version: '^3.22.0', isDev: false },
      'jest': { name: 'jest', version: '^29.7.0', isDev: true },
      'vitest': { name: 'vitest', version: '^1.0.0', isDev: true },
    };

    for (const [keyword, dep] of Object.entries(depMap)) {
      if (description.includes(keyword)) {
        deps.push(dep);
      }
    }

    return deps;
  }

  // ============================================================================
  // Content Generation Helpers
  // ============================================================================

  /**
   * Generate code content
   */
  protected generateCodeContent(
    task: TaskDocument,
    analysis: CodeAnalysisResult,
    language: string
  ): string {
    const header = this.generateFileHeader(task);
    const imports = this.generateImports(analysis, language);
    const body = this.generateCodeBody(task, analysis);

    return `${header}\n\n${imports}\n\n${body}`;
  }

  /**
   * Generate file header
   */
  protected generateFileHeader(task: TaskDocument): string {
    return `/**
 * ${task.title}
 *
 * ${task.description}
 *
 * @generated by Development Team
 */`;
  }

  /**
   * Generate imports
   */
  protected generateImports(_analysis: CodeAnalysisResult, language: string): string {
    if (language === 'typescript' || language === 'javascript') {
      return `// Imports`;
    }
    return '';
  }

  /**
   * Generate code body
   */
  protected generateCodeBody(task: TaskDocument, analysis: CodeAnalysisResult): string {
    return `// Implementation: ${task.title}
// Complexity: ${analysis.complexity}/10
// Approach: ${analysis.approach}

// TODO: Implement the feature

export {};
`;
  }

  /**
   * Generate test content
   */
  protected generateTestContent(task: TaskDocument, _mainFile: GeneratedFile): string {
    return `/**
 * Tests for: ${task.title}
 */

describe('${task.title}', () => {
  describe('basic functionality', () => {
    it('should work correctly', () => {
      // Test implementation
      expect(true).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle edge cases', () => {
      // Edge case tests
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', () => {
      // Error handling tests
      expect(true).toBe(true);
    });
  });
});
`;
  }

  /**
   * Generate types content
   */
  protected generateTypesContent(task: TaskDocument): string {
    const typeName = this.toPascalCase(this.generateFileName(task.title));

    return `/**
 * Types for: ${task.title}
 */

export interface ${typeName}Config {
  // Configuration options
}

export interface ${typeName}Result {
  success: boolean;
  data?: unknown;
  error?: Error;
}

export type ${typeName}Status = 'pending' | 'processing' | 'completed' | 'failed';
`;
  }

  /**
   * Generate documentation
   */
  protected generateDocumentation(task: TaskDocument, files: GeneratedFile[]): string {
    let doc = `# ${task.title}\n\n`;
    doc += `## Description\n${task.description}\n\n`;
    doc += `## Files\n`;

    for (const file of files) {
      doc += `- \`${file.path}\` (${file.linesOfCode} lines)\n`;
    }

    doc += `\n## Usage\n\`\`\`typescript\n// TODO: Add usage example\n\`\`\`\n`;

    return doc;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate file name from title
   */
  protected generateFileName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get file extension for language
   */
  protected getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      java: 'java',
      go: 'go',
      rust: 'rs',
      css: 'css',
      html: 'html',
    };
    return extensions[language] || 'txt';
  }

  /**
   * Convert to PascalCase
   */
  protected toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  /**
   * Update code statistics
   */
  protected updateCodeStats(result: CodeGenerationResult): void {
    this.codeStats.totalFiles += result.files.length;
    this.codeStats.totalTestFiles += result.testFiles.length;
    this.codeStats.totalLinesOfCode += result.files.reduce((sum, f) => sum + f.linesOfCode, 0);
    this.codeStats.totalTestLines += result.testFiles.reduce((sum, f) => sum + f.linesOfCode, 0);
  }

  /**
   * Create artifacts from result
   */
  protected createArtifacts(
    task: TaskDocument,
    result: CodeGenerationResult
  ): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];

    // Add code files as artifacts
    for (const file of result.files) {
      artifacts.push({
        id: uuidv4(),
        type: 'code',
        name: file.path.split('/').pop() || 'unknown',
        path: file.path,
        content: file.content,
        mimeType: this.getMimeType(file.language),
        size: file.content.length,
        createdAt: new Date(),
      });
    }

    // Add test files
    for (const file of result.testFiles) {
      artifacts.push({
        id: uuidv4(),
        type: 'test',
        name: file.path.split('/').pop() || 'unknown',
        path: file.path,
        content: file.content,
        mimeType: this.getMimeType(file.language),
        size: file.content.length,
        createdAt: new Date(),
      });
    }

    // Add documentation if present
    if (result.documentation) {
      artifacts.push({
        id: uuidv4(),
        type: 'document',
        name: `${this.generateFileName(task.title)}.md`,
        content: result.documentation,
        mimeType: 'text/markdown',
        size: result.documentation.length,
        createdAt: new Date(),
      });
    }

    return artifacts;
  }

  /**
   * Get MIME type for language
   */
  protected getMimeType(language: string): string {
    const mimeTypes: Record<string, string> = {
      typescript: 'text/typescript',
      javascript: 'text/javascript',
      python: 'text/x-python',
      java: 'text/x-java',
      go: 'text/x-go',
      css: 'text/css',
      html: 'text/html',
    };
    return mimeTypes[language] || 'text/plain';
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get code statistics
   */
  getCodeStats(): typeof this.codeStats {
    return { ...this.codeStats };
  }

  /**
   * Get supported languages
   */
  getLanguages(): string[] {
    return [...this.devConfig.languages];
  }

  /**
   * Get supported frameworks
   */
  getFrameworks(): string[] {
    return [...this.devConfig.frameworks];
  }
}
