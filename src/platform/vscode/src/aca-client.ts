/**
 * ACA Client
 *
 * Manages HTTP and SSE connections to the ACA API server.
 * Provides typed methods for task submission, status retrieval,
 * and real-time event streaming.
 *
 * @module platform/vscode
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

// ── Types ────────────────────────────────────────────────────────

export interface TaskSubmitOptions {
  description?: string;
  type?: string;
  targetTeam?: string;
}

export interface TaskSubmitResult {
  taskId: string;
  status: string;
}

export interface AgentInfo {
  agentId: string;
  agentType: string;
  state: string;
  currentTask?: string;
  progress?: number;
}

export interface SnapshotData {
  agents: AgentInfo[];
  systemHealth: number;
  [key: string]: unknown;
}

export interface SSEEvent {
  event: string;
  data: unknown;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

type ConnectionChangeCallback = (state: ConnectionState) => void;
type SSECallback = (event: SSEEvent) => void;

// ── ACAClient ────────────────────────────────────────────────────

export class ACAClient {
  private serverUrl: string;
  private state: ConnectionState = 'disconnected';
  private connectionListeners: ConnectionChangeCallback[] = [];
  private sseRequest: http.ClientRequest | null = null;
  private authToken: string | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
  }

  /**
   * Attempt to connect to the ACA server by verifying the health endpoint.
   */
  async connect(): Promise<void> {
    this.setState('connecting');
    try {
      const response = await this.request<{ status: string }>('GET', '/api/health');
      if (response && response.status) {
        this.setState('connected');
      } else {
        this.setState('error');
        throw new Error('Unexpected health response from ACA server');
      }
    } catch (err) {
      this.setState('error');
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to connect to ACA server: ${message}`);
    }
  }

  /**
   * Disconnect from the ACA server and close any SSE streams.
   */
  disconnect(): void {
    if (this.sseRequest) {
      this.sseRequest.destroy();
      this.sseRequest = null;
    }
    this.setState('disconnected');
  }

  /**
   * Check whether the client is currently connected.
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Get the current connection state.
   */
  getConnectionState(): ConnectionState {
    return this.state;
  }

  /**
   * Set an authentication token for requests.
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Submit a task to the ACA system.
   */
  async submitTask(goal: string, options?: TaskSubmitOptions): Promise<TaskSubmitResult> {
    const body = {
      name: goal,
      description: options?.description ?? goal,
      type: options?.type,
      targetTeam: options?.targetTeam,
    };
    return this.request<TaskSubmitResult>('POST', '/api/tasks', body);
  }

  /**
   * Get a snapshot of the current system state.
   */
  async getStatus(): Promise<SnapshotData> {
    return this.request<SnapshotData>('GET', '/api/snapshot');
  }

  /**
   * Get all registered agents.
   */
  async getAgents(): Promise<{ agents: AgentInfo[] }> {
    return this.request<{ agents: AgentInfo[] }>('GET', '/api/agents');
  }

  /**
   * Get a specific agent by ID.
   */
  async getAgent(id: string): Promise<AgentInfo> {
    return this.request<AgentInfo>('GET', `/api/agents/${encodeURIComponent(id)}`);
  }

  /**
   * Subscribe to Server-Sent Events for real-time updates.
   * Returns a function to unsubscribe.
   */
  subscribeSSE(callback: SSECallback): () => void {
    const url = new URL('/api/sse', this.serverUrl);
    const transport = url.protocol === 'https:' ? https : http;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      },
    };

    const req = transport.request(options, (res) => {
      let buffer = '';

      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentData = line.slice(5).trim();
          } else if (line === '' && currentData) {
            try {
              const parsed = JSON.parse(currentData);
              callback({ event: currentEvent || 'message', data: parsed });
            } catch {
              callback({ event: currentEvent || 'message', data: currentData });
            }
            currentEvent = '';
            currentData = '';
          }
        }
      });

      res.on('end', () => {
        this.sseRequest = null;
      });
    });

    req.on('error', () => {
      this.sseRequest = null;
    });

    req.end();
    this.sseRequest = req;

    return () => {
      req.destroy();
      if (this.sseRequest === req) {
        this.sseRequest = null;
      }
    };
  }

  /**
   * Register a listener for connection state changes.
   * Returns a function to unsubscribe.
   */
  onConnectionChange(callback: ConnectionChangeCallback): () => void {
    this.connectionListeners.push(callback);
    return () => {
      const idx = this.connectionListeners.indexOf(callback);
      if (idx >= 0) this.connectionListeners.splice(idx, 1);
    };
  }

  /**
   * Update the server URL (e.g. when settings change).
   */
  setServerUrl(url: string): void {
    this.serverUrl = url.replace(/\/+$/, '');
  }

  // ── Private Helpers ──────────────────────────────────────────

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.connectionListeners) {
      listener(state);
    }
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const url = new URL(path, this.serverUrl);
      const transport = url.protocol === 'https:' ? https : http;
      const payload = body ? JSON.stringify(body) : undefined;

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        },
      };

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(parsed.error ?? `Server responded with status ${res.statusCode}`));
            } else {
              resolve(parsed as T);
            }
          } catch {
            reject(new Error(`Invalid JSON response from server: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Request failed: ${err.message}`));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }
}
