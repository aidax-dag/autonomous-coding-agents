import { NatsClient, NatsClientConfig } from '@/shared/messaging/nats-client';
import { RetentionPolicy, StorageType } from 'nats';

// Import mock reset function
const natsMock = jest.requireMock('nats') as { __resetMockState?: () => void };

/**
 * NATS Client Tests
 *
 * Unit tests using mocked NATS package.
 * For integration tests with a real NATS server, see tests/integration/
 *
 * Feature: F1.1 - NATS Message Broker Client
 */

// Suppress console logs during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('NatsClient', () => {
  let client: NatsClient;
  const testConfig: NatsClientConfig = {
    url: 'nats://localhost:4222',
    reconnect: true,
    maxReconnectAttempts: 5,
    reconnectTimeWait: 1000,
  };

  beforeEach(async () => {
    // Reset mock state before each test
    if (natsMock.__resetMockState) {
      natsMock.__resetMockState();
    }
    client = new NatsClient(testConfig);
    await client.connect();
  });

  afterEach(async () => {
    await client.close();
  });

  describe('Connection Management', () => {
    it('should connect to NATS server successfully', async () => {
      const stats = client.getStats();
      expect(stats).not.toBeNull();
      expect(stats?.connected).toBe(true);
    });

    it('should return isConnected true when connected', () => {
      expect(client.isConnected()).toBe(true);
    });

    it('should throw error when connecting twice', async () => {
      await expect(client.connect()).rejects.toThrow('Already connected to NATS');
    });

    it('should throw error when publishing without connection', async () => {
      await client.close();
      await expect(client.publish('test', { data: 'test' })).rejects.toThrow(
        'Not connected to NATS'
      );
    });
  });

  describe('Core NATS Pub/Sub', () => {
    it('should subscribe to a subject', async () => {
      const receivedMessages: unknown[] = [];

      await client.subscribe('test.core.subject', async (data) => {
        receivedMessages.push(data);
      });

      const stats = client.getStats();
      expect(stats?.subscriptions).toBe(1);
    });

    it('should handle multiple subscribers on same subject', async () => {
      await client.subscribe('test.multi.subject', async () => {});
      await client.subscribe('test.multi.subject', async () => {});

      const stats = client.getStats();
      // Each subscribe creates a new subscription entry
      expect(stats?.subscriptions).toBeGreaterThanOrEqual(1);
    });

    it('should publish messages', async () => {
      const testData = { message: 'Hello, NATS!', timestamp: Date.now() };

      // Should not throw
      await expect(
        client.publish('test.core.subject', testData)
      ).resolves.not.toThrow();
    });

    it('should unsubscribe from subject', async () => {
      await client.subscribe('test.unsub', async () => {});

      const stats1 = client.getStats();
      expect(stats1?.subscriptions).toBe(1);

      await client.unsubscribe('test.unsub');

      const stats2 = client.getStats();
      expect(stats2?.subscriptions).toBe(0);
    });
  });

  describe('JetStream Operations', () => {
    const streamName = 'TEST_STREAM';
    const streamSubjects = ['test.stream.*'];

    it('should create a JetStream stream', async () => {
      await expect(
        client.createStream({
          name: streamName,
          subjects: streamSubjects,
          retention: RetentionPolicy.Workqueue as any,
          storage: StorageType.Memory as any,
        })
      ).resolves.not.toThrow();
    });

    it('should handle duplicate stream creation gracefully', async () => {
      // Create stream twice - should not throw
      await client.createStream({
        name: streamName,
        subjects: streamSubjects,
      });

      await expect(
        client.createStream({
          name: streamName,
          subjects: streamSubjects,
        })
      ).resolves.not.toThrow();
    });

    it('should publish to JetStream', async () => {
      await client.createStream({
        name: streamName,
        subjects: streamSubjects,
      });

      const testData = { persistent: true, value: 'test' };

      await expect(
        client.publishToStream('test.stream.msg', testData)
      ).resolves.not.toThrow();
    });

    it('should create consumer', async () => {
      await client.createStream({
        name: streamName,
        subjects: streamSubjects,
      });

      await expect(
        client.createConsumer(
          {
            streamName,
            consumerName: 'test-consumer',
            filterSubject: 'test.stream.consumer',
          },
          async () => {}
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when using JetStream without connection', async () => {
      const disconnectedClient = new NatsClient(testConfig);

      await expect(
        disconnectedClient.publishToStream('test', {})
      ).rejects.toThrow('JetStream not initialized');

      await expect(
        disconnectedClient.createStream({
          name: 'TEST',
          subjects: ['test'],
        })
      ).rejects.toThrow('Not connected to NATS or JetStream not initialized');
    });
  });

  describe('Resource Cleanup', () => {
    it('should close connection cleanly', async () => {
      const testClient = new NatsClient(testConfig);
      await testClient.connect();

      expect(testClient.isConnected()).toBe(true);

      await testClient.close();

      expect(testClient.isConnected()).toBe(false);
    });

    it('should handle multiple close calls gracefully', async () => {
      await client.close();
      await expect(client.close()).resolves.not.toThrow();
    });
  });

  describe('Stats and Monitoring', () => {
    it('should return accurate connection stats', async () => {
      const stats = client.getStats();

      expect(stats).not.toBeNull();
      expect(stats?.connected).toBe(true);
      expect(stats?.subscriptions).toBe(0);

      await client.subscribe('test.stats', async () => {});

      const stats2 = client.getStats();
      expect(stats2?.subscriptions).toBe(1);
    });

    it('should return null stats when not connected', async () => {
      const disconnectedClient = new NatsClient(testConfig);
      const stats = disconnectedClient.getStats();

      expect(stats).toBeNull();
    });
  });

  describe('Request-Reply Pattern', () => {
    it('should send request and receive reply', async () => {
      const response = await client.request('test.request', 'test-data');

      expect(response).toBeDefined();
      expect(response.data).toBeInstanceOf(Uint8Array);
      expect(response.subject).toBeDefined();
    });

    it('should throw error when requesting without connection', async () => {
      await client.close();

      await expect(
        client.request('test.request', 'test-data')
      ).rejects.toThrow('Not connected to NATS');
    });
  });
});
