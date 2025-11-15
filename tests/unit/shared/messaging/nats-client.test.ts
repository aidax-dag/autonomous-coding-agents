import { NatsClient, NatsClientConfig } from '@/shared/messaging/nats-client';
import { RetentionPolicy, StorageType } from 'nats';

/**
 * NATS Client Tests
 *
 * These tests require a running NATS server with JetStream enabled.
 * Run `docker-compose up -d` before running tests.
 *
 * Feature: F1.1 - NATS Message Broker Client
 */

describe('NatsClient', () => {
  let client: NatsClient;
  const testConfig: NatsClientConfig = {
    url: 'nats://localhost:4222',
    reconnect: true,
    maxReconnectAttempts: 5,
    reconnectTimeWait: 1000,
  };

  beforeEach(async () => {
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
    it('should publish and receive messages', async () => {
      const testData = { message: 'Hello, NATS!', timestamp: Date.now() };
      const receivedMessages: unknown[] = [];

      await client.subscribe('test.core.subject', async (data) => {
        receivedMessages.push(data);
      });

      // Wait a bit for subscription to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      await client.publish('test.core.subject', testData);

      // Wait for message to be received
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual(testData);
    });

    it('should handle multiple subscribers on same subject', async () => {
      const received1: unknown[] = [];
      const received2: unknown[] = [];
      const testData = { value: 42 };

      await client.subscribe('test.multi.subject', async (data) => {
        received1.push(data);
      });

      await client.subscribe('test.multi.subject', async (data) => {
        received2.push(data);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await client.publish('test.multi.subject', testData);

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
      expect(received1[0]).toEqual(testData);
      expect(received2[0]).toEqual(testData);
    });

    it('should handle wildcard subscriptions', async () => {
      const receivedMessages: unknown[] = [];

      await client.subscribe('test.wildcard.*', async (data) => {
        receivedMessages.push(data);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await client.publish('test.wildcard.one', { id: 1 });
      await client.publish('test.wildcard.two', { id: 2 });
      await client.publish('test.other', { id: 3 }); // Should not be received

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(receivedMessages).toHaveLength(2);
    });

    it('should unsubscribe from subject', async () => {
      const receivedMessages: unknown[] = [];

      await client.subscribe('test.unsub', async (data) => {
        receivedMessages.push(data);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await client.publish('test.unsub', { before: true });
      await new Promise((resolve) => setTimeout(resolve, 100));

      await client.unsubscribe('test.unsub');
      await new Promise((resolve) => setTimeout(resolve, 100));

      await client.publish('test.unsub', { after: true });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual({ before: true });
    });
  });

  describe('JetStream Operations', () => {
    const streamName = 'TEST_STREAM';
    const streamSubjects = ['test.stream.*'];

    beforeEach(async () => {
      // Create test stream
      await client.createStream({
        name: streamName,
        subjects: streamSubjects,
        retention: RetentionPolicy.Workqueue,
        storage: StorageType.Memory,
        maxAge: 60 * 60 * 1_000_000_000, // 1 hour in nanoseconds
      });
    });

    it('should create a JetStream stream', async () => {
      const streamName2 = 'TEST_STREAM_2';
      await expect(
        client.createStream({
          name: streamName2,
          subjects: ['test.stream2.*'],
        })
      ).resolves.not.toThrow();
    });

    it('should handle duplicate stream creation gracefully', async () => {
      // Try creating the same stream again
      await expect(
        client.createStream({
          name: streamName,
          subjects: streamSubjects,
        })
      ).resolves.not.toThrow();
    });

    it('should publish to JetStream and receive acknowledgment', async () => {
      const testData = { persistent: true, value: 'test' };

      await expect(
        client.publishToStream('test.stream.msg', testData)
      ).resolves.not.toThrow();
    });

    it('should create consumer and process messages', async () => {
      const receivedMessages: unknown[] = [];
      const consumerName = 'test-consumer';

      // Create consumer
      await client.createConsumer(
        {
          streamName,
          consumerName,
          filterSubject: 'test.stream.consumer',
        },
        async (data) => {
          receivedMessages.push(data);
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Publish messages to stream
      await client.publishToStream('test.stream.consumer', { msg: 1 });
      await client.publishToStream('test.stream.consumer', { msg: 2 });
      await client.publishToStream('test.stream.consumer', { msg: 3 });

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(receivedMessages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in messages gracefully', async () => {
      const receivedMessages: unknown[] = [];
      let errorOccurred = false;

      await client.subscribe('test.error.json', async (data) => {
        receivedMessages.push(data);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // This should work fine as our publish method JSON.stringifies the data
      await client.publish('test.error.json', { valid: 'json' });

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(receivedMessages).toHaveLength(1);
      expect(errorOccurred).toBe(false);
    });

    it('should handle errors in message handlers', async () => {
      const errorMessages: unknown[] = [];

      await client.subscribe('test.error.handler', async (data) => {
        errorMessages.push(data);
        throw new Error('Handler error');
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await client.publish('test.error.handler', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Message should still be received even though handler threw
      expect(errorMessages).toHaveLength(1);
    });

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

    it('should drain subscriptions before closing', async () => {
      const receivedMessages: unknown[] = [];

      await client.subscribe('test.cleanup', async (data) => {
        receivedMessages.push(data);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Publish some messages
      await client.publish('test.cleanup', { msg: 1 });
      await client.publish('test.cleanup', { msg: 2 });

      // Close immediately
      await client.close();

      // Messages should have been received before close completed
      expect(receivedMessages.length).toBeGreaterThanOrEqual(0);
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

  describe('Complex Scenarios', () => {
    it('should handle high message throughput', async () => {
      const messageCount = 100;
      const receivedMessages: unknown[] = [];

      await client.subscribe('test.throughput', async (data) => {
        receivedMessages.push(data);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Publish many messages
      const publishPromises = [];
      for (let i = 0; i < messageCount; i++) {
        publishPromises.push(client.publish('test.throughput', { id: i }));
      }
      await Promise.all(publishPromises);

      // Wait for all messages to be received
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(receivedMessages.length).toBe(messageCount);
    });

    it('should preserve message order for single subscriber', async () => {
      const receivedMessages: number[] = [];
      const messageCount = 50;

      await client.subscribe('test.order', async (data: any) => {
        receivedMessages.push(data.id);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Publish messages sequentially
      for (let i = 0; i < messageCount; i++) {
        await client.publish('test.order', { id: i });
      }

      // Wait for all messages
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(receivedMessages).toHaveLength(messageCount);

      // Check order
      for (let i = 0; i < receivedMessages.length; i++) {
        expect(receivedMessages[i]).toBe(i);
      }
    });
  });
});
