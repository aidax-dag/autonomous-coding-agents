/**
 * Web Dashboard Module
 *
 * Lightweight web server, REST API, and SSE broker for
 * real-time agent monitoring and task management.
 *
 * @module ui/web
 */

export type {
  HttpMethod,
  RouteHandler,
  WebRequest,
  WebResponse,
  RouteDefinition,
  IWebServer,
  WebServerConfig,
  IWebDashboard,
  WebDashboardConfig,
  SSEClient,
  SSEBroker,
} from './interfaces/web.interface';

export { WebServer, createWebServer } from './web-server';
export { SSEBrokerImpl, createSSEBroker } from './sse-broker';
export { DashboardAPI, createDashboardAPI, type DashboardAPIOptions } from './dashboard-api';
export { WebDashboardApp, createWebDashboard, type WebDashboardOptions } from './web-dashboard';
export { HttpAdapter, createHttpAdapter } from './http-adapter';
