/**
 * Hooks API E2E Tests
 *
 * Tests for the /api/v1/hooks endpoints
 */

import { test, expect } from '@playwright/test';
import { ApiClient, assertSuccess, assertError, assertPaginated } from '../utils/api-client';
import { sampleHooks, createUniqueHook, HOOK_TYPES } from '../fixtures/test-data';

test.describe('Hooks API', () => {
  let api: ApiClient;
  const createdHookIds: string[] = [];

  test.beforeEach(async ({ request }) => {
    api = new ApiClient(request);
  });

  test.afterEach(async () => {
    // Cleanup created hooks
    for (const id of createdHookIds) {
      try {
        await api.delete(`/hooks/${id}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    createdHookIds.length = 0;
  });

  test.describe('GET /hooks', () => {
    test('should return list of hooks', async () => {
      const response = await api.get<unknown[]>('/hooks');

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('should support pagination', async () => {
      const response = await api.get<unknown[]>('/hooks', {
        page: '1',
        limit: '10',
      });

      assertSuccess(response);
      assertPaginated(response);
    });

    test('should filter by type', async () => {
      const response = await api.get<unknown[]>('/hooks', {
        type: 'pre-execution',
      });

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('should filter by event', async () => {
      const response = await api.get<unknown[]>('/hooks', {
        event: 'agent.start',
      });

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  test.describe('POST /hooks', () => {
    test('should create a new hook', async () => {
      const hookData = createUniqueHook('preExecution');
      const response = await api.post<{ id: string }>('/hooks', hookData);

      assertSuccess(response);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('type', hookData.type);

      createdHookIds.push(response.data.id);
    });

    test('should return 201 status on creation', async () => {
      const hookData = createUniqueHook('postExecution');
      const response = await api.postRaw('/hooks', hookData);

      expect(response.status()).toBe(201);

      const body = await response.json();
      if (body.data?.id) {
        createdHookIds.push(body.data.id);
      }
    });

    test.skip('should reject invalid hook type', async () => {
      const invalidHook = {
        name: 'Invalid Hook',
        type: 'invalid-type',
        event: 'agent.start',
        handler: 'console.log("test")',
      };

      const response = await api.post('/hooks', invalidHook);

      assertError(response, 'VALIDATION_ERROR');
    });

    test.skip('should reject hook without handler', async () => {
      const invalidHook = {
        name: 'No Handler Hook',
        type: 'pre-execution',
        event: 'agent.start',
      };

      const response = await api.post('/hooks', invalidHook);

      assertError(response, 'VALIDATION_ERROR');
    });

    for (const hookType of HOOK_TYPES) {
      test(`should create ${hookType} hook`, async () => {
        const hookData = createUniqueHook(hookType);
        const response = await api.post<{ id: string; type: string }>('/hooks', hookData);

        assertSuccess(response);
        expect(response.data.type).toBe(hookData.type);

        createdHookIds.push(response.data.id);
      });
    }
  });

  test.describe('GET /hooks/:id', () => {
    test('should get hook by ID', async () => {
      // Create hook
      const hookData = createUniqueHook('preExecution');
      const createResponse = await api.post<{ id: string }>('/hooks', hookData);
      assertSuccess(createResponse);
      const hookId = createResponse.data.id;
      createdHookIds.push(hookId);

      // Fetch hook
      const response = await api.get<{ id: string; name: string }>(`/hooks/${hookId}`);

      assertSuccess(response);
      expect(response.data.id).toBe(hookId);
      expect(response.data.name).toBe(hookData.name);
    });

    test('should return 404 for non-existent hook', async () => {
      const response = await api.getRaw('/hooks/non-existent-id-12345');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('PUT /hooks/:id', () => {
    test('should update hook', async () => {
      // Create hook
      const hookData = createUniqueHook('preExecution');
      const createResponse = await api.post<{ id: string }>('/hooks', hookData);
      assertSuccess(createResponse);
      const hookId = createResponse.data.id;
      createdHookIds.push(hookId);

      // Update hook
      const updateData = {
        name: 'Updated Hook Name',
        enabled: false,
      };
      const response = await api.put<{ id: string; name: string; enabled: boolean }>(
        `/hooks/${hookId}`,
        updateData
      );

      assertSuccess(response);
      expect(response.data.name).toBe(updateData.name);
      expect(response.data.enabled).toBe(updateData.enabled);
    });
  });

  test.describe('DELETE /hooks/:id', () => {
    test('should delete hook', async () => {
      // Create hook
      const hookData = createUniqueHook('postExecution');
      const createResponse = await api.post<{ id: string }>('/hooks', hookData);
      assertSuccess(createResponse);
      const hookId = createResponse.data.id;

      // Delete hook
      const deleteResponse = await api.delete(`/hooks/${hookId}`);
      expect(deleteResponse.success).toBe(true);

      // Verify deleted
      const getResponse = await api.getRaw(`/hooks/${hookId}`);
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Hook Execution', () => {
    test.skip('should trigger hook on event', async () => {
      // Create hook
      const hookData = createUniqueHook('preExecution');
      const createResponse = await api.post<{ id: string }>('/hooks', hookData);
      assertSuccess(createResponse);
      const hookId = createResponse.data.id;
      createdHookIds.push(hookId);

      // Trigger event (by creating an agent which triggers 'agent.start')
      const agentResponse = await api.post('/agents', {
        name: 'Test Agent',
        type: 'coder',
        config: {},
      });
      assertSuccess(agentResponse);

      // Get hook execution history
      const response = await api.get<unknown[]>(`/hooks/${hookId}/executions`);

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test.skip('should enable/disable hook', async () => {
      // Create hook
      const hookData = createUniqueHook('preExecution');
      const createResponse = await api.post<{ id: string }>('/hooks', hookData);
      assertSuccess(createResponse);
      const hookId = createResponse.data.id;
      createdHookIds.push(hookId);

      // Disable hook
      const disableResponse = await api.post<{ enabled: boolean }>(`/hooks/${hookId}/disable`);
      assertSuccess(disableResponse);
      expect(disableResponse.data.enabled).toBe(false);

      // Enable hook
      const enableResponse = await api.post<{ enabled: boolean }>(`/hooks/${hookId}/enable`);
      assertSuccess(enableResponse);
      expect(enableResponse.data.enabled).toBe(true);
    });
  });
});
