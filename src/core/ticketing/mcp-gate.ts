/**
 * MCP Gate
 *
 * Structured readiness checks for MCP before ticket lifecycle operations.
 * Performs individual checks (registry initialization, connection status,
 * tool availability) and returns a diagnostic result with reason codes
 * for clear failure reporting and telemetry.
 *
 * @module core/ticketing/mcp-gate
 */

import { ServiceRegistry } from '@/core/services/service-registry';
import { createAgentLogger } from '../../shared/logging/logger';

const log = createAgentLogger('MCPGate', 'mcp-gate');

// ============================================================================
// Types & Enums
// ============================================================================

/**
 * Reason codes for MCP gate check outcomes.
 */
export enum MCPGateReasonCode {
  /** MCP is ready for ticket operations */
  READY = 'READY',
  /** ServiceRegistry singleton has not been initialized */
  REGISTRY_NOT_INITIALIZED = 'REGISTRY_NOT_INITIALIZED',
  /** No MCP server is currently connected */
  MCP_NOT_CONNECTED = 'MCP_NOT_CONNECTED',
  /** Required MCP tools are not available on any connected server */
  TOOLS_UNAVAILABLE = 'TOOLS_UNAVAILABLE',
}

/**
 * Result of a single sub-check within the MCP gate.
 */
export interface MCPCheckResult {
  /** Human-readable name of the check */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Diagnostic message describing the outcome */
  message: string;
}

/**
 * Aggregate result of all MCP gate checks.
 */
export interface MCPGateResult {
  /** Overall readiness — true only when all critical checks pass */
  ready: boolean;
  /** Primary reason code summarizing the outcome */
  reasonCode: MCPGateReasonCode;
  /** Human-readable details string suitable for error messages */
  details: string;
  /** Timestamp of when the gate check was performed */
  timestamp: Date;
  /** Individual check results for diagnostic drill-down */
  checks: MCPCheckResult[];
}

// ============================================================================
// Gate Check Options
// ============================================================================

export interface MCPGateOptions {
  /**
   * Tool names that must be present on at least one connected MCP server.
   * When provided and non-empty, a TOOLS_UNAVAILABLE failure is raised
   * if any listed tool is missing.
   * When omitted or empty, tool availability is not checked.
   */
  requiredTools?: string[];
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Check whether the MCP subsystem is ready for ticket lifecycle operations.
 *
 * Performs three ordered checks:
 *  1. ServiceRegistry initialized
 *  2. At least one MCP connection active (via ConnectionManager or MCPClient)
 *  3. Required tools available (optional, only when `requiredTools` is provided)
 *
 * The first failing critical check short-circuits subsequent checks and
 * determines the overall `reasonCode`.
 */
export function checkMCPReadiness(
  registry: ServiceRegistry,
  options: MCPGateOptions = {},
): MCPGateResult {
  const checks: MCPCheckResult[] = [];
  const timestamp = new Date();

  // ---- Check 1: ServiceRegistry initialized ----
  const registryInitialized = registry.isInitialized();
  checks.push({
    name: 'ServiceRegistry initialized',
    passed: registryInitialized,
    message: registryInitialized
      ? 'ServiceRegistry is initialized'
      : 'ServiceRegistry.isInitialized() returned false',
  });

  if (!registryInitialized) {
    const result: MCPGateResult = {
      ready: false,
      reasonCode: MCPGateReasonCode.REGISTRY_NOT_INITIALIZED,
      details:
        'MCP gate failed: ServiceRegistry is not initialized. ' +
        'Call ServiceRegistry.initialize() before starting ticket operations.',
      timestamp,
      checks,
    };
    emitTelemetry(result);
    return result;
  }

  // ---- Check 2: MCP connection active ----
  const connectionCheck = checkMCPConnection(registry);
  checks.push(connectionCheck);

  if (!connectionCheck.passed) {
    const result: MCPGateResult = {
      ready: false,
      reasonCode: MCPGateReasonCode.MCP_NOT_CONNECTED,
      details:
        `MCP gate failed: ${connectionCheck.message}. ` +
        'Ensure at least one MCP server is connected.',
      timestamp,
      checks,
    };
    emitTelemetry(result);
    return result;
  }

  // ---- Check 3: Required tools available (optional) ----
  const requiredTools = options.requiredTools ?? [];
  if (requiredTools.length > 0) {
    const toolsCheck = checkRequiredTools(registry, requiredTools);
    checks.push(toolsCheck);

    if (!toolsCheck.passed) {
      const result: MCPGateResult = {
        ready: false,
        reasonCode: MCPGateReasonCode.TOOLS_UNAVAILABLE,
        details:
          `MCP gate failed: ${toolsCheck.message}. ` +
          'Ensure the required MCP servers are connected and expose the expected tools.',
        timestamp,
        checks,
      };
      emitTelemetry(result);
      return result;
    }
  }

  // ---- All checks passed ----
  const result: MCPGateResult = {
    ready: true,
    reasonCode: MCPGateReasonCode.READY,
    details: 'MCP gate passed: all checks succeeded',
    timestamp,
    checks,
  };
  emitTelemetry(result);
  return result;
}

// ============================================================================
// Sub-Checks
// ============================================================================

function checkMCPConnection(registry: ServiceRegistry): MCPCheckResult {
  // Prefer ConnectionManager (multi-server) if available
  const manager = registry.getMCPConnectionManager();
  if (manager) {
    const statuses = manager.getStatus();
    const connected = statuses.some((s) => s.connected);
    return {
      name: 'MCP connection active',
      passed: connected,
      message: connected
        ? `At least one MCP server connected (${statuses.filter((s) => s.connected).length}/${statuses.length})`
        : `No MCP server connected (0/${statuses.length} servers)`,
    };
  }

  // Fallback to single MCPClient
  const client = registry.getMCPClient();
  if (client && client.isConnected()) {
    return {
      name: 'MCP connection active',
      passed: true,
      message: 'Single MCP client is connected',
    };
  }

  return {
    name: 'MCP connection active',
    passed: false,
    message: client
      ? 'MCP client exists but is not connected'
      : 'No MCP client or connection manager available',
  };
}

function checkRequiredTools(
  registry: ServiceRegistry,
  requiredTools: string[],
): MCPCheckResult {
  const manager = registry.getMCPConnectionManager();
  const availableToolNames: string[] = [];

  if (manager) {
    const allTools = manager.getAllTools();
    availableToolNames.push(...allTools.map((t) => t.name));
  }

  const missing = requiredTools.filter(
    (tool) => !availableToolNames.includes(tool),
  );

  if (missing.length === 0) {
    return {
      name: 'Required tools available',
      passed: true,
      message: `All ${requiredTools.length} required tool(s) are available`,
    };
  }

  return {
    name: 'Required tools available',
    passed: false,
    message: `Missing tools: ${missing.join(', ')}`,
  };
}

// ============================================================================
// Telemetry
// ============================================================================

function emitTelemetry(result: MCPGateResult): void {
  const meta: Record<string, unknown> = {
    reasonCode: result.reasonCode,
    ready: result.ready,
    checkCount: result.checks.length,
    passedCount: result.checks.filter((c) => c.passed).length,
    failedCount: result.checks.filter((c) => !c.passed).length,
  };

  if (result.ready) {
    log.info('MCP gate check passed', meta);
  } else {
    log.warn('MCP gate check failed', {
      ...meta,
      details: result.details,
      failedChecks: result.checks
        .filter((c) => !c.passed)
        .map((c) => ({ name: c.name, message: c.message })),
    });
  }
}
