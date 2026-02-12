/**
 * Diagnostics Collector
 *
 * Collects and manages LSP diagnostics (errors, warnings, info, hints)
 * per file URI. Supports adding diagnostics directly, collecting from
 * external sources, and computing aggregate counts.
 *
 * @module core/lsp
 */

import type {
  Diagnostic,
  IDiagnosticsCollector,
} from './interfaces/lsp.interface';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticsCollectorOptions {
  /** Custom collector function for a single URI */
  uriCollector?: (uri: string) => Promise<Diagnostic[]>;
}

// ============================================================================
// Implementation
// ============================================================================

export class DiagnosticsCollector implements IDiagnosticsCollector {
  private diagnosticsByUri: Map<string, Diagnostic[]> = new Map();
  private readonly uriCollector: ((uri: string) => Promise<Diagnostic[]>) | null;

  constructor(options?: DiagnosticsCollectorOptions) {
    this.uriCollector = options?.uriCollector ?? null;
  }

  /**
   * Collect diagnostics for a specific URI.
   * If a uriCollector is configured, delegates to it and stores the result.
   * Otherwise returns any previously added diagnostics.
   */
  async collectDiagnostics(uri: string): Promise<Diagnostic[]> {
    if (this.uriCollector) {
      const diagnostics = await this.uriCollector(uri);
      this.diagnosticsByUri.set(uri, diagnostics);
      return diagnostics;
    }

    return this.diagnosticsByUri.get(uri) ?? [];
  }

  /**
   * Collect all diagnostics across all known URIs.
   */
  async collectAll(): Promise<Map<string, Diagnostic[]>> {
    return new Map(this.diagnosticsByUri);
  }

  /**
   * Get total error count across all URIs.
   */
  getErrorCount(): number {
    let count = 0;
    for (const diagnostics of this.diagnosticsByUri.values()) {
      count += diagnostics.filter((d) => d.severity === 'error').length;
    }
    return count;
  }

  /**
   * Get total warning count across all URIs.
   */
  getWarningCount(): number {
    let count = 0;
    for (const diagnostics of this.diagnosticsByUri.values()) {
      count += diagnostics.filter((d) => d.severity === 'warning').length;
    }
    return count;
  }

  /**
   * Add a diagnostic for a URI directly (without the collector).
   */
  addDiagnostic(uri: string, diagnostic: Diagnostic): void {
    const existing = this.diagnosticsByUri.get(uri) ?? [];
    existing.push(diagnostic);
    this.diagnosticsByUri.set(uri, existing);
  }

  /**
   * Clear all stored diagnostics.
   */
  clear(): void {
    this.diagnosticsByUri.clear();
  }

  /**
   * Get all tracked URIs.
   */
  getTrackedUris(): string[] {
    return Array.from(this.diagnosticsByUri.keys());
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createDiagnosticsCollector(
  options?: DiagnosticsCollectorOptions,
): DiagnosticsCollector {
  return new DiagnosticsCollector(options);
}
