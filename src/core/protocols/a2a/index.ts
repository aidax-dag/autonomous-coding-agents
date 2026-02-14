/**
 * A2A (Agent-to-Agent) Protocol
 *
 * Enables external agents to discover, communicate with,
 * and delegate tasks to ACA agents over HTTP/JSON.
 *
 * @module core/protocols/a2a
 */

export type * from './types';
export { A2AGateway, createA2AGateway, type A2AGatewayConfig } from './a2a-gateway';
export { A2ARouter, createA2ARouter, type A2ARoute, type A2AMessageHandler } from './a2a-router';
