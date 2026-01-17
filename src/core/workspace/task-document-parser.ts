/**
 * Task Document Parser
 *
 * Parses and serializes task documents in Markdown format with YAML frontmatter.
 *
 * Format:
 * ```
 * ---
 * id: task_abc123
 * title: Implement login feature
 * type: feature
 * from: planning
 * to: development
 * priority: high
 * status: pending
 * createdAt: 2024-01-15T10:30:00.000Z
 * ---
 *
 * # Task Description
 *
 * Implement user login functionality...
 * ```
 *
 * Feature: Document-based Task Queue for Agent OS
 */

import * as yaml from 'js-yaml';
import {
  TaskDocument,
  TaskDocumentSchema,
  TaskMetadata,
  TaskMetadataSchema,
} from './task-document';

/**
 * YAML frontmatter delimiter
 */
const FRONTMATTER_DELIMITER = '---';

/**
 * Parse error class
 */
export class TaskDocumentParseError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TaskDocumentParseError';
  }
}

/**
 * Serialize error class
 */
export class TaskDocumentSerializeError extends Error {
  constructor(
    message: string,
    public readonly taskId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TaskDocumentSerializeError';
  }
}

/**
 * Parse YAML frontmatter from Markdown content
 */
function extractFrontmatter(content: string): { frontmatter: string; body: string } {
  const lines = content.split('\n');

  // Check for opening delimiter
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    throw new TaskDocumentParseError('Document does not start with YAML frontmatter delimiter');
  }

  // Find closing delimiter
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === FRONTMATTER_DELIMITER) {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    throw new TaskDocumentParseError('YAML frontmatter closing delimiter not found');
  }

  const frontmatter = lines.slice(1, closingIndex).join('\n');
  const body = lines.slice(closingIndex + 1).join('\n').trim();

  return { frontmatter, body };
}

/**
 * Parse task document from Markdown string
 */
export function parseTaskDocument(content: string, filePath?: string): TaskDocument {
  try {
    // Extract frontmatter and body
    const { frontmatter, body } = extractFrontmatter(content);

    // Parse YAML frontmatter
    const rawMetadata = yaml.load(frontmatter);

    if (!rawMetadata || typeof rawMetadata !== 'object') {
      throw new TaskDocumentParseError('Invalid YAML frontmatter');
    }

    // Validate metadata against schema
    const metadataResult = TaskMetadataSchema.safeParse(rawMetadata);

    if (!metadataResult.success) {
      const errors = metadataResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new TaskDocumentParseError(`Invalid task metadata: ${errors}`);
    }

    // Create and validate complete document
    const document: TaskDocument = {
      metadata: metadataResult.data,
      content: body,
    };

    const documentResult = TaskDocumentSchema.safeParse(document);

    if (!documentResult.success) {
      throw new TaskDocumentParseError(
        `Invalid task document: ${documentResult.error.message}`
      );
    }

    return documentResult.data;
  } catch (error) {
    if (error instanceof TaskDocumentParseError) {
      throw new TaskDocumentParseError(error.message, filePath, error.cause);
    }
    throw new TaskDocumentParseError(
      `Failed to parse task document: ${error instanceof Error ? error.message : String(error)}`,
      filePath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Serialize task document to Markdown string
 */
export function serializeTaskDocument(document: TaskDocument): string {
  try {
    // Validate document
    const result = TaskDocumentSchema.safeParse(document);

    if (!result.success) {
      throw new TaskDocumentSerializeError(
        `Invalid task document: ${result.error.message}`,
        document.metadata?.id
      );
    }

    // Prepare metadata for YAML serialization
    // Remove undefined values to keep YAML clean
    const cleanMetadata = Object.fromEntries(
      Object.entries(result.data.metadata).filter(([_, v]) => v !== undefined)
    );

    // Serialize to YAML
    const yamlContent = yaml.dump(cleanMetadata, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: true,
    });

    // Combine frontmatter and content
    const parts = [
      FRONTMATTER_DELIMITER,
      yamlContent.trim(),
      FRONTMATTER_DELIMITER,
      '',
      result.data.content,
    ];

    return parts.join('\n');
  } catch (error) {
    if (error instanceof TaskDocumentSerializeError) {
      throw error;
    }
    throw new TaskDocumentSerializeError(
      `Failed to serialize task document: ${error instanceof Error ? error.message : String(error)}`,
      document.metadata?.id,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Generate filename for task document
 */
export function generateTaskFilename(document: TaskDocument): string {
  const { id, type, priority } = document.metadata;
  const sanitizedTitle = document.metadata.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  return `${priority}_${type}_${sanitizedTitle}_${id}.md`;
}

/**
 * Extract task ID from filename
 */
export function extractTaskIdFromFilename(filename: string): string | null {
  // Pattern: priority_type_title_taskid.md
  const match = filename.match(/task_[a-z0-9_]+/);
  return match ? match[0] : null;
}

/**
 * Parse multiple task documents from directory listing
 */
export function parseTaskFiles(
  files: Array<{ path: string; content: string }>
): Array<{ document: TaskDocument; path: string; error?: Error }> {
  return files.map(({ path, content }) => {
    try {
      const document = parseTaskDocument(content, path);
      return { document, path };
    } catch (error) {
      return {
        document: null as unknown as TaskDocument,
        path,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  });
}

/**
 * Validate task document content
 */
export function validateTaskDocument(content: string): {
  valid: boolean;
  errors: string[];
  document?: TaskDocument;
} {
  try {
    const document = parseTaskDocument(content);
    return { valid: true, errors: [], document };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { valid: false, errors: [errorMessage] };
  }
}

/**
 * Create template for new task document
 */
export function createTaskTemplate(
  partialMetadata: Partial<TaskMetadata> & { title: string; type: string; from: string; to: string }
): string {
  const now = new Date().toISOString();

  // Spread first, then override with required fields and defaults
  const metadata = {
    ...partialMetadata,
    id: partialMetadata.id || `task_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
    priority: partialMetadata.priority || 'medium',
    status: 'pending',
    createdAt: now,
    dependencies: partialMetadata.dependencies || [],
    files: partialMetadata.files || [],
    retryCount: 0,
    maxRetries: partialMetadata.maxRetries || 3,
    tags: partialMetadata.tags || [],
  };

  const yamlContent = yaml.dump(metadata, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: true,
  });

  return `---
${yamlContent.trim()}
---

# ${partialMetadata.title}

## Description

[Task description here]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Notes

[Additional notes]
`;
}
