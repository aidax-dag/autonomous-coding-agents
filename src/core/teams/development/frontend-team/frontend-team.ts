/**
 * Frontend Team
 *
 * Specialized development team for frontend/UI implementation.
 * Handles React, Vue, Angular, and other frontend frameworks.
 *
 * Feature: Team System
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TeamType,
  TaskDocument,
  TaskResult,
} from '../../team-types';
import {
  DevelopmentTeam,
  CodeGenerationResult,
  GeneratedFile,
} from '../development-team';

// Local imports
import { FrontendTeamConfig, ComponentAnalysis, ComponentStats } from './frontend-team.types';
import { DEFAULT_FRONTEND_CONFIG } from './frontend-team.config';
import {
  UI_DEVELOPER_ROLE,
  ACCESSIBILITY_SPECIALIST_ROLE,
  STYLING_SPECIALIST_ROLE,
} from './frontend-team.roles';
import { toComponentName } from './utils';
import {
  generateReactComponent,
  generatePageComponent,
  generateLayoutComponent,
  generateVueComponent,
  generateComponentStyle,
  generateMainStyle,
  generateTheme,
  generateCssVariables,
  generateComponentTypes,
  generateA11yUtilsFile,
  generateSkipLinksComponent,
  generateA11yDocumentation,
} from './templates';
import {
  generateComponentTests,
  generatePageTests,
  generateA11yTests,
  generateA11yTestSuite,
} from './test-templates';

/**
 * Frontend development team
 *
 * @example
 * ```typescript
 * const frontendTeam = createFrontendTeam({
 *   uiFrameworks: ['react'],
 *   cssApproach: 'tailwind',
 *   enableA11y: true,
 * });
 *
 * await frontendTeam.initialize();
 * await frontendTeam.start();
 *
 * await frontendTeam.submitTask(createTask(
 *   'User Profile Component',
 *   'Create a responsive user profile card with avatar and details'
 * ));
 * ```
 */
export class FrontendTeam extends DevelopmentTeam {
  /** Frontend-specific configuration */
  protected readonly frontendConfig: FrontendTeamConfig;

  /** Component statistics */
  protected componentStats: ComponentStats = {
    totalComponents: 0,
    pageComponents: 0,
    featureComponents: 0,
    uiComponents: 0,
    sharedComponents: 0,
  };

  constructor(config: FrontendTeamConfig = {}) {
    const mergedConfig = { ...DEFAULT_FRONTEND_CONFIG, ...config };

    super({
      id: config.id || `frontend-${uuidv4().slice(0, 8)}`,
      name: config.name || 'Frontend Team',
      type: TeamType.FRONTEND,
      languages: mergedConfig.languages || DEFAULT_FRONTEND_CONFIG.languages!,
      frameworks: mergedConfig.frameworks || DEFAULT_FRONTEND_CONFIG.frameworks!,
      generateTests: mergedConfig.generateTests ?? true,
      coverageTarget: mergedConfig.coverageTarget ?? 80,
      generateDocs: mergedConfig.generateDocs ?? true,
      enableLinting: mergedConfig.enableLinting ?? true,
      ...config,
    });

    this.frontendConfig = mergedConfig;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  protected override async initializeMembers(): Promise<void> {
    // Add core developer roles
    await super.initializeMembers();

    // Add frontend-specific roles
    this.addMember(UI_DEVELOPER_ROLE);

    if (this.frontendConfig.enableA11y) {
      this.addMember(ACCESSIBILITY_SPECIALIST_ROLE);
    }

    this.addMember(STYLING_SPECIALIST_ROLE);
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
        case 'component':
        case 'ui':
          result = await this.processComponent(task);
          break;
        case 'page':
          result = await this.processPage(task);
          break;
        case 'style':
        case 'css':
          result = await this.processStyle(task);
          break;
        case 'accessibility':
        case 'a11y':
          result = await this.processAccessibility(task);
          break;
        default:
          result = await this.processImplementation(task);
      }

      // Update statistics
      this.updateCodeStats(result);
      this.updateComponentStats(task);

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
          componentStats: this.componentStats,
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
  // Frontend-Specific Processing
  // ============================================================================

  /**
   * Process component task
   */
  protected async processComponent(task: TaskDocument): Promise<CodeGenerationResult> {
    const componentAnalysis = this.analyzeComponent(task);
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];
    const componentName = toComponentName(task.title);

    // Generate component file
    const componentFile = this.generateComponentFile(task, componentAnalysis);
    files.push(componentFile);

    // Generate styles if needed
    if (this.frontendConfig.cssApproach !== 'inline') {
      const styleContent = generateComponentStyle(task, componentAnalysis);
      files.push({
        path: `src/components/${componentAnalysis.componentType}/${componentName}.css`,
        content: styleContent,
        language: 'css',
        linesOfCode: styleContent.split('\n').length,
        isTest: false,
      });
    }

    // Generate types
    const typesContent = generateComponentTypes(task, componentAnalysis);
    files.push({
      path: `src/components/${componentAnalysis.componentType}/${componentName}.types.ts`,
      content: typesContent,
      language: 'typescript',
      linesOfCode: typesContent.split('\n').length,
      isTest: false,
    });

    // Generate tests
    if (this.devConfig.generateTests) {
      const testContent = generateComponentTests(task, componentAnalysis);
      testFiles.push({
        path: `tests/components/${componentAnalysis.componentType}/${componentName}.test.tsx`,
        content: testContent,
        language: 'typescript',
        linesOfCode: testContent.split('\n').length,
        isTest: true,
      });

      if (this.frontendConfig.enableA11y) {
        const a11yTestContent = generateA11yTests(task, componentAnalysis);
        testFiles.push({
          path: `tests/a11y/${componentName}.a11y.test.tsx`,
          content: a11yTestContent,
          language: 'typescript',
          linesOfCode: a11yTestContent.split('\n').length,
          isTest: true,
        });
      }
    }

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? this.generateComponentDocumentation(task, componentAnalysis)
        : undefined,
      dependencies: this.detectFrontendDependencies(task, componentAnalysis),
      notes: [
        `Component: ${task.title}`,
        `Type: ${componentAnalysis.componentType}`,
        `A11y: ${this.frontendConfig.enableA11y ? 'enabled' : 'disabled'}`,
      ],
    };
  }

  /**
   * Process page task
   */
  protected async processPage(task: TaskDocument): Promise<CodeGenerationResult> {
    const componentAnalysis = this.analyzeComponent(task);
    componentAnalysis.componentType = 'page';
    const pageName = toComponentName(task.title);

    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate page component
    const pageContent = generatePageComponent(task, pageName);
    files.push({
      path: `src/pages/${pageName}/${pageName}Page.tsx`,
      content: pageContent,
      language: 'typescript',
      linesOfCode: pageContent.split('\n').length,
      isTest: false,
    });

    // Generate layout if needed
    if (task.description.toLowerCase().includes('layout')) {
      const layoutContent = generateLayoutComponent(task, pageName);
      files.push({
        path: `src/layouts/${pageName}Layout.tsx`,
        content: layoutContent,
        language: 'typescript',
        linesOfCode: layoutContent.split('\n').length,
        isTest: false,
      });
    }

    // Generate page styles
    const styleContent = generateComponentStyle(task, componentAnalysis);
    files.push({
      path: `src/pages/${pageName}/${pageName}.css`,
      content: styleContent,
      language: 'css',
      linesOfCode: styleContent.split('\n').length,
      isTest: false,
    });

    // Generate tests
    if (this.devConfig.generateTests) {
      const testContent = generatePageTests(task);
      testFiles.push({
        path: `tests/pages/${pageName}Page.test.tsx`,
        content: testContent,
        language: 'typescript',
        linesOfCode: testContent.split('\n').length,
        isTest: true,
      });
    }

    return {
      files,
      testFiles,
      documentation: this.devConfig.generateDocs
        ? this.generateComponentDocumentation(task, componentAnalysis)
        : undefined,
      dependencies: this.detectFrontendDependencies(task, componentAnalysis),
      notes: [`Page: ${task.title}`, `Layout: ${files.length > 2 ? 'included' : 'none'}`],
    };
  }

  /**
   * Process style task
   */
  protected async processStyle(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];

    // Generate main style file
    const mainStyleContent = generateMainStyle(task);
    files.push({
      path: 'src/styles/main.css',
      content: mainStyleContent,
      language: 'css',
      linesOfCode: mainStyleContent.split('\n').length,
      isTest: false,
    });

    // Generate theme if mentioned
    if (task.description.toLowerCase().includes('theme')) {
      const themeContent = generateTheme(task);
      files.push({
        path: 'src/styles/theme.ts',
        content: themeContent,
        language: 'typescript',
        linesOfCode: themeContent.split('\n').length,
        isTest: false,
      });
    }

    // Generate CSS variables
    const variablesContent = generateCssVariables(task);
    files.push({
      path: 'src/styles/variables.css',
      content: variablesContent,
      language: 'css',
      linesOfCode: variablesContent.split('\n').length,
      isTest: false,
    });

    return {
      files,
      testFiles: [],
      dependencies: [],
      notes: [
        `Styles: ${task.title}`,
        `Approach: ${this.frontendConfig.cssApproach}`,
      ],
    };
  }

  /**
   * Process accessibility task
   */
  protected async processAccessibility(task: TaskDocument): Promise<CodeGenerationResult> {
    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate accessibility utilities
    const a11yUtilsContent = generateA11yUtilsFile(task);
    files.push({
      path: 'src/utils/a11y.ts',
      content: a11yUtilsContent,
      language: 'typescript',
      linesOfCode: a11yUtilsContent.split('\n').length,
      isTest: false,
    });

    // Generate skip links component
    const skipLinksContent = generateSkipLinksComponent();
    files.push({
      path: 'src/components/shared/SkipLinks.tsx',
      content: skipLinksContent,
      language: 'typescript',
      linesOfCode: skipLinksContent.split('\n').length,
      isTest: false,
    });

    // Generate a11y tests
    if (this.devConfig.generateTests) {
      const a11yTestContent = generateA11yTestSuite(task);
      testFiles.push({
        path: 'tests/a11y/compliance.test.ts',
        content: a11yTestContent,
        language: 'typescript',
        linesOfCode: a11yTestContent.split('\n').length,
        isTest: true,
      });
    }

    return {
      files,
      testFiles,
      documentation: generateA11yDocumentation(task),
      dependencies: [
        { name: '@testing-library/jest-dom', version: '^6.0.0', isDev: true },
        { name: 'axe-core', version: '^4.8.0', isDev: true },
      ],
      notes: [
        `Accessibility: ${task.title}`,
        `WCAG Level: AA`,
      ],
    };
  }

  // ============================================================================
  // Component Analysis
  // ============================================================================

  /**
   * Analyze component requirements
   */
  protected analyzeComponent(task: TaskDocument): ComponentAnalysis {
    const description = `${task.title} ${task.description}`.toLowerCase();

    // Determine component type
    let componentType: ComponentAnalysis['componentType'] = 'ui';
    if (description.includes('page') || description.includes('route')) {
      componentType = 'page';
    } else if (description.includes('feature') || description.includes('widget')) {
      componentType = 'feature';
    } else if (description.includes('shared') || description.includes('common')) {
      componentType = 'shared';
    }

    // Check for state requirements
    const requiresState =
      description.includes('state') ||
      description.includes('form') ||
      description.includes('interactive') ||
      description.includes('toggle');

    // Check for API requirements
    const requiresAPI =
      description.includes('api') ||
      description.includes('fetch') ||
      description.includes('data') ||
      description.includes('load');

    // Check for children
    const hasChildren =
      description.includes('children') ||
      description.includes('container') ||
      description.includes('wrapper') ||
      description.includes('layout');

    // Determine a11y requirements
    const a11yRequirements: string[] = [];
    if (description.includes('button')) a11yRequirements.push('button-role');
    if (description.includes('form')) a11yRequirements.push('form-labels');
    if (description.includes('modal')) a11yRequirements.push('focus-trap');
    if (description.includes('menu')) a11yRequirements.push('keyboard-nav');
    if (description.includes('image')) a11yRequirements.push('alt-text');

    // Determine responsive breakpoints
    const responsiveBreakpoints: string[] = [];
    if (this.frontendConfig.enableResponsive) {
      responsiveBreakpoints.push('sm', 'md', 'lg');
      if (description.includes('mobile')) responsiveBreakpoints.push('xs');
      if (description.includes('desktop')) responsiveBreakpoints.push('xl', '2xl');
    }

    return {
      componentType,
      requiresState,
      requiresAPI,
      hasChildren,
      a11yRequirements,
      responsiveBreakpoints,
    };
  }

  // ============================================================================
  // File Generation
  // ============================================================================

  /**
   * Generate component file
   */
  protected generateComponentFile(
    task: TaskDocument,
    analysis: ComponentAnalysis
  ): GeneratedFile {
    const componentName = toComponentName(task.title);
    const framework = this.frontendConfig.uiFrameworks?.[0] || 'react';

    let content: string;
    if (framework === 'react') {
      content = generateReactComponent(
        task,
        componentName,
        analysis,
        this.frontendConfig.cssApproach
      );
    } else if (framework === 'vue') {
      content = generateVueComponent(task, componentName, analysis);
    } else {
      content = generateReactComponent(
        task,
        componentName,
        analysis,
        this.frontendConfig.cssApproach
      );
    }

    const extension = framework === 'vue' ? 'vue' : 'tsx';

    return {
      path: `src/components/${analysis.componentType}/${componentName}.${extension}`,
      content,
      language: framework === 'vue' ? 'vue' : 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  // ============================================================================
  // Documentation Generation
  // ============================================================================

  /**
   * Generate component documentation
   */
  protected generateComponentDocumentation(
    task: TaskDocument,
    analysis: ComponentAnalysis
  ): string {
    const componentName = toComponentName(task.title);

    return `# ${componentName}

## Description
${task.description}

## Component Type
${analysis.componentType}

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| className | string | - | Additional CSS class |
${analysis.hasChildren ? '| children | ReactNode | - | Child elements |' : ''}
${analysis.requiresAPI ? '| data | unknown | - | Data to display |' : ''}
| disabled | boolean | false | Disabled state |
| onClick | () => void | - | Click handler |

## Accessibility

${analysis.a11yRequirements.length > 0 ? analysis.a11yRequirements.map((req) => `- ${req}`).join('\n') : 'Standard accessibility requirements'}

## Responsive Breakpoints

${analysis.responsiveBreakpoints.length > 0 ? analysis.responsiveBreakpoints.map((bp) => `- ${bp}`).join('\n') : 'Not responsive'}

## Usage

\`\`\`tsx
import { ${componentName} } from '@/components/${analysis.componentType}/${componentName}';

function Example() {
  return (
    <${componentName}>
      Content here
    </${componentName}>
  );
}
\`\`\`

## Variants

- Default
- Primary
- Secondary

## States

- Normal
- Hover
- Focus
- Disabled
`;
  }

  // ============================================================================
  // Dependency Detection
  // ============================================================================

  /**
   * Detect frontend dependencies
   */
  protected detectFrontendDependencies(
    task: TaskDocument,
    analysis: ComponentAnalysis
  ): { name: string; version: string; isDev: boolean }[] {
    const deps: { name: string; version: string; isDev: boolean }[] = [];
    const description = `${task.title} ${task.description}`.toLowerCase();

    // Framework dependencies
    if (this.frontendConfig.uiFrameworks?.includes('react')) {
      deps.push({ name: 'react', version: '^18.2.0', isDev: false });
      deps.push({ name: 'react-dom', version: '^18.2.0', isDev: false });
    }

    // CSS approach dependencies
    if (this.frontendConfig.cssApproach === 'styled-components') {
      deps.push({ name: 'styled-components', version: '^6.1.0', isDev: false });
    } else if (this.frontendConfig.cssApproach === 'emotion') {
      deps.push({ name: '@emotion/react', version: '^11.11.0', isDev: false });
      deps.push({ name: '@emotion/styled', version: '^11.11.0', isDev: false });
    }

    // State management
    if (analysis.requiresState && this.frontendConfig.stateManagement === 'redux') {
      deps.push({ name: '@reduxjs/toolkit', version: '^2.0.0', isDev: false });
      deps.push({ name: 'react-redux', version: '^9.0.0', isDev: false });
    }

    // Testing dependencies
    if (this.devConfig.generateTests) {
      deps.push({ name: '@testing-library/react', version: '^14.0.0', isDev: true });
      deps.push({ name: '@testing-library/jest-dom', version: '^6.0.0', isDev: true });
    }

    // A11y testing
    if (this.frontendConfig.enableA11y) {
      deps.push({ name: 'jest-axe', version: '^8.0.0', isDev: true });
      deps.push({ name: 'axe-core', version: '^4.8.0', isDev: true });
    }

    // Animation library
    if (description.includes('animation') || description.includes('motion')) {
      deps.push({ name: 'framer-motion', version: '^10.16.0', isDev: false });
    }

    return deps;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Update component statistics
   */
  protected updateComponentStats(task: TaskDocument): void {
    this.componentStats.totalComponents++;

    const type = task.type || 'ui';
    switch (type) {
      case 'page':
        this.componentStats.pageComponents++;
        break;
      case 'feature':
        this.componentStats.featureComponents++;
        break;
      case 'shared':
        this.componentStats.sharedComponents++;
        break;
      default:
        this.componentStats.uiComponents++;
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get component statistics
   */
  getComponentStats(): ComponentStats {
    return { ...this.componentStats };
  }

  /**
   * Get UI frameworks
   */
  getUIFrameworks(): string[] {
    return [...(this.frontendConfig.uiFrameworks || [])];
  }

  /**
   * Get CSS approach
   */
  getCSSApproach(): string {
    return this.frontendConfig.cssApproach || 'tailwind';
  }
}

/**
 * Create a frontend team
 */
export function createFrontendTeam(config: FrontendTeamConfig = {}): FrontendTeam {
  return new FrontendTeam(config);
}
