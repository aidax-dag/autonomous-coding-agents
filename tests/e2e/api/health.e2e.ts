/**
 * Health Check E2E Tests
 *
 * Tests for the /api/v1/health endpoint
 */

import { test, expect } from '@playwright/test';
import { ApiClient, assertSuccess } from '../utils/api-client';

test.describe('Health Check API', () => {
  let api: ApiClient;

  test.beforeEach(async ({ request }) => {
    api = new ApiClient(request);
  });

  test('should return healthy status', async () => {
    const response = await api.get('/health');

    assertSuccess(response);
    expect(response.data).toHaveProperty('status', 'healthy');
    expect(response.data).toHaveProperty('uptime');
    expect(response.data).toHaveProperty('startedAt');
    expect(response.data).toHaveProperty('requestsServed');
  });

  test('should return 200 status code', async () => {
    const response = await api.getRaw('/health');

    expect(response.status()).toBe(200);
  });

  test('should include request metadata', async () => {
    const response = await api.get('/health');

    expect(response.meta).toBeDefined();
    expect(response.meta?.requestId).toBeDefined();
    expect(response.meta?.timestamp).toBeDefined();
  });

  test('should have valid uptime', async () => {
    const response = await api.get<{ uptime: number }>('/health');

    assertSuccess(response);
    expect(response.data.uptime).toBeGreaterThanOrEqual(0);
  });

  test('should have valid timestamp format', async () => {
    const response = await api.get('/health');

    assertSuccess(response);
    const timestamp = response.meta?.timestamp;
    expect(timestamp).toBeDefined();
    expect(() => new Date(timestamp!)).not.toThrow();
  });

  test('should increment request counter', async () => {
    // Make first request
    const first = await api.get<{ requestsServed: number }>('/health');
    assertSuccess(first);
    const firstCount = first.data.requestsServed;

    // Make second request
    const second = await api.get<{ requestsServed: number }>('/health');
    assertSuccess(second);
    const secondCount = second.data.requestsServed;

    expect(secondCount).toBeGreaterThan(firstCount);
  });

  test('should include server details', async () => {
    const response = await api.get<{ details: Record<string, unknown> }>('/health');

    assertSuccess(response);
    expect(response.data.details).toBeDefined();
    expect(response.data.details).toHaveProperty('version');
    expect(response.data.details).toHaveProperty('nodeVersion');
  });
});
