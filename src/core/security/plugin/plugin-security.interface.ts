/**
 * Plugin Security Interfaces
 *
 * Feature: F5.1 - Plugin Security
 * Provides plugin verification, sandboxing, and security policy management
 *
 * @module core/security/plugin
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';
import { TrustLevel } from '../trust/trust.interface.js';

// Re-export TrustLevel from trust module for convenience
export { TrustLevel };

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Unique plugin identifier */
  id: string;
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin author */
  author?: string;
  /** Plugin description */
  description?: string;
  /** Plugin homepage */
  homepage?: string;
  /** Plugin repository */
  repository?: string;
  /** Plugin license */
  license?: string;
  /** Required permissions */
  permissions?: PluginPermission[];
  /** Plugin capabilities */
  capabilities?: string[];
  /** Plugin entry point */
  main?: string;
  /** Plugin signature */
  signature?: string;
  /** Checksum for verification */
  checksum?: string;
}

/**
 * Plugin permission types
 */
export type PluginPermission =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'filesystem:execute'
  | 'network:outbound'
  | 'network:inbound'
  | 'process:spawn'
  | 'process:kill'
  | 'env:read'
  | 'env:write'
  | 'system:info'
  | 'llm:access'
  | 'agent:create'
  | 'agent:control'
  | 'tool:register'
  | 'hook:register'
  | 'secret:read'
  | 'secret:write';

/**
 * Security issue severity
 */
export enum SecurityIssueSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Security issue detected in plugin
 */
export interface SecurityIssue {
  /** Issue identifier */
  id: string;
  /** Issue severity */
  severity: SecurityIssueSeverity;
  /** Issue category */
  category: string;
  /** Issue message */
  message: string;
  /** Code location if applicable */
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  /** Suggested fix */
  suggestion?: string;
  /** Reference documentation */
  reference?: string;
}

/**
 * Plugin verification result
 */
export interface VerificationResult {
  /** Whether verification passed */
  verified: boolean;
  /** Assigned trust level */
  trustLevel: TrustLevel;
  /** Security issues found */
  issues: SecurityIssue[];
  /** Plugin signature if valid */
  signature?: string;
  /** Verification timestamp */
  timestamp: Date;
  /** Verification duration in ms */
  duration: number;
  /** Verification details */
  details?: {
    checksumValid?: boolean;
    signatureValid?: boolean;
    permissionsValid?: boolean;
    codeScanned?: boolean;
    dependenciesChecked?: boolean;
  };
}

/**
 * Code scan result
 */
export interface ScanResult {
  /** Whether scan passed */
  passed: boolean;
  /** Security issues found */
  issues: SecurityIssue[];
  /** Files scanned */
  filesScanned: number;
  /** Lines of code scanned */
  linesScanned: number;
  /** Scan duration in ms */
  duration: number;
  /** Patterns matched */
  patternsMatched: string[];
}

/**
 * Network policy for sandbox
 */
export interface NetworkPolicy {
  /** Allow outbound connections */
  allowOutbound: boolean;
  /** Allowed outbound hosts */
  allowedHosts?: string[];
  /** Blocked hosts */
  blockedHosts?: string[];
  /** Allowed ports */
  allowedPorts?: number[];
  /** Allow DNS resolution */
  allowDns: boolean;
  /** Max connections */
  maxConnections?: number;
  /** Bandwidth limit in bytes/sec */
  bandwidthLimit?: number;
}

/**
 * Filesystem policy for sandbox
 */
export interface FSPolicy {
  /** Allow file reads */
  allowRead: boolean;
  /** Allow file writes */
  allowWrite: boolean;
  /** Allow file execution */
  allowExecute: boolean;
  /** Allowed read paths */
  allowedReadPaths?: string[];
  /** Allowed write paths */
  allowedWritePaths?: string[];
  /** Blocked paths */
  blockedPaths?: string[];
  /** Max file size for read/write */
  maxFileSize?: number;
  /** Allow creating directories */
  allowMkdir: boolean;
  /** Allow deleting files */
  allowDelete: boolean;
}

/**
 * Process policy for sandbox
 */
export interface ProcessPolicy {
  /** Allow spawning processes */
  allowSpawn: boolean;
  /** Allowed commands */
  allowedCommands?: string[];
  /** Blocked commands */
  blockedCommands?: string[];
  /** Max concurrent processes */
  maxProcesses?: number;
  /** Process timeout in ms */
  timeout?: number;
  /** Allow shell execution */
  allowShell: boolean;
}

/**
 * Resource limits for sandbox
 */
export interface ResourceLimits {
  /** Max memory in bytes */
  maxMemory?: number;
  /** Max CPU time in ms */
  maxCpuTime?: number;
  /** Max execution time in ms */
  maxExecutionTime?: number;
  /** Max open files */
  maxOpenFiles?: number;
  /** Max network connections */
  maxConnections?: number;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Plugin ID */
  pluginId: string;
  /** Trust level */
  trustLevel: TrustLevel;
  /** Network policy */
  network: NetworkPolicy;
  /** Filesystem policy */
  filesystem: FSPolicy;
  /** Process policy */
  process: ProcessPolicy;
  /** Resource limits */
  resources: ResourceLimits;
  /** Allowed environment variables */
  allowedEnvVars?: string[];
  /** Isolated from other plugins */
  isolated: boolean;
}

/**
 * Sandbox execution context
 */
export interface SandboxContext {
  /** Sandbox ID */
  sandboxId: string;
  /** Plugin ID */
  pluginId: string;
  /** Start time */
  startTime: Date;
  /** Resource usage */
  resourceUsage: {
    memory: number;
    cpuTime: number;
    openFiles: number;
    networkConnections: number;
  };
  /** Violations detected */
  violations: SecurityViolation[];
}

/**
 * Security violation in sandbox
 */
export interface SecurityViolation {
  /** Violation type */
  type: 'network' | 'filesystem' | 'process' | 'resource' | 'permission';
  /** Violation message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Action attempted */
  action: string;
  /** Whether violation was blocked */
  blocked: boolean;
}

/**
 * Plugin interface for security manager
 */
export interface IPlugin {
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Plugin source code or path */
  source: string | (() => unknown);
  /** Whether plugin is loaded */
  loaded: boolean;
  /** Plugin instance */
  instance?: unknown;
}

/**
 * Plugin Security Manager interface
 */
export interface IPluginSecurityManager extends IDisposable {
  /**
   * Verify a plugin's security
   * @param plugin Plugin to verify
   * @returns Verification result
   */
  verify(plugin: IPlugin): Promise<VerificationResult>;

  /**
   * Run a function in sandboxed environment
   * @param plugin Plugin context
   * @param fn Function to execute
   * @returns Function result
   */
  runInSandbox<T>(plugin: IPlugin, fn: () => T | Promise<T>): Promise<T>;

  /**
   * Scan code for security issues
   * @param code Source code to scan
   * @param options Scan options
   * @returns Scan result
   */
  scanCode(code: string, options?: CodeScanOptions): Promise<ScanResult>;

  /**
   * Set network policy for a plugin
   * @param pluginId Plugin identifier
   * @param policy Network policy
   */
  setNetworkPolicy(pluginId: string, policy: NetworkPolicy): void;

  /**
   * Set filesystem policy for a plugin
   * @param pluginId Plugin identifier
   * @param policy Filesystem policy
   */
  setFSPolicy(pluginId: string, policy: FSPolicy): void;

  /**
   * Set process policy for a plugin
   * @param pluginId Plugin identifier
   * @param policy Process policy
   */
  setProcessPolicy(pluginId: string, policy: ProcessPolicy): void;

  /**
   * Set resource limits for a plugin
   * @param pluginId Plugin identifier
   * @param limits Resource limits
   */
  setResourceLimits(pluginId: string, limits: ResourceLimits): void;

  /**
   * Get sandbox configuration for a plugin
   * @param pluginId Plugin identifier
   * @returns Sandbox configuration
   */
  getSandboxConfig(pluginId: string): SandboxConfig | undefined;

  /**
   * Get sandbox context for running plugin
   * @param pluginId Plugin identifier
   * @returns Sandbox context if running
   */
  getSandboxContext(pluginId: string): SandboxContext | undefined;

  /**
   * Register security violation handler
   * @param handler Violation handler
   * @returns Unsubscribe function
   */
  onViolation(handler: (violation: SecurityViolation, pluginId: string) => void): () => void;

  /**
   * Check if plugin has permission
   * @param pluginId Plugin identifier
   * @param permission Permission to check
   * @returns Whether plugin has permission
   */
  hasPermission(pluginId: string, permission: PluginPermission): boolean;

  /**
   * Grant permission to plugin
   * @param pluginId Plugin identifier
   * @param permission Permission to grant
   */
  grantPermission(pluginId: string, permission: PluginPermission): void;

  /**
   * Revoke permission from plugin
   * @param pluginId Plugin identifier
   * @param permission Permission to revoke
   */
  revokePermission(pluginId: string, permission: PluginPermission): void;

  /**
   * Get all permissions for a plugin
   * @param pluginId Plugin identifier
   * @returns Set of permissions
   */
  getPermissions(pluginId: string): Set<PluginPermission>;

  /**
   * Terminate sandbox for a plugin
   * @param pluginId Plugin identifier
   * @param reason Termination reason
   */
  terminateSandbox(pluginId: string, reason?: string): Promise<void>;
}

/**
 * Code scan options
 */
export interface CodeScanOptions {
  /** Patterns to check */
  patterns?: SecurityPattern[];
  /** File extensions to scan */
  extensions?: string[];
  /** Max file size to scan */
  maxFileSize?: number;
  /** Scan timeout in ms */
  timeout?: number;
  /** Include dependencies */
  includeDependencies?: boolean;
}

/**
 * Security pattern for code scanning
 */
export interface SecurityPattern {
  /** Pattern identifier */
  id: string;
  /** Pattern name */
  name: string;
  /** Regex pattern */
  pattern: RegExp;
  /** Issue severity */
  severity: SecurityIssueSeverity;
  /** Issue message */
  message: string;
  /** Pattern category */
  category: string;
  /** Languages this pattern applies to */
  languages?: string[];
}

/**
 * Default security patterns for code scanning
 */
export const DEFAULT_SECURITY_PATTERNS: SecurityPattern[] = [
  {
    id: 'eval-usage',
    name: 'Eval Usage',
    pattern: /\beval\s*\(/g,
    severity: SecurityIssueSeverity.HIGH,
    message: 'Use of eval() is dangerous and can lead to code injection',
    category: 'code-injection',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'function-constructor',
    name: 'Function Constructor',
    pattern: /new\s+Function\s*\(/g,
    severity: SecurityIssueSeverity.HIGH,
    message: 'Function constructor can be used for code injection',
    category: 'code-injection',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'child-process-exec',
    name: 'Child Process Exec',
    pattern: /child_process['"]\s*\)?\s*\.\s*exec\s*\(/g,
    severity: SecurityIssueSeverity.MEDIUM,
    message: 'exec() can be vulnerable to command injection, prefer execFile()',
    category: 'command-injection',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'shell-true',
    name: 'Shell True Option',
    pattern: /shell\s*:\s*true/g,
    severity: SecurityIssueSeverity.MEDIUM,
    message: 'Using shell: true can lead to command injection',
    category: 'command-injection',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'hardcoded-secret',
    name: 'Hardcoded Secret',
    pattern: /(password|secret|api_key|apikey|token|auth)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
    severity: SecurityIssueSeverity.HIGH,
    message: 'Potential hardcoded secret detected',
    category: 'secrets',
  },
  {
    id: 'sql-injection',
    name: 'SQL Injection',
    pattern: /(\$\{.*?\}|'\s*\+\s*\w+\s*\+\s*')/g,
    severity: SecurityIssueSeverity.HIGH,
    message: 'Potential SQL injection vulnerability',
    category: 'sql-injection',
  },
  {
    id: 'unsafe-regex',
    name: 'Unsafe Regex',
    pattern: /new\s+RegExp\s*\(\s*[^)]*\+/g,
    severity: SecurityIssueSeverity.MEDIUM,
    message: 'Dynamic regex can be vulnerable to ReDoS attacks',
    category: 'redos',
  },
  {
    id: 'prototype-pollution',
    name: 'Prototype Pollution',
    pattern: /\[['"]__proto__['"]\]|\[['"]constructor['"]\]|\[['"]prototype['"]\]/g,
    severity: SecurityIssueSeverity.HIGH,
    message: 'Potential prototype pollution vulnerability',
    category: 'prototype-pollution',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'path-traversal',
    name: 'Path Traversal',
    pattern: /\.\.[\/\\]/g,
    severity: SecurityIssueSeverity.MEDIUM,
    message: 'Path traversal pattern detected',
    category: 'path-traversal',
  },
  {
    id: 'unsafe-deserialization',
    name: 'Unsafe Deserialization',
    pattern: /JSON\.parse\s*\(\s*(?!.*JSON\.stringify)/g,
    severity: SecurityIssueSeverity.LOW,
    message: 'Ensure JSON.parse input is trusted',
    category: 'deserialization',
  },
  {
    id: 'crypto-weak',
    name: 'Weak Crypto',
    pattern: /createHash\s*\(\s*['"]md5['"]\)|createHash\s*\(\s*['"]sha1['"]\)/g,
    severity: SecurityIssueSeverity.MEDIUM,
    message: 'MD5 and SHA1 are considered weak, use SHA256 or better',
    category: 'crypto',
  },
  {
    id: 'http-without-tls',
    name: 'HTTP Without TLS',
    pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/g,
    severity: SecurityIssueSeverity.LOW,
    message: 'Consider using HTTPS for external connections',
    category: 'transport',
  },
];
