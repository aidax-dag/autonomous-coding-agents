# Phase 4: Advanced Features & Optimization

> 고급 기능 구현 및 시스템 최적화를 통한 완전 자율 운영 체계 구축

**Status**: 📋 Planning
**Timeline**: 3-4 weeks
**Priority**: P1 (Should Have)

---

## 🎯 Phase 4 목표

Phase 3에서 프로덕션 인프라를 완성했으므로, Phase 4에서는 다음을 목표로 합니다:

1. **자동화 강화**: 테스트 실행, 이슈 감지 등 추가 자동화
2. **실시간 처리**: Webhook 기반 즉각 반응 시스템
3. **성능 최적화**: 병렬 처리, 리소스 최적화
4. **사용자 경험**: 대화형 피드백, 스마트 알림
5. **품질 향상**: 코드 스타일 학습, 리뷰 품질 개선

---

## 📋 Feature List

### F4.1: CI/CD 통합 및 테스트 자동 실행 ⭐ Priority: P0

**User Story**: As a code review agent, I want to automatically run tests before approving PRs to ensure code quality.

**Scope**:
- GitHub Actions/CircleCI/Jenkins 상태 확인
- 테스트 실패 시 자동 코멘트
- 커버리지 검증
- 빌드 성공 여부 확인

**Implementation Plan**:

1. **CI/CD Status Checker**:
```typescript
// src/shared/ci/ci-checker.ts
export interface CIStatus {
  provider: 'github-actions' | 'circleci' | 'jenkins' | 'gitlab-ci';
  status: 'pending' | 'success' | 'failure' | 'cancelled';
  checkRuns: {
    name: string;
    conclusion: string;
    detailsUrl: string;
  }[];
  coverage?: number;
}

export class CIChecker {
  async getStatus(owner: string, repo: string, ref: string): Promise<CIStatus>;
  async waitForCompletion(owner: string, repo: string, ref: string): Promise<CIStatus>;
}
```

2. **Test Result Parser**:
```typescript
// src/shared/ci/test-parser.ts
export interface TestResults {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: {
    name: string;
    message: string;
    stack?: string;
  }[];
}

export class TestResultParser {
  parseJestResults(json: string): TestResults;
  parsePytestResults(xml: string): TestResults;
}
```

3. **Integration with ReviewerAgent**:
```typescript
// In ReviewerAgent.reviewPullRequest():
// Step 1: Wait for CI to complete
const ciStatus = await this.ciChecker.waitForCompletion(owner, repo, prRef);

// Step 2: Check if tests passed
if (ciStatus.status === 'failure') {
  await this.postComment(prNumber,
    `⚠️ Tests failed. Please fix the following issues:\n${formatFailures(ciStatus)}`
  );
  return { decision: 'REQUEST_CHANGES', reason: 'Tests failed' };
}

// Step 3: Check coverage
if (ciStatus.coverage && ciStatus.coverage < minCoverage) {
  await this.postComment(prNumber,
    `⚠️ Code coverage (${ciStatus.coverage}%) is below minimum (${minCoverage}%)`
  );
}
```

**Acceptance Criteria**:
- [ ] GitHub Actions status check implemented
- [ ] Test results parsing for Jest/Pytest
- [ ] Auto-comment on test failures
- [ ] Coverage validation
- [ ] Integration with ReviewerAgent
- [ ] Configurable minimum coverage threshold

**Dependencies**: F3.7 (ReviewerAgent)

**Estimated Effort**: 3-4 days

---

### F4.2: GitHub Webhook 지원 ⭐ Priority: P0

**User Story**: As a system, I want to use GitHub webhooks instead of polling for real-time PR events.

**Scope**:
- Webhook 수신 HTTP 서버
- 실시간 PR 이벤트 처리 (opened, updated, closed)
- Review 이벤트 처리
- HMAC 보안 검증

**Implementation Plan**:

1. **Webhook Server**:
```typescript
// src/server/webhook-server.ts
export class WebhookServer {
  private server: http.Server;
  private secret: string;

  constructor(port: number, secret: string) {
    this.secret = secret;
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Verify HMAC signature
    const signature = req.headers['x-hub-signature-256'];
    const body = await this.readBody(req);

    if (!this.verifySignature(body, signature)) {
      res.writeHead(401);
      res.end('Invalid signature');
      return;
    }

    // Parse event
    const event = req.headers['x-github-event'];
    const payload = JSON.parse(body);

    // Route to handlers
    await this.routeEvent(event, payload);

    res.writeHead(200);
    res.end('OK');
  }

  private verifySignature(body: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(body)
      .digest('hex');
    return `sha256=${hash}` === signature;
  }
}
```

2. **Event Handlers**:
```typescript
// src/server/webhook-handlers.ts
export class WebhookHandlers {
  async handlePullRequest(payload: PullRequestPayload) {
    const { action, pull_request } = payload;

    switch (action) {
      case 'opened':
      case 'reopened':
        // Trigger review
        await this.nats.publish('pr.review.request', {
          owner: pull_request.base.repo.owner.login,
          repo: pull_request.base.repo.name,
          prNumber: pull_request.number,
        });
        break;

      case 'synchronize': // New commits pushed
        // Re-trigger review
        await this.nats.publish('pr.review.request', { /* ... */ });
        break;

      case 'closed':
        if (pull_request.merged) {
          // Send notification
          await this.notifier.send({
            title: `PR Merged: ${pull_request.title}`,
            level: 'info',
            event: NotificationEvent.PR_MERGED,
          });
        }
        break;
    }
  }

  async handlePullRequestReview(payload: PullRequestReviewPayload) {
    // Handle review submitted events
    if (payload.review.state === 'changes_requested') {
      // Notify CoderAgent to fix issues
    }
  }
}
```

**Acceptance Criteria**:
- [ ] HTTP webhook server implemented
- [ ] HMAC signature verification
- [ ] PR event handling (opened, updated, closed, merged)
- [ ] Review event handling
- [ ] Integration with NATS message bus
- [ ] Error handling and logging
- [ ] Health check endpoint

**Dependencies**: F1.1 (NATS), F2.5 (RepoManager)

**Estimated Effort**: 2-3 days

---

### F4.3: 병렬 기능 개발 ⭐ Priority: P1

**User Story**: As a system, I want to develop multiple independent features in parallel to reduce total completion time.

**Scope**:
- 의존성 그래프 분석
- 독립적인 기능 식별
- 여러 CoderAgent 인스턴스 실행
- 브랜치 충돌 방지
- 병렬 PR 관리

**Implementation Plan**:

1. **Dependency Graph Analyzer**:
```typescript
// src/agents/planner/dependency-analyzer.ts
export interface Feature {
  id: string;
  title: string;
  description: string;
  dependencies: string[]; // Feature IDs this depends on
  files: string[]; // Expected files to modify
}

export class DependencyAnalyzer {
  /**
   * Build dependency graph from features
   */
  buildGraph(features: Feature[]): DirectedGraph<Feature> {
    const graph = new DirectedGraph<Feature>();

    for (const feature of features) {
      graph.addNode(feature);
      for (const depId of feature.dependencies) {
        const dep = features.find(f => f.id === depId);
        if (dep) {
          graph.addEdge(dep, feature);
        }
      }
    }

    return graph;
  }

  /**
   * Find features that can be developed in parallel
   */
  findParallelBatches(graph: DirectedGraph<Feature>): Feature[][] {
    const batches: Feature[][] = [];
    const processed = new Set<string>();

    while (processed.size < graph.nodeCount()) {
      const batch = graph.nodes.filter(feature => {
        // Can process if all dependencies are done
        const depsProcessed = feature.dependencies.every(id =>
          processed.has(id)
        );
        return depsProcessed && !processed.has(feature.id);
      });

      batches.push(batch);
      batch.forEach(f => processed.add(f.id));
    }

    return batches;
  }

  /**
   * Check if two features have file conflicts
   */
  hasFileConflict(f1: Feature, f2: Feature): boolean {
    return f1.files.some(file => f2.files.includes(file));
  }
}
```

2. **Parallel Execution Coordinator**:
```typescript
// src/agents/coordinator/parallel-coordinator.ts
export class ParallelCoordinator {
  private maxParallel: number;
  private activeAgents: Map<string, CoderAgent> = new Map();

  async executeFeatures(features: Feature[]): Promise<void> {
    const analyzer = new DependencyAnalyzer();
    const graph = analyzer.buildGraph(features);
    const batches = analyzer.findParallelBatches(graph);

    for (const batch of batches) {
      // Filter out features with file conflicts
      const parallelGroups = this.groupByFileConflict(batch, analyzer);

      for (const group of parallelGroups) {
        await this.executeBatch(group);
      }
    }
  }

  private async executeBatch(features: Feature[]): Promise<void> {
    const promises = features.slice(0, this.maxParallel).map(feature => {
      const agent = this.createCoderAgent();
      this.activeAgents.set(feature.id, agent);

      return agent.implementFeature(feature).finally(() => {
        this.activeAgents.delete(feature.id);
      });
    });

    await Promise.allSettled(promises);
  }
}
```

**Acceptance Criteria**:
- [ ] Dependency graph builder
- [ ] Topological sort for execution order
- [ ] File conflict detection
- [ ] Multiple CoderAgent instances
- [ ] Concurrent PR management
- [ ] Progress tracking for parallel tasks
- [ ] Configurable parallelism limit

**Dependencies**: F2.3 (CoderAgent), F2.2 (AgentManager)

**Estimated Effort**: 5-7 days

---

### F4.4: 대화형 피드백 시스템 Priority: P1

**User Story**: As a user, I want to provide feedback during development to adjust the direction.

**Scope**:
- 실시간 사용자 입력 대기
- 대화형 CLI 모드
- 피드백을 다음 작업에 반영
- 피드백 히스토리 저장

**Implementation Plan**:

1. **Interactive CLI Mode**:
```typescript
// src/cli/interactive.ts
export class InteractiveCLI {
  private rl: readline.Interface;
  private natsClient: NatsClient;

  async startInteractiveSession(taskId: string): Promise<void> {
    console.log(chalk.cyan('🤖 Interactive mode started. Type your feedback or /help for commands.'));

    // Subscribe to agent updates
    await this.natsClient.subscribe(`task.${taskId}.updates`, (msg) => {
      const update = JSON.parse(msg.data.toString());
      this.displayUpdate(update);

      // Pause for feedback if needed
      if (update.requiresFeedback) {
        this.promptFeedback(update);
      }
    });

    // Start REPL
    this.startREPL();
  }

  private startREPL(): void {
    this.rl.on('line', async (input) => {
      const trimmed = input.trim();

      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
      } else {
        await this.sendFeedback(trimmed);
      }

      this.rl.prompt();
    });

    this.rl.prompt();
  }

  private async sendFeedback(message: string): Promise<void> {
    await this.natsClient.publish(`task.${this.taskId}.feedback`, {
      message,
      timestamp: Date.now(),
    });

    console.log(chalk.green('✓ Feedback sent'));
  }
}
```

2. **Feedback Integration in Agents**:
```typescript
// In CoderAgent
async implementWithFeedback(feature: Feature): Promise<void> {
  // Step 1: Create initial plan
  const plan = await this.createPlan(feature);

  // Step 2: Request user approval
  await this.requestFeedback({
    type: 'plan-approval',
    content: plan,
    options: ['approve', 'modify', 'reject'],
  });

  // Step 3: Wait for feedback
  const feedback = await this.waitForFeedback();

  if (feedback.choice === 'modify') {
    // Incorporate feedback and regenerate plan
    const updatedPlan = await this.updatePlan(plan, feedback.message);
    // Repeat approval process
  }

  // Continue with implementation...
}
```

**Acceptance Criteria**:
- [ ] Interactive CLI REPL
- [ ] Real-time update display
- [ ] Feedback submission mechanism
- [ ] Agent pause/resume on feedback request
- [ ] Feedback history persistence
- [ ] Commands: /help, /status, /pause, /resume, /quit

**Dependencies**: F5.4 (CLI)

**Estimated Effort**: 3-5 days

---

### F4.5: 자동 이슈 감지 및 수정 Priority: P1

**User Story**: As a system, I want to automatically detect and fix common issues in the codebase.

**Scope**:
- 정적 분석 도구 통합 (ESLint, TypeScript)
- 일반적인 버그 패턴 감지
- 자동 수정 가능한 이슈 처리
- 수정 불가능한 이슈 보고

**Implementation Plan**:

1. **Static Analyzer**:
```typescript
// src/shared/analysis/static-analyzer.ts
export interface AnalysisResult {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  fixable: boolean;
}

export class StaticAnalyzer {
  async analyzeTypeScript(files: string[]): Promise<AnalysisResult[]> {
    // Run TypeScript compiler
    const program = ts.createProgram(files, compilerOptions);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    return diagnostics.map(diagnostic => ({
      file: diagnostic.file?.fileName || '',
      line: diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start!).line || 0,
      severity: 'error',
      rule: `TS${diagnostic.code}`,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      fixable: false,
    }));
  }

  async analyzeESLint(files: string[]): Promise<AnalysisResult[]> {
    const eslint = new ESLint({ fix: false });
    const results = await eslint.lintFiles(files);

    return results.flatMap(result =>
      result.messages.map(msg => ({
        file: result.filePath,
        line: msg.line,
        column: msg.column,
        severity: msg.severity === 2 ? 'error' : 'warning',
        rule: msg.ruleId || 'unknown',
        message: msg.message,
        fixable: msg.fix !== undefined,
      }))
    );
  }
}
```

2. **Auto-Fix Agent**:
```typescript
// src/agents/auto-fix/auto-fix-agent.ts
export class AutoFixAgent {
  async scanAndFix(repoPath: string): Promise<FixReport> {
    // Step 1: Run static analysis
    const issues = await this.analyzer.analyzeAll(repoPath);

    // Step 2: Separate fixable vs non-fixable
    const fixable = issues.filter(i => i.fixable);
    const manual = issues.filter(i => !i.fixable);

    // Step 3: Auto-fix what we can
    const fixed = [];
    for (const issue of fixable) {
      try {
        await this.applyFix(issue);
        fixed.push(issue);
      } catch (error) {
        manual.push(issue);
      }
    }

    // Step 4: Create issue for manual fixes
    if (manual.length > 0) {
      await this.createIssue(manual);
    }

    // Step 5: Create PR for auto-fixes
    if (fixed.length > 0) {
      await this.createFixPR(fixed);
    }

    return { fixed, manual };
  }
}
```

**Acceptance Criteria**:
- [ ] TypeScript compiler integration
- [ ] ESLint integration
- [ ] Auto-fix for common issues
- [ ] PR creation for fixes
- [ ] Issue creation for manual fixes
- [ ] Scheduled scans (daily/weekly)

**Dependencies**: F2.3 (CoderAgent)

**Estimated Effort**: 4-5 days

---

## 🗓️ Implementation Schedule

### Week 1: CI/CD & Webhook Integration
- **Days 1-3**: F4.1 - CI/CD Integration
  - GitHub Actions status check
  - Test result parsing
  - ReviewerAgent integration
- **Days 4-5**: F4.2 - Webhook Server (partial)
  - Basic HTTP server
  - HMAC verification

### Week 2: Webhook & Interactive Feedback
- **Days 1-2**: F4.2 - Webhook Server (complete)
  - Event handlers
  - NATS integration
  - Testing
- **Days 3-5**: F4.4 - Interactive Feedback
  - Interactive CLI
  - Feedback mechanisms
  - Agent integration

### Week 3: Parallel Execution & Auto-Fix
- **Days 1-3**: F4.3 - Parallel Features
  - Dependency analyzer
  - Parallel coordinator
  - Testing
- **Days 4-5**: F4.5 - Auto-Fix (partial)
  - Static analyzers
  - Basic auto-fix

### Week 4: Auto-Fix & Polish
- **Days 1-2**: F4.5 - Auto-Fix (complete)
  - Auto-fix agent
  - PR/Issue creation
- **Days 3-5**: Testing & Documentation
  - Integration testing
  - Documentation updates
  - Bug fixes

---

## 🎯 Success Criteria

### Performance Metrics
- [ ] Average feature implementation time reduced by 30%
- [ ] Test coverage maintained above 80%
- [ ] CI/CD integration reduces manual review time by 50%
- [ ] Webhook response time < 500ms

### Reliability Metrics
- [ ] Auto-fix success rate > 70%
- [ ] Zero critical bugs in parallel execution
- [ ] Webhook uptime > 99.9%

### User Experience
- [ ] Interactive feedback reduces iteration cycles by 40%
- [ ] Developer satisfaction score > 4/5
- [ ] Clear documentation for all new features

---

## 🔧 Technical Considerations

### Security
- HMAC signature verification for webhooks
- Rate limiting on webhook endpoints
- Secure storage of secrets
- Input validation for user feedback

### Performance
- Parallel execution limit (default: 3)
- Webhook queue for high traffic
- CI status polling optimization
- Resource monitoring

### Monitoring
- Webhook event metrics
- Parallel execution stats
- Auto-fix success rates
- Interactive session analytics

---

## 📚 Documentation Requirements

1. **Webhook Setup Guide**
   - GitHub webhook configuration
   - Secret generation
   - Firewall/ngrok setup for local development

2. **Interactive Mode Guide**
   - Available commands
   - Feedback best practices
   - Example workflows

3. **Parallel Execution Guide**
   - Dependency specification
   - Conflict resolution
   - Resource configuration

4. **Auto-Fix Configuration**
   - Static analyzer setup
   - Custom rules
   - Fix PR templates

---

## 🚧 Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Webhook endpoint DDoS | High | Medium | Rate limiting, HMAC verification |
| Parallel execution conflicts | High | High | Robust conflict detection, file locking |
| CI/CD provider changes | Medium | Low | Abstract provider interface |
| User feedback timeout | Low | Medium | Configurable timeout, auto-proceed |
| Auto-fix breaking changes | High | Medium | Test before PR, review process |

---

## 🔄 Dependencies on Previous Phases

- **Phase 1**: NATS, LLM, GitHub API
- **Phase 2**: All agents (Coder, Reviewer, RepoManager)
- **Phase 3**: PM2, Health Check, CLI, Notifications

---

## 📈 Future Enhancements (Phase 5+)

- Machine learning for code style
- Review quality improvement with fine-tuning
- Multi-repository support
- Custom workflow definitions
- Advanced analytics dashboard
- Performance profiling and optimization
- Cost optimization for LLM usage
