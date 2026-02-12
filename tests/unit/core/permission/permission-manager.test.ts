/**
 * Permission Manager Tests
 *
 * Tests for the central permission engine with default rules.
 */

import {
  PermissionManager,
  createPermissionManager,
} from '@/core/permission/permission-manager';
import type { PermissionRule } from '@/core/permission/interfaces/permission.interface';

describe('PermissionManager', () => {
  it('should add and retrieve rules', () => {
    const manager = createPermissionManager({ includeDefaults: false });
    const rule: PermissionRule = {
      pattern: '*.log',
      action: 'deny',
      scope: 'all',
      description: 'Block log files',
    };
    manager.addRule(rule);
    const rules = manager.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe('*.log');
  });

  it('should remove a rule by pattern', () => {
    const manager = createPermissionManager({ includeDefaults: false });
    manager.addRule({ pattern: '*.log', action: 'deny', scope: 'all' });
    manager.addRule({ pattern: '*.tmp', action: 'deny', scope: 'all' });
    const removed = manager.removeRule('*.log');
    expect(removed).toBe(true);
    expect(manager.getRules()).toHaveLength(1);
    expect(manager.getRules()[0].pattern).toBe('*.tmp');
  });

  it('should return false when removing non-existent rule', () => {
    const manager = createPermissionManager({ includeDefaults: false });
    expect(manager.removeRule('nonexistent')).toBe(false);
  });

  it('should check request against rules', () => {
    const manager = createPermissionManager({ includeDefaults: false });
    manager.addRule({ pattern: '*.secret', action: 'deny', scope: 'all' });
    const result = manager.check({ path: 'db.secret', scope: 'read' });
    expect(result.action).toBe('deny');
  });

  it('should include default deny rules for sensitive files', () => {
    const manager = createPermissionManager();
    // Default rules: deny *.env, *.key, *.pem
    const envResult = manager.check({ path: '.env', scope: 'read' });
    expect(envResult.action).toBe('deny');

    const keyResult = manager.check({ path: 'server.key', scope: 'read' });
    expect(keyResult.action).toBe('deny');

    const pemResult = manager.check({ path: 'cert.pem', scope: 'write' });
    expect(pemResult.action).toBe('deny');
  });

  it('should include default ask rules for dangerous commands', () => {
    const manager = createPermissionManager();
    const rmResult = manager.check({ command: 'rm -rf /tmp', scope: 'execute' });
    expect(rmResult.action).toBe('ask');

    const pushResult = manager.check({ command: 'git push origin main', scope: 'execute' });
    expect(pushResult.action).toBe('ask');
  });

  it('should clear all rules including defaults', () => {
    const manager = createPermissionManager();
    expect(manager.getRules().length).toBeGreaterThan(0);
    manager.clearRules();
    expect(manager.getRules()).toHaveLength(0);

    // After clearing, everything should default to allow
    const result = manager.check({ path: '.env', scope: 'read' });
    expect(result.action).toBe('allow');
  });

  it('should be created via factory function', () => {
    const manager = createPermissionManager();
    expect(manager).toBeInstanceOf(PermissionManager);
    expect(manager.getRules().length).toBeGreaterThan(0);
  });

  it('should return a copy of rules (not reference)', () => {
    const manager = createPermissionManager({ includeDefaults: false });
    manager.addRule({ pattern: '*.ts', action: 'allow', scope: 'read' });
    const rules = manager.getRules();
    rules.push({ pattern: '*.js', action: 'allow', scope: 'read' });
    // Original should not be modified
    expect(manager.getRules()).toHaveLength(1);
  });
});
