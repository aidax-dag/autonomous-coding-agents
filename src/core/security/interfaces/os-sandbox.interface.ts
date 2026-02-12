/**
 * OS-Native Sandbox Interfaces
 *
 * Defines contracts for platform-specific sandbox execution,
 * network isolation, and resource limiting.
 *
 * @module core/security/interfaces
 */

// ============================================================================
// Platform Types
// ============================================================================

/**
 * Supported sandbox platforms
 */
export type SandboxPlatform = 'macos' | 'linux' | 'windows' | 'unsupported';

// ============================================================================
// Sandbox Policy
// ============================================================================

/**
 * Policy governing what a sandboxed process is allowed to do
 */
export interface SandboxPolicy {
  allowedReadPaths: string[];
  allowedWritePaths: string[];
  allowNetwork: boolean;
  allowedNetworkHosts?: string[];
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  timeoutMs?: number;
}

// ============================================================================
// Sandbox Result
// ============================================================================

/**
 * Result of a sandboxed command execution
 */
export interface SandboxResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  resourceUsage?: { memoryMB: number; cpuMs: number };
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * OS-native sandbox for executing commands with restricted permissions
 */
export interface IOSSandbox {
  getPlatform(): SandboxPlatform;
  isAvailable(): boolean;
  execute(command: string, args: string[], policy: SandboxPolicy): Promise<SandboxResult>;
}

/**
 * Network access control for sandboxed environments
 */
export interface INetworkIsolation {
  isIsolated(): boolean;
  setIsolated(isolated: boolean): void;
  addAllowedHost(host: string): void;
  removeAllowedHost(host: string): boolean;
  getAllowedHosts(): string[];
  checkAccess(host: string): boolean;
}

/**
 * Resource limits for sandboxed process execution
 */
export interface IResourceLimiter {
  setMemoryLimit(mb: number): void;
  setCpuLimit(percent: number): void;
  setTimeout(ms: number): void;
  getLimits(): { memoryMB: number | null; cpuPercent: number | null; timeoutMs: number | null };
  checkMemory(currentMB: number): boolean;
  checkCpu(currentPercent: number): boolean;
}
