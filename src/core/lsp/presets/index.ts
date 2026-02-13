/**
 * LSP Server Presets
 *
 * Pre-configured language server entries for common languages.
 * Each preset contains the command, args, and language identifiers
 * needed to connect to a well-known language server.
 *
 * @module core/lsp/presets
 */

import type { LSPServerEntry } from '../lsp-connection-manager';

// ============================================================================
// Presets
// ============================================================================

export const LSP_PRESETS: Record<string, LSPServerEntry> = {
  typescript: {
    name: 'typescript',
    languages: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
    command: 'typescript-language-server',
    args: ['--stdio'],
  },
  python: {
    name: 'python',
    languages: ['python'],
    command: 'pylsp',
    args: [],
  },
  go: {
    name: 'go',
    languages: ['go'],
    command: 'gopls',
    args: ['serve'],
  },
  rust: {
    name: 'rust',
    languages: ['rust'],
    command: 'rust-analyzer',
    args: [],
  },
  css: {
    name: 'css',
    languages: ['css', 'scss', 'less'],
    command: 'vscode-css-language-server',
    args: ['--stdio'],
  },
};

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get a preset language server entry by name.
 * Returns undefined if the preset does not exist.
 */
export function getLSPPreset(name: string): LSPServerEntry | undefined {
  return LSP_PRESETS[name];
}

/**
 * List all available preset names.
 */
export function listLSPPresets(): string[] {
  return Object.keys(LSP_PRESETS);
}
