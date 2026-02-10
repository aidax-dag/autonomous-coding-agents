/**
 * API Module
 *
 * Provides external access to the agent system through the API Gateway.
 *
 * @module api
 */

export {
  APIGateway,
  createAPIGateway,
  type APIGatewayOptions,
  type SubmitTaskRequest,
  type SubmitTaskResponse,
  type GatewayEvent,
  type GatewayEventHandler,
} from './gateway';
