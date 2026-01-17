/**
 * Security Module Tests
 *
 * Tests for the Agent OS kernel security module.
 */

import {
  SecurityModule,
  createSecurityModule,
  Permission,
  SecurityLevel,
  AuditEventType,
  AccessRequest,
  Capability,
} from '../../../../src/core/kernel/security-module';

describe('SecurityModule', () => {
  let security: SecurityModule;

  beforeEach(() => {
    security = createSecurityModule();
  });

  describe('Principal Management', () => {
    it('should register principals', () => {
      const principal = security.registerPrincipal('task-1', 'task');

      expect(principal.id).toBe('task-1');
      expect(principal.type).toBe('task');
      expect(principal.securityLevel).toBe(SecurityLevel.STANDARD);
    });

    it('should register principals with custom security level', () => {
      const principal = security.registerPrincipal(
        'admin-1',
        'user',
        SecurityLevel.TRUSTED
      );

      expect(principal.securityLevel).toBe(SecurityLevel.TRUSTED);
    });

    it('should get principals', () => {
      security.registerPrincipal('task-1', 'task');
      const principal = security.getPrincipal('task-1');

      expect(principal).toBeDefined();
      expect(principal?.id).toBe('task-1');
    });

    it('should update security level', () => {
      security.registerPrincipal('task-1', 'task');
      security.updateSecurityLevel('task-1', SecurityLevel.RESTRICTED);

      const principal = security.getPrincipal('task-1');
      expect(principal?.securityLevel).toBe(SecurityLevel.RESTRICTED);
    });

    it('should remove principals', () => {
      security.registerPrincipal('task-1', 'task');
      security.removePrincipal('task-1');

      expect(security.getPrincipal('task-1')).toBeUndefined();
    });
  });

  describe('Capability Management', () => {
    it('should grant capabilities', () => {
      security.registerPrincipal('task-1', 'task');

      const capability: Capability = {
        id: 'custom-cap',
        name: 'Custom Capability',
        permissions: [Permission.FILE_READ, Permission.FILE_WRITE],
      };

      const granted = security.grantCapability('task-1', capability);
      expect(granted).toBe(true);

      const principal = security.getPrincipal('task-1');
      expect(principal?.capabilities.has('custom-cap')).toBe(true);
    });

    it('should revoke capabilities', () => {
      security.registerPrincipal('task-1', 'task');

      const capability: Capability = {
        id: 'custom-cap',
        name: 'Custom Capability',
        permissions: [Permission.FILE_READ],
      };

      security.grantCapability('task-1', capability);
      const revoked = security.revokeCapability('task-1', 'custom-cap');

      expect(revoked).toBe(true);
      expect(security.getPrincipal('task-1')?.capabilities.has('custom-cap')).toBe(false);
    });

    it('should check permissions', () => {
      security.registerPrincipal('task-1', 'task', SecurityLevel.STANDARD);

      // Standard level should have FILE_READ permission
      expect(security.hasPermission('task-1', Permission.FILE_READ)).toBe(true);
      // But not SYSTEM_ADMIN
      expect(security.hasPermission('task-1', Permission.SYSTEM_ADMIN)).toBe(false);
    });

    it('should handle expired capabilities', () => {
      security.registerPrincipal('task-1', 'task', SecurityLevel.RESTRICTED);

      const expiredCapability: Capability = {
        id: 'expired-cap',
        name: 'Expired Capability',
        permissions: [Permission.FILE_WRITE],
        expiresAt: new Date(Date.now() - 1000), // Already expired
      };

      security.grantCapability('task-1', expiredCapability);

      // Even with the capability, permission should be denied due to expiration
      expect(security.hasPermission('task-1', Permission.FILE_WRITE)).toBe(false);
    });
  });

  describe('Access Control', () => {
    it('should grant access for valid permissions', () => {
      security.registerPrincipal('task-1', 'task', SecurityLevel.STANDARD);

      const request: AccessRequest = {
        principalId: 'task-1',
        permission: Permission.FILE_READ,
      };

      const decision = security.checkAccess(request);
      expect(decision.allowed).toBe(true);
    });

    it('should deny access for missing permissions', () => {
      security.registerPrincipal('task-1', 'task', SecurityLevel.RESTRICTED);

      const request: AccessRequest = {
        principalId: 'task-1',
        permission: Permission.FILE_WRITE, // Restricted doesn't have write
      };

      const decision = security.checkAccess(request);
      expect(decision.allowed).toBe(false);
    });

    it('should deny access for unknown principals', () => {
      const request: AccessRequest = {
        principalId: 'unknown',
        permission: Permission.FILE_READ,
      };

      const decision = security.checkAccess(request);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('Principal not found');
    });

    it('should enforce rate limiting', () => {
      const rateLimitedSecurity = createSecurityModule({
        enableRateLimiting: true,
        defaultRateLimit: 2,
        defaultRateLimitWindowMs: 60000,
      });

      rateLimitedSecurity.registerPrincipal('task-1', 'task');

      // First two requests should succeed
      expect(
        rateLimitedSecurity.checkAccess({
          principalId: 'task-1',
          permission: Permission.FILE_READ,
        }).allowed
      ).toBe(true);

      expect(
        rateLimitedSecurity.checkAccess({
          principalId: 'task-1',
          permission: Permission.FILE_READ,
        }).allowed
      ).toBe(true);

      // Third request should be rate limited
      expect(
        rateLimitedSecurity.checkAccess({
          principalId: 'task-1',
          permission: Permission.FILE_READ,
        }).allowed
      ).toBe(false);
    });
  });

  describe('Security Policies', () => {
    it('should add and get policies', () => {
      security.addPolicy({
        id: 'test-policy',
        name: 'Test Policy',
        rules: [
          {
            id: 'allow-read',
            action: 'allow',
            permissions: [Permission.FILE_READ],
            priority: 100,
          },
        ],
        priority: 100,
        enabled: true,
      });

      const policy = security.getPolicy('test-policy');
      expect(policy).toBeDefined();
      expect(policy?.name).toBe('Test Policy');
    });

    it('should enforce deny policies', () => {
      security.registerPrincipal('task-1', 'task', SecurityLevel.TRUSTED);

      // Add a deny policy
      security.addPolicy({
        id: 'deny-network',
        name: 'Deny Network',
        rules: [
          {
            id: 'deny-outbound',
            action: 'deny',
            permissions: [Permission.NETWORK_OUTBOUND],
            priority: 1000,
          },
        ],
        priority: 1000,
        enabled: true,
      });

      const decision = security.checkAccess({
        principalId: 'task-1',
        permission: Permission.NETWORK_OUTBOUND,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Denied by policy');
    });

    it('should remove policies', () => {
      security.addPolicy({
        id: 'test-policy',
        name: 'Test Policy',
        rules: [],
        priority: 100,
        enabled: true,
      });

      security.removePolicy('test-policy');
      expect(security.getPolicy('test-policy')).toBeUndefined();
    });

    it('should get all policies', () => {
      const policies = security.getAllPolicies();
      // Should have default policies
      expect(policies.length).toBeGreaterThan(0);
    });
  });

  describe('Sandbox Management', () => {
    it('should create sandboxes', () => {
      const sandbox = security.createSandbox({
        name: 'Test Sandbox',
        allowedPaths: ['/tmp'],
        deniedPaths: ['/etc'],
        allowedTools: ['read'],
        deniedTools: ['write'],
        networkAccess: false,
        maxMemory: 1073741824,
        maxCpuTime: 60000,
        maxFileSize: 10485760,
        environmentVariables: {},
      });

      expect(sandbox.name).toBe('Test Sandbox');
      expect(sandbox.allowedPaths).toContain('/tmp');
      expect(sandbox.networkAccess).toBe(false);
    });

    it('should assign principals to sandboxes', () => {
      security.registerPrincipal('task-1', 'task');

      const sandbox = security.createSandbox({
        name: 'Test Sandbox',
        allowedPaths: [],
        deniedPaths: [],
        allowedTools: [],
        deniedTools: [],
        networkAccess: true,
        maxMemory: 1073741824,
        maxCpuTime: 60000,
        maxFileSize: 10485760,
        environmentVariables: {},
      });

      security.assignToSandbox('task-1', sandbox.id);

      const principal = security.getPrincipal('task-1');
      expect(principal?.sandboxId).toBe(sandbox.id);
      expect(principal?.securityLevel).toBe(SecurityLevel.SANDBOXED);
    });

    it('should enforce sandbox path constraints', () => {
      security.registerPrincipal('task-1', 'task', SecurityLevel.UNRESTRICTED);

      const sandbox = security.createSandbox({
        name: 'Restricted Sandbox',
        allowedPaths: ['/allowed'],
        deniedPaths: ['/denied'],
        allowedTools: [],
        deniedTools: [],
        networkAccess: true,
        maxMemory: 1073741824,
        maxCpuTime: 60000,
        maxFileSize: 10485760,
        environmentVariables: {},
      });

      security.assignToSandbox('task-1', sandbox.id);

      // Access to denied path should be rejected
      const decision = security.checkAccess({
        principalId: 'task-1',
        permission: Permission.FILE_READ,
        resource: '/denied/secret.txt',
      });

      expect(decision.allowed).toBe(false);
    });

    it('should enforce sandbox network constraints', () => {
      security.registerPrincipal('task-1', 'task', SecurityLevel.UNRESTRICTED);

      const sandbox = security.createSandbox({
        name: 'No Network Sandbox',
        allowedPaths: [],
        deniedPaths: [],
        allowedTools: [],
        deniedTools: [],
        networkAccess: false,
        maxMemory: 1073741824,
        maxCpuTime: 60000,
        maxFileSize: 10485760,
        environmentVariables: {},
      });

      security.assignToSandbox('task-1', sandbox.id);

      const decision = security.checkAccess({
        principalId: 'task-1',
        permission: Permission.NETWORK_OUTBOUND,
      });

      expect(decision.allowed).toBe(false);
    });

    it('should destroy sandboxes', () => {
      security.registerPrincipal('task-1', 'task');

      const sandbox = security.createSandbox({
        name: 'Test Sandbox',
        allowedPaths: [],
        deniedPaths: [],
        allowedTools: [],
        deniedTools: [],
        networkAccess: true,
        maxMemory: 1073741824,
        maxCpuTime: 60000,
        maxFileSize: 10485760,
        environmentVariables: {},
      });

      security.assignToSandbox('task-1', sandbox.id);
      security.destroySandbox(sandbox.id);

      expect(security.getSandbox(sandbox.id)).toBeUndefined();

      const principal = security.getPrincipal('task-1');
      expect(principal?.sandboxId).toBeUndefined();
    });
  });

  describe('Audit Logging', () => {
    it('should log audit events', () => {
      security.registerPrincipal('task-1', 'task');

      security.checkAccess({
        principalId: 'task-1',
        permission: Permission.FILE_READ,
      });

      const logs = security.getAuditLog();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should filter audit logs', () => {
      security.registerPrincipal('task-1', 'task');
      security.registerPrincipal('task-2', 'task');

      security.checkAccess({
        principalId: 'task-1',
        permission: Permission.FILE_READ,
      });

      security.checkAccess({
        principalId: 'task-2',
        permission: Permission.FILE_READ,
      });

      const filteredLogs = security.getAuditLog({ principalId: 'task-1' });
      expect(filteredLogs.every((log) => log.principalId === 'task-1')).toBe(true);
    });

    it('should filter by event type', () => {
      security.registerPrincipal('task-1', 'task');

      // Trigger both granted and denied events
      security.checkAccess({
        principalId: 'task-1',
        permission: Permission.FILE_READ,
      });

      security.checkAccess({
        principalId: 'task-1',
        permission: Permission.SYSTEM_ADMIN, // Will be denied
      });

      const deniedLogs = security.getAuditLog({
        eventType: AuditEventType.ACCESS_DENIED,
      });

      expect(deniedLogs.every((log) => log.eventType === AuditEventType.ACCESS_DENIED)).toBe(
        true
      );
    });

    it('should clear audit log', () => {
      security.registerPrincipal('task-1', 'task');
      security.checkAccess({
        principalId: 'task-1',
        permission: Permission.FILE_READ,
      });

      security.clearAuditLog();
      expect(security.getAuditLog().length).toBe(0);
    });
  });

  describe('Security Violations', () => {
    it('should report security violations', () => {
      const violationHandler = jest.fn();
      security.on('security:violation', violationHandler);

      security.registerPrincipal('task-1', 'task');
      security.reportViolation('task-1', 'Attempted unauthorized access', 'high');

      expect(violationHandler).toHaveBeenCalled();
    });

    it('should auto-sandbox on critical violations', () => {
      security.registerPrincipal('task-1', 'task', SecurityLevel.STANDARD);

      security.reportViolation('task-1', 'Critical security violation', 'critical');

      const principal = security.getPrincipal('task-1');
      expect(principal?.securityLevel).toBe(SecurityLevel.SANDBOXED);
    });
  });

  describe('Events', () => {
    it('should emit access granted events', () => {
      const handler = jest.fn();
      security.on('access:granted', handler);

      security.registerPrincipal('task-1', 'task');
      security.checkAccess({
        principalId: 'task-1',
        permission: Permission.FILE_READ,
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit access denied events', () => {
      const handler = jest.fn();
      security.on('access:denied', handler);

      security.registerPrincipal('task-1', 'task', SecurityLevel.RESTRICTED);
      security.checkAccess({
        principalId: 'task-1',
        permission: Permission.SYSTEM_ADMIN,
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit capability events', () => {
      const grantedHandler = jest.fn();
      const revokedHandler = jest.fn();

      security.on('capability:granted', grantedHandler);
      security.on('capability:revoked', revokedHandler);

      security.registerPrincipal('task-1', 'task');

      const capability: Capability = {
        id: 'test-cap',
        name: 'Test Capability',
        permissions: [Permission.FILE_READ],
      };

      security.grantCapability('task-1', capability);
      expect(grantedHandler).toHaveBeenCalled();

      security.revokeCapability('task-1', 'test-cap');
      expect(revokedHandler).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should get security statistics', () => {
      security.registerPrincipal('task-1', 'task');
      security.createSandbox({
        name: 'Test Sandbox',
        allowedPaths: [],
        deniedPaths: [],
        allowedTools: [],
        deniedTools: [],
        networkAccess: true,
        maxMemory: 1073741824,
        maxCpuTime: 60000,
        maxFileSize: 10485760,
        environmentVariables: {},
      });

      security.checkAccess({
        principalId: 'task-1',
        permission: Permission.FILE_READ,
      });

      const stats = security.getStats();
      expect(stats.principals).toBe(1);
      expect(stats.sandboxes).toBe(1);
      expect(stats.accessGranted).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('should reset security module', () => {
      security.registerPrincipal('task-1', 'task');
      security.createSandbox({
        name: 'Test',
        allowedPaths: [],
        deniedPaths: [],
        allowedTools: [],
        deniedTools: [],
        networkAccess: true,
        maxMemory: 1073741824,
        maxCpuTime: 60000,
        maxFileSize: 10485760,
        environmentVariables: {},
      });

      security.reset();

      const stats = security.getStats();
      expect(stats.principals).toBe(0);
      expect(stats.sandboxes).toBe(0);
    });
  });
});
