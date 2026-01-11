/**
 * Usage Analytics Manager Tests
 *
 * Feature: F5.13 - Usage Analytics
 * Tests for usage tracking, analytics aggregation, and reporting
 */

import {
  UsageAnalyticsManager,
  type RecordUsageRequest,
  type AnalyticsEvent,
} from '../../../../src/core/enterprise/analytics/index.js';

describe('UsageAnalyticsManager', () => {
  let manager: UsageAnalyticsManager;
  const testTeamId = 'team-analytics-test';
  const testUserId = 'user-analytics-test';

  beforeEach(() => {
    manager = new UsageAnalyticsManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  // ==================== Usage Tracking ====================

  describe('recordUsage', () => {
    it('should record a usage metric', async () => {
      const request: RecordUsageRequest = {
        teamId: testTeamId,
        userId: testUserId,
        metricType: 'api_calls',
        value: 100,
      };

      const record = await manager.recordUsage(request);

      expect(record.id).toBeDefined();
      expect(record.teamId).toBe(testTeamId);
      expect(record.userId).toBe(testUserId);
      expect(record.metricType).toBe('api_calls');
      expect(record.value).toBe(100);
      expect(record.unit).toBe('calls');
      expect(record.timestamp).toBeInstanceOf(Date);
    });

    it('should record usage with custom unit', async () => {
      const record = await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'storage_bytes',
        value: 1024,
        unit: 'KB',
      });

      expect(record.unit).toBe('KB');
    });

    it('should record usage with metadata', async () => {
      const metadata = { endpoint: '/api/users', method: 'GET' };
      const record = await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 1,
        metadata,
      });

      expect(record.metadata).toEqual(metadata);
    });

    it('should emit usage.recorded event', async () => {
      const events: AnalyticsEvent[] = [];
      manager.onAnalyticsEvent((event) => events.push(event));

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 10,
      });

      expect(events.some((e) => e.type === 'usage.recorded')).toBe(true);
    });
  });

  describe('recordUsageBatch', () => {
    it('should record multiple usage metrics', async () => {
      const requests: RecordUsageRequest[] = [
        { teamId: testTeamId, metricType: 'api_calls', value: 100 },
        { teamId: testTeamId, metricType: 'token_usage', value: 5000 },
        { teamId: testTeamId, metricType: 'model_calls', value: 10 },
      ];

      const records = await manager.recordUsageBatch(requests);

      expect(records.length).toBe(3);
      expect(records[0].metricType).toBe('api_calls');
      expect(records[1].metricType).toBe('token_usage');
      expect(records[2].metricType).toBe('model_calls');
    });
  });

  describe('queryUsage', () => {
    beforeEach(async () => {
      // Set up test data
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 100 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 200 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'token_usage', value: 5000 });
      await manager.recordUsage({ teamId: 'other-team', metricType: 'api_calls', value: 50 });
    });

    it('should query usage records by team', async () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const records = await manager.queryUsage({
        teamId: testTeamId,
        startDate: hourAgo,
        endDate: now,
      });

      expect(records.length).toBe(3);
      expect(records.every((r) => r.teamId === testTeamId)).toBe(true);
    });

    it('should filter by metric types', async () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const records = await manager.queryUsage({
        teamId: testTeamId,
        metricTypes: ['api_calls'],
        startDate: hourAgo,
        endDate: now,
      });

      expect(records.length).toBe(2);
      expect(records.every((r) => r.metricType === 'api_calls')).toBe(true);
    });

    it('should filter by user ID', async () => {
      await manager.recordUsage({
        teamId: testTeamId,
        userId: testUserId,
        metricType: 'api_calls',
        value: 50,
      });

      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const records = await manager.queryUsage({
        teamId: testTeamId,
        userId: testUserId,
        startDate: hourAgo,
        endDate: now,
      });

      expect(records.length).toBe(1);
      expect(records[0].userId).toBe(testUserId);
    });

    it('should sort by timestamp descending', async () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const records = await manager.queryUsage({
        teamId: testTeamId,
        startDate: hourAgo,
        endDate: now,
      });

      for (let i = 1; i < records.length; i++) {
        expect(records[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          records[i].timestamp.getTime()
        );
      }
    });
  });

  describe('getAggregatedUsage', () => {
    beforeEach(async () => {
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 100 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 200 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 150 });
    });

    it('should aggregate usage by period', async () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const aggregations = await manager.getAggregatedUsage({
        teamId: testTeamId,
        metricTypes: ['api_calls'],
        startDate: hourAgo,
        endDate: now,
        aggregation: 'day',
      });

      expect(aggregations.length).toBeGreaterThan(0);
      const apiAgg = aggregations.find((a) => a.metricType === 'api_calls');
      expect(apiAgg).toBeDefined();
      expect(apiAgg!.total).toBe(450);
      expect(apiAgg!.count).toBe(3);
      expect(apiAgg!.average).toBe(150);
      expect(apiAgg!.min).toBe(100);
      expect(apiAgg!.max).toBe(200);
    });

    it('should use default day aggregation', async () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const aggregations = await manager.getAggregatedUsage({
        teamId: testTeamId,
        startDate: hourAgo,
        endDate: now,
      });

      expect(aggregations.every((a) => a.period === 'day')).toBe(true);
    });
  });

  describe('getUsageSummary', () => {
    beforeEach(async () => {
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 1000 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'agent_hours', value: 5 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'token_usage', value: 50000 });
    });

    it('should generate usage summary', async () => {
      const summary = await manager.getUsageSummary(testTeamId, 'day');

      expect(summary.teamId).toBe(testTeamId);
      expect(summary.period).toBe('day');
      expect(summary.periodStart).toBeInstanceOf(Date);
      expect(summary.periodEnd).toBeInstanceOf(Date);
      expect(summary.metrics.apiCalls).toBeDefined();
      expect(summary.metrics.agentHours).toBeDefined();
      expect(summary.metrics.tokenUsage).toBeDefined();
      expect(summary.currency).toBe('USD');
    });

    it('should calculate metric trends', async () => {
      const summary = await manager.getUsageSummary(testTeamId, 'day');

      expect(summary.metrics.apiCalls.current).toBe(1000);
      expect(summary.metrics.apiCalls.unit).toBe('calls');
      expect(['up', 'down', 'stable']).toContain(summary.metrics.apiCalls.trend);
    });

    it('should calculate estimated cost', async () => {
      const summary = await manager.getUsageSummary(testTeamId, 'day');

      expect(summary.estimatedCost).toBeGreaterThan(0);
    });
  });

  // ==================== Reports ====================

  describe('generateReport', () => {
    beforeEach(async () => {
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 1000 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'token_usage', value: 50000 });
    });

    it('should generate a usage report', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const report = await manager.generateReport({
        teamId: testTeamId,
        type: 'usage_summary',
        period: 'week',
        periodStart: weekAgo,
        periodEnd: now,
      });

      expect(report.id).toBeDefined();
      expect(report.type).toBe('usage_summary');
      expect(report.teamId).toBe(testTeamId);
      expect(report.period).toBe('week');
      expect(report.data).toBeDefined();
      expect(report.format).toBe('json');
    });

    it('should generate report with custom name', async () => {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const report = await manager.generateReport({
        teamId: testTeamId,
        type: 'cost_analysis',
        name: 'Monthly Cost Report',
        period: 'month',
        periodStart: monthAgo,
        periodEnd: now,
      });

      expect(report.name).toBe('Monthly Cost Report');
    });

    it('should generate report with charts', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const report = await manager.generateReport({
        teamId: testTeamId,
        type: 'usage_summary',
        period: 'week',
        periodStart: weekAgo,
        periodEnd: now,
        includeCharts: true,
      });

      expect(report.data.charts).toBeDefined();
      expect(report.data.charts!.length).toBeGreaterThan(0);
    });

    it('should emit report.generated event', async () => {
      const events: AnalyticsEvent[] = [];
      manager.onAnalyticsEvent((event) => events.push(event));

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      await manager.generateReport({
        teamId: testTeamId,
        type: 'usage_summary',
        period: 'week',
        periodStart: weekAgo,
        periodEnd: now,
      });

      expect(events.some((e) => e.type === 'report.generated')).toBe(true);
    });
  });

  describe('getReport', () => {
    it('should get a report by ID', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const report = await manager.generateReport({
        teamId: testTeamId,
        type: 'usage_summary',
        period: 'week',
        periodStart: weekAgo,
        periodEnd: now,
      });

      const retrieved = await manager.getReport(report.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(report.id);
    });

    it('should return undefined for non-existent report', async () => {
      const retrieved = await manager.getReport('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getReports', () => {
    beforeEach(async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      await manager.generateReport({
        teamId: testTeamId,
        type: 'usage_summary',
        period: 'week',
        periodStart: weekAgo,
        periodEnd: now,
      });

      await manager.generateReport({
        teamId: testTeamId,
        type: 'cost_analysis',
        period: 'month',
        periodStart: weekAgo,
        periodEnd: now,
      });

      await manager.generateReport({
        teamId: 'other-team',
        type: 'usage_summary',
        period: 'week',
        periodStart: weekAgo,
        periodEnd: now,
      });
    });

    it('should get reports by team', async () => {
      const reports = await manager.getReports(testTeamId);

      expect(reports.length).toBe(2);
      expect(reports.every((r) => r.teamId === testTeamId)).toBe(true);
    });

    it('should limit returned reports', async () => {
      const reports = await manager.getReports(testTeamId, 1);
      expect(reports.length).toBe(1);
    });

    it('should sort by generation date descending', async () => {
      const reports = await manager.getReports(testTeamId);

      for (let i = 1; i < reports.length; i++) {
        expect(reports[i - 1].generatedAt.getTime()).toBeGreaterThanOrEqual(
          reports[i].generatedAt.getTime()
        );
      }
    });
  });

  describe('deleteReport', () => {
    it('should delete a report', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const report = await manager.generateReport({
        teamId: testTeamId,
        type: 'usage_summary',
        period: 'week',
        periodStart: weekAgo,
        periodEnd: now,
      });

      const deleted = await manager.deleteReport(report.id);
      expect(deleted).toBe(true);

      const retrieved = await manager.getReport(report.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent report', async () => {
      const deleted = await manager.deleteReport('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== Cost Analysis ====================

  describe('getCostEstimate', () => {
    beforeEach(async () => {
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 1000 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'agent_hours', value: 2 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'token_usage', value: 10000 });
    });

    it('should calculate cost estimate', async () => {
      const estimate = await manager.getCostEstimate(testTeamId, 'day');

      expect(estimate.teamId).toBe(testTeamId);
      expect(estimate.period).toBe('day');
      expect(estimate.lineItems.length).toBeGreaterThan(0);
      expect(estimate.subtotal).toBeGreaterThan(0);
      expect(estimate.total).toBe(estimate.subtotal - estimate.discounts);
      expect(estimate.currency).toBe('USD');
    });

    it('should include line items for each metric', async () => {
      const estimate = await manager.getCostEstimate(testTeamId, 'day');

      const apiCallsItem = estimate.lineItems.find((i) => i.metricType === 'api_calls');
      expect(apiCallsItem).toBeDefined();
      expect(apiCallsItem!.quantity).toBe(1000);
      expect(apiCallsItem!.totalPrice).toBe(1); // 1000 * $0.001
    });
  });

  describe('getCostTrends', () => {
    beforeEach(async () => {
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 1000 });
    });

    it('should get cost trends over multiple periods', async () => {
      const trends = await manager.getCostTrends(testTeamId, 3, 'day');

      expect(trends.length).toBe(3);
      expect(trends.every((t) => t.teamId === testTeamId)).toBe(true);
    });

    it('should return trends in chronological order', async () => {
      const trends = await manager.getCostTrends(testTeamId, 3, 'day');

      for (let i = 1; i < trends.length; i++) {
        expect(trends[i].periodStart.getTime()).toBeGreaterThan(
          trends[i - 1].periodStart.getTime()
        );
      }
    });
  });

  // ==================== Alerts ====================

  describe('createAlertRule', () => {
    it('should create an alert rule', async () => {
      const rule = await manager.createAlertRule({
        name: 'High API Usage Alert',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 10000 },
        severity: 'warning',
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('High API Usage Alert');
      expect(rule.teamId).toBe(testTeamId);
      expect(rule.metricType).toBe('api_calls');
      expect(rule.alertType).toBe('quota_warning');
      expect(rule.condition.operator).toBe('>');
      expect(rule.condition.threshold).toBe(10000);
      expect(rule.severity).toBe('warning');
      expect(rule.enabled).toBe(true);
    });

    it('should create rule with notification channels', async () => {
      const rule = await manager.createAlertRule({
        name: 'Cost Alert',
        metricType: 'token_usage',
        alertType: 'cost_threshold',
        condition: { operator: '>', threshold: 100000 },
        severity: 'critical',
        notificationChannels: ['email', 'slack'],
      });

      expect(rule.notificationChannels).toEqual(['email', 'slack']);
    });
  });

  describe('getAlertRule', () => {
    it('should get an alert rule by ID', async () => {
      const rule = await manager.createAlertRule({
        name: 'Test Rule',
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 5000 },
        severity: 'info',
      });

      const retrieved = await manager.getAlertRule(rule.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(rule.id);
    });

    it('should return undefined for non-existent rule', async () => {
      const retrieved = await manager.getAlertRule('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('updateAlertRule', () => {
    it('should update an alert rule', async () => {
      const rule = await manager.createAlertRule({
        name: 'Original Name',
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 5000 },
        severity: 'info',
      });

      const updated = await manager.updateAlertRule(rule.id, {
        name: 'Updated Name',
        severity: 'warning',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.severity).toBe('warning');
      expect(updated.id).toBe(rule.id);
      expect(updated.createdAt).toEqual(rule.createdAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(rule.updatedAt.getTime());
    });

    it('should throw error for non-existent rule', async () => {
      await expect(
        manager.updateAlertRule('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Alert rule not found');
    });
  });

  describe('deleteAlertRule', () => {
    it('should delete an alert rule', async () => {
      const rule = await manager.createAlertRule({
        name: 'To Delete',
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 5000 },
        severity: 'info',
      });

      const deleted = await manager.deleteAlertRule(rule.id);
      expect(deleted).toBe(true);

      const retrieved = await manager.getAlertRule(rule.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent rule', async () => {
      const deleted = await manager.deleteAlertRule('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('getAlertRules', () => {
    beforeEach(async () => {
      await manager.createAlertRule({
        name: 'Team Rule 1',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 5000 },
        severity: 'info',
      });

      await manager.createAlertRule({
        name: 'Team Rule 2',
        teamId: testTeamId,
        metricType: 'token_usage',
        alertType: 'cost_threshold',
        condition: { operator: '>', threshold: 100000 },
        severity: 'warning',
      });

      await manager.createAlertRule({
        name: 'Global Rule',
        metricType: 'model_calls',
        alertType: 'usage_spike',
        condition: { operator: 'spike', threshold: 100 },
        severity: 'critical',
      });
    });

    it('should get all alert rules', async () => {
      const rules = await manager.getAlertRules();
      expect(rules.length).toBe(3);
    });

    it('should filter rules by team', async () => {
      const rules = await manager.getAlertRules(testTeamId);

      // Should include team-specific rules and global rules (no teamId)
      expect(rules.length).toBe(3);
    });
  });

  describe('alert triggering', () => {
    it('should create alert when threshold exceeded', async () => {
      await manager.createAlertRule({
        name: 'API Limit',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_exceeded',
        condition: { operator: '>', threshold: 50 },
        severity: 'critical',
      });

      // Record usage that exceeds threshold
      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 100,
      });

      const alerts = await manager.getActiveAlerts(testTeamId);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('quota_exceeded');
      expect(alerts[0].currentValue).toBe(100);
      expect(alerts[0].thresholdValue).toBe(50);
    });

    it('should emit alert.created event', async () => {
      const events: AnalyticsEvent[] = [];
      manager.onAnalyticsEvent((event) => events.push(event));

      await manager.createAlertRule({
        name: 'Test Alert',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 10 },
        severity: 'warning',
      });

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 20,
      });

      expect(events.some((e) => e.type === 'alert.created')).toBe(true);
    });
  });

  describe('getActiveAlerts', () => {
    beforeEach(async () => {
      await manager.createAlertRule({
        name: 'Test Alert',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 10 },
        severity: 'warning',
      });

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 20,
      });
    });

    it('should get active alerts by team', async () => {
      const alerts = await manager.getActiveAlerts(testTeamId);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.every((a) => a.status === 'active')).toBe(true);
    });

    it('should sort alerts by creation date descending', async () => {
      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 30,
      });

      const alerts = await manager.getActiveAlerts(testTeamId);

      for (let i = 1; i < alerts.length; i++) {
        expect(alerts[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          alerts[i].createdAt.getTime()
        );
      }
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      await manager.createAlertRule({
        name: 'Test Alert',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 10 },
        severity: 'warning',
      });

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 20,
      });

      const alerts = await manager.getActiveAlerts(testTeamId);
      const alert = alerts[0];

      const acknowledged = await manager.acknowledgeAlert(alert.id, 'admin-user');

      expect(acknowledged.status).toBe('acknowledged');
      expect(acknowledged.acknowledgedAt).toBeInstanceOf(Date);
      expect(acknowledged.acknowledgedBy).toBe('admin-user');
    });

    it('should throw error for non-existent alert', async () => {
      await expect(manager.acknowledgeAlert('non-existent', 'user')).rejects.toThrow(
        'Alert not found'
      );
    });

    it('should emit alert.acknowledged event', async () => {
      const events: AnalyticsEvent[] = [];
      manager.onAnalyticsEvent((event) => events.push(event));

      await manager.createAlertRule({
        name: 'Test Alert',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 10 },
        severity: 'warning',
      });

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 20,
      });

      const alerts = await manager.getActiveAlerts(testTeamId);
      await manager.acknowledgeAlert(alerts[0].id, 'admin');

      expect(events.some((e) => e.type === 'alert.acknowledged')).toBe(true);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      await manager.createAlertRule({
        name: 'Test Alert',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 10 },
        severity: 'warning',
      });

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 20,
      });

      const alerts = await manager.getActiveAlerts(testTeamId);
      const resolved = await manager.resolveAlert(alerts[0].id);

      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent alert', async () => {
      await expect(manager.resolveAlert('non-existent')).rejects.toThrow('Alert not found');
    });

    it('should emit alert.resolved event', async () => {
      const events: AnalyticsEvent[] = [];
      manager.onAnalyticsEvent((event) => events.push(event));

      await manager.createAlertRule({
        name: 'Test Alert',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 10 },
        severity: 'warning',
      });

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 20,
      });

      const alerts = await manager.getActiveAlerts(testTeamId);
      await manager.resolveAlert(alerts[0].id);

      expect(events.some((e) => e.type === 'alert.resolved')).toBe(true);
    });
  });

  describe('getAlertHistory', () => {
    beforeEach(async () => {
      await manager.createAlertRule({
        name: 'Test Alert',
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator: '>', threshold: 10 },
        severity: 'warning',
      });

      // Create multiple alerts
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 20 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 30 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 40 });
    });

    it('should get alert history', async () => {
      const history = await manager.getAlertHistory(testTeamId);
      expect(history.length).toBe(3);
    });

    it('should limit returned alerts', async () => {
      const history = await manager.getAlertHistory(testTeamId, 2);
      expect(history.length).toBe(2);
    });

    it('should sort by creation date descending', async () => {
      const history = await manager.getAlertHistory(testTeamId);

      for (let i = 1; i < history.length; i++) {
        expect(history[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          history[i].createdAt.getTime()
        );
      }
    });
  });

  // ==================== Real-time Metrics ====================

  describe('getCurrentMetrics', () => {
    beforeEach(async () => {
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 100 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 200 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'token_usage', value: 5000 });
    });

    it('should get current metrics', async () => {
      const metrics = await manager.getCurrentMetrics(testTeamId, ['api_calls', 'token_usage']);

      expect(metrics.get('api_calls')).toBe(300);
      expect(metrics.get('token_usage')).toBe(5000);
    });

    it('should return 0 for metrics with no data', async () => {
      const metrics = await manager.getCurrentMetrics(testTeamId, ['model_calls']);
      expect(metrics.get('model_calls')).toBe(0);
    });
  });

  describe('getMetricTimeSeries', () => {
    beforeEach(async () => {
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 100 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 200 });
      await manager.recordUsage({ teamId: testTeamId, metricType: 'api_calls', value: 150 });
    });

    it('should get metric time series', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const series = await manager.getMetricTimeSeries(
        testTeamId,
        'api_calls',
        weekAgo,
        now,
        'day'
      );

      expect(series.length).toBeGreaterThan(0);
      expect(series[0].timestamp).toBeInstanceOf(Date);
      expect(typeof series[0].value).toBe('number');
    });

    it('should sort time series chronologically', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const series = await manager.getMetricTimeSeries(
        testTeamId,
        'api_calls',
        weekAgo,
        now,
        'day'
      );

      for (let i = 1; i < series.length; i++) {
        expect(series[i].timestamp.getTime()).toBeGreaterThan(series[i - 1].timestamp.getTime());
      }
    });
  });

  // ==================== Events ====================

  describe('onAnalyticsEvent', () => {
    it('should subscribe to events', async () => {
      const events: AnalyticsEvent[] = [];
      const unsubscribe = manager.onAnalyticsEvent((event) => events.push(event));

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 10,
      });

      expect(events.length).toBeGreaterThan(0);

      unsubscribe();
    });

    it('should unsubscribe from events', async () => {
      const events: AnalyticsEvent[] = [];
      const unsubscribe = manager.onAnalyticsEvent((event) => events.push(event));

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 10,
      });

      const countBefore = events.length;
      unsubscribe();

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 20,
      });

      expect(events.length).toBe(countBefore);
    });

    it('should handle multiple subscribers', async () => {
      const events1: AnalyticsEvent[] = [];
      const events2: AnalyticsEvent[] = [];

      manager.onAnalyticsEvent((event) => events1.push(event));
      manager.onAnalyticsEvent((event) => events2.push(event));

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 10,
      });

      expect(events1.length).toBeGreaterThan(0);
      expect(events2.length).toBeGreaterThan(0);
    });
  });

  // ==================== Lifecycle ====================

  describe('dispose', () => {
    it('should dispose manager', async () => {
      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 100,
      });

      manager.dispose();

      await expect(
        manager.recordUsage({
          teamId: testTeamId,
          metricType: 'api_calls',
          value: 100,
        })
      ).rejects.toThrow('UsageAnalyticsManager has been disposed');
    });

    it('should clear all data on dispose', async () => {
      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: 100,
      });

      manager.dispose();

      // Create new manager to verify data was cleared
      const newManager = new UsageAnalyticsManager();
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const records = await newManager.queryUsage({
        teamId: testTeamId,
        startDate: hourAgo,
        endDate: now,
      });

      expect(records.length).toBe(0);
      newManager.dispose();
    });
  });

  // ==================== Alert Condition Operators ====================

  describe('alert condition operators', () => {
    const testConditionOperator = async (
      operator: '>' | '<' | '>=' | '<=' | '==' | 'spike' | 'anomaly',
      threshold: number,
      testValue: number,
      shouldTrigger: boolean
    ) => {
      const manager = new UsageAnalyticsManager();

      await manager.createAlertRule({
        name: `Test ${operator} operator`,
        teamId: testTeamId,
        metricType: 'api_calls',
        alertType: 'quota_warning',
        condition: { operator, threshold },
        severity: 'info',
      });

      await manager.recordUsage({
        teamId: testTeamId,
        metricType: 'api_calls',
        value: testValue,
      });

      const alerts = await manager.getActiveAlerts(testTeamId);
      expect(alerts.length > 0).toBe(shouldTrigger);

      manager.dispose();
    };

    it('should trigger on > operator when value exceeds threshold', async () => {
      await testConditionOperator('>', 100, 150, true);
    });

    it('should not trigger on > operator when value equals threshold', async () => {
      await testConditionOperator('>', 100, 100, false);
    });

    it('should trigger on < operator when value below threshold', async () => {
      await testConditionOperator('<', 100, 50, true);
    });

    it('should trigger on >= operator when value equals threshold', async () => {
      await testConditionOperator('>=', 100, 100, true);
    });

    it('should trigger on <= operator when value equals threshold', async () => {
      await testConditionOperator('<=', 100, 100, true);
    });

    it('should trigger on == operator when value equals threshold', async () => {
      await testConditionOperator('==', 100, 100, true);
    });

    it('should trigger on spike when value exceeds 2x threshold', async () => {
      await testConditionOperator('spike', 100, 250, true);
    });

    it('should trigger on anomaly when value exceeds 3x threshold', async () => {
      await testConditionOperator('anomaly', 100, 350, true);
    });
  });
});
