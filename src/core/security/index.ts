/**
 * Security Module
 *
 * Phase 5 - Security & Hardening
 * Provides comprehensive security features including:
 * - F5.1 Plugin Security - Plugin verification, sandboxing, code scanning
 * - F5.2 Trust System - Trust level management, whitelisting/blacklisting
 * - F5.3 Permission System - RBAC-based permission management
 * - F5.4 Audit Logging - Comprehensive audit trail and alerting
 * - F5.5 Secret Management - Secure secret storage with encryption
 * - F5.6 Code Scanning - Static analysis, dependency vulnerabilities, secret detection
 *
 * @module core/security
 */

// F5.1 Plugin Security
export * from './plugin/index.js';

// F5.2 Trust System
export * from './trust/index.js';

// F5.3 Permission System
export * from './permission/index.js';

// F5.4 Audit Logging
export * from './audit/index.js';

// F5.5 Secret Management
export * from './secret/index.js';

// F5.6 Code Scanning
export * from './scanning/index.js';

// F5.7 Progressive Sandbox Escalation
export * from './escalation/index.js';
