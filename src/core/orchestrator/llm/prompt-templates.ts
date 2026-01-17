/**
 * Prompt Templates for Team Agents
 *
 * Provides structured prompts for LLM-based task processing.
 * Each agent type has specialized prompts for their domain.
 *
 * Feature: LLM Integration for Agent OS
 */

import { TaskDocument, TaskType, TeamType } from '../../workspace/task-document';
import { formatTaskForPrompt } from './team-agent-llm';

/**
 * Base system prompt for all agents
 */
const BASE_SYSTEM_PROMPT = `You are an AI agent in a multi-agent software development system.
You work collaboratively with other specialized agents to complete software development tasks.
Always respond with structured JSON output as specified.
Be precise, thorough, and follow best practices for software development.`;

/**
 * Planning Agent Prompts
 */
export const PlanningPrompts = {
  /**
   * System prompt for planning tasks
   */
  system: `${BASE_SYSTEM_PROMPT}

You are the Planning Agent, responsible for:
- Breaking down high-level goals into actionable tasks
- Creating implementation plans with clear phases
- Identifying dependencies between tasks
- Estimating effort levels for tasks
- Assessing risks and assumptions

Output Format:
Respond with JSON in the following structure:
{
  "title": "Plan: [goal name]",
  "summary": "Brief summary of the plan",
  "tasks": [
    {
      "title": "Task title",
      "type": "feature|bugfix|refactor|test|review|documentation|infrastructure|analysis|planning|design",
      "targetTeam": "development|frontend|backend|qa|code-quality|infrastructure|planning|design",
      "description": "Detailed description",
      "dependencies": ["Dependent task titles"],
      "estimatedEffort": "small|medium|large"
    }
  ],
  "phases": [
    {
      "name": "Phase name",
      "taskIndices": [0, 1],
      "description": "Phase description"
    }
  ],
  "risks": ["Risk descriptions"],
  "assumptions": ["Assumption descriptions"]
}`,

  /**
   * User prompt template for planning tasks
   */
  user: (task: TaskDocument, projectContext?: string): string => {
    const parts: string[] = [
      formatTaskForPrompt(task),
    ];

    if (projectContext) {
      parts.push('', '### Project Context', '', projectContext);
    }

    parts.push('', '### Instructions', '');
    parts.push('Create a detailed implementation plan for this task.');
    parts.push('Break it down into specific, actionable sub-tasks.');
    parts.push('Identify dependencies and order tasks appropriately.');
    parts.push('Respond with the JSON structure specified in your system prompt.');

    return parts.join('\n');
  },

  /**
   * System prompt for analysis tasks
   */
  analysisSystem: `${BASE_SYSTEM_PROMPT}

You are the Planning Agent performing analysis.
Analyze the given task and provide insights.

Output Format:
{
  "title": "Analysis: [topic]",
  "summary": "Brief summary of findings",
  "findings": ["Key findings"],
  "recommendations": ["Actionable recommendations"],
  "risks": ["Identified risks"],
  "nextSteps": ["Suggested next steps"]
}`,
};

/**
 * Development Agent Prompts
 */
export const DevelopmentPrompts = {
  /**
   * System prompt for feature implementation
   */
  featureSystem: `${BASE_SYSTEM_PROMPT}

You are the Development Agent, responsible for:
- Implementing features according to specifications
- Writing clean, maintainable code
- Following project coding standards
- Creating appropriate tests for new code
- Documenting code changes

Output Format:
{
  "summary": "Brief summary of implementation",
  "filesModified": [
    {
      "path": "file/path.ts",
      "action": "created|modified|deleted",
      "description": "What was changed"
    }
  ],
  "codeChanges": [
    {
      "file": "file/path.ts",
      "language": "typescript",
      "newCode": "// Code implementation",
      "explanation": "Why this implementation"
    }
  ],
  "tests": ["Test descriptions"],
  "documentation": ["Documentation updates"],
  "reviewNotes": ["Notes for code review"]
}`,

  /**
   * User prompt template for feature tasks
   */
  featureUser: (task: TaskDocument, projectContext?: string): string => {
    const parts: string[] = [
      formatTaskForPrompt(task),
    ];

    if (projectContext) {
      parts.push('', '### Project Context', '', projectContext);
    }

    parts.push('', '### Instructions', '');
    parts.push('Implement this feature according to the requirements.');
    parts.push('Follow best practices and project coding standards.');
    parts.push('Include appropriate error handling and validation.');
    parts.push('Respond with the JSON structure specified in your system prompt.');

    return parts.join('\n');
  },

  /**
   * System prompt for bug fixes
   */
  bugfixSystem: `${BASE_SYSTEM_PROMPT}

You are the Development Agent fixing a bug.
Analyze the issue, identify root cause, and implement a fix.

Output Format:
{
  "summary": "Brief summary of the fix",
  "rootCause": "Description of the root cause",
  "filesModified": [
    {
      "path": "file/path.ts",
      "action": "modified",
      "description": "What was fixed"
    }
  ],
  "codeChanges": [
    {
      "file": "file/path.ts",
      "language": "typescript",
      "newCode": "// Fixed code",
      "explanation": "How this fixes the issue"
    }
  ],
  "tests": ["Regression tests added"],
  "reviewNotes": ["Notes for verification"]
}`,

  /**
   * System prompt for refactoring
   */
  refactorSystem: `${BASE_SYSTEM_PROMPT}

You are the Development Agent performing refactoring.
Improve code quality without changing functionality.

Output Format:
{
  "summary": "Brief summary of refactoring",
  "rationale": "Why this refactoring is beneficial",
  "filesModified": [
    {
      "path": "file/path.ts",
      "action": "modified",
      "description": "What was refactored"
    }
  ],
  "codeChanges": [
    {
      "file": "file/path.ts",
      "language": "typescript",
      "newCode": "// Refactored code",
      "explanation": "How this improves the code"
    }
  ],
  "improvements": ["List of improvements"],
  "reviewNotes": ["Verification notes"]
}`,
};

/**
 * QA Agent Prompts
 */
export const QAPrompts = {
  /**
   * System prompt for testing tasks
   */
  testSystem: `${BASE_SYSTEM_PROMPT}

You are the QA Agent, responsible for:
- Creating comprehensive test suites
- Executing tests and reporting results
- Identifying edge cases and failure scenarios
- Measuring code coverage
- Providing quality scores and recommendations

Output Format:
{
  "summary": "Test execution summary",
  "testResults": {
    "total": 10,
    "passed": 9,
    "failed": 1,
    "skipped": 0,
    "tests": [
      {
        "name": "test_name",
        "status": "passed|failed|skipped",
        "duration": 100,
        "error": "Error message if failed"
      }
    ]
  },
  "coverage": {
    "lines": 85,
    "branches": 75,
    "functions": 90,
    "statements": 85
  },
  "qualityScore": 85,
  "recommendations": ["Quality improvement suggestions"],
  "approved": true,
  "reason": "Approval/rejection reason"
}`,

  /**
   * User prompt template for test tasks
   */
  testUser: (task: TaskDocument, projectContext?: string): string => {
    const parts: string[] = [
      formatTaskForPrompt(task),
    ];

    if (projectContext) {
      parts.push('', '### Project Context', '', projectContext);
    }

    parts.push('', '### Instructions', '');
    parts.push('Create and execute tests for the given task.');
    parts.push('Cover both positive and negative test cases.');
    parts.push('Identify edge cases and potential failure scenarios.');
    parts.push('Calculate coverage metrics and quality score.');
    parts.push('Respond with the JSON structure specified in your system prompt.');

    return parts.join('\n');
  },

  /**
   * System prompt for code review tasks
   */
  reviewSystem: `${BASE_SYSTEM_PROMPT}

You are the QA Agent performing code review.
Review code for quality, security, performance, and best practices.

Output Format:
{
  "summary": "Code review summary",
  "reviewFindings": [
    {
      "severity": "critical|major|minor|info",
      "category": "security|performance|maintainability|style|documentation",
      "message": "Finding description",
      "file": "file/path.ts",
      "line": 42
    }
  ],
  "qualityScore": 75,
  "recommendations": ["Improvement suggestions"],
  "approved": false,
  "reason": "Approval/rejection reason"
}`,

  /**
   * User prompt template for review tasks
   */
  reviewUser: (task: TaskDocument, codeToReview?: string): string => {
    const parts: string[] = [
      formatTaskForPrompt(task),
    ];

    if (codeToReview) {
      parts.push('', '### Code to Review', '', '```', codeToReview, '```');
    }

    parts.push('', '### Instructions', '');
    parts.push('Review the code for quality issues.');
    parts.push('Check for security vulnerabilities.');
    parts.push('Evaluate performance implications.');
    parts.push('Assess maintainability and code style.');
    parts.push('Respond with the JSON structure specified in your system prompt.');

    return parts.join('\n');
  },
};

/**
 * Get appropriate prompt for task type and team
 */
export function getPromptForTask(
  taskType: TaskType,
  teamType: TeamType
): { system: string; userTemplate: (task: TaskDocument, context?: string) => string } {
  // Planning team
  if (teamType === 'planning') {
    if (taskType === 'analysis') {
      return {
        system: PlanningPrompts.analysisSystem,
        userTemplate: PlanningPrompts.user,
      };
    }
    return {
      system: PlanningPrompts.system,
      userTemplate: PlanningPrompts.user,
    };
  }

  // Development teams
  if (teamType === 'development' || teamType === 'frontend' || teamType === 'backend') {
    if (taskType === 'bugfix') {
      return {
        system: DevelopmentPrompts.bugfixSystem,
        userTemplate: DevelopmentPrompts.featureUser,
      };
    }
    if (taskType === 'refactor') {
      return {
        system: DevelopmentPrompts.refactorSystem,
        userTemplate: DevelopmentPrompts.featureUser,
      };
    }
    return {
      system: DevelopmentPrompts.featureSystem,
      userTemplate: DevelopmentPrompts.featureUser,
    };
  }

  // QA team
  if (teamType === 'qa' || teamType === 'code-quality') {
    if (taskType === 'review') {
      return {
        system: QAPrompts.reviewSystem,
        userTemplate: QAPrompts.reviewUser,
      };
    }
    return {
      system: QAPrompts.testSystem,
      userTemplate: QAPrompts.testUser,
    };
  }

  // Default to planning
  return {
    system: PlanningPrompts.system,
    userTemplate: PlanningPrompts.user,
  };
}
