/**
 * UI Code Generator
 *
 * Generates frontend code from image analysis results. Converts
 * detected UI elements and layouts into framework-specific component
 * code, and transforms diagram analysis into module scaffolding.
 *
 * @module core/multimodal
 */

import type {
  ImageAnalysisResult,
  DiagramAnalysisResult,
  UIElement,
  LayoutInfo,
  DiagramComponent,
  DiagramConnection,
  CodeGenerationResult,
} from './types';

/**
 * Code generation options
 */
export interface CodeGenerationOptions {
  /** Target framework override */
  framework?: string;
  /** Target language override */
  language?: string;
}

/**
 * Generates framework-specific code from multimodal analysis results.
 * Supports React component generation from UI analysis and module
 * scaffolding from diagram analysis.
 */
export class UICodeGenerator {
  private readonly defaultFramework: string;

  constructor(defaultFramework: string = 'react') {
    this.defaultFramework = defaultFramework;
  }

  /**
   * Generate a full code result from an image analysis
   */
  generateFromAnalysis(
    analysis: ImageAnalysisResult,
    options?: CodeGenerationOptions,
  ): CodeGenerationResult {
    const framework = options?.framework ?? analysis.suggestedFramework ?? this.defaultFramework;
    const language = options?.language ?? (framework === 'react' ? 'typescript' : 'javascript');

    const files: Array<{ path: string; content: string }> = [];
    const dependencies: string[] = [];

    // Generate component code
    if (analysis.elements.length > 0) {
      const componentCode = this.generateComponent(analysis.elements[0], framework);
      const ext = language === 'typescript' ? 'tsx' : 'jsx';
      files.push({
        path: `src/components/GeneratedComponent.${ext}`,
        content: componentCode,
      });
    }

    // Generate layout wrapper
    const layoutCode = this.generateLayout(analysis.layout, framework);
    files.push({
      path: 'src/components/Layout.tsx',
      content: layoutCode,
    });

    // Generate styles
    const styleCode = this.generateStyles(analysis.colors, analysis.layout);
    files.push({
      path: 'src/styles/generated.css',
      content: styleCode,
    });

    // Determine dependencies based on framework
    if (framework === 'react') {
      dependencies.push('react', 'react-dom');
      if (language === 'typescript') {
        dependencies.push('@types/react', '@types/react-dom');
      }
    }

    return { framework, language, files, dependencies };
  }

  /**
   * Generate a component from a UI element for the specified framework
   */
  generateComponent(element: UIElement, framework: string): string {
    if (framework === 'react') {
      return this.elementToReactComponent(element);
    }

    // Default fallback: generate HTML
    return this.elementToHTML(element);
  }

  /**
   * Generate a layout wrapper component for the specified framework
   */
  generateLayout(layout: LayoutInfo, framework: string): string {
    if (framework === 'react') {
      return this.layoutToReactComponent(layout);
    }

    return this.layoutToHTML(layout);
  }

  /**
   * Generate CSS styles from a color palette and layout information
   */
  generateStyles(colors: string[], layout: LayoutInfo): string {
    const cssLines: string[] = [];

    cssLines.push('/* Auto-generated styles from multimodal analysis */');
    cssLines.push('');

    // CSS custom properties for colors
    if (colors.length > 0) {
      cssLines.push(':root {');
      colors.forEach((color, i) => {
        cssLines.push(`  --color-${i + 1}: ${color};`);
      });
      cssLines.push('}');
      cssLines.push('');
    }

    // Layout styles
    cssLines.push(this.layoutToCSS(layout));

    return cssLines.join('\n');
  }

  /**
   * Generate module scaffolding from a diagram analysis
   */
  generateArchitectureFromDiagram(
    analysis: DiagramAnalysisResult,
  ): CodeGenerationResult {
    const files = this.diagramToModules(analysis.components, analysis.connections);

    // Generate an index barrel file
    if (analysis.components.length > 0) {
      const exports = analysis.components
        .map((c) => {
          const moduleName = this.sanitizeIdentifier(c.name);
          return `export { ${moduleName} } from './${this.toKebabCase(c.name)}';`;
        })
        .join('\n');

      files.push({
        path: 'src/index.ts',
        content: `/**\n * Auto-generated barrel export from diagram analysis\n * ${analysis.description}\n */\n\n${exports}\n`,
      });
    }

    return {
      framework: 'node',
      language: 'typescript',
      files,
      dependencies: [],
    };
  }

  /**
   * Convert a UI element to a React component string
   */
  private elementToReactComponent(element: UIElement): string {
    const componentName = this.getComponentName(element);
    const childrenCode = element.children
      ? element.children
          .map((child) => this.elementToReactJSX(child, 3))
          .join('\n')
      : this.getDefaultContent(element);

    return [
      `import React from 'react';`,
      '',
      `interface ${componentName}Props {`,
      `  className?: string;`,
      `}`,
      '',
      `export const ${componentName}: React.FC<${componentName}Props> = ({ className }) => {`,
      `  return (`,
      `    <${this.getHTMLTag(element)} className={\`${this.getCSSClass(element)} \${className ?? ''}\`}>`,
      `      ${childrenCode}`,
      `    </${this.getHTMLTag(element)}>`,
      `  );`,
      `};`,
      '',
    ].join('\n');
  }

  /**
   * Convert a UI element to a React JSX fragment (for nesting)
   */
  private elementToReactJSX(element: UIElement, indent: number): string {
    const pad = '  '.repeat(indent);
    const tag = this.getHTMLTag(element);
    const content = element.label ?? '';

    if (!element.children || element.children.length === 0) {
      if (element.type === 'input') {
        return `${pad}<${tag} placeholder="${content}" className="${this.getCSSClass(element)}" />`;
      }
      return `${pad}<${tag} className="${this.getCSSClass(element)}">${content}</${tag}>`;
    }

    const children = element.children
      .map((child) => this.elementToReactJSX(child, indent + 1))
      .join('\n');

    return [
      `${pad}<${tag} className="${this.getCSSClass(element)}">`,
      children,
      `${pad}</${tag}>`,
    ].join('\n');
  }

  /**
   * Convert a UI element to plain HTML
   */
  private elementToHTML(element: UIElement): string {
    const tag = this.getHTMLTag(element);
    const content = element.label ?? '';

    if (element.type === 'input') {
      return `<${tag} placeholder="${content}" class="${this.getCSSClass(element)}" />`;
    }

    return `<${tag} class="${this.getCSSClass(element)}">${content}</${tag}>`;
  }

  /**
   * Generate a React layout wrapper component
   */
  private layoutToReactComponent(layout: LayoutInfo): string {
    const layoutClass = this.getLayoutClass(layout);

    return [
      `import React from 'react';`,
      '',
      `interface LayoutProps {`,
      `  children: React.ReactNode;`,
      `  className?: string;`,
      `}`,
      '',
      `export const Layout: React.FC<LayoutProps> = ({ children, className }) => {`,
      `  return (`,
      `    <div className={\`${layoutClass} \${className ?? ''}\`}>`,
      `      {children}`,
      `    </div>`,
      `  );`,
      `};`,
      '',
    ].join('\n');
  }

  /**
   * Generate an HTML layout wrapper
   */
  private layoutToHTML(layout: LayoutInfo): string {
    const layoutClass = this.getLayoutClass(layout);
    return `<div class="${layoutClass}"></div>`;
  }

  /**
   * Generate CSS for a layout
   */
  private layoutToCSS(layout: LayoutInfo): string {
    const lines: string[] = [];

    if (layout.type === 'grid') {
      lines.push('.layout-container {');
      lines.push('  display: grid;');
      lines.push(`  grid-template-columns: repeat(${layout.columns ?? 12}, 1fr);`);
      lines.push('  gap: 1rem;');
      lines.push('}');
    } else if (layout.type === 'flex') {
      lines.push('.layout-container {');
      lines.push('  display: flex;');
      lines.push(`  flex-direction: ${layout.direction ?? 'column'};`);
      lines.push('  gap: 1rem;');
      lines.push('}');
    } else if (layout.type === 'absolute') {
      lines.push('.layout-container {');
      lines.push('  position: relative;');
      lines.push('}');
    } else {
      lines.push('.layout-container {');
      lines.push('  display: flex;');
      lines.push('  flex-wrap: wrap;');
      lines.push('  gap: 1rem;');
      lines.push('}');
    }

    if (layout.responsive) {
      lines.push('');
      lines.push('@media (max-width: 768px) {');
      lines.push('  .layout-container {');
      lines.push('    flex-direction: column;');
      lines.push('  }');
      lines.push('}');
    }

    return lines.join('\n');
  }

  /**
   * Convert diagram components and connections into module files
   */
  private diagramToModules(
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): Array<{ path: string; content: string }> {
    return components.map((component) => {
      const fileName = this.toKebabCase(component.name);
      const className = this.sanitizeIdentifier(component.name);

      // Find connections involving this component
      const inbound = connections.filter((c) => c.to === component.id);
      const outbound = connections.filter((c) => c.from === component.id);

      // Generate import statements for outbound connections
      const imports = outbound
        .map((conn) => {
          const target = components.find((c) => c.id === conn.to);
          if (!target) return '';
          const targetName = this.sanitizeIdentifier(target.name);
          return `import type { ${targetName} } from './${this.toKebabCase(target.name)}';`;
        })
        .filter(Boolean);

      // Build module content
      const lines: string[] = [];
      lines.push(`/**`);
      lines.push(` * ${component.name} - ${component.type}`);
      if (inbound.length > 0) {
        lines.push(` * Receives from: ${inbound.map((c) => c.label ?? c.from).join(', ')}`);
      }
      if (outbound.length > 0) {
        lines.push(` * Sends to: ${outbound.map((c) => c.label ?? c.to).join(', ')}`);
      }
      lines.push(` */`);
      lines.push('');

      if (imports.length > 0) {
        lines.push(...imports);
        lines.push('');
      }

      lines.push(`export interface ${className} {`);

      // Add properties from component metadata
      const props = component.properties;
      if (props && typeof props === 'object') {
        for (const [key, value] of Object.entries(props)) {
          lines.push(`  /** ${key} */`);
          lines.push(`  ${key}: ${typeof value === 'string' ? 'string' : 'unknown'};`);
        }
      }

      if (!props || Object.keys(props).length === 0) {
        lines.push(`  /** Component identifier */`);
        lines.push(`  id: string;`);
      }

      lines.push(`}`);
      lines.push('');

      return {
        path: `src/${fileName}.ts`,
        content: lines.join('\n'),
      };
    });
  }

  /**
   * Map a UI element type to an HTML tag
   */
  private getHTMLTag(element: UIElement): string {
    const tagMap: Record<UIElement['type'], string> = {
      button: 'button',
      input: 'input',
      text: 'p',
      image: 'img',
      container: 'div',
      nav: 'nav',
      list: 'ul',
      table: 'table',
      form: 'form',
      card: 'div',
    };
    return tagMap[element.type] ?? 'div';
  }

  /**
   * Generate a CSS class name for a UI element
   */
  private getCSSClass(element: UIElement): string {
    return `el-${element.type}`;
  }

  /**
   * Generate a React component name from a UI element
   */
  private getComponentName(element: UIElement): string {
    const label = element.label
      ? element.label.replace(/[^a-zA-Z0-9]/g, '')
      : element.type;
    return label.charAt(0).toUpperCase() + label.slice(1) + 'Component';
  }

  /**
   * Generate default content placeholder for an element
   */
  private getDefaultContent(element: UIElement): string {
    if (element.label) return element.label;
    if (element.type === 'button') return 'Click me';
    if (element.type === 'input') return '';
    return '';
  }

  /**
   * Generate layout CSS class name
   */
  private getLayoutClass(layout: LayoutInfo): string {
    if (layout.type === 'grid') return 'layout-container layout-grid';
    if (layout.type === 'flex') return `layout-container layout-flex-${layout.direction ?? 'column'}`;
    return 'layout-container';
  }

  /**
   * Convert a string to kebab-case for file names
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase();
  }

  /**
   * Sanitize a string to a valid TypeScript/JavaScript identifier
   */
  private sanitizeIdentifier(str: string): string {
    const cleaned = str.replace(/[^a-zA-Z0-9_]/g, '');
    // Ensure starts with a letter
    const result = cleaned.match(/^[a-zA-Z]/) ? cleaned : `_${cleaned}`;
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
}

/**
 * Factory function for creating a UICodeGenerator
 */
export function createUICodeGenerator(
  defaultFramework?: string,
): UICodeGenerator {
  return new UICodeGenerator(defaultFramework);
}
