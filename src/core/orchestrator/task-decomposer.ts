/**
 * Task Decomposer Module
 *
 * Analyzes PRD documents and decomposes them into executable tasks.
 * Builds dependency graphs and determines optimal execution order.
 *
 * This is a critical component for autonomous product building:
 * PRD → Analysis → Tasks → Dependencies → Execution Order
 *
 * @module core/orchestrator/task-decomposer
 */

import { z } from 'zod';
import { ITask, TaskPriority, AgentType } from '../interfaces/agent.interface';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * PRD Section types
 */
export enum PRDSectionType {
  OVERVIEW = 'overview',
  GOALS = 'goals',
  FEATURES = 'features',
  REQUIREMENTS = 'requirements',
  ACCEPTANCE_CRITERIA = 'acceptance_criteria',
  TECHNICAL_SPEC = 'technical_spec',
  TIMELINE = 'timeline',
  DEPENDENCIES = 'dependencies',
  CONSTRAINTS = 'constraints',
  UNKNOWN = 'unknown',
}

/**
 * Feature extracted from PRD
 */
export interface PRDFeature {
  id: string;
  name: string;
  description: string;
  priority: TaskPriority;
  requirements: string[];
  acceptanceCriteria: string[];
  technicalNotes?: string[];
  estimatedComplexity: ComplexityLevel;
  dependencies: string[]; // Feature IDs
}

/**
 * Complexity level for estimation
 */
export enum ComplexityLevel {
  TRIVIAL = 'trivial',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

/**
 * PRD Analysis result
 */
export interface PRDAnalysis {
  id: string;
  title: string;
  version: string;
  analyzedAt: Date;
  overview: string;
  goals: string[];
  features: PRDFeature[];
  globalRequirements: string[];
  constraints: string[];
  metadata: Record<string, unknown>;
}

/**
 * Decomposed task with metadata
 */
export interface DecomposedTask extends ITask {
  name: string;
  description: string;
  featureId: string;
  parentTaskId?: string;
  subtasks: string[];
  estimatedEffort: number; // in hours
  complexity: ComplexityLevel;
  acceptanceCriteria: string[];
  technicalDetails?: string;
}

/**
 * Task tree structure
 */
export interface TaskTree {
  rootTasks: DecomposedTask[];
  allTasks: Map<string, DecomposedTask>;
  featureToTasks: Map<string, string[]>;
  totalEstimatedEffort: number;
  criticalPath: string[];
}

/**
 * Dependency edge in the graph
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: DependencyType;
  strength: DependencyStrength;
}

/**
 * Dependency types
 */
export enum DependencyType {
  FINISH_TO_START = 'finish_to_start', // Task B starts after Task A finishes
  START_TO_START = 'start_to_start',   // Task B starts when Task A starts
  FINISH_TO_FINISH = 'finish_to_finish', // Task B finishes when Task A finishes
  BLOCKING = 'blocking',                // Task B is completely blocked by Task A
}

/**
 * Dependency strength
 */
export enum DependencyStrength {
  HARD = 'hard',     // Must be respected
  SOFT = 'soft',     // Preferred but can be violated
  OPTIONAL = 'optional', // Nice to have
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  nodes: Map<string, DecomposedTask>;
  edges: DependencyEdge[];
  adjacencyList: Map<string, string[]>;
  reverseAdjacencyList: Map<string, string[]>;
  hasCycle: boolean;
  cycleInfo?: string[];
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
  phases: ExecutionPhase[];
  totalTasks: number;
  estimatedDuration: number;
  parallelizationFactor: number;
}

/**
 * Execution phase (group of parallelizable tasks)
 */
export interface ExecutionPhase {
  phaseNumber: number;
  tasks: DecomposedTask[];
  canParallelize: boolean;
  estimatedDuration: number;
  dependencies: string[]; // Previous phases that must complete
}

/**
 * Task decomposer configuration
 */
export interface TaskDecomposerConfig {
  maxTaskDepth: number;
  minTaskGranularity: number; // in hours
  maxTaskGranularity: number; // in hours
  enableParallelization: boolean;
  defaultComplexity: ComplexityLevel;
  complexityWeights: Record<ComplexityLevel, number>;
}

// ============================================================================
// Schemas
// ============================================================================

export const TaskDecomposerConfigSchema = z.object({
  maxTaskDepth: z.number().int().min(1).max(10).default(5),
  minTaskGranularity: z.number().min(0.5).max(4).default(1),
  maxTaskGranularity: z.number().min(4).max(40).default(16),
  enableParallelization: z.boolean().default(true),
  defaultComplexity: z.nativeEnum(ComplexityLevel).default(ComplexityLevel.MEDIUM),
  complexityWeights: z.record(z.nativeEnum(ComplexityLevel), z.number()).default({
    [ComplexityLevel.TRIVIAL]: 0.5,
    [ComplexityLevel.LOW]: 1,
    [ComplexityLevel.MEDIUM]: 2,
    [ComplexityLevel.HIGH]: 4,
    [ComplexityLevel.VERY_HIGH]: 8,
  }),
});

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_TASK_DECOMPOSER_CONFIG: TaskDecomposerConfig = {
  maxTaskDepth: 5,
  minTaskGranularity: 1,
  maxTaskGranularity: 16,
  enableParallelization: true,
  defaultComplexity: ComplexityLevel.MEDIUM,
  complexityWeights: {
    [ComplexityLevel.TRIVIAL]: 0.5,
    [ComplexityLevel.LOW]: 1,
    [ComplexityLevel.MEDIUM]: 2,
    [ComplexityLevel.HIGH]: 4,
    [ComplexityLevel.VERY_HIGH]: 8,
  },
};

// ============================================================================
// Task Decomposer Interface
// ============================================================================

/**
 * Task decomposer interface
 */
export interface ITaskDecomposer {
  /**
   * Analyze a PRD document
   */
  analyzePRD(prd: string): Promise<PRDAnalysis>;

  /**
   * Decompose PRD analysis into tasks
   */
  decompose(analysis: PRDAnalysis): Promise<TaskTree>;

  /**
   * Build dependency graph from tasks
   */
  buildDependencyGraph(tasks: DecomposedTask[]): DependencyGraph;

  /**
   * Get optimal execution order
   */
  getExecutionOrder(graph: DependencyGraph): DecomposedTask[];

  /**
   * Create execution plan with phases
   */
  createExecutionPlan(graph: DependencyGraph): ExecutionPlan;

  /**
   * Estimate total effort
   */
  estimateEffort(tasks: DecomposedTask[]): number;
}

// ============================================================================
// Task Decomposer Implementation
// ============================================================================

/**
 * Task decomposer implementation
 */
export class TaskDecomposer implements ITaskDecomposer {
  private readonly config: TaskDecomposerConfig;
  private taskIdCounter = 0;

  constructor(config?: Partial<TaskDecomposerConfig>) {
    this.config = {
      ...DEFAULT_TASK_DECOMPOSER_CONFIG,
      ...config,
    };
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${++this.taskIdCounter}`;
  }

  /**
   * Generate unique feature ID
   */
  private generateFeatureId(): string {
    return `feature_${Date.now()}_${++this.taskIdCounter}`;
  }

  /**
   * Analyze PRD document
   */
  async analyzePRD(prd: string): Promise<PRDAnalysis> {
    const sections = this.parseSections(prd);
    const features = this.extractFeatures(sections);
    const goals = this.extractGoals(sections);
    const requirements = this.extractRequirements(sections);
    const constraints = this.extractConstraints(sections);

    return {
      id: `prd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      title: this.extractTitle(prd),
      version: this.extractVersion(prd) || '1.0.0',
      analyzedAt: new Date(),
      overview: sections.get(PRDSectionType.OVERVIEW) || '',
      goals,
      features,
      globalRequirements: requirements,
      constraints,
      metadata: {
        rawLength: prd.length,
        sectionCount: sections.size,
        featureCount: features.length,
      },
    };
  }

  /**
   * Parse PRD into sections
   */
  private parseSections(prd: string): Map<PRDSectionType, string> {
    const sections = new Map<PRDSectionType, string>();
    const lines = prd.split('\n');

    let currentSection: PRDSectionType = PRDSectionType.OVERVIEW;
    let currentContent: string[] = [];

    for (const line of lines) {
      const sectionType = this.detectSectionType(line);

      if (sectionType !== PRDSectionType.UNKNOWN) {
        // Save previous section
        if (currentContent.length > 0) {
          sections.set(currentSection, currentContent.join('\n').trim());
        }
        currentSection = sectionType;
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentContent.length > 0) {
      sections.set(currentSection, currentContent.join('\n').trim());
    }

    return sections;
  }

  /**
   * Detect section type from header line
   */
  private detectSectionType(line: string): PRDSectionType {
    const lowerLine = line.toLowerCase().trim();

    // Only detect top-level sections (## headers), not subsections (### or more)
    // This allows ### Feature 1 to be parsed as content within ## Features section
    if (!lowerLine.startsWith('## ') && !lowerLine.startsWith('# ')) {
      // Also check for # Title (single #)
      if (lowerLine.startsWith('#') && !lowerLine.startsWith('##')) {
        // Single # is title, not a section
        return PRDSectionType.UNKNOWN;
      }
      return PRDSectionType.UNKNOWN;
    }

    // Skip subsections (### and deeper)
    if (lowerLine.startsWith('###')) {
      return PRDSectionType.UNKNOWN;
    }

    if (lowerLine.includes('overview') || lowerLine.includes('introduction') || lowerLine.includes('summary')) {
      return PRDSectionType.OVERVIEW;
    }
    if (lowerLine.includes('goal') || lowerLine.includes('objective')) {
      return PRDSectionType.GOALS;
    }
    if (lowerLine.includes('feature')) {
      return PRDSectionType.FEATURES;
    }
    if (lowerLine.includes('requirement') && !lowerLine.includes('acceptance')) {
      return PRDSectionType.REQUIREMENTS;
    }
    if (lowerLine.includes('acceptance') || lowerLine.includes('criteria')) {
      return PRDSectionType.ACCEPTANCE_CRITERIA;
    }
    if (lowerLine.includes('technical') || lowerLine.includes('spec') || lowerLine.includes('architecture')) {
      return PRDSectionType.TECHNICAL_SPEC;
    }
    if (lowerLine.includes('timeline') || lowerLine.includes('schedule') || lowerLine.includes('milestone')) {
      return PRDSectionType.TIMELINE;
    }
    if (lowerLine.includes('dependenc')) {
      return PRDSectionType.DEPENDENCIES;
    }
    if (lowerLine.includes('constraint') || lowerLine.includes('limitation')) {
      return PRDSectionType.CONSTRAINTS;
    }

    return PRDSectionType.UNKNOWN;
  }

  /**
   * Extract title from PRD
   */
  private extractTitle(prd: string): string {
    const lines = prd.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return trimmed.substring(2).trim();
      }
    }
    return 'Untitled Project';
  }

  /**
   * Extract version from PRD
   */
  private extractVersion(prd: string): string | null {
    const versionMatch = prd.match(/version[:\s]+([0-9]+\.[0-9]+\.[0-9]+)/i);
    return versionMatch ? versionMatch[1] : null;
  }

  /**
   * Extract goals from sections
   */
  private extractGoals(sections: Map<PRDSectionType, string>): string[] {
    const goalsContent = sections.get(PRDSectionType.GOALS) || '';
    return this.extractListItems(goalsContent);
  }

  /**
   * Extract requirements from sections
   */
  private extractRequirements(sections: Map<PRDSectionType, string>): string[] {
    const reqContent = sections.get(PRDSectionType.REQUIREMENTS) || '';
    return this.extractListItems(reqContent);
  }

  /**
   * Extract constraints from sections
   */
  private extractConstraints(sections: Map<PRDSectionType, string>): string[] {
    const constraintContent = sections.get(PRDSectionType.CONSTRAINTS) || '';
    return this.extractListItems(constraintContent);
  }

  /**
   * Extract list items from content
   */
  private extractListItems(content: string): string[] {
    const items: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Match markdown list items (-, *, or numbered)
      const match = trimmed.match(/^[-*]|\d+\./);
      if (match) {
        const item = trimmed.replace(/^[-*]\s*|\d+\.\s*/, '').trim();
        if (item) {
          items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * Extract features from sections
   */
  private extractFeatures(sections: Map<PRDSectionType, string>): PRDFeature[] {
    const featuresContent = sections.get(PRDSectionType.FEATURES) || '';
    const features: PRDFeature[] = [];

    // Parse feature blocks
    const featureBlocks = this.parseFeatureBlocks(featuresContent);

    for (const block of featureBlocks) {
      features.push({
        id: this.generateFeatureId(),
        name: block.name,
        description: block.description,
        priority: this.inferPriority(block.description),
        requirements: block.requirements,
        acceptanceCriteria: block.acceptanceCriteria,
        technicalNotes: block.technicalNotes,
        estimatedComplexity: this.inferComplexity(block),
        dependencies: block.dependencies,
      });
    }

    return features;
  }

  /**
   * Parse feature blocks from content
   */
  private parseFeatureBlocks(content: string): Array<{
    name: string;
    description: string;
    requirements: string[];
    acceptanceCriteria: string[];
    technicalNotes: string[];
    dependencies: string[];
  }> {
    const blocks: Array<{
      name: string;
      description: string;
      requirements: string[];
      acceptanceCriteria: string[];
      technicalNotes: string[];
      dependencies: string[];
    }> = [];

    // Split by subheadings (### for features under ## Features section)
    const sections = content.split(/(?=^###\s)/m);

    for (const section of sections) {
      if (!section.trim()) continue;

      const lines = section.split('\n');
      const nameLine = lines[0]?.trim() || '';
      const name = nameLine.replace(/^#+\s*/, '').trim();

      if (!name) continue;

      const description = lines.slice(1).join('\n').trim();
      const requirements = this.extractListItems(description);
      const acceptanceCriteria = this.extractAcceptanceCriteria(description);
      const technicalNotes = this.extractTechnicalNotes(description);
      const dependencies = this.extractDependencyReferences(description);

      blocks.push({
        name,
        description,
        requirements,
        acceptanceCriteria,
        technicalNotes,
        dependencies,
      });
    }

    return blocks;
  }

  /**
   * Extract acceptance criteria from description
   */
  private extractAcceptanceCriteria(description: string): string[] {
    const criteria: string[] = [];
    const lines = description.split('\n');
    let inACSection = false;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('acceptance') || lower.includes('criteria')) {
        inACSection = true;
        continue;
      }
      if (inACSection && line.trim().startsWith('#')) {
        inACSection = false;
        continue;
      }
      if (inACSection) {
        const item = line.replace(/^[-*]\s*|\d+\.\s*/, '').trim();
        if (item) {
          criteria.push(item);
        }
      }
    }

    return criteria;
  }

  /**
   * Extract technical notes from description
   */
  private extractTechnicalNotes(description: string): string[] {
    const notes: string[] = [];
    const lines = description.split('\n');
    let inTechSection = false;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('technical') || lower.includes('implementation')) {
        inTechSection = true;
        continue;
      }
      if (inTechSection && line.trim().startsWith('#')) {
        inTechSection = false;
        continue;
      }
      if (inTechSection) {
        const item = line.replace(/^[-*]\s*|\d+\.\s*/, '').trim();
        if (item) {
          notes.push(item);
        }
      }
    }

    return notes;
  }

  /**
   * Extract dependency references from description
   */
  private extractDependencyReferences(description: string): string[] {
    const deps: string[] = [];

    // Look for "depends on", "requires", "after" patterns
    const patterns = [
      /depends\s+on\s+["']?([^"'\n]+)["']?/gi,
      /requires\s+["']?([^"'\n]+)["']?/gi,
      /after\s+["']?([^"'\n]+)["']?/gi,
      /blocked\s+by\s+["']?([^"'\n]+)["']?/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(description)) !== null) {
        deps.push(match[1].trim());
      }
    }

    return deps;
  }

  /**
   * Infer priority from text
   */
  private inferPriority(text: string): TaskPriority {
    const lower = text.toLowerCase();

    if (lower.includes('critical') || lower.includes('urgent') || lower.includes('must have') || lower.includes('p0')) {
      return TaskPriority.CRITICAL;
    }
    if (lower.includes('high') || lower.includes('important') || lower.includes('p1')) {
      return TaskPriority.HIGH;
    }
    if (lower.includes('low') || lower.includes('nice to have') || lower.includes('p3')) {
      return TaskPriority.LOW;
    }

    return TaskPriority.NORMAL;
  }

  /**
   * Infer complexity from feature block
   */
  private inferComplexity(block: {
    name: string;
    description: string;
    requirements: string[];
    acceptanceCriteria: string[];
    technicalNotes: string[];
    dependencies: string[];
  }): ComplexityLevel {
    let score = 0;

    // Requirements count
    score += block.requirements.length * 0.5;

    // Acceptance criteria count
    score += block.acceptanceCriteria.length * 0.3;

    // Dependencies count
    score += block.dependencies.length * 1;

    // Technical notes indicate complexity
    score += block.technicalNotes.length * 0.5;

    // Description length
    score += block.description.length / 500;

    // Keyword analysis
    const text = block.description.toLowerCase();
    if (text.includes('complex') || text.includes('advanced')) score += 2;
    if (text.includes('simple') || text.includes('basic')) score -= 1;
    if (text.includes('integration') || text.includes('api')) score += 1;
    if (text.includes('database') || text.includes('migration')) score += 1.5;
    if (text.includes('security') || text.includes('authentication')) score += 1.5;
    if (text.includes('performance') || text.includes('optimization')) score += 1;

    // Map score to complexity
    if (score <= 1) return ComplexityLevel.TRIVIAL;
    if (score <= 3) return ComplexityLevel.LOW;
    if (score <= 6) return ComplexityLevel.MEDIUM;
    if (score <= 10) return ComplexityLevel.HIGH;
    return ComplexityLevel.VERY_HIGH;
  }

  /**
   * Decompose PRD analysis into task tree
   */
  async decompose(analysis: PRDAnalysis): Promise<TaskTree> {
    const allTasks = new Map<string, DecomposedTask>();
    const featureToTasks = new Map<string, string[]>();
    const rootTasks: DecomposedTask[] = [];

    // Create tasks for each feature
    for (const feature of analysis.features) {
      const featureTasks = this.decomposeFeature(feature, analysis);
      featureToTasks.set(feature.id, featureTasks.map(t => t.id));

      for (const task of featureTasks) {
        allTasks.set(task.id, task);
        if (!task.parentTaskId) {
          rootTasks.push(task);
        }
      }
    }

    // Calculate total effort
    const totalEstimatedEffort = this.estimateEffort(Array.from(allTasks.values()));

    // Calculate critical path
    const graph = this.buildDependencyGraph(Array.from(allTasks.values()));
    const criticalPath = this.calculateCriticalPath(graph);

    return {
      rootTasks,
      allTasks,
      featureToTasks,
      totalEstimatedEffort,
      criticalPath,
    };
  }

  /**
   * Decompose a single feature into tasks
   */
  private decomposeFeature(feature: PRDFeature, _analysis: PRDAnalysis): DecomposedTask[] {
    const tasks: DecomposedTask[] = [];

    // Create main feature task
    const mainTask = this.createTask({
      featureId: feature.id,
      name: `Implement: ${feature.name}`,
      description: feature.description,
      priority: feature.priority,
      complexity: feature.estimatedComplexity,
      acceptanceCriteria: feature.acceptanceCriteria,
    });

    tasks.push(mainTask);

    // Create subtasks based on requirements
    const subtasks = this.createSubtasksFromRequirements(feature, mainTask.id);
    mainTask.subtasks = subtasks.map(t => t.id);
    tasks.push(...subtasks);

    return tasks;
  }

  /**
   * Create subtasks from feature requirements
   */
  private createSubtasksFromRequirements(feature: PRDFeature, parentId: string): DecomposedTask[] {
    const subtasks: DecomposedTask[] = [];

    for (const requirement of feature.requirements) {
      // Determine task type based on requirement content
      const agentType = this.inferAgentType(requirement);
      const complexity = this.inferRequirementComplexity(requirement);

      const subtask = this.createTask({
        featureId: feature.id,
        parentTaskId: parentId,
        name: this.generateTaskName(requirement),
        description: requirement,
        priority: feature.priority,
        complexity,
        agentType,
        acceptanceCriteria: [],
      });

      subtasks.push(subtask);
    }

    return subtasks;
  }

  /**
   * Create a decomposed task
   */
  private createTask(params: {
    featureId: string;
    parentTaskId?: string;
    name: string;
    description: string;
    priority: TaskPriority;
    complexity: ComplexityLevel;
    agentType?: AgentType;
    acceptanceCriteria: string[];
    technicalDetails?: string;
  }): DecomposedTask {
    const effort = this.config.complexityWeights[params.complexity] || 2;

    return {
      id: this.generateTaskId(),
      type: 'decomposed-task',
      featureId: params.featureId,
      parentTaskId: params.parentTaskId,
      name: params.name,
      description: params.description,
      priority: params.priority,
      agentType: params.agentType || AgentType.CODER,
      payload: { featureId: params.featureId },
      metadata: {},
      createdAt: new Date(),
      subtasks: [],
      estimatedEffort: effort,
      complexity: params.complexity,
      acceptanceCriteria: params.acceptanceCriteria,
      technicalDetails: params.technicalDetails,
    };
  }

  /**
   * Infer agent type from requirement text
   */
  private inferAgentType(requirement: string): AgentType {
    const lower = requirement.toLowerCase();

    if (lower.includes('test') || lower.includes('spec') || lower.includes('verify')) {
      return AgentType.TESTER;
    }
    if (lower.includes('review') || lower.includes('audit') || lower.includes('check')) {
      return AgentType.REVIEWER;
    }
    if (lower.includes('design') || lower.includes('architect') || lower.includes('structure')) {
      return AgentType.ARCHITECT;
    }
    if (lower.includes('document') || lower.includes('readme') || lower.includes('doc')) {
      return AgentType.DOC_WRITER;
    }

    return AgentType.CODER;
  }

  /**
   * Infer complexity from requirement text
   */
  private inferRequirementComplexity(requirement: string): ComplexityLevel {
    const lower = requirement.toLowerCase();
    const wordCount = requirement.split(/\s+/).length;

    let score = wordCount / 10;

    if (lower.includes('complex') || lower.includes('advanced')) score += 2;
    if (lower.includes('simple') || lower.includes('basic')) score -= 1;
    if (lower.includes('integrate') || lower.includes('connect')) score += 1;
    if (lower.includes('multiple') || lower.includes('many')) score += 1;
    if (lower.includes('security') || lower.includes('auth')) score += 1.5;

    if (score <= 0.5) return ComplexityLevel.TRIVIAL;
    if (score <= 1.5) return ComplexityLevel.LOW;
    if (score <= 3) return ComplexityLevel.MEDIUM;
    if (score <= 5) return ComplexityLevel.HIGH;
    return ComplexityLevel.VERY_HIGH;
  }

  /**
   * Generate a concise task name from requirement
   */
  private generateTaskName(requirement: string): string {
    // Take first 50 characters or first sentence
    const firstSentence = requirement.split(/[.!?]/)[0] || requirement;
    if (firstSentence.length <= 50) {
      return firstSentence.trim();
    }
    return firstSentence.substring(0, 47).trim() + '...';
  }

  /**
   * Build dependency graph from tasks
   */
  buildDependencyGraph(tasks: DecomposedTask[]): DependencyGraph {
    const nodes = new Map<string, DecomposedTask>();
    const edges: DependencyEdge[] = [];
    const adjacencyList = new Map<string, string[]>();
    const reverseAdjacencyList = new Map<string, string[]>();

    // Add all nodes
    for (const task of tasks) {
      nodes.set(task.id, task);
      adjacencyList.set(task.id, []);
      reverseAdjacencyList.set(task.id, []);
    }

    // Build edges from parent-child relationships
    for (const task of tasks) {
      if (task.parentTaskId && nodes.has(task.parentTaskId)) {
        edges.push({
          from: task.parentTaskId,
          to: task.id,
          type: DependencyType.FINISH_TO_START,
          strength: DependencyStrength.HARD,
        });

        adjacencyList.get(task.parentTaskId)?.push(task.id);
        reverseAdjacencyList.get(task.id)?.push(task.parentTaskId);
      }
    }

    // Build edges from feature dependencies
    // (This would require cross-referencing features, simplified here)

    // Check for cycles
    const { hasCycle, cycleInfo } = this.detectCycle(adjacencyList, nodes);

    return {
      nodes,
      edges,
      adjacencyList,
      reverseAdjacencyList,
      hasCycle,
      cycleInfo,
    };
  }

  /**
   * Detect cycles in the dependency graph
   */
  private detectCycle(
    adjacencyList: Map<string, string[]>,
    nodes: Map<string, DecomposedTask>
  ): { hasCycle: boolean; cycleInfo?: string[] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cyclePath: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            cyclePath.push(nodeId);
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          cyclePath.push(neighbor);
          cyclePath.push(nodeId);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) {
          return { hasCycle: true, cycleInfo: cyclePath.reverse() };
        }
      }
    }

    return { hasCycle: false };
  }

  /**
   * Get execution order using topological sort
   */
  getExecutionOrder(graph: DependencyGraph): DecomposedTask[] {
    if (graph.hasCycle) {
      throw new Error(`Cannot determine execution order: cycle detected - ${graph.cycleInfo?.join(' -> ')}`);
    }

    const result: DecomposedTask[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (nodeId: string) => {
      if (temp.has(nodeId)) {
        throw new Error('Cycle detected during topological sort');
      }
      if (visited.has(nodeId)) {
        return;
      }

      temp.add(nodeId);

      const deps = graph.reverseAdjacencyList.get(nodeId) || [];
      for (const dep of deps) {
        visit(dep);
      }

      temp.delete(nodeId);
      visited.add(nodeId);

      const task = graph.nodes.get(nodeId);
      if (task) {
        result.push(task);
      }
    };

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    return result;
  }

  /**
   * Calculate critical path (longest path through the graph)
   */
  private calculateCriticalPath(graph: DependencyGraph): string[] {
    if (graph.hasCycle) {
      return [];
    }

    const distances = new Map<string, number>();
    const predecessors = new Map<string, string | null>();

    // Initialize
    for (const nodeId of graph.nodes.keys()) {
      distances.set(nodeId, 0);
      predecessors.set(nodeId, null);
    }

    // Process in topological order
    const order = this.getExecutionOrder(graph);

    for (const task of order) {
      const neighbors = graph.adjacencyList.get(task.id) || [];
      for (const neighbor of neighbors) {
        const neighborTask = graph.nodes.get(neighbor);
        const newDist = (distances.get(task.id) || 0) + (neighborTask?.estimatedEffort || 0);

        if (newDist > (distances.get(neighbor) || 0)) {
          distances.set(neighbor, newDist);
          predecessors.set(neighbor, task.id);
        }
      }
    }

    // Find the node with maximum distance (end of critical path)
    let maxDist = 0;
    let endNode: string | null = null;

    for (const [nodeId, dist] of distances) {
      if (dist > maxDist) {
        maxDist = dist;
        endNode = nodeId;
      }
    }

    // Reconstruct critical path
    const criticalPath: string[] = [];
    let current = endNode;

    while (current) {
      criticalPath.unshift(current);
      current = predecessors.get(current) || null;
    }

    return criticalPath;
  }

  /**
   * Create execution plan with parallelizable phases
   */
  createExecutionPlan(graph: DependencyGraph): ExecutionPlan {
    if (graph.hasCycle) {
      throw new Error('Cannot create execution plan: dependency graph has cycles');
    }

    const phases: ExecutionPhase[] = [];
    const completed = new Set<string>();
    let phaseNumber = 1;

    while (completed.size < graph.nodes.size) {
      // Find all tasks that can be executed (all dependencies satisfied)
      const readyTasks: DecomposedTask[] = [];

      for (const [nodeId, task] of graph.nodes) {
        if (completed.has(nodeId)) continue;

        const deps = graph.reverseAdjacencyList.get(nodeId) || [];
        const allDepsSatisfied = deps.every(dep => completed.has(dep));

        if (allDepsSatisfied) {
          readyTasks.push(task);
        }
      }

      if (readyTasks.length === 0) {
        // Should not happen if no cycles, but safety check
        break;
      }

      // Calculate phase duration (max of all tasks in phase since they run in parallel)
      const phaseDuration = Math.max(...readyTasks.map(t => t.estimatedEffort));

      phases.push({
        phaseNumber,
        tasks: readyTasks,
        canParallelize: this.config.enableParallelization && readyTasks.length > 1,
        estimatedDuration: phaseDuration,
        dependencies: phaseNumber > 1 ? [`Phase ${phaseNumber - 1}`] : [],
      });

      // Mark as completed
      for (const task of readyTasks) {
        completed.add(task.id);
      }

      phaseNumber++;
    }

    // Calculate total duration
    const totalDuration = phases.reduce((sum, phase) => sum + phase.estimatedDuration, 0);

    // Calculate parallelization factor
    const totalTasks = graph.nodes.size;
    const parallelizationFactor = totalTasks > 0 ? totalTasks / phases.length : 1;

    return {
      phases,
      totalTasks,
      estimatedDuration: totalDuration,
      parallelizationFactor,
    };
  }

  /**
   * Estimate total effort for tasks
   */
  estimateEffort(tasks: DecomposedTask[]): number {
    return tasks.reduce((sum, task) => sum + task.estimatedEffort, 0);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a task decomposer instance
 */
export function createTaskDecomposer(config?: Partial<TaskDecomposerConfig>): ITaskDecomposer {
  return new TaskDecomposer(config);
}
