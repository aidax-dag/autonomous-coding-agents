/**
 * Alert System Tests
 *
 * Feature: Metrics System (Phase 3.2)
 * Tests for AlertSystem class
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  AlertSystem,
  createAlertSystem,
  DEFAULT_ALERT_CONFIG,
  MetricsCollector,
  QualityDashboard,
  Alert,
  AlertRule,
  AlertSeverity,
} from '../../../src/core/metrics/index.js';

describe('AlertSystem', () => {
  let collector: MetricsCollector;
  let dashboard: QualityDashboard;
  let alertSystem: AlertSystem;

  beforeEach(() => {
    collector = new MetricsCollector({
      autoCollect: false,
    });

    dashboard = new QualityDashboard(collector, {
      projectId: 'test-project',
    });

    alertSystem = new AlertSystem(collector, dashboard, {
      checkInterval: 100, // Fast checks for testing
      enableConsoleNotifications: false, // Disable console output in tests
    });
  });

  afterEach(() => {
    alertSystem.stop();
    collector.stop();
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_ALERT_CONFIG.checkInterval).toBe(30000);
      expect(DEFAULT_ALERT_CONFIG.defaultCooldown).toBe(300000);
      expect(DEFAULT_ALERT_CONFIG.maxActiveAlerts).toBe(100);
      expect(DEFAULT_ALERT_CONFIG.maxHistoryEntries).toBe(1000);
    });

    it('should accept custom configuration', () => {
      const custom = new AlertSystem(collector, dashboard, {
        name: 'custom-alerts',
        checkInterval: 1000,
      });

      expect(custom.name).toBe('custom-alerts');
      custom.stop();
    });

    it('should work without dashboard', () => {
      const noDashboard = new AlertSystem(collector, undefined, {
        enableConsoleNotifications: false,
      });

      expect(noDashboard).toBeDefined();
      noDashboard.stop();
    });
  });

  // ============================================================================
  // Rule Management
  // ============================================================================

  describe('Rule Management', () => {
    it('should add an alert rule', () => {
      const ruleId = alertSystem.addRule({
        name: 'High CPU',
        metricName: 'cpu_usage',
        operator: 'gt',
        threshold: 90,
        severity: 'critical',
        enabled: true,
      });

      expect(ruleId).toBeDefined();
      expect(alertSystem.listRules()).toHaveLength(1);
    });

    it('should get a rule by ID', () => {
      const ruleId = alertSystem.addRule({
        name: 'Test Rule',
        metricName: 'test_metric',
        operator: 'gt',
        threshold: 50,
        severity: 'warning',
        enabled: true,
      });

      const rule = alertSystem.getRule(ruleId);
      expect(rule).toBeDefined();
      expect(rule!.name).toBe('Test Rule');
    });

    it('should update a rule', () => {
      const ruleId = alertSystem.addRule({
        name: 'Original',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'warning',
        enabled: true,
      });

      const updated = alertSystem.updateRule(ruleId, {
        name: 'Updated',
        threshold: 75,
      });

      expect(updated).toBe(true);
      expect(alertSystem.getRule(ruleId)!.name).toBe('Updated');
      expect(alertSystem.getRule(ruleId)!.threshold).toBe(75);
    });

    it('should return false when updating non-existent rule', () => {
      const updated = alertSystem.updateRule('non-existent', { name: 'New' });
      expect(updated).toBe(false);
    });

    it('should remove a rule', () => {
      const ruleId = alertSystem.addRule({
        name: 'To Remove',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      expect(alertSystem.removeRule(ruleId)).toBe(true);
      expect(alertSystem.listRules()).toHaveLength(0);
    });

    it('should return false when removing non-existent rule', () => {
      expect(alertSystem.removeRule('non-existent')).toBe(false);
    });

    it('should enable and disable rules', () => {
      const ruleId = alertSystem.addRule({
        name: 'Toggle',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      alertSystem.disableRule(ruleId);
      expect(alertSystem.getRule(ruleId)!.enabled).toBe(false);

      alertSystem.enableRule(ruleId);
      expect(alertSystem.getRule(ruleId)!.enabled).toBe(true);
    });

    it('should emit rule:added event', (done) => {
      alertSystem.on('rule:added', (rule: AlertRule) => {
        expect(rule.name).toBe('Event Test');
        done();
      });

      alertSystem.addRule({
        name: 'Event Test',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });
    });

    it('should emit rule:removed event', (done) => {
      const ruleId = alertSystem.addRule({
        name: 'To Remove',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      alertSystem.on('rule:removed', (id: string) => {
        expect(id).toBe(ruleId);
        done();
      });

      alertSystem.removeRule(ruleId);
    });
  });

  // ============================================================================
  // Condition Evaluation
  // ============================================================================

  describe('Condition Evaluation', () => {
    it('should trigger alert when condition is met (gt)', async () => {
      alertSystem.addRule({
        name: 'High Value',
        metricName: 'test_metric',
        operator: 'gt',
        threshold: 50,
        severity: 'warning',
        enabled: true,
      });

      collector.push('test_metric', 75);
      await alertSystem.checkRules();

      const alerts = alertSystem.listActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should not trigger when condition is not met', async () => {
      alertSystem.addRule({
        name: 'High Value',
        metricName: 'test_metric',
        operator: 'gt',
        threshold: 50,
        severity: 'warning',
        enabled: true,
      });

      collector.push('test_metric', 25);
      await alertSystem.checkRules();

      const alerts = alertSystem.listActiveAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should evaluate gte operator correctly', async () => {
      alertSystem.addRule({
        name: 'Test',
        metricName: 'metric',
        operator: 'gte',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      collector.push('metric', 50);
      await alertSystem.checkRules();

      expect(alertSystem.listActiveAlerts().length).toBeGreaterThan(0);
    });

    it('should evaluate lt operator correctly', async () => {
      alertSystem.addRule({
        name: 'Low Value',
        metricName: 'metric',
        operator: 'lt',
        threshold: 50,
        severity: 'warning',
        enabled: true,
      });

      collector.push('metric', 25);
      await alertSystem.checkRules();

      expect(alertSystem.listActiveAlerts().length).toBeGreaterThan(0);
    });

    it('should evaluate lte operator correctly', async () => {
      alertSystem.addRule({
        name: 'Test',
        metricName: 'metric',
        operator: 'lte',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      collector.push('metric', 50);
      await alertSystem.checkRules();

      expect(alertSystem.listActiveAlerts().length).toBeGreaterThan(0);
    });

    it('should evaluate eq operator correctly', async () => {
      alertSystem.addRule({
        name: 'Exact',
        metricName: 'metric',
        operator: 'eq',
        threshold: 100,
        severity: 'info',
        enabled: true,
      });

      collector.push('metric', 100);
      await alertSystem.checkRules();

      expect(alertSystem.listActiveAlerts().length).toBeGreaterThan(0);
    });

    it('should evaluate neq operator correctly', async () => {
      alertSystem.addRule({
        name: 'Not Equal',
        metricName: 'metric',
        operator: 'neq',
        threshold: 100,
        severity: 'info',
        enabled: true,
      });

      collector.push('metric', 50);
      await alertSystem.checkRules();

      expect(alertSystem.listActiveAlerts().length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Alert Management
  // ============================================================================

  describe('Alert Management', () => {
    beforeEach(async () => {
      alertSystem.addRule({
        name: 'Test Alert',
        metricName: 'test_metric',
        operator: 'gt',
        threshold: 50,
        severity: 'warning',
        enabled: true,
      });

      collector.push('test_metric', 75);
      await alertSystem.checkRules();
    });

    it('should create alert with correct properties', () => {
      const alerts = alertSystem.listActiveAlerts();
      expect(alerts).toHaveLength(1);

      const alert = alerts[0];
      expect(alert.id).toBeDefined();
      expect(alert.ruleName).toBe('Test Alert');
      expect(alert.severity).toBe('warning');
      expect(alert.status).toBe('active');
      expect(alert.triggeredAt).toBeInstanceOf(Date);
    });

    it('should acknowledge alert', () => {
      const alerts = alertSystem.listActiveAlerts();
      const alertId = alerts[0].id;

      const acknowledged = alertSystem.acknowledgeAlert(alertId, 'test-user');

      expect(acknowledged).toBe(true);
      expect(alertSystem.getAlert(alertId)!.status).toBe('acknowledged');
      expect(alertSystem.getAlert(alertId)!.acknowledgedBy).toBe('test-user');
    });

    it('should resolve alert', () => {
      const alerts = alertSystem.listActiveAlerts();
      const alertId = alerts[0].id;

      const resolved = alertSystem.resolveAlert(alertId, 'Fixed');

      expect(resolved).toBe(true);
      expect(alertSystem.getAlert(alertId)).toBeUndefined();
      expect(alertSystem.getHistory()).toHaveLength(1);
    });

    it('should silence alert', () => {
      const alerts = alertSystem.listActiveAlerts();
      const alertId = alerts[0].id;

      const silenced = alertSystem.silenceAlert(alertId);

      expect(silenced).toBe(true);
      expect(alertSystem.getAlert(alertId)!.status).toBe('silenced');
    });

    it('should filter alerts by severity', async () => {
      // Add another rule with different severity
      alertSystem.addRule({
        name: 'Critical Alert',
        metricName: 'critical_metric',
        operator: 'gt',
        threshold: 50,
        severity: 'critical',
        enabled: true,
      });

      collector.push('critical_metric', 75);
      await alertSystem.checkRules();

      const warningAlerts = alertSystem.listActiveAlerts('warning');
      const criticalAlerts = alertSystem.listActiveAlerts('critical');

      expect(warningAlerts.length).toBeGreaterThan(0);
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it('should emit alert:triggered event', (done) => {
      // Clear and set up fresh
      alertSystem.clear();

      alertSystem.addRule({
        name: 'Event Alert',
        metricName: 'event_metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      alertSystem.on('alert:triggered', (alert: Alert) => {
        expect(alert.ruleName).toBe('Event Alert');
        done();
      });

      collector.push('event_metric', 75);
      alertSystem.checkRules();
    });

    it('should emit alert:acknowledged event', (done) => {
      const alerts = alertSystem.listActiveAlerts();
      const alertId = alerts[0].id;

      alertSystem.on('alert:acknowledged', (alert: Alert) => {
        expect(alert.id).toBe(alertId);
        done();
      });

      alertSystem.acknowledgeAlert(alertId);
    });

    it('should emit alert:resolved event', (done) => {
      const alerts = alertSystem.listActiveAlerts();
      const alertId = alerts[0].id;

      alertSystem.on('alert:resolved', (alert: Alert) => {
        expect(alert.id).toBe(alertId);
        done();
      });

      alertSystem.resolveAlert(alertId);
    });
  });

  // ============================================================================
  // Start/Stop
  // ============================================================================

  describe('Start/Stop', () => {
    it('should start and stop monitoring', () => {
      alertSystem.start();
      expect(alertSystem.isRunning).toBe(true);

      alertSystem.stop();
      expect(alertSystem.isRunning).toBe(false);
    });

    it('should not start twice', () => {
      alertSystem.start();
      const firstStart = alertSystem.isRunning;
      alertSystem.start();

      expect(firstStart).toBe(true);
      expect(alertSystem.isRunning).toBe(true);
    });
  });

  // ============================================================================
  // Cooldown
  // ============================================================================

  describe('Cooldown', () => {
    it('should respect cooldown period', async () => {
      alertSystem.addRule({
        name: 'Cooldown Test',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        cooldown: 1000, // 1 second cooldown
        enabled: true,
      });

      collector.push('metric', 75);
      await alertSystem.checkRules();
      const firstCount = alertSystem.listActiveAlerts().length;

      // Try to trigger again immediately
      await alertSystem.checkRules();
      const secondCount = alertSystem.listActiveAlerts().length;

      // Should not trigger again due to cooldown
      expect(secondCount).toBe(firstCount);
    });
  });

  // ============================================================================
  // Auto-resolve
  // ============================================================================

  describe('Auto-resolve', () => {
    it('should auto-resolve when condition is no longer true', async () => {
      alertSystem.addRule({
        name: 'Auto Resolve',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      // Trigger alert
      collector.push('metric', 75);
      await alertSystem.checkRules();
      expect(alertSystem.listActiveAlerts()).toHaveLength(1);

      // Clear and push value below threshold
      collector.clear();
      collector.push('metric', 25);
      await alertSystem.checkRules();

      // Should be auto-resolved
      expect(alertSystem.listActiveAlerts()).toHaveLength(0);
      expect(alertSystem.getHistory()).toHaveLength(1);
    });
  });

  // ============================================================================
  // Notifications
  // ============================================================================

  describe('Notifications', () => {
    it('should call callback notification channel', async () => {
      let callbackCalled = false;

      alertSystem.addRule({
        name: 'Callback Test',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
        notifications: [
          {
            type: 'callback',
            callback: async (alert) => {
              callbackCalled = true;
              expect(alert.ruleName).toBe('Callback Test');
            },
          },
        ],
      });

      collector.push('metric', 75);
      await alertSystem.checkRules();

      expect(callbackCalled).toBe(true);
    });

    it('should emit notification:sent event', (done) => {
      alertSystem.on('notification:sent', (_alert: Alert, channel: string) => {
        expect(channel).toBe('callback');
        done();
      });

      alertSystem.addRule({
        name: 'Notification Event',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
        notifications: [
          {
            type: 'callback',
            callback: async () => {},
          },
        ],
      });

      collector.push('metric', 75);
      alertSystem.checkRules();
    });

    it('should handle notification failure gracefully', async () => {
      alertSystem.addRule({
        name: 'Failing Notification',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
        notifications: [
          {
            type: 'callback',
            callback: async () => {
              throw new Error('Notification failed');
            },
          },
        ],
      });

      collector.push('metric', 75);

      // Should not throw
      await expect(alertSystem.checkRules()).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('Statistics', () => {
    it('should return alert stats', async () => {
      alertSystem.addRule({
        name: 'Stats Test',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'warning',
        enabled: true,
      });

      collector.push('metric', 75);
      await alertSystem.checkRules();

      const stats = alertSystem.getStats();

      expect(stats.totalAlerts).toBeGreaterThan(0);
      expect(stats.activeAlerts).toBeGreaterThan(0);
      expect(stats.alertsBySeverity.warning).toBeGreaterThan(0);
    });

    it('should track alerts by rule', async () => {
      const ruleId = alertSystem.addRule({
        name: 'Track By Rule',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      collector.push('metric', 75);
      await alertSystem.checkRules();

      const stats = alertSystem.getStats();
      expect(stats.alertsByRule[ruleId]).toBe(1);
    });

    it('should track resolution time', async () => {
      alertSystem.addRule({
        name: 'Resolution Time',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      collector.push('metric', 75);
      await alertSystem.checkRules();

      const alertId = alertSystem.listActiveAlerts()[0].id;

      // Wait a bit then resolve
      await new Promise(resolve => setTimeout(resolve, 50));
      alertSystem.resolveAlert(alertId);

      const stats = alertSystem.getStats();
      expect(stats.averageResolutionTime).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // History
  // ============================================================================

  describe('History', () => {
    it('should track resolved alerts in history', async () => {
      alertSystem.addRule({
        name: 'History Test',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      collector.push('metric', 75);
      await alertSystem.checkRules();

      const alertId = alertSystem.listActiveAlerts()[0].id;
      alertSystem.resolveAlert(alertId);

      const history = alertSystem.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].alert.ruleName).toBe('History Test');
    });

    it('should limit history entries', () => {
      const limitedSystem = new AlertSystem(collector, dashboard, {
        maxHistoryEntries: 3,
        enableConsoleNotifications: false,
      });

      // Add and resolve multiple alerts
      for (let i = 0; i < 5; i++) {
        limitedSystem.addRule({
          name: `Rule ${i}`,
          metricName: `metric_${i}`,
          operator: 'gt',
          threshold: 50,
          severity: 'info',
          enabled: true,
        });

        collector.push(`metric_${i}`, 75);
        limitedSystem.checkRules().then(() => {
          const alerts = limitedSystem.listActiveAlerts();
          if (alerts.length > 0) {
            limitedSystem.resolveAlert(alerts[0].id);
          }
        });
      }

      limitedSystem.stop();
    });

    it('should get history with limit', async () => {
      alertSystem.addRule({
        name: 'Limit Test',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
        cooldown: 0,
      });

      for (let i = 0; i < 5; i++) {
        collector.push('metric', 75);
        await alertSystem.checkRules();

        const alerts = alertSystem.listActiveAlerts();
        if (alerts.length > 0) {
          alertSystem.resolveAlert(alerts[0].id);
        }
      }

      const limitedHistory = alertSystem.getHistory(2);
      expect(limitedHistory.length).toBeLessThanOrEqual(2);
    });
  });

  // ============================================================================
  // Max Active Alerts
  // ============================================================================

  describe('Max Active Alerts', () => {
    it('should evict oldest alert when max reached', async () => {
      const limitedSystem = new AlertSystem(collector, dashboard, {
        maxActiveAlerts: 2,
        enableConsoleNotifications: false,
      });

      for (let i = 0; i < 3; i++) {
        limitedSystem.addRule({
          name: `Rule ${i}`,
          metricName: `metric_${i}`,
          operator: 'gt',
          threshold: 50,
          severity: 'info',
          enabled: true,
        });

        collector.push(`metric_${i}`, 75);
        await limitedSystem.checkRules();
      }

      expect(limitedSystem.listActiveAlerts().length).toBeLessThanOrEqual(2);
      limitedSystem.stop();
    });
  });

  // ============================================================================
  // Clear
  // ============================================================================

  describe('Clear', () => {
    it('should clear all data', async () => {
      alertSystem.addRule({
        name: 'Clear Test',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      collector.push('metric', 75);
      await alertSystem.checkRules();

      alertSystem.clear();

      expect(alertSystem.listActiveAlerts()).toHaveLength(0);
      expect(alertSystem.getHistory()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle rule with no metric data', async () => {
      alertSystem.addRule({
        name: 'No Data',
        metricName: 'non_existent',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: true,
      });

      await expect(alertSystem.checkRules()).resolves.not.toThrow();
      expect(alertSystem.listActiveAlerts()).toHaveLength(0);
    });

    it('should handle disabled rule', async () => {
      alertSystem.addRule({
        name: 'Disabled',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        enabled: false,
      });

      collector.push('metric', 75);
      await alertSystem.checkRules();

      expect(alertSystem.listActiveAlerts()).toHaveLength(0);
    });

    it('should return undefined for non-existent rule', () => {
      const rule = alertSystem.getRule('non-existent');
      expect(rule).toBeUndefined();
    });

    it('should return false for acknowledging non-existent alert', () => {
      expect(alertSystem.acknowledgeAlert('non-existent')).toBe(false);
    });

    it('should return false for resolving non-existent alert', () => {
      expect(alertSystem.resolveAlert('non-existent')).toBe(false);
    });

    it('should return false for silencing non-existent alert', () => {
      expect(alertSystem.silenceAlert('non-existent')).toBe(false);
    });

    it('should not trigger duplicate alerts', async () => {
      alertSystem.addRule({
        name: 'No Duplicates',
        metricName: 'metric',
        operator: 'gt',
        threshold: 50,
        severity: 'info',
        cooldown: 0,
        enabled: true,
      });

      collector.push('metric', 75);
      await alertSystem.checkRules();
      await alertSystem.checkRules();

      // Should only have one active alert
      expect(alertSystem.listActiveAlerts()).toHaveLength(1);
    });
  });

  // ============================================================================
  // Factory Function
  // ============================================================================

  describe('Factory Function', () => {
    it('should create alert system with defaults', () => {
      const created = createAlertSystem(collector);
      expect(created).toBeInstanceOf(AlertSystem);
      created.stop();
    });

    it('should create alert system with dashboard', () => {
      const created = createAlertSystem(collector, dashboard);
      expect(created).toBeInstanceOf(AlertSystem);
      created.stop();
    });

    it('should create alert system with custom config', () => {
      const created = createAlertSystem(collector, dashboard, {
        name: 'custom',
        checkInterval: 5000,
      });

      expect(created.name).toBe('custom');
      created.stop();
    });
  });

  // ============================================================================
  // Severity Levels
  // ============================================================================

  describe('Severity Levels', () => {
    it('should track all severity levels', async () => {
      const severities: AlertSeverity[] = ['info', 'warning', 'critical', 'emergency'];

      for (const severity of severities) {
        alertSystem.addRule({
          name: `${severity} Alert`,
          metricName: `${severity}_metric`,
          operator: 'gt',
          threshold: 50,
          severity,
          enabled: true,
        });

        collector.push(`${severity}_metric`, 75);
      }

      await alertSystem.checkRules();

      const stats = alertSystem.getStats();
      expect(stats.alertsBySeverity.info).toBe(1);
      expect(stats.alertsBySeverity.warning).toBe(1);
      expect(stats.alertsBySeverity.critical).toBe(1);
      expect(stats.alertsBySeverity.emergency).toBe(1);
    });
  });
});
