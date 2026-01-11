/**
 * Autonomous Runner Module
 *
 * Integrates all core components to create a fully autonomous project execution system.
 * This is the main entry point for running projects without human intervention.
 *
 * Components integrated:
 * - TaskDecomposer: PRD → Tasks
 * - ProjectStore: Persistent state management
 * - Daemon: 24/7 continuous execution
 * - CompletionDetector: Quality gates and completion checking
 *
 * @module core/runner/autonomous-runner
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  ITaskDecomposer,
  createTaskDecomposer,
  PRDAnalysis,
  DependencyGraph,
} from '../orchestrator/task-decomposer';
import {
  ProjectStore,
  createProjectStore,
  ProjectState,
  ProjectStatus,
  TaskStatus,
  TaskRecord,
  InMemoryStorageAdapter,
  FileSystemStorageAdapter,
} from '../memory/project-store';
import {
  Daemon,
  createDaemon,
  DaemonEvent,
  IAgentDispatcher,
  TaskExecutionResult,
  DispatcherStatus,
} from '../daemon/daemon';
import {
  CompletionDetector,
  createCompletionDetector,
  CompletionResult,
  CompletionStatus,
  QualityGateLevel,
  QUALITY_GATES,
} from '../quality/completion-detector';
import { ILLMClient, LLMMessage, LLMResponse, LLMStreamChunk, LLMOptions } from '../agents/interfaces';
import {
  ILLMClient as SharedLLMClient,
  createLLMClient as createSharedLLMClient,
  LLMMessage as SharedLLMMessage,
} from '@/shared/llm';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Runner events
 */
export enum RunnerEvent {
  // Lifecycle
  STARTED = 'runner:started',
  STOPPED = 'runner:stopped',
  PAUSED = 'runner:paused',
  RESUMED = 'runner:resumed',

  // Project events
  PROJECT_CREATED = 'project:created',
  PROJECT_STARTED = 'project:started',
  PROJECT_COMPLETED = 'project:completed',
  PROJECT_FAILED = 'project:failed',

  // Task events
  TASK_STARTED = 'task:started',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',

  // Quality events
  QUALITY_CHECK = 'quality:check',
  QUALITY_GATE_PASSED = 'quality:gate:passed',
  QUALITY_GATE_FAILED = 'quality:gate:failed',

  // Errors
  ERROR = 'error',
}

/**
 * Runner status
 */
export enum RunnerStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPED = 'stopped',
}

/**
 * Runner configuration
 */
export interface RunnerConfig {
  /** Storage type for projects */
  storageType: 'memory' | 'filesystem';
  /** Base path for filesystem storage */
  storagePath?: string;
  /** Quality gate level for completion */
  qualityGateLevel: QualityGateLevel;
  /** Poll interval for daemon (ms) */
  pollInterval: number;
  /** Max concurrent projects */
  maxConcurrentProjects: number;
  /** Auto-restart on error */
  autoRestart: boolean;
  /** Enable verbose logging */
  verbose: boolean;
  /** Check completion interval (ms) */
  completionCheckInterval: number;
}

/**
 * Project creation params
 */
export interface CreateProjectParams {
  name: string;
  description: string;
  prd: string;
  workingDirectory?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Project run result
 */
export interface ProjectRunResult {
  projectId: string;
  status: CompletionStatus;
  completionResult: CompletionResult;
  duration: number;
  tasksCompleted: number;
  tasksFailed: number;
}

/**
 * Runner interface
 */
export interface IAutonomousRunner {
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;

  // Project management
  createProject(params: CreateProjectParams): Promise<string>;
  runProject(projectId: string): Promise<ProjectRunResult>;
  runProjectFromPRD(prd: string, name: string): Promise<ProjectRunResult>;

  // Status
  getStatus(): RunnerStatus;
  getProjectStatus(projectId: string): Promise<ProjectState | null>;
  getActiveProjects(): string[];
}

// ============================================================================
// Configuration Schema
// ============================================================================

export const RunnerConfigSchema = z.object({
  storageType: z.enum(['memory', 'filesystem']).default('memory'),
  storagePath: z.string().optional(),
  qualityGateLevel: z.nativeEnum(QualityGateLevel).default(QualityGateLevel.STANDARD),
  pollInterval: z.number().min(100).default(1000),
  maxConcurrentProjects: z.number().min(1).max(10).default(3),
  autoRestart: z.boolean().default(true),
  verbose: z.boolean().default(false),
  completionCheckInterval: z.number().min(1000).default(5000),
});

export const DEFAULT_RUNNER_CONFIG: RunnerConfig = {
  storageType: 'memory',
  qualityGateLevel: QualityGateLevel.STANDARD,
  pollInterval: 1000,
  maxConcurrentProjects: 3,
  autoRestart: true,
  verbose: false,
  completionCheckInterval: 5000,
};

// ============================================================================
// LLM Provider Types
// ============================================================================

export type LLMProvider = 'claude' | 'openai' | 'gemini' | 'mock';

export interface RealLLMConfig {
  provider: Exclude<LLMProvider, 'mock'>;
  apiKey?: string; // If not provided, reads from env
  model?: string;
}

// ============================================================================
// Shared LLM Client Adapter
// ============================================================================

/**
 * Adapts the shared LLM client interface to the core agents interface
 */
export class SharedLLMClientAdapter implements ILLMClient {
  private sharedClient: SharedLLMClient;

  constructor(sharedClient: SharedLLMClient) {
    this.sharedClient = sharedClient;
  }

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    // Convert messages to shared format
    const sharedMessages: SharedLLMMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Call the shared client
    const result = await this.sharedClient.chat(sharedMessages, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      stopSequences: options?.stopSequences,
    });

    // Convert response to core format
    return {
      content: result.content,
      usage: {
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      stopReason: this.mapStopReason(result.finishReason),
    };
  }

  async *stream(
    messages: LLMMessage[],
    options?: LLMOptions
  ): AsyncIterable<LLMStreamChunk> {
    // Convert messages to shared format
    const sharedMessages: SharedLLMMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Use streaming if available
    let fullContent = '';
    await this.sharedClient.chatStream(
      sharedMessages,
      (chunk) => {
        fullContent += chunk.content;
      },
      {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stopSequences: options?.stopSequences,
        stream: true,
      }
    );

    // Yield the result as a single chunk (chatStream doesn't return async iterator)
    yield { type: 'text' as const, content: fullContent };
  }

  getProvider(): string {
    return this.sharedClient.getProvider();
  }

  getModel(): string {
    return this.sharedClient.getDefaultModel();
  }

  private mapStopReason(finishReason: string): LLMResponse['stopReason'] {
    switch (finishReason) {
      case 'stop':
        return 'end';
      case 'length':
        return 'max_tokens';
      case 'tool_use':
        return 'tool_use';
      default:
        return 'end';
    }
  }
}

/**
 * Create a real LLM client from provider configuration
 */
export function createRealLLMClient(config: RealLLMConfig): ILLMClient {
  const apiKey = config.apiKey || getApiKeyFromEnv(config.provider);
  const sharedClient = createSharedLLMClient(config.provider, apiKey, config.model);
  return new SharedLLMClientAdapter(sharedClient);
}

/**
 * Get API key from environment variable
 */
function getApiKeyFromEnv(provider: Exclude<LLMProvider, 'mock'>): string {
  const envVars: Record<string, string> = {
    claude: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GOOGLE_API_KEY',
  };

  const key = process.env[envVars[provider]];
  if (!key) {
    throw new Error(
      `Missing API key for ${provider}. Set ${envVars[provider]} environment variable.`
    );
  }
  return key;
}

// ============================================================================
// LLM-Based Agent Dispatcher
// ============================================================================

/**
 * Agent dispatcher that uses LLM to execute tasks
 */
export class LLMAgentDispatcher implements IAgentDispatcher {
  private llmClient: ILLMClient;
  private activeExecutions: Map<string, Promise<TaskExecutionResult>> = new Map();
  private verbose: boolean;

  constructor(llmClient: ILLMClient, verbose = false) {
    this.llmClient = llmClient;
    this.verbose = verbose;
  }

  async dispatch(
    task: TaskRecord,
    project: ProjectState
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.log(`Dispatching task: ${task.name}`);

    try {
      // Build prompt for the task
      const messages = this.buildTaskPrompt(task, project);

      // Execute via LLM
      const response = await this.llmClient.complete(messages, {
        temperature: 0.7,
        maxTokens: 4096,
      });

      const duration = Date.now() - startTime;

      // Parse result
      const result = this.parseTaskResult(response, task);

      this.log(`Task completed: ${task.name} (${duration}ms)`);

      return {
        taskId: task.id,
        projectId: project.id,
        success: result.success,
        result: result.output,
        error: result.error,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.log(`Task failed: ${task.name} - ${errorMessage}`);

      return {
        taskId: task.id,
        projectId: project.id,
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getStatus(): Promise<DispatcherStatus> {
    return {
      available: true,
      activeAgents: this.activeExecutions.size,
      maxAgents: 5,
      queuedTasks: 0,
    };
  }

  private buildTaskPrompt(
    task: TaskRecord,
    project: ProjectState
  ): LLMMessage[] {
    const systemPrompt = `You are an autonomous coding agent executing tasks for a software project.
Your role is to complete the assigned task thoroughly and correctly.

Task Details:
- Name: ${task.name}
- Description: ${task.description}
- Dependencies: ${task.dependencies.join(', ') || 'None'}

Project Context:
- Project: ${project.name}
- Description: ${project.description}
- Current Phase: ${project.context.currentPhase}
- Active Goals: ${project.context.activeGoals.join(', ')}

Instructions:
1. Analyze the task requirements
2. Plan your approach
3. Execute the task
4. Provide a detailed result

Respond with a JSON object containing:
{
  "success": boolean,
  "output": "description of what was done",
  "files_modified": ["list of files"],
  "next_steps": ["any follow-up tasks"]
}`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Execute task: ${task.name}\n\n${task.description}` },
    ];
  }

  private parseTaskResult(
    response: LLMResponse,
    _task: TaskRecord
  ): { success: boolean; output?: unknown; error?: string } {
    try {
      // Try to parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          success: result.success ?? true,
          output: result,
        };
      }

      // If no JSON, treat as successful text response
      return {
        success: true,
        output: { content: response.content },
      };
    } catch {
      // Parse error - still consider successful if we got a response
      return {
        success: true,
        output: { content: response.content },
      };
    }
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[LLMAgentDispatcher] ${message}`);
    }
  }
}

/**
 * Mock LLM client for testing
 */
export class MockLLMClient implements ILLMClient {
  private delay: number;
  private failureRate: number;

  constructor(delay = 100, failureRate = 0) {
    this.delay = delay;
    this.failureRate = failureRate;
  }

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    await new Promise(resolve => setTimeout(resolve, this.delay));

    if (Math.random() < this.failureRate) {
      throw new Error('LLM request failed');
    }

    const lastMessage = messages[messages.length - 1];
    return {
      content: JSON.stringify({
        success: true,
        output: `Completed task from: ${lastMessage.content.substring(0, 50)}...`,
        files_modified: [],
        next_steps: [],
      }),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      stopReason: 'end',
    };
  }

  async *stream(messages: LLMMessage[]): AsyncIterable<LLMStreamChunk> {
    const response = await this.complete(messages);
    yield { type: 'text' as const, content: response.content };
  }

  getProvider(): string {
    return 'mock';
  }

  getModel(): string {
    return 'mock-model';
  }
}

// ============================================================================
// Autonomous Runner Implementation
// ============================================================================

/**
 * Autonomous Runner - Main integration service
 */
export class AutonomousRunner extends EventEmitter implements IAutonomousRunner {
  private config: RunnerConfig;
  private status: RunnerStatus = RunnerStatus.IDLE;

  // Core components
  private taskDecomposer: ITaskDecomposer;
  private projectStore: ProjectStore;
  private daemon: Daemon;
  private completionDetector: CompletionDetector;
  private agentDispatcher: IAgentDispatcher;

  // State
  private activeProjects: Set<string> = new Set();
  private completionCheckInterval?: NodeJS.Timeout;
  private projectAnalyses: Map<string, PRDAnalysis> = new Map();
  private dependencyGraphs: Map<string, DependencyGraph> = new Map();

  constructor(
    agentDispatcher: IAgentDispatcher,
    config: Partial<RunnerConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_RUNNER_CONFIG, ...config };
    this.agentDispatcher = agentDispatcher;

    // Initialize components
    this.taskDecomposer = createTaskDecomposer();
    this.completionDetector = createCompletionDetector({
      defaultQualityGateLevel: this.config.qualityGateLevel,
      verbose: this.config.verbose,
    });

    // Storage will be initialized on start
    this.projectStore = null as unknown as ProjectStore;
    this.daemon = null as unknown as Daemon;
  }

  // ==================== Lifecycle ====================

  async start(): Promise<void> {
    if (this.status === RunnerStatus.RUNNING) {
      return;
    }

    this.log('Starting Autonomous Runner...');

    // Initialize storage
    const storage = this.config.storageType === 'filesystem'
      ? new FileSystemStorageAdapter(this.config.storagePath || './.codeavengers')
      : new InMemoryStorageAdapter();

    this.projectStore = createProjectStore({ verbose: this.config.verbose }, storage);
    await this.projectStore.initialize();

    // Initialize daemon
    this.daemon = createDaemon(this.projectStore, this.agentDispatcher, {
      pollInterval: this.config.pollInterval,
      verbose: this.config.verbose,
      autoRestart: this.config.autoRestart,
    });

    // Set up daemon event handlers
    this.setupDaemonEvents();

    // Start daemon
    await this.daemon.start();

    // Start completion check loop
    this.startCompletionCheckLoop();

    this.status = RunnerStatus.RUNNING;
    this.emit(RunnerEvent.STARTED);
    this.log('Autonomous Runner started');
  }

  async stop(): Promise<void> {
    if (this.status === RunnerStatus.STOPPED) {
      return;
    }

    this.log('Stopping Autonomous Runner...');

    // Stop completion check loop
    if (this.completionCheckInterval) {
      clearInterval(this.completionCheckInterval);
      this.completionCheckInterval = undefined;
    }

    // Stop daemon
    if (this.daemon) {
      await this.daemon.stop();
    }

    this.status = RunnerStatus.STOPPED;
    this.emit(RunnerEvent.STOPPED);
    this.log('Autonomous Runner stopped');
  }

  async pause(): Promise<void> {
    if (this.status !== RunnerStatus.RUNNING) {
      return;
    }

    await this.daemon.pause();
    this.status = RunnerStatus.PAUSED;
    this.emit(RunnerEvent.PAUSED);
    this.log('Autonomous Runner paused');
  }

  async resume(): Promise<void> {
    if (this.status !== RunnerStatus.PAUSED) {
      return;
    }

    await this.daemon.resume();
    this.status = RunnerStatus.RUNNING;
    this.emit(RunnerEvent.RESUMED);
    this.log('Autonomous Runner resumed');
  }

  // ==================== Project Management ====================

  async createProject(params: CreateProjectParams): Promise<string> {
    this.log(`Creating project: ${params.name}`);

    // Analyze PRD
    const analysis = await this.taskDecomposer.analyzePRD(params.prd);
    this.log(`PRD analyzed: ${analysis.features.length} features found`);

    // Create task tree
    const taskTree = await this.taskDecomposer.decompose(analysis);

    // Get all tasks from the tree
    const allTasks = Array.from(taskTree.allTasks.values());

    // Build execution plan
    const graph = this.taskDecomposer.buildDependencyGraph(allTasks);
    const executionPlan = this.taskDecomposer.createExecutionPlan(graph);

    // Create project in store
    const project = await this.projectStore.createProject({
      name: params.name,
      description: params.description,
      prd: params.prd,
    });

    // Add tasks from execution plan
    for (const phase of executionPlan.phases) {
      for (const task of phase.tasks) {
        // Get dependencies from the graph's reverse adjacency list
        const dependencies = graph.reverseAdjacencyList.get(task.id) || [];

        await this.projectStore.addTask(project.id, {
          id: task.id,
          name: task.name,
          description: task.description,
          status: TaskStatus.PENDING,
          dependencies,
          metadata: {
            featureId: task.featureId,
            priority: task.priority,
            complexity: task.complexity,
            phaseNumber: phase.phaseNumber,
            acceptanceCriteria: task.acceptanceCriteria,
          },
        });
      }
    }

    // Store analysis and graph for later validation
    this.projectAnalyses.set(project.id, analysis);
    this.dependencyGraphs.set(project.id, graph);

    this.emit(RunnerEvent.PROJECT_CREATED, { projectId: project.id, name: params.name });
    this.log(`Project created: ${project.id} with ${executionPlan.totalTasks} tasks`);

    return project.id;
  }

  async runProject(projectId: string): Promise<ProjectRunResult> {
    const startTime = Date.now();
    this.log(`Running project: ${projectId}`);

    // Ensure runner is started
    if (this.status !== RunnerStatus.RUNNING) {
      await this.start();
    }

    // Get project
    const project = await this.projectStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Register with daemon
    await this.daemon.addProject(projectId);
    this.activeProjects.add(projectId);

    this.emit(RunnerEvent.PROJECT_STARTED, { projectId });

    // Wait for project completion
    const completionResult = await this.waitForCompletion(projectId);

    // Remove from daemon
    await this.daemon.removeProject(projectId);
    this.activeProjects.delete(projectId);

    const duration = Date.now() - startTime;

    // Get final project state
    const finalProject = await this.projectStore.getProject(projectId);
    const tasks = finalProject ? Array.from(finalProject.tasks.values()) : [];

    const result: ProjectRunResult = {
      projectId,
      status: completionResult.status,
      completionResult,
      duration,
      tasksCompleted: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      tasksFailed: tasks.filter(t => t.status === TaskStatus.FAILED).length,
    };

    if (completionResult.status === CompletionStatus.COMPLETE) {
      this.emit(RunnerEvent.PROJECT_COMPLETED, result);
    } else if (completionResult.status === CompletionStatus.FAILED) {
      this.emit(RunnerEvent.PROJECT_FAILED, result);
    }

    this.log(`Project ${projectId} finished: ${completionResult.status}`);

    return result;
  }

  async runProjectFromPRD(prd: string, name: string): Promise<ProjectRunResult> {
    const projectId = await this.createProject({
      name,
      description: `Project created from PRD: ${name}`,
      prd,
    });

    return this.runProject(projectId);
  }

  // ==================== Status ====================

  getStatus(): RunnerStatus {
    return this.status;
  }

  async getProjectStatus(projectId: string): Promise<ProjectState | null> {
    return this.projectStore.getProject(projectId);
  }

  getActiveProjects(): string[] {
    return Array.from(this.activeProjects);
  }

  // ==================== Private Helpers ====================

  private setupDaemonEvents(): void {
    this.daemon.on(DaemonEvent.TASK_COMPLETED, (data) => {
      this.emit(RunnerEvent.TASK_COMPLETED, data);
    });

    this.daemon.on(DaemonEvent.TASK_FAILED, (data) => {
      this.emit(RunnerEvent.TASK_FAILED, data);
    });

    this.daemon.on(DaemonEvent.ERROR, (data) => {
      this.emit(RunnerEvent.ERROR, data);
    });
  }

  private startCompletionCheckLoop(): void {
    this.completionCheckInterval = setInterval(async () => {
      for (const projectId of this.activeProjects) {
        await this.checkProjectCompletion(projectId);
      }
    }, this.config.completionCheckInterval);

    // Don't block process exit
    this.completionCheckInterval.unref();
  }

  private async checkProjectCompletion(projectId: string): Promise<void> {
    const project = await this.projectStore.getProject(projectId);
    if (!project) return;

    const gate = QUALITY_GATES[this.config.qualityGateLevel];
    const result = await this.completionDetector.evaluateQualityGate(project, gate);

    this.emit(RunnerEvent.QUALITY_CHECK, { projectId, result });

    if (result.qualityGatePassed) {
      this.emit(RunnerEvent.QUALITY_GATE_PASSED, { projectId, result });
    }
  }

  private async waitForCompletion(projectId: string): Promise<CompletionResult> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const project = await this.projectStore.getProject(projectId);
        if (!project) {
          clearInterval(checkInterval);
          resolve({
            projectId,
            status: CompletionStatus.FAILED,
            overallScore: 0,
            qualityGatePassed: false,
            checks: [],
            summary: 'Project not found',
            recommendations: [],
          });
          return;
        }

        const result = await this.completionDetector.checkCompletion(project);

        // Check if completed or failed
        if (
          result.status === CompletionStatus.COMPLETE ||
          result.status === CompletionStatus.FAILED ||
          project.status === ProjectStatus.COMPLETED ||
          project.status === ProjectStatus.FAILED
        ) {
          clearInterval(checkInterval);
          resolve(result);
        }
      }, this.config.completionCheckInterval);

      // Safety timeout after 1 hour
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({
          projectId,
          status: CompletionStatus.FAILED,
          overallScore: 0,
          qualityGatePassed: false,
          checks: [],
          summary: 'Timeout waiting for completion',
          recommendations: ['Check for stuck tasks'],
        });
      }, 3600000);
    });
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[AutonomousRunner] ${message}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an autonomous runner with LLM client
 */
export function createAutonomousRunner(
  llmClient: ILLMClient,
  config: Partial<RunnerConfig> = {}
): AutonomousRunner {
  const dispatcher = new LLMAgentDispatcher(llmClient, config.verbose);
  return new AutonomousRunner(dispatcher, config);
}

/**
 * Create an autonomous runner with mock LLM for testing
 */
export function createMockAutonomousRunner(
  config: Partial<RunnerConfig> = {}
): AutonomousRunner {
  const mockClient = new MockLLMClient(100, 0);
  const dispatcher = new LLMAgentDispatcher(mockClient, config.verbose);
  return new AutonomousRunner(dispatcher, config);
}

/**
 * Create an autonomous runner with a real LLM provider
 */
export function createRealAutonomousRunner(
  llmConfig: RealLLMConfig,
  runnerConfig: Partial<RunnerConfig> = {}
): AutonomousRunner {
  const llmClient = createRealLLMClient(llmConfig);
  const dispatcher = new LLMAgentDispatcher(llmClient, runnerConfig.verbose);
  return new AutonomousRunner(dispatcher, runnerConfig);
}

/**
 * Create an autonomous runner by provider name (convenience function)
 */
export function createAutonomousRunnerByProvider(
  provider: LLMProvider,
  runnerConfig: Partial<RunnerConfig> = {},
  llmOptions?: { apiKey?: string; model?: string }
): AutonomousRunner {
  if (provider === 'mock') {
    return createMockAutonomousRunner(runnerConfig);
  }

  return createRealAutonomousRunner(
    {
      provider,
      apiKey: llmOptions?.apiKey,
      model: llmOptions?.model,
    },
    runnerConfig
  );
}
