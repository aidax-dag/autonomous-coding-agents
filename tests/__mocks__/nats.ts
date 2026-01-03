/**
 * Mock for nats ESM module
 *
 * Provides a comprehensive mock for NATS client testing without requiring a real server.
 */

// Store for mock subscriptions and messages
const mockSubscriptions = new Map<string, jest.Mock[]>();
const mockMessages: Array<{ subject: string; data: Uint8Array }> = [];

// Mock StringCodec
export const StringCodec = jest.fn(() => ({
  encode: jest.fn((str: string) => new TextEncoder().encode(str)),
  decode: jest.fn((data: Uint8Array) => new TextDecoder().decode(data)),
}));

// Mock subscription iterator
const createMockSubscription = (subject: string) => {
  const handlers: jest.Mock[] = [];
  mockSubscriptions.set(subject, handlers);

  const subscription = {
    drain: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn(),
    [Symbol.asyncIterator]: jest.fn().mockImplementation(() => {
      let messageIndex = 0;
      return {
        next: jest.fn().mockImplementation(async () => {
          // Return messages that match the subject pattern
          while (messageIndex < mockMessages.length) {
            const msg = mockMessages[messageIndex++];
            if (matchSubject(subject, msg.subject)) {
              return {
                done: false,
                value: {
                  subject: msg.subject,
                  data: msg.data,
                  respond: jest.fn(),
                  ack: jest.fn(),
                  nak: jest.fn(),
                },
              };
            }
          }
          // Keep iterator alive but don't return more messages
          return new Promise(() => {}); // Never resolves, simulating waiting for messages
        }),
      };
    }),
  };

  return subscription;
};

// Helper to match NATS subject patterns
function matchSubject(pattern: string, subject: string): boolean {
  const patternParts = pattern.split('.');
  const subjectParts = subject.split('.');

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '*') {
      if (subjectParts[i] === undefined) return false;
      continue;
    }
    if (patternParts[i] === '>') {
      return true;
    }
    if (patternParts[i] !== subjectParts[i]) {
      return false;
    }
  }

  return patternParts.length === subjectParts.length;
}

// Mock JetStream client
const createMockJetStreamClient = () => ({
  publish: jest.fn().mockResolvedValue({ seq: 1, duplicate: false }),
  consumers: {
    get: jest.fn().mockResolvedValue({
      consume: jest.fn().mockResolvedValue({
        [Symbol.asyncIterator]: () => ({
          next: jest.fn().mockImplementation(async () => {
            return new Promise(() => {}); // Never resolves
          }),
        }),
      }),
    }),
  },
});

// Mock JetStream manager
const createMockJetStreamManager = () => ({
  streams: {
    add: jest.fn().mockResolvedValue({ config: {} }),
    update: jest.fn().mockResolvedValue({ config: {} }),
    delete: jest.fn().mockResolvedValue(true),
    info: jest.fn().mockResolvedValue({ config: {} }),
  },
  consumers: {
    add: jest.fn().mockResolvedValue({ name: 'test-consumer' }),
    delete: jest.fn().mockResolvedValue(true),
    info: jest.fn().mockResolvedValue({ name: 'test-consumer' }),
  },
});

// Mock NATS connection
const createMockConnection = () => {
  let isClosed = false;

  const connection = {
    isClosed: jest.fn(() => isClosed),
    close: jest.fn().mockImplementation(async () => {
      isClosed = true;
    }),
    drain: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockImplementation((subject: string, data: Uint8Array) => {
      mockMessages.push({ subject, data });
      // Trigger handlers for matching subscriptions
      for (const [pattern, handlers] of mockSubscriptions.entries()) {
        if (matchSubject(pattern, subject)) {
          handlers.forEach((handler) => handler({ subject, data }));
        }
      }
    }),
    subscribe: jest.fn().mockImplementation((subject: string) => {
      return createMockSubscription(subject);
    }),
    request: jest.fn().mockImplementation(async (_subject: string, _data: Uint8Array) => {
      return {
        subject: `_INBOX.${Math.random().toString(36).substring(7)}`,
        data: new TextEncoder().encode(JSON.stringify({ response: 'ok' })),
      };
    }),
    status: jest.fn().mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: jest.fn().mockImplementation(async () => {
          return new Promise(() => {}); // Never resolves
        }),
      }),
    }),
    jetstream: jest.fn().mockReturnValue(createMockJetStreamClient()),
    jetstreamManager: jest.fn().mockResolvedValue(createMockJetStreamManager()),
  };

  return connection;
};

// Mock connect function
export const connect = jest.fn().mockImplementation(async () => {
  // Clear previous state
  mockSubscriptions.clear();
  mockMessages.length = 0;
  return createMockConnection();
});

// Export enums
export const RetentionPolicy = {
  Limits: 'limits',
  Interest: 'interest',
  Workqueue: 'workqueue',
};

export const StorageType = {
  File: 'file',
  Memory: 'memory',
};

export const AckPolicy = {
  Explicit: 'explicit',
  None: 'none',
  All: 'all',
};

export const DeliverPolicy = {
  All: 'all',
  Last: 'last',
  New: 'new',
  ByStartSequence: 'by_start_sequence',
  ByStartTime: 'by_start_time',
  LastPerSubject: 'last_per_subject',
};

export const ReplayPolicy = {
  Instant: 'instant',
  Original: 'original',
};

// Helper to reset mock state (useful in beforeEach)
export const __resetMockState = () => {
  mockSubscriptions.clear();
  mockMessages.length = 0;
  connect.mockClear();
};

export default {
  connect,
  StringCodec,
  RetentionPolicy,
  StorageType,
  AckPolicy,
  DeliverPolicy,
  ReplayPolicy,
  __resetMockState,
};
