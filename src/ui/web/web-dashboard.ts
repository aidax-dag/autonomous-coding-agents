/**
 * Web Dashboard
 * Main web dashboard orchestrator combining server, API, and SSE.
 * @module ui/web
 */

import type { IWebDashboard, SSEBroker, WebDashboardConfig } from './interfaces/web.interface';
import type { WebServer } from './web-server';
import { createWebServer } from './web-server';
import type { DashboardAPI } from './dashboard-api';
import { createDashboardAPI } from './dashboard-api';
import type { SSEBrokerImpl } from './sse-broker';
import { createSSEBroker } from './sse-broker';
import { HttpAdapter } from './http-adapter';
import type { IHUDDashboard } from '@/core/hud';
import type { IACPMessageBus, ACPSubscription } from '@/core/protocols';

export interface WebDashboardOptions {
  config?: WebDashboardConfig;
  dashboard?: IHUDDashboard;
  messageBus?: IACPMessageBus;
}

export class WebDashboardApp implements IWebDashboard {
  private readonly server: WebServer;
  private readonly api: DashboardAPI;
  private readonly sseBroker: SSEBrokerImpl;
  private readonly adapter: HttpAdapter;
  private running: boolean = false;
  private subscription: ACPSubscription | null = null;
  private readonly messageBus: IACPMessageBus | null;

  constructor(options?: WebDashboardOptions) {
    this.server = createWebServer(options?.config?.server);
    this.sseBroker = createSSEBroker();
    this.messageBus = options?.messageBus ?? null;
    this.adapter = new HttpAdapter(this.server, this.sseBroker);

    this.api = createDashboardAPI({
      server: this.server,
      dashboard: options?.dashboard,
      messageBus: options?.messageBus,
      sseBroker: this.sseBroker,
    });
  }

  getServer(): WebServer {
    return this.server;
  }

  getAPI(): DashboardAPI {
    return this.api;
  }

  getSSEBroker(): SSEBroker {
    return this.sseBroker;
  }

  async start(): Promise<void> {
    if (this.running) return;
    const config = this.server.getConfig();
    await this.adapter.listen(config.port, config.host);
    this.server.start();
    this.running = true;

    // Subscribe to agent status for SSE broadcast
    if (this.messageBus) {
      this.subscription = this.messageBus.on('agent:status', async (msg) => {
        this.sseBroker.broadcast('agent:status', msg.payload);
      });
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    await this.adapter.close();
    this.server.stop();
    this.sseBroker.disconnectAll();
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}

export function createWebDashboard(options?: WebDashboardOptions): WebDashboardApp {
  return new WebDashboardApp(options);
}
