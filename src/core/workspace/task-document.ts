/**
 * Task Document Schema
 *
 * Defines the structure for task documents used in inter-team communication.
 * Tasks are stored as Markdown files with YAML frontmatter.
 *
 * Feature: Document-based Task Queue for Agent OS
 */

import { z } from 'zod';

/**
 * Task priority levels
 */
export const TaskPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/**
 * Task status values
 */
export const TaskStatusSchema = z.enum([
  'pending', // Waiting in inbox
  'in_progress', // Being processed
  'blocked', // Waiting for dependency
  'completed', // Successfully finished
  'failed', // Failed to complete
  'cancelled', // Manually cancelled
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Team types that can send/receive tasks
 */
export const TeamTypeSchema = z.enum([
  'orchestrator', // CEO Agent / Main orchestrator
  'planning', // Planning team
  'design', // Design / Architecture team
  'development', // Development team (general)
  'frontend', // Frontend development
  'backend', // Backend development
  'qa', // QA team
  'code-quality', // Code quality team
  'security', // Security analysis team
  'documentation', // Documentation team
  'operations', // Operations / Exploration team
  'testing', // Testing / Integration verification team
  'infrastructure', // Infrastructure team
  'pm', // Project management
  'issue-response', // Issue response / Debugging team
]);
export type TeamType = z.infer<typeof TeamTypeSchema>;

/**
 * Task type classification
 */
export const TaskTypeSchema = z.enum([
  'feature', // New feature implementation
  'bugfix', // Bug fix
  'refactor', // Code refactoring
  'test', // Test creation/modification
  'review', // Code review
  'documentation', // Documentation task
  'infrastructure', // Infrastructure task
  'analysis', // Analysis task
  'planning', // Planning task
  'design', // Design task
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

/**
 * Dependency reference
 */
export const TaskDependencySchema = z.object({
  taskId: z.string(),
  type: z.enum(['blocks', 'blocked_by', 'related']),
  status: TaskStatusSchema.optional(),
});
export type TaskDependency = z.infer<typeof TaskDependencySchema>;

/**
 * File reference in task
 */
export const FileReferenceSchema = z.object({
  path: z.string(),
  action: z.enum(['create', 'modify', 'delete', 'review']),
  description: z.string().optional(),
});
export type FileReference = z.infer<typeof FileReferenceSchema>;

/**
 * Quality metrics for task
 */
export const QualityMetricsSchema = z.object({
  testCoverage: z.number().min(0).max(100).optional(),
  lintScore: z.number().min(0).max(100).optional(),
  complexityScore: z.number().optional(),
  securityScore: z.number().min(0).max(100).optional(),
});
export type QualityMetrics = z.infer<typeof QualityMetricsSchema>;

/**
 * Task metadata (YAML frontmatter)
 */
export const TaskMetadataSchema = z.object({
  // Identity
  id: z.string().min(1),
  title: z.string().min(1),
  type: TaskTypeSchema,

  // Routing
  from: TeamTypeSchema,
  to: TeamTypeSchema,
  priority: TaskPrioritySchema.default('medium'),

  // Status tracking
  status: TaskStatusSchema.default('pending'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),

  // References
  parentTaskId: z.string().optional(),
  projectId: z.string().optional(),
  issueId: z.string().optional(),

  // Dependencies
  dependencies: z.array(TaskDependencySchema).default([]),

  // Files
  files: z.array(FileReferenceSchema).default([]),

  // Quality
  qualityMetrics: QualityMetricsSchema.optional(),

  // Retry handling
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(3),

  // Tags for filtering
  tags: z.array(z.string()).default([]),

  // Arbitrary metadata
  extra: z.record(z.string(), z.unknown()).optional(),
});
export type TaskMetadata = z.infer<typeof TaskMetadataSchema>;

/**
 * Complete task document (metadata + content)
 */
export const TaskDocumentSchema = z.object({
  metadata: TaskMetadataSchema,
  content: z.string(), // Markdown content
});
export type TaskDocument = z.infer<typeof TaskDocumentSchema>;

/**
 * Task creation input (without auto-generated fields)
 * Only title, type, from, and to are required
 */
export const CreateTaskInputSchema = z.object({
  // Required fields
  title: z.string().min(1),
  type: TaskTypeSchema,
  from: TeamTypeSchema,
  to: TeamTypeSchema,

  // Optional fields with defaults
  priority: TaskPrioritySchema.optional().default('medium'),
  dependencies: z.array(TaskDependencySchema).optional().default([]),
  files: z.array(FileReferenceSchema).optional().default([]),
  maxRetries: z.number().int().min(0).optional().default(3),
  tags: z.array(z.string()).optional().default([]),
  content: z.string().optional().default(''),

  // Optional reference fields
  parentTaskId: z.string().optional(),
  projectId: z.string().optional(),
  issueId: z.string().optional(),
  qualityMetrics: QualityMetricsSchema.optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});
// Use z.input for input type to make fields with defaults optional
export type CreateTaskInput = z.input<typeof CreateTaskInputSchema>;

/**
 * Task update input
 */
export const UpdateTaskInputSchema = TaskMetadataSchema.partial().omit({
  id: true,
  createdAt: true,
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

/**
 * Task filter options
 */
export const TaskFilterSchema = z.object({
  status: z.array(TaskStatusSchema).optional(),
  priority: z.array(TaskPrioritySchema).optional(),
  type: z.array(TaskTypeSchema).optional(),
  from: z.array(TeamTypeSchema).optional(),
  to: z.array(TeamTypeSchema).optional(),
  tags: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  parentTaskId: z.string().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});
export type TaskFilter = z.infer<typeof TaskFilterSchema>;

/**
 * Generate a unique task ID
 */
export function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `task_${timestamp}_${random}`;
}

/**
 * Create a new task document
 */
export function createTask(input: CreateTaskInput): TaskDocument {
  const now = new Date().toISOString();

  const metadata: TaskMetadata = {
    id: generateTaskId(),
    title: input.title,
    type: input.type,
    from: input.from,
    to: input.to,
    priority: input.priority || 'medium',
    status: 'pending',
    createdAt: now,
    dependencies: input.dependencies || [],
    files: input.files || [],
    retryCount: 0,
    maxRetries: input.maxRetries || 3,
    tags: input.tags || [],
    parentTaskId: input.parentTaskId,
    projectId: input.projectId,
    issueId: input.issueId,
    qualityMetrics: input.qualityMetrics,
    extra: input.extra,
  };

  return {
    metadata,
    content: input.content || '',
  };
}

/**
 * Update task status with timestamp
 */
export function updateTaskStatus(task: TaskDocument, status: TaskStatus): TaskDocument {
  const now = new Date().toISOString();

  return {
    ...task,
    metadata: {
      ...task.metadata,
      status,
      updatedAt: now,
      completedAt: status === 'completed' || status === 'failed' ? now : task.metadata.completedAt,
    },
  };
}

/**
 * Check if task has unmet dependencies
 */
export function hasUnmetDependencies(task: TaskDocument): boolean {
  return task.metadata.dependencies.some(
    (dep) => dep.type === 'blocked_by' && dep.status !== 'completed'
  );
}

/**
 * Check if task can be retried
 */
export function canRetry(task: TaskDocument): boolean {
  return task.metadata.retryCount < task.metadata.maxRetries;
}

/**
 * Increment retry count
 */
export function incrementRetry(task: TaskDocument): TaskDocument {
  return {
    ...task,
    metadata: {
      ...task.metadata,
      retryCount: task.metadata.retryCount + 1,
      updatedAt: new Date().toISOString(),
    },
  };
}
