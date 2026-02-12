/**
 * Web Server
 * Lightweight HTTP server abstraction for dashboard API.
 * @module ui/web
 */

import type {
  IWebServer,
  HttpMethod,
  RouteHandler,
  RouteDefinition,
  WebRequest,
  WebResponse,
  WebServerConfig,
} from './interfaces/web.interface';

interface RouteEntry {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class WebServer implements IWebServer {
  private routes: RouteEntry[] = [];
  private running: boolean = false;
  private readonly config: Required<WebServerConfig>;

  constructor(config?: WebServerConfig) {
    this.config = {
      port: config?.port ?? 3000,
      host: config?.host ?? 'localhost',
      corsEnabled: config?.corsEnabled ?? true,
      corsOrigins: config?.corsOrigins ?? ['*'],
    };
  }

  addRoute(method: HttpMethod, path: string, handler: RouteHandler): void {
    const { pattern, paramNames } = this.compilePath(path);
    // Replace existing route if same method+path
    const idx = this.routes.findIndex(r => r.method === method && r.path === path);
    if (idx >= 0) {
      this.routes[idx] = { method, path, pattern, paramNames, handler };
    } else {
      this.routes.push({ method, path, pattern, paramNames, handler });
    }
  }

  removeRoute(method: HttpMethod, path: string): void {
    this.routes = this.routes.filter(r => !(r.method === method && r.path === path));
  }

  async handleRequest(req: WebRequest): Promise<WebResponse> {
    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec(req.path);
      if (match) {
        const params: Record<string, string> = { ...req.params };
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        const enrichedReq: WebRequest = { ...req, params };
        try {
          const response = await route.handler(enrichedReq);
          if (this.config.corsEnabled) {
            response.headers = {
              ...response.headers,
              'Access-Control-Allow-Origin': this.config.corsOrigins.join(', '),
            };
          }
          return response;
        } catch (err) {
          return {
            status: 500,
            body: { error: err instanceof Error ? err.message : 'Internal server error' },
          };
        }
      }
    }
    return { status: 404, body: { error: 'Not found' } };
  }

  getRoutes(): RouteDefinition[] {
    return this.routes.map(r => ({ method: r.method, path: r.path, handler: r.handler }));
  }

  isRunning(): boolean {
    return this.running;
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  getConfig(): Required<WebServerConfig> {
    return { ...this.config, corsOrigins: [...this.config.corsOrigins] };
  }

  private compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    const regexStr = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    return { pattern: new RegExp(`^${regexStr}$`), paramNames };
  }
}

export function createWebServer(config?: WebServerConfig): WebServer {
  return new WebServer(config);
}
