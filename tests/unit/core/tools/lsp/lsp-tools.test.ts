/**
 * LSP Tools Tests
 *
 * Tests for LSP tool wrappers.
 */

import { LSPHoverTool } from '@/core/tools/lsp/lsp-hover.tool';
import { LSPDefinitionTool } from '@/core/tools/lsp/lsp-definition.tool';
import { LSPReferencesTool } from '@/core/tools/lsp/lsp-references.tool';
import { LSPDocumentSymbolsTool } from '@/core/tools/lsp/lsp-document-symbols.tool';
import { LSPWorkspaceSymbolsTool } from '@/core/tools/lsp/lsp-workspace-symbols.tool';
import {
  ILSPClient,
  HoverResult,
  Location,
  DocumentSymbol,
  WorkspaceSymbol,
  SymbolKind,
  MarkupKind,
} from '@/core/tools/lsp/lsp.interface';

// Mock logger
jest.mock('@/core/services/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('LSP Tools', () => {
  // Create a mock LSP client factory
  const createMockLSPClient = (): jest.Mocked<ILSPClient> => ({
    startServer: jest.fn(),
    stopServer: jest.fn(),
    stopAllServers: jest.fn(),
    getServerState: jest.fn(),
    getAllServerStates: jest.fn(),
    isServerRunning: jest.fn(),
    getServerForLanguage: jest.fn(),
    openDocument: jest.fn(),
    closeDocument: jest.fn(),
    updateDocument: jest.fn(),
    replaceDocumentContent: jest.fn(),
    hover: jest.fn(),
    gotoDefinition: jest.fn(),
    gotoTypeDefinition: jest.fn(),
    gotoImplementation: jest.fn(),
    findReferences: jest.fn(),
    getDocumentSymbols: jest.fn(),
    searchWorkspaceSymbols: jest.fn(),
    getDiagnostics: jest.fn(),
    onDiagnostics: jest.fn(),
    getCompletions: jest.fn(),
    resolveCompletion: jest.fn(),
    getSignatureHelp: jest.fn(),
    getCodeActions: jest.fn(),
    resolveCodeAction: jest.fn(),
    executeCommand: jest.fn(),
    prepareRename: jest.fn(),
    rename: jest.fn(),
    formatDocument: jest.fn(),
    formatRange: jest.fn(),
    formatOnType: jest.fn(),
    prepareCallHierarchy: jest.fn(),
    getIncomingCalls: jest.fn(),
    getOutgoingCalls: jest.fn(),
    prepareTypeHierarchy: jest.fn(),
    getSupertypes: jest.fn(),
    getSubtypes: jest.fn(),
    initialize: jest.fn(),
    dispose: jest.fn(),
    isInitialized: jest.fn(),
  });

  describe('LSPHoverTool', () => {
    let tool: LSPHoverTool;
    let mockClient: jest.Mocked<ILSPClient>;

    beforeEach(() => {
      mockClient = createMockLSPClient();
      tool = new LSPHoverTool(mockClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('lsp-hover');
      expect(tool.description).toContain('hover');
    });

    it('should execute hover successfully', async () => {
      const hoverResult: HoverResult = {
        contents: {
          kind: MarkupKind.MARKDOWN,
          value: '```typescript\nfunction test(): void\n```',
        },
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 4 },
        },
      };

      mockClient.hover.mockResolvedValue({
        success: true,
        data: hoverResult,
      });

      const result = await tool.execute({
        uri: 'file:///test.ts',
        line: 0,
        character: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(hoverResult);
      expect(mockClient.hover).toHaveBeenCalledWith('file:///test.ts', {
        line: 0,
        character: 5,
      });
    });

    it('should handle hover failure', async () => {
      mockClient.hover.mockResolvedValue({
        success: false,
        error: 'Server not running',
      });

      const result = await tool.execute({
        uri: 'file:///test.ts',
        line: 0,
        character: 5,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LSP_HOVER_FAILED');
    });

    it('should check availability', async () => {
      mockClient.isInitialized.mockReturnValue(true);
      expect(await tool.isAvailable()).toBe(true);

      mockClient.isInitialized.mockReturnValue(false);
      expect(await tool.isAvailable()).toBe(false);
    });
  });

  describe('LSPDefinitionTool', () => {
    let tool: LSPDefinitionTool;
    let mockClient: jest.Mocked<ILSPClient>;

    beforeEach(() => {
      mockClient = createMockLSPClient();
      tool = new LSPDefinitionTool(mockClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('lsp-definition');
      expect(tool.description).toContain('definition');
    });

    it('should execute goto definition successfully', async () => {
      const locations: Location[] = [
        {
          uri: 'file:///other.ts',
          range: {
            start: { line: 10, character: 0 },
            end: { line: 10, character: 20 },
          },
        },
      ];

      mockClient.gotoDefinition.mockResolvedValue({
        success: true,
        data: locations,
      });

      const result = await tool.execute({
        uri: 'file:///test.ts',
        line: 5,
        character: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(locations);
    });

    it('should handle definition failure', async () => {
      mockClient.gotoDefinition.mockResolvedValue({
        success: false,
        error: 'No definition found',
      });

      const result = await tool.execute({
        uri: 'file:///test.ts',
        line: 5,
        character: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LSP_DEFINITION_FAILED');
    });
  });

  describe('LSPReferencesTool', () => {
    let tool: LSPReferencesTool;
    let mockClient: jest.Mocked<ILSPClient>;

    beforeEach(() => {
      mockClient = createMockLSPClient();
      tool = new LSPReferencesTool(mockClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('lsp-references');
      expect(tool.description).toContain('references');
    });

    it('should execute find references successfully', async () => {
      const locations: Location[] = [
        {
          uri: 'file:///test.ts',
          range: {
            start: { line: 5, character: 0 },
            end: { line: 5, character: 10 },
          },
        },
        {
          uri: 'file:///other.ts',
          range: {
            start: { line: 20, character: 5 },
            end: { line: 20, character: 15 },
          },
        },
      ];

      mockClient.findReferences.mockResolvedValue({
        success: true,
        data: locations,
      });

      const result = await tool.execute({
        uri: 'file:///test.ts',
        line: 5,
        character: 5,
        includeDeclaration: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(locations);
      expect(mockClient.findReferences).toHaveBeenCalledWith(
        'file:///test.ts',
        { line: 5, character: 5 },
        true
      );
    });

    it('should default includeDeclaration to true', async () => {
      mockClient.findReferences.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({
        uri: 'file:///test.ts',
        line: 5,
        character: 5,
      });

      expect(mockClient.findReferences).toHaveBeenCalledWith(
        'file:///test.ts',
        { line: 5, character: 5 },
        true
      );
    });

    it('should handle references failure', async () => {
      mockClient.findReferences.mockResolvedValue({
        success: false,
        error: 'Server error',
      });

      const result = await tool.execute({
        uri: 'file:///test.ts',
        line: 5,
        character: 5,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LSP_REFERENCES_FAILED');
    });
  });

  describe('LSPDocumentSymbolsTool', () => {
    let tool: LSPDocumentSymbolsTool;
    let mockClient: jest.Mocked<ILSPClient>;

    beforeEach(() => {
      mockClient = createMockLSPClient();
      tool = new LSPDocumentSymbolsTool(mockClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('lsp-document-symbols');
      expect(tool.description).toContain('symbols');
    });

    it('should execute get document symbols successfully', async () => {
      const symbols: DocumentSymbol[] = [
        {
          name: 'MyClass',
          kind: SymbolKind.CLASS,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 50, character: 1 },
          },
          selectionRange: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 13 },
          },
          children: [
            {
              name: 'constructor',
              kind: SymbolKind.CONSTRUCTOR,
              range: {
                start: { line: 2, character: 2 },
                end: { line: 5, character: 3 },
              },
              selectionRange: {
                start: { line: 2, character: 2 },
                end: { line: 2, character: 13 },
              },
            },
          ],
        },
      ];

      mockClient.getDocumentSymbols.mockResolvedValue({
        success: true,
        data: symbols,
      });

      const result = await tool.execute({
        uri: 'file:///test.ts',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(symbols);
    });

    it('should handle document symbols failure', async () => {
      mockClient.getDocumentSymbols.mockResolvedValue({
        success: false,
        error: 'Document not found',
      });

      const result = await tool.execute({
        uri: 'file:///test.ts',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LSP_DOCUMENT_SYMBOLS_FAILED');
    });
  });

  describe('LSPWorkspaceSymbolsTool', () => {
    let tool: LSPWorkspaceSymbolsTool;
    let mockClient: jest.Mocked<ILSPClient>;

    beforeEach(() => {
      mockClient = createMockLSPClient();
      tool = new LSPWorkspaceSymbolsTool(mockClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('lsp-workspace-symbols');
      expect(tool.description).toContain('workspace');
    });

    it('should execute search workspace symbols successfully', async () => {
      const symbols: WorkspaceSymbol[] = [
        {
          name: 'UserService',
          kind: SymbolKind.CLASS,
          location: {
            uri: 'file:///services/user.ts',
            range: {
              start: { line: 5, character: 0 },
              end: { line: 100, character: 1 },
            },
          },
        },
        {
          name: 'UserController',
          kind: SymbolKind.CLASS,
          location: {
            uri: 'file:///controllers/user.ts',
            range: {
              start: { line: 10, character: 0 },
              end: { line: 80, character: 1 },
            },
          },
        },
      ];

      mockClient.searchWorkspaceSymbols.mockResolvedValue({
        success: true,
        data: symbols,
      });

      const result = await tool.execute({
        query: 'User',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(symbols);
      expect(mockClient.searchWorkspaceSymbols).toHaveBeenCalledWith('User');
    });

    it('should handle workspace symbols failure', async () => {
      mockClient.searchWorkspaceSymbols.mockResolvedValue({
        success: false,
        error: 'Server not initialized',
      });

      const result = await tool.execute({
        query: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LSP_WORKSPACE_SYMBOLS_FAILED');
    });
  });
});
