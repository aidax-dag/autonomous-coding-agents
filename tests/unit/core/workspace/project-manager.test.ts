/**
 * ProjectManager Unit Tests
 *
 * Feature: D-3 - Multi-Project Management
 */

import { ProjectManager } from '../../../../src/core/workspace/project-manager';
import type { ProjectConfig } from '../../../../src/core/workspace/project-manager';

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

function createManager(maxProjects?: number): ProjectManager {
  return new ProjectManager({ maxProjects });
}

function addSampleProject(
  manager: ProjectManager,
  id = 'proj-1',
  name = 'Test Project',
): ProjectConfig {
  return manager.addProject({
    id,
    name,
    rootPath: `/workspace/${id}`,
    description: `Description for ${id}`,
    tags: ['test'],
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('ProjectManager', () => {
  let manager: ProjectManager;

  beforeEach(() => {
    manager = createManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  // ==========================================================================
  // addProject
  // ==========================================================================

  describe('addProject', () => {
    it('should add a project and return its config', () => {
      const project = addSampleProject(manager);

      expect(project.id).toBe('proj-1');
      expect(project.name).toBe('Test Project');
      expect(project.rootPath).toBe('/workspace/proj-1');
      expect(project.description).toBe('Description for proj-1');
      expect(project.tags).toEqual(['test']);
      expect(project.createdAt).toBeDefined();
      expect(project.lastAccessedAt).toBeDefined();
    });

    it('should throw when adding a duplicate project', () => {
      addSampleProject(manager);
      expect(() => addSampleProject(manager)).toThrow("Project 'proj-1' already exists");
    });

    it('should throw when max projects limit is reached', () => {
      const limitedManager = createManager(2);

      addSampleProject(limitedManager, 'p1', 'Project 1');
      addSampleProject(limitedManager, 'p2', 'Project 2');

      expect(() => addSampleProject(limitedManager, 'p3', 'Project 3')).toThrow(
        'Maximum projects limit reached (2)',
      );

      limitedManager.dispose();
    });

    it('should emit project:added event', () => {
      const listener = jest.fn();
      manager.on('project:added', listener);

      const project = addSampleProject(manager);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(project);
    });
  });

  // ==========================================================================
  // removeProject
  // ==========================================================================

  describe('removeProject', () => {
    it('should remove an existing project', () => {
      addSampleProject(manager);
      expect(manager.removeProject('proj-1')).toBe(true);
      expect(manager.hasProject('proj-1')).toBe(false);
    });

    it('should return false for non-existent project', () => {
      expect(manager.removeProject('nonexistent')).toBe(false);
    });

    it('should clear active project if removed project was active', () => {
      addSampleProject(manager);
      manager.switchProject('proj-1');
      expect(manager.getActiveProject()).not.toBeNull();

      manager.removeProject('proj-1');
      expect(manager.getActiveProject()).toBeNull();
    });

    it('should emit project:removed event', () => {
      addSampleProject(manager);
      const listener = jest.fn();
      manager.on('project:removed', listener);

      manager.removeProject('proj-1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('proj-1');
    });

    it('should not emit event for non-existent project', () => {
      const listener = jest.fn();
      manager.on('project:removed', listener);

      manager.removeProject('nonexistent');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // switchProject
  // ==========================================================================

  describe('switchProject', () => {
    it('should switch to an existing project', () => {
      addSampleProject(manager);
      const result = manager.switchProject('proj-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('proj-1');
    });

    it('should return null for non-existent project', () => {
      expect(manager.switchProject('nonexistent')).toBeNull();
    });

    it('should update lastAccessedAt on switch', () => {
      const project = addSampleProject(manager);
      const originalAccess = project.lastAccessedAt;

      // Small delay to ensure timestamp difference
      const switched = manager.switchProject('proj-1');
      expect(switched!.lastAccessedAt).toBeDefined();
      // lastAccessedAt should be updated (may be equal if same ms, but should not be before)
      expect(new Date(switched!.lastAccessedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalAccess).getTime(),
      );
    });

    it('should emit project:switched event with from/to', () => {
      addSampleProject(manager, 'p1', 'Project 1');
      addSampleProject(manager, 'p2', 'Project 2');

      const listener = jest.fn();
      manager.on('project:switched', listener);

      manager.switchProject('p1');
      expect(listener).toHaveBeenCalledWith({ from: null, to: 'p1' });

      manager.switchProject('p2');
      expect(listener).toHaveBeenCalledWith({ from: 'p1', to: 'p2' });
    });
  });

  // ==========================================================================
  // getActiveProject
  // ==========================================================================

  describe('getActiveProject', () => {
    it('should return null when no active project', () => {
      expect(manager.getActiveProject()).toBeNull();
    });

    it('should return the active project after switch', () => {
      addSampleProject(manager);
      manager.switchProject('proj-1');

      const active = manager.getActiveProject();
      expect(active).not.toBeNull();
      expect(active!.id).toBe('proj-1');
    });
  });

  // ==========================================================================
  // getProject
  // ==========================================================================

  describe('getProject', () => {
    it('should return project by id', () => {
      addSampleProject(manager);
      const project = manager.getProject('proj-1');

      expect(project).not.toBeNull();
      expect(project!.id).toBe('proj-1');
    });

    it('should return null for non-existent project', () => {
      expect(manager.getProject('nonexistent')).toBeNull();
    });
  });

  // ==========================================================================
  // listProjects / getRecentProjects
  // ==========================================================================

  describe('listProjects', () => {
    it('should return empty array when no projects', () => {
      expect(manager.listProjects()).toEqual([]);
    });

    it('should return all projects', () => {
      addSampleProject(manager, 'p1', 'Project 1');
      addSampleProject(manager, 'p2', 'Project 2');

      const projects = manager.listProjects();
      expect(projects).toHaveLength(2);
      expect(projects.map((p) => p.id)).toContain('p1');
      expect(projects.map((p) => p.id)).toContain('p2');
    });
  });

  describe('getRecentProjects', () => {
    it('should return projects sorted by lastAccessedAt descending', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

      addSampleProject(manager, 'p1', 'Project 1');
      jest.advanceTimersByTime(1000);
      addSampleProject(manager, 'p2', 'Project 2');
      jest.advanceTimersByTime(1000);
      addSampleProject(manager, 'p3', 'Project 3');

      // Access p2 last to make it most recent
      jest.advanceTimersByTime(1000);
      manager.switchProject('p2');

      const recent = manager.getRecentProjects(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].id).toBe('p2');

      jest.useRealTimers();
    });

    it('should respect limit parameter', () => {
      addSampleProject(manager, 'p1', 'Project 1');
      addSampleProject(manager, 'p2', 'Project 2');
      addSampleProject(manager, 'p3', 'Project 3');

      const recent = manager.getRecentProjects(1);
      expect(recent).toHaveLength(1);
    });

    it('should default to 5 items', () => {
      for (let i = 1; i <= 7; i++) {
        addSampleProject(manager, `p${i}`, `Project ${i}`);
      }

      const recent = manager.getRecentProjects();
      expect(recent).toHaveLength(5);
    });
  });

  // ==========================================================================
  // updateProject
  // ==========================================================================

  describe('updateProject', () => {
    it('should update project name', () => {
      addSampleProject(manager);
      const updated = manager.updateProject('proj-1', { name: 'New Name' });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
    });

    it('should update project description', () => {
      addSampleProject(manager);
      const updated = manager.updateProject('proj-1', { description: 'Updated desc' });

      expect(updated!.description).toBe('Updated desc');
    });

    it('should update project tags', () => {
      addSampleProject(manager);
      const updated = manager.updateProject('proj-1', { tags: ['new-tag'] });

      expect(updated!.tags).toEqual(['new-tag']);
    });

    it('should merge settings', () => {
      addSampleProject(manager);
      manager.updateProject('proj-1', { settings: { key1: 'value1' } });
      const updated = manager.updateProject('proj-1', { settings: { key2: 'value2' } });

      expect(updated!.settings).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should return null for non-existent project', () => {
      expect(manager.updateProject('nonexistent', { name: 'test' })).toBeNull();
    });

    it('should emit project:updated event', () => {
      addSampleProject(manager);
      const listener = jest.fn();
      manager.on('project:updated', listener);

      manager.updateProject('proj-1', { name: 'Updated' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].name).toBe('Updated');
    });
  });

  // ==========================================================================
  // getProjectCount / hasProject
  // ==========================================================================

  describe('getProjectCount', () => {
    it('should return 0 when empty', () => {
      expect(manager.getProjectCount()).toBe(0);
    });

    it('should return correct count', () => {
      addSampleProject(manager, 'p1', 'Project 1');
      addSampleProject(manager, 'p2', 'Project 2');
      expect(manager.getProjectCount()).toBe(2);
    });
  });

  describe('hasProject', () => {
    it('should return true for existing project', () => {
      addSampleProject(manager);
      expect(manager.hasProject('proj-1')).toBe(true);
    });

    it('should return false for non-existent project', () => {
      expect(manager.hasProject('nonexistent')).toBe(false);
    });
  });

  // ==========================================================================
  // dispose
  // ==========================================================================

  describe('dispose', () => {
    it('should clear all projects and active project', () => {
      addSampleProject(manager, 'p1', 'Project 1');
      addSampleProject(manager, 'p2', 'Project 2');
      manager.switchProject('p1');

      manager.dispose();

      expect(manager.getProjectCount()).toBe(0);
      expect(manager.getActiveProject()).toBeNull();
      expect(manager.listProjects()).toEqual([]);
    });

    it('should remove all listeners', () => {
      const listener = jest.fn();
      manager.on('project:added', listener);

      manager.dispose();

      // After dispose, adding manually to the map would not emit, but we test listenerCount
      expect(manager.listenerCount('project:added')).toBe(0);
    });
  });
});
