/**
 * Permission Resolver Tests
 *
 * Tests for the rule resolution engine.
 */

import {
  PermissionResolver,
  createPermissionResolver,
} from '@/core/permission/permission-resolver';
import type {
  PermissionRule,
  PermissionRequest,
} from '@/core/permission/interfaces/permission.interface';

describe('PermissionResolver', () => {
  let resolver: PermissionResolver;

  beforeEach(() => {
    resolver = createPermissionResolver();
  });

  it('should resolve an allow rule', () => {
    const rules: PermissionRule[] = [
      { pattern: 'src/**/*.ts', action: 'allow', scope: 'read' },
    ];
    const request: PermissionRequest = { path: 'src/core/app.ts', scope: 'read' };
    const result = resolver.resolve(request, rules);
    expect(result.action).toBe('allow');
    expect(result.rule).toBeDefined();
    expect(result.rule?.pattern).toBe('src/**/*.ts');
  });

  it('should resolve a deny rule', () => {
    const rules: PermissionRule[] = [
      { pattern: '*.env', action: 'deny', scope: 'all' },
    ];
    const request: PermissionRequest = { path: 'production.env', scope: 'read' };
    const result = resolver.resolve(request, rules);
    expect(result.action).toBe('deny');
  });

  it('should prefer deny over allow at same priority', () => {
    const rules: PermissionRule[] = [
      { pattern: '*.env', action: 'allow', scope: 'all' },
      { pattern: '*.env', action: 'deny', scope: 'all' },
    ];
    const request: PermissionRequest = { path: 'config.env', scope: 'read' };
    const result = resolver.resolve(request, rules);
    expect(result.action).toBe('deny');
  });

  it('should prefer more specific pattern when priorities and actions match', () => {
    const rules: PermissionRule[] = [
      { pattern: '**/*.ts', action: 'deny', scope: 'write' },
      { pattern: 'src/core/app.ts', action: 'deny', scope: 'write' },
    ];
    const request: PermissionRequest = { path: 'src/core/app.ts', scope: 'write' };
    const result = resolver.resolve(request, rules);
    expect(result.action).toBe('deny');
    expect(result.rule?.pattern).toBe('src/core/app.ts');
  });

  it('should default to allow when no rules match', () => {
    const rules: PermissionRule[] = [
      { pattern: '*.env', action: 'deny', scope: 'all' },
    ];
    const request: PermissionRequest = { path: 'src/app.ts', scope: 'read' };
    const result = resolver.resolve(request, rules);
    expect(result.action).toBe('allow');
    expect(result.rule).toBeUndefined();
    expect(result.reason).toContain('default');
  });

  it('should resolve multiple rules with correct priority ordering', () => {
    const rules: PermissionRule[] = [
      { pattern: '*.ts', action: 'allow', scope: 'read', priority: 1 },
      { pattern: '*.ts', action: 'deny', scope: 'read', priority: 10 },
      { pattern: '*.ts', action: 'ask', scope: 'read', priority: 5 },
    ];
    const request: PermissionRequest = { path: 'app.ts', scope: 'read' };
    const result = resolver.resolve(request, rules);
    expect(result.action).toBe('deny');
    expect(result.rule?.priority).toBe(10);
  });

  it('should match command-based requests', () => {
    const rules: PermissionRule[] = [
      { pattern: 'rm ', action: 'ask', scope: 'execute' },
    ];
    const request: PermissionRequest = { command: 'rm -rf /tmp', scope: 'execute' };
    const result = resolver.resolve(request, rules);
    expect(result.action).toBe('ask');
  });

  it('should respect scope filtering', () => {
    const rules: PermissionRule[] = [
      { pattern: '*.ts', action: 'deny', scope: 'write' },
    ];
    // Request scope is 'read', rule scope is 'write' - should not match
    const request: PermissionRequest = { path: 'app.ts', scope: 'read' };
    const result = resolver.resolve(request, rules);
    expect(result.action).toBe('allow'); // default, because scope doesn't match
  });
});
