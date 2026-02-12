# F019 -- DynamicPrompts

> Runtime prompt template registry and renderer with variable substitution, token estimation, and budget-aware selection.

## 1. Purpose

DynamicPrompts provides a system for managing and rendering prompt templates at runtime. Instead of hardcoding prompt strings, agents register categorized templates with variable placeholders, then render them with context-specific values. The module handles required and optional variable substitution, token budget enforcement (truncation when over budget), and intelligent template selection based on category priority and token constraints. This enables prompt optimization without code changes.

## 2. Interface

```typescript
interface PromptTemplate {
  id: string;
  name: string;
  content: string;                       // Uses {{variable}} placeholders
  requiredVars: string[];
  optionalVars: Record<string, string>;  // Variable name -> default value
  category: 'system' | 'task' | 'review' | 'planning' | 'custom';
  priority: number;                      // Higher = preferred
}

interface PromptContext {
  variables: Record<string, string>;
  agentType?: string;
  complexity?: number;    // 0-1
  maxTokens?: number;     // Token budget constraint
}

interface RenderedPrompt {
  content: string;
  templateId: string;
  appliedVars: Record<string, string>;
  estimatedTokens: number;
  renderedAt: string;     // ISO timestamp
}

interface IPromptRegistry {
  register(template: PromptTemplate): void;
  get(id: string): PromptTemplate | undefined;
  findByCategory(category: PromptTemplate['category']): PromptTemplate[];
  list(): string[];
  remove(id: string): boolean;
}

interface IPromptRenderer {
  render(templateId: string, context: PromptContext): RenderedPrompt;
  selectTemplate(category: PromptTemplate['category'], context: PromptContext): PromptTemplate | undefined;
}
```

## 3. Implementation

### PromptRegistry

- **Class**: `PromptRegistry` implements `IPromptRegistry`
- **Factory**: `createPromptRegistry(): PromptRegistry`
- **Storage**: In-memory `Map<string, PromptTemplate>`

**Key behaviors:**

- `register()` stores a defensive copy of the template.
- `get()` returns a defensive copy, or `undefined` for unknown IDs.
- `findByCategory()` returns matching templates sorted by priority descending (highest first), each as a copy.
- `list()` returns all registered template IDs.
- `remove()` deletes a template, returns `true` if it existed.

### PromptRenderer

- **Class**: `PromptRenderer` implements `IPromptRenderer`
- **Factory**: `createPromptRenderer(config: PromptRendererConfig): PromptRenderer`
- **Configuration** (`PromptRendererConfig`):
  - `registry` -- required `IPromptRegistry` instance
  - `tokensPerChar?` -- token estimation ratio (default: 0.25)

**Key behaviors:**

- `render()` retrieves the template from the registry, substitutes `{{variable}}` placeholders for required variables (throws if missing), applies optional variable defaults, and truncates with `[truncated]` if content exceeds `maxTokens` budget.
- `selectTemplate()` finds templates by category, filters by token budget if specified (checking estimated token count against `maxTokens`), and returns the highest-priority fitting template.
- Token estimation: `Math.ceil(text.length * tokensPerChar)`.
- Truncation limit: `Math.floor(maxTokens / tokensPerChar)` characters.

## 4. Dependencies

**Depends on:**

- No external modules. `PromptRenderer` depends on `IPromptRegistry` (provided at construction).

**Depended on by:**

- Agent orchestrator for constructing system and task prompts dynamically.
- Tiered model router could use this to select appropriately sized prompts for different model tiers.

## 5. Testing

- **Test file**: `tests/unit/core/dynamic-prompts/dynamic-prompts.test.ts`
- **Test count**: 12 tests
- **Key test scenarios**:
  - **Registry**: Register and retrieve template, unknown ID returns undefined, find by category sorted by priority, list all IDs, remove template, returned objects are copies (not references)
  - **Renderer**: Required variable substitution, optional variable defaults applied, optional defaults overridden by context, missing required variable throws, unknown template ID throws, token estimation accuracy, truncation when over token budget with `[truncated]` marker
  - **Template selection**: Highest priority selected, empty category returns undefined, token budget filtering selects smaller template
  - Factory functions `createPromptRegistry` and `createPromptRenderer` create valid instances
