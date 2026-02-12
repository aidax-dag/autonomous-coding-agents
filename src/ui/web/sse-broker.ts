/**
 * SSE Broker
 * Server-Sent Events broker for real-time dashboard updates.
 * @module ui/web
 */

import type { SSEBroker, SSEClient } from './interfaces/web.interface';

export class SSEBrokerImpl implements SSEBroker {
  private clients: Map<string, SSEClient> = new Map();

  addClient(client: SSEClient): void {
    this.clients.set(client.id, client);
  }

  removeClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      client.close();
      this.clients.delete(id);
    }
  }

  broadcast(event: string, data: unknown): void {
    for (const client of this.clients.values()) {
      client.send(event, data);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.close();
    }
    this.clients.clear();
  }
}

export function createSSEBroker(): SSEBrokerImpl {
  return new SSEBrokerImpl();
}
