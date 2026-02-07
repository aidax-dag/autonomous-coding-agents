# External Reference Guide

> 외부 프로젝트 참고 가이드

---

## 1. Reference Principles

```
⚠️ 중요: "통합"이 아닌 "참고"

- ❌ 외부 코드를 그대로 이식
- ✅ 패턴과 아이디어를 학습하여 독자적 구현
- ✅ 서버 기반 24/7 시스템에 맞게 재설계
```

---

## 2. Project Comparison

| Aspect | claude-code / oh-my-opencode | autonomous-coding-agents |
|--------|------------------------------|-------------------------|
| **Environment** | Developer terminal (CLI) | Server background (PM2) |
| **Trigger** | User input, keywords | GitHub Webhook, API, Schedule |
| **Session Model** | Interactive one-time | Continuous workflow |
| **Agent Count** | Single + sub-agents | Multi-agent collaboration |
| **State Management** | In-memory/File | PostgreSQL + Redis |
| **Communication** | In-process | NATS message broker |

---

## 3. Reference Areas

### 3.1 Priority Matrix

```
              High Implementation Complexity
                    │
    ┌───────────────┼───────────────┐
    │               │               │
    │  P2: LSP/AST  │  P1: Tool     │
    │   Tools       │   Execution   │
High│               │   Patterns    │
Biz ├───────────────┼───────────────┤
Val │               │               │
    │  P4: Config   │  P3: Hook     │
    │   Compat.     │   Patterns    │
    │               │               │
    └───────────────┼───────────────┘
                    │
              Low Implementation Complexity
```

### 3.2 Reference by Priority

| Priority | Area | Source | Business Value |
|---------|------|--------|----------------|
| **P1** | Tool Execution Patterns | oh-my-opencode | Core functionality |
| **P2** | LSP/AST Tool Implementation | oh-my-opencode | Code quality |
| **P3** | Hook Patterns | claude-code, oh-my-opencode | Extensibility |
| **P4** | Claude Code Config Compat | oh-my-opencode | Ecosystem compat |

---

## 4. Key Patterns to Reference

### 4.1 Background Execution Pattern
**Source**: `oh-my-opencode/src/hooks/*/storage.ts`

```typescript
// Pattern: Background task with file-based state
interface BackgroundTaskState {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  lastUpdate: Date;
}

// Our adaptation: Add NATS messaging
class BackgroundTaskManager {
  async execute(task: Task): Promise<void> {
    await this.saveState(task.id, { status: 'running' });
    await this.nats.publish(`task.${task.id}.started`);
    // ... execution
  }
}
```

### 4.2 LSP Integration Pattern
**Source**: `oh-my-opencode/src/shared/lsp/`

Key capabilities to implement:
- Go to definition
- Find references
- Hover information
- Document symbols
- Workspace symbols

### 4.3 AST-Grep Pattern
**Source**: `oh-my-opencode/src/shared/ast-grep/`

Key capabilities to implement:
- Pattern-based code search
- Structural code replacement
- Cross-file refactoring

### 4.4 Hook System Pattern
**Source**: `claude-code/hooks/`, `oh-my-opencode/src/hooks/`

Hook events to consider:
- `PRE_TOOL_USE` / `POST_TOOL_USE`
- `USER_PROMPT_SUBMIT`
- `PRE_COMPACT`
- `AGENT_STARTED` / `AGENT_STOPPED`

---

## 5. Implementation Guidelines

### 5.1 Adaptation Process
1. **Study**: 외부 프로젝트의 패턴과 구조 분석
2. **Design**: 우리 아키텍처에 맞게 재설계
3. **Implement**: 독자적으로 구현
4. **Test**: 충분한 테스트 작성
5. **Document**: 구현 문서화

### 5.2 What NOT to Do
- ❌ 코드 직접 복사
- ❌ 라이선스 위반
- ❌ 아키텍처 불일치 무시
- ❌ 테스트 없이 구현

### 5.3 What TO Do
- ✅ 패턴과 아이디어 학습
- ✅ 우리 아키텍처에 맞게 재설계
- ✅ 독자적 구현
- ✅ 충분한 테스트 커버리지

---

## 6. Reference Sources

### 6.1 Claude Code
- **Repository**: Anthropic Claude Code
- **Key Features**: Hook system, session management
- **License**: Check before reference

### 6.2 oh-my-opencode
- **Repository**: oh-my-opencode
- **Key Features**: LSP/AST tools, productivity hooks
- **License**: Check before reference

---

## 7. Related Documents

- [Current Status](./STATUS.md) - 현재 진행 상황
- [Roadmap](./ROADMAP.md) - 개발 로드맵
- [System Design](../02-architecture/SYSTEM_DESIGN.md) - 시스템 설계
