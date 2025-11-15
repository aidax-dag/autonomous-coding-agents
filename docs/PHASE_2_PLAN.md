# Phase 2: Agent Base Implementation

## Overview
Phase 2 focuses on implementing the core agent architecture and base functionality that all agents will inherit from.

## Features

### F2.1: Base Agent Class
**Description:** Abstract base class that all agents inherit from

**Core Responsibilities:**
- Agent lifecycle management (initialize, start, stop, health check)
- Message handling (subscribe to topics, process messages, publish responses)
- State management (idle, working, error states)
- LLM integration (interact with configured LLM provider)
- Logging and telemetry
- Error handling and recovery

**Key Components:**
```typescript
abstract class BaseAgent {
  // Configuration
  protected config: AgentConfig
  protected llmClient: ILLMClient
  protected natsClient: NatsClient
  protected logger: Logger

  // State
  protected state: AgentState
  protected currentTask?: Task

  // Abstract methods (must be implemented by subclasses)
  abstract getAgentType(): AgentType
  abstract processTask(task: Task): Promise<TaskResult>

  // Concrete methods
  async initialize(): Promise<void>
  async start(): Promise<void>
  async stop(): Promise<void>
  async handleMessage(message: AgentMessage): Promise<void>
  async publishResult(result: TaskResult): Promise<void>
  getState(): AgentState
  getHealth(): HealthStatus
}
```

**Interfaces:**
- `AgentConfig`: Configuration for agent (id, type, llm settings, etc.)
- `AgentState`: Enum (IDLE, WORKING, ERROR, STOPPED)
- `Task`: Work unit that agents process
- `TaskResult`: Result of task processing
- `HealthStatus`: Agent health information

---

### F2.2: Agent Manager
**Description:** Manages lifecycle and coordination of multiple agents

**Core Responsibilities:**
- Agent registry (register, unregister, lookup agents)
- Agent lifecycle (start, stop, restart agents)
- Task routing (route tasks to appropriate agents)
- Health monitoring (check agent health, handle failures)
- Load balancing (distribute work across agents)

**Key Components:**
```typescript
class AgentManager {
  private agents: Map<string, BaseAgent>
  private agentsByType: Map<AgentType, BaseAgent[]>

  async registerAgent(agent: BaseAgent): Promise<void>
  async unregisterAgent(agentId: string): Promise<void>
  async startAgent(agentId: string): Promise<void>
  async stopAgent(agentId: string): Promise<void>
  async routeTask(task: Task): Promise<string> // Returns agent ID
  async getAgentHealth(agentId: string): Promise<HealthStatus>
  async getAllAgentStatus(): Promise<AgentStatus[]>
  getAgentByType(type: AgentType): BaseAgent[]
}
```

---

### F2.3: Coder Agent
**Description:** Agent responsible for implementing code changes

**Core Responsibilities:**
- Parse implementation requirements from tasks
- Generate code using LLM
- Handle multi-file changes
- Manage git operations (branch, commit, push)
- Iterate on feedback from Reviewer

**Task Flow:**
1. Receive `ImplementationRequest` task
2. Clone repository / switch to branch
3. Analyze existing code context
4. Generate implementation using LLM
5. Create/modify files
6. Run basic validation (syntax check, type check)
7. Commit changes
8. Publish `ImplementationResult`

**Interfaces:**
- `ImplementationRequest`: Task details (feature, files, requirements)
- `ImplementationResult`: Result (success, files changed, commit hash)
- `CodeContext`: Context for LLM (existing code, related files)

---

### F2.4: Reviewer Agent
**Description:** Agent responsible for code review

**Core Responsibilities:**
- Review code changes for quality
- Check for issues (bugs, security, performance)
- Provide structured feedback
- Approve or request changes
- Create review comments on GitHub

**Task Flow:**
1. Receive `ReviewRequest` task
2. Fetch PR diff from GitHub
3. Analyze changes using LLM
4. Generate review comments
5. Post review to GitHub
6. Publish `ReviewResult`

**Interfaces:**
- `ReviewRequest`: Task details (PR number, repository)
- `ReviewResult`: Result (approved, changes requested, comments)
- `ReviewComment`: Structured comment (file, line, message, severity)

---

### F2.5: Repo Manager Agent
**Description:** Agent responsible for repository-level orchestration

**Core Responsibilities:**
- Orchestrate multi-agent workflows
- Manage PR lifecycle (create, update, merge)
- Coordinate Coder and Reviewer agents
- Handle retries and error recovery
- Track implementation progress

**Task Flow:**
1. Receive `FeatureRequest` (high-level task)
2. Create implementation plan
3. Create feature branch
4. Assign implementation task to Coder
5. Wait for implementation completion
6. Create PR
7. Assign review task to Reviewer
8. Handle review feedback (iterate with Coder if needed)
9. Merge PR when approved
10. Publish `FeatureResult`

**Interfaces:**
- `FeatureRequest`: High-level feature request
- `FeatureResult`: Complete feature implementation result
- `WorkflowState`: State machine for feature implementation

---

## Implementation Order

1. **F2.1: Base Agent Class** (Week 3, Day 1-2)
   - Define interfaces and types
   - Implement base class with lifecycle
   - Add message handling
   - Write unit tests

2. **F2.2: Agent Manager** (Week 3, Day 3-4)
   - Implement agent registry
   - Add task routing
   - Add health monitoring
   - Write unit tests

3. **F2.3: Coder Agent** (Week 3, Day 5 - Week 4, Day 1)
   - Implement task processing
   - Add LLM integration for code generation
   - Add git operations
   - Write unit tests

4. **F2.4: Reviewer Agent** (Week 4, Day 2-3)
   - Implement code review logic
   - Add GitHub integration
   - Add LLM integration for review
   - Write unit tests

5. **F2.5: Repo Manager Agent** (Week 4, Day 4-5)
   - Implement workflow orchestration
   - Add multi-agent coordination
   - Add error recovery
   - Write integration tests

---

## Testing Strategy

### Unit Tests
- Each agent class tested in isolation
- Mock NATS, LLM, GitHub, Git dependencies
- Test state transitions
- Test error handling

### Integration Tests
- Test agent communication via NATS
- Test multi-agent workflows
- Test with real dependencies (optional, behind feature flag)

### End-to-End Tests
- Complete feature implementation workflow
- Coder → Reviewer → PR merge flow
- Error recovery scenarios

---

## Success Criteria

- [ ] All agents can start, process tasks, and stop gracefully
- [ ] Agents communicate via NATS messaging
- [ ] Agent Manager can route tasks to appropriate agents
- [ ] Coder Agent can implement simple features
- [ ] Reviewer Agent can review PRs and provide feedback
- [ ] Repo Manager Agent can orchestrate complete workflows
- [ ] All unit tests passing (>90% coverage)
- [ ] Integration tests demonstrate multi-agent coordination
- [ ] Comprehensive error handling and logging

---

## File Structure

```
src/
  agents/
    base/
      agent.ts              # BaseAgent abstract class
      types.ts              # Shared types and interfaces
      state.ts              # Agent state management
    manager/
      agent-manager.ts      # AgentManager class
      task-router.ts        # Task routing logic
      health-monitor.ts     # Health monitoring
    coder/
      coder-agent.ts        # CoderAgent implementation
      code-generator.ts     # LLM-based code generation
      file-manager.ts       # File operations
    reviewer/
      reviewer-agent.ts     # ReviewerAgent implementation
      code-analyzer.ts      # LLM-based code analysis
      review-formatter.ts   # Format review comments
    repo-manager/
      repo-manager-agent.ts # RepoManagerAgent implementation
      workflow-engine.ts    # Workflow orchestration
      pr-manager.ts         # PR lifecycle management

tests/
  unit/
    agents/
      base/
        agent.test.ts
      manager/
        agent-manager.test.ts
      coder/
        coder-agent.test.ts
      reviewer/
        reviewer-agent.test.ts
      repo-manager/
        repo-manager-agent.test.ts
  integration/
    agents/
      multi-agent-workflow.test.ts
```

---

## Dependencies

### Required from Phase 1
- ✅ NATS client (messaging)
- ✅ LLM clients (Claude, OpenAI, Gemini)
- ✅ GitHub client (PR, review operations)
- ✅ Git operations (clone, commit, push)
- ✅ Logging system
- ✅ Error handling
- ✅ Configuration management

### New Dependencies
- State machine library (optional, for workflow states)
- Retry library (optional, for robust error handling)

---

## Next Steps

Start with **F2.1: Base Agent Class** implementation:
1. Create agent types and interfaces
2. Implement BaseAgent abstract class
3. Add message handling integration
4. Write comprehensive tests
