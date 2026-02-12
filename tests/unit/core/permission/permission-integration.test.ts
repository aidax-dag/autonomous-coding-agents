/**
 * Permission Integration Tests
 *
 * End-to-end tests combining PermissionManager, ApprovalWorkflow, and PermissionResolver.
 */

import { createPermissionManager } from '@/core/permission/permission-manager';
import { createApprovalWorkflow } from '@/core/permission/approval-workflow';
import { createPermissionResolver } from '@/core/permission/permission-resolver';
import type { PermissionRequest } from '@/core/permission/interfaces/permission.interface';

describe('Permission Integration', () => {
  it('should flow through manager + workflow + resolver end-to-end', () => {
    const manager = createPermissionManager();
    const workflow = createApprovalWorkflow({
      mode: 'full-auto',
      permissionManager: manager,
    });

    // Normal file: allowed in full-auto
    const normalResult = workflow.shouldApprove({
      path: 'src/app.ts',
      scope: 'write',
    });
    expect(normalResult.action).toBe('allow');

    // Sensitive file: denied by default rules
    const sensitiveResult = workflow.shouldApprove({
      path: 'config.env',
      scope: 'read',
    });
    expect(sensitiveResult.action).toBe('deny');

    // Dangerous command: ask by default rules
    const dangerousResult = workflow.shouldApprove({
      command: 'rm -rf node_modules',
      scope: 'execute',
    });
    expect(dangerousResult.action).toBe('ask');
  });

  it('should change behavior when mode changes', () => {
    const manager = createPermissionManager();
    const workflow = createApprovalWorkflow({
      mode: 'suggest',
      permissionManager: manager,
    });

    const request: PermissionRequest = { path: 'src/app.ts', scope: 'write' };

    // Suggest mode: always ask
    expect(workflow.shouldApprove(request).action).toBe('ask');

    // Auto-edit mode: allow writes
    workflow.setMode('auto-edit');
    expect(workflow.shouldApprove(request).action).toBe('allow');

    // Full-auto mode: allow everything non-denied
    workflow.setMode('full-auto');
    expect(workflow.shouldApprove(request).action).toBe('allow');

    // But deny-listed files stay denied across all modes
    const envRequest: PermissionRequest = { path: 'prod.env', scope: 'read' };
    workflow.setMode('suggest');
    expect(workflow.shouldApprove(envRequest).action).toBe('deny');
    workflow.setMode('auto-edit');
    expect(workflow.shouldApprove(envRequest).action).toBe('deny');
    workflow.setMode('full-auto');
    expect(workflow.shouldApprove(envRequest).action).toBe('deny');
  });

  it('should allow custom rules to override defaults', () => {
    const manager = createPermissionManager();

    // Add a high-priority allow rule for a specific .env file
    manager.addRule({
      pattern: 'example.env',
      action: 'allow',
      scope: 'read',
      priority: 200, // Higher than default deny priority (100)
      description: 'Allow reading example env file',
    });

    const workflow = createApprovalWorkflow({
      mode: 'full-auto',
      permissionManager: manager,
    });

    // Regular .env file still denied
    const regularEnv = workflow.shouldApprove({ path: 'production.env', scope: 'read' });
    expect(regularEnv.action).toBe('deny');

    // example.env allowed by custom rule
    const exampleEnv = workflow.shouldApprove({ path: 'example.env', scope: 'read' });
    expect(exampleEnv.action).toBe('allow');
  });

  it('should work with resolver directly for custom rule sets', () => {
    const resolver = createPermissionResolver();

    const rules = [
      { pattern: '*.ts', action: 'allow' as const, scope: 'read' as const, priority: 1 },
      { pattern: 'src/secret/**/*.ts', action: 'deny' as const, scope: 'all' as const, priority: 10 },
    ];

    // Normal TS file: allowed
    const normalResult = resolver.resolve(
      { path: 'src/app.ts', scope: 'read' },
      rules,
    );
    expect(normalResult.action).toBe('allow');

    // Secret directory: denied by higher-priority rule
    const secretResult = resolver.resolve(
      { path: 'src/secret/keys.ts', scope: 'read' },
      rules,
    );
    expect(secretResult.action).toBe('deny');
  });

  it('should handle combined path and command scenarios', () => {
    const manager = createPermissionManager();
    const workflow = createApprovalWorkflow({
      mode: 'auto-edit',
      permissionManager: manager,
    });

    // File write in auto-edit: allowed
    expect(
      workflow.shouldApprove({ path: 'src/app.ts', scope: 'write' }).action,
    ).toBe('allow');

    // Command execution in auto-edit: ask
    expect(
      workflow.shouldApprove({ command: 'npm test', scope: 'execute' }).action,
    ).toBe('ask');

    // Dangerous command: ask (from default rules, takes precedence)
    expect(
      workflow.shouldApprove({ command: 'git push origin main', scope: 'execute' }).action,
    ).toBe('ask');

    // Denied file: always denied
    expect(
      workflow.shouldApprove({ path: 'credentials.key', scope: 'write' }).action,
    ).toBe('deny');
  });
});
