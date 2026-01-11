/**
 * LSP Client Tests
 *
 * Tests for Language Server Protocol client implementation.
 *
 * @module tests/unit/core/tools/lsp/lsp-client.test
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LSPClient,
  LSPServerStatus,
  LanguageId,
  Position,
  Range,
  DiagnosticSeverity,
  SymbolKind,
  CodeActionKind,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  DiagnosticTag,
  SymbolTag,
  CodeActionTriggerKind,
  DEFAULT_LSP_CLIENT_OPTIONS,
  COMMON_LSP_SERVERS,
  pathToUri,
  uriToPath,
  detectLanguage,
} from '../../../../../src/core/tools/lsp/index.js';

describe('LSP Client', () => {
  let client: LSPClient;

  beforeEach(() => {
    client = new LSPClient({ logging: false });
  });

  afterEach(async () => {
    try {
      await client.dispose();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create client with default options', () => {
      const c = new LSPClient();
      expect(c.isInitialized()).toBe(false);
    });

    it('should create client with custom options', () => {
      const c = new LSPClient({
        timeout: 60000,
        autoStart: false,
        logging: true,
      });
      expect(c.isInitialized()).toBe(false);
    });

    it('should accept all option properties', () => {
      const c = new LSPClient({
        timeout: 45000,
        autoStart: true,
        autoRestart: false,
        maxRestartAttempts: 5,
        restartDelay: 2000,
        logging: true,
        logLevel: 'debug',
      });
      expect(c.isInitialized()).toBe(false);
    });
  });

  describe('initialize/dispose', () => {
    it('should initialize client', async () => {
      const result = await client.initialize();
      expect(result.success).toBe(true);
      expect(client.isInitialized()).toBe(true);
    });

    it('should initialize with options', async () => {
      const result = await client.initialize({
        timeout: 60000,
        autoRestart: false,
      });
      expect(result.success).toBe(true);
    });

    it('should dispose client', async () => {
      await client.initialize();
      await client.dispose();
      expect(client.isInitialized()).toBe(false);
    });

    it('should dispose without initialization', async () => {
      await client.dispose();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe('getServerState', () => {
    it('should return undefined for unknown server', () => {
      const state = client.getServerState('unknown');
      expect(state).toBeUndefined();
    });
  });

  describe('getAllServerStates', () => {
    it('should return empty array when no servers', () => {
      const states = client.getAllServerStates();
      expect(states).toEqual([]);
    });
  });

  describe('isServerRunning', () => {
    it('should return false for unknown server', () => {
      expect(client.isServerRunning('unknown')).toBe(false);
    });
  });

  describe('getServerForLanguage', () => {
    it('should return undefined when no server for language', () => {
      expect(client.getServerForLanguage(LanguageId.RUST)).toBeUndefined();
    });
  });

  describe('stopServer', () => {
    it('should return error for non-existent server', async () => {
      const result = await client.stopServer('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('stopAllServers', () => {
    it('should succeed with no servers', async () => {
      const result = await client.stopAllServers();
      expect(result.success).toBe(true);
    });
  });

  describe('openDocument', () => {
    it('should fail when no server for language', async () => {
      const result = await client.openDocument(
        'file:///test.ts',
        LanguageId.TYPESCRIPT,
        1,
        'const x = 1;'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('No server');
    });
  });

  describe('closeDocument', () => {
    it('should fail when document not opened', async () => {
      const result = await client.closeDocument('file:///unknown.ts');
      expect(result.success).toBe(false);
    });
  });

  describe('updateDocument', () => {
    it('should fail when document not opened', async () => {
      const result = await client.updateDocument('file:///unknown.ts', 2, []);
      expect(result.success).toBe(false);
    });
  });

  describe('replaceDocumentContent', () => {
    it('should fail when document not opened', async () => {
      const result = await client.replaceDocumentContent(
        'file:///unknown.ts',
        2,
        'new content'
      );
      expect(result.success).toBe(false);
    });
  });

  describe('hover', () => {
    it('should fail when document not opened', async () => {
      const result = await client.hover('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('gotoDefinition', () => {
    it('should fail when document not opened', async () => {
      const result = await client.gotoDefinition('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('gotoTypeDefinition', () => {
    it('should fail when document not opened', async () => {
      const result = await client.gotoTypeDefinition('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('gotoImplementation', () => {
    it('should fail when document not opened', async () => {
      const result = await client.gotoImplementation('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('findReferences', () => {
    it('should fail when document not opened', async () => {
      const result = await client.findReferences('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });

    it('should accept includeDeclaration parameter', async () => {
      const result = await client.findReferences('file:///test.ts', { line: 0, character: 5 }, false);
      expect(result.success).toBe(false);
    });
  });

  describe('getDocumentSymbols', () => {
    it('should fail when document not opened', async () => {
      const result = await client.getDocumentSymbols('file:///test.ts');
      expect(result.success).toBe(false);
    });
  });

  describe('searchWorkspaceSymbols', () => {
    it('should fail when no server running', async () => {
      const result = await client.searchWorkspaceSymbols('test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No running server');
    });
  });

  describe('getDiagnostics', () => {
    it('should fail when document not opened', async () => {
      const result = await client.getDiagnostics('file:///test.ts');
      expect(result.success).toBe(false);
    });
  });

  describe('onDiagnostics', () => {
    it('should subscribe to diagnostics', () => {
      const callback = jest.fn();
      const subscription = client.onDiagnostics(callback);
      expect(subscription).toHaveProperty('unsubscribe');
    });

    it('should unsubscribe from diagnostics', () => {
      const callback = jest.fn();
      const subscription = client.onDiagnostics(callback);
      subscription.unsubscribe();
      // Should not throw
    });
  });

  describe('getCompletions', () => {
    it('should fail when document not opened', async () => {
      const result = await client.getCompletions('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });

    it('should accept context parameter', async () => {
      const result = await client.getCompletions(
        'file:///test.ts',
        { line: 0, character: 5 },
        { triggerKind: 1, triggerCharacter: '.' }
      );
      expect(result.success).toBe(false);
    });
  });

  describe('resolveCompletion', () => {
    it('should fail when no server running', async () => {
      const result = await client.resolveCompletion({ label: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('getSignatureHelp', () => {
    it('should fail when document not opened', async () => {
      const result = await client.getSignatureHelp('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });

    it('should accept context parameter', async () => {
      const result = await client.getSignatureHelp(
        'file:///test.ts',
        { line: 0, character: 5 },
        { triggerKind: 1, triggerCharacter: '(', isRetrigger: false }
      );
      expect(result.success).toBe(false);
    });
  });

  describe('getCodeActions', () => {
    it('should fail when document not opened', async () => {
      const result = await client.getCodeActions(
        'file:///test.ts',
        { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        { diagnostics: [] }
      );
      expect(result.success).toBe(false);
    });
  });

  describe('resolveCodeAction', () => {
    it('should fail when no server running', async () => {
      const result = await client.resolveCodeAction({ title: 'Fix' });
      expect(result.success).toBe(false);
    });
  });

  describe('executeCommand', () => {
    it('should fail when no server running', async () => {
      const result = await client.executeCommand('test.command', []);
      expect(result.success).toBe(false);
    });

    it('should accept empty args', async () => {
      const result = await client.executeCommand('test.command');
      expect(result.success).toBe(false);
    });
  });

  describe('prepareRename', () => {
    it('should fail when document not opened', async () => {
      const result = await client.prepareRename('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('rename', () => {
    it('should fail when document not opened', async () => {
      const result = await client.rename('file:///test.ts', { line: 0, character: 5 }, 'newName');
      expect(result.success).toBe(false);
    });
  });

  describe('formatDocument', () => {
    it('should fail when document not opened', async () => {
      const result = await client.formatDocument('file:///test.ts', {
        tabSize: 2,
        insertSpaces: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('formatRange', () => {
    it('should fail when document not opened', async () => {
      const result = await client.formatRange(
        'file:///test.ts',
        { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
        { tabSize: 2, insertSpaces: true }
      );
      expect(result.success).toBe(false);
    });
  });

  describe('formatOnType', () => {
    it('should fail when document not opened', async () => {
      const result = await client.formatOnType(
        'file:///test.ts',
        { line: 0, character: 5 },
        ';',
        { tabSize: 2, insertSpaces: true }
      );
      expect(result.success).toBe(false);
    });
  });

  describe('prepareCallHierarchy', () => {
    it('should fail when document not opened', async () => {
      const result = await client.prepareCallHierarchy('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('getIncomingCalls', () => {
    it('should fail when no server running', async () => {
      const result = await client.getIncomingCalls({
        name: 'test',
        kind: SymbolKind.FUNCTION,
        uri: 'file:///test.ts',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('getOutgoingCalls', () => {
    it('should fail when no server running', async () => {
      const result = await client.getOutgoingCalls({
        name: 'test',
        kind: SymbolKind.FUNCTION,
        uri: 'file:///test.ts',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('prepareTypeHierarchy', () => {
    it('should fail when document not opened', async () => {
      const result = await client.prepareTypeHierarchy('file:///test.ts', { line: 0, character: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('getSupertypes', () => {
    it('should fail when no server running', async () => {
      const result = await client.getSupertypes({
        name: 'MyClass',
        kind: SymbolKind.CLASS,
        uri: 'file:///test.ts',
        range: { start: { line: 0, character: 0 }, end: { line: 10, character: 1 } },
        selectionRange: { start: { line: 0, character: 6 }, end: { line: 0, character: 13 } },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('getSubtypes', () => {
    it('should fail when no server running', async () => {
      const result = await client.getSubtypes({
        name: 'MyClass',
        kind: SymbolKind.CLASS,
        uri: 'file:///test.ts',
        range: { start: { line: 0, character: 0 }, end: { line: 10, character: 1 } },
        selectionRange: { start: { line: 0, character: 6 }, end: { line: 0, character: 13 } },
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('LSP Interface Helpers', () => {
  describe('pathToUri', () => {
    it('should convert Unix path to URI', () => {
      expect(pathToUri('/home/user/file.ts')).toBe('file:///home/user/file.ts');
    });

    it('should convert Windows path to URI', () => {
      expect(pathToUri('C:\\Users\\user\\file.ts')).toBe('file:///C:/Users/user/file.ts');
    });

    it('should handle path without leading slash', () => {
      const result = pathToUri('relative/path.ts');
      expect(result).toBe('file://relative/path.ts');
    });

    it('should handle empty path', () => {
      const result = pathToUri('');
      expect(result).toBe('file://');
    });

    it('should handle paths with spaces', () => {
      const result = pathToUri('/path/with spaces/file.ts');
      expect(result).toBe('file:///path/with spaces/file.ts');
    });
  });

  describe('uriToPath', () => {
    it('should convert file URI to Unix path', () => {
      expect(uriToPath('file:///home/user/file.ts')).toBe('/home/user/file.ts');
    });

    it('should convert file URI to Windows path', () => {
      expect(uriToPath('file:///C:/Users/user/file.ts')).toBe('C:\\Users\\user\\file.ts');
    });

    it('should handle double-slash URI', () => {
      expect(uriToPath('file:///path/to/file')).toBe('/path/to/file');
    });

    it('should return path as-is if not a file URI', () => {
      expect(uriToPath('/some/path')).toBe('/some/path');
    });

    it('should handle file:// without third slash', () => {
      expect(uriToPath('file://path/to/file')).toBe('path/to/file');
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript', () => {
      expect(detectLanguage('file.ts')).toBe(LanguageId.TYPESCRIPT);
      expect(detectLanguage('/path/to/file.ts')).toBe(LanguageId.TYPESCRIPT);
    });

    it('should detect TypeScript React', () => {
      expect(detectLanguage('file.tsx')).toBe(LanguageId.TYPESCRIPT_REACT);
    });

    it('should detect JavaScript', () => {
      expect(detectLanguage('file.js')).toBe(LanguageId.JAVASCRIPT);
      expect(detectLanguage('file.mjs')).toBe(LanguageId.JAVASCRIPT);
      expect(detectLanguage('file.cjs')).toBe(LanguageId.JAVASCRIPT);
    });

    it('should detect JavaScript React', () => {
      expect(detectLanguage('file.jsx')).toBe(LanguageId.JAVASCRIPT_REACT);
    });

    it('should detect Python', () => {
      expect(detectLanguage('file.py')).toBe(LanguageId.PYTHON);
    });

    it('should detect Rust', () => {
      expect(detectLanguage('file.rs')).toBe(LanguageId.RUST);
    });

    it('should detect Go', () => {
      expect(detectLanguage('file.go')).toBe(LanguageId.GO);
    });

    it('should detect Java', () => {
      expect(detectLanguage('file.java')).toBe(LanguageId.JAVA);
    });

    it('should detect C', () => {
      expect(detectLanguage('file.c')).toBe(LanguageId.C);
      expect(detectLanguage('file.h')).toBe(LanguageId.C);
    });

    it('should detect C++', () => {
      expect(detectLanguage('file.cpp')).toBe(LanguageId.CPP);
      expect(detectLanguage('file.cxx')).toBe(LanguageId.CPP);
      expect(detectLanguage('file.cc')).toBe(LanguageId.CPP);
      expect(detectLanguage('file.hpp')).toBe(LanguageId.CPP);
    });

    it('should detect C#', () => {
      expect(detectLanguage('file.cs')).toBe(LanguageId.CSHARP);
    });

    it('should detect Ruby', () => {
      expect(detectLanguage('file.rb')).toBe(LanguageId.RUBY);
    });

    it('should detect PHP', () => {
      expect(detectLanguage('file.php')).toBe(LanguageId.PHP);
    });

    it('should detect HTML', () => {
      expect(detectLanguage('file.html')).toBe(LanguageId.HTML);
      expect(detectLanguage('file.htm')).toBe(LanguageId.HTML);
    });

    it('should detect CSS', () => {
      expect(detectLanguage('file.css')).toBe(LanguageId.CSS);
      expect(detectLanguage('file.scss')).toBe(LanguageId.CSS);
      expect(detectLanguage('file.less')).toBe(LanguageId.CSS);
    });

    it('should detect JSON', () => {
      expect(detectLanguage('file.json')).toBe(LanguageId.JSON);
      expect(detectLanguage('file.jsonc')).toBe(LanguageId.JSON);
    });

    it('should detect YAML', () => {
      expect(detectLanguage('file.yaml')).toBe(LanguageId.YAML);
      expect(detectLanguage('file.yml')).toBe(LanguageId.YAML);
    });

    it('should detect Markdown', () => {
      expect(detectLanguage('file.md')).toBe(LanguageId.MARKDOWN);
      expect(detectLanguage('file.markdown')).toBe(LanguageId.MARKDOWN);
    });

    it('should return undefined for unknown extension', () => {
      expect(detectLanguage('file.unknown')).toBeUndefined();
      expect(detectLanguage('file')).toBeUndefined();
    });

    it('should handle files without extension', () => {
      expect(detectLanguage('Makefile')).toBeUndefined();
      expect(detectLanguage('.gitignore')).toBeUndefined();
    });

    it('should handle paths with multiple dots', () => {
      expect(detectLanguage('file.test.ts')).toBe(LanguageId.TYPESCRIPT);
      expect(detectLanguage('my.component.tsx')).toBe(LanguageId.TYPESCRIPT_REACT);
    });
  });
});

describe('LSP Interface Types', () => {
  describe('DiagnosticSeverity', () => {
    it('should have correct values', () => {
      expect(DiagnosticSeverity.ERROR).toBe(1);
      expect(DiagnosticSeverity.WARNING).toBe(2);
      expect(DiagnosticSeverity.INFORMATION).toBe(3);
      expect(DiagnosticSeverity.HINT).toBe(4);
    });
  });

  describe('DiagnosticTag', () => {
    it('should have correct values', () => {
      expect(DiagnosticTag.UNNECESSARY).toBe(1);
      expect(DiagnosticTag.DEPRECATED).toBe(2);
    });
  });

  describe('SymbolKind', () => {
    it('should have correct values', () => {
      expect(SymbolKind.FILE).toBe(1);
      expect(SymbolKind.MODULE).toBe(2);
      expect(SymbolKind.NAMESPACE).toBe(3);
      expect(SymbolKind.PACKAGE).toBe(4);
      expect(SymbolKind.CLASS).toBe(5);
      expect(SymbolKind.METHOD).toBe(6);
      expect(SymbolKind.PROPERTY).toBe(7);
      expect(SymbolKind.FIELD).toBe(8);
      expect(SymbolKind.CONSTRUCTOR).toBe(9);
      expect(SymbolKind.ENUM).toBe(10);
      expect(SymbolKind.INTERFACE).toBe(11);
      expect(SymbolKind.FUNCTION).toBe(12);
      expect(SymbolKind.VARIABLE).toBe(13);
      expect(SymbolKind.CONSTANT).toBe(14);
      expect(SymbolKind.STRING).toBe(15);
      expect(SymbolKind.NUMBER).toBe(16);
      expect(SymbolKind.BOOLEAN).toBe(17);
      expect(SymbolKind.ARRAY).toBe(18);
      expect(SymbolKind.OBJECT).toBe(19);
      expect(SymbolKind.KEY).toBe(20);
      expect(SymbolKind.NULL).toBe(21);
      expect(SymbolKind.ENUM_MEMBER).toBe(22);
      expect(SymbolKind.STRUCT).toBe(23);
      expect(SymbolKind.EVENT).toBe(24);
      expect(SymbolKind.OPERATOR).toBe(25);
      expect(SymbolKind.TYPE_PARAMETER).toBe(26);
    });
  });

  describe('SymbolTag', () => {
    it('should have correct values', () => {
      expect(SymbolTag.DEPRECATED).toBe(1);
    });
  });

  describe('CompletionItemKind', () => {
    it('should have correct values', () => {
      expect(CompletionItemKind.TEXT).toBe(1);
      expect(CompletionItemKind.METHOD).toBe(2);
      expect(CompletionItemKind.FUNCTION).toBe(3);
      expect(CompletionItemKind.CONSTRUCTOR).toBe(4);
      expect(CompletionItemKind.FIELD).toBe(5);
      expect(CompletionItemKind.VARIABLE).toBe(6);
      expect(CompletionItemKind.CLASS).toBe(7);
      expect(CompletionItemKind.INTERFACE).toBe(8);
      expect(CompletionItemKind.MODULE).toBe(9);
      expect(CompletionItemKind.PROPERTY).toBe(10);
    });
  });

  describe('InsertTextFormat', () => {
    it('should have correct values', () => {
      expect(InsertTextFormat.PLAIN_TEXT).toBe(1);
      expect(InsertTextFormat.SNIPPET).toBe(2);
    });
  });

  describe('MarkupKind', () => {
    it('should have correct values', () => {
      expect(MarkupKind.PLAIN_TEXT).toBe('plaintext');
      expect(MarkupKind.MARKDOWN).toBe('markdown');
    });
  });

  describe('CodeActionKind', () => {
    it('should have correct values', () => {
      expect(CodeActionKind.EMPTY).toBe('');
      expect(CodeActionKind.QUICK_FIX).toBe('quickfix');
      expect(CodeActionKind.REFACTOR).toBe('refactor');
      expect(CodeActionKind.REFACTOR_EXTRACT).toBe('refactor.extract');
      expect(CodeActionKind.REFACTOR_INLINE).toBe('refactor.inline');
      expect(CodeActionKind.REFACTOR_REWRITE).toBe('refactor.rewrite');
      expect(CodeActionKind.SOURCE).toBe('source');
      expect(CodeActionKind.SOURCE_ORGANIZE_IMPORTS).toBe('source.organizeImports');
      expect(CodeActionKind.SOURCE_FIX_ALL).toBe('source.fixAll');
    });
  });

  describe('CodeActionTriggerKind', () => {
    it('should have correct values', () => {
      expect(CodeActionTriggerKind.INVOKED).toBe(1);
      expect(CodeActionTriggerKind.AUTOMATIC).toBe(2);
    });
  });

  describe('LSPServerStatus', () => {
    it('should have correct values', () => {
      expect(LSPServerStatus.STOPPED).toBe('stopped');
      expect(LSPServerStatus.STARTING).toBe('starting');
      expect(LSPServerStatus.RUNNING).toBe('running');
      expect(LSPServerStatus.ERROR).toBe('error');
      expect(LSPServerStatus.STOPPING).toBe('stopping');
    });
  });

  describe('LanguageId', () => {
    it('should have correct values', () => {
      expect(LanguageId.TYPESCRIPT).toBe('typescript');
      expect(LanguageId.TYPESCRIPT_REACT).toBe('typescriptreact');
      expect(LanguageId.JAVASCRIPT).toBe('javascript');
      expect(LanguageId.JAVASCRIPT_REACT).toBe('javascriptreact');
      expect(LanguageId.PYTHON).toBe('python');
      expect(LanguageId.RUST).toBe('rust');
      expect(LanguageId.GO).toBe('go');
      expect(LanguageId.JAVA).toBe('java');
      expect(LanguageId.C).toBe('c');
      expect(LanguageId.CPP).toBe('cpp');
      expect(LanguageId.CSHARP).toBe('csharp');
      expect(LanguageId.RUBY).toBe('ruby');
      expect(LanguageId.PHP).toBe('php');
      expect(LanguageId.HTML).toBe('html');
      expect(LanguageId.CSS).toBe('css');
      expect(LanguageId.JSON).toBe('json');
      expect(LanguageId.YAML).toBe('yaml');
      expect(LanguageId.MARKDOWN).toBe('markdown');
    });
  });
});

describe('DEFAULT_LSP_CLIENT_OPTIONS', () => {
  it('should have correct defaults', () => {
    expect(DEFAULT_LSP_CLIENT_OPTIONS.timeout).toBe(30000);
    expect(DEFAULT_LSP_CLIENT_OPTIONS.autoStart).toBe(true);
    expect(DEFAULT_LSP_CLIENT_OPTIONS.autoRestart).toBe(true);
    expect(DEFAULT_LSP_CLIENT_OPTIONS.maxRestartAttempts).toBe(3);
    expect(DEFAULT_LSP_CLIENT_OPTIONS.restartDelay).toBe(1000);
    expect(DEFAULT_LSP_CLIENT_OPTIONS.logging).toBe(false);
    expect(DEFAULT_LSP_CLIENT_OPTIONS.logLevel).toBe('info');
  });

  it('should be a valid object', () => {
    expect(typeof DEFAULT_LSP_CLIENT_OPTIONS).toBe('object');
    expect(DEFAULT_LSP_CLIENT_OPTIONS).not.toBeNull();
  });
});

describe('COMMON_LSP_SERVERS', () => {
  it('should have TypeScript server config', () => {
    const config = COMMON_LSP_SERVERS[LanguageId.TYPESCRIPT];
    expect(config).toBeDefined();
    expect(config.id).toBe('typescript-language-server');
    expect(config.command).toBe('typescript-language-server');
    expect(config.args).toContain('--stdio');
  });

  it('should have Python server config', () => {
    const config = COMMON_LSP_SERVERS[LanguageId.PYTHON];
    expect(config).toBeDefined();
    expect(config.id).toBe('pyright-language-server');
    expect(config.command).toBe('pyright-langserver');
  });

  it('should have Rust server config', () => {
    const config = COMMON_LSP_SERVERS[LanguageId.RUST];
    expect(config).toBeDefined();
    expect(config.id).toBe('rust-analyzer');
    expect(config.command).toBe('rust-analyzer');
  });

  it('should have Go server config', () => {
    const config = COMMON_LSP_SERVERS[LanguageId.GO];
    expect(config).toBeDefined();
    expect(config.id).toBe('gopls');
    expect(config.command).toBe('gopls');
  });

  it('should have configs for all language IDs', () => {
    const allLanguages = Object.values(LanguageId);
    for (const lang of allLanguages) {
      expect(COMMON_LSP_SERVERS[lang]).toBeDefined();
    }
  });
});

describe('Position and Range', () => {
  it('should create valid Position', () => {
    const pos: Position = { line: 10, character: 5 };
    expect(pos.line).toBe(10);
    expect(pos.character).toBe(5);
  });

  it('should create zero Position', () => {
    const pos: Position = { line: 0, character: 0 };
    expect(pos.line).toBe(0);
    expect(pos.character).toBe(0);
  });

  it('should create valid Range', () => {
    const range: Range = {
      start: { line: 0, character: 0 },
      end: { line: 10, character: 20 },
    };
    expect(range.start.line).toBe(0);
    expect(range.end.line).toBe(10);
  });

  it('should create single-line Range', () => {
    const range: Range = {
      start: { line: 5, character: 10 },
      end: { line: 5, character: 25 },
    };
    expect(range.start.line).toBe(range.end.line);
  });

  it('should create empty Range', () => {
    const range: Range = {
      start: { line: 3, character: 5 },
      end: { line: 3, character: 5 },
    };
    expect(range.start.line).toBe(range.end.line);
    expect(range.start.character).toBe(range.end.character);
  });
});
