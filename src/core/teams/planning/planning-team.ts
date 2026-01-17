/**
 * Planning Team
 *
 * Strategic planning and task decomposition team.
 * Responsible for breaking down requirements into actionable tasks.
 *
 * Feature: Team System
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TeamType,
  TeamCapability,
  TeamConfig,
  TaskDocument,
  TaskResult,
  TaskArtifact,
  TaskPriority,
  AgentRole,
  TEAM_CAPABILITIES,
} from '../team-types';
import { BaseTeam, createTask, createRole } from '../base-team';

// ============================================================================
// Types
// ============================================================================

/**
 * Planning team configuration
 */
export interface PlanningTeamConfig extends Partial<TeamConfig> {
  /** Maximum subtask depth */
  maxSubtaskDepth: number;
  /** Minimum subtasks per decomposition */
  minSubtasks: number;
  /** Maximum subtasks per decomposition */
  maxSubtasks: number;
  /** Enable effort estimation */
  enableEstimation: boolean;
  /** Enable dependency detection */
  enableDependencyDetection: boolean;
}

/**
 * Decomposition result
 */
export interface DecompositionResult {
  /** Decomposed subtasks */
  subtasks: TaskDocument[];
  /** Execution order (task IDs in order) */
  executionOrder: string[];
  /** Total estimated effort */
  totalEstimatedEffort: number;
  /** Critical path task IDs */
  criticalPath: string[];
  /** Risk factors identified */
  risks: string[];
}

/**
 * PRD (Product Requirements Document) structure
 */
export interface PRDDocument {
  /** Project title */
  title: string;
  /** Project description */
  description: string;
  /** Objectives */
  objectives: string[];
  /** Requirements */
  requirements: RequirementItem[];
  /** Constraints */
  constraints: string[];
  /** Success criteria */
  successCriteria: string[];
  /** Target users */
  targetUsers?: string[];
  /** Technical constraints */
  technicalConstraints?: string[];
}

/**
 * Requirement item
 */
export interface RequirementItem {
  /** Requirement ID */
  id: string;
  /** Requirement title */
  title: string;
  /** Description */
  description: string;
  /** Priority */
  priority: 'must_have' | 'should_have' | 'could_have' | 'wont_have';
  /** Category */
  category: 'functional' | 'non_functional' | 'technical';
  /** Acceptance criteria */
  acceptanceCriteria: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PLANNING_CONFIG: PlanningTeamConfig = {
  maxSubtaskDepth: 3,
  minSubtasks: 2,
  maxSubtasks: 10,
  enableEstimation: true,
  enableDependencyDetection: true,
};

// ============================================================================
// Agent Roles
// ============================================================================

const PLANNER_ROLE: AgentRole = createRole(
  'Strategic Planner',
  'Analyzes requirements and creates high-level plans',
  `You are a Strategic Planner agent. Your role is to:
1. Analyze project requirements and objectives
2. Break down complex goals into manageable phases
3. Identify dependencies between tasks
4. Estimate effort and complexity
5. Create clear acceptance criteria

When decomposing tasks:
- Keep subtasks focused and actionable
- Ensure clear ownership and deliverables
- Consider technical and resource constraints
- Identify risks and mitigation strategies`,
  {
    capabilities: [TeamCapability.TASK_DECOMPOSITION, TeamCapability.ESTIMATION],
    tools: ['read', 'analyze', 'plan'],
  }
);

const ARCHITECT_ROLE: AgentRole = createRole(
  'Technical Architect',
  'Provides technical guidance and architecture decisions',
  `You are a Technical Architect agent. Your role is to:
1. Evaluate technical feasibility of requirements
2. Propose system architecture and design patterns
3. Identify technical dependencies and risks
4. Ensure alignment with best practices
5. Define technical acceptance criteria

Focus on:
- Scalability and maintainability
- Security considerations
- Technology choices
- Integration points`,
  {
    capabilities: [TeamCapability.ARCHITECTURE_ANALYSIS],
    tools: ['read', 'analyze', 'design'],
  }
);

// ============================================================================
// Planning Team
// ============================================================================

/**
 * Planning Team implementation
 *
 * @example
 * ```typescript
 * const planningTeam = new PlanningTeam({
 *   id: 'planning-1',
 *   name: 'Strategic Planning',
 *   maxSubtaskDepth: 3,
 *   enableEstimation: true,
 * });
 *
 * await planningTeam.initialize();
 * await planningTeam.start();
 *
 * // Submit a PRD for decomposition
 * await planningTeam.submitTask(createTask(
 *   'Implement User Authentication',
 *   'Build a complete user authentication system with login, registration, and password reset',
 *   { type: 'prd' }
 * ));
 * ```
 */
export class PlanningTeam extends BaseTeam {
  /** Planning-specific configuration */
  private readonly planningConfig: PlanningTeamConfig;

  constructor(config: PlanningTeamConfig) {
    const fullConfig: TeamConfig = {
      id: config.id || `planning-${uuidv4().slice(0, 8)}`,
      name: config.name || 'Planning Team',
      type: TeamType.PLANNING,
      capabilities: TEAM_CAPABILITIES[TeamType.PLANNING],
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      taskTimeoutMs: config.taskTimeoutMs || 300000,
      autoRetry: config.autoRetry ?? true,
      maxRetries: config.maxRetries ?? 3,
      metadata: config.metadata || {},
      ...config,
    };

    super(fullConfig);
    this.planningConfig = { ...DEFAULT_PLANNING_CONFIG, ...config };
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  protected override async initializeMembers(): Promise<void> {
    // Add planner agent
    this.addMember(PLANNER_ROLE);

    // Add architect agent
    this.addMember(ARCHITECT_ROLE);
  }

  // ============================================================================
  // Task Processing
  // ============================================================================

  protected override async processTask(task: TaskDocument): Promise<TaskResult> {
    const startTime = Date.now();
    this.tokenCounter = 0;

    try {
      let result: DecompositionResult;

      // Determine task type and process accordingly
      switch (task.type) {
        case 'prd':
          result = await this.processPRD(task);
          break;
        case 'requirement':
          result = await this.processRequirement(task);
          break;
        case 'feature':
          result = await this.processFeature(task);
          break;
        default:
          result = await this.decomposeGenericTask(task);
      }

      // Create artifacts
      const artifacts = this.createArtifacts(task, result);

      return {
        taskId: task.id,
        success: true,
        outputs: {
          decomposition: result,
          executionOrder: result.executionOrder,
          estimatedEffort: result.totalEstimatedEffort,
          risks: result.risks,
        },
        subtasks: result.subtasks,
        artifacts,
        duration: Date.now() - startTime,
        tokensUsed: this.tokenCounter,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        outputs: {},
        subtasks: [],
        artifacts: [],
        duration: Date.now() - startTime,
        tokensUsed: this.tokenCounter,
        error: error as Error,
      };
    }
  }

  // ============================================================================
  // Processing Methods
  // ============================================================================

  /**
   * Process a PRD document
   */
  private async processPRD(task: TaskDocument): Promise<DecompositionResult> {
    const prd = task.inputs.prd as PRDDocument | undefined;
    const allSubtasks: TaskDocument[] = [];
    const risks: string[] = [];

    if (prd) {
      // Process each requirement
      for (const requirement of prd.requirements) {
        const reqSubtasks = await this.decomposeRequirement(requirement, task.id);
        allSubtasks.push(...reqSubtasks);
      }

      // Add technical constraints as risks
      if (prd.technicalConstraints) {
        risks.push(...prd.technicalConstraints);
      }
    } else {
      // Decompose from description
      const subtasks = await this.decomposeFromDescription(
        task.title,
        task.description,
        task.id
      );
      allSubtasks.push(...subtasks);
    }

    // Detect dependencies
    if (this.planningConfig.enableDependencyDetection) {
      this.detectDependencies(allSubtasks);
    }

    // Calculate execution order
    const executionOrder = this.calculateExecutionOrder(allSubtasks);

    // Calculate total effort
    const totalEstimatedEffort = allSubtasks.reduce(
      (sum, t) => sum + (t.estimatedEffort || 0),
      0
    );

    // Find critical path
    const criticalPath = this.findCriticalPath(allSubtasks, executionOrder);

    return {
      subtasks: allSubtasks,
      executionOrder,
      totalEstimatedEffort,
      criticalPath,
      risks,
    };
  }

  /**
   * Process a requirement
   */
  private async processRequirement(task: TaskDocument): Promise<DecompositionResult> {
    const requirement = task.inputs.requirement as RequirementItem | undefined;

    let subtasks: TaskDocument[];
    if (requirement) {
      subtasks = await this.decomposeRequirement(requirement, task.id);
    } else {
      subtasks = await this.decomposeFromDescription(task.title, task.description, task.id);
    }

    return this.createDecompositionResult(subtasks);
  }

  /**
   * Process a feature request
   */
  private async processFeature(task: TaskDocument): Promise<DecompositionResult> {
    const subtasks: TaskDocument[] = [];

    // Create design task
    subtasks.push(
      createTask(`Design: ${task.title}`, `Create design and architecture for: ${task.description}`, {
        type: 'design',
        parentId: task.id,
        priority: TaskPriority.HIGH,
        estimatedEffort: this.estimateEffort('design', task.description),
        acceptanceCriteria: ['Design document created', 'Architecture reviewed'],
      })
    );

    // Create implementation task
    subtasks.push(
      createTask(
        `Implement: ${task.title}`,
        `Implement the feature according to design: ${task.description}`,
        {
          type: 'development',
          parentId: task.id,
          priority: TaskPriority.NORMAL,
          estimatedEffort: this.estimateEffort('implementation', task.description),
          acceptanceCriteria: ['Code implemented', 'Unit tests passing'],
          dependencies: [subtasks[0].id],
        }
      )
    );

    // Create testing task
    subtasks.push(
      createTask(`Test: ${task.title}`, `Test the implemented feature: ${task.description}`, {
        type: 'qa',
        parentId: task.id,
        priority: TaskPriority.NORMAL,
        estimatedEffort: this.estimateEffort('testing', task.description),
        acceptanceCriteria: ['All tests passing', 'Coverage > 80%'],
        dependencies: [subtasks[1].id],
      })
    );

    // Create documentation task
    subtasks.push(
      createTask(
        `Document: ${task.title}`,
        `Create documentation for: ${task.description}`,
        {
          type: 'documentation',
          parentId: task.id,
          priority: TaskPriority.LOW,
          estimatedEffort: this.estimateEffort('documentation', task.description),
          acceptanceCriteria: ['Documentation complete', 'Examples provided'],
          dependencies: [subtasks[1].id],
        }
      )
    );

    return this.createDecompositionResult(subtasks);
  }

  /**
   * Decompose a generic task
   */
  private async decomposeGenericTask(task: TaskDocument): Promise<DecompositionResult> {
    const subtasks = await this.decomposeFromDescription(task.title, task.description, task.id);
    return this.createDecompositionResult(subtasks);
  }

  // ============================================================================
  // Decomposition Helpers
  // ============================================================================

  /**
   * Decompose a requirement into tasks
   */
  private async decomposeRequirement(
    requirement: RequirementItem,
    parentId: string
  ): Promise<TaskDocument[]> {
    const subtasks: TaskDocument[] = [];

    // Map priority
    const priority = this.mapPriority(requirement.priority);

    // Determine task types based on category
    const taskTypes = this.determineTaskTypes(requirement.category);

    for (const taskType of taskTypes) {
      subtasks.push(
        createTask(
          `${this.capitalize(taskType)}: ${requirement.title}`,
          requirement.description,
          {
            type: taskType,
            parentId,
            priority,
            estimatedEffort: this.estimateEffort(taskType, requirement.description),
            acceptanceCriteria: requirement.acceptanceCriteria,
            metadata: { requirementId: requirement.id },
          }
        )
      );
    }

    return subtasks;
  }

  /**
   * Decompose from natural language description
   */
  private async decomposeFromDescription(
    title: string,
    description: string,
    parentId: string
  ): Promise<TaskDocument[]> {
    const subtasks: TaskDocument[] = [];
    const content = `${title} ${description}`.toLowerCase();

    // Analysis phase (if complex enough)
    if (content.length > 100) {
      subtasks.push(
        createTask(`Analyze requirements: ${title}`, `Analyze and clarify requirements for: ${description}`, {
          type: 'analysis',
          parentId,
          priority: TaskPriority.HIGH,
          estimatedEffort: 0.5,
        })
      );
    }

    // Design phase (if architectural terms present)
    if (
      content.includes('system') ||
      content.includes('architecture') ||
      content.includes('design')
    ) {
      subtasks.push(
        createTask(`Design: ${title}`, `Create design for: ${description}`, {
          type: 'design',
          parentId,
          priority: TaskPriority.HIGH,
          estimatedEffort: this.estimateEffort('design', description),
          dependencies: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : [],
        })
      );
    }

    // Implementation
    subtasks.push(
      createTask(`Implement: ${title}`, `Implement: ${description}`, {
        type: 'development',
        parentId,
        priority: TaskPriority.NORMAL,
        estimatedEffort: this.estimateEffort('implementation', description),
        dependencies: subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : [],
      })
    );

    // Testing
    subtasks.push(
      createTask(`Test: ${title}`, `Test the implementation: ${description}`, {
        type: 'qa',
        parentId,
        priority: TaskPriority.NORMAL,
        estimatedEffort: this.estimateEffort('testing', description),
        dependencies: [subtasks[subtasks.length - 1].id],
      })
    );

    return subtasks;
  }

  /**
   * Create decomposition result from subtasks
   */
  private createDecompositionResult(subtasks: TaskDocument[]): DecompositionResult {
    if (this.planningConfig.enableDependencyDetection) {
      this.detectDependencies(subtasks);
    }

    const executionOrder = this.calculateExecutionOrder(subtasks);
    const totalEstimatedEffort = subtasks.reduce(
      (sum, t) => sum + (t.estimatedEffort || 0),
      0
    );
    const criticalPath = this.findCriticalPath(subtasks, executionOrder);

    return {
      subtasks,
      executionOrder,
      totalEstimatedEffort,
      criticalPath,
      risks: [],
    };
  }

  /**
   * Detect dependencies between tasks
   */
  private detectDependencies(tasks: TaskDocument[]): void {
    const typeOrder = ['analysis', 'design', 'development', 'qa', 'documentation'];

    for (let i = 0; i < tasks.length; i++) {
      const currentTask = tasks[i];
      const currentTypeIndex = typeOrder.indexOf(currentTask.type);

      for (let j = 0; j < i; j++) {
        const prevTask = tasks[j];
        const prevTypeIndex = typeOrder.indexOf(prevTask.type);

        // Add dependency if previous task is of earlier type
        if (
          prevTypeIndex < currentTypeIndex &&
          prevTask.parentId === currentTask.parentId &&
          !currentTask.dependencies.includes(prevTask.id)
        ) {
          currentTask.dependencies.push(prevTask.id);
        }
      }
    }
  }

  /**
   * Calculate execution order using topological sort
   */
  private calculateExecutionOrder(tasks: TaskDocument[]): string[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (taskId: string): void => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      for (const depId of task.dependencies) {
        visit(depId);
      }

      order.push(taskId);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return order;
  }

  /**
   * Find critical path (longest path through dependencies)
   */
  private findCriticalPath(tasks: TaskDocument[], executionOrder: string[]): string[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const longestPath = new Map<string, { length: number; path: string[] }>();

    for (const taskId of executionOrder) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      let maxDepLength = 0;
      let maxDepPath: string[] = [];

      for (const depId of task.dependencies) {
        const depPath = longestPath.get(depId);
        if (depPath && depPath.length > maxDepLength) {
          maxDepLength = depPath.length;
          maxDepPath = depPath.path;
        }
      }

      longestPath.set(taskId, {
        length: maxDepLength + (task.estimatedEffort || 1),
        path: [...maxDepPath, taskId],
      });
    }

    // Find the path with maximum length
    let criticalPath: string[] = [];
    let maxLength = 0;

    for (const { length, path } of longestPath.values()) {
      if (length > maxLength) {
        maxLength = length;
        criticalPath = path;
      }
    }

    return criticalPath;
  }

  // ============================================================================
  // Estimation
  // ============================================================================

  /**
   * Estimate effort based on task type and description
   */
  private estimateEffort(taskType: string, description: string): number {
    if (!this.planningConfig.enableEstimation) {
      return 0;
    }

    // Base effort by type (in hours)
    const baseEffort: Record<string, number> = {
      analysis: 1,
      design: 2,
      development: 4,
      implementation: 4,
      qa: 2,
      testing: 2,
      documentation: 1,
    };

    let effort = baseEffort[taskType] || 2;

    // Complexity factors from description
    const complexityIndicators = [
      'complex',
      'multiple',
      'integration',
      'security',
      'performance',
      'scalable',
      'distributed',
    ];

    for (const indicator of complexityIndicators) {
      if (description.toLowerCase().includes(indicator)) {
        effort *= 1.2;
      }
    }

    return Math.round(effort * 10) / 10;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Map MoSCoW priority to TaskPriority
   */
  private mapPriority(priority: string): TaskPriority {
    switch (priority) {
      case 'must_have':
        return TaskPriority.CRITICAL;
      case 'should_have':
        return TaskPriority.HIGH;
      case 'could_have':
        return TaskPriority.NORMAL;
      case 'wont_have':
        return TaskPriority.BACKGROUND;
      default:
        return TaskPriority.NORMAL;
    }
  }

  /**
   * Determine task types based on requirement category
   */
  private determineTaskTypes(category: string): string[] {
    switch (category) {
      case 'functional':
        return ['design', 'development', 'qa'];
      case 'non_functional':
        return ['analysis', 'design', 'qa'];
      case 'technical':
        return ['design', 'development'];
      default:
        return ['development', 'qa'];
    }
  }

  /**
   * Create artifacts from decomposition
   */
  private createArtifacts(task: TaskDocument, result: DecompositionResult): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];

    // Create execution plan artifact
    artifacts.push({
      id: uuidv4(),
      type: 'document',
      name: `execution-plan-${task.id}.md`,
      content: this.generateExecutionPlan(task, result),
      mimeType: 'text/markdown',
      createdAt: new Date(),
    });

    return artifacts;
  }

  /**
   * Generate execution plan markdown
   */
  private generateExecutionPlan(task: TaskDocument, result: DecompositionResult): string {
    let plan = `# Execution Plan: ${task.title}\n\n`;
    plan += `## Overview\n${task.description}\n\n`;
    plan += `## Estimated Effort\n${result.totalEstimatedEffort} hours\n\n`;
    plan += `## Tasks (${result.subtasks.length})\n\n`;

    for (let i = 0; i < result.executionOrder.length; i++) {
      const taskId = result.executionOrder[i];
      const subtask = result.subtasks.find((t) => t.id === taskId);
      if (!subtask) continue;

      const isCritical = result.criticalPath.includes(taskId);
      plan += `### ${i + 1}. ${subtask.title}${isCritical ? ' ⚡' : ''}\n`;
      plan += `- **Type:** ${subtask.type}\n`;
      plan += `- **Effort:** ${subtask.estimatedEffort || 'TBD'} hours\n`;
      if (subtask.dependencies.length > 0) {
        plan += `- **Dependencies:** ${subtask.dependencies.length} tasks\n`;
      }
      plan += '\n';
    }

    if (result.risks.length > 0) {
      plan += `## Risks\n`;
      for (const risk of result.risks) {
        plan += `- ${risk}\n`;
      }
      plan += '\n';
    }

    plan += `## Critical Path\n`;
    plan += `The following tasks are on the critical path:\n`;
    for (const taskId of result.criticalPath) {
      const subtask = result.subtasks.find((t) => t.id === taskId);
      if (subtask) {
        plan += `- ${subtask.title}\n`;
      }
    }

    return plan;
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a planning team instance
 */
export function createPlanningTeam(config: Partial<PlanningTeamConfig> = {}): PlanningTeam {
  return new PlanningTeam({ ...DEFAULT_PLANNING_CONFIG, ...config });
}
