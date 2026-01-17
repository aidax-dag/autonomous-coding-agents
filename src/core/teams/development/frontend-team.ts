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
  TeamCapability,
  TaskDocument,
  TaskResult,
  AgentRole,
} from '../team-types';
import { createRole } from '../base-team';
import {
  DevelopmentTeam,
  DevelopmentTeamConfig,
  CodeGenerationResult,
  GeneratedFile,
} from './development-team';

// ============================================================================
// Types
// ============================================================================

/**
 * Frontend-specific configuration
 */
export interface FrontendTeamConfig extends Partial<DevelopmentTeamConfig> {
  /** UI frameworks to use */
  uiFrameworks?: string[];
  /** CSS approach (css-modules, tailwind, styled-components, etc.) */
  cssApproach?: string;
  /** Enable accessibility (a11y) checks */
  enableA11y?: boolean;
  /** Enable responsive design */
  enableResponsive?: boolean;
  /** Component library to use */
  componentLibrary?: string;
  /** State management approach */
  stateManagement?: string;
}

/**
 * Component analysis result
 */
export interface ComponentAnalysis {
  /** Component type (page, feature, ui, shared) */
  componentType: 'page' | 'feature' | 'ui' | 'shared';
  /** Requires state management */
  requiresState: boolean;
  /** Requires API calls */
  requiresAPI: boolean;
  /** Has children components */
  hasChildren: boolean;
  /** Accessibility requirements */
  a11yRequirements: string[];
  /** Responsive breakpoints needed */
  responsiveBreakpoints: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_FRONTEND_CONFIG: FrontendTeamConfig = {
  uiFrameworks: ['react'],
  cssApproach: 'tailwind',
  enableA11y: true,
  enableResponsive: true,
  languages: ['typescript', 'javascript', 'css', 'html'],
  frameworks: ['react', 'next.js'],
  generateTests: true,
  coverageTarget: 80,
  generateDocs: true,
  enableLinting: true,
};

// ============================================================================
// Agent Roles
// ============================================================================

const UI_DEVELOPER_ROLE: AgentRole = createRole(
  'UI Developer',
  'Specializes in building user interfaces and components',
  `You are a UI Developer agent. Your role is to:
1. Build reusable, accessible UI components
2. Implement responsive designs that work across devices
3. Follow component-based architecture patterns
4. Ensure proper state management within components
5. Optimize for performance and user experience

When building UI:
- Follow atomic design principles
- Ensure keyboard navigation and screen reader support
- Use semantic HTML elements
- Implement proper error states and loading states
- Consider mobile-first responsive design`,
  {
    capabilities: [TeamCapability.CODE_GENERATION, TeamCapability.UI_DESIGN],
    tools: ['read', 'write', 'edit', 'bash'],
  }
);

const ACCESSIBILITY_SPECIALIST_ROLE: AgentRole = createRole(
  'Accessibility Specialist',
  'Ensures UI meets accessibility standards (WCAG)',
  `You are an Accessibility Specialist agent. Your role is to:
1. Audit components for WCAG 2.1 AA compliance
2. Ensure proper ARIA labels and roles
3. Test keyboard navigation flows
4. Verify color contrast ratios
5. Check screen reader compatibility

Accessibility priorities:
- All interactive elements must be keyboard accessible
- Images need meaningful alt text
- Form inputs need associated labels
- Focus states must be visible
- Color is not the only means of conveying information`,
  {
    capabilities: [TeamCapability.CODE_REVIEW, TeamCapability.UI_DESIGN],
    tools: ['read', 'analyze'],
  }
);

const STYLING_SPECIALIST_ROLE: AgentRole = createRole(
  'Styling Specialist',
  'Handles CSS, animations, and visual design implementation',
  `You are a Styling Specialist agent. Your role is to:
1. Implement responsive layouts and grids
2. Create smooth animations and transitions
3. Ensure consistent styling across components
4. Optimize CSS for performance
5. Manage design tokens and themes

Styling best practices:
- Use CSS variables for theming
- Implement mobile-first responsive design
- Avoid excessive nesting in selectors
- Use modern layout techniques (Flexbox, Grid)
- Optimize animations for 60fps`,
  {
    capabilities: [TeamCapability.CODE_GENERATION, TeamCapability.UI_DESIGN],
    tools: ['read', 'write', 'edit'],
  }
);

// ============================================================================
// Frontend Team
// ============================================================================

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
  protected componentStats = {
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

    // Generate component file
    const componentFile = this.generateComponentFile(task, componentAnalysis);
    files.push(componentFile);

    // Generate styles if needed
    if (this.frontendConfig.cssApproach !== 'inline') {
      const styleFile = this.generateStyleFile(task, componentAnalysis);
      files.push(styleFile);
    }

    // Generate types
    const typesFile = this.generateComponentTypes(task, componentAnalysis);
    files.push(typesFile);

    // Generate tests
    if (this.devConfig.generateTests) {
      const componentTests = this.generateComponentTests(task, componentFile, componentAnalysis);
      testFiles.push(componentTests);

      if (this.frontendConfig.enableA11y) {
        const a11yTests = this.generateA11yTests(task, componentAnalysis);
        testFiles.push(a11yTests);
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

    const files: GeneratedFile[] = [];
    const testFiles: GeneratedFile[] = [];

    // Generate page component
    const pageFile = this.generatePageFile(task, componentAnalysis);
    files.push(pageFile);

    // Generate layout if needed
    if (task.description.toLowerCase().includes('layout')) {
      const layoutFile = this.generateLayoutFile(task);
      files.push(layoutFile);
    }

    // Generate page styles
    const styleFile = this.generateStyleFile(task, componentAnalysis);
    files.push(styleFile);

    // Generate tests
    if (this.devConfig.generateTests) {
      const pageTests = this.generatePageTests(task, pageFile);
      testFiles.push(pageTests);
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
    const styleFile = this.generateMainStyleFile(task);
    files.push(styleFile);

    // Generate theme if mentioned
    if (task.description.toLowerCase().includes('theme')) {
      const themeFile = this.generateThemeFile(task);
      files.push(themeFile);
    }

    // Generate CSS variables
    const variablesFile = this.generateCssVariables(task);
    files.push(variablesFile);

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
    const a11yUtilsFile = this.generateA11yUtils(task);
    files.push(a11yUtilsFile);

    // Generate skip links component
    const skipLinksFile = this.generateSkipLinks();
    files.push(skipLinksFile);

    // Generate a11y tests
    if (this.devConfig.generateTests) {
      const a11yTestSuite = this.generateA11yTestSuite(task);
      testFiles.push(a11yTestSuite);
    }

    return {
      files,
      testFiles,
      documentation: this.generateA11yDocumentation(task),
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
    const componentName = this.toComponentName(task.title);
    const framework = this.frontendConfig.uiFrameworks?.[0] || 'react';

    let content: string;
    if (framework === 'react') {
      content = this.generateReactComponent(task, componentName, analysis);
    } else if (framework === 'vue') {
      content = this.generateVueComponent(task, componentName, analysis);
    } else {
      content = this.generateReactComponent(task, componentName, analysis);
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

  /**
   * Generate React component
   */
  protected generateReactComponent(
    task: TaskDocument,
    componentName: string,
    analysis: ComponentAnalysis
  ): string {
    const hasProps = analysis.hasChildren || analysis.requiresAPI;
    const hasState = analysis.requiresState;
    const hasEffect = analysis.requiresAPI;

    const imports = [
      `import React${hasState ? ', { useState }' : ''}${hasEffect ? ', { useEffect }' : ''} from 'react';`,
    ];

    if (this.frontendConfig.cssApproach === 'styled-components') {
      imports.push(`import styled from 'styled-components';`);
    }

    const propsInterface = hasProps
      ? `
export interface ${componentName}Props {
  ${analysis.hasChildren ? 'children?: React.ReactNode;' : ''}
  ${analysis.requiresAPI ? 'data?: unknown;' : ''}
  className?: string;
}`
      : `
export interface ${componentName}Props {
  className?: string;
}`;

    const stateDeclaration = hasState
      ? `
  const [isActive, setIsActive] = useState(false);`
      : '';

    const effectDeclaration = hasEffect
      ? `
  useEffect(() => {
    // Load data on mount
  }, []);`
      : '';

    const a11yProps = analysis.a11yRequirements.length > 0
      ? this.generateA11yProps(analysis.a11yRequirements)
      : '';

    return `/**
 * ${componentName}
 *
 * ${task.description}
 *
 * @generated by Frontend Team
 */

${imports.join('\n')}
import './${componentName}.css';
${propsInterface}

/**
 * ${task.description}
 */
export const ${componentName}: React.FC<${componentName}Props> = ({
  ${analysis.hasChildren ? 'children,' : ''}
  className,
}) => {${stateDeclaration}${effectDeclaration}

  return (
    <div
      className={\`${this.toKebabCase(componentName)} \${className || ''}\`}
      ${a11yProps}
    >
      {/* Component content */}
      ${analysis.hasChildren ? '{children}' : `<span>${task.title}</span>`}
    </div>
  );
};

export default ${componentName};
`;
  }

  /**
   * Generate Vue component
   */
  protected generateVueComponent(
    task: TaskDocument,
    componentName: string,
    analysis: ComponentAnalysis
  ): string {
    return `<template>
  <div class="${this.toKebabCase(componentName)}">
    <!-- ${task.description} -->
    ${analysis.hasChildren ? '<slot />' : `<span>${task.title}</span>`}
  </div>
</template>

<script setup lang="ts">
/**
 * ${componentName}
 *
 * ${task.description}
 *
 * @generated by Frontend Team
 */

${analysis.requiresState ? "import { ref } from 'vue';" : ''}

${analysis.requiresState ? "const isActive = ref(false);" : '// No state required'}
</script>

<style scoped>
.${this.toKebabCase(componentName)} {
  /* Component styles */
}
</style>
`;
  }

  /**
   * Generate style file
   */
  protected generateStyleFile(
    task: TaskDocument,
    analysis: ComponentAnalysis
  ): GeneratedFile {
    const componentName = this.toComponentName(task.title);
    const className = this.toKebabCase(componentName);

    const breakpointStyles = analysis.responsiveBreakpoints
      .map((bp) => this.generateBreakpointStyle(bp, className))
      .join('\n');

    const content = `/**
 * Styles for ${componentName}
 *
 * @generated by Frontend Team
 */

.${className} {
  /* Base styles */
  display: flex;
  flex-direction: column;
}

.${className}__content {
  /* Content area */
}

.${className}__header {
  /* Header area */
}

.${className}__footer {
  /* Footer area */
}

/* State variations */
.${className}--active {
  /* Active state */
}

.${className}--disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* Responsive styles */
${breakpointStyles}
`;

    return {
      path: `src/components/${analysis.componentType}/${componentName}.css`,
      content,
      language: 'css',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate component types
   */
  protected generateComponentTypes(
    task: TaskDocument,
    analysis: ComponentAnalysis
  ): GeneratedFile {
    const componentName = this.toComponentName(task.title);

    const content = `/**
 * Types for ${componentName}
 *
 * @generated by Frontend Team
 */

export interface ${componentName}Props {
  /** Optional CSS class name */
  className?: string;
  ${analysis.hasChildren ? '/** Child elements */\n  children?: React.ReactNode;' : ''}
  ${analysis.requiresAPI ? '/** Data to display */\n  data?: unknown;' : ''}
  /** Disabled state */
  disabled?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export interface ${componentName}State {
  ${analysis.requiresState ? '/** Active state */\n  isActive: boolean;' : '// No state'}
  ${analysis.requiresAPI ? '/** Loading state */\n  isLoading: boolean;\n  /** Error state */\n  error?: Error;' : ''}
}

export type ${componentName}Variant = 'default' | 'primary' | 'secondary';

export type ${componentName}Size = 'small' | 'medium' | 'large';
`;

    return {
      path: `src/components/${analysis.componentType}/${componentName}.types.ts`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate page file
   */
  protected generatePageFile(task: TaskDocument, _analysis: ComponentAnalysis): GeneratedFile {
    const pageName = this.toComponentName(task.title);

    const content = `/**
 * ${pageName} Page
 *
 * ${task.description}
 *
 * @generated by Frontend Team
 */

import React from 'react';
import './${pageName}.css';

export interface ${pageName}PageProps {
  /** Page parameters */
  params?: Record<string, string>;
}

/**
 * ${task.description}
 */
export const ${pageName}Page: React.FC<${pageName}PageProps> = ({ params }) => {
  return (
    <main className="${this.toKebabCase(pageName)}-page">
      <header className="${this.toKebabCase(pageName)}-page__header">
        <h1>${task.title}</h1>
      </header>

      <section className="${this.toKebabCase(pageName)}-page__content">
        {/* Page content */}
      </section>

      <footer className="${this.toKebabCase(pageName)}-page__footer">
        {/* Page footer */}
      </footer>
    </main>
  );
};

export default ${pageName}Page;
`;

    return {
      path: `src/pages/${pageName}/${pageName}Page.tsx`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate layout file
   */
  protected generateLayoutFile(task: TaskDocument): GeneratedFile {
    const layoutName = this.toComponentName(task.title);

    const content = `/**
 * ${layoutName} Layout
 *
 * @generated by Frontend Team
 */

import React from 'react';

export interface ${layoutName}LayoutProps {
  children: React.ReactNode;
}

export const ${layoutName}Layout: React.FC<${layoutName}LayoutProps> = ({ children }) => {
  return (
    <div className="${this.toKebabCase(layoutName)}-layout">
      <nav className="${this.toKebabCase(layoutName)}-layout__nav">
        {/* Navigation */}
      </nav>

      <main className="${this.toKebabCase(layoutName)}-layout__main">
        {children}
      </main>

      <aside className="${this.toKebabCase(layoutName)}-layout__sidebar">
        {/* Sidebar */}
      </aside>
    </div>
  );
};

export default ${layoutName}Layout;
`;

    return {
      path: `src/layouts/${layoutName}Layout.tsx`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate main style file
   */
  protected generateMainStyleFile(task: TaskDocument): GeneratedFile {
    const content = `/**
 * ${task.title}
 *
 * ${task.description}
 *
 * @generated by Frontend Team
 */

/* Reset and base styles */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Root variables */
:root {
  /* Colors */
  --color-primary: #3b82f6;
  --color-secondary: #6b7280;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Typography */
  --font-family-base: system-ui, -apple-system, sans-serif;
  --font-size-base: 1rem;
  --line-height-base: 1.5;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Borders */
  --border-radius-sm: 0.25rem;
  --border-radius-md: 0.5rem;
  --border-radius-lg: 1rem;
}

/* Base body styles */
body {
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
}

/* Focus styles for accessibility */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
`;

    return {
      path: 'src/styles/main.css',
      content,
      language: 'css',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate theme file
   */
  protected generateThemeFile(task: TaskDocument): GeneratedFile {
    const content = `/**
 * Theme Configuration
 *
 * ${task.description}
 *
 * @generated by Frontend Team
 */

export const lightTheme = {
  colors: {
    background: '#ffffff',
    surface: '#f9fafb',
    text: {
      primary: '#111827',
      secondary: '#6b7280',
      disabled: '#9ca3af',
    },
    border: '#e5e7eb',
    primary: '#3b82f6',
    secondary: '#6b7280',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
    },
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
    full: '9999px',
  },
};

export const darkTheme = {
  ...lightTheme,
  colors: {
    background: '#111827',
    surface: '#1f2937',
    text: {
      primary: '#f9fafb',
      secondary: '#9ca3af',
      disabled: '#6b7280',
    },
    border: '#374151',
    primary: '#60a5fa',
    secondary: '#9ca3af',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
  },
};

export type Theme = typeof lightTheme;
`;

    return {
      path: 'src/styles/theme.ts',
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate CSS variables file
   */
  protected generateCssVariables(task: TaskDocument): GeneratedFile {
    const content = `/**
 * CSS Variables
 *
 * ${task.description}
 *
 * @generated by Frontend Team
 */

:root {
  /* Color Palette */
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;

  /* Neutral Colors */
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;

  /* Semantic Colors */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}
`;

    return {
      path: 'src/styles/variables.css',
      content,
      language: 'css',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate accessibility utilities
   */
  protected generateA11yUtils(task: TaskDocument): GeneratedFile {
    const content = `/**
 * Accessibility Utilities
 *
 * ${task.description}
 *
 * @generated by Frontend Team
 */

/**
 * Visually hidden but accessible to screen readers
 */
export const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * Create an accessible label
 */
export function createAriaLabel(text: string, context?: string): string {
  return context ? \`\${text}, \${context}\` : text;
}

/**
 * Announce to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  Object.assign(announcement.style, visuallyHidden);
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Trap focus within an element
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);
  firstFocusable?.focus();

  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Check if element has sufficient color contrast
 */
export function hassufficientContrast(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  // Simplified contrast check
  // In production, use a proper color contrast library
  const threshold = level === 'AAA' ? 7 : 4.5;
  return true; // Placeholder - implement proper contrast calculation
}
`;

    return {
      path: 'src/utils/a11y.ts',
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  /**
   * Generate skip links component
   */
  protected generateSkipLinks(): GeneratedFile {
    const content = `/**
 * Skip Links Component
 *
 * Provides keyboard-accessible skip links for navigation.
 *
 * @generated by Frontend Team
 */

import React from 'react';
import './SkipLinks.css';

export interface SkipLink {
  /** Target element ID */
  targetId: string;
  /** Link text */
  text: string;
}

export interface SkipLinksProps {
  /** Skip links configuration */
  links?: SkipLink[];
}

const defaultLinks: SkipLink[] = [
  { targetId: 'main-content', text: 'Skip to main content' },
  { targetId: 'main-navigation', text: 'Skip to navigation' },
];

/**
 * Skip links for keyboard navigation
 */
export const SkipLinks: React.FC<SkipLinksProps> = ({ links = defaultLinks }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="skip-links" aria-label="Skip links">
      {links.map((link) => (
        <a
          key={link.targetId}
          href={\`#\${link.targetId}\`}
          className="skip-links__link"
          onClick={(e) => handleClick(e, link.targetId)}
        >
          {link.text}
        </a>
      ))}
    </nav>
  );
};

export default SkipLinks;
`;

    return {
      path: 'src/components/shared/SkipLinks.tsx',
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: false,
    };
  }

  // ============================================================================
  // Test Generation
  // ============================================================================

  /**
   * Generate component tests
   */
  protected generateComponentTests(
    task: TaskDocument,
    _componentFile: GeneratedFile,
    analysis: ComponentAnalysis
  ): GeneratedFile {
    const componentName = this.toComponentName(task.title);

    const content = `/**
 * Tests for ${componentName}
 *
 * @generated by Frontend Team
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ${componentName} } from './${componentName}';

describe('${componentName}', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<${componentName} />);
      expect(screen.getByRole('${analysis.a11yRequirements[0] || 'generic'}')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<${componentName} className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });
    ${analysis.hasChildren ? `
    it('should render children', () => {
      render(<${componentName}><span>Child content</span></${componentName}>);
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });` : ''}
  });
  ${analysis.requiresState ? `
  describe('state', () => {
    it('should handle state changes', () => {
      render(<${componentName} />);
      // Test state interactions
    });
  });` : ''}

  describe('interactions', () => {
    it('should handle click events', () => {
      const handleClick = jest.fn();
      render(<${componentName} onClick={handleClick} />);
      // fireEvent.click(screen.getByRole('button'));
      // expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<${componentName} disabled />);
      // Test disabled state
    });
  });
});
`;

    return {
      path: `tests/components/${analysis.componentType}/${componentName}.test.tsx`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  /**
   * Generate accessibility tests
   */
  protected generateA11yTests(
    task: TaskDocument,
    analysis: ComponentAnalysis
  ): GeneratedFile {
    const componentName = this.toComponentName(task.title);

    const content = `/**
 * Accessibility Tests for ${componentName}
 *
 * @generated by Frontend Team
 */

import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ${componentName} } from '../src/components/${analysis.componentType}/${componentName}';

expect.extend(toHaveNoViolations);

describe('${componentName} Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<${componentName} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  ${analysis.a11yRequirements.includes('keyboard-nav') ? `
  it('should be keyboard navigable', () => {
    render(<${componentName} />);
    // Test keyboard navigation
  });` : ''}

  ${analysis.a11yRequirements.includes('focus-trap') ? `
  it('should trap focus when open', () => {
    render(<${componentName} />);
    // Test focus trapping
  });` : ''}

  ${analysis.a11yRequirements.includes('form-labels') ? `
  it('should have associated labels for form inputs', () => {
    render(<${componentName} />);
    // Test form labels
  });` : ''}

  it('should have sufficient color contrast', () => {
    // Test color contrast ratios
  });

  it('should announce changes to screen readers', () => {
    // Test ARIA live regions
  });
});
`;

    return {
      path: `tests/a11y/${componentName}.a11y.test.tsx`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  /**
   * Generate page tests
   */
  protected generatePageTests(task: TaskDocument, _pageFile: GeneratedFile): GeneratedFile {
    const pageName = this.toComponentName(task.title);

    const content = `/**
 * Tests for ${pageName} Page
 *
 * @generated by Frontend Team
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ${pageName}Page } from './${pageName}Page';

describe('${pageName}Page', () => {
  describe('rendering', () => {
    it('should render the page', () => {
      render(<${pageName}Page />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should render the page title', () => {
      render(<${pageName}Page />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<${pageName}Page />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should have landmark regions', () => {
      render(<${pageName}Page />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('SEO', () => {
    it('should have appropriate meta content', () => {
      // Test meta tags if applicable
    });
  });
});
`;

    return {
      path: `tests/pages/${pageName}Page.test.tsx`,
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: true,
    };
  }

  /**
   * Generate a11y test suite
   */
  protected generateA11yTestSuite(task: TaskDocument): GeneratedFile {
    const content = `/**
 * Accessibility Test Suite
 *
 * ${task.description}
 *
 * @generated by Frontend Team
 */

import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility Compliance', () => {
  describe('WCAG 2.1 Level AA', () => {
    it('should meet color contrast requirements', () => {
      // Test color contrast
    });

    it('should have keyboard-accessible navigation', () => {
      // Test keyboard navigation
    });

    it('should have proper focus management', () => {
      // Test focus states
    });

    it('should have appropriate ARIA labels', () => {
      // Test ARIA attributes
    });

    it('should work with screen readers', () => {
      // Test screen reader compatibility
    });
  });

  describe('Form Accessibility', () => {
    it('should have associated labels', () => {
      // Test form labels
    });

    it('should announce errors', () => {
      // Test error announcements
    });

    it('should have clear instructions', () => {
      // Test form instructions
    });
  });

  describe('Media Accessibility', () => {
    it('should have alt text for images', () => {
      // Test image alt text
    });

    it('should have captions for videos', () => {
      // Test video captions
    });
  });
});
`;

    return {
      path: 'tests/a11y/compliance.test.ts',
      content,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      isTest: true,
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
    const componentName = this.toComponentName(task.title);

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

  /**
   * Generate accessibility documentation
   */
  protected generateA11yDocumentation(task: TaskDocument): string {
    return `# Accessibility Guidelines

## Description
${task.description}

## WCAG 2.1 Compliance

### Level A
- All images have alt text
- All form inputs have labels
- Color is not the only means of conveying information

### Level AA
- Color contrast ratio is at least 4.5:1 for normal text
- Focus states are visible
- Headings are properly structured

### Level AAA
- Color contrast ratio is at least 7:1
- Sign language interpretation for video

## Implementation

### Skip Links
Use the SkipLinks component to provide keyboard shortcuts.

### Focus Management
Use the trapFocus utility for modal dialogs.

### Screen Reader Announcements
Use the announce utility for dynamic updates.

## Testing

Run accessibility tests:
\`\`\`bash
npm run test:a11y
\`\`\`
`;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate a11y props
   */
  protected generateA11yProps(requirements: string[]): string {
    const props: string[] = [];

    if (requirements.includes('button-role')) {
      props.push('role="button"');
      props.push('tabIndex={0}');
    }

    if (requirements.includes('form-labels')) {
      props.push('aria-labelledby="form-label"');
    }

    if (requirements.includes('focus-trap')) {
      props.push('aria-modal="true"');
    }

    return props.join('\n      ');
  }

  /**
   * Generate breakpoint style
   */
  protected generateBreakpointStyle(breakpoint: string, className: string): string {
    const breakpointMap: Record<string, string> = {
      xs: '320px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    };

    const minWidth = breakpointMap[breakpoint] || '768px';

    return `
@media (min-width: ${minWidth}) {
  .${className} {
    /* ${breakpoint} breakpoint styles */
  }
}`;
  }

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

  /**
   * Convert title to component name (PascalCase)
   */
  protected toComponentName(title: string): string {
    return title
      .split(/[-_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Convert to kebab-case
   */
  protected toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

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
  getComponentStats(): typeof this.componentStats {
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

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a frontend team
 */
export function createFrontendTeam(config: FrontendTeamConfig = {}): FrontendTeam {
  return new FrontendTeam(config);
}
