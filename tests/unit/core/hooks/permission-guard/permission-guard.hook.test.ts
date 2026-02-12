/**
 * PermissionGuardHook Unit Tests
 */

import { PermissionGuardHook } from '../../../../../src/core/hooks/permission-guard/permission-guard.hook';
import { HookEvent, HookAction } from '../../../../../src/core/interfaces/hook.interface';
import type { PermissionManager } from '../../../../../src/core/permission/permission-manager';
import type { PermissionCheckResult } from '../../../../../src/core/permission/interfaces/permission.interface';

function createMockPermissionManager(result: PermissionCheckResult): PermissionManager {
  return {
    check: jest.fn().mockReturnValue(result),
    addRule: jest.fn(),
    removeRule: jest.fn(),
    getRules: jest.fn().mockReturnValue([]),
    clearRules: jest.fn(),
  } as unknown as PermissionManager;
}

function makeContext(path?: string, command?: string) {
  return {
    event: HookEvent.TASK_BEFORE,
    timestamp: new Date(),
    source: 'test',
    data: {
      path,
      command,
      scope: 'write' as const,
      agent: 'test-agent',
    },
  };
}

describe('PermissionGuardHook', () => {
  it('should have correct name and event', () => {
    const pm = createMockPermissionManager({ action: 'allow', reason: 'ok' });
    const hook = new PermissionGuardHook(pm);
    expect(hook.name).toBe('permission-guard');
    expect(hook.event).toBe(HookEvent.TASK_BEFORE);
  });

  it('should continue when no path or command to check', async () => {
    const pm = createMockPermissionManager({ action: 'allow', reason: 'ok' });
    const hook = new PermissionGuardHook(pm);
    const result = await hook.execute(makeContext(undefined, undefined));

    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('No path or command');
    expect(pm.check).not.toHaveBeenCalled();
  });

  it('should continue on allow', async () => {
    const pm = createMockPermissionManager({ action: 'allow', reason: 'Allowed by default' });
    const hook = new PermissionGuardHook(pm);
    const result = await hook.execute(makeContext('src/index.ts'));

    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.data?.action).toBe('allow');
  });

  it('should abort on deny', async () => {
    const pm = createMockPermissionManager({
      action: 'deny',
      reason: 'Block access to environment files',
      rule: { pattern: '*.env', action: 'deny', scope: 'all', priority: 100 },
    });
    const hook = new PermissionGuardHook(pm);
    const result = await hook.execute(makeContext('config.env'));

    expect(result.action).toBe(HookAction.ABORT);
    expect(result.message).toContain('Permission denied');
    expect(result.data?.action).toBe('deny');
  });

  it('should continue with message on ask', async () => {
    const pm = createMockPermissionManager({
      action: 'ask',
      reason: 'Confirm before removing files',
    });
    const hook = new PermissionGuardHook(pm);
    const result = await hook.execute(makeContext(undefined, 'rm -rf /tmp/test'));

    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('Requires approval');
    expect(result.data?.action).toBe('ask');
  });

  it('should continue gracefully on error', async () => {
    const pm = {
      check: jest.fn().mockImplementation(() => { throw new Error('check error'); }),
    } as unknown as PermissionManager;
    const hook = new PermissionGuardHook(pm);
    const result = await hook.execute(makeContext('some/file.ts'));

    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('skipped due to error');
  });

  it('should use priority 250 by default', () => {
    const pm = createMockPermissionManager({ action: 'allow', reason: 'ok' });
    const hook = new PermissionGuardHook(pm);
    expect(hook.getConfig().priority).toBe(250);
  });

  it('should check with agent field', async () => {
    const pm = createMockPermissionManager({ action: 'allow', reason: 'ok' });
    const hook = new PermissionGuardHook(pm);
    await hook.execute(makeContext('src/auth.ts'));

    expect(pm.check).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'src/auth.ts',
        scope: 'write',
        agent: 'test-agent',
      }),
    );
  });
});
