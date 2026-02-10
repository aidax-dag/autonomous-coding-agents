/**
 * Tests for Dynamic Prompts — Registry & Renderer
 */

import {
  PromptRegistry,
  createPromptRegistry,
  PromptRenderer,
  createPromptRenderer,
} from '@/core/dynamic-prompts';
import type { PromptTemplate } from '@/core/dynamic-prompts';

function makeTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    id: 'tpl-1',
    name: 'Test Template',
    content: 'Hello {{name}}, your task is {{task}}.',
    requiredVars: ['name', 'task'],
    optionalVars: {},
    category: 'task',
    priority: 10,
    ...overrides,
  };
}

describe('PromptRegistry', () => {
  it('should register and retrieve template', () => {
    const reg = new PromptRegistry();
    const tpl = makeTemplate({ id: 'tpl-1' });

    reg.register(tpl);
    const got = reg.get('tpl-1');

    expect(got?.id).toBe('tpl-1');
    expect(got?.name).toBe('Test Template');
  });

  it('should return undefined for unknown id', () => {
    const reg = new PromptRegistry();
    expect(reg.get('nonexistent')).toBeUndefined();
  });

  it('should find by category sorted by priority', () => {
    const reg = new PromptRegistry();
    reg.register(makeTemplate({ id: 't1', category: 'task', priority: 5 }));
    reg.register(makeTemplate({ id: 't2', category: 'task', priority: 20 }));
    reg.register(makeTemplate({ id: 't3', category: 'system', priority: 100 }));

    const tasks = reg.findByCategory('task');
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('t2'); // Higher priority first
    expect(tasks[1].id).toBe('t1');
  });

  it('should list all template ids', () => {
    const reg = new PromptRegistry();
    reg.register(makeTemplate({ id: 'a' }));
    reg.register(makeTemplate({ id: 'b' }));

    const ids = reg.list();
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });

  it('should remove template', () => {
    const reg = new PromptRegistry();
    reg.register(makeTemplate({ id: 'tpl-1' }));

    expect(reg.remove('tpl-1')).toBe(true);
    expect(reg.get('tpl-1')).toBeUndefined();
    expect(reg.remove('tpl-1')).toBe(false);
  });

  it('should return copies', () => {
    const reg = new PromptRegistry();
    reg.register(makeTemplate({ id: 'x' }));

    const a = reg.get('x');
    const b = reg.get('x');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('should create via factory', () => {
    const reg = createPromptRegistry();
    expect(reg).toBeInstanceOf(PromptRegistry);
  });
});

describe('PromptRenderer', () => {
  function makeSetup() {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({
      id: 'greeting',
      content: 'Hello {{name}}, your task is {{task}}. Style: {{style}}',
      requiredVars: ['name', 'task'],
      optionalVars: { style: 'formal' },
      category: 'task',
      priority: 10,
    }));
    registry.register(makeTemplate({
      id: 'short',
      content: 'Do: {{task}}',
      requiredVars: ['task'],
      optionalVars: {},
      category: 'task',
      priority: 5,
    }));
    registry.register(makeTemplate({
      id: 'sys-prompt',
      content: 'You are a {{role}}.',
      requiredVars: ['role'],
      optionalVars: {},
      category: 'system',
      priority: 20,
    }));
    return { registry };
  }

  describe('render', () => {
    it('should substitute required variables', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry });

      const result = renderer.render('greeting', {
        variables: { name: 'Alice', task: 'write tests' },
      });

      expect(result.content).toContain('Hello Alice');
      expect(result.content).toContain('write tests');
      expect(result.templateId).toBe('greeting');
      expect(result.appliedVars.name).toBe('Alice');
    });

    it('should apply optional variable defaults', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry });

      const result = renderer.render('greeting', {
        variables: { name: 'Bob', task: 'deploy' },
      });

      expect(result.content).toContain('Style: formal');
      expect(result.appliedVars.style).toBe('formal');
    });

    it('should override optional defaults', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry });

      const result = renderer.render('greeting', {
        variables: { name: 'Bob', task: 'deploy', style: 'casual' },
      });

      expect(result.content).toContain('Style: casual');
    });

    it('should throw for missing required variable', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry });

      expect(() =>
        renderer.render('greeting', { variables: { name: 'Alice' } }),
      ).toThrow("Missing required variable 'task'");
    });

    it('should throw for unknown template', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry });

      expect(() =>
        renderer.render('nonexistent', { variables: {} }),
      ).toThrow('Template not found');
    });

    it('should estimate tokens', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry, tokensPerChar: 0.25 });

      const result = renderer.render('short', {
        variables: { task: 'test' },
      });

      // "Do: test" = 8 chars * 0.25 = 2 tokens
      expect(result.estimatedTokens).toBe(2);
    });

    it('should truncate if over token budget', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry, tokensPerChar: 1 });

      const result = renderer.render('greeting', {
        variables: { name: 'Alice', task: 'write a very long description' },
        maxTokens: 10,
      });

      expect(result.content.length).toBeLessThanOrEqual(22); // 10 chars + "[truncated]"
      expect(result.content).toContain('[truncated]');
    });
  });

  describe('selectTemplate', () => {
    it('should select highest priority template', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry });

      const selected = renderer.selectTemplate('task', { variables: {} });
      expect(selected?.id).toBe('greeting'); // priority 10 > 5
    });

    it('should return undefined for empty category', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry });

      const selected = renderer.selectTemplate('review', { variables: {} });
      expect(selected).toBeUndefined();
    });

    it('should filter by token budget', () => {
      const { registry } = makeSetup();
      const renderer = new PromptRenderer({ registry, tokensPerChar: 1 });

      // 'greeting' content is ~56 chars, 'short' is ~13 chars
      const selected = renderer.selectTemplate('task', {
        variables: {},
        maxTokens: 15,
      });

      expect(selected?.id).toBe('short');
    });
  });

  describe('createPromptRenderer', () => {
    it('should create via factory', () => {
      const { registry } = makeSetup();
      const renderer = createPromptRenderer({ registry });
      expect(renderer).toBeInstanceOf(PromptRenderer);
    });
  });
});
