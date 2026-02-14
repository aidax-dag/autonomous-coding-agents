/**
 * Project Manager
 *
 * Manages multiple projects simultaneously with workspace switching.
 * Provides project lifecycle operations including add, remove, switch,
 * and metadata management.
 *
 * Feature: D-3 - Multi-Project Management
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('Workspace', 'project-manager');

/**
 * Project configuration
 */
export interface ProjectConfig {
  id: string;
  name: string;
  rootPath: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  lastAccessedAt: string;
  settings?: Record<string, unknown>;
}

/**
 * Project manager options
 */
export interface ProjectManagerOptions {
  /** Maximum number of projects allowed (default: 20) */
  maxProjects?: number;
}

/**
 * Project Manager events
 */
export interface ProjectManagerEvents {
  'project:added': (project: ProjectConfig) => void;
  'project:removed': (id: string) => void;
  'project:switched': (info: { from: string | null; to: string }) => void;
  'project:updated': (project: ProjectConfig) => void;
}

/**
 * ProjectManager
 *
 * Manages multiple project configurations with workspace switching.
 * Emits events for lifecycle changes and enforces project limits.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ProjectManager extends EventEmitter {
  private projects: Map<string, ProjectConfig> = new Map();
  private activeProjectId: string | null = null;
  private maxProjects: number;

  constructor(options: ProjectManagerOptions = {}) {
    super();
    this.maxProjects = options.maxProjects ?? 20;
  }

  /**
   * Add a new project
   * @throws Error if max projects reached or project already exists
   */
  addProject(config: Omit<ProjectConfig, 'createdAt' | 'lastAccessedAt'>): ProjectConfig {
    if (this.projects.size >= this.maxProjects) {
      throw new Error(`Maximum projects limit reached (${this.maxProjects})`);
    }
    if (this.projects.has(config.id)) {
      throw new Error(`Project '${config.id}' already exists`);
    }

    const project: ProjectConfig = {
      ...config,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    };

    this.projects.set(config.id, project);
    this.emit('project:added', project);
    logger.info(`Project added: ${config.id} (${config.name})`);
    return project;
  }

  /**
   * Remove a project by id.
   * If the removed project was active, clears the active project.
   */
  removeProject(id: string): boolean {
    if (id === this.activeProjectId) {
      this.activeProjectId = null;
    }

    const removed = this.projects.delete(id);
    if (removed) {
      this.emit('project:removed', id);
      logger.info(`Project removed: ${id}`);
    }
    return removed;
  }

  /**
   * Switch the active project.
   * Updates the lastAccessedAt timestamp.
   * @returns The project config or null if not found
   */
  switchProject(id: string): ProjectConfig | null {
    const project = this.projects.get(id);
    if (!project) return null;

    const previousId = this.activeProjectId;
    this.activeProjectId = id;
    project.lastAccessedAt = new Date().toISOString();

    this.emit('project:switched', { from: previousId, to: id });
    logger.info(`Switched to project: ${id}`);
    return project;
  }

  /**
   * Get the currently active project
   */
  getActiveProject(): ProjectConfig | null {
    if (!this.activeProjectId) return null;
    return this.projects.get(this.activeProjectId) ?? null;
  }

  /**
   * Get a project by id
   */
  getProject(id: string): ProjectConfig | null {
    return this.projects.get(id) ?? null;
  }

  /**
   * List all projects
   */
  listProjects(): ProjectConfig[] {
    return Array.from(this.projects.values());
  }

  /**
   * Get recently accessed projects sorted by lastAccessedAt descending
   */
  getRecentProjects(limit: number = 5): ProjectConfig[] {
    return Array.from(this.projects.values())
      .sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt))
      .slice(0, limit);
  }

  /**
   * Update mutable project fields (name, description, tags, settings)
   */
  updateProject(
    id: string,
    updates: Partial<Pick<ProjectConfig, 'name' | 'description' | 'tags' | 'settings'>>,
  ): ProjectConfig | null {
    const project = this.projects.get(id);
    if (!project) return null;

    if (updates.name !== undefined) project.name = updates.name;
    if (updates.description !== undefined) project.description = updates.description;
    if (updates.tags !== undefined) project.tags = updates.tags;
    if (updates.settings !== undefined) {
      project.settings = { ...project.settings, ...updates.settings };
    }

    this.emit('project:updated', project);
    return project;
  }

  /**
   * Get total project count
   */
  getProjectCount(): number {
    return this.projects.size;
  }

  /**
   * Check if a project exists
   */
  hasProject(id: string): boolean {
    return this.projects.has(id);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.projects.clear();
    this.activeProjectId = null;
    this.removeAllListeners();
  }
}

/**
 * Type-safe event emitter interface
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ProjectManager {
  on<E extends keyof ProjectManagerEvents>(event: E, listener: ProjectManagerEvents[E]): this;
  emit<E extends keyof ProjectManagerEvents>(event: E, ...args: Parameters<ProjectManagerEvents[E]>): boolean;
}
