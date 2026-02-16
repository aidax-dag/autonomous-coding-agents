# Module Reference

> **DEPRECATED** (2026-02-15): 이 문서는 초기 설계 기준이며 현재 코드와 크게 다릅니다.
> 현재 모듈 구조는 **[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)** 를 참조하세요.
> 주요 차이: `src/agents/` 제거됨, core/ 모듈 8개→45개 확장, desktop/platform/types 추가, NATS→ACP 전환.

> 모듈 구조 및 구현된 모듈 레퍼런스

## 1. Module Structure Template

```
module/
├── interfaces/           # 인터페이스 정의
│   └── *.interface.ts
├── impl/                 # 구현체
│   └── *.impl.ts
├── types/                # 타입 정의
│   └── *.types.ts
├── errors/               # 모듈 특화 에러
│   └── *.error.ts
├── __tests__/            # 테스트
│   ├── *.spec.ts
│   └── *.integration.ts
└── index.ts              # 공개 API
```

---

## 2. SOLID Application Guidelines

| Principle | Guideline | Verification |
|-----------|-----------|--------------|
| **S** - Single Responsibility | 각 클래스는 하나의 변경 이유만 가짐 | 클래스당 책임 1개 확인 |
| **O** - Open/Closed | 확장에 열림, 수정에 닫힘 | 새 기능 추가 시 기존 코드 수정 불필요 |
| **L** - Liskov Substitution | 파생 클래스는 기반 클래스 대체 가능 | 모든 구현체가 인터페이스 계약 준수 |
| **I** - Interface Segregation | 작은 역할별 인터페이스 | 인터페이스당 메서드 5개 이하 권장 |
| **D** - Dependency Inversion | 추상화에 의존 | 모든 의존성이 인터페이스를 통해 주입 |

---

## 3. Core Modules

### 3.1 DI Container (`src/core/di/`)
```
di/
├── interfaces/
│   ├── container.interface.ts
│   └── provider.interface.ts
├── impl/
│   └── container.impl.ts
├── tokens/
│   └── tokens.ts
└── index.ts
```

### 3.2 Event System (`src/core/events/`)
```
events/
├── interfaces/
│   └── event-bus.interface.ts
├── impl/
│   └── event-bus.impl.ts
├── types/
│   └── event.types.ts
└── index.ts
```

### 3.3 Hook System (`src/core/hooks/`)
```
hooks/
├── interfaces/
│   └── hook.interface.ts
├── impl/
│   └── hook-registry.impl.ts
├── auto-compaction/
├── comment-checker/
├── context-monitor/
├── mcp-health-monitor/
├── token-optimizer/
├── session-recovery/
├── pre-commit/
├── post-commit/
├── task-completion/
├── pr-creation/
├── ci-status/
└── index.ts
```

### 3.4 Kernel (`src/core/kernel/`)
```
kernel/
├── scheduler/           # 작업 스케줄링
├── process-manager/     # 프로세스 관리
├── resource-manager/    # 리소스 관리
├── security-module/     # 보안 모듈
└── index.ts
```

### 3.5 Session Manager (`src/core/session/`)
```
session/
├── session-manager.ts
├── session-store.ts
└── index.ts
```

### 3.6 Memory (`src/core/memory/`)
```
memory/
├── project-store.ts     # 프로젝트 상태 저장
├── knowledge-store.ts   # 지식 저장소
└── index.ts
```

---

## 4. Agent Modules

### 4.1 Base Agent (`src/agents/base/`)
```
base/
├── agent.ts             # Base agent class
├── agent.types.ts
└── index.ts
```

### 4.2 Specialized Agents (`src/agents/`)
```
agents/
├── base/                # Base agent
├── coder/               # 코드 생성/수정
├── reviewer/            # 코드 리뷰
├── architect/           # 설계/문서 분석
├── tester/              # TDD/테스트
├── docwriter/           # 문서 생성
├── explorer/            # 코드베이스 탐색
├── librarian/           # 레퍼런스 조회
└── index.ts
```

### 4.3 Agent Communication (`src/core/agents/communication/`)
```
communication/
├── agent-communication.ts
├── a2a-protocol.ts      # Agent-to-Agent protocol
├── message-queue.ts
└── index.ts
```

### 4.4 Agent Execution (`src/core/agents/execution/`)
```
execution/
├── background-executor.ts
├── task-executor.ts
├── parallel-executor.ts
└── index.ts
```

---

## 5. Tool Modules

### 5.1 Tool Core (`src/core/tools/`)
```
tools/
├── interfaces/
│   └── tool.interface.ts
├── tool-registry.ts
├── tool-executor.ts
└── index.ts
```

### 5.2 LSP Tools (`src/core/tools/lsp/`)
```
lsp/
├── lsp-client.ts
├── lsp-connection.ts
├── lsp-server.ts
└── index.ts
```

### 5.3 AST-Grep (`src/core/tools/ast-grep/`)
```
ast-grep/
├── ast-grep-client.ts
├── patterns/
└── index.ts
```

### 5.4 Git Tools (`src/core/tools/git/`)
```
git/
├── git-commit.tool.ts
├── git-branch.tool.ts
├── git-diff.tool.ts
├── git-log.tool.ts
├── git-stash.tool.ts
└── index.ts
```

### 5.5 Shell Tools (`src/core/tools/shell/`)
7개 도구 구현

### 5.6 File Tools (`src/core/tools/file/`)
10개 도구 구현

### 5.7 MCP Integration (`src/core/tools/mcp/`)
```
mcp/
├── mcp-client.ts
├── mcp-server.ts
├── stdio-transport.ts
├── http-transport.ts
├── websocket-transport.ts
└── index.ts
```

### 5.8 Web Search (`src/core/tools/web-search/`)
```
web-search/
├── web-search-client.ts
└── index.ts
```

---

## 6. Team Modules

### 6.1 Team Structure (`src/core/teams/`)
```
teams/
├── base-team.ts              # Abstract base
├── development/
│   ├── development-team.ts   # Parent team
│   ├── frontend-team/
│   │   ├── frontend-team.ts
│   │   ├── frontend-team.types.ts
│   │   ├── frontend-team.config.ts
│   │   ├── frontend-team.roles.ts
│   │   └── index.ts
│   ├── backend-team/
│   │   ├── backend-team.ts
│   │   └── index.ts
│   └── fullstack-team/
│       ├── fullstack-team.ts
│       └── index.ts
├── qa/
│   └── qa-team/
│       ├── qa-team.ts
│       └── index.ts
├── planning/
│   └── planning-team.ts
├── code-quality/
│   └── code-quality-team.ts
└── index.ts
```

---

## 7. Orchestrator Modules

### 7.1 Core Orchestrator (`src/core/orchestrator/`)
```
orchestrator/
├── ceo-orchestrator/
│   └── ceo-orchestrator.ts
├── task-router/
│   └── task-router.ts
├── task-decomposer/
│   └── task-decomposer.ts
├── workflow/
│   ├── workflow-engine.ts
│   ├── workflow-parser.ts
│   └── workflow-templates/
└── index.ts
```

---

## 8. Quality Modules

### 8.1 Quality Checks (`src/core/quality/`)
```
quality/
├── checks/
│   ├── code-quality-checker.ts
│   └── security-checker.ts
├── completion-detector.ts
└── index.ts
```

### 8.2 Metrics (`src/core/metrics/`)
```
metrics/
├── metric-collector.ts
├── metric-reporter.ts
├── alert-system.ts
└── index.ts
```

---

## 9. Security Modules

### 9.1 Security Core (`src/core/security/`)
```
security/
├── audit/
│   └── audit-logger.ts
├── permission/
│   └── permission-manager.ts
├── plugin-security/
│   └── plugin-validator.ts
├── code-scanning/
│   └── code-scanner.ts
├── secrets/
│   └── secrets-detector.ts
└── index.ts
```

---

## 10. Enterprise Modules

### 10.1 Enterprise Features (`src/core/enterprise/`)
```
enterprise/
├── sso/
│   └── sso-provider.ts
├── team-management/
│   └── team-manager.ts
├── multi-repo/
│   └── multi-repo.manager.ts
├── analytics/
│   └── analytics-collector.ts
└── index.ts
```

---

## 11. API Modules

### 11.1 REST API (`src/api/`)
```
api/
├── routes/              # API 라우트
├── controllers/         # 컨트롤러
├── services/           # 서비스 레이어
├── middleware/         # 미들웨어
├── ratelimit/          # Rate limiting
│   ├── rate-limiter.ts
│   └── stores/
│       └── memory.store.ts
├── auth/
│   ├── jwt.ts
│   └── api-key.ts
└── index.ts
```

### 11.2 GraphQL (`src/api/graphql/`)
```
graphql/
├── schema/
├── resolvers/
└── index.ts
```

### 11.3 WebSocket (`src/api/websocket/`)
```
websocket/
├── ws-server.ts
├── handlers/
└── index.ts
```

---

## 12. LLM Client Modules

### 12.1 API Clients (`src/shared/llm/`)
```
llm/
├── clients/
│   ├── claude-client.ts
│   ├── openai-client.ts
│   └── gemini-client.ts
├── resilient-client.ts    # Retry, fallback
└── index.ts
```

### 12.2 CLI Clients (`src/shared/llm/cli/`)
```
cli/
├── claude-cli.ts
├── codex-cli.ts
├── gemini-cli.ts
├── ollama-cli.ts
└── index.ts
```

---

## 13. DX Modules

### 13.1 Token Budget (`src/dx/token-budget/`)
```
token-budget/
├── interfaces/
├── impl/
│   └── token-budget-manager.impl.ts
└── index.ts
```

### 13.2 Error Recovery (`src/dx/error-recovery/`)
```
error-recovery/
├── retry/
├── circuit-breaker/
└── index.ts
```

### 13.3 Testing (`src/dx/testing/`)
```
testing/
├── mock-llm-client.ts
├── fixtures/
└── index.ts
```

### 13.4 Output Optimizer (`src/dx/output-optimizer/`)
```
output-optimizer/
├── output-optimizer.ts
└── index.ts
```

---

## 14. Shared Modules

### 14.1 GitHub (`src/shared/github/`)
```
github/
├── client.ts
└── index.ts
```

### 14.2 CI (`src/shared/ci/`)
```
ci/
├── ci-checker.ts
└── index.ts
```

### 14.3 Git Operations (`src/shared/git/`)
```
git/
├── operations.ts
└── index.ts
```

### 14.4 Messaging (`src/shared/messaging/`)
```
messaging/
├── acp-message-bus.ts
└── index.ts
```

### 14.5 Notifications (`src/shared/notifications/`)
```
notifications/
├── notification-config.ts
├── notification-service.ts
└── index.ts
```

---

## 15. CLI Module

### 15.1 CLI Structure (`src/cli/`)
```
cli/
├── autonomous.ts        # Main entry
├── commands/
│   ├── start.ts
│   ├── stop.ts
│   ├── status.ts
│   └── config.ts
├── interactive/
│   └── interactive-mode.ts
└── index.ts
```

---

## 16. Implementation Patterns

### 16.1 Agent Implementation Pattern
```typescript
// 1. Interface 정의
interface ICoderAgent extends IAgent {
  generateCode(spec: CodeSpec): Promise<GeneratedCode>;
  refactorCode(code: string, instructions: string): Promise<string>;
}

// 2. Implementation
class CoderAgent extends BaseAgent implements ICoderAgent {
  constructor(
    @inject(TOKENS.LLMClient) private llm: ILLMClient,
    @inject(TOKENS.ToolRegistry) private tools: IToolRegistry,
  ) {
    super();
  }

  async generateCode(spec: CodeSpec): Promise<GeneratedCode> {
    // Implementation
  }
}

// 3. Registration
container.registerSingleton(TOKENS.CoderAgent, CoderAgent);
```

### 16.2 Tool Implementation Pattern
```typescript
// 1. Schema 정의
const ReadFileSchema: ToolSchema = {
  name: 'read_file',
  description: 'Read file contents',
  parameters: [
    { name: 'path', type: 'string', required: true },
    { name: 'encoding', type: 'string', default: 'utf-8' },
  ],
};

// 2. Implementation
class ReadFileTool implements ITool {
  schema = ReadFileSchema;

  async execute(params: { path: string; encoding?: string }): Promise<ToolResult> {
    const content = await fs.readFile(params.path, params.encoding || 'utf-8');
    return { success: true, data: content };
  }
}

// 3. Registration
toolRegistry.register(new ReadFileTool());
```

### 16.3 Team Implementation Pattern
```typescript
// 1. Config 정의
interface FrontendTeamConfig extends TeamConfig {
  framework: 'react' | 'vue' | 'angular';
  cssFramework?: string;
  testRunner?: string;
}

// 2. Roles 정의
const FRONTEND_ROLES: AgentRole[] = [
  { name: 'UI Developer', capabilities: ['component', 'styling'] },
  { name: 'State Manager', capabilities: ['state', 'data-flow'] },
];

// 3. Team 구현
class FrontendTeam extends DevelopmentTeam {
  constructor(config: FrontendTeamConfig) {
    super(config);
    this.roles = FRONTEND_ROLES;
  }
}
```

---

## 17. Testing Patterns

### 17.1 Unit Test Structure
```typescript
describe('ModuleName', () => {
  let sut: SystemUnderTest;
  let mockDependency: jest.Mocked<IDependency>;

  beforeEach(() => {
    mockDependency = createMock<IDependency>();
    sut = new SystemUnderTest(mockDependency);
  });

  describe('methodName', () => {
    it('should do something when condition', async () => {
      // Arrange
      mockDependency.method.mockResolvedValue(expected);

      // Act
      const result = await sut.methodName(input);

      // Assert
      expect(result).toEqual(expected);
    });
  });
});
```

### 17.2 Integration Test Structure
```typescript
describe('Module Integration', () => {
  let container: IContainer;

  beforeAll(async () => {
    container = await setupTestContainer();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it('should integrate correctly', async () => {
    const service = container.resolve(TOKENS.Service);
    const result = await service.operation();
    expect(result).toBeDefined();
  });
});
```

---

## 18. Related Documents

- [Overview](./OVERVIEW.md) - 아키텍처 개요
- [System Design](./SYSTEM_DESIGN.md) - 시스템 설계
- [Testing Guide](../03-guides/TESTING.md) - 테스트 가이드
