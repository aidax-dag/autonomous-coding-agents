/**
 * Agent Communication Module
 *
 * Provides inter-agent messaging and coordination.
 *
 * @module core/agents/communication
 */

export {
  AgentCommunication,
  createAgentCommunication,
  COMMUNICATION_EVENTS,
  type AgentMessage,
  type MessageRoutingOptions,
  type MessageFilter,
  type AgentMessageHandler,
  type Subscription,
  type AgentCommunicationOptions,
} from './agent-communication';
