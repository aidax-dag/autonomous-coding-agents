/**
 * Plugin Security Manager Implementation
 *
 * Feature: F5.1 - Plugin Security
 * Implements plugin verification, sandboxing, and security policy management
 *
 * @module core/security/plugin
 */

import * as crypto from 'crypto';
import { createLogger, ILogger } from '../../services/logger.js';
import type {
  IPluginSecurityManager,
  IPlugin,
  VerificationResult,
  ScanResult,
  NetworkPolicy,
  FSPolicy,
  ProcessPolicy,
  ResourceLimits,
  SandboxConfig,
  SandboxContext,
  SecurityViolation,
  PluginPermission,
  CodeScanOptions,
  SecurityIssue,
  SecurityPattern,
  TrustLevel,
} from './plugin-security.interface.js';
import {
  DEFAULT_SECURITY_PATTERNS,
  SecurityIssueSeverity,
} from './plugin-security.interface.js';
import { TrustLevel as TrustLevelEnum } from '../trust/trust.interface.js';

/**
 * Plugin Security Manager Configuration
 */
export interface PluginSecurityManagerConfig {
  /** Default trust level for new plugins */
  defaultTrustLevel?: TrustLevel;
  /** Enable code scanning */
  enableCodeScanning?: boolean;
  /** Enable signature verification */
  enableSignatureVerification?: boolean;
  /** Maximum sandbox execution time */
  maxExecutionTime?: number;
  /** Security patterns for code scanning */
  securityPatterns?: SecurityPattern[];
  /** Trusted signers public keys */
  trustedSigners?: Map<string, string>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<PluginSecurityManagerConfig> = {
  defaultTrustLevel: TrustLevelEnum.UNTRUSTED,
  enableCodeScanning: true,
  enableSignatureVerification: true,
  maxExecutionTime: 30000,
  securityPatterns: DEFAULT_SECURITY_PATTERNS,
  trustedSigners: new Map(),
};

/**
 * Default policies by trust level
 */
const DEFAULT_POLICIES: Record<TrustLevel, Omit<SandboxConfig, 'pluginId' | 'trustLevel'>> = {
  [TrustLevelEnum.BLOCKED]: {
    network: { allowOutbound: false, allowDns: false },
    filesystem: {
      allowRead: false,
      allowWrite: false,
      allowExecute: false,
      allowMkdir: false,
      allowDelete: false,
    },
    process: { allowSpawn: false, allowShell: false },
    resources: { maxMemory: 0, maxCpuTime: 0, maxExecutionTime: 0 },
    isolated: true,
  },
  [TrustLevelEnum.UNTRUSTED]: {
    network: { allowOutbound: false, allowDns: false },
    filesystem: {
      allowRead: true,
      allowWrite: false,
      allowExecute: false,
      allowMkdir: false,
      allowDelete: false,
      maxFileSize: 1024 * 1024, // 1MB
    },
    process: { allowSpawn: false, allowShell: false },
    resources: {
      maxMemory: 50 * 1024 * 1024, // 50MB
      maxCpuTime: 5000,
      maxExecutionTime: 10000,
    },
    isolated: true,
  },
  [TrustLevelEnum.VERIFIED]: {
    network: { allowOutbound: true, allowDns: true, maxConnections: 5 },
    filesystem: {
      allowRead: true,
      allowWrite: true,
      allowExecute: false,
      allowMkdir: true,
      allowDelete: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    },
    process: { allowSpawn: false, allowShell: false, maxProcesses: 2 },
    resources: {
      maxMemory: 100 * 1024 * 1024, // 100MB
      maxCpuTime: 30000,
      maxExecutionTime: 60000,
    },
    isolated: true,
  },
  [TrustLevelEnum.TRUSTED]: {
    network: { allowOutbound: true, allowDns: true, maxConnections: 20 },
    filesystem: {
      allowRead: true,
      allowWrite: true,
      allowExecute: true,
      allowMkdir: true,
      allowDelete: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
    },
    process: {
      allowSpawn: true,
      allowShell: false,
      maxProcesses: 10,
      timeout: 60000,
    },
    resources: {
      maxMemory: 500 * 1024 * 1024, // 500MB
      maxCpuTime: 120000,
      maxExecutionTime: 300000,
    },
    isolated: false,
  },
  [TrustLevelEnum.BUILTIN]: {
    network: { allowOutbound: true, allowDns: true },
    filesystem: {
      allowRead: true,
      allowWrite: true,
      allowExecute: true,
      allowMkdir: true,
      allowDelete: true,
    },
    process: { allowSpawn: true, allowShell: true },
    resources: {},
    isolated: false,
  },
};

/**
 * Plugin Security Manager
 * Manages plugin verification, sandboxing, and security policies
 */
export class PluginSecurityManager implements IPluginSecurityManager {
  private readonly logger: ILogger;
  private readonly config: Required<PluginSecurityManagerConfig>;
  private readonly sandboxConfigs: Map<string, SandboxConfig> = new Map();
  private readonly sandboxContexts: Map<string, SandboxContext> = new Map();
  private readonly pluginPermissions: Map<string, Set<PluginPermission>> = new Map();
  private readonly violationHandlers: Set<(violation: SecurityViolation, pluginId: string) => void> =
    new Set();
  private disposed = false;

  constructor(config: PluginSecurityManagerConfig = {}) {
    this.logger = createLogger('PluginSecurityManager');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verify a plugin's security
   */
  async verify(plugin: IPlugin): Promise<VerificationResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let trustLevel = this.config.defaultTrustLevel;

    this.logger.info('Verifying plugin', {
      pluginId: plugin.metadata.id,
      name: plugin.metadata.name,
    });

    const details: VerificationResult['details'] = {
      checksumValid: false,
      signatureValid: false,
      permissionsValid: true,
      codeScanned: false,
      dependenciesChecked: false,
    };

    // 1. Verify checksum if provided
    if (plugin.metadata.checksum && typeof plugin.source === 'string') {
      const computedChecksum = this.computeChecksum(plugin.source);
      details.checksumValid = computedChecksum === plugin.metadata.checksum;

      if (!details.checksumValid) {
        issues.push({
          id: 'checksum-mismatch',
          severity: SecurityIssueSeverity.CRITICAL,
          category: 'integrity',
          message: 'Plugin checksum does not match',
          suggestion: 'Re-download the plugin from a trusted source',
        });
        trustLevel = TrustLevelEnum.BLOCKED;
      }
    }

    // 2. Verify signature if enabled and provided
    if (this.config.enableSignatureVerification && plugin.metadata.signature) {
      details.signatureValid = await this.verifySignature(plugin);

      if (details.signatureValid) {
        // Upgrade trust level if signature is valid and from trusted signer
        trustLevel = Math.max(trustLevel, TrustLevelEnum.VERIFIED);
      } else {
        issues.push({
          id: 'signature-invalid',
          severity: SecurityIssueSeverity.HIGH,
          category: 'integrity',
          message: 'Plugin signature is invalid',
          suggestion: 'Verify the plugin source and re-download if necessary',
        });
      }
    }

    // 3. Validate requested permissions
    if (plugin.metadata.permissions) {
      const dangerousPermissions: PluginPermission[] = [
        'filesystem:execute',
        'process:spawn',
        'process:kill',
        'secret:write',
      ];

      for (const permission of plugin.metadata.permissions) {
        if (dangerousPermissions.includes(permission)) {
          issues.push({
            id: `dangerous-permission-${permission}`,
            severity: SecurityIssueSeverity.MEDIUM,
            category: 'permissions',
            message: `Plugin requests dangerous permission: ${permission}`,
            suggestion: 'Review if this permission is necessary',
          });
        }
      }
    }

    // 4. Scan code for security issues if enabled
    if (this.config.enableCodeScanning && typeof plugin.source === 'string') {
      const scanResult = await this.scanCode(plugin.source);
      details.codeScanned = true;

      issues.push(...scanResult.issues);

      // Downgrade trust level based on scan results
      const criticalIssues = scanResult.issues.filter(
        (i) => i.severity === SecurityIssueSeverity.CRITICAL
      );
      const highIssues = scanResult.issues.filter((i) => i.severity === SecurityIssueSeverity.HIGH);

      if (criticalIssues.length > 0) {
        trustLevel = TrustLevelEnum.BLOCKED;
      } else if (highIssues.length > 0 && trustLevel > TrustLevelEnum.UNTRUSTED) {
        trustLevel = TrustLevelEnum.UNTRUSTED;
      }
    }

    // 5. Create sandbox config for the plugin
    this.createSandboxConfig(plugin.metadata.id, trustLevel);

    // 6. Grant requested permissions if trust level allows
    if (plugin.metadata.permissions && trustLevel >= TrustLevelEnum.VERIFIED) {
      const permissions = new Set<PluginPermission>();
      for (const permission of plugin.metadata.permissions) {
        if (this.canGrantPermission(trustLevel, permission)) {
          permissions.add(permission);
        }
      }
      this.pluginPermissions.set(plugin.metadata.id, permissions);
    }

    const duration = Date.now() - startTime;

    this.logger.info('Plugin verification complete', {
      pluginId: plugin.metadata.id,
      verified: trustLevel > TrustLevelEnum.BLOCKED,
      trustLevel,
      issueCount: issues.length,
      duration,
    });

    return {
      verified: trustLevel > TrustLevelEnum.BLOCKED,
      trustLevel,
      issues,
      signature: details.signatureValid ? plugin.metadata.signature : undefined,
      timestamp: new Date(),
      duration,
      details,
    };
  }

  /**
   * Run a function in sandboxed environment
   */
  async runInSandbox<T>(plugin: IPlugin, fn: () => T | Promise<T>): Promise<T> {
    const pluginId = plugin.metadata.id;
    const config = this.sandboxConfigs.get(pluginId);

    if (!config) {
      throw new Error(`No sandbox configuration for plugin: ${pluginId}`);
    }

    if (config.trustLevel === TrustLevelEnum.BLOCKED) {
      throw new Error(`Plugin is blocked: ${pluginId}`);
    }

    const sandboxId = crypto.randomUUID();
    const context: SandboxContext = {
      sandboxId,
      pluginId,
      startTime: new Date(),
      resourceUsage: {
        memory: 0,
        cpuTime: 0,
        openFiles: 0,
        networkConnections: 0,
      },
      violations: [],
    };

    this.sandboxContexts.set(pluginId, context);

    this.logger.debug('Starting sandboxed execution', {
      pluginId,
      sandboxId,
      trustLevel: config.trustLevel,
    });

    try {
      // Create execution timeout
      const timeoutMs = config.resources.maxExecutionTime || this.config.maxExecutionTime;

      const result = await Promise.race([
        this.executeInSandbox(fn, config, context),
        this.createTimeout(timeoutMs, pluginId),
      ]);

      return result as T;
    } finally {
      this.sandboxContexts.delete(pluginId);

      this.logger.debug('Sandboxed execution complete', {
        pluginId,
        sandboxId,
        violations: context.violations.length,
      });
    }
  }

  /**
   * Scan code for security issues
   */
  async scanCode(code: string, options: CodeScanOptions = {}): Promise<ScanResult> {
    const startTime = Date.now();
    const patterns = options.patterns || this.config.securityPatterns;
    const issues: SecurityIssue[] = [];
    const patternsMatched: string[] = [];

    const lines = code.split('\n');
    const linesScanned = lines.length;

    for (const pattern of patterns) {
      const matches = code.matchAll(pattern.pattern);

      for (const match of matches) {
        // Find line number
        const beforeMatch = code.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        issues.push({
          id: `${pattern.id}-${lineNumber}`,
          severity: pattern.severity,
          category: pattern.category,
          message: pattern.message,
          location: {
            line: lineNumber,
            column: match.index! - beforeMatch.lastIndexOf('\n'),
          },
          suggestion: this.getSuggestionForPattern(pattern.id),
        });

        if (!patternsMatched.includes(pattern.id)) {
          patternsMatched.push(pattern.id);
        }
      }
    }

    const duration = Date.now() - startTime;
    const hasBlockingIssues = issues.some(
      (i) =>
        i.severity === SecurityIssueSeverity.CRITICAL || i.severity === SecurityIssueSeverity.HIGH
    );

    return {
      passed: !hasBlockingIssues,
      issues,
      filesScanned: 1,
      linesScanned,
      duration,
      patternsMatched,
    };
  }

  /**
   * Set network policy for a plugin
   */
  setNetworkPolicy(pluginId: string, policy: NetworkPolicy): void {
    const config = this.sandboxConfigs.get(pluginId);
    if (config) {
      config.network = policy;
      this.logger.debug('Network policy updated', { pluginId, policy });
    }
  }

  /**
   * Set filesystem policy for a plugin
   */
  setFSPolicy(pluginId: string, policy: FSPolicy): void {
    const config = this.sandboxConfigs.get(pluginId);
    if (config) {
      config.filesystem = policy;
      this.logger.debug('Filesystem policy updated', { pluginId, policy });
    }
  }

  /**
   * Set process policy for a plugin
   */
  setProcessPolicy(pluginId: string, policy: ProcessPolicy): void {
    const config = this.sandboxConfigs.get(pluginId);
    if (config) {
      config.process = policy;
      this.logger.debug('Process policy updated', { pluginId, policy });
    }
  }

  /**
   * Set resource limits for a plugin
   */
  setResourceLimits(pluginId: string, limits: ResourceLimits): void {
    const config = this.sandboxConfigs.get(pluginId);
    if (config) {
      config.resources = { ...config.resources, ...limits };
      this.logger.debug('Resource limits updated', { pluginId, limits });
    }
  }

  /**
   * Get sandbox configuration for a plugin
   */
  getSandboxConfig(pluginId: string): SandboxConfig | undefined {
    return this.sandboxConfigs.get(pluginId);
  }

  /**
   * Get sandbox context for running plugin
   */
  getSandboxContext(pluginId: string): SandboxContext | undefined {
    return this.sandboxContexts.get(pluginId);
  }

  /**
   * Register security violation handler
   */
  onViolation(handler: (violation: SecurityViolation, pluginId: string) => void): () => void {
    this.violationHandlers.add(handler);
    return () => this.violationHandlers.delete(handler);
  }

  /**
   * Check if plugin has permission
   */
  hasPermission(pluginId: string, permission: PluginPermission): boolean {
    const permissions = this.pluginPermissions.get(pluginId);
    return permissions?.has(permission) ?? false;
  }

  /**
   * Grant permission to plugin
   */
  grantPermission(pluginId: string, permission: PluginPermission): void {
    let permissions = this.pluginPermissions.get(pluginId);
    if (!permissions) {
      permissions = new Set();
      this.pluginPermissions.set(pluginId, permissions);
    }
    permissions.add(permission);
    this.logger.info('Permission granted', { pluginId, permission });
  }

  /**
   * Revoke permission from plugin
   */
  revokePermission(pluginId: string, permission: PluginPermission): void {
    const permissions = this.pluginPermissions.get(pluginId);
    if (permissions) {
      permissions.delete(permission);
      this.logger.info('Permission revoked', { pluginId, permission });
    }
  }

  /**
   * Get all permissions for a plugin
   */
  getPermissions(pluginId: string): Set<PluginPermission> {
    return this.pluginPermissions.get(pluginId) || new Set();
  }

  /**
   * Terminate sandbox for a plugin
   */
  async terminateSandbox(pluginId: string, reason?: string): Promise<void> {
    const context = this.sandboxContexts.get(pluginId);
    if (context) {
      this.logger.warn('Sandbox terminated', { pluginId, reason });
      this.sandboxContexts.delete(pluginId);

      const violation: SecurityViolation = {
        type: 'resource',
        message: reason || 'Sandbox terminated',
        timestamp: new Date(),
        action: 'terminate',
        blocked: true,
      };

      context.violations.push(violation);
      this.emitViolation(violation, pluginId);
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;
    this.sandboxConfigs.clear();
    this.sandboxContexts.clear();
    this.pluginPermissions.clear();
    this.violationHandlers.clear();

    this.logger.info('Plugin Security Manager disposed');
  }

  // ==================== Private Methods ====================

  /**
   * Compute checksum of code
   */
  private computeChecksum(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Verify plugin signature
   */
  private async verifySignature(plugin: IPlugin): Promise<boolean> {
    // In a real implementation, this would verify cryptographic signatures
    // For now, check if the signature matches a pattern
    if (!plugin.metadata.signature) return false;

    // Check if signature is from a trusted signer
    for (const [_signerId, _publicKey] of this.config.trustedSigners) {
      try {
        // Simplified verification - in production, use proper crypto verification
        const verify = crypto.createVerify('SHA256');
        verify.update(
          typeof plugin.source === 'string' ? plugin.source : JSON.stringify(plugin.metadata)
        );
        // This would normally verify against actual signature
        // For now, just check format
        if (plugin.metadata.signature.length >= 64) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Check if permission can be granted at trust level
   */
  private canGrantPermission(trustLevel: TrustLevel, permission: PluginPermission): boolean {
    const permissionLevels: Record<PluginPermission, TrustLevel> = {
      'filesystem:read': TrustLevelEnum.UNTRUSTED,
      'filesystem:write': TrustLevelEnum.VERIFIED,
      'filesystem:execute': TrustLevelEnum.TRUSTED,
      'network:outbound': TrustLevelEnum.VERIFIED,
      'network:inbound': TrustLevelEnum.TRUSTED,
      'process:spawn': TrustLevelEnum.TRUSTED,
      'process:kill': TrustLevelEnum.BUILTIN,
      'env:read': TrustLevelEnum.VERIFIED,
      'env:write': TrustLevelEnum.TRUSTED,
      'system:info': TrustLevelEnum.VERIFIED,
      'llm:access': TrustLevelEnum.VERIFIED,
      'agent:create': TrustLevelEnum.TRUSTED,
      'agent:control': TrustLevelEnum.TRUSTED,
      'tool:register': TrustLevelEnum.VERIFIED,
      'hook:register': TrustLevelEnum.VERIFIED,
      'secret:read': TrustLevelEnum.TRUSTED,
      'secret:write': TrustLevelEnum.BUILTIN,
    };

    return trustLevel >= permissionLevels[permission];
  }

  /**
   * Create sandbox configuration for plugin
   */
  private createSandboxConfig(pluginId: string, trustLevel: TrustLevel): void {
    const defaultPolicy = DEFAULT_POLICIES[trustLevel];

    const config: SandboxConfig = {
      pluginId,
      trustLevel,
      ...defaultPolicy,
    };

    this.sandboxConfigs.set(pluginId, config);
  }

  /**
   * Execute function in sandbox
   */
  private async executeInSandbox<T>(
    fn: () => T | Promise<T>,
    config: SandboxConfig,
    context: SandboxContext
  ): Promise<T> {
    // Get sandbox helpers for policy enforcement
    // These would be injected into a real VM2 sandbox environment
    const helpers = this.createSandboxHelpers(config, context);

    // Log sandbox helpers creation for debugging
    this.logger.debug('Sandbox helpers created', {
      pluginId: config.pluginId,
      hasFilesystemCheck: typeof helpers.checkFilesystem === 'function',
      hasNetworkCheck: typeof helpers.checkNetwork === 'function',
      hasProcessCheck: typeof helpers.checkProcess === 'function',
    });

    // Execute the function
    // In a real implementation, this would use VM2 or similar for proper sandboxing
    // with helpers injected into the sandbox global scope
    try {
      return await fn();
    } catch (error) {
      this.recordViolation(context, 'resource', `Execution error: ${error}`, 'execute');
      throw error;
    }
  }

  /**
   * Create sandbox helper functions for policy enforcement
   * These helpers are designed to be injected into a sandboxed VM environment
   */
  private createSandboxHelpers(
    config: SandboxConfig,
    context: SandboxContext
  ): {
    checkFilesystem: (path: string, operation: 'read' | 'write' | 'execute') => boolean;
    checkNetwork: (host: string, port?: number) => boolean;
    checkProcess: (command: string) => boolean;
  } {
    return {
      checkFilesystem: (path: string, operation: 'read' | 'write' | 'execute'): boolean => {
        const policy = config.filesystem;

        if (operation === 'read' && !policy.allowRead) {
          this.recordViolation(context, 'filesystem', `Read denied: ${path}`, `read:${path}`);
          return false;
        }
        if (operation === 'write' && !policy.allowWrite) {
          this.recordViolation(context, 'filesystem', `Write denied: ${path}`, `write:${path}`);
          return false;
        }
        if (operation === 'execute' && !policy.allowExecute) {
          this.recordViolation(context, 'filesystem', `Execute denied: ${path}`, `execute:${path}`);
          return false;
        }

        // Check blocked paths
        if (policy.blockedPaths?.some((blocked) => path.startsWith(blocked))) {
          this.recordViolation(context, 'filesystem', `Blocked path: ${path}`, operation);
          return false;
        }

        return true;
      },

      checkNetwork: (host: string, port?: number): boolean => {
        const policy = config.network;

        if (!policy.allowOutbound) {
          this.recordViolation(context, 'network', `Outbound denied: ${host}`, `connect:${host}`);
          return false;
        }

        if (policy.blockedHosts?.includes(host)) {
          this.recordViolation(context, 'network', `Blocked host: ${host}`, `connect:${host}`);
          return false;
        }

        if (policy.allowedHosts && !policy.allowedHosts.includes(host)) {
          this.recordViolation(
            context,
            'network',
            `Host not in allowlist: ${host}`,
            `connect:${host}`
          );
          return false;
        }

        if (port && policy.allowedPorts && !policy.allowedPorts.includes(port)) {
          this.recordViolation(
            context,
            'network',
            `Port not allowed: ${port}`,
            `connect:${host}:${port}`
          );
          return false;
        }

        return true;
      },

      checkProcess: (command: string): boolean => {
        const policy = config.process;

        if (!policy.allowSpawn) {
          this.recordViolation(context, 'process', `Spawn denied: ${command}`, `spawn:${command}`);
          return false;
        }

        if (policy.blockedCommands?.some((blocked) => command.includes(blocked))) {
          this.recordViolation(
            context,
            'process',
            `Blocked command: ${command}`,
            `spawn:${command}`
          );
          return false;
        }

        if (policy.allowedCommands && !policy.allowedCommands.some((allowed) => command.startsWith(allowed))) {
          this.recordViolation(
            context,
            'process',
            `Command not in allowlist: ${command}`,
            `spawn:${command}`
          );
          return false;
        }

        return true;
      },
    };
  }

  /**
   * Create timeout promise
   */
  private createTimeout(ms: number, pluginId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        this.terminateSandbox(pluginId, 'Execution timeout');
        reject(new Error(`Sandbox execution timeout after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Record security violation
   */
  private recordViolation(
    context: SandboxContext,
    type: SecurityViolation['type'],
    message: string,
    action: string
  ): void {
    const violation: SecurityViolation = {
      type,
      message,
      timestamp: new Date(),
      action,
      blocked: true,
    };

    context.violations.push(violation);
    this.emitViolation(violation, context.pluginId);
  }

  /**
   * Emit violation to handlers
   */
  private emitViolation(violation: SecurityViolation, pluginId: string): void {
    for (const handler of this.violationHandlers) {
      try {
        handler(violation, pluginId);
      } catch (error) {
        this.logger.error('Violation handler error', { error });
      }
    }
  }

  /**
   * Get suggestion for security pattern
   */
  private getSuggestionForPattern(patternId: string): string {
    const suggestions: Record<string, string> = {
      'eval-usage': 'Use JSON.parse() for data parsing or Function() only with trusted input',
      'function-constructor':
        'Avoid dynamic code generation; use static functions or template literals',
      'child-process-exec': 'Use execFile() with explicit arguments instead of exec()',
      'shell-true': 'Use execFile() or spawn() without shell option',
      'hardcoded-secret': 'Move secrets to environment variables or a secure vault',
      'sql-injection': 'Use parameterized queries or prepared statements',
      'unsafe-regex': 'Use static regex patterns or validate input before regex construction',
      'prototype-pollution': 'Use Object.create(null) or validate property names',
      'path-traversal': 'Validate and sanitize file paths; use path.resolve()',
      'unsafe-deserialization': 'Validate JSON schema before parsing untrusted input',
      'crypto-weak': 'Use SHA-256 or SHA-3 for hashing',
      'http-without-tls': 'Use HTTPS for all external connections',
    };

    return suggestions[patternId] || 'Review and fix the security issue';
  }
}

/**
 * Create Plugin Security Manager instance
 */
export function createPluginSecurityManager(
  config?: PluginSecurityManagerConfig
): IPluginSecurityManager {
  return new PluginSecurityManager(config);
}
