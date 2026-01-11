/**
 * Task Decomposer Tests
 *
 * Tests for PRD analysis, task decomposition, dependency graph building,
 * and execution planning.
 *
 * @module tests/unit/core/orchestrator/task-decomposer
 */

import {
  TaskDecomposer,
  createTaskDecomposer,
  ComplexityLevel,
  DependencyType,
  DependencyStrength,
  DEFAULT_TASK_DECOMPOSER_CONFIG,
  type PRDAnalysis,
  type TaskTree,
  type DependencyGraph,
} from '../../../../src/core/orchestrator/task-decomposer';
import { TaskPriority, AgentType } from '../../../../src/core/interfaces/agent.interface';

// ============================================================================
// Test Data
// ============================================================================

const SAMPLE_PRD = `
# E-Commerce Platform

Version: 1.0.0

## Overview

This document describes the requirements for building a modern e-commerce platform
that supports product management, user authentication, and order processing.

## Goals

- Create a scalable e-commerce solution
- Support multiple payment providers
- Provide excellent user experience
- Ensure high availability (99.9% uptime)

## Features

### User Authentication

Implement a secure user authentication system with the following capabilities:

- User registration with email verification
- Login with email and password
- Password reset functionality
- OAuth integration (Google, Facebook)
- Two-factor authentication

**Acceptance Criteria:**
- Users can register with valid email
- Password must meet security requirements
- Login sessions expire after 24 hours

**Technical Notes:**
- Use JWT for session management
- Store passwords with bcrypt
- Implement rate limiting

Depends on: Database Setup

### Product Catalog

Build a comprehensive product catalog system:

- Product CRUD operations
- Category management
- Search and filtering
- Image upload and management
- Inventory tracking

**Acceptance Criteria:**
- Products can be created, updated, deleted
- Search returns relevant results within 200ms
- Images are optimized for web

### Shopping Cart

Implement shopping cart functionality:

- Add/remove items
- Update quantities
- Calculate totals
- Apply discount codes

Depends on: Product Catalog, User Authentication

### Order Processing

Handle the complete order lifecycle:

- Order creation
- Payment processing
- Order status tracking
- Email notifications
- Invoice generation

**Acceptance Criteria:**
- Orders are processed within 5 seconds
- Payment failures are handled gracefully

Depends on: Shopping Cart

## Requirements

- Support 10,000 concurrent users
- Page load time under 3 seconds
- Mobile-responsive design
- WCAG 2.1 AA accessibility compliance

## Constraints

- Budget: $500,000
- Timeline: 6 months
- Team size: 5 developers
- Must use TypeScript
`;

const SIMPLE_PRD = `
# Simple Feature

## Overview

A simple feature with minimal requirements.

## Features

### Basic Feature

Just a basic feature.

- Do something simple
- Return a result
`;

// ============================================================================
// Tests
// ============================================================================

describe('TaskDecomposer', () => {
  let decomposer: TaskDecomposer;

  beforeEach(() => {
    decomposer = new TaskDecomposer();
  });

  describe('Factory Function', () => {
    it('should create instance via createTaskDecomposer', () => {
      const instance = createTaskDecomposer();
      expect(instance).toBeInstanceOf(TaskDecomposer);
    });

    it('should accept custom configuration', () => {
      const instance = createTaskDecomposer({
        maxTaskDepth: 3,
        enableParallelization: false,
      });
      expect(instance).toBeDefined();
    });
  });

  describe('analyzePRD', () => {
    it('should extract title from PRD', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      expect(analysis.title).toBe('E-Commerce Platform');
    });

    it('should extract version from PRD', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      expect(analysis.version).toBe('1.0.0');
    });

    it('should extract goals', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      expect(analysis.goals.length).toBeGreaterThan(0);
      expect(analysis.goals).toContain('Create a scalable e-commerce solution');
    });

    it('should extract features', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      expect(analysis.features.length).toBeGreaterThan(0);
    });

    it('should extract global requirements', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      expect(analysis.globalRequirements.length).toBeGreaterThan(0);
    });

    it('should extract constraints', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      expect(analysis.constraints.length).toBeGreaterThan(0);
    });

    it('should include metadata', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      expect(analysis.metadata).toBeDefined();
      expect(analysis.metadata.rawLength).toBe(SAMPLE_PRD.length);
    });

    it('should handle simple PRD', async () => {
      const analysis = await decomposer.analyzePRD(SIMPLE_PRD);
      expect(analysis.title).toBe('Simple Feature');
      expect(analysis.features.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', async () => {
      const analysis1 = await decomposer.analyzePRD(SAMPLE_PRD);
      const analysis2 = await decomposer.analyzePRD(SAMPLE_PRD);
      expect(analysis1.id).not.toBe(analysis2.id);
    });
  });

  describe('Feature Extraction', () => {
    it('should extract feature names', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      const featureNames = analysis.features.map(f => f.name);
      expect(featureNames).toContain('User Authentication');
      expect(featureNames).toContain('Product Catalog');
      expect(featureNames).toContain('Shopping Cart');
      expect(featureNames).toContain('Order Processing');
    });

    it('should extract feature requirements', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      const authFeature = analysis.features.find(f => f.name === 'User Authentication');
      expect(authFeature).toBeDefined();
      expect(authFeature!.requirements.length).toBeGreaterThan(0);
    });

    it('should extract acceptance criteria', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      const authFeature = analysis.features.find(f => f.name === 'User Authentication');
      expect(authFeature).toBeDefined();
      expect(authFeature!.acceptanceCriteria.length).toBeGreaterThan(0);
    });

    it('should extract technical notes', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      const authFeature = analysis.features.find(f => f.name === 'User Authentication');
      expect(authFeature).toBeDefined();
      expect(authFeature!.technicalNotes).toBeDefined();
    });

    it('should infer feature complexity', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      for (const feature of analysis.features) {
        expect(Object.values(ComplexityLevel)).toContain(feature.estimatedComplexity);
      }
    });

    it('should infer feature priority', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      for (const feature of analysis.features) {
        expect(Object.values(TaskPriority)).toContain(feature.priority);
      }
    });
  });

  describe('decompose', () => {
    let analysis: PRDAnalysis;

    beforeEach(async () => {
      analysis = await decomposer.analyzePRD(SAMPLE_PRD);
    });

    it('should create task tree from analysis', async () => {
      const taskTree = await decomposer.decompose(analysis);
      expect(taskTree).toBeDefined();
      expect(taskTree.rootTasks.length).toBeGreaterThan(0);
    });

    it('should map features to tasks', async () => {
      const taskTree = await decomposer.decompose(analysis);
      expect(taskTree.featureToTasks.size).toBe(analysis.features.length);
    });

    it('should calculate total estimated effort', async () => {
      const taskTree = await decomposer.decompose(analysis);
      expect(taskTree.totalEstimatedEffort).toBeGreaterThan(0);
    });

    it('should generate unique task IDs', async () => {
      const taskTree = await decomposer.decompose(analysis);
      const ids = Array.from(taskTree.allTasks.keys());
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should assign agent types to tasks', async () => {
      const taskTree = await decomposer.decompose(analysis);
      for (const task of taskTree.allTasks.values()) {
        expect(Object.values(AgentType)).toContain(task.agentType);
      }
    });

    it('should create subtasks for complex features', async () => {
      const taskTree = await decomposer.decompose(analysis);
      const tasksWithSubtasks = Array.from(taskTree.allTasks.values())
        .filter(t => t.subtasks.length > 0);
      expect(tasksWithSubtasks.length).toBeGreaterThan(0);
    });

    it('should link parent and child tasks', async () => {
      const taskTree = await decomposer.decompose(analysis);
      for (const task of taskTree.allTasks.values()) {
        if (task.parentTaskId) {
          const parent = taskTree.allTasks.get(task.parentTaskId);
          expect(parent).toBeDefined();
          expect(parent!.subtasks).toContain(task.id);
        }
      }
    });
  });

  describe('buildDependencyGraph', () => {
    let taskTree: TaskTree;

    beforeEach(async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      taskTree = await decomposer.decompose(analysis);
    });

    it('should create graph with all tasks as nodes', () => {
      const tasks = Array.from(taskTree.allTasks.values());
      const graph = decomposer.buildDependencyGraph(tasks);
      expect(graph.nodes.size).toBe(tasks.length);
    });

    it('should build edges from parent-child relationships', () => {
      const tasks = Array.from(taskTree.allTasks.values());
      const graph = decomposer.buildDependencyGraph(tasks);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should build adjacency list', () => {
      const tasks = Array.from(taskTree.allTasks.values());
      const graph = decomposer.buildDependencyGraph(tasks);
      expect(graph.adjacencyList.size).toBe(tasks.length);
    });

    it('should build reverse adjacency list', () => {
      const tasks = Array.from(taskTree.allTasks.values());
      const graph = decomposer.buildDependencyGraph(tasks);
      expect(graph.reverseAdjacencyList.size).toBe(tasks.length);
    });

    it('should detect no cycle in valid graph', () => {
      const tasks = Array.from(taskTree.allTasks.values());
      const graph = decomposer.buildDependencyGraph(tasks);
      expect(graph.hasCycle).toBe(false);
    });

    it('should set correct edge types', () => {
      const tasks = Array.from(taskTree.allTasks.values());
      const graph = decomposer.buildDependencyGraph(tasks);
      for (const edge of graph.edges) {
        expect(Object.values(DependencyType)).toContain(edge.type);
        expect(Object.values(DependencyStrength)).toContain(edge.strength);
      }
    });
  });

  describe('getExecutionOrder', () => {
    let graph: DependencyGraph;

    beforeEach(async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      const taskTree = await decomposer.decompose(analysis);
      graph = decomposer.buildDependencyGraph(Array.from(taskTree.allTasks.values()));
    });

    it('should return all tasks in order', () => {
      const order = decomposer.getExecutionOrder(graph);
      expect(order.length).toBe(graph.nodes.size);
    });

    it('should respect dependencies (parents before children)', () => {
      const order = decomposer.getExecutionOrder(graph);
      const orderMap = new Map(order.map((task, index) => [task.id, index]));

      for (const task of order) {
        if (task.parentTaskId) {
          const parentIndex = orderMap.get(task.parentTaskId);
          const taskIndex = orderMap.get(task.id);
          if (parentIndex !== undefined && taskIndex !== undefined) {
            expect(parentIndex).toBeLessThan(taskIndex);
          }
        }
      }
    });

    it('should throw error for cyclic graph', () => {
      // Create a cyclic graph manually
      const cyclicGraph: DependencyGraph = {
        nodes: new Map(),
        edges: [],
        adjacencyList: new Map(),
        reverseAdjacencyList: new Map(),
        hasCycle: true,
        cycleInfo: ['task1', 'task2', 'task1'],
      };

      expect(() => decomposer.getExecutionOrder(cyclicGraph)).toThrow();
    });
  });

  describe('createExecutionPlan', () => {
    let graph: DependencyGraph;

    beforeEach(async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      const taskTree = await decomposer.decompose(analysis);
      graph = decomposer.buildDependencyGraph(Array.from(taskTree.allTasks.values()));
    });

    it('should create execution plan with phases', () => {
      const plan = decomposer.createExecutionPlan(graph);
      expect(plan.phases.length).toBeGreaterThan(0);
    });

    it('should include all tasks across phases', () => {
      const plan = decomposer.createExecutionPlan(graph);
      const tasksInPhases = plan.phases.flatMap(p => p.tasks);
      expect(tasksInPhases.length).toBe(graph.nodes.size);
    });

    it('should calculate total tasks correctly', () => {
      const plan = decomposer.createExecutionPlan(graph);
      expect(plan.totalTasks).toBe(graph.nodes.size);
    });

    it('should estimate duration', () => {
      const plan = decomposer.createExecutionPlan(graph);
      expect(plan.estimatedDuration).toBeGreaterThan(0);
    });

    it('should calculate parallelization factor', () => {
      const plan = decomposer.createExecutionPlan(graph);
      expect(plan.parallelizationFactor).toBeGreaterThanOrEqual(1);
    });

    it('should number phases sequentially', () => {
      const plan = decomposer.createExecutionPlan(graph);
      for (let i = 0; i < plan.phases.length; i++) {
        expect(plan.phases[i].phaseNumber).toBe(i + 1);
      }
    });

    it('should mark phases as parallelizable when appropriate', () => {
      const plan = decomposer.createExecutionPlan(graph);
      for (const phase of plan.phases) {
        if (phase.tasks.length > 1) {
          expect(phase.canParallelize).toBe(true);
        }
      }
    });

    it('should throw error for cyclic graph', () => {
      const cyclicGraph: DependencyGraph = {
        nodes: new Map(),
        edges: [],
        adjacencyList: new Map(),
        reverseAdjacencyList: new Map(),
        hasCycle: true,
        cycleInfo: ['task1', 'task2', 'task1'],
      };

      expect(() => decomposer.createExecutionPlan(cyclicGraph)).toThrow();
    });
  });

  describe('estimateEffort', () => {
    it('should sum up task efforts', async () => {
      const analysis = await decomposer.analyzePRD(SAMPLE_PRD);
      const taskTree = await decomposer.decompose(analysis);
      const tasks = Array.from(taskTree.allTasks.values());

      const totalEffort = decomposer.estimateEffort(tasks);
      const manualSum = tasks.reduce((sum, t) => sum + t.estimatedEffort, 0);

      expect(totalEffort).toBe(manualSum);
    });

    it('should return 0 for empty task list', () => {
      const effort = decomposer.estimateEffort([]);
      expect(effort).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const instance = new TaskDecomposer();
      expect(instance).toBeDefined();
    });

    it('should merge custom configuration with defaults', async () => {
      const customDecomposer = new TaskDecomposer({
        maxTaskDepth: 3,
        enableParallelization: false,
      });

      const analysis = await customDecomposer.analyzePRD(SAMPLE_PRD);
      expect(analysis).toBeDefined();
    });

    it('should respect complexity weights', async () => {
      const customDecomposer = new TaskDecomposer({
        complexityWeights: {
          [ComplexityLevel.TRIVIAL]: 0.25,
          [ComplexityLevel.LOW]: 0.5,
          [ComplexityLevel.MEDIUM]: 1,
          [ComplexityLevel.HIGH]: 2,
          [ComplexityLevel.VERY_HIGH]: 4,
        },
      });

      const analysis = await customDecomposer.analyzePRD(SAMPLE_PRD);
      const taskTree = await customDecomposer.decompose(analysis);

      // Tasks should have effort based on custom weights
      expect(taskTree.totalEstimatedEffort).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty PRD', async () => {
      const analysis = await decomposer.analyzePRD('');
      expect(analysis.title).toBe('Untitled Project');
      expect(analysis.features.length).toBe(0);
    });

    it('should handle PRD with only title', async () => {
      const analysis = await decomposer.analyzePRD('# My Project');
      expect(analysis.title).toBe('My Project');
    });

    it('should handle PRD with no features', async () => {
      const prd = `
# Project Without Features

## Overview
Just an overview.

## Goals
- Some goal
`;
      const analysis = await decomposer.analyzePRD(prd);
      expect(analysis.features.length).toBe(0);
    });

    it('should handle features without requirements', async () => {
      const prd = `
# Project

## Features

### Empty Feature

This feature has no list items.
`;
      const analysis = await decomposer.analyzePRD(prd);
      const taskTree = await decomposer.decompose(analysis);
      expect(taskTree.rootTasks.length).toBeGreaterThan(0);
    });

    it('should handle very long PRD', async () => {
      const longPRD = SAMPLE_PRD.repeat(10);
      const analysis = await decomposer.analyzePRD(longPRD);
      expect(analysis).toBeDefined();
    });
  });

  describe('Defaults', () => {
    it('should have correct default configuration values', () => {
      expect(DEFAULT_TASK_DECOMPOSER_CONFIG.maxTaskDepth).toBe(5);
      expect(DEFAULT_TASK_DECOMPOSER_CONFIG.minTaskGranularity).toBe(1);
      expect(DEFAULT_TASK_DECOMPOSER_CONFIG.maxTaskGranularity).toBe(16);
      expect(DEFAULT_TASK_DECOMPOSER_CONFIG.enableParallelization).toBe(true);
      expect(DEFAULT_TASK_DECOMPOSER_CONFIG.defaultComplexity).toBe(ComplexityLevel.MEDIUM);
    });

    it('should have complexity weights for all levels', () => {
      const weights = DEFAULT_TASK_DECOMPOSER_CONFIG.complexityWeights;
      expect(weights[ComplexityLevel.TRIVIAL]).toBeDefined();
      expect(weights[ComplexityLevel.LOW]).toBeDefined();
      expect(weights[ComplexityLevel.MEDIUM]).toBeDefined();
      expect(weights[ComplexityLevel.HIGH]).toBeDefined();
      expect(weights[ComplexityLevel.VERY_HIGH]).toBeDefined();
    });
  });
});
