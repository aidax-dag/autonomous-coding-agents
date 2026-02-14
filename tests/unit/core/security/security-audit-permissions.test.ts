/**
 * Security Audit: Permission Manager
 *
 * Validates security properties of the permission system.
 * Tests focus on default deny for sensitive files, rule priority
 * enforcement, and attack vector coverage for permission bypass.
 *
 * @module tests/unit/core/security/security-audit-permissions
 */

import {
  PermissionManager,
  createPermissionManager,
} from '../../../../src/core/permission/permission-manager';
import type {
  PermissionRule,
  PermissionRequest,
} from '../../../../src/core/permission/interfaces/permission.interface';

describe('Security Audit: Permission Manager', () => {
  // ==========================================================================
  // Default Deny Rules for Sensitive Files
  // ==========================================================================

  describe('default deny rules protect sensitive files', () => {
    let manager: PermissionManager;

    beforeEach(() => {
      manager = createPermissionManager();
    });

    it('should deny access to .env files by default', () => {
      const result = manager.check({ path: '.env', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('should deny access to files ending with .env extension (e.g. config.env)', () => {
      const result = manager.check({ path: 'config.env', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('SECURITY FINDING: default *.env pattern does not match .env.local or .env.production', () => {
      // The default rule pattern is *.env which matches files ENDING in .env
      // Files like .env.local and .env.production do NOT match *.env
      // This is a potential gap: sandbox-escalation uses **/.env* (catches both)
      // but permission-manager uses *.env (only catches files ending in .env)
      const localResult = manager.check({ path: '.env.local', scope: 'read' });
      expect(localResult.action).toBe('allow'); // Gap: not covered by *.env
      const prodResult = manager.check({ path: '.env.production', scope: 'read' });
      expect(prodResult.action).toBe('allow'); // Gap: not covered by *.env
    });

    it('should deny access to .key files by default', () => {
      const result = manager.check({ path: 'server.key', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('should deny access to .pem files by default', () => {
      const result = manager.check({ path: 'cert.pem', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('should deny .env files for write scope as well', () => {
      const result = manager.check({ path: '.env', scope: 'write' });
      expect(result.action).toBe('deny');
    });

    it('should deny .env files for execute scope', () => {
      const result = manager.check({ path: '.env', scope: 'execute' });
      expect(result.action).toBe('deny');
    });

    it('should deny sensitive files regardless of scope (rule scope is all)', () => {
      const scopes: Array<'read' | 'write' | 'execute'> = ['read', 'write', 'execute'];
      const sensitivePatterns = ['.env', 'private.key', 'cert.pem'];

      for (const scope of scopes) {
        for (const path of sensitivePatterns) {
          const result = manager.check({ path, scope });
          expect(result.action).toBe('deny');
        }
      }
    });
  });

  // ==========================================================================
  // Default Ask Rules for Dangerous Commands
  // ==========================================================================

  describe('default ask rules for dangerous commands', () => {
    let manager: PermissionManager;

    beforeEach(() => {
      manager = createPermissionManager();
    });

    it('should require confirmation for rm commands', () => {
      const result = manager.check({ command: 'rm -rf /tmp/data', scope: 'execute' });
      expect(result.action).toBe('ask');
    });

    it('should require confirmation for git push commands', () => {
      const result = manager.check({ command: 'git push origin main', scope: 'execute' });
      expect(result.action).toBe('ask');
    });

    it('should require confirmation for rm with various arguments', () => {
      const rmCommands = ['rm file.txt', 'rm -f important.db', 'rm -rf /'];
      for (const cmd of rmCommands) {
        const result = manager.check({ command: cmd, scope: 'execute' });
        expect(result.action).toBe('ask');
      }
    });

    it('should require confirmation for git push with various remotes', () => {
      const pushCommands = [
        'git push origin feature',
        'git push --force origin main',
        'git push upstream develop',
      ];
      for (const cmd of pushCommands) {
        const result = manager.check({ command: cmd, scope: 'execute' });
        expect(result.action).toBe('ask');
      }
    });
  });

  // ==========================================================================
  // Default Deny Principle (No Explicit Permission = Allowed by Default)
  // ==========================================================================

  describe('default allow when no rules match', () => {
    it('should allow access when no rules match the request', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      const result = manager.check({ path: 'src/index.ts', scope: 'read' });
      expect(result.action).toBe('allow');
      expect(result.reason).toContain('default');
    });

    it('should allow non-sensitive file access with default rules', () => {
      const manager = createPermissionManager();
      const result = manager.check({ path: 'src/main.ts', scope: 'read' });
      expect(result.action).toBe('allow');
    });

    it('should allow non-dangerous commands with default rules', () => {
      const manager = createPermissionManager();
      const result = manager.check({ command: 'ls -la', scope: 'execute' });
      expect(result.action).toBe('allow');
    });
  });

  // ==========================================================================
  // Rule Priority Enforcement
  // ==========================================================================

  describe('rule priority enforcement', () => {
    it('should enforce higher priority rules over lower priority', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      manager.addRule({
        pattern: '*.config',
        action: 'allow',
        scope: 'all',
        priority: 10,
        description: 'Allow config files',
      });
      manager.addRule({
        pattern: '*.config',
        action: 'deny',
        scope: 'all',
        priority: 100,
        description: 'Deny config files (higher priority)',
      });

      const result = manager.check({ path: 'app.config', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('should prefer deny over allow at same priority', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      manager.addRule({
        pattern: '*.secret',
        action: 'allow',
        scope: 'all',
        priority: 50,
      });
      manager.addRule({
        pattern: '*.secret',
        action: 'deny',
        scope: 'all',
        priority: 50,
      });

      const result = manager.check({ path: 'data.secret', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('should not allow lower priority allow to override higher priority deny', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      manager.addRule({
        pattern: '*.env',
        action: 'deny',
        scope: 'all',
        priority: 100,
      });
      manager.addRule({
        pattern: '*.env',
        action: 'allow',
        scope: 'all',
        priority: 1,
      });

      const result = manager.check({ path: '.env', scope: 'read' });
      expect(result.action).toBe('deny');
    });
  });

  // ==========================================================================
  // Scope Matching Security
  // ==========================================================================

  describe('scope matching prevents cross-scope bypass', () => {
    it('should match rules with scope all to any request scope', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      manager.addRule({
        pattern: '*.sensitive',
        action: 'deny',
        scope: 'all',
      });

      expect(manager.check({ path: 'data.sensitive', scope: 'read' }).action).toBe('deny');
      expect(manager.check({ path: 'data.sensitive', scope: 'write' }).action).toBe('deny');
      expect(manager.check({ path: 'data.sensitive', scope: 'execute' }).action).toBe('deny');
    });

    it('should not apply read-scoped rules to write requests', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      manager.addRule({
        pattern: '*.log',
        action: 'deny',
        scope: 'read',
      });

      // Should deny read
      expect(manager.check({ path: 'app.log', scope: 'read' }).action).toBe('deny');
      // Should not deny write (different scope, no matching rule)
      expect(manager.check({ path: 'app.log', scope: 'write' }).action).toBe('allow');
    });

    it('should not apply execute-scoped rules to read requests', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      manager.addRule({
        pattern: 'rm ',
        action: 'ask',
        scope: 'execute',
      });

      // Command-based rule should not apply to path-based read
      const result = manager.check({ path: 'rm-docs.txt', scope: 'read' });
      // May or may not match depending on pattern matching, but scope should be enforced
      expect(result.action).not.toBe('ask');
    });
  });

  // ==========================================================================
  // Rule Management Security
  // ==========================================================================

  describe('rule management integrity', () => {
    it('should return a copy of rules that cannot modify internal state', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      manager.addRule({ pattern: '*.ts', action: 'allow', scope: 'read' });

      const rules = manager.getRules();
      rules.push({ pattern: '*.secret', action: 'allow', scope: 'all' });

      // Internal rules should not be modified
      expect(manager.getRules()).toHaveLength(1);
    });

    it('should clear all rules including defaults when clearRules is called', () => {
      const manager = createPermissionManager();
      const defaultRuleCount = manager.getRules().length;
      expect(defaultRuleCount).toBeGreaterThan(0);

      manager.clearRules();
      expect(manager.getRules()).toHaveLength(0);

      // After clearing, sensitive files should be allowed (no rules)
      const result = manager.check({ path: '.env', scope: 'read' });
      expect(result.action).toBe('allow');
    });

    it('should remove only the first matching rule by pattern', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      manager.addRule({ pattern: '*.log', action: 'deny', scope: 'read' });
      manager.addRule({ pattern: '*.log', action: 'allow', scope: 'write' });

      manager.removeRule('*.log');
      // Should still have one rule
      expect(manager.getRules()).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Pattern Matching Security
  // ==========================================================================

  describe('pattern matching cannot be bypassed', () => {
    it('should match .env with *.env pattern', () => {
      const manager = createPermissionManager();
      const result = manager.check({ path: '.env', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('should match nested .env files', () => {
      const manager = createPermissionManager();
      // The pattern is '*.env', which should match anything ending in .env
      const result = manager.check({ path: 'config.env', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('should match .key files with various prefixes', () => {
      const manager = createPermissionManager();
      const keyFiles = ['server.key', 'private.key', 'tls.key'];
      for (const path of keyFiles) {
        const result = manager.check({ path, scope: 'read' });
        expect(result.action).toBe('deny');
      }
    });
  });

  // ==========================================================================
  // Missing Path/Command Handling
  // ==========================================================================

  describe('missing path or command handling', () => {
    it('should handle request with only scope (no path or command)', () => {
      const manager = createPermissionManager();
      const result = manager.check({ scope: 'read' });
      // No path or command means no pattern can match -> default allow
      expect(result.action).toBe('allow');
    });

    it('should handle request with empty path', () => {
      const manager = createPermissionManager();
      const result = manager.check({ path: '', scope: 'read' });
      // Empty path should not match patterns -> default allow
      expect(result.action).toBe('allow');
    });
  });

  // ==========================================================================
  // Custom Rule Addition Security
  // ==========================================================================

  describe('custom rules integrate with defaults correctly', () => {
    it('should allow custom deny rules alongside defaults', () => {
      const manager = createPermissionManager();
      manager.addRule({
        pattern: '*.sql',
        action: 'deny',
        scope: 'all',
        priority: 100,
        description: 'Block SQL files',
      });

      // Custom rule should work
      expect(manager.check({ path: 'dump.sql', scope: 'read' }).action).toBe('deny');
      // Default rules should still work
      expect(manager.check({ path: '.env', scope: 'read' }).action).toBe('deny');
    });

    it('should not allow custom allow rules to override default deny when deny has higher priority', () => {
      const manager = createPermissionManager();
      // Default deny for *.env has priority 100
      manager.addRule({
        pattern: '*.env',
        action: 'allow',
        scope: 'all',
        priority: 1, // lower priority than default deny
        description: 'Attempt to allow env files',
      });

      const result = manager.check({ path: '.env', scope: 'read' });
      expect(result.action).toBe('deny');
    });
  });

  // ==========================================================================
  // Agent Field Handling
  // ==========================================================================

  describe('permission requests with agent field', () => {
    it('should process requests with agent field without error', () => {
      const manager = createPermissionManager();
      const result = manager.check({
        path: '.env',
        scope: 'read',
        agent: 'untrusted-agent',
      });
      expect(result.action).toBe('deny');
    });

    it('should enforce rules regardless of agent identity', () => {
      const manager = createPermissionManager();
      const agents = ['admin', 'root', 'system', 'unknown'];
      for (const agent of agents) {
        const result = manager.check({
          path: 'private.key',
          scope: 'read',
          agent,
        });
        expect(result.action).toBe('deny');
      }
    });
  });
});
