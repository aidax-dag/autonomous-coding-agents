/**
 * Workflows API E2E Tests
 *
 * Tests for the /api/v1/workflows endpoints
 */

import { test, expect } from '@playwright/test';
import { ApiClient, assertSuccess, assertError, assertPaginated } from '../utils/api-client';
import { sampleWorkflows, createUniqueWorkflow } from '../fixtures/test-data';

test.describe('Workflows API', () => {
  let api: ApiClient;
  const createdWorkflowIds: string[] = [];

  test.beforeEach(async ({ request }) => {
    api = new ApiClient(request);
  });

  test.afterEach(async () => {
    // Cleanup created workflows
    for (const id of createdWorkflowIds) {
      try {
        await api.delete(`/workflows/${id}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    createdWorkflowIds.length = 0;
  });

  test.describe('GET /workflows', () => {
    test('should return list of workflows', async () => {
      const response = await api.get<unknown[]>('/workflows');

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('should support pagination', async () => {
      const response = await api.get<unknown[]>('/workflows', {
        page: '1',
        limit: '10',
      });

      assertSuccess(response);
      assertPaginated(response);
    });

    test('should filter by status', async () => {
      const response = await api.get<unknown[]>('/workflows', {
        status: 'pending',
      });

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  test.describe('POST /workflows', () => {
    test('should create a simple workflow', async () => {
      const workflowData = createUniqueWorkflow('simple');
      const response = await api.post<{ id: string; name: string }>('/workflows', workflowData);

      assertSuccess(response);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(workflowData.name);

      createdWorkflowIds.push(response.data.id);
    });

    test('should create a multi-step workflow', async () => {
      const workflowData = createUniqueWorkflow('multiStep');
      const response = await api.post<{ id: string; steps: unknown[] }>('/workflows', workflowData);

      assertSuccess(response);
      expect(response.data.steps).toHaveLength(3);

      createdWorkflowIds.push(response.data.id);
    });

    test('should create a parallel workflow', async () => {
      const workflowData = createUniqueWorkflow('parallel');
      const response = await api.post<{ id: string; steps: unknown[] }>('/workflows', workflowData);

      assertSuccess(response);
      expect(response.data.steps.length).toBeGreaterThan(0);

      createdWorkflowIds.push(response.data.id);
    });

    test('should return 201 status on creation', async () => {
      const workflowData = createUniqueWorkflow('simple');
      const response = await api.postRaw('/workflows', workflowData);

      expect(response.status()).toBe(201);

      const body = await response.json();
      if (body.data?.id) {
        createdWorkflowIds.push(body.data.id);
      }
    });

    test('should reject workflow without steps', async () => {
      const invalidWorkflow = {
        name: 'Invalid Workflow',
        description: 'No steps',
        steps: [],
      };

      const response = await api.post('/workflows', invalidWorkflow);

      assertError(response, 'VALIDATION_FAILED');
    });

    test('should reject workflow with invalid step dependencies', async () => {
      const invalidWorkflow = {
        name: 'Invalid Deps Workflow',
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            type: 'task',
            dependsOn: ['non-existent-step'],
          },
        ],
      };

      const response = await api.post('/workflows', invalidWorkflow);

      assertError(response, 'VALIDATION_FAILED');
    });
  });

  test.describe('GET /workflows/:id', () => {
    test('should get workflow by ID', async () => {
      // Create workflow
      const workflowData = createUniqueWorkflow('simple');
      const createResponse = await api.post<{ id: string }>('/workflows', workflowData);
      assertSuccess(createResponse);
      const workflowId = createResponse.data.id;
      createdWorkflowIds.push(workflowId);

      // Fetch workflow
      const response = await api.get<{ id: string; name: string }>(`/workflows/${workflowId}`);

      assertSuccess(response);
      expect(response.data.id).toBe(workflowId);
      expect(response.data.name).toBe(workflowData.name);
    });

    test('should return 404 for non-existent workflow', async () => {
      const response = await api.getRaw('/workflows/00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('PATCH /workflows/:id', () => {
    test('should update workflow', async () => {
      // Create workflow
      const workflowData = createUniqueWorkflow('simple');
      const createResponse = await api.post<{ id: string }>('/workflows', workflowData);
      assertSuccess(createResponse);
      const workflowId = createResponse.data.id;
      createdWorkflowIds.push(workflowId);

      // Update workflow
      const updateData = {
        name: 'Updated Workflow Name',
        description: 'Updated description',
      };
      const response = await api.patch<{ id: string; name: string; description: string }>(
        `/workflows/${workflowId}`,
        updateData
      );

      assertSuccess(response);
      expect(response.data.name).toBe(updateData.name);
      expect(response.data.description).toBe(updateData.description);
    });
  });

  test.describe('DELETE /workflows/:id', () => {
    test('should delete workflow', async () => {
      // Create workflow
      const workflowData = createUniqueWorkflow('simple');
      const createResponse = await api.post<{ id: string }>('/workflows', workflowData);
      assertSuccess(createResponse);
      const workflowId = createResponse.data.id;

      // Delete workflow
      const deleteResponse = await api.delete(`/workflows/${workflowId}`);
      expect(deleteResponse.success).toBe(true);

      // Verify deleted
      const getResponse = await api.getRaw(`/workflows/${workflowId}`);
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Workflow Execution', () => {
    test('should start workflow execution', async () => {
      // Create workflow
      const workflowData = createUniqueWorkflow('simple');
      const createResponse = await api.post<{ id: string }>('/workflows', workflowData);
      assertSuccess(createResponse);
      const workflowId = createResponse.data.id;
      createdWorkflowIds.push(workflowId);

      // Start execution
      const response = await api.post<{ status: string; instanceId: string }>(
        `/workflows/${workflowId}/start`
      );

      assertSuccess(response);
      expect(response.data.status).toBe('running');
      expect(response.data.instanceId).toBeDefined();
    });

    test('should pause workflow execution', async () => {
      // Create and start workflow
      const workflowData = createUniqueWorkflow('multiStep');
      const createResponse = await api.post<{ id: string }>('/workflows', workflowData);
      assertSuccess(createResponse);
      const workflowId = createResponse.data.id;
      createdWorkflowIds.push(workflowId);

      await api.post(`/workflows/${workflowId}/start`);

      // Pause
      const response = await api.post<{ status: string }>(`/workflows/${workflowId}/pause`);

      assertSuccess(response);
      expect(response.data.status).toBe('paused');
    });

    test('should resume workflow execution', async () => {
      // Create, start, and pause workflow
      const workflowData = createUniqueWorkflow('multiStep');
      const createResponse = await api.post<{ id: string }>('/workflows', workflowData);
      assertSuccess(createResponse);
      const workflowId = createResponse.data.id;
      createdWorkflowIds.push(workflowId);

      await api.post(`/workflows/${workflowId}/start`);
      await api.post(`/workflows/${workflowId}/pause`);

      // Resume
      const response = await api.post<{ status: string }>(`/workflows/${workflowId}/resume`);

      assertSuccess(response);
      expect(response.data.status).toBe('running');
    });

    test('should stop workflow execution', async () => {
      // Create and start workflow
      const workflowData = createUniqueWorkflow('simple');
      const createResponse = await api.post<{ id: string }>('/workflows', workflowData);
      assertSuccess(createResponse);
      const workflowId = createResponse.data.id;
      createdWorkflowIds.push(workflowId);

      await api.post(`/workflows/${workflowId}/start`);

      // Stop
      const response = await api.post<{ status: string }>(`/workflows/${workflowId}/stop`);

      assertSuccess(response);
      expect(['stopped', 'cancelled']).toContain(response.data.status);
    });

    test('should get workflow instances', async () => {
      // Create and start workflow
      const workflowData = createUniqueWorkflow('simple');
      const createResponse = await api.post<{ id: string }>('/workflows', workflowData);
      assertSuccess(createResponse);
      const workflowId = createResponse.data.id;
      createdWorkflowIds.push(workflowId);

      await api.post(`/workflows/${workflowId}/start`);

      // Get instances
      const response = await api.get<unknown[]>(`/workflows/${workflowId}/instances`);

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });
  });
});
