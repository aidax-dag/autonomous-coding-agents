/**
 * Alert System
 *
 * Monitors quality thresholds and sends notifications for important events.
 * Supports configurable alert rules with multiple notification channels.
 *
 * Feature: Metrics System (Phase 3.2)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MetricsCollector } from './metrics-collector';
import { QualityDashboard } from './quality-dashboard';

// ============================================================================
// Types
// ============================================================================

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

/**
 * Alert status
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'silenced';

/**
 * Comparison operator for rules
 */
export type ComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

/**
 * Alert rule configuration
 */
export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metricName: string;
  operator: ComparisonOperator;
  threshold: number;
  severity: AlertSeverity;
  duration?: number; // How long condition must be true (ms)
  cooldown?: number; // Minimum time between alerts (ms)
  enabled: boolean;
  labels?: Record<string, string>;
  notifications?: NotificationChannel[];
}

/**
 * Notification channel types
 */
export type NotificationChannelType = 'console' | 'callback' | 'webhook' | 'email';

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  type: NotificationChannelType;
  config?: Record<string, unknown>;
  callback?: (alert: Alert) => Promise<void>;
}

/**
 * Alert instance
 */
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metricName: string;
  metricValue: number;
  threshold: number;
  labels?: Record<string, string>;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
}

/**
 * Alert history entry
 */
export interface AlertHistoryEntry {
  alert: Alert;
  notificationsSent: number;
  resolutionTime?: number; // ms from trigger to resolution
}

/**
 * Alert system configuration
 */
export interface AlertSystemConfig {
  /** System name */
  name?: string;
  /** Check interval in ms */
  checkInterval?: number;
  /** Default cooldown in ms */
  defaultCooldown?: number;
  /** Maximum active alerts */
  maxActiveAlerts?: number;
  /** History retention count */
  maxHistoryEntries?: number;
  /** Auto-resolve timeout in ms */
  autoResolveTimeout?: number;
  /** Enable console notifications */
  enableConsoleNotifications?: boolean;
}

/**
 * Alert system events
 */
export interface AlertSystemEvents {
  'alert:triggered': (alert: Alert) => void;
  'alert:acknowledged': (alert: Alert) => void;
  'alert:resolved': (alert: Alert) => void;
  'alert:silenced': (alert: Alert) => void;
  'rule:added': (rule: AlertRule) => void;
  'rule:removed': (ruleId: string) => void;
  'notification:sent': (alert: Alert, channel: NotificationChannelType) => void;
  'notification:failed': (alert: Alert, channel: NotificationChannelType, error: Error) => void;
}

/**
 * Alert system statistics
 */
export interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  alertsByRule: Record<string, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  averageResolutionTime?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_ALERT_CONFIG: Required<AlertSystemConfig> = {
  name: 'alert-system',
  checkInterval: 30000, // 30 seconds
  defaultCooldown: 300000, // 5 minutes
  maxActiveAlerts: 100,
  maxHistoryEntries: 1000,
  autoResolveTimeout: 3600000, // 1 hour
  enableConsoleNotifications: true,
};

// ============================================================================
// Alert System Implementation
// ============================================================================

/**
 * Alert System
 *
 * Monitors metrics and triggers alerts based on configured rules.
 */
export class AlertSystem extends EventEmitter {
  private config: Required<AlertSystemConfig>;
  private collector: MetricsCollector;
  private dashboard?: QualityDashboard;
  private rules: Map<string, AlertRule>;
  private activeAlerts: Map<string, Alert>;
  private history: AlertHistoryEntry[];
  private lastTriggered: Map<string, Date>;
  private checkTimer?: ReturnType<typeof setInterval>;
  private started: boolean;

  constructor(
    collector: MetricsCollector,
    dashboard?: QualityDashboard,
    config: AlertSystemConfig = {}
  ) {
    super();

    this.collector = collector;
    this.dashboard = dashboard;
    this.config = {
      ...DEFAULT_ALERT_CONFIG,
      ...config,
    };

    this.rules = new Map();
    this.activeAlerts = new Map();
    this.history = [];
    this.lastTriggered = new Map();
    this.started = false;

    // Connect to dashboard events if available
    if (this.dashboard) {
      this.dashboard.on('threshold:crossed', (dimension, score, threshold) => {
        this.handleThresholdCrossed(dimension, score, threshold);
      });
    }
  }

  // ==========================================================================
  // Rule Management
  // ==========================================================================

  /**
   * Add an alert rule
   */
  addRule(rule: Omit<AlertRule, 'id'>): string {
    const id = uuidv4();
    const fullRule: AlertRule = {
      ...rule,
      id,
      cooldown: rule.cooldown || this.config.defaultCooldown,
      enabled: rule.enabled ?? true,
    };

    this.rules.set(id, fullRule);
    this.emit('rule:added', fullRule);

    return id;
  }

  /**
   * Update an existing rule
   */
  updateRule(id: string, updates: Partial<Omit<AlertRule, 'id'>>): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    const updatedRule: AlertRule = {
      ...rule,
      ...updates,
      id: rule.id,
    };

    this.rules.set(id, updatedRule);
    return true;
  }

  /**
   * Remove a rule
   */
  removeRule(id: string): boolean {
    const removed = this.rules.delete(id);
    if (removed) {
      this.emit('rule:removed', id);
    }
    return removed;
  }

  /**
   * Get a rule by ID
   */
  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  /**
   * List all rules
   */
  listRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Enable a rule
   */
  enableRule(id: string): boolean {
    return this.updateRule(id, { enabled: true });
  }

  /**
   * Disable a rule
   */
  disableRule(id: string): boolean {
    return this.updateRule(id, { enabled: false });
  }

  // ==========================================================================
  // Monitoring
  // ==========================================================================

  /**
   * Start monitoring
   */
  start(): void {
    if (this.started) return;

    this.started = true;

    this.checkTimer = setInterval(() => {
      this.checkRules().catch(() => {
        // Ignore check errors in background
      });
    }, this.config.checkInterval);

    // Initial check
    this.checkRules().catch(() => {
      // Ignore initial check errors
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.started = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  /**
   * Check all rules
   */
  async checkRules(): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        await this.checkRule(rule);
      } catch (_error) {
        // Continue checking other rules
      }
    }

    // Auto-resolve old alerts
    this.autoResolveAlerts();
  }

  /**
   * Check a single rule
   */
  private async checkRule(rule: AlertRule): Promise<void> {
    // Get current metric value
    const result = this.collector.aggregate({
      metricName: rule.metricName,
      aggregation: 'avg',
      labels: rule.labels,
    });

    const value = result.value;

    // Check condition
    const triggered = this.evaluateCondition(value, rule.operator, rule.threshold);

    if (triggered) {
      // Check cooldown - only applies to triggering new alerts
      const lastTrigger = this.lastTriggered.get(rule.id);
      if (lastTrigger && rule.cooldown) {
        const elapsed = Date.now() - lastTrigger.getTime();
        if (elapsed < rule.cooldown) return;
      }

      // Check if already active
      const existingAlert = Array.from(this.activeAlerts.values()).find(
        a => a.ruleId === rule.id && a.status === 'active'
      );

      if (!existingAlert) {
        await this.triggerAlert(rule, value);
      }
    } else {
      // Auto-resolve if condition no longer true
      // Collect IDs first to avoid modifying map during iteration
      const alertsToResolve = Array.from(this.activeAlerts.values())
        .filter(alert => alert.ruleId === rule.id && alert.status === 'active')
        .map(alert => alert.id);

      for (const alertId of alertsToResolve) {
        this.resolveAlert(alertId, 'Auto-resolved: condition no longer true');
      }
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(value: number, operator: ComparisonOperator, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'neq': return value !== threshold;
      default: return false;
    }
  }

  /**
   * Handle threshold crossed from dashboard
   */
  private handleThresholdCrossed(dimension: string, score: number, threshold: number): void {
    // Create or find a rule for this dimension
    const existingRule = Array.from(this.rules.values()).find(
      r => r.name === `${dimension} Threshold`
    );

    if (existingRule) {
      this.checkRule(existingRule).catch(() => {});
    } else {
      // Create an implicit rule
      const ruleId = this.addRule({
        name: `${dimension} Threshold`,
        metricName: dimension.toLowerCase().replace(/\s+/g, '_'),
        operator: 'lt',
        threshold,
        severity: 'critical',
        enabled: true,
      });

      const rule = this.getRule(ruleId);
      if (rule) {
        this.triggerAlert(rule, score).catch(() => {});
      }
    }
  }

  // ==========================================================================
  // Alert Management
  // ==========================================================================

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, value: number): Promise<Alert> {
    const alert: Alert = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: 'active',
      message: this.formatAlertMessage(rule, value),
      metricName: rule.metricName,
      metricValue: value,
      threshold: rule.threshold,
      labels: rule.labels,
      triggeredAt: new Date(),
    };

    // Enforce max active alerts
    if (this.activeAlerts.size >= this.config.maxActiveAlerts) {
      this.evictOldestAlert();
    }

    this.activeAlerts.set(alert.id, alert);
    this.lastTriggered.set(rule.id, new Date());

    this.emit('alert:triggered', alert);

    // Send notifications
    await this.sendNotifications(alert, rule.notifications);

    return alert;
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(rule: AlertRule, value: number): string {
    const opText = this.getOperatorText(rule.operator);
    return `${rule.name}: ${rule.metricName} is ${value.toFixed(2)} (${opText} ${rule.threshold})`;
  }

  /**
   * Get human-readable operator text
   */
  private getOperatorText(operator: ComparisonOperator): string {
    switch (operator) {
      case 'gt': return 'greater than';
      case 'gte': return 'greater than or equal to';
      case 'lt': return 'less than';
      case 'lte': return 'less than or equal to';
      case 'eq': return 'equal to';
      case 'neq': return 'not equal to';
      default: return operator;
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.status !== 'active') return false;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.emit('alert:acknowledged', alert);

    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, _resolution?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    // Move to history
    this.addToHistory(alert);
    this.activeAlerts.delete(alertId);

    this.emit('alert:resolved', alert);

    return true;
  }

  /**
   * Silence an alert
   */
  silenceAlert(alertId: string, duration?: number): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.status = 'silenced';

    this.emit('alert:silenced', alert);

    // Auto-unsilence after duration
    if (duration) {
      setTimeout(() => {
        if (this.activeAlerts.get(alertId)?.status === 'silenced') {
          alert.status = 'active';
        }
      }, duration);
    }

    return true;
  }

  /**
   * Get an alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.activeAlerts.get(alertId);
  }

  /**
   * List active alerts
   */
  listActiveAlerts(severity?: AlertSeverity): Alert[] {
    let alerts = Array.from(this.activeAlerts.values());

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  /**
   * Get alert history
   */
  getHistory(limit?: number): AlertHistoryEntry[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert, channels?: NotificationChannel[]): Promise<number> {
    let sent = 0;

    // Default console notification
    if (this.config.enableConsoleNotifications) {
      this.logAlert(alert);
      sent++;
    }

    if (!channels) return sent;

    for (const channel of channels) {
      try {
        await this.sendToChannel(alert, channel);
        this.emit('notification:sent', alert, channel.type);
        sent++;
      } catch (error) {
        this.emit('notification:failed', alert, channel.type, error as Error);
      }
    }

    return sent;
  }

  /**
   * Send to a specific channel
   */
  private async sendToChannel(alert: Alert, channel: NotificationChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        this.logAlert(alert);
        break;

      case 'callback':
        if (channel.callback) {
          await channel.callback(alert);
        }
        break;

      case 'webhook':
        // Webhook implementation would go here
        break;

      case 'email':
        // Email implementation would go here
        break;
    }
  }

  /**
   * Log alert to console
   */
  private logAlert(alert: Alert): void {
    const prefix = this.getSeverityPrefix(alert.severity);
    console.log(`${prefix} [ALERT] ${alert.message}`);
  }

  /**
   * Get severity prefix for logging
   */
  private getSeverityPrefix(severity: AlertSeverity): string {
    switch (severity) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'critical': return '🔴';
      case 'emergency': return '🚨';
      default: return '•';
    }
  }

  // ==========================================================================
  // Maintenance
  // ==========================================================================

  /**
   * Auto-resolve old alerts
   */
  private autoResolveAlerts(): void {
    const cutoff = new Date(Date.now() - this.config.autoResolveTimeout);

    for (const alert of this.activeAlerts.values()) {
      if (alert.status === 'active' && alert.triggeredAt < cutoff) {
        this.resolveAlert(alert.id, 'Auto-resolved: timeout');
      }
    }
  }

  /**
   * Evict oldest alert
   */
  private evictOldestAlert(): void {
    let oldest: Alert | undefined;

    for (const alert of this.activeAlerts.values()) {
      if (!oldest || alert.triggeredAt < oldest.triggeredAt) {
        oldest = alert;
      }
    }

    if (oldest) {
      this.resolveAlert(oldest.id, 'Evicted: max alerts reached');
    }
  }

  /**
   * Add alert to history
   */
  private addToHistory(alert: Alert): void {
    const entry: AlertHistoryEntry = {
      alert,
      notificationsSent: 1,
      resolutionTime: alert.resolvedAt
        ? alert.resolvedAt.getTime() - alert.triggeredAt.getTime()
        : undefined,
    };

    this.history.push(entry);

    // Enforce max history
    while (this.history.length > this.config.maxHistoryEntries) {
      this.history.shift();
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.activeAlerts.clear();
    this.history = [];
    this.lastTriggered.clear();
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get alert statistics
   */
  getStats(): AlertStats {
    const alertsByRule: Record<string, number> = {};
    const alertsBySeverity: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      critical: 0,
      emergency: 0,
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    // Count active alerts
    for (const alert of this.activeAlerts.values()) {
      alertsByRule[alert.ruleId] = (alertsByRule[alert.ruleId] || 0) + 1;
      alertsBySeverity[alert.severity]++;
    }

    // Count historical alerts
    for (const entry of this.history) {
      alertsByRule[entry.alert.ruleId] = (alertsByRule[entry.alert.ruleId] || 0) + 1;
      alertsBySeverity[entry.alert.severity]++;

      if (entry.resolutionTime) {
        totalResolutionTime += entry.resolutionTime;
        resolvedCount++;
      }
    }

    const activeAlerts = Array.from(this.activeAlerts.values());

    return {
      totalAlerts: this.activeAlerts.size + this.history.length,
      activeAlerts: activeAlerts.filter(a => a.status === 'active').length,
      acknowledgedAlerts: activeAlerts.filter(a => a.status === 'acknowledged').length,
      resolvedAlerts: this.history.length,
      alertsByRule,
      alertsBySeverity,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : undefined,
    };
  }

  /**
   * Get system name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Check if system is running
   */
  get isRunning(): boolean {
    return this.started;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an alert system instance
 */
export function createAlertSystem(
  collector: MetricsCollector,
  dashboard?: QualityDashboard,
  config: AlertSystemConfig = {}
): AlertSystem {
  return new AlertSystem(collector, dashboard, config);
}
