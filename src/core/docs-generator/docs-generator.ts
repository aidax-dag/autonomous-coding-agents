/**
 * Documentation Generator
 *
 * Generates HLD/MLD/LLD documents from codebase analysis.
 * Uses pluggable analyzers for actual content generation.
 *
 * @module core/docs-generator
 */

import type {
  IDocsGenerator,
  DocLevel,
  DocGeneratorOptions,
  GeneratedDoc,
  HLDContent,
  MLDContent,
  LLDContent,
} from './interfaces/docs-generator.interface';

/**
 * Content analyzer — pluggable analysis function
 */
export type ContentAnalyzer = (
  path: string,
  level: DocLevel,
  options?: DocGeneratorOptions,
) => Promise<{
  hld?: HLDContent;
  mld?: MLDContent;
  lld?: LLDContent;
}>;

/**
 * DocsGenerator options
 */
export interface DocsGeneratorConfig {
  /** Custom content analyzer */
  analyzer?: ContentAnalyzer;
  /** Default doc generation options */
  defaults?: DocGeneratorOptions;
}

/**
 * Documentation Generator implementation
 */
export class DocsGenerator implements IDocsGenerator {
  private readonly analyzer?: ContentAnalyzer;
  private readonly defaults: DocGeneratorOptions;

  constructor(config: DocsGeneratorConfig = {}) {
    this.analyzer = config.analyzer;
    this.defaults = config.defaults ?? { levels: ['HLD', 'MLD', 'LLD'] };
  }

  async generateHLD(
    rootPath: string,
    options?: DocGeneratorOptions,
  ): Promise<GeneratedDoc> {
    const opts = { ...this.defaults, ...options };

    if (this.analyzer) {
      const result = await this.analyzer(rootPath, 'HLD', opts);
      if (result.hld) {
        return this.formatHLD(result.hld, rootPath);
      }
    }

    // Default stub
    const hld: HLDContent = {
      systemName: rootPath.split('/').pop() ?? 'system',
      overview: `High-level design for ${rootPath}`,
      components: [],
      relationships: [],
      decisions: [],
      techStack: [],
    };

    return this.formatHLD(hld, rootPath);
  }

  async generateMLD(
    modulePath: string,
    options?: DocGeneratorOptions,
  ): Promise<GeneratedDoc> {
    const opts = { ...this.defaults, ...options };

    if (this.analyzer) {
      const result = await this.analyzer(modulePath, 'MLD', opts);
      if (result.mld) {
        return this.formatMLD(result.mld, modulePath);
      }
    }

    const mld: MLDContent = {
      moduleName: modulePath.split('/').pop() ?? 'module',
      overview: `Mid-level design for ${modulePath}`,
      subComponents: [],
      interfaces: [],
      dataFlow: [],
      errorHandling: [],
    };

    return this.formatMLD(mld, modulePath);
  }

  async generateLLD(
    componentPath: string,
    options?: DocGeneratorOptions,
  ): Promise<GeneratedDoc> {
    const opts = { ...this.defaults, ...options };

    if (this.analyzer) {
      const result = await this.analyzer(componentPath, 'LLD', opts);
      if (result.lld) {
        return this.formatLLD(result.lld, componentPath);
      }
    }

    const lld: LLDContent = {
      componentName: componentPath.split('/').pop() ?? 'component',
      description: `Low-level design for ${componentPath}`,
      signatures: [],
      ioTypes: [],
      algorithms: [],
      edgeCases: [],
    };

    return this.formatLLD(lld, componentPath);
  }

  async generateAll(
    rootPath: string,
    options?: DocGeneratorOptions,
  ): Promise<GeneratedDoc[]> {
    const levels = options?.levels ?? this.defaults.levels ?? ['HLD', 'MLD', 'LLD'];
    const docs: GeneratedDoc[] = [];

    for (const level of levels) {
      switch (level) {
        case 'HLD':
          docs.push(await this.generateHLD(rootPath, options));
          break;
        case 'MLD':
          docs.push(await this.generateMLD(rootPath, options));
          break;
        case 'LLD':
          docs.push(await this.generateLLD(rootPath, options));
          break;
      }
    }

    return docs;
  }

  private formatHLD(hld: HLDContent, sourcePath: string): GeneratedDoc {
    const sections = [
      `# ${hld.systemName} — High-Level Design`,
      '',
      `## Overview`,
      hld.overview,
      '',
    ];

    if (hld.components.length > 0) {
      sections.push(`## Components`);
      for (const comp of hld.components) {
        sections.push(`### ${comp.name}`);
        sections.push(`- Path: \`${comp.path}\``);
        sections.push(`- ${comp.description}`);
        sections.push(`- LOC: ${comp.loc}`);
        sections.push('');
      }
    }

    if (hld.techStack.length > 0) {
      sections.push(`## Technology Stack`);
      for (const tech of hld.techStack) {
        sections.push(`- ${tech}`);
      }
      sections.push('');
    }

    if (hld.decisions.length > 0) {
      sections.push(`## Architecture Decisions`);
      for (const decision of hld.decisions) {
        sections.push(`- ${decision}`);
      }
    }

    return {
      level: 'HLD',
      title: `${hld.systemName} — HLD`,
      content: sections.join('\n'),
      generatedAt: new Date().toISOString(),
      sourceFiles: [sourcePath],
    };
  }

  private formatMLD(mld: MLDContent, sourcePath: string): GeneratedDoc {
    const sections = [
      `# ${mld.moduleName} — Mid-Level Design`,
      '',
      `## Overview`,
      mld.overview,
      '',
    ];

    if (mld.interfaces.length > 0) {
      sections.push(`## Interfaces`);
      for (const iface of mld.interfaces) {
        sections.push(`- ${iface}`);
      }
      sections.push('');
    }

    if (mld.dataFlow.length > 0) {
      sections.push(`## Data Flow`);
      for (const flow of mld.dataFlow) {
        sections.push(`- ${flow}`);
      }
    }

    return {
      level: 'MLD',
      title: `${mld.moduleName} — MLD`,
      content: sections.join('\n'),
      generatedAt: new Date().toISOString(),
      sourceFiles: [sourcePath],
    };
  }

  private formatLLD(lld: LLDContent, sourcePath: string): GeneratedDoc {
    const sections = [
      `# ${lld.componentName} — Low-Level Design`,
      '',
      `## Description`,
      lld.description,
      '',
    ];

    if (lld.signatures.length > 0) {
      sections.push(`## API Signatures`);
      for (const sig of lld.signatures) {
        sections.push(`- \`${sig}\``);
      }
      sections.push('');
    }

    if (lld.edgeCases.length > 0) {
      sections.push(`## Edge Cases`);
      for (const edge of lld.edgeCases) {
        sections.push(`- ${edge}`);
      }
    }

    return {
      level: 'LLD',
      title: `${lld.componentName} — LLD`,
      content: sections.join('\n'),
      generatedAt: new Date().toISOString(),
      sourceFiles: [sourcePath],
    };
  }
}

/**
 * Factory function
 */
export function createDocsGenerator(config?: DocsGeneratorConfig): DocsGenerator {
  return new DocsGenerator(config);
}
