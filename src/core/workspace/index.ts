/**
 * Workspace Module
 *
 * Document-based task queue for inter-team communication in Agent OS.
 *
 * Components:
 * - TaskDocument: Schema and utilities for task documents
 * - TaskDocumentParser: Parse/serialize Markdown with YAML frontmatter
 * - WorkspaceManager: File system operations for workspace
 * - DocumentQueue: Publish/subscribe/acknowledge message queue
 *
 * Feature: Document-based Task Queue for Agent OS
 */

// Task Document Schema
export {
  TaskPrioritySchema,
  TaskPriority,
  TaskStatusSchema,
  TaskStatus,
  TeamTypeSchema,
  TeamType,
  TaskTypeSchema,
  TaskType,
  TaskDependencySchema,
  TaskDependency,
  FileReferenceSchema,
  FileReference,
  QualityMetricsSchema,
  QualityMetrics,
  TaskMetadataSchema,
  TaskMetadata,
  TaskDocumentSchema,
  TaskDocument,
  CreateTaskInputSchema,
  CreateTaskInput,
  UpdateTaskInputSchema,
  UpdateTaskInput,
  TaskFilterSchema,
  TaskFilter,
  generateTaskId,
  createTask,
  updateTaskStatus,
  hasUnmetDependencies,
  canRetry,
  incrementRetry,
} from './task-document';

// Task Document Parser
export {
  TaskDocumentParseError,
  TaskDocumentSerializeError,
  parseTaskDocument,
  serializeTaskDocument,
  generateTaskFilename,
  extractTaskIdFromFilename,
  parseTaskFiles,
  validateTaskDocument,
  createTaskTemplate,
} from './task-document-parser';

// Workspace Manager
export {
  WORKSPACE_DIRS,
  WorkspaceConfig,
  WorkspaceFile,
  WorkspaceManager,
} from './workspace-manager';

// Document Queue
export {
  QueueEvents,
  TaskSubscriber,
  SubscriptionOptions,
  DocumentQueue,
} from './document-queue';
