/**
 * Approval Workflow Tests
 *
 * Tests for the three approval modes: suggest, auto-edit, full-auto.
 */

import { createApprovalWorkflow } from '@/core/permission/approval-workflow';
import { createPermissionManager } from '@/core/permission/permission-manager';
import type { PermissionRequest } from '@/core/permission/interfaces/permission.interface';

describe('ApprovalWorkflow', () => {
  describe('suggest mode', () => {
    it('should always return ask for any operation', () => {
      const workflow = createApprovalWorkflow({ mode: 'suggest' });

      const readResult = workflow.shouldApprove({ path: 'src/app.ts', scope: 'read' });
      expect(readResult.action).toBe('ask');

      const writeResult = workflow.shouldApprove({ path: 'src/app.ts', scope: 'write' });
      expect(writeResult.action).toBe('ask');

      const execResult = workflow.shouldApprove({ command: 'npm test', scope: 'execute' });
      expect(execResult.action).toBe('ask');
    });

    it('should still deny blocked patterns even in suggest mode', () => {
      const workflow = createApprovalWorkflow({ mode: 'suggest' });
      const result = workflow.shouldApprove({ path: '.env', scope: 'read' });
      expect(result.action).toBe('deny');
    });
  });

  describe('auto-edit mode', () => {
    it('should allow file read and write operations', () => {
      const workflow = createApprovalWorkflow({ mode: 'auto-edit' });

      const readResult = workflow.shouldApprove({ path: 'src/app.ts', scope: 'read' });
      expect(readResult.action).toBe('allow');

      const writeResult = workflow.shouldApprove({ path: 'src/app.ts', scope: 'write' });
      expect(writeResult.action).toBe('allow');
    });

    it('should ask for shell execute operations', () => {
      const workflow = createApprovalWorkflow({ mode: 'auto-edit' });
      const result = workflow.shouldApprove({ command: 'npm test', scope: 'execute' });
      expect(result.action).toBe('ask');
    });

    it('should deny blocked files even in auto-edit mode', () => {
      const workflow = createApprovalWorkflow({ mode: 'auto-edit' });
      const result = workflow.shouldApprove({ path: 'server.key', scope: 'read' });
      expect(result.action).toBe('deny');
    });
  });

  describe('full-auto mode', () => {
    it('should allow everything except deny-listed patterns', () => {
      const workflow = createApprovalWorkflow({ mode: 'full-auto' });

      const readResult = workflow.shouldApprove({ path: 'src/app.ts', scope: 'read' });
      expect(readResult.action).toBe('allow');

      const writeResult = workflow.shouldApprove({ path: 'src/app.ts', scope: 'write' });
      expect(writeResult.action).toBe('allow');

      const execResult = workflow.shouldApprove({ command: 'npm test', scope: 'execute' });
      expect(execResult.action).toBe('allow');
    });

    it('should deny blocked files in full-auto mode', () => {
      const workflow = createApprovalWorkflow({ mode: 'full-auto' });
      const result = workflow.shouldApprove({ path: 'cert.pem', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('should respect ask rules from permission manager in full-auto', () => {
      const workflow = createApprovalWorkflow({ mode: 'full-auto' });
      // Default rules include ask for 'rm ' commands
      const result = workflow.shouldApprove({ command: 'rm -rf /tmp', scope: 'execute' });
      expect(result.action).toBe('ask');
    });
  });

  describe('mode switching', () => {
    it('should allow switching between modes', () => {
      const workflow = createApprovalWorkflow({ mode: 'suggest' });
      expect(workflow.getMode()).toBe('suggest');

      workflow.setMode('auto-edit');
      expect(workflow.getMode()).toBe('auto-edit');

      workflow.setMode('full-auto');
      expect(workflow.getMode()).toBe('full-auto');
    });

    it('should change behavior after mode switch', () => {
      const workflow = createApprovalWorkflow({ mode: 'suggest' });
      const request: PermissionRequest = { path: 'src/app.ts', scope: 'write' };

      // Suggest mode: ask
      expect(workflow.shouldApprove(request).action).toBe('ask');

      // Switch to auto-edit: allow writes
      workflow.setMode('auto-edit');
      expect(workflow.shouldApprove(request).action).toBe('allow');

      // Switch to full-auto: allow
      workflow.setMode('full-auto');
      expect(workflow.shouldApprove(request).action).toBe('allow');
    });
  });

  describe('integration with permission manager', () => {
    it('should use custom permission manager', () => {
      const manager = createPermissionManager({ includeDefaults: false });
      manager.addRule({
        pattern: '*.secret',
        action: 'deny',
        scope: 'all',
        priority: 100,
      });

      const workflow = createApprovalWorkflow({
        mode: 'full-auto',
        permissionManager: manager,
      });

      const result = workflow.shouldApprove({ path: 'db.secret', scope: 'read' });
      expect(result.action).toBe('deny');
    });

    it('should expose permission manager for rule additions', () => {
      const workflow = createApprovalWorkflow({ mode: 'full-auto' });
      workflow.getPermissionManager().addRule({
        pattern: '*.sql',
        action: 'deny',
        scope: 'execute',
        priority: 100,
      });

      const result = workflow.shouldApprove({ command: 'drop.sql', scope: 'execute' });
      expect(result.action).toBe('deny');
    });
  });

  it('should default to suggest mode', () => {
    const workflow = createApprovalWorkflow();
    expect(workflow.getMode()).toBe('suggest');
  });
});
