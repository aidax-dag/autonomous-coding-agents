/**
 * Memory Module
 *
 * Provides persistent storage and context management for autonomous agents.
 *
 * @module core/memory
 */

export {
  // Enums
  ProjectStatus,
  TaskStatus,
  ProjectStoreEvent,

  // Interfaces
  type TaskRecord,
  type ProjectCheckpoint,
  type ProjectContext,
  type ProjectState,
  type IProjectStorageAdapter,
  type ProjectStoreConfig,
  type IProjectStore,
  type CreateProjectParams,
  type ProjectFilter,

  // Schemas and Defaults
  ProjectStoreConfigSchema,
  DEFAULT_PROJECT_STORE_CONFIG,

  // Classes
  FileSystemStorageAdapter,
  InMemoryStorageAdapter,
  ProjectStore,

  // Factory
  createProjectStore,
} from './project-store';
