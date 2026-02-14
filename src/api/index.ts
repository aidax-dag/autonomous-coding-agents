/**
 * API Module
 *
 * Provides external access to the agent system through the API Gateway
 * and the standalone API server entry point.
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

export {
  startAPIServer,
  type APIServerOptions,
  type APIServerHandle,
} from './server';

export {
  RequestLogger,
  createRequestLogger,
  installErrorHandler,
  type APIErrorResponse,
} from './middleware';

export {
  CostDashboardAPI,
  createCostDashboardAPI,
  BudgetManager,
  type CostDashboardAPIOptions,
  type BudgetConfig,
  type BudgetStatus,
  TicketFeatureCycleAPI,
  createTicketFeatureCycleAPI,
  type TicketFeatureCycleAPIOptions,
} from './routes';
