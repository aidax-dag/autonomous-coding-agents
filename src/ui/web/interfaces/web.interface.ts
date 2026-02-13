/**
 * Web Dashboard Interface Definitions
 * @module ui/web
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RouteHandler {
  (req: WebRequest): Promise<WebResponse>;
}

export interface WebRequest {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
  headers: Record<string, string>;
}

export interface WebResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
}

export interface IWebServer {
  addRoute(method: HttpMethod, path: string, handler: RouteHandler): void;
  removeRoute(method: HttpMethod, path: string): void;
  handleRequest(req: WebRequest): Promise<WebResponse>;
  getRoutes(): RouteDefinition[];
  isRunning(): boolean;
  start(): void;
  stop(): void;
}

export interface WebServerConfig {
  port?: number;
  host?: string;
  corsEnabled?: boolean;
  corsOrigins?: string[];
}

export interface IWebDashboard {
  getServer(): IWebServer;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export interface WebDashboardConfig {
  server?: WebServerConfig;
  enableSSE?: boolean;
  enableCORS?: boolean;
}

export interface SSEClient {
  id: string;
  send(event: string, data: unknown): void;
  close(): void;
}

export interface SSEBroker {
  addClient(client: SSEClient): void;
  removeClient(id: string): void;
  broadcast(event: string, data: unknown): void;
  getClientCount(): number;
}
