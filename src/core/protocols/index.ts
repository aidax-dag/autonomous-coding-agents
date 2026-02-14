/**
 * Protocols Module
 *
 * Agent Communication Protocol (ACP) for multi-frontend support.
 * Agent-to-Agent (A2A) Protocol for external agent communication.
 *
 * @module core/protocols
 */

// ── Interfaces ─────────────────────────────────────────────
export type {
  ACPMessage,
  ACPMessageType,
  ACPPriority,
  ACPHandler,
  ACPFilter,
  ACPSubscription,
  IACPMessageBus,
  TaskSubmitPayload,
  TaskStatusPayload,
  TaskResultPayload,
  AgentStatusPayload,
  SystemHealthPayload,
} from './interfaces/acp.interface';

// ── Message Bus ────────────────────────────────────────────
export {
  ACPMessageBus,
  createACPMessageBus,
  createACPMessage,
  type ACPMessageBusOptions,
} from './acp-message-bus';

// ── A2A Protocol ───────────────────────────────────────────
export * from './a2a';
