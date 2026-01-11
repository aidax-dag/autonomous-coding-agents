/**
 * E2E Test Fixtures
 *
 * Shared test data for E2E tests
 */

/**
 * Agent types available in the system
 */
export const AGENT_TYPES = [
  'architect',
  'coder',
  'reviewer',
  'tester',
  'doc_writer',
  'explorer',
  'librarian',
] as const;

export type AgentType = typeof AGENT_TYPES[number];

/**
 * Sample agent creation data
 */
export const sampleAgents = {
  architect: {
    type: 'architect' as const,
    name: 'Test Architect Agent',
    llm: {
      provider: 'openai' as const,
      model: 'gpt-4',
      temperature: 0.7,
    },
  },
  coder: {
    type: 'coder' as const,
    name: 'Test Coder Agent',
    llm: {
      provider: 'openai' as const,
      model: 'gpt-4',
      temperature: 0.3,
    },
  },
  reviewer: {
    type: 'reviewer' as const,
    name: 'Test Reviewer Agent',
    llm: {
      provider: 'openai' as const,
      model: 'gpt-4',
      temperature: 0.5,
    },
  },
  tester: {
    type: 'tester' as const,
    name: 'Test Tester Agent',
    llm: {
      provider: 'openai' as const,
      model: 'gpt-4',
      temperature: 0.3,
    },
  },
  doc_writer: {
    type: 'doc_writer' as const,
    name: 'Test DocWriter Agent',
    llm: {
      provider: 'openai' as const,
      model: 'gpt-4',
      temperature: 0.7,
    },
  },
  explorer: {
    type: 'explorer' as const,
    name: 'Test Explorer Agent',
    llm: {
      provider: 'openai' as const,
      model: 'gpt-4',
      temperature: 0.5,
    },
  },
  librarian: {
    type: 'librarian' as const,
    name: 'Test Librarian Agent',
    llm: {
      provider: 'openai' as const,
      model: 'gpt-4',
      temperature: 0.5,
    },
  },
};

/**
 * Sample workflow definitions
 */
export const sampleWorkflows = {
  simple: {
    name: 'Simple Test Workflow',
    description: 'A simple workflow for testing',
    steps: [
      {
        id: 'step-1',
        name: 'First Step',
        type: 'task',
        config: { action: 'analyze' },
      },
    ],
  },
  multiStep: {
    name: 'Multi-Step Workflow',
    description: 'A workflow with multiple steps',
    steps: [
      {
        id: 'step-1',
        name: 'Analysis',
        type: 'task',
        config: { action: 'analyze' },
      },
      {
        id: 'step-2',
        name: 'Implementation',
        type: 'task',
        config: { action: 'implement' },
        dependsOn: ['step-1'],
      },
      {
        id: 'step-3',
        name: 'Review',
        type: 'task',
        config: { action: 'review' },
        dependsOn: ['step-2'],
      },
    ],
  },
  parallel: {
    name: 'Parallel Workflow',
    description: 'A workflow with parallel execution',
    steps: [
      {
        id: 'step-1',
        name: 'Setup',
        type: 'task',
        config: { action: 'setup' },
      },
      {
        id: 'step-2a',
        name: 'Task A',
        type: 'task',
        config: { action: 'taskA' },
        dependsOn: ['step-1'],
      },
      {
        id: 'step-2b',
        name: 'Task B',
        type: 'task',
        config: { action: 'taskB' },
        dependsOn: ['step-1'],
      },
      {
        id: 'step-3',
        name: 'Merge',
        type: 'task',
        config: { action: 'merge' },
        dependsOn: ['step-2a', 'step-2b'],
      },
    ],
  },
};

/**
 * Sample tool definitions
 */
export const sampleTools = {
  echo: {
    name: 'echo',
    description: 'Echoes the input',
    category: 'custom',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
  },
  fileRead: {
    name: 'file-read',
    description: 'Reads a file',
    category: 'file_system',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    },
  },
};

/**
 * Hook types available in the system
 */
export const HOOK_TYPES = ['preExecution', 'postExecution', 'onError', 'onSuccess'] as const;

export type HookType = (typeof HOOK_TYPES)[number];

/**
 * Sample hook definitions
 */
export const sampleHooks = {
  preExecution: {
    name: 'pre-execution-hook',
    type: 'pre-execution',
    event: 'agent:starting',
    handler: 'console.log("Pre-execution hook triggered")',
    enabled: true,
    priority: 100,
    config: {
      logLevel: 'info',
    },
  },
  postExecution: {
    name: 'post-execution-hook',
    type: 'post-execution',
    event: 'task:after',
    handler: 'console.log("Post-execution hook triggered")',
    enabled: true,
    priority: 50,
    config: {
      notifyOnComplete: true,
    },
  },
  onError: {
    name: 'on-error-hook',
    type: 'on-error',
    event: 'agent:error',
    handler: 'console.error("Error hook triggered")',
    enabled: true,
    priority: 100,
    config: {
      retryEnabled: true,
    },
  },
  onSuccess: {
    name: 'on-success-hook',
    type: 'on-success',
    event: 'task:after',
    handler: 'console.log("Success hook triggered")',
    enabled: true,
    priority: 50,
    config: {},
  },
};

/**
 * Invalid data for negative testing
 */
export const invalidData = {
  emptyAgent: {
    type: '',
    name: '',
  },
  invalidAgentType: {
    type: 'invalid-type',
    name: 'Test Agent',
  },
  tooLongName: {
    type: 'coder',
    name: 'A'.repeat(200), // Exceeds max length
  },
  missingRequired: {
    config: {},
  },
};

/**
 * Generate unique test ID
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Create agent with unique name
 */
export function createUniqueAgent(type: AgentType = 'coder') {
  return {
    ...sampleAgents[type] || sampleAgents.coder,
    name: `${sampleAgents[type]?.name || 'Test Agent'} - ${generateTestId()}`,
  };
}

/**
 * Create workflow with unique name
 */
export function createUniqueWorkflow(template: keyof typeof sampleWorkflows = 'simple') {
  return {
    ...sampleWorkflows[template],
    name: `${sampleWorkflows[template].name} - ${generateTestId()}`,
  };
}

/**
 * Create hook with unique name
 */
export function createUniqueHook(type: HookType = 'preExecution') {
  const template = sampleHooks[type] || sampleHooks.preExecution;
  return {
    ...template,
    name: `${template.name}-${generateTestId()}`,
  };
}
