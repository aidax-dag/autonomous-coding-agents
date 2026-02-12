# F013 -- ACPProtocol

> Agent Communication Protocol message bus for routing messages between agents, frontends, and system components.

## 1. Purpose

The ACP (Agent Communication Protocol) module defines a standard protocol for agent-to-agent and agent-to-frontend communication. It enables multi-frontend support (CLI, Web, API) through a unified message format with publish/subscribe semantics, type-based filtering, and request-response patterns. The in-memory message bus routes messages to subscribers based on predicate filters, supporting both fire-and-forget publishing and correlated request-response flows with timeouts.

## 2. Interface

**Source**: `src/core/protocols/interfaces/acp.interface.ts`

### Message Types

```typescript
type ACPMessageType =
  | 'task:submit' | 'task:status' | 'task:result' | 'task:cancel'
  | 'agent:status' | 'agent:event'
  | 'system:health' | 'system:config';

type ACPPriority = 'low' | 'normal' | 'high' | 'critical';

interface ACPMessage<T = unknown> {
  id: string;
  type: ACPMessageType;
  source: string;
  target: string;
  payload: T;
  priority: ACPPriority;
  timestamp: string;         // ISO format
  correlationId?: string;    // links request-response pairs
  metadata?: Record<string, unknown>;
}
```

### Typed Payloads

| Payload Type | Key Fields |
|---|---|
| `TaskSubmitPayload` | `description`, `type?`, `targetTeam?`, `projectContext?`, `config?` |
| `TaskStatusPayload` | `taskId`, `status` (pending/running/completed/failed/cancelled), `progress?` |
| `TaskResultPayload` | `taskId`, `success`, `result?`, `error?`, `duration` |
| `AgentStatusPayload` | `agentId`, `name`, `status` (idle/busy/error/stopped), `activeTasks`, `uptime` |
| `SystemHealthPayload` | `status` (healthy/degraded/unhealthy), `activeAgents`, `pendingTasks`, `uptime`, `components` |

### Bus Interface

```typescript
type ACPHandler<T = unknown> = (message: ACPMessage<T>) => Promise<ACPMessage | void>;
type ACPFilter = (message: ACPMessage) => boolean;

interface ACPSubscription {
  unsubscribe(): void;
}

interface IACPMessageBus {
  publish(message: ACPMessage): Promise<void>;
  subscribe(filter: ACPFilter, handler: ACPHandler): ACPSubscription;
  on(type: ACPMessageType, handler: ACPHandler): ACPSubscription;
  request<TReq, TRes>(message: ACPMessage<TReq>, timeout?: number): Promise<ACPMessage<TRes>>;
  subscriptionCount(): number;
  clear(): void;
}
```

## 3. Implementation

### ACPMessageBus (`src/core/protocols/acp-message-bus.ts`)

- **Class**: `ACPMessageBus implements IACPMessageBus`
- **Config**: `ACPMessageBusOptions { defaultTimeout?: number }` (default 30000ms)
- **Storage**: Array of `SubscriptionRecord { id, filter, handler }`
- **Key behaviors**:
  - `publish()` delivers to all subscribers whose filter predicate returns true, executing handlers in parallel via `Promise.all`.
  - `subscribe()` registers a filter/handler pair and returns an `ACPSubscription` with `unsubscribe()`.
  - `on(type, handler)` is a convenience wrapper that subscribes with `msg.type === type` as the filter.
  - `request()` implements correlated request-response: subscribes for a response matching `correlationId === message.id` and `source === message.target`, with a timeout that rejects the promise.
  - **Important**: Responders must check `msg.correlationId` to avoid infinite publish loops when the responder's own response triggers its subscription again.
- **Factory**: `createACPMessageBus(options?)`

### Helper: createACPMessage

```typescript
function createACPMessage<T>(
  partial: Pick<ACPMessage<T>, 'type' | 'source' | 'target' | 'payload'> & Partial<ACPMessage<T>>,
): ACPMessage<T>
```

Generates messages with auto-incrementing ID (`acp-{counter}-{timestamp}`), default priority `'normal'`, and current ISO timestamp.

## 4. Dependencies

- **Depends on**: No external module dependencies.
- **Depended on by**: API Gateway (`src/api/gateway.ts`) bridges HTTP requests to ACP messages. Orchestrator agents use the bus for inter-agent communication. HUD Dashboard can subscribe for real-time status updates.

## 5. Testing

- **Test file location**: `tests/unit/core/protocols/acp-message-bus.test.ts`
- **Test count**: 13 tests across 3 describe blocks
- **Key test scenarios**:
  - Publish and deliver to subscribers
  - Filter messages by type (`on()` convenience method)
  - Custom predicate filtering (e.g., by priority)
  - Unsubscribe stops delivery
  - Subscription count tracking
  - Clear all subscriptions
  - Delivery to multiple subscribers
  - Request-response pattern with correlationId matching
  - Request timeout when no responder exists
  - `createACPMessage` default generation and override
  - Factory function creation
