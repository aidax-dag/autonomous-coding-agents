/**
 * MCP Health Monitor Module
 *
 * Provides MCP server health monitoring, status tracking, and auto-recovery.
 *
 * @module core/hooks/mcp-health-monitor
 */

// Interfaces
export * from './mcp-health-monitor.interface.js';

// Hook
export { MCPHealthMonitorHook } from './mcp-health-monitor.hook.js';
