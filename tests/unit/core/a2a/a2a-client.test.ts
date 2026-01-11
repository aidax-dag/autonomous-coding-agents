/**
 * A2A Client Tests
 *
 * @module tests/unit/core/a2a/a2a-client
 */

import {
  createA2AClient,
  A2AClientStatus,
  A2AClientEvents,
  A2AClientConfigSchema,
} from '../../../../src/core/a2a';

// ============================================================================
// Mock fetch
// ============================================================================

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    body: null,
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: jest.fn(),
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
  } as unknown as Response;
}

function createMockServerInfo() {
  return {
    version: '1.0.0',
    protocol: 'a2a',
    status: 'running',
    host: 'localhost',
    port: 3000,
    streaming: true,
    pushNotifications: false,
  };
}

function createMockAgentCard(id: string, name: string) {
  return {
    name,
    description: `${name} agent`,
    url: `http://localhost:3000/agents/${id}`,
    version: '1.0.0',
    capabilities: [{ name: 'test', description: 'Test capability' }],
    skills: [],
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    supportsStreaming: false,
    supportsPushNotifications: false,
  };
}

function createMockTaskResult(taskId: string, agentId = 'agent-1') {
  return {
    taskId,
    status: 'completed',
    artifacts: [
      {
        id: 'artifact-1',
        name: 'Result',
        mimeType: 'text/plain',
        parts: [{ type: 'text', content: 'Result content' }],
      },
    ],
    metadata: {
      agentId,
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 100,
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('A2AClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      const client = createA2AClient();
      expect(client.getStatus()).toBe(A2AClientStatus.DISCONNECTED);

      const config = client.getConfig();
      expect(config.timeout).toBe(30000);
      expect(config.retry.maxAttempts).toBe(3);
      expect(config.keepAlive.enabled).toBe(true);
    });

    it('should create client with custom config', () => {
      const client = createA2AClient({
        timeout: 60000,
        retry: { maxAttempts: 5 },
        keepAlive: { enabled: false },
      });

      const config = client.getConfig();
      expect(config.timeout).toBe(60000);
      expect(config.retry.maxAttempts).toBe(5);
      expect(config.keepAlive.enabled).toBe(false);
    });

    it('should validate config with schema', () => {
      expect(() => A2AClientConfigSchema.parse({ timeout: 500 })).toThrow();
      expect(() => A2AClientConfigSchema.parse({ timeout: 5000 })).not.toThrow();
    });
  });

  describe('connect', () => {
    it('should connect to server successfully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(createMockServerInfo()));

      const client = createA2AClient();
      const handler = jest.fn();
      client.on(A2AClientEvents.CONNECTED, handler);

      await client.connect('http://localhost:3000');

      expect(client.isConnected()).toBe(true);
      expect(client.getStatus()).toBe(A2AClientStatus.CONNECTED);
      expect(client.getServerUrl()).toBe('http://localhost:3000');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3000',
        })
      );
    });

    it('should remove trailing slash from URL', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(createMockServerInfo()));

      const client = createA2AClient();
      await client.connect('http://localhost:3000/');

      expect(client.getServerUrl()).toBe('http://localhost:3000');
    });

    it('should throw if already connected', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(createMockServerInfo()));

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      await expect(client.connect('http://localhost:3001')).rejects.toThrow('already connected');
    });

    it('should emit error on connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = createA2AClient();
      const errorHandler = jest.fn();
      client.on(A2AClientEvents.ERROR, errorHandler);

      await expect(client.connect('http://localhost:3000')).rejects.toThrow();

      expect(client.getStatus()).toBe(A2AClientStatus.ERROR);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(createMockServerInfo()));

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const handler = jest.fn();
      client.on(A2AClientEvents.DISCONNECTED, handler);

      await client.disconnect();

      expect(client.isConnected()).toBe(false);
      expect(client.getStatus()).toBe(A2AClientStatus.DISCONNECTED);
      expect(client.getServerUrl()).toBeNull();
      expect(handler).toHaveBeenCalled();
    });

    it('should do nothing if already disconnected', async () => {
      const client = createA2AClient();
      await client.disconnect();

      expect(client.getStatus()).toBe(A2AClientStatus.DISCONNECTED);
    });
  });

  describe('discoverAgents', () => {
    it('should return list of agents', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(
          createMockResponse({
            agents: [
              createMockAgentCard('agent-1', 'Agent 1'),
              createMockAgentCard('agent-2', 'Agent 2'),
            ],
          })
        );

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const agents = await client.discoverAgents();

      expect(agents).toHaveLength(2);
      expect(agents[0].name).toBe('Agent 1');
      expect(agents[1].name).toBe('Agent 2');
    });

    it('should throw if not connected', async () => {
      const client = createA2AClient();
      await expect(client.discoverAgents()).rejects.toThrow('not connected');
    });
  });

  describe('getAgentCard', () => {
    it('should return agent card', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(createMockResponse(createMockAgentCard('agent-1', 'Agent 1')));

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const card = await client.getAgentCard('agent-1');

      expect(card.name).toBe('Agent 1');
      expect(card.url).toContain('agent-1');
    });

    it('should throw if not connected', async () => {
      const client = createA2AClient();
      await expect(client.getAgentCard('agent-1')).rejects.toThrow('not connected');
    });
  });

  describe('findAgentsByCapability', () => {
    it('should return agents with capability', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(
          createMockResponse({
            jsonrpc: '2.0',
            id: 1,
            result: [createMockAgentCard('agent-1', 'Agent 1')],
          })
        );

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const agents = await client.findAgentsByCapability('code-generation');

      expect(agents).toHaveLength(1);
    });
  });

  describe('delegateTask', () => {
    it('should delegate task successfully', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(createMockResponse(createMockTaskResult('task-1')));

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const startHandler = jest.fn();
      const completeHandler = jest.fn();
      client.on(A2AClientEvents.TASK_STARTED, startHandler);
      client.on(A2AClientEvents.TASK_COMPLETED, completeHandler);

      const result = await client.delegateTask('agent-1', {
        id: 'task-1',
        message: { role: 'user', content: 'Generate code' },
      });

      expect(result.taskId).toBe('task-1');
      expect(result.status).toBe('completed');
      expect(startHandler).toHaveBeenCalled();
      expect(completeHandler).toHaveBeenCalled();
    });

    it('should emit error on failure', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(
          createMockResponse({ message: 'Agent not found' }, false, 404)
        );

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const failHandler = jest.fn();
      client.on(A2AClientEvents.TASK_FAILED, failHandler);

      await expect(
        client.delegateTask('agent-1', {
          id: 'task-1',
          message: { role: 'user', content: 'Generate code' },
        })
      ).rejects.toThrow();

      expect(failHandler).toHaveBeenCalled();
    });

    it('should include delegation options in metadata', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(createMockResponse(createMockTaskResult('task-1')));

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      await client.delegateTask(
        'agent-1',
        {
          id: 'task-1',
          message: { role: 'user', content: 'Generate code' },
        },
        {
          priority: 'high',
          metadata: { source: 'test' },
        }
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(requestBody.metadata.priority).toBe('high');
      expect(requestBody.metadata.targetAgentId).toBe('agent-1');
      expect(requestBody.metadata.source).toBe('test');
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(
          createMockResponse({ taskId: 'task-1', status: 'processing' })
        );

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const status = await client.getTaskStatus('task-1');

      expect(status.taskId).toBe('task-1');
      expect(status.status).toBe('processing');
    });
  });

  describe('cancelTask', () => {
    it('should cancel task successfully', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(
          createMockResponse({ taskId: 'task-1', cancelled: true })
        );

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const cancelled = await client.cancelTask('task-1');

      expect(cancelled).toBe(true);
    });

    it('should return false if task not found', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(
          createMockResponse({ taskId: 'task-1', cancelled: false })
        );

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const cancelled = await client.cancelTask('task-1');

      expect(cancelled).toBe(false);
    });
  });

  describe('getServerInfo', () => {
    it('should return server info', async () => {
      const serverInfo = createMockServerInfo();
      mockFetch
        .mockResolvedValueOnce(createMockResponse(serverInfo))
        .mockResolvedValueOnce(createMockResponse(serverInfo));

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const info = await client.getServerInfo();

      expect(info.version).toBe('1.0.0');
      expect(info.protocol).toBe('a2a');
      expect(info.streaming).toBe(true);
    });
  });

  describe('getServerStats', () => {
    it('should return server stats', async () => {
      const stats = {
        status: 'running',
        registeredAgents: 2,
        activeTasks: 1,
        completedTasks: 10,
        failedTasks: 0,
      };

      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(createMockResponse(stats));

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const result = await client.getServerStats();

      expect(result.registeredAgents).toBe(2);
      expect(result.activeTasks).toBe(1);
    });
  });

  describe('collaborate', () => {
    it('should collaborate with multiple agents', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(createMockResponse(createMockTaskResult('task-1')))
        .mockResolvedValueOnce(createMockResponse(createMockTaskResult('task-1')));

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const result = await client.collaborate(
        ['agent-1', 'agent-2'],
        {
          id: 'task-1',
          message: { role: 'user', content: 'Generate code' },
        }
      );

      expect(result.taskId).toBe('task-1');
      expect(result.participants).toEqual(['agent-1', 'agent-2']);
      expect(result.results.size).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should handle partial failures', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(createMockResponse(createMockTaskResult('task-1')))
        .mockResolvedValueOnce(
          createMockResponse({ message: 'Agent error' }, false, 500)
        );

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      const result = await client.collaborate(
        ['agent-1', 'agent-2'],
        {
          id: 'task-1',
          message: { role: 'user', content: 'Generate code' },
        }
      );

      expect(result.results.size).toBe(1);
      expect(result.success).toBe(false);
    });

    it('should throw if no agents provided', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(createMockServerInfo()));

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      await expect(
        client.collaborate([], {
          id: 'task-1',
          message: { role: 'user', content: 'Generate code' },
        })
      ).rejects.toThrow('At least one agent');
    });
  });

  describe('authentication', () => {
    it('should include API key header', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(createMockServerInfo()));

      const client = createA2AClient({
        authentication: {
          type: 'api_key',
          credentials: { apiKey: 'test-key' },
        },
      });

      await client.connect('http://localhost:3000');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'test-key',
          }),
        })
      );
    });

    it('should include bearer token header', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(createMockServerInfo()));

      const client = createA2AClient({
        authentication: {
          type: 'bearer_token',
          credentials: { token: 'test-token' },
        },
      });

      await client.connect('http://localhost:3000');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(
          createMockResponse({ message: 'Not found' }, false, 404)
        );

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      await expect(client.getAgentCard('unknown')).rejects.toThrow('Not found');
    });

    it('should handle RPC errors', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createMockServerInfo()))
        .mockResolvedValueOnce(
          createMockResponse({
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32001, message: 'Agent not found' },
          })
        );

      const client = createA2AClient();
      await client.connect('http://localhost:3000');

      await expect(client.findAgentsByCapability('unknown')).rejects.toThrow(
        'Agent not found'
      );
    });
  });

  describe('configuration', () => {
    it('should return a copy of config', () => {
      const client = createA2AClient({ timeout: 60000 });

      const config1 = client.getConfig();
      const config2 = client.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1.timeout).toBe(config2.timeout);
    });
  });
});
