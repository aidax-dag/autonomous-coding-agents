/**
 * Task Document Parser Tests
 */

import {
  parseTaskDocument,
  serializeTaskDocument,
  generateTaskFilename,
  extractTaskIdFromFilename,
  parseTaskFiles,
  validateTaskDocument,
  createTaskTemplate,
  TaskDocumentParseError,
  TaskDocumentSerializeError,
} from '../../../../src/core/workspace/task-document-parser';
import { createTask } from '../../../../src/core/workspace/task-document';

// ============================================================================
// Helpers
// ============================================================================

function makeTaskMd(metadata: Record<string, unknown>, content = '# Description') {
  const lines = Object.entries(metadata).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`;
    // Quote datetime strings so js-yaml doesn't parse them as Date objects
    if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v)) return `${k}: "${v}"`;
    return `${k}: ${v}`;
  });
  return `---\n${lines.join('\n')}\n---\n\n${content}`;
}

const validMetadata = {
  id: 'task_abc123',
  title: 'Test Task',
  type: 'feature',
  from: 'orchestrator',
  to: 'development',
  priority: 'medium',
  status: 'pending',
  createdAt: new Date().toISOString(),
};

// ============================================================================
// Error Classes
// ============================================================================

describe('TaskDocumentParseError', () => {
  it('should store filePath and cause', () => {
    const cause = new Error('root');
    const err = new TaskDocumentParseError('msg', '/path', cause);
    expect(err.name).toBe('TaskDocumentParseError');
    expect(err.filePath).toBe('/path');
    expect(err.cause).toBe(cause);
  });
});

describe('TaskDocumentSerializeError', () => {
  it('should store taskId and cause', () => {
    const err = new TaskDocumentSerializeError('msg', 'task_123');
    expect(err.name).toBe('TaskDocumentSerializeError');
    expect(err.taskId).toBe('task_123');
  });
});

// ============================================================================
// parseTaskDocument
// ============================================================================

describe('parseTaskDocument', () => {
  it('should parse valid document', () => {
    const md = makeTaskMd(validMetadata, '# My Task');
    const doc = parseTaskDocument(md);
    expect(doc.metadata.id).toBe('task_abc123');
    expect(doc.metadata.title).toBe('Test Task');
    expect(doc.content).toBe('# My Task');
  });

  it('should throw for missing frontmatter delimiter', () => {
    expect(() => parseTaskDocument('no frontmatter')).toThrow(TaskDocumentParseError);
    expect(() => parseTaskDocument('no frontmatter')).toThrow('delimiter');
  });

  it('should throw for unclosed frontmatter', () => {
    expect(() => parseTaskDocument('---\nid: x\ntitle: y')).toThrow(TaskDocumentParseError);
    expect(() => parseTaskDocument('---\nid: x\ntitle: y')).toThrow('closing');
  });

  it('should throw for invalid metadata', () => {
    const md = '---\nid: x\n---\n\ncontent';
    expect(() => parseTaskDocument(md)).toThrow(TaskDocumentParseError);
  });

  it('should include filePath in error', () => {
    try {
      parseTaskDocument('no frontmatter', '/my/file.md');
      fail('should have thrown');
    } catch (e) {
      expect((e as TaskDocumentParseError).filePath).toBe('/my/file.md');
    }
  });

  it('should handle empty content body', () => {
    const md = makeTaskMd(validMetadata, '');
    const doc = parseTaskDocument(md);
    expect(doc.content).toBe('');
  });
});

// ============================================================================
// serializeTaskDocument
// ============================================================================

describe('serializeTaskDocument', () => {
  it('should serialize and re-parse to same document', () => {
    const task = createTask({
      title: 'Roundtrip Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
      content: '# Task Content',
    });
    const serialized = serializeTaskDocument(task);
    const reparsed = parseTaskDocument(serialized);
    expect(reparsed.metadata.title).toBe('Roundtrip Test');
    expect(reparsed.content).toBe('# Task Content');
  });

  it('should start with frontmatter delimiter', () => {
    const task = createTask({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    const serialized = serializeTaskDocument(task);
    expect(serialized.startsWith('---')).toBe(true);
  });

  it('should throw for invalid document', () => {
    expect(() => serializeTaskDocument({ metadata: {} as any, content: 'x' })).toThrow();
  });
});

// ============================================================================
// generateTaskFilename
// ============================================================================

describe('generateTaskFilename', () => {
  it('should generate filename with priority_type_title_id pattern', () => {
    const task = createTask({
      title: 'Implement Login',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
      priority: 'high',
    });
    const name = generateTaskFilename(task);
    expect(name).toContain('high_feature_implement-login');
    expect(name).toContain(task.metadata.id);
    expect(name.endsWith('.md')).toBe(true);
  });

  it('should sanitize special characters in title', () => {
    const task = createTask({
      title: 'Fix Bug #123: Auth & Login!',
      type: 'bugfix',
      from: 'qa',
      to: 'development',
    });
    const name = generateTaskFilename(task);
    expect(name).not.toContain('#');
    expect(name).not.toContain('&');
    expect(name).not.toContain('!');
  });

  it('should truncate long titles', () => {
    const task = createTask({
      title: 'A'.repeat(100),
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    const name = generateTaskFilename(task);
    // Format: priority_type_sanitizedTitle_taskId.md
    // sanitizedTitle is substring(0, 50) of lowercased+sanitized title
    // Verify the generated filename is reasonable length
    expect(name.length).toBeLessThan(200);
    expect(name).toContain('a'.repeat(50)); // title truncated at 50
  });
});

// ============================================================================
// extractTaskIdFromFilename
// ============================================================================

describe('extractTaskIdFromFilename', () => {
  it('should extract task ID from valid filename', () => {
    const id = extractTaskIdFromFilename('high_feature_login_task_abc123_xyz.md');
    expect(id).toContain('task_');
  });

  it('should return null for filename without task ID', () => {
    expect(extractTaskIdFromFilename('readme.md')).toBeNull();
  });
});

// ============================================================================
// parseTaskFiles
// ============================================================================

describe('parseTaskFiles', () => {
  it('should parse multiple files', () => {
    const md = makeTaskMd(validMetadata);
    const results = parseTaskFiles([
      { path: '/a.md', content: md },
      { path: '/b.md', content: md },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].document.metadata.id).toBe('task_abc123');
  });

  it('should include errors for invalid files', () => {
    const results = parseTaskFiles([
      { path: '/good.md', content: makeTaskMd(validMetadata) },
      { path: '/bad.md', content: 'invalid content' },
    ]);
    expect(results[0].error).toBeUndefined();
    expect(results[1].error).toBeDefined();
  });
});

// ============================================================================
// validateTaskDocument
// ============================================================================

describe('validateTaskDocument', () => {
  it('should return valid for correct document', () => {
    const result = validateTaskDocument(makeTaskMd(validMetadata));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.document).toBeDefined();
  });

  it('should return invalid for bad document', () => {
    const result = validateTaskDocument('not a valid doc');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// createTaskTemplate
// ============================================================================

describe('createTaskTemplate', () => {
  it('should create template with frontmatter', () => {
    const template = createTaskTemplate({
      title: 'New Feature',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    expect(template).toContain('---');
    expect(template).toContain('New Feature');
    expect(template).toContain('## Description');
    expect(template).toContain('## Acceptance Criteria');
  });

  it('should generate task ID if not provided', () => {
    const template = createTaskTemplate({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    expect(template).toContain('task_');
  });

  it('should use provided ID', () => {
    const template = createTaskTemplate({
      id: 'task_custom',
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    } as any);
    expect(template).toContain('task_custom');
  });
});
