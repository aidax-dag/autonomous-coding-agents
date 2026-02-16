/**
 * Agent Fallback Tests
 *
 * Tests structured fallback results for team agents when LLM
 * integration is unavailable, verifying file-based evidence
 * gathering and metadata-rich output.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  createAgentFallback,
  AgentFallbackResult,
} from '@/core/orchestrator/agents/agent-fallback';

describe('Agent Fallback', () => {
  describe('createAgentFallback', () => {
    describe('output structure', () => {
      it('should return all required AgentFallbackResult fields', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        expect(result).toHaveProperty('analysis');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('sourceFiles');
        expect(result).toHaveProperty('limitations');
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('fallbackReason');
      });

      it('should return correct types for all fields', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        expect(typeof result.analysis).toBe('string');
        expect(typeof result.confidence).toBe('number');
        expect(Array.isArray(result.sourceFiles)).toBe(true);
        expect(Array.isArray(result.limitations)).toBe(true);
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(typeof result.fallbackReason).toBe('string');
      });

      it('should set confidence to 0.1', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        expect(result.confidence).toBe(0.1);
      });

      it('should include agent type in analysis', () => {
        const result = createAgentFallback('security', '/nonexistent', 'No LLM configured');

        expect(result.analysis).toContain('security');
      });

      it('should include [Fallback] prefix in analysis', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        expect(result.analysis.startsWith('[Fallback]')).toBe(true);
      });

      it('should include reason in analysis', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        expect(result.analysis).toContain('No LLM configured');
      });

      it('should include static analysis disclaimer', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        expect(result.analysis).toContain('static file-based analysis with no semantic understanding');
      });

      it('should preserve the reason in fallbackReason field', () => {
        const reason = 'Custom reason for fallback';
        const result = createAgentFallback('planning', '/nonexistent', reason);

        expect(result.fallbackReason).toBe(reason);
      });

      it('should not contain extra properties beyond the interface', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');
        const keys = Object.keys(result).sort();

        expect(keys).toEqual([
          'analysis',
          'confidence',
          'fallbackReason',
          'limitations',
          'recommendations',
          'sourceFiles',
        ]);
      });
    });

    describe('sourceFiles', () => {
      let tempDir: string;

      beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-fallback-test-'));
      });

      afterEach(() => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should return empty sourceFiles for nonexistent directory', () => {
        const result = createAgentFallback('planning', '/nonexistent/path', 'No LLM');

        expect(result.sourceFiles).toEqual([]);
      });

      it('should return empty sourceFiles for empty directory', () => {
        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).toEqual([]);
      });

      it('should discover TypeScript files', () => {
        fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const x = 1;');
        fs.writeFileSync(path.join(tempDir, 'utils.ts'), 'export function foo() {}');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).toContain('index.ts');
        expect(result.sourceFiles).toContain('utils.ts');
      });

      it('should discover JavaScript files', () => {
        fs.writeFileSync(path.join(tempDir, 'main.js'), 'module.exports = {};');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).toContain('main.js');
      });

      it('should discover package.json', () => {
        fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).toContain('package.json');
      });

      it('should discover tsconfig.json', () => {
        fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).toContain('tsconfig.json');
      });

      it('should discover JSON and YAML config files', () => {
        fs.writeFileSync(path.join(tempDir, 'config.json'), '{}');
        fs.writeFileSync(path.join(tempDir, 'config.yaml'), 'key: value');
        fs.writeFileSync(path.join(tempDir, 'config.yml'), 'key: value');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).toContain('config.json');
        expect(result.sourceFiles).toContain('config.yaml');
        expect(result.sourceFiles).toContain('config.yml');
      });

      it('should discover files one level deep in subdirectories', () => {
        const subDir = path.join(tempDir, 'src');
        fs.mkdirSync(subDir);
        fs.writeFileSync(path.join(subDir, 'app.ts'), 'export class App {}');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).toContain(path.join('src', 'app.ts'));
      });

      it('should skip hidden directories', () => {
        const hiddenDir = path.join(tempDir, '.git');
        fs.mkdirSync(hiddenDir);
        fs.writeFileSync(path.join(hiddenDir, 'config'), 'git config');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).not.toContain(expect.stringContaining('.git'));
      });

      it('should skip node_modules directory', () => {
        const nmDir = path.join(tempDir, 'node_modules');
        fs.mkdirSync(nmDir);
        fs.writeFileSync(path.join(nmDir, 'index.js'), '');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).not.toContain(expect.stringContaining('node_modules'));
      });

      it('should skip dist directory', () => {
        const distDir = path.join(tempDir, 'dist');
        fs.mkdirSync(distDir);
        fs.writeFileSync(path.join(distDir, 'bundle.js'), '');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).not.toContain(expect.stringContaining('dist'));
      });

      it('should skip non-source file extensions', () => {
        fs.writeFileSync(path.join(tempDir, 'readme.md'), '# Readme');
        fs.writeFileSync(path.join(tempDir, 'image.png'), 'binary');
        fs.writeFileSync(path.join(tempDir, 'data.csv'), 'col1,col2');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.sourceFiles).not.toContain('readme.md');
        expect(result.sourceFiles).not.toContain('image.png');
        expect(result.sourceFiles).not.toContain('data.csv');
      });

      it('should include file count in analysis', () => {
        fs.writeFileSync(path.join(tempDir, 'a.ts'), '');
        fs.writeFileSync(path.join(tempDir, 'b.ts'), '');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.analysis).toContain('2 source file(s)');
      });

      it('should include project path in analysis', () => {
        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.analysis).toContain(tempDir);
      });
    });

    describe('project structure analysis', () => {
      let tempDir: string;

      beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-fallback-structure-'));
      });

      afterEach(() => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should detect file type distribution', () => {
        fs.writeFileSync(path.join(tempDir, 'a.ts'), '');
        fs.writeFileSync(path.join(tempDir, 'b.ts'), '');
        fs.writeFileSync(path.join(tempDir, 'c.js'), '');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.analysis).toContain('.ts');
      });

      it('should detect Node.js project from package.json', () => {
        fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name":"test"}');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.analysis).toContain('Node.js/TypeScript project detected');
      });

      it('should detect TypeScript configuration', () => {
        fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.analysis).toContain('TypeScript configuration present');
      });

      it('should detect top-level directory structure', () => {
        const srcDir = path.join(tempDir, 'src');
        fs.mkdirSync(srcDir);
        fs.writeFileSync(path.join(srcDir, 'index.ts'), '');

        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.analysis).toContain('src');
      });

      it('should provide fallback message for empty project', () => {
        const result = createAgentFallback('planning', tempDir, 'No LLM');

        expect(result.analysis).toContain('No project structure could be determined');
      });
    });

    describe('known agent types', () => {
      it('should return specific limitations for planning agent', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM');

        expect(result.limitations.length).toBe(3);
        expect(result.limitations).toContain('Cannot intelligently decompose goals into sub-tasks');
      });

      it('should return specific recommendations for planning agent', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM');

        expect(result.recommendations.length).toBe(3);
        expect(result.recommendations).toContain('Configure an LLM provider to enable intelligent planning');
      });

      it('should return specific limitations for development agent', () => {
        const result = createAgentFallback('development', '/nonexistent', 'No LLM');

        expect(result.limitations).toContain('Cannot generate or modify code');
      });

      it('should return specific limitations for qa agent', () => {
        const result = createAgentFallback('qa', '/nonexistent', 'No LLM');

        expect(result.limitations).toContain('Cannot generate meaningful test cases');
      });

      it('should return specific limitations for code-quality agent', () => {
        const result = createAgentFallback('code-quality', '/nonexistent', 'No LLM');

        expect(result.limitations).toContain('Cannot perform deep code pattern analysis');
      });

      it('should return specific limitations for architecture agent', () => {
        const result = createAgentFallback('architecture', '/nonexistent', 'No LLM');

        expect(result.limitations).toContain('Cannot perform deep architectural analysis');
      });

      it('should return specific limitations for security agent', () => {
        const result = createAgentFallback('security', '/nonexistent', 'No LLM');

        expect(result.limitations).toContain('Cannot perform deep security vulnerability analysis');
      });

      it('should return specific limitations for debugging agent', () => {
        const result = createAgentFallback('debugging', '/nonexistent', 'No LLM');

        expect(result.limitations).toContain('Cannot perform intelligent root cause analysis');
      });

      it('should return specific limitations for documentation agent', () => {
        const result = createAgentFallback('documentation', '/nonexistent', 'No LLM');

        expect(result.limitations).toContain('Cannot generate meaningful documentation content');
      });

      it('should return specific limitations for exploration agent', () => {
        const result = createAgentFallback('exploration', '/nonexistent', 'No LLM');

        expect(result.limitations).toContain('Cannot perform intelligent codebase analysis');
      });

      it('should return specific limitations for integration agent', () => {
        const result = createAgentFallback('integration', '/nonexistent', 'No LLM');

        expect(result.limitations).toContain('Cannot verify actual component connections');
      });
    });

    describe('unknown agent types', () => {
      it('should return generic limitation for unknown agent type', () => {
        const result = createAgentFallback('unknown-agent', '/nonexistent', 'No LLM');

        expect(result.limitations).toHaveLength(1);
        expect(result.limitations[0]).toContain('unknown-agent');
        expect(result.limitations[0]).toContain('without an LLM executor');
      });

      it('should return generic recommendation for unknown agent type', () => {
        const result = createAgentFallback('unknown-agent', '/nonexistent', 'No LLM');

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]).toContain('unknown-agent');
        expect(result.recommendations[0]).toContain('Configure an LLM executor');
      });
    });

    describe('placeholder string removal', () => {
      it('should not contain placeholder patterns like TODO or PLACEHOLDER', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        expect(result.analysis).not.toMatch(/TODO/i);
        expect(result.analysis).not.toMatch(/PLACEHOLDER/i);
        expect(result.analysis).not.toMatch(/NOT_IMPLEMENTED/i);
      });

      it('should produce substantive analysis text, not stubs', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        // Analysis should be a meaningful sentence, not a one-word stub
        expect(result.analysis.length).toBeGreaterThan(50);
        expect(result.analysis).toContain('agent');
      });

      it('should produce substantive limitations, not empty strings', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        for (const limitation of result.limitations) {
          expect(limitation.length).toBeGreaterThan(10);
          expect(limitation).not.toBe('');
        }
      });

      it('should produce substantive recommendations, not empty strings', () => {
        const result = createAgentFallback('planning', '/nonexistent', 'No LLM configured');

        for (const recommendation of result.recommendations) {
          expect(recommendation.length).toBeGreaterThan(10);
          expect(recommendation).not.toBe('');
        }
      });
    });

    describe('type safety', () => {
      it('should satisfy AgentFallbackResult interface', () => {
        const result: AgentFallbackResult = createAgentFallback(
          'planning',
          '/nonexistent',
          'No LLM',
        );

        expect(result.analysis).toBeDefined();
        expect(result.confidence).toBeDefined();
        expect(result.sourceFiles).toBeDefined();
        expect(result.limitations).toBeDefined();
        expect(result.recommendations).toBeDefined();
        expect(result.fallbackReason).toBeDefined();
      });
    });

    describe('with existing project path', () => {
      let tempDir: string;

      beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-fallback-project-'));

        // Set up a realistic project structure
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
        }));
        fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
          compilerOptions: { target: 'ES2022' },
        }));
        const srcDir = path.join(tempDir, 'src');
        fs.mkdirSync(srcDir);
        fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const main = () => {};');
        fs.writeFileSync(path.join(srcDir, 'config.ts'), 'export const config = {};');
        fs.writeFileSync(path.join(srcDir, 'utils.ts'), 'export function helper() {}');
      });

      afterEach(() => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should discover all source files in a realistic project', () => {
        const result = createAgentFallback('development', tempDir, 'No LLM');

        expect(result.sourceFiles.length).toBeGreaterThanOrEqual(5);
        expect(result.sourceFiles).toContain('package.json');
        expect(result.sourceFiles).toContain('tsconfig.json');
        expect(result.sourceFiles).toContain(path.join('src', 'index.ts'));
        expect(result.sourceFiles).toContain(path.join('src', 'config.ts'));
        expect(result.sourceFiles).toContain(path.join('src', 'utils.ts'));
      });

      it('should produce a rich analysis for a real project', () => {
        const result = createAgentFallback('development', tempDir, 'No LLM');

        expect(result.analysis).toContain('Node.js/TypeScript project detected');
        expect(result.analysis).toContain('TypeScript configuration present');
        expect(result.analysis).toContain('.ts');
        expect(result.analysis).toContain('src');
      });

      it('should report correct file count', () => {
        const result = createAgentFallback('development', tempDir, 'No LLM');

        expect(result.analysis).toContain('5 source file(s)');
      });

      it('should work with different agent types against the same project', () => {
        const planResult = createAgentFallback('planning', tempDir, 'No LLM');
        const secResult = createAgentFallback('security', tempDir, 'No LLM');
        const qaResult = createAgentFallback('qa', tempDir, 'No LLM');

        // All should find the same files
        expect(planResult.sourceFiles).toEqual(secResult.sourceFiles);
        expect(secResult.sourceFiles).toEqual(qaResult.sourceFiles);

        // But have different limitations
        expect(planResult.limitations).not.toEqual(secResult.limitations);
        expect(secResult.limitations).not.toEqual(qaResult.limitations);

        // And different recommendations
        expect(planResult.recommendations).not.toEqual(secResult.recommendations);
      });
    });
  });
});
