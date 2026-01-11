/**
 * Agents API E2E Tests
 *
 * Tests for the /api/v1/agents endpoints
 */

import { test, expect } from '@playwright/test';
import { ApiClient, assertSuccess, assertError, assertPaginated } from '../utils/api-client';
import { sampleAgents, createUniqueAgent, invalidData, AGENT_TYPES } from '../fixtures/test-data';

test.describe('Agents API', () => {
  let api: ApiClient;
  const createdAgentIds: string[] = [];

  test.beforeEach(async ({ request }) => {
    api = new ApiClient(request);
  });

  test.afterEach(async () => {
    // Cleanup created agents
    for (const id of createdAgentIds) {
      try {
        await api.delete(`/agents/${id}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    createdAgentIds.length = 0;
  });

  test.describe('GET /agents', () => {
    test('should return list of agents', async () => {
      const response = await api.get<unknown[]>('/agents');

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('should support pagination', async () => {
      const response = await api.get<unknown[]>('/agents', {
        page: '1',
        limit: '10',
      });

      assertSuccess(response);
      assertPaginated(response);
    });

    test('should limit results', async () => {
      const response = await api.get<unknown[]>('/agents', {
        limit: '5',
      });

      assertSuccess(response);
      expect(response.data.length).toBeLessThanOrEqual(5);
    });

    test('should return empty array when no agents', async () => {
      const response = await api.get<unknown[]>('/agents', {
        page: '9999', // High page number to get empty results
      });

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  test.describe('POST /agents', () => {
    test('should create a new agent', async () => {
      const agentData = createUniqueAgent('coder');
      const response = await api.post<{ id: string }>('/agents', agentData);

      assertSuccess(response);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('type', agentData.type);
      expect(response.data).toHaveProperty('name', agentData.name);

      createdAgentIds.push(response.data.id);
    });

    test('should return 201 status on creation', async () => {
      const agentData = createUniqueAgent('architect');
      const response = await api.postRaw('/agents', agentData);

      expect(response.status()).toBe(201);

      const body = await response.json();
      if (body.data?.id) {
        createdAgentIds.push(body.data.id);
      }
    });

    test('should reject invalid agent type', async () => {
      const response = await api.post('/agents', invalidData.invalidAgentType);

      assertError(response, 'VALIDATION_FAILED');
    });

    test('should reject empty required fields', async () => {
      const response = await api.post('/agents', invalidData.emptyAgent);

      assertError(response, 'VALIDATION_FAILED');
    });

    test('should reject missing required fields', async () => {
      const response = await api.post('/agents', invalidData.missingRequired);

      assertError(response, 'VALIDATION_FAILED');
    });

    for (const agentType of AGENT_TYPES) {
      test(`should create ${agentType} agent`, async () => {
        const agentData = createUniqueAgent(agentType);
        const response = await api.post<{ id: string; type: string }>('/agents', agentData);

        assertSuccess(response);
        expect(response.data.type).toBe(agentType);

        createdAgentIds.push(response.data.id);
      });
    }
  });

  test.describe('GET /agents/:id', () => {
    test('should get agent by ID', async () => {
      // First create an agent
      const agentData = createUniqueAgent('reviewer');
      const createResponse = await api.post<{ id: string }>('/agents', agentData);
      assertSuccess(createResponse);
      const agentId = createResponse.data.id;
      createdAgentIds.push(agentId);

      // Then fetch it
      const response = await api.get<{ id: string; name: string }>(`/agents/${agentId}`);

      assertSuccess(response);
      expect(response.data.id).toBe(agentId);
      expect(response.data.name).toBe(agentData.name);
    });

    test('should return 404 for non-existent agent', async () => {
      const response = await api.getRaw('/agents/00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('PATCH /agents/:id', () => {
    test('should update agent', async () => {
      // Create agent
      const agentData = createUniqueAgent('coder');
      const createResponse = await api.post<{ id: string }>('/agents', agentData);
      assertSuccess(createResponse);
      const agentId = createResponse.data.id;
      createdAgentIds.push(agentId);

      // Update agent
      const updateData = { name: 'Updated Agent Name' };
      const response = await api.patch<{ id: string; name: string }>(`/agents/${agentId}`, updateData);

      assertSuccess(response);
      expect(response.data.name).toBe(updateData.name);
    });

    test('should return 404 for non-existent agent', async () => {
      const response = await api.patchRaw('/agents/00000000-0000-0000-0000-000000000000', { name: 'Test' });

      expect(response.status()).toBe(404);
    });
  });

  test.describe('DELETE /agents/:id', () => {
    test('should delete agent', async () => {
      // Create agent
      const agentData = createUniqueAgent('tester');
      const createResponse = await api.post<{ id: string }>('/agents', agentData);
      assertSuccess(createResponse);
      const agentId = createResponse.data.id;

      // Delete agent
      const deleteResponse = await api.delete(`/agents/${agentId}`);
      expect(deleteResponse.success).toBe(true);

      // Verify deleted
      const getResponse = await api.getRaw(`/agents/${agentId}`);
      expect(getResponse.status()).toBe(404);
    });

    test('should return 404 for non-existent agent', async () => {
      const response = await api.getRaw('/agents/00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('Agent Actions', () => {
    test('should start agent', async () => {
      // Create and start agent
      const agentData = createUniqueAgent('coder');
      const createResponse = await api.post<{ id: string }>('/agents', agentData);
      assertSuccess(createResponse);
      const agentId = createResponse.data.id;
      createdAgentIds.push(agentId);

      const response = await api.post<{ status: string }>(`/agents/${agentId}/start`);
      assertSuccess(response);
      expect(response.data.status).toBe('processing');
    });

    test('should stop agent', async () => {
      // Create, start, then stop agent
      const agentData = createUniqueAgent('coder');
      const createResponse = await api.post<{ id: string }>('/agents', agentData);
      assertSuccess(createResponse);
      const agentId = createResponse.data.id;
      createdAgentIds.push(agentId);

      await api.post(`/agents/${agentId}/start`);
      const response = await api.post<{ status: string }>(`/agents/${agentId}/stop`);

      assertSuccess(response);
      expect(response.data.status).toBe('stopped');
    });

    test('should get agent health', async () => {
      const agentData = createUniqueAgent('coder');
      const createResponse = await api.post<{ id: string }>('/agents', agentData);
      assertSuccess(createResponse);
      const agentId = createResponse.data.id;
      createdAgentIds.push(agentId);

      const response = await api.get<{ status: string }>(`/agents/${agentId}/health`);

      assertSuccess(response);
      expect(response.data).toHaveProperty('status');
    });
  });
});
