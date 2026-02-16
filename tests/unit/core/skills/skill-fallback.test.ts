/**
 * Skill Fallback Tests
 *
 * Tests structured fallback results for skills when LLM executors
 * are unavailable, verifying metadata-rich output with limitations
 * and next actions.
 */

import {
  createSkillFallback,
  SkillFallbackResult,
  SkillFallbackReason,
} from '@/core/skills/skill-fallback';

describe('Skill Fallback', () => {
  describe('createSkillFallback', () => {
    describe('output structure', () => {
      it('should return all required SkillFallbackResult fields', () => {
        const result = createSkillFallback('planning', 'no_llm');

        expect(result).toHaveProperty('output');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('limitations');
        expect(result).toHaveProperty('nextActions');
        expect(result).toHaveProperty('fallbackReason');
      });

      it('should return correct types for all fields', () => {
        const result = createSkillFallback('planning', 'no_llm');

        expect(typeof result.output).toBe('string');
        expect(typeof result.confidence).toBe('number');
        expect(Array.isArray(result.limitations)).toBe(true);
        expect(Array.isArray(result.nextActions)).toBe(true);
        expect(typeof result.fallbackReason).toBe('string');
      });

      it('should set confidence to 0.1', () => {
        const result = createSkillFallback('planning', 'no_llm');

        expect(result.confidence).toBe(0.1);
      });

      it('should include skill name in output', () => {
        const result = createSkillFallback('security-scan', 'no_llm');

        expect(result.output).toContain('security-scan');
      });

      it('should include stub data warning in output', () => {
        const result = createSkillFallback('planning', 'no_llm');

        expect(result.output).toContain('stub data with no analytical value');
      });

      it('should include [Fallback] prefix in output', () => {
        const result = createSkillFallback('planning', 'no_llm');

        expect(result.output.startsWith('[Fallback]')).toBe(true);
      });
    });

    describe('reason codes', () => {
      it('should handle no_llm reason', () => {
        const result = createSkillFallback('planning', 'no_llm');

        expect(result.fallbackReason).toBe('no_llm');
        expect(result.output).toContain('No LLM provider is configured');
      });

      it('should handle no_executor reason', () => {
        const result = createSkillFallback('planning', 'no_executor');

        expect(result.fallbackReason).toBe('no_executor');
        expect(result.output).toContain('No executor function was provided');
      });

      it('should handle timeout reason', () => {
        const result = createSkillFallback('planning', 'timeout');

        expect(result.fallbackReason).toBe('timeout');
        expect(result.output).toContain('timed out');
      });

      it('should handle error reason', () => {
        const result = createSkillFallback('planning', 'error');

        expect(result.fallbackReason).toBe('error');
        expect(result.output).toContain('error occurred');
      });

      it('should preserve the exact reason code in fallbackReason', () => {
        const reasons: SkillFallbackReason[] = ['no_llm', 'no_executor', 'timeout', 'error'];

        for (const reason of reasons) {
          const result = createSkillFallback('planning', reason);
          expect(result.fallbackReason).toBe(reason);
        }
      });
    });

    describe('known skill types', () => {
      it('should return specific limitations for planning skill', () => {
        const result = createSkillFallback('planning', 'no_llm');

        expect(result.limitations.length).toBe(3);
        expect(result.limitations).toContain('Cannot perform intelligent task decomposition');
        expect(result.limitations).toContain('Cannot estimate task dependencies accurately');
        expect(result.limitations).toContain('Cannot assess risk or complexity');
      });

      it('should return specific next actions for planning skill', () => {
        const result = createSkillFallback('planning', 'no_llm');

        expect(result.nextActions.length).toBe(3);
        expect(result.nextActions).toContain('Configure an LLM executor for intelligent planning');
      });

      it('should return specific limitations for code-review skill', () => {
        const result = createSkillFallback('code-review', 'no_llm');

        expect(result.limitations).toContain('Cannot analyze code patterns or anti-patterns');
        expect(result.limitations).toContain('Cannot detect security vulnerabilities');
      });

      it('should return specific limitations for security-scan skill', () => {
        const result = createSkillFallback('security-scan', 'no_llm');

        expect(result.limitations).toContain('Cannot perform deep security analysis');
        expect(result.limitations).toContain('Cannot assess OWASP compliance');
      });

      it('should return specific limitations for test-generation skill', () => {
        const result = createSkillFallback('test-generation', 'no_llm');

        expect(result.limitations).toContain('Cannot generate meaningful test logic');
        expect(result.limitations).toContain('Cannot identify edge cases or boundary conditions');
      });

      it('should return specific limitations for git-workflow skill', () => {
        const result = createSkillFallback('git-workflow', 'no_llm');

        expect(result.limitations).toContain('Cannot generate meaningful commit messages');
      });

      it('should return specific limitations for debugging skill', () => {
        const result = createSkillFallback('debugging', 'no_llm');

        expect(result.limitations).toContain('Cannot perform root cause analysis');
      });

      it('should return specific limitations for documentation skill', () => {
        const result = createSkillFallback('documentation', 'no_llm');

        expect(result.limitations).toContain('Cannot generate meaningful documentation content');
      });

      it('should return specific limitations for performance skill', () => {
        const result = createSkillFallback('performance', 'no_llm');

        expect(result.limitations).toContain('Cannot identify performance bottlenecks in code');
      });

      it('should return specific limitations for api-design skill', () => {
        const result = createSkillFallback('api-design', 'no_llm');

        expect(result.limitations).toContain('Cannot generate meaningful API schemas');
      });

      it('should return specific limitations for tdd-workflow skill', () => {
        const result = createSkillFallback('tdd-workflow', 'no_llm');

        expect(result.limitations).toContain('Cannot generate meaningful test cases from requirements');
      });

      it('should return specific limitations for database skill', () => {
        const result = createSkillFallback('database', 'no_llm');

        expect(result.limitations).toContain('Cannot optimize SQL queries');
      });

      it('should return specific limitations for cicd skill', () => {
        const result = createSkillFallback('cicd', 'no_llm');

        expect(result.limitations).toContain('Cannot optimize pipeline configuration');
      });
    });

    describe('unknown skill types', () => {
      it('should return generic limitation for unknown skill', () => {
        const result = createSkillFallback('unknown-skill', 'no_llm');

        expect(result.limitations).toHaveLength(1);
        expect(result.limitations[0]).toContain('unknown-skill');
        expect(result.limitations[0]).toContain('without an LLM executor');
      });

      it('should return generic next action for unknown skill', () => {
        const result = createSkillFallback('unknown-skill', 'no_llm');

        expect(result.nextActions).toHaveLength(1);
        expect(result.nextActions[0]).toContain('unknown-skill');
        expect(result.nextActions[0]).toContain('Configure an LLM executor');
      });
    });

    describe('context parameter', () => {
      it('should not include context info when context is undefined', () => {
        const result = createSkillFallback('planning', 'no_llm');

        expect(result.output).not.toContain('Context:');
      });

      it('should include context info when context is provided', () => {
        const result = createSkillFallback('planning', 'no_llm', {
          goal: 'implement auth',
        });

        expect(result.output).toContain('Context:');
        expect(result.output).toContain('goal');
        expect(result.output).toContain('implement auth');
      });

      it('should serialize multiple context entries', () => {
        const result = createSkillFallback('planning', 'no_llm', {
          goal: 'implement auth',
          priority: 'high',
        });

        expect(result.output).toContain('goal=');
        expect(result.output).toContain('priority=');
      });

      it('should handle context with non-string values', () => {
        const result = createSkillFallback('planning', 'no_llm', {
          retries: 3,
          success: false,
        });

        expect(result.output).toContain('retries=3');
        expect(result.output).toContain('success=false');
      });

      it('should handle empty context object', () => {
        const result = createSkillFallback('planning', 'no_llm', {});

        // Empty context should produce "Context: " with no entries but the prefix is still there
        // Actually, Object.entries({}).map(...).join(', ') returns '', so contextInfo is ' Context: .'
        expect(result.output).toContain('Context:');
      });
    });

    describe('type safety', () => {
      it('should satisfy SkillFallbackResult interface', () => {
        const result: SkillFallbackResult = createSkillFallback('planning', 'no_llm');

        // TypeScript compile-time check; runtime assertion for completeness
        expect(result.output).toBeDefined();
        expect(result.confidence).toBeDefined();
        expect(result.limitations).toBeDefined();
        expect(result.nextActions).toBeDefined();
        expect(result.fallbackReason).toBeDefined();
      });

      it('should not contain extra properties beyond the interface', () => {
        const result = createSkillFallback('planning', 'no_llm');
        const keys = Object.keys(result).sort();

        expect(keys).toEqual([
          'confidence',
          'fallbackReason',
          'limitations',
          'nextActions',
          'output',
        ]);
      });
    });
  });
});
