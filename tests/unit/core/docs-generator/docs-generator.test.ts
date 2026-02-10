/**
 * Tests for Documentation Generator
 */

import {
  DocsGenerator,
  createDocsGenerator,
  type ContentAnalyzer,
} from '@/core/docs-generator';
import type {
  HLDContent,
  MLDContent,
  LLDContent,
} from '@/core/docs-generator';

describe('DocsGenerator', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const gen = new DocsGenerator();
      expect(gen).toBeInstanceOf(DocsGenerator);
    });

    it('should accept custom defaults', () => {
      const gen = new DocsGenerator({
        defaults: { levels: ['HLD'] },
      });
      expect(gen).toBeInstanceOf(DocsGenerator);
    });
  });

  describe('generateHLD', () => {
    it('should produce stub HLD when no analyzer provided', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateHLD('/project/root');

      expect(doc.level).toBe('HLD');
      expect(doc.title).toContain('root');
      expect(doc.title).toContain('HLD');
      expect(doc.content).toContain('High-Level Design');
      expect(doc.generatedAt).toBeTruthy();
      expect(doc.sourceFiles).toEqual(['/project/root']);
    });

    it('should use custom analyzer when provided', async () => {
      const hld: HLDContent = {
        systemName: 'TestSystem',
        overview: 'Test overview',
        components: [
          {
            name: 'Auth',
            path: '/auth',
            description: 'Authentication module',
            exports: ['login', 'logout'],
            dependencies: ['db'],
            loc: 500,
          },
        ],
        relationships: [
          { source: 'Auth', target: 'DB', type: 'uses' },
        ],
        decisions: ['Use JWT tokens'],
        techStack: ['TypeScript', 'Node.js'],
      };

      const analyzer: ContentAnalyzer = async () => ({ hld });
      const gen = new DocsGenerator({ analyzer });
      const doc = await gen.generateHLD('/project');

      expect(doc.level).toBe('HLD');
      expect(doc.title).toContain('TestSystem');
      expect(doc.content).toContain('Auth');
      expect(doc.content).toContain('JWT tokens');
      expect(doc.content).toContain('TypeScript');
    });

    it('should fall back to stub when analyzer returns no hld', async () => {
      const analyzer: ContentAnalyzer = async () => ({});
      const gen = new DocsGenerator({ analyzer });
      const doc = await gen.generateHLD('/project/my-app');

      expect(doc.level).toBe('HLD');
      expect(doc.title).toContain('my-app');
    });

    it('should format components in HLD content', async () => {
      const hld: HLDContent = {
        systemName: 'Sys',
        overview: 'Overview',
        components: [
          {
            name: 'Core',
            path: '/core',
            description: 'Core module',
            exports: [],
            dependencies: [],
            loc: 1000,
          },
        ],
        relationships: [],
        decisions: [],
        techStack: [],
      };
      const analyzer: ContentAnalyzer = async () => ({ hld });
      const gen = new DocsGenerator({ analyzer });
      const doc = await gen.generateHLD('/project');

      expect(doc.content).toContain('## Components');
      expect(doc.content).toContain('### Core');
      expect(doc.content).toContain('LOC: 1000');
    });
  });

  describe('generateMLD', () => {
    it('should produce stub MLD when no analyzer provided', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateMLD('/project/src/auth');

      expect(doc.level).toBe('MLD');
      expect(doc.title).toContain('auth');
      expect(doc.content).toContain('Mid-Level Design');
      expect(doc.sourceFiles).toEqual(['/project/src/auth']);
    });

    it('should use custom analyzer for MLD', async () => {
      const mld: MLDContent = {
        moduleName: 'AuthModule',
        overview: 'Handles authentication',
        subComponents: [],
        interfaces: ['IAuthService', 'ITokenManager'],
        dataFlow: ['Request → Validate → Token'],
        errorHandling: ['InvalidCredentials → 401'],
      };

      const analyzer: ContentAnalyzer = async () => ({ mld });
      const gen = new DocsGenerator({ analyzer });
      const doc = await gen.generateMLD('/project/auth');

      expect(doc.content).toContain('AuthModule');
      expect(doc.content).toContain('IAuthService');
      expect(doc.content).toContain('Request → Validate → Token');
    });
  });

  describe('generateLLD', () => {
    it('should produce stub LLD when no analyzer provided', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateLLD('/project/src/auth/service.ts');

      expect(doc.level).toBe('LLD');
      expect(doc.title).toContain('service.ts');
      expect(doc.content).toContain('Low-Level Design');
    });

    it('should use custom analyzer for LLD', async () => {
      const lld: LLDContent = {
        componentName: 'AuthService',
        description: 'JWT-based auth service',
        signatures: ['login(email, password): Promise<Token>'],
        ioTypes: ['LoginInput', 'TokenOutput'],
        algorithms: ['bcrypt password hashing'],
        edgeCases: ['Expired token refresh', 'Rate limiting'],
      };

      const analyzer: ContentAnalyzer = async () => ({ lld });
      const gen = new DocsGenerator({ analyzer });
      const doc = await gen.generateLLD('/project/auth/service.ts');

      expect(doc.content).toContain('AuthService');
      expect(doc.content).toContain('login(email, password)');
      expect(doc.content).toContain('Expired token refresh');
    });
  });

  describe('generateAll', () => {
    it('should generate all three levels by default', async () => {
      const gen = new DocsGenerator();
      const docs = await gen.generateAll('/project');

      expect(docs).toHaveLength(3);
      expect(docs[0].level).toBe('HLD');
      expect(docs[1].level).toBe('MLD');
      expect(docs[2].level).toBe('LLD');
    });

    it('should respect levels option', async () => {
      const gen = new DocsGenerator();
      const docs = await gen.generateAll('/project', { levels: ['HLD', 'LLD'] });

      expect(docs).toHaveLength(2);
      expect(docs[0].level).toBe('HLD');
      expect(docs[1].level).toBe('LLD');
    });

    it('should respect constructor defaults for levels', async () => {
      const gen = new DocsGenerator({ defaults: { levels: ['MLD'] } });
      const docs = await gen.generateAll('/project');

      expect(docs).toHaveLength(1);
      expect(docs[0].level).toBe('MLD');
    });

    it('should use analyzer for all levels', async () => {
      const analyzer: ContentAnalyzer = async (_path, level) => {
        if (level === 'HLD') return { hld: { systemName: 'Sys', overview: 'O', components: [], relationships: [], decisions: [], techStack: [] } };
        if (level === 'MLD') return { mld: { moduleName: 'Mod', overview: 'O', subComponents: [], interfaces: [], dataFlow: [], errorHandling: [] } };
        return { lld: { componentName: 'Comp', description: 'D', signatures: [], ioTypes: [], algorithms: [], edgeCases: [] } };
      };

      const gen = new DocsGenerator({ analyzer });
      const docs = await gen.generateAll('/project');

      expect(docs).toHaveLength(3);
      expect(docs[0].content).toContain('Sys');
      expect(docs[1].content).toContain('Mod');
      expect(docs[2].content).toContain('Comp');
    });
  });

  describe('createDocsGenerator', () => {
    it('should create instance via factory', () => {
      const gen = createDocsGenerator();
      expect(gen).toBeInstanceOf(DocsGenerator);
    });

    it('should pass config to constructor', async () => {
      const analyzer: ContentAnalyzer = async () => ({
        hld: { systemName: 'Factory', overview: '', components: [], relationships: [], decisions: [], techStack: [] },
      });
      const gen = createDocsGenerator({ analyzer });
      const doc = await gen.generateHLD('/test');
      expect(doc.content).toContain('Factory');
    });
  });
});
