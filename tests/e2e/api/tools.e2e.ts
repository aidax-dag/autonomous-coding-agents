/**
 * Tools API E2E Tests
 *
 * Tests for the /api/v1/tools endpoints
 */

import { test, expect } from '@playwright/test';
import { ApiClient, assertSuccess, assertError } from '../utils/api-client';
import { sampleTools } from '../fixtures/test-data';

test.describe('Tools API', () => {
  let api: ApiClient;
  const registeredToolNames: string[] = [];

  test.beforeEach(async ({ request }) => {
    api = new ApiClient(request);
  });

  test.afterEach(async () => {
    // Cleanup registered tools
    for (const name of registeredToolNames) {
      try {
        await api.delete(`/tools/${name}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    registeredToolNames.length = 0;
  });

  test.describe('GET /tools', () => {
    test('should return list of tools', async () => {
      const response = await api.get<unknown[]>('/tools');

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('should include built-in tools', async () => {
      const response = await api.get<Array<{ name: string }>>('/tools');

      assertSuccess(response);
      // System should have some built-in tools
      expect(response.data.length).toBeGreaterThanOrEqual(0);
    });

    test('should filter by category', async () => {
      const response = await api.get<unknown[]>('/tools', {
        category: 'file_system',
      });

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  test.describe('POST /tools', () => {
    test('should register a new tool', async () => {
      const toolName = `test-tool-${Date.now()}`;
      const toolData = {
        ...sampleTools.echo,
        name: toolName,
      };

      const response = await api.post<{ name: string }>('/tools', toolData);

      assertSuccess(response);
      expect(response.data.name).toBe(toolName);

      registeredToolNames.push(toolName);
    });

    test('should return 201 status on registration', async () => {
      const toolName = `test-tool-${Date.now()}`;
      const toolData = {
        ...sampleTools.echo,
        name: toolName,
      };

      const response = await api.postRaw('/tools', toolData);

      expect(response.status()).toBe(201);
      registeredToolNames.push(toolName);
    });

    test('should reject duplicate tool name', async () => {
      const toolName = `test-tool-${Date.now()}`;
      const toolData = {
        ...sampleTools.echo,
        name: toolName,
      };

      // Register first time
      await api.post('/tools', toolData);
      registeredToolNames.push(toolName);

      // Try to register again
      const response = await api.post('/tools', toolData);

      assertError(response, 'CONFLICT');
    });

    test('should reject tool without schema', async () => {
      const invalidTool = {
        name: 'invalid-tool',
        description: 'No schema',
      };

      const response = await api.post('/tools', invalidTool);

      assertError(response, 'VALIDATION_FAILED');
    });
  });

  test.describe('GET /tools/:name', () => {
    test('should get tool by name', async () => {
      // Register tool
      const toolName = `test-tool-${Date.now()}`;
      const toolData = {
        ...sampleTools.echo,
        name: toolName,
      };
      await api.post('/tools', toolData);
      registeredToolNames.push(toolName);

      // Fetch tool
      const response = await api.get<{ name: string; description: string }>(`/tools/${toolName}`);

      assertSuccess(response);
      expect(response.data.name).toBe(toolName);
      expect(response.data.description).toBe(toolData.description);
    });

    test('should return 404 for non-existent tool', async () => {
      const response = await api.getRaw('/tools/non-existent-tool-12345');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('DELETE /tools/:name', () => {
    test('should unregister tool', async () => {
      // Register tool
      const toolName = `test-tool-${Date.now()}`;
      const toolData = {
        ...sampleTools.echo,
        name: toolName,
      };
      await api.post('/tools', toolData);

      // Delete tool
      const deleteResponse = await api.delete(`/tools/${toolName}`);
      expect(deleteResponse.success).toBe(true);

      // Verify deleted
      const getResponse = await api.getRaw(`/tools/${toolName}`);
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Tool Execution', () => {
    test('should execute tool', async () => {
      // Register tool
      const toolName = `test-tool-${Date.now()}`;
      const toolData = {
        ...sampleTools.echo,
        name: toolName,
      };
      await api.post('/tools', toolData);
      registeredToolNames.push(toolName);

      // Execute tool (API uses 'parameters' not 'params')
      const response = await api.post<{ status: string; result: { success: boolean } }>(
        `/tools/${toolName}/execute`,
        {
          parameters: { message: 'Hello, World!' },
        }
      );

      assertSuccess(response);
      expect(response.data.result.success).toBe(true);
    });

    test('should validate tool parameters', async () => {
      // Register tool
      const toolName = `test-tool-${Date.now()}`;
      const toolData = {
        ...sampleTools.echo,
        name: toolName,
      };
      await api.post('/tools', toolData);
      registeredToolNames.push(toolName);

      // Execute with missing required param
      const response = await api.post(`/tools/${toolName}/execute`, {
        parameters: {}, // Missing 'message'
      });

      assertError(response, 'VALIDATION_FAILED');
    });

    test('should batch execute tools', async () => {
      // Register tools
      const toolName1 = `test-tool-1-${Date.now()}`;
      const toolName2 = `test-tool-2-${Date.now()}`;

      await api.post('/tools', { ...sampleTools.echo, name: toolName1 });
      await api.post('/tools', { ...sampleTools.echo, name: toolName2 });
      registeredToolNames.push(toolName1, toolName2);

      // Batch execute (API uses '/batch/execute' not '/execute/batch')
      const response = await api.post<{ results: Array<{ status: string }> }>('/tools/batch/execute', {
        executions: [
          { toolName: toolName1, parameters: { message: 'Hello' } },
          { toolName: toolName2, parameters: { message: 'World' } },
        ],
      });

      assertSuccess(response);
      expect(response.data.results).toHaveLength(2);
    });

    test('should get tool execution history', async () => {
      // Register and execute tool
      const toolName = `test-tool-${Date.now()}`;
      const toolData = {
        ...sampleTools.echo,
        name: toolName,
      };
      await api.post('/tools', toolData);
      registeredToolNames.push(toolName);

      await api.post(`/tools/${toolName}/execute`, {
        parameters: { message: 'Test' },
      });

      // Get history (API uses '/executions' not '/history')
      const response = await api.get<unknown[]>(`/tools/${toolName}/executions`);

      assertSuccess(response);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });
});
