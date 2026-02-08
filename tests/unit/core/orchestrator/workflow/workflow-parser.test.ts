/**
 * Workflow Parser Tests
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {
  parseWorkflowYaml,
  parseWorkflowFile,
  parseAndValidateWorkflow,
  serializeWorkflowToYaml,
  saveWorkflowToFile,
  loadWorkflowsFromDirectory,
  createWorkflowDefinition,
  WorkflowParseError,
  WorkflowValidationError,
} from '../../../../../src/core/orchestrator/workflow/workflow-parser';

// Mock fs
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock logger
jest.mock('../../../../../src/core/services/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  ILogger: {},
}));

// ============================================================================
// Helpers
// ============================================================================

function minimalStep(id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    name: `Step ${id}`,
    team: 'development',
    type: 'implement',
    content: `Do ${id}`,
    ...overrides,
  };
}

function minimalWorkflowYaml(steps: unknown[], extra?: Record<string, unknown>) {
  return yaml.dump({
    version: '1.0',
    id: 'test-workflow',
    name: 'Test Workflow',
    steps,
    ...extra,
  });
}

// ============================================================================
// Error Classes
// ============================================================================

describe('WorkflowParseError', () => {
  it('should store filePath, line, and column', () => {
    const err = new WorkflowParseError('bad yaml', '/a/b.yaml', 5, 10);
    expect(err.name).toBe('WorkflowParseError');
    expect(err.message).toBe('bad yaml');
    expect(err.filePath).toBe('/a/b.yaml');
    expect(err.line).toBe(5);
    expect(err.column).toBe(10);
  });

  it('should work without optional fields', () => {
    const err = new WorkflowParseError('oops');
    expect(err.filePath).toBeUndefined();
    expect(err.line).toBeUndefined();
  });
});

describe('WorkflowValidationError', () => {
  it('should store error list', () => {
    const err = new WorkflowValidationError('invalid', ['e1', 'e2']);
    expect(err.name).toBe('WorkflowValidationError');
    expect(err.errors).toEqual(['e1', 'e2']);
  });
});

// ============================================================================
// parseWorkflowYaml
// ============================================================================

describe('parseWorkflowYaml', () => {
  it('should parse valid YAML workflow', () => {
    const yamlStr = minimalWorkflowYaml([minimalStep('step1')]);
    const result = parseWorkflowYaml(yamlStr);
    expect(result.id).toBe('test-workflow');
    expect(result.name).toBe('Test Workflow');
    expect(result.steps).toHaveLength(1);
  });

  it('should throw WorkflowParseError for non-object YAML', () => {
    expect(() => parseWorkflowYaml('just a string')).toThrow(WorkflowParseError);
    expect(() => parseWorkflowYaml('just a string')).toThrow('expected object at root');
  });

  it('should throw WorkflowParseError for empty YAML', () => {
    expect(() => parseWorkflowYaml('')).toThrow(WorkflowParseError);
  });

  it('should throw WorkflowParseError for invalid YAML syntax', () => {
    const badYaml = ':\n  - invalid:\n    : broken: [';
    expect(() => parseWorkflowYaml(badYaml)).toThrow(WorkflowParseError);
  });

  it('should throw for schema validation error (missing required fields)', () => {
    const yamlStr = yaml.dump({ version: '1.0', id: 'x' }); // missing name, steps
    expect(() => parseWorkflowYaml(yamlStr)).toThrow();
  });

  it('should parse workflow with parallel steps', () => {
    const yamlStr = minimalWorkflowYaml([
      {
        parallel: true,
        steps: [minimalStep('a'), minimalStep('b')],
      },
    ]);
    const result = parseWorkflowYaml(yamlStr);
    expect(result.steps).toHaveLength(1);
    const group = result.steps[0] as any;
    expect(group.parallel).toBe(true);
    expect(group.steps).toHaveLength(2);
  });

  it('should parse workflow with dependencies', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('step1'),
      minimalStep('step2', { depends_on: ['step1'] }),
    ]);
    const result = parseWorkflowYaml(yamlStr);
    const step2 = result.steps[1] as any;
    expect(step2.depends_on).toEqual(['step1']);
  });

  it('should parse workflow with inputs', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('step1', { outputs: ['result'] }),
      minimalStep('step2', {
        depends_on: ['step1'],
        inputs: {
          data: { from_step: 'step1', field: 'result' },
        },
      }),
    ]);
    const result = parseWorkflowYaml(yamlStr);
    const step2 = result.steps[1] as any;
    expect(step2.inputs.data.from_step).toBe('step1');
  });
});

// ============================================================================
// parseWorkflowFile
// ============================================================================

describe('parseWorkflowFile', () => {
  it('should parse workflow from file', () => {
    const yamlStr = minimalWorkflowYaml([minimalStep('s1')]);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(yamlStr);

    const result = parseWorkflowFile('/path/to/workflow.yaml');
    expect(result.id).toBe('test-workflow');
    expect(mockFs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('workflow.yaml'), 'utf-8');
  });

  it('should throw if file not found', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(() => parseWorkflowFile('/missing.yaml')).toThrow(WorkflowParseError);
    expect(() => parseWorkflowFile('/missing.yaml')).toThrow('not found');
  });

  it('should include filePath in error for parse failures', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('not valid yaml: [');

    try {
      parseWorkflowFile('/bad.yaml');
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(WorkflowParseError);
      expect((e as WorkflowParseError).filePath).toContain('bad.yaml');
    }
  });
});

// ============================================================================
// parseAndValidateWorkflow
// ============================================================================

describe('parseAndValidateWorkflow', () => {
  it('should accept valid workflow from YAML string', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('step1'),
      minimalStep('step2', { depends_on: ['step1'] }),
    ]);
    const { workflow, warnings } = parseAndValidateWorkflow(yamlStr);
    expect(workflow.id).toBe('test-workflow');
    expect(warnings).toEqual([]);
  });

  it('should accept valid workflow from file path', () => {
    const yamlStr = minimalWorkflowYaml([minimalStep('s1')]);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(yamlStr);

    const { workflow } = parseAndValidateWorkflow({ filePath: '/test.yaml' });
    expect(workflow.id).toBe('test-workflow');
  });

  it('should throw WorkflowValidationError for unknown dependency', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('step1', { depends_on: ['nonexistent'] }),
    ]);
    expect(() => parseAndValidateWorkflow(yamlStr)).toThrow(WorkflowValidationError);
  });

  it('should throw for circular dependencies', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('a', { depends_on: ['b'] }),
      minimalStep('b', { depends_on: ['a'] }),
    ]);
    expect(() => parseAndValidateWorkflow(yamlStr)).toThrow(WorkflowValidationError);
  });

  it('should throw for self-dependency', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('a', { depends_on: ['a'] }),
    ]);
    expect(() => parseAndValidateWorkflow(yamlStr)).toThrow(WorkflowValidationError);
  });

  it('should warn about unreachable steps', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('step1'),
      minimalStep('orphan'), // no deps, not referenced, not first
    ]);
    const { warnings } = parseAndValidateWorkflow(yamlStr);
    expect(warnings.some(w => w.includes('orphan'))).toBe(true);
  });

  it('should warn about unused outputs', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('step1', { outputs: ['data'] }),
      minimalStep('step2', { depends_on: ['step1'] }),
    ]);
    const { warnings } = parseAndValidateWorkflow(yamlStr);
    expect(warnings.some(w => w.includes('step1.data'))).toBe(true);
  });

  it('should not warn about used outputs', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('step1', { outputs: ['data'] }),
      minimalStep('step2', {
        depends_on: ['step1'],
        inputs: { x: { from_step: 'step1', field: 'data' } },
      }),
    ]);
    const { warnings } = parseAndValidateWorkflow(yamlStr);
    expect(warnings.filter(w => w.includes('step1.data'))).toHaveLength(0);
  });

  it('should detect output usage via template references', () => {
    const yamlStr = minimalWorkflowYaml([
      minimalStep('step1', { outputs: ['result'] }),
      minimalStep('step2', {
        depends_on: ['step1'],
        inputs: { x: { template: 'Using ${step1.result} here' } },
      }),
    ]);
    const { warnings } = parseAndValidateWorkflow(yamlStr);
    expect(warnings.filter(w => w.includes('step1.result'))).toHaveLength(0);
  });
});

// ============================================================================
// serializeWorkflowToYaml
// ============================================================================

describe('serializeWorkflowToYaml', () => {
  it('should serialize and re-parse to same structure', () => {
    const yamlStr = minimalWorkflowYaml([minimalStep('s1')]);
    const workflow = parseWorkflowYaml(yamlStr);
    const serialized = serializeWorkflowToYaml(workflow);
    const reparsed = parseWorkflowYaml(serialized);
    expect(reparsed.id).toBe(workflow.id);
    expect(reparsed.name).toBe(workflow.name);
  });
});

// ============================================================================
// saveWorkflowToFile
// ============================================================================

describe('saveWorkflowToFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should write YAML to file', () => {
    const yamlStr = minimalWorkflowYaml([minimalStep('s1')]);
    const workflow = parseWorkflowYaml(yamlStr);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});

    saveWorkflowToFile(workflow, '/out/workflow.yaml');
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('workflow.yaml'),
      expect.any(String),
      'utf-8',
    );
  });

  it('should create directory if not exists', () => {
    const yamlStr = minimalWorkflowYaml([minimalStep('s1')]);
    const workflow = parseWorkflowYaml(yamlStr);
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
    mockFs.writeFileSync.mockImplementation(() => {});

    saveWorkflowToFile(workflow, '/new/dir/workflow.yaml');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });
});

// ============================================================================
// loadWorkflowsFromDirectory
// ============================================================================

describe('loadWorkflowsFromDirectory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty map for non-existent directory', () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = loadWorkflowsFromDirectory('/nope');
    expect(result.size).toBe(0);
  });

  it('should load YAML files from directory', () => {
    const yamlStr = minimalWorkflowYaml([minimalStep('s1')]);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(['a.yaml', 'b.yml', 'c.txt'] as any);
    mockFs.readFileSync.mockReturnValue(yamlStr);

    const result = loadWorkflowsFromDirectory('/dir');
    // a.yaml and b.yml loaded (same id, so only 1 in map)
    expect(result.size).toBe(1);
    expect(result.has('test-workflow')).toBe(true);
  });

  it('should skip non-YAML files', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(['readme.md', 'script.js'] as any);

    const result = loadWorkflowsFromDirectory('/dir');
    expect(result.size).toBe(0);
  });

  it('should skip files that fail to parse and continue', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(['good.yaml', 'bad.yaml'] as any);
    const goodYaml = minimalWorkflowYaml([minimalStep('s1')]);
    mockFs.readFileSync
      .mockReturnValueOnce(goodYaml)
      .mockReturnValueOnce('invalid: [broken');

    const result = loadWorkflowsFromDirectory('/dir');
    expect(result.size).toBe(1);
  });
});

// ============================================================================
// createWorkflowDefinition
// ============================================================================

describe('createWorkflowDefinition', () => {
  it('should create valid workflow from parameters', () => {
    const wf = createWorkflowDefinition('my-wf', 'My Workflow', [
      minimalStep('s1') as any,
    ]);
    expect(wf.id).toBe('my-wf');
    expect(wf.name).toBe('My Workflow');
    expect(wf.version).toBe('1.0');
  });

  it('should apply optional overrides', () => {
    const wf = createWorkflowDefinition('wf', 'WF', [minimalStep('s1') as any], {
      description: 'A description',
      timeout_ms: 60000,
    });
    expect(wf.description).toBe('A description');
    expect(wf.timeout_ms).toBe(60000);
  });

  it('should throw for invalid step IDs', () => {
    expect(() =>
      createWorkflowDefinition('wf', 'WF', [
        { ...minimalStep('s1'), id: '123invalid' } as any,
      ]),
    ).toThrow();
  });
});
