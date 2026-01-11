/**
 * MCP Interface Tests
 *
 * Tests for MCP interface helper functions and validation.
 *
 * @module tests/unit/core/tools/mcp/mcp.interface.test
 */

import {
  MCPTransportType,
  JsonRpcErrorCode,
  MCPContentType,
  MCPLogLevel,
  MCPPromptRole,
  MCPConnectionState,
  MCPEventType,
  MCP_PROTOCOL_VERSION,
  DEFAULT_MCP_CLIENT_CONFIG,
  DEFAULT_MCP_MANAGER_CONFIG,
  isJsonRpcError,
  isJsonRpcSuccess,
  createJsonRpcRequest,
  createJsonRpcNotification,
  createTextContent,
  createImageContent,
  getTransportType,
  validateMCPClientConfig,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  MCPClientConfig,
  MCPStdioTransportConfig,
  MCPHttpTransportConfig,
  MCPWebSocketTransportConfig,
} from '../../../../../src/core/tools/mcp/index.js';

describe('MCP Interface', () => {
  // ===========================================================================
  // Enum Tests
  // ===========================================================================

  describe('Enums', () => {
    it('should have correct MCPTransportType values', () => {
      expect(MCPTransportType.STDIO).toBe('stdio');
      expect(MCPTransportType.HTTP_SSE).toBe('http_sse');
      expect(MCPTransportType.WEBSOCKET).toBe('websocket');
    });

    it('should have correct JsonRpcErrorCode values', () => {
      expect(JsonRpcErrorCode.PARSE_ERROR).toBe(-32700);
      expect(JsonRpcErrorCode.INVALID_REQUEST).toBe(-32600);
      expect(JsonRpcErrorCode.METHOD_NOT_FOUND).toBe(-32601);
      expect(JsonRpcErrorCode.INVALID_PARAMS).toBe(-32602);
      expect(JsonRpcErrorCode.INTERNAL_ERROR).toBe(-32603);
    });

    it('should have correct MCPContentType values', () => {
      expect(MCPContentType.TEXT).toBe('text');
      expect(MCPContentType.IMAGE).toBe('image');
      expect(MCPContentType.RESOURCE).toBe('resource');
    });

    it('should have correct MCPLogLevel values', () => {
      expect(MCPLogLevel.DEBUG).toBe('debug');
      expect(MCPLogLevel.INFO).toBe('info');
      expect(MCPLogLevel.NOTICE).toBe('notice');
      expect(MCPLogLevel.WARNING).toBe('warning');
      expect(MCPLogLevel.ERROR).toBe('error');
      expect(MCPLogLevel.CRITICAL).toBe('critical');
      expect(MCPLogLevel.ALERT).toBe('alert');
      expect(MCPLogLevel.EMERGENCY).toBe('emergency');
    });

    it('should have correct MCPPromptRole values', () => {
      expect(MCPPromptRole.USER).toBe('user');
      expect(MCPPromptRole.ASSISTANT).toBe('assistant');
    });

    it('should have correct MCPConnectionState values', () => {
      expect(MCPConnectionState.DISCONNECTED).toBe('disconnected');
      expect(MCPConnectionState.CONNECTING).toBe('connecting');
      expect(MCPConnectionState.CONNECTED).toBe('connected');
      expect(MCPConnectionState.INITIALIZING).toBe('initializing');
      expect(MCPConnectionState.READY).toBe('ready');
      expect(MCPConnectionState.RECONNECTING).toBe('reconnecting');
      expect(MCPConnectionState.ERROR).toBe('error');
    });

    it('should have correct MCPEventType values', () => {
      expect(MCPEventType.CONNECTION_STATE_CHANGED).toBe('connection_state_changed');
      expect(MCPEventType.NOTIFICATION).toBe('notification');
      expect(MCPEventType.TOOLS_CHANGED).toBe('tools_changed');
      expect(MCPEventType.RESOURCES_CHANGED).toBe('resources_changed');
      expect(MCPEventType.PROMPTS_CHANGED).toBe('prompts_changed');
      expect(MCPEventType.LOG_MESSAGE).toBe('log_message');
      expect(MCPEventType.ERROR).toBe('error');
    });
  });

  // ===========================================================================
  // Constants Tests
  // ===========================================================================

  describe('Constants', () => {
    it('should have correct protocol version', () => {
      expect(MCP_PROTOCOL_VERSION).toBe('2024-11-05');
    });

    it('should have valid default client config', () => {
      expect(DEFAULT_MCP_CLIENT_CONFIG).toBeDefined();
      expect(DEFAULT_MCP_CLIENT_CONFIG.requestTimeoutMs).toBe(30000);
      expect(DEFAULT_MCP_CLIENT_CONFIG.autoReconnect).toBe(true);
      expect(DEFAULT_MCP_CLIENT_CONFIG.debug).toBe(false);
      expect(DEFAULT_MCP_CLIENT_CONFIG.clientInfo).toBeDefined();
      expect(DEFAULT_MCP_CLIENT_CONFIG.clientInfo?.name).toBe('autonomous-coding-agents');
      expect(DEFAULT_MCP_CLIENT_CONFIG.capabilities).toBeDefined();
    });

    it('should have valid default manager config', () => {
      expect(DEFAULT_MCP_MANAGER_CONFIG).toBeDefined();
      expect(DEFAULT_MCP_MANAGER_CONFIG.defaultRequestTimeoutMs).toBe(30000);
      expect(DEFAULT_MCP_MANAGER_CONFIG.defaultAutoReconnect).toBe(true);
      expect(DEFAULT_MCP_MANAGER_CONFIG.maxConcurrentConnections).toBe(10);
      expect(DEFAULT_MCP_MANAGER_CONFIG.debug).toBe(false);
    });
  });

  // ===========================================================================
  // Helper Function Tests
  // ===========================================================================

  describe('isJsonRpcError', () => {
    it('should return true for error response', () => {
      const errorResponse: JsonRpcErrorResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      };
      expect(isJsonRpcError(errorResponse)).toBe(true);
    });

    it('should return false for success response', () => {
      const successResponse: JsonRpcSuccessResponse<string> = {
        jsonrpc: '2.0',
        id: 1,
        result: 'success',
      };
      expect(isJsonRpcError(successResponse)).toBe(false);
    });
  });

  describe('isJsonRpcSuccess', () => {
    it('should return true for success response', () => {
      const successResponse: JsonRpcSuccessResponse<string> = {
        jsonrpc: '2.0',
        id: 1,
        result: 'success',
      };
      expect(isJsonRpcSuccess(successResponse)).toBe(true);
    });

    it('should return false for error response', () => {
      const errorResponse: JsonRpcErrorResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      };
      expect(isJsonRpcSuccess(errorResponse)).toBe(false);
    });
  });

  describe('createJsonRpcRequest', () => {
    it('should create a valid JSON-RPC request', () => {
      const request = createJsonRpcRequest('test/method', { key: 'value' });

      expect(request.jsonrpc).toBe('2.0');
      expect(request.method).toBe('test/method');
      expect(request.params).toEqual({ key: 'value' });
      expect(request.id).toBeDefined();
    });

    it('should use provided id', () => {
      const request = createJsonRpcRequest('test/method', undefined, 42);

      expect(request.id).toBe(42);
    });

    it('should create request without params', () => {
      const request = createJsonRpcRequest('test/method');

      expect(request.params).toBeUndefined();
    });

    it('should generate unique ids', () => {
      const request1 = createJsonRpcRequest('method1');
      const request2 = createJsonRpcRequest('method2');

      expect(request1.id).not.toBe(request2.id);
    });
  });

  describe('createJsonRpcNotification', () => {
    it('should create a valid JSON-RPC notification', () => {
      const notification = createJsonRpcNotification('test/notify', { data: 'test' });

      expect(notification.jsonrpc).toBe('2.0');
      expect(notification.method).toBe('test/notify');
      expect(notification.params).toEqual({ data: 'test' });
      expect('id' in notification).toBe(false);
    });

    it('should create notification without params', () => {
      const notification = createJsonRpcNotification('test/notify');

      expect(notification.params).toBeUndefined();
    });
  });

  describe('createTextContent', () => {
    it('should create text content object', () => {
      const content = createTextContent('Hello, World!');

      expect(content.type).toBe(MCPContentType.TEXT);
      expect(content.text).toBe('Hello, World!');
    });

    it('should handle empty string', () => {
      const content = createTextContent('');

      expect(content.type).toBe(MCPContentType.TEXT);
      expect(content.text).toBe('');
    });
  });

  describe('createImageContent', () => {
    it('should create image content object', () => {
      const content = createImageContent('base64data', 'image/png');

      expect(content.type).toBe(MCPContentType.IMAGE);
      expect(content.data).toBe('base64data');
      expect(content.mimeType).toBe('image/png');
    });

    it('should handle different MIME types', () => {
      const jpegContent = createImageContent('data', 'image/jpeg');
      const gifContent = createImageContent('data', 'image/gif');

      expect(jpegContent.mimeType).toBe('image/jpeg');
      expect(gifContent.mimeType).toBe('image/gif');
    });
  });

  describe('getTransportType', () => {
    it('should return transport type for STDIO config', () => {
      const config: MCPStdioTransportConfig = {
        type: MCPTransportType.STDIO,
        command: 'node',
      };

      expect(getTransportType(config)).toBe(MCPTransportType.STDIO);
    });

    it('should return transport type for HTTP config', () => {
      const config: MCPHttpTransportConfig = {
        type: MCPTransportType.HTTP_SSE,
        url: 'http://localhost:8080',
      };

      expect(getTransportType(config)).toBe(MCPTransportType.HTTP_SSE);
    });

    it('should return transport type for WebSocket config', () => {
      const config: MCPWebSocketTransportConfig = {
        type: MCPTransportType.WEBSOCKET,
        url: 'ws://localhost:8080',
      };

      expect(getTransportType(config)).toBe(MCPTransportType.WEBSOCKET);
    });
  });

  describe('validateMCPClientConfig', () => {
    it('should return no errors for valid STDIO config', () => {
      const config: MCPClientConfig = {
        serverId: 'test-server',
        serverName: 'Test Server',
        transport: {
          type: MCPTransportType.STDIO,
          command: 'node',
          args: ['server.js'],
        },
      };

      const errors = validateMCPClientConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should return no errors for valid HTTP config', () => {
      const config: MCPClientConfig = {
        serverId: 'test-server',
        serverName: 'Test Server',
        transport: {
          type: MCPTransportType.HTTP_SSE,
          url: 'http://localhost:8080',
        },
      };

      const errors = validateMCPClientConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should return no errors for valid WebSocket config', () => {
      const config: MCPClientConfig = {
        serverId: 'test-server',
        serverName: 'Test Server',
        transport: {
          type: MCPTransportType.WEBSOCKET,
          url: 'ws://localhost:8080',
        },
      };

      const errors = validateMCPClientConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing serverId', () => {
      const config = {
        serverName: 'Test Server',
        transport: {
          type: MCPTransportType.STDIO,
          command: 'node',
        },
      } as MCPClientConfig;

      const errors = validateMCPClientConfig(config);
      expect(errors).toContain('serverId is required');
    });

    it('should return error for missing serverName', () => {
      const config = {
        serverId: 'test-server',
        transport: {
          type: MCPTransportType.STDIO,
          command: 'node',
        },
      } as MCPClientConfig;

      const errors = validateMCPClientConfig(config);
      expect(errors).toContain('serverName is required');
    });

    it('should return error for missing transport', () => {
      const config = {
        serverId: 'test-server',
        serverName: 'Test Server',
      } as MCPClientConfig;

      const errors = validateMCPClientConfig(config);
      expect(errors).toContain('transport configuration is required');
    });

    it('should return error for missing STDIO command', () => {
      const config: MCPClientConfig = {
        serverId: 'test-server',
        serverName: 'Test Server',
        transport: {
          type: MCPTransportType.STDIO,
        } as MCPStdioTransportConfig,
      };

      const errors = validateMCPClientConfig(config);
      expect(errors).toContain('command is required for STDIO transport');
    });

    it('should return error for missing HTTP url', () => {
      const config: MCPClientConfig = {
        serverId: 'test-server',
        serverName: 'Test Server',
        transport: {
          type: MCPTransportType.HTTP_SSE,
        } as MCPHttpTransportConfig,
      };

      const errors = validateMCPClientConfig(config);
      expect(errors).toContain('url is required for HTTP/SSE transport');
    });

    it('should return error for missing WebSocket url', () => {
      const config: MCPClientConfig = {
        serverId: 'test-server',
        serverName: 'Test Server',
        transport: {
          type: MCPTransportType.WEBSOCKET,
        } as MCPWebSocketTransportConfig,
      };

      const errors = validateMCPClientConfig(config);
      expect(errors).toContain('url is required for WebSocket transport');
    });

    it('should return multiple errors', () => {
      const config = {} as MCPClientConfig;

      const errors = validateMCPClientConfig(config);
      expect(errors.length).toBeGreaterThan(1);
      expect(errors).toContain('serverId is required');
      expect(errors).toContain('serverName is required');
      expect(errors).toContain('transport configuration is required');
    });
  });
});
