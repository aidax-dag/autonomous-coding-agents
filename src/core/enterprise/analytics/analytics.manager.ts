/**
 * Usage Analytics Manager Implementation
 *
 * Feature: F5.13 - Usage Analytics
 * Provides usage tracking, analytics aggregation, and reporting
 *
 * @module core/enterprise/analytics
 */

import { randomUUID } from 'crypto';
import type {
  IUsageAnalyticsManager,
  UsageRecord,
  AggregatedUsage,
  UsageSummary,
  MetricSummary,
  UsageReport,
  UsageAlert,
  AlertRule,
  CostEstimate,
  CostLineItem,
  AnalyticsEvent,
  AnalyticsEventType,
  MetricType,
  AggregationPeriod,
  RecordUsageRequest,
  QueryUsageRequest,
  GenerateReportRequest,
  CreateAlertRuleRequest,
  ReportData,
  ChartData,
  TableData,
} from './analytics.interface.js';
import { DEFAULT_PRICING, DEFAULT_METRIC_UNITS } from './analytics.interface.js';

/**
 * Usage Analytics Manager implementation
 */
export class UsageAnalyticsManager implements IUsageAnalyticsManager {
  private usageRecords: Map<string, UsageRecord> = new Map();
  private reports: Map<string, UsageReport> = new Map();
  private alerts: Map<string, UsageAlert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private eventHandlers: Set<(event: AnalyticsEvent) => void> = new Set();
  private disposed = false;

  // ==================== Usage Tracking ====================

  async recordUsage(request: RecordUsageRequest): Promise<UsageRecord> {
    this.ensureNotDisposed();

    const record: UsageRecord = {
      id: randomUUID(),
      teamId: request.teamId,
      userId: request.userId,
      metricType: request.metricType,
      value: request.value,
      unit: request.unit || DEFAULT_METRIC_UNITS[request.metricType],
      timestamp: new Date(),
      metadata: request.metadata,
    };

    this.usageRecords.set(record.id, record);

    this.emitEvent('usage.recorded', request.teamId, { record });

    // Check alert rules
    await this.checkAlertRules(request.teamId, request.metricType, request.value);

    return record;
  }

  async recordUsageBatch(requests: RecordUsageRequest[]): Promise<UsageRecord[]> {
    this.ensureNotDisposed();

    const records: UsageRecord[] = [];
    for (const request of requests) {
      const record = await this.recordUsage(request);
      records.push(record);
    }

    return records;
  }

  async queryUsage(request: QueryUsageRequest): Promise<UsageRecord[]> {
    this.ensureNotDisposed();

    let records = Array.from(this.usageRecords.values()).filter(
      (r) =>
        r.teamId === request.teamId &&
        r.timestamp >= request.startDate &&
        r.timestamp <= request.endDate
    );

    if (request.metricTypes && request.metricTypes.length > 0) {
      records = records.filter((r) => request.metricTypes!.includes(r.metricType));
    }

    if (request.userId) {
      records = records.filter((r) => r.userId === request.userId);
    }

    return records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAggregatedUsage(request: QueryUsageRequest): Promise<AggregatedUsage[]> {
    this.ensureNotDisposed();

    const records = await this.queryUsage(request);
    const aggregations: AggregatedUsage[] = [];

    // Group by metric type and period
    const groups = new Map<string, UsageRecord[]>();

    for (const record of records) {
      const periodKey = this.getPeriodKey(record.timestamp, request.aggregation || 'day');
      const key = `${record.metricType}-${periodKey}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Aggregate each group
    for (const [key, groupRecords] of groups.entries()) {
      const [metricType] = key.split('-');
      const values = groupRecords.map((r) => r.value);
      const total = values.reduce((sum, v) => sum + v, 0);

      const { start, end } = this.getPeriodBounds(
        groupRecords[0].timestamp,
        request.aggregation || 'day'
      );

      aggregations.push({
        teamId: request.teamId,
        metricType: metricType as MetricType,
        period: request.aggregation || 'day',
        periodStart: start,
        periodEnd: end,
        total,
        average: total / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
        unit: groupRecords[0].unit,
      });
    }

    return aggregations;
  }

  async getUsageSummary(teamId: string, period: AggregationPeriod): Promise<UsageSummary> {
    this.ensureNotDisposed();

    const { start, end } = this.getCurrentPeriodBounds(period);
    const { start: prevStart, end: prevEnd } = this.getPreviousPeriodBounds(period);

    // Get current period records
    const currentRecords = await this.queryUsage({
      teamId,
      startDate: start,
      endDate: end,
    });

    // Get previous period records
    const previousRecords = await this.queryUsage({
      teamId,
      startDate: prevStart,
      endDate: prevEnd,
    });

    // Build metric summaries
    const metrics = {
      apiCalls: this.buildMetricSummary(currentRecords, previousRecords, 'api_calls'),
      agentHours: this.buildMetricSummary(currentRecords, previousRecords, 'agent_hours'),
      workflowRuns: this.buildMetricSummary(currentRecords, previousRecords, 'workflow_runs'),
      storageBytes: this.buildMetricSummary(currentRecords, previousRecords, 'storage_bytes'),
      tokenUsage: this.buildMetricSummary(currentRecords, previousRecords, 'token_usage'),
      modelCalls: this.buildMetricSummary(currentRecords, previousRecords, 'model_calls'),
    };

    // Calculate estimated cost
    const estimatedCost = this.calculateCost(currentRecords);

    return {
      teamId,
      period,
      periodStart: start,
      periodEnd: end,
      metrics,
      estimatedCost,
      currency: 'USD',
      generatedAt: new Date(),
    };
  }

  // ==================== Reports ====================

  async generateReport(request: GenerateReportRequest): Promise<UsageReport> {
    this.ensureNotDisposed();

    const records = await this.queryUsage({
      teamId: request.teamId,
      startDate: request.periodStart,
      endDate: request.periodEnd,
    });

    const data = this.buildReportData(request, records);

    const report: UsageReport = {
      id: randomUUID(),
      name: request.name || `${request.type} Report`,
      type: request.type,
      teamId: request.teamId,
      period: request.period,
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
      data,
      format: request.format || 'json',
      generatedAt: new Date(),
    };

    this.reports.set(report.id, report);

    this.emitEvent('report.generated', request.teamId, { reportId: report.id });

    return report;
  }

  async getReport(reportId: string): Promise<UsageReport | undefined> {
    this.ensureNotDisposed();
    return this.reports.get(reportId);
  }

  async getReports(teamId: string, limit = 10): Promise<UsageReport[]> {
    this.ensureNotDisposed();

    return Array.from(this.reports.values())
      .filter((r) => r.teamId === teamId)
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
      .slice(0, limit);
  }

  async deleteReport(reportId: string): Promise<boolean> {
    this.ensureNotDisposed();
    return this.reports.delete(reportId);
  }

  // ==================== Cost Analysis ====================

  async getCostEstimate(teamId: string, period: AggregationPeriod): Promise<CostEstimate> {
    this.ensureNotDisposed();

    const { start, end } = this.getCurrentPeriodBounds(period);

    const records = await this.queryUsage({
      teamId,
      startDate: start,
      endDate: end,
    });

    const lineItems = this.buildCostLineItems(records);
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);

    return {
      teamId,
      period,
      periodStart: start,
      periodEnd: end,
      lineItems,
      subtotal,
      discounts: 0,
      total: subtotal,
      currency: 'USD',
      calculatedAt: new Date(),
    };
  }

  async getCostTrends(
    teamId: string,
    periods: number,
    period: AggregationPeriod
  ): Promise<CostEstimate[]> {
    this.ensureNotDisposed();

    const estimates: CostEstimate[] = [];
    let currentEnd = new Date();

    for (let i = 0; i < periods; i++) {
      const { start, end } = this.getPeriodBoundsFromEnd(currentEnd, period);

      const records = await this.queryUsage({
        teamId,
        startDate: start,
        endDate: end,
      });

      const lineItems = this.buildCostLineItems(records);
      const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);

      estimates.push({
        teamId,
        period,
        periodStart: start,
        periodEnd: end,
        lineItems,
        subtotal,
        discounts: 0,
        total: subtotal,
        currency: 'USD',
        calculatedAt: new Date(),
      });

      currentEnd = new Date(start.getTime() - 1);
    }

    return estimates.reverse();
  }

  // ==================== Alerts ====================

  async createAlertRule(request: CreateAlertRuleRequest): Promise<AlertRule> {
    this.ensureNotDisposed();

    const now = new Date();
    const rule: AlertRule = {
      id: randomUUID(),
      name: request.name,
      teamId: request.teamId,
      metricType: request.metricType,
      alertType: request.alertType,
      condition: request.condition,
      severity: request.severity,
      notificationChannels: request.notificationChannels || [],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    this.alertRules.set(rule.id, rule);

    return rule;
  }

  async getAlertRule(ruleId: string): Promise<AlertRule | undefined> {
    this.ensureNotDisposed();
    return this.alertRules.get(ruleId);
  }

  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    this.ensureNotDisposed();

    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error('Alert rule not found');
    }

    const updatedRule: AlertRule = {
      ...rule,
      ...updates,
      id: rule.id, // Prevent ID change
      createdAt: rule.createdAt, // Prevent creation date change
      updatedAt: new Date(),
    };

    this.alertRules.set(ruleId, updatedRule);

    return updatedRule;
  }

  async deleteAlertRule(ruleId: string): Promise<boolean> {
    this.ensureNotDisposed();
    return this.alertRules.delete(ruleId);
  }

  async getAlertRules(teamId?: string): Promise<AlertRule[]> {
    this.ensureNotDisposed();

    let rules = Array.from(this.alertRules.values());

    if (teamId !== undefined) {
      rules = rules.filter((r) => r.teamId === teamId || r.teamId === undefined);
    }

    return rules;
  }

  async getActiveAlerts(teamId?: string): Promise<UsageAlert[]> {
    this.ensureNotDisposed();

    let alerts = Array.from(this.alerts.values()).filter((a) => a.status === 'active');

    if (teamId !== undefined) {
      alerts = alerts.filter((a) => a.teamId === teamId);
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<UsageAlert> {
    this.ensureNotDisposed();

    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.alerts.set(alertId, alert);

    this.emitEvent('alert.acknowledged', alert.teamId, { alertId, acknowledgedBy });

    return alert;
  }

  async resolveAlert(alertId: string): Promise<UsageAlert> {
    this.ensureNotDisposed();

    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    this.alerts.set(alertId, alert);

    this.emitEvent('alert.resolved', alert.teamId, { alertId });

    return alert;
  }

  async getAlertHistory(teamId: string, limit = 50): Promise<UsageAlert[]> {
    this.ensureNotDisposed();

    return Array.from(this.alerts.values())
      .filter((a) => a.teamId === teamId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // ==================== Real-time Metrics ====================

  async getCurrentMetrics(
    teamId: string,
    metricTypes: MetricType[]
  ): Promise<Map<MetricType, number>> {
    this.ensureNotDisposed();

    const result = new Map<MetricType, number>();
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const records = await this.queryUsage({
      teamId,
      metricTypes,
      startDate: hourAgo,
      endDate: now,
    });

    for (const metricType of metricTypes) {
      const metricRecords = records.filter((r) => r.metricType === metricType);
      const total = metricRecords.reduce((sum, r) => sum + r.value, 0);
      result.set(metricType, total);
    }

    return result;
  }

  async getMetricTimeSeries(
    teamId: string,
    metricType: MetricType,
    startDate: Date,
    endDate: Date,
    granularity: AggregationPeriod
  ): Promise<{ timestamp: Date; value: number }[]> {
    this.ensureNotDisposed();

    const aggregations = await this.getAggregatedUsage({
      teamId,
      metricTypes: [metricType],
      startDate,
      endDate,
      aggregation: granularity,
    });

    return aggregations
      .filter((a) => a.metricType === metricType)
      .map((a) => ({
        timestamp: a.periodStart,
        value: a.total,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // ==================== Events ====================

  onAnalyticsEvent(handler: (event: AnalyticsEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  // ==================== Lifecycle ====================

  dispose(): void {
    this.disposed = true;
    this.usageRecords.clear();
    this.reports.clear();
    this.alerts.clear();
    this.alertRules.clear();
    this.eventHandlers.clear();
  }

  // ==================== Private Helpers ====================

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('UsageAnalyticsManager has been disposed');
    }
  }

  private emitEvent(
    type: AnalyticsEventType,
    teamId: string | undefined,
    data: Record<string, unknown>
  ): void {
    const event: AnalyticsEvent = {
      type,
      teamId,
      data,
      timestamp: new Date(),
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  private async checkAlertRules(
    teamId: string,
    metricType: MetricType,
    value: number
  ): Promise<void> {
    const rules = await this.getAlertRules(teamId);

    for (const rule of rules) {
      if (!rule.enabled || rule.metricType !== metricType) {
        continue;
      }

      const shouldAlert = this.evaluateCondition(rule.condition, value);

      if (shouldAlert) {
        await this.createAlert(teamId, rule, value);
      }
    }
  }

  private evaluateCondition(
    condition: AlertRule['condition'],
    value: number
  ): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      case 'spike':
        // Simplified spike detection - in reality would compare to historical baseline
        return value > condition.threshold * 2;
      case 'anomaly':
        // Simplified anomaly detection
        return value > condition.threshold * 3;
      default:
        return false;
    }
  }

  private async createAlert(teamId: string, rule: AlertRule, value: number): Promise<void> {
    const alert: UsageAlert = {
      id: randomUUID(),
      teamId,
      type: rule.alertType,
      severity: rule.severity,
      status: 'active',
      message: `${rule.name}: ${rule.metricType} value (${value}) ${rule.condition.operator} threshold (${rule.condition.threshold})`,
      metricType: rule.metricType,
      currentValue: value,
      thresholdValue: rule.condition.threshold,
      unit: DEFAULT_METRIC_UNITS[rule.metricType],
      createdAt: new Date(),
    };

    this.alerts.set(alert.id, alert);

    this.emitEvent('alert.created', teamId, { alert });
    this.emitEvent('threshold.exceeded', teamId, {
      metricType: rule.metricType,
      value,
      threshold: rule.condition.threshold,
    });
  }

  private getPeriodKey(date: Date, period: AggregationPeriod): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');

    switch (period) {
      case 'hour':
        return `${year}-${month}-${day}-${hour}`;
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week':
        const weekNum = this.getWeekNumber(date);
        return `${year}-W${weekNum}`;
      case 'month':
        return `${year}-${month}`;
      case 'quarter':
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        return `${year}-Q${quarter}`;
      case 'year':
        return `${year}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  private getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    return Math.ceil((diff / (1000 * 60 * 60 * 24) + start.getDay() + 1) / 7);
  }

  private getPeriodBounds(date: Date, period: AggregationPeriod): { start: Date; end: Date } {
    const start = new Date(date);
    const end = new Date(date);

    switch (period) {
      case 'hour':
        start.setMinutes(0, 0, 0);
        end.setMinutes(59, 59, 999);
        break;
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        const quarter = Math.floor(start.getMonth() / 3);
        start.setMonth(quarter * 3, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(quarter * 3 + 3, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'year':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  private getCurrentPeriodBounds(period: AggregationPeriod): { start: Date; end: Date } {
    return this.getPeriodBounds(new Date(), period);
  }

  private getPreviousPeriodBounds(period: AggregationPeriod): { start: Date; end: Date } {
    const now = new Date();
    let referenceDate: Date;

    switch (period) {
      case 'hour':
        referenceDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        referenceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        referenceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        referenceDate = new Date(now);
        referenceDate.setMonth(referenceDate.getMonth() - 1);
        break;
      case 'quarter':
        referenceDate = new Date(now);
        referenceDate.setMonth(referenceDate.getMonth() - 3);
        break;
      case 'year':
        referenceDate = new Date(now);
        referenceDate.setFullYear(referenceDate.getFullYear() - 1);
        break;
      default:
        referenceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return this.getPeriodBounds(referenceDate, period);
  }

  private getPeriodBoundsFromEnd(endDate: Date, period: AggregationPeriod): { start: Date; end: Date } {
    return this.getPeriodBounds(endDate, period);
  }

  private buildMetricSummary(
    currentRecords: UsageRecord[],
    previousRecords: UsageRecord[],
    metricType: MetricType
  ): MetricSummary {
    const current = currentRecords
      .filter((r) => r.metricType === metricType)
      .reduce((sum, r) => sum + r.value, 0);

    const previous = previousRecords
      .filter((r) => r.metricType === metricType)
      .reduce((sum, r) => sum + r.value, 0);

    const changePercent = previous > 0 ? ((current - previous) / previous) * 100 : 0;

    let trend: 'up' | 'down' | 'stable';
    if (changePercent > 5) {
      trend = 'up';
    } else if (changePercent < -5) {
      trend = 'down';
    } else {
      trend = 'stable';
    }

    return {
      current,
      previous,
      changePercent,
      trend,
      unit: DEFAULT_METRIC_UNITS[metricType],
    };
  }

  private calculateCost(records: UsageRecord[]): number {
    let total = 0;

    for (const record of records) {
      const pricing = DEFAULT_PRICING[record.metricType];
      total += record.value * pricing.price;
    }

    return Math.round(total * 100) / 100;
  }

  private buildCostLineItems(records: UsageRecord[]): CostLineItem[] {
    const grouped = new Map<MetricType, number>();

    for (const record of records) {
      const current = grouped.get(record.metricType) || 0;
      grouped.set(record.metricType, current + record.value);
    }

    const lineItems: CostLineItem[] = [];

    for (const [metricType, quantity] of grouped.entries()) {
      const pricing = DEFAULT_PRICING[metricType];
      lineItems.push({
        description: this.getMetricDescription(metricType),
        metricType,
        quantity,
        unit: pricing.unit,
        unitPrice: pricing.price,
        totalPrice: Math.round(quantity * pricing.price * 100) / 100,
      });
    }

    return lineItems;
  }

  private getMetricDescription(metricType: MetricType): string {
    const descriptions: Record<MetricType, string> = {
      api_calls: 'API Calls',
      agent_hours: 'Agent Hours',
      workflow_runs: 'Workflow Executions',
      storage_bytes: 'Storage',
      token_usage: 'Token Usage',
      model_calls: 'Model API Calls',
      team_members: 'Team Members',
      projects: 'Projects',
      repositories: 'Repositories',
    };
    return descriptions[metricType];
  }

  private buildReportData(request: GenerateReportRequest, records: UsageRecord[]): ReportData {
    const summary: Record<string, unknown> = {
      teamId: request.teamId,
      period: request.period,
      totalRecords: records.length,
      generatedAt: new Date().toISOString(),
    };

    const sections: ReportData['sections'] = [];
    const charts: ChartData[] = [];
    const tables: TableData[] = [];

    // Build metric summary
    const metricTotals = new Map<MetricType, number>();
    for (const record of records) {
      const current = metricTotals.get(record.metricType) || 0;
      metricTotals.set(record.metricType, current + record.value);
    }

    summary.metrics = Object.fromEntries(metricTotals);

    // Build chart data if requested
    if (request.includeCharts) {
      // Time series chart
      const timeSeriesData: Map<string, Map<MetricType, number>> = new Map();

      for (const record of records) {
        const dateKey = record.timestamp.toISOString().split('T')[0];
        if (!timeSeriesData.has(dateKey)) {
          timeSeriesData.set(dateKey, new Map());
        }
        const dayData = timeSeriesData.get(dateKey)!;
        const current = dayData.get(record.metricType) || 0;
        dayData.set(record.metricType, current + record.value);
      }

      const series: ChartData['series'] = [];
      const metricTypes = new Set(records.map((r) => r.metricType));

      for (const metricType of metricTypes) {
        const data: { x: string; y: number }[] = [];
        for (const [date, dayData] of Array.from(timeSeriesData.entries()).sort()) {
          data.push({
            x: date,
            y: dayData.get(metricType) || 0,
          });
        }
        series.push({ name: metricType, data });
      }

      charts.push({
        title: 'Usage Over Time',
        type: 'line',
        series,
        xAxisLabel: 'Date',
        yAxisLabel: 'Usage',
      });
    }

    // Build summary table
    tables.push({
      title: 'Usage Summary',
      headers: ['Metric', 'Total', 'Unit'],
      rows: Array.from(metricTotals.entries()).map(([metric, total]) => [
        this.getMetricDescription(metric),
        total,
        DEFAULT_METRIC_UNITS[metric],
      ]),
    });

    return {
      summary,
      sections,
      charts,
      tables,
    };
  }
}
