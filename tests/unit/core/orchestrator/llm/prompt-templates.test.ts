/**
 * Prompt Templates Tests
 */

import {
  PlanningPrompts,
  DevelopmentPrompts,
  QAPrompts,
  getPromptForTask,
} from '../../../../../src/core/orchestrator/llm/prompt-templates';

// Mock formatTaskForPrompt since it's imported from team-agent-llm
jest.mock('../../../../../src/core/orchestrator/llm/team-agent-llm', () => ({
  formatTaskForPrompt: jest.fn().mockReturnValue('## Task: Test Task\n\n**Type**: feature'),
}));

// ============================================================================
// PlanningPrompts
// ============================================================================

describe('PlanningPrompts', () => {
  it('should have a system prompt', () => {
    expect(PlanningPrompts.system).toContain('Planning Agent');
    expect(PlanningPrompts.system).toContain('JSON');
  });

  it('should have an analysis system prompt', () => {
    expect(PlanningPrompts.analysisSystem).toContain('analysis');
    expect(PlanningPrompts.analysisSystem).toContain('JSON');
  });

  it('should have a user template function', () => {
    expect(typeof PlanningPrompts.user).toBe('function');
  });

  it('user template should include task and instructions', () => {
    const result = PlanningPrompts.user({ metadata: {}, content: '' } as any);
    expect(result).toContain('Instructions');
    expect(result).toContain('implementation plan');
  });

  it('user template should include project context when provided', () => {
    const result = PlanningPrompts.user(
      { metadata: {}, content: '' } as any,
      'My project uses React',
    );
    expect(result).toContain('Project Context');
    expect(result).toContain('My project uses React');
  });
});

// ============================================================================
// DevelopmentPrompts
// ============================================================================

describe('DevelopmentPrompts', () => {
  it('should have feature system prompt', () => {
    expect(DevelopmentPrompts.featureSystem).toContain('Development Agent');
    expect(DevelopmentPrompts.featureSystem).toContain('filesModified');
  });

  it('should have bugfix system prompt', () => {
    expect(DevelopmentPrompts.bugfixSystem).toContain('bug');
    expect(DevelopmentPrompts.bugfixSystem).toContain('rootCause');
  });

  it('should have refactor system prompt', () => {
    expect(DevelopmentPrompts.refactorSystem).toContain('refactoring');
    expect(DevelopmentPrompts.refactorSystem).toContain('rationale');
  });

  it('feature user template should include instructions', () => {
    const result = DevelopmentPrompts.featureUser({ metadata: {}, content: '' } as any);
    expect(result).toContain('Instructions');
    expect(result).toContain('Implement');
  });

  it('feature user template should include project context', () => {
    const result = DevelopmentPrompts.featureUser(
      { metadata: {}, content: '' } as any,
      'TypeScript project',
    );
    expect(result).toContain('Project Context');
    expect(result).toContain('TypeScript project');
  });
});

// ============================================================================
// QAPrompts
// ============================================================================

describe('QAPrompts', () => {
  it('should have test system prompt', () => {
    expect(QAPrompts.testSystem).toContain('QA Agent');
    expect(QAPrompts.testSystem).toContain('testResults');
  });

  it('should have review system prompt', () => {
    expect(QAPrompts.reviewSystem).toContain('code review');
    expect(QAPrompts.reviewSystem).toContain('reviewFindings');
  });

  it('test user template should include instructions', () => {
    const result = QAPrompts.testUser({ metadata: {}, content: '' } as any);
    expect(result).toContain('Instructions');
    expect(result).toContain('tests');
  });

  it('review user template should include code when provided', () => {
    const result = QAPrompts.reviewUser(
      { metadata: {}, content: '' } as any,
      'function foo() {}',
    );
    expect(result).toContain('Code to Review');
    expect(result).toContain('function foo() {}');
  });

  it('review user template should work without code', () => {
    const result = QAPrompts.reviewUser({ metadata: {}, content: '' } as any);
    expect(result).not.toContain('Code to Review');
    expect(result).toContain('Instructions');
  });
});

// ============================================================================
// getPromptForTask
// ============================================================================

describe('getPromptForTask', () => {
  // Planning team
  it('should return planning prompts for planning team', () => {
    const prompt = getPromptForTask('feature', 'planning');
    expect(prompt.system).toBe(PlanningPrompts.system);
  });

  it('should return analysis prompts for planning + analysis', () => {
    const prompt = getPromptForTask('analysis' as any, 'planning');
    expect(prompt.system).toBe(PlanningPrompts.analysisSystem);
  });

  // Development teams
  it('should return feature prompts for development team', () => {
    const prompt = getPromptForTask('feature', 'development');
    expect(prompt.system).toBe(DevelopmentPrompts.featureSystem);
  });

  it('should return bugfix prompts for development + bugfix', () => {
    const prompt = getPromptForTask('bugfix', 'development');
    expect(prompt.system).toBe(DevelopmentPrompts.bugfixSystem);
  });

  it('should return refactor prompts for development + refactor', () => {
    const prompt = getPromptForTask('refactor', 'development');
    expect(prompt.system).toBe(DevelopmentPrompts.refactorSystem);
  });

  it('should handle frontend team same as development', () => {
    const prompt = getPromptForTask('feature', 'frontend' as any);
    expect(prompt.system).toBe(DevelopmentPrompts.featureSystem);
  });

  it('should handle backend team same as development', () => {
    const prompt = getPromptForTask('bugfix', 'backend' as any);
    expect(prompt.system).toBe(DevelopmentPrompts.bugfixSystem);
  });

  // QA team
  it('should return test prompts for qa team', () => {
    const prompt = getPromptForTask('test', 'qa');
    expect(prompt.system).toBe(QAPrompts.testSystem);
  });

  it('should return review prompts for qa + review', () => {
    const prompt = getPromptForTask('review', 'qa');
    expect(prompt.system).toBe(QAPrompts.reviewSystem);
  });

  it('should handle code-quality team same as qa', () => {
    const prompt = getPromptForTask('test', 'code-quality');
    expect(prompt.system).toBe(QAPrompts.testSystem);
  });

  // Default fallback
  it('should default to planning for unknown team', () => {
    const prompt = getPromptForTask('feature', 'unknown' as any);
    expect(prompt.system).toBe(PlanningPrompts.system);
  });

  // Template functions
  it('should return callable user template', () => {
    const prompt = getPromptForTask('feature', 'development');
    expect(typeof prompt.userTemplate).toBe('function');
    const result = prompt.userTemplate({ metadata: {}, content: '' } as any);
    expect(typeof result).toBe('string');
  });
});
