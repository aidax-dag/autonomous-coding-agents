/**
 * JetBrains Plugin Module
 *
 * TypeScript client library for JetBrains IDE integration with ACA.
 * Provides JSON-RPC 2.0 communication over TCP for task submission,
 * agent monitoring, and real-time event subscriptions.
 *
 * @module platform/jetbrains
 */

export type {
  JetBrainsClientConfig,
  TaskSubmission,
  TaskStatus,
  AgentInfo,
  TaskUpdateEvent,
  AgentEvent,
} from './types';
export { DEFAULT_RPC_PORT, DEFAULT_CONNECT_TIMEOUT, DEFAULT_REQUEST_TIMEOUT } from './types';

export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  JsonRpcMessage,
} from './json-rpc';
export {
  JSON_RPC_ERRORS,
  createRequest,
  createNotification,
  serializeMessage,
  parseMessages,
  isResponse,
  isNotification,
  isRequest,
  resetIdCounter,
} from './json-rpc';

export { ACAJetBrainsClient, createACAJetBrainsClient } from './aca-jetbrains-client';
