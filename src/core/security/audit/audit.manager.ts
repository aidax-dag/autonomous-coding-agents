/**
 * Audit Manager Implementation
 *
 * Feature: F5.4 - Audit Logging
 * Comprehensive audit logging with alerting and retention
 *
 * @module core/security/audit
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../../services/logger.js';
import type {
  IAuditManager,
  AuditEvent,
  AuditActor,
  AuditTarget,
  AuditError,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  AuditFilter,
  AuditQueryOptions,
  AuditQueryResult,
  AuditStatistics,
  AuditRetentionPolicy,
  AuditExportOptions,
  AuditExportData,
  AuditAlertConfig,
  AuditAlert,
  AuditAlertCondition,
} from './audit.interface.js';

const logger = createLogger('AuditManager');

/**
 * Default retention policy
 */
const DEFAULT_RETENTION_POLICY: AuditRetentionPolicy = {
  maxEvents: 100000,
  maxAgeDays: 90,
  severityRetention: {
    debug: 7,
    info: 30,
    warning: 60,
    error: 90,
    critical: 365,
  },
  archiveBeforeDelete: false,
};

/**
 * Audit Manager implementation
 */
export class AuditManager implements IAuditManager {
  private events: Map<string, AuditEvent> = new Map();
  private eventsByTimestamp: AuditEvent[] = [];
  private alertConfigs: Map<string, AuditAlertConfig> = new Map();
  private alerts: Map<string, AuditAlert> = new Map();
  private retentionPolicy: AuditRetentionPolicy = { ...DEFAULT_RETENTION_POLICY };
  private eventHandlers: Set<(event: AuditEvent) => void> = new Set();
  private alertHandlers: Set<(alert: AuditAlert) => void> = new Set();
  private recentEventCounts: Map<string, number> = new Map(); // For rate-based alerts
  private disposed = false;

  constructor() {
    logger.info('AuditManager initialized');
  }

  // ==================== Event Logging ====================

  log(
    eventData: Omit<AuditEvent, 'id' | 'timestamp'> & Partial<Pick<AuditEvent, 'id' | 'timestamp'>>
  ): AuditEvent {
    const event: AuditEvent = {
      ...eventData,
      id: eventData.id || randomUUID(),
      timestamp: eventData.timestamp || new Date(),
    };

    // Store event
    this.events.set(event.id, event);
    this.insertByTimestamp(event);

    // Update rate counters for alerting
    this.updateRateCounters(event);

    // Check alerts
    this.checkAlerts(event);

    // Notify handlers
    this.notifyEventHandlers(event);

    // Log at appropriate level
    this.logEventToLogger(event);

    return event;
  }

  /**
   * Insert event maintaining timestamp order
   */
  private insertByTimestamp(event: AuditEvent): void {
    // For simplicity, append and sort (in production, use binary insert)
    this.eventsByTimestamp.push(event);
    // Keep sorted by timestamp descending (newest first)
    if (this.eventsByTimestamp.length > 1) {
      const lastEvent = this.eventsByTimestamp[this.eventsByTimestamp.length - 2];
      if (event.timestamp < lastEvent.timestamp) {
        this.eventsByTimestamp.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      }
    }
  }

  /**
   * Update rate counters for alert checking
   */
  private updateRateCounters(event: AuditEvent): void {
    const key = `${event.category}:${event.action}`;
    const current = this.recentEventCounts.get(key) || 0;
    this.recentEventCounts.set(key, current + 1);

    // Decay counters periodically (simple approach)
    setTimeout(() => {
      const count = this.recentEventCounts.get(key) || 0;
      if (count > 0) {
        this.recentEventCounts.set(key, count - 1);
      }
    }, 60000); // Decay after 1 minute
  }

  /**
   * Log event to logger
   */
  private logEventToLogger(event: AuditEvent): void {
    const logData = {
      eventId: event.id,
      category: event.category,
      action: event.action,
      outcome: event.outcome,
      actorId: event.actor.id,
      actorType: event.actor.type,
      targetId: event.target?.id,
      targetType: event.target?.type,
    };

    switch (event.severity) {
      case 'debug':
        logger.debug('Audit event', logData);
        break;
      case 'info':
        logger.info('Audit event', logData);
        break;
      case 'warning':
        logger.warn('Audit event', logData);
        break;
      case 'error':
      case 'critical':
        logger.error('Audit event', logData);
        break;
    }
  }

  logAuth(
    action: 'login' | 'logout' | 'token_refresh' | 'password_change' | 'mfa_challenge',
    actor: AuditActor,
    outcome: AuditOutcome,
    details?: Record<string, unknown>
  ): AuditEvent {
    const severity: AuditSeverity = outcome === 'failure' ? 'warning' : 'info';
    return this.log({
      category: 'authentication',
      action,
      severity,
      outcome,
      actor,
      details,
    });
  }

  logAuthz(
    action: 'access_granted' | 'access_denied' | 'permission_check' | 'role_assigned',
    actor: AuditActor,
    target: AuditTarget,
    outcome: AuditOutcome,
    details?: Record<string, unknown>
  ): AuditEvent {
    const severity: AuditSeverity = action === 'access_denied' ? 'warning' : 'info';
    return this.log({
      category: 'authorization',
      action,
      severity,
      outcome,
      actor,
      target,
      details,
    });
  }

  logDataAccess(
    action: 'read' | 'list' | 'search' | 'export',
    actor: AuditActor,
    target: AuditTarget,
    outcome: AuditOutcome,
    details?: Record<string, unknown>
  ): AuditEvent {
    return this.log({
      category: 'data_access',
      action,
      severity: 'info',
      outcome,
      actor,
      target,
      details,
    });
  }

  logDataModification(
    action: 'create' | 'update' | 'delete' | 'import',
    actor: AuditActor,
    target: AuditTarget,
    outcome: AuditOutcome,
    details?: Record<string, unknown>
  ): AuditEvent {
    const severity: AuditSeverity = action === 'delete' ? 'warning' : 'info';
    return this.log({
      category: 'data_modification',
      action,
      severity,
      outcome,
      actor,
      target,
      details,
    });
  }

  logAgentOperation(
    action: string,
    actor: AuditActor,
    target: AuditTarget,
    outcome: AuditOutcome,
    duration?: number,
    details?: Record<string, unknown>
  ): AuditEvent {
    return this.log({
      category: 'agent_operation',
      action,
      severity: outcome === 'failure' ? 'warning' : 'info',
      outcome,
      actor,
      target,
      duration,
      details,
    });
  }

  logToolExecution(
    toolName: string,
    actor: AuditActor,
    outcome: AuditOutcome,
    duration?: number,
    details?: Record<string, unknown>
  ): AuditEvent {
    return this.log({
      category: 'tool_execution',
      action: toolName,
      severity: outcome === 'failure' ? 'warning' : 'info',
      outcome,
      actor,
      target: {
        id: toolName,
        type: 'tool',
        name: toolName,
      },
      duration,
      details,
    });
  }

  logSecurityEvent(
    action: string,
    severity: AuditSeverity,
    actor: AuditActor,
    details?: Record<string, unknown>,
    error?: AuditError
  ): AuditEvent {
    return this.log({
      category: 'security',
      action,
      severity,
      outcome: error ? 'failure' : 'success',
      actor,
      details,
      error,
    });
  }

  logError(
    action: string,
    actor: AuditActor,
    error: AuditError,
    target?: AuditTarget,
    details?: Record<string, unknown>
  ): AuditEvent {
    return this.log({
      category: 'error',
      action,
      severity: 'error',
      outcome: 'failure',
      actor,
      target,
      details,
      error,
    });
  }

  // ==================== Event Querying ====================

  getEvent(eventId: string): AuditEvent | undefined {
    return this.events.get(eventId);
  }

  query(filter?: AuditFilter, options: AuditQueryOptions = {}): AuditQueryResult {
    const { offset = 0, limit = 100, sortBy = 'timestamp', sortOrder = 'desc' } = options;

    let events = this.filterEvents(filter);

    // Sort
    events = this.sortEvents(events, sortBy, sortOrder);

    // Calculate total before pagination
    const total = events.length;

    // Apply pagination
    const paginatedEvents = events.slice(offset, offset + limit);

    return {
      events: paginatedEvents,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Filter events based on filter criteria
   */
  private filterEvents(filter?: AuditFilter): AuditEvent[] {
    if (!filter) {
      return [...this.eventsByTimestamp];
    }

    return this.eventsByTimestamp.filter((event) => {
      // ID filter
      if (filter.id && event.id !== filter.id) return false;

      // Category filter
      if (filter.category) {
        const categories = Array.isArray(filter.category) ? filter.category : [filter.category];
        if (!categories.includes(event.category)) return false;
      }

      // Action filter
      if (filter.action) {
        const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
        if (!actions.includes(event.action)) return false;
      }

      // Severity filter
      if (filter.severity) {
        const severities = Array.isArray(filter.severity) ? filter.severity : [filter.severity];
        if (!severities.includes(event.severity)) return false;
      }

      // Outcome filter
      if (filter.outcome) {
        const outcomes = Array.isArray(filter.outcome) ? filter.outcome : [filter.outcome];
        if (!outcomes.includes(event.outcome)) return false;
      }

      // Actor filters
      if (filter.actorId && event.actor.id !== filter.actorId) return false;
      if (filter.actorType && event.actor.type !== filter.actorType) return false;

      // Target filters
      if (filter.targetId && event.target?.id !== filter.targetId) return false;
      if (filter.targetType && event.target?.type !== filter.targetType) return false;

      // Time range filters
      if (filter.startTime && event.timestamp < filter.startTime) return false;
      if (filter.endTime && event.timestamp > filter.endTime) return false;

      // Session filter
      if (filter.sessionId && event.context?.sessionId !== filter.sessionId) return false;

      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        if (!event.tags || !filter.tags.some((tag) => event.tags!.includes(tag))) {
          return false;
        }
      }

      // Text search
      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        const detailsStr = JSON.stringify(event.details || {}).toLowerCase();
        if (
          !event.action.toLowerCase().includes(searchLower) &&
          !detailsStr.includes(searchLower) &&
          !event.actor.id.toLowerCase().includes(searchLower) &&
          !(event.target?.id || '').toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort events
   */
  private sortEvents(
    events: AuditEvent[],
    sortBy: 'timestamp' | 'severity' | 'category',
    sortOrder: 'asc' | 'desc'
  ): AuditEvent[] {
    const severityOrder: Record<AuditSeverity, number> = {
      debug: 0,
      info: 1,
      warning: 2,
      error: 3,
      critical: 4,
    };

    return events.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'severity':
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  getRecent(limit = 100): AuditEvent[] {
    return this.eventsByTimestamp.slice(0, limit);
  }

  getByActor(actorId: string, options?: AuditQueryOptions): AuditQueryResult {
    return this.query({ actorId }, options);
  }

  getByTarget(targetId: string, options?: AuditQueryOptions): AuditQueryResult {
    return this.query({ targetId }, options);
  }

  getByTimeRange(startTime: Date, endTime: Date, options?: AuditQueryOptions): AuditQueryResult {
    return this.query({ startTime, endTime }, options);
  }

  // ==================== Statistics & Reporting ====================

  getStatistics(): AuditStatistics {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const byCategory: Record<AuditCategory, number> = {
      authentication: 0,
      authorization: 0,
      data_access: 0,
      data_modification: 0,
      system_operation: 0,
      configuration: 0,
      security: 0,
      agent_operation: 0,
      plugin_operation: 0,
      tool_execution: 0,
      workflow_execution: 0,
      error: 0,
    };

    const bySeverity: Record<AuditSeverity, number> = {
      debug: 0,
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const byOutcome: Record<AuditOutcome, number> = {
      success: 0,
      failure: 0,
      partial: 0,
      unknown: 0,
    };

    const actorCounts = new Map<string, number>();
    let lastHourCount = 0;
    let last24HoursCount = 0;
    let failedOperationsCount = 0;
    let securityEventsCount = 0;

    for (const event of this.events.values()) {
      byCategory[event.category]++;
      bySeverity[event.severity]++;
      byOutcome[event.outcome]++;

      // Actor counts
      const actorCount = actorCounts.get(event.actor.id) || 0;
      actorCounts.set(event.actor.id, actorCount + 1);

      // Time-based counts
      if (event.timestamp >= oneHourAgo) lastHourCount++;
      if (event.timestamp >= oneDayAgo) last24HoursCount++;

      // Failed operations
      if (event.outcome === 'failure') failedOperationsCount++;

      // Security events
      if (event.category === 'security' || event.severity === 'critical') {
        securityEventsCount++;
      }
    }

    // Top actors
    const topActors = Array.from(actorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));

    return {
      totalEvents: this.events.size,
      byCategory,
      bySeverity,
      byOutcome,
      lastHourCount,
      last24HoursCount,
      failedOperationsCount,
      securityEventsCount,
      topActors,
      lastUpdated: new Date(),
    };
  }

  getActivityTimeline(actorId: string, days = 30): Array<{ date: string; count: number }> {
    const timeline = new Map<string, number>();
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      timeline.set(dateStr, 0);
    }

    // Count events per day
    for (const event of this.events.values()) {
      if (event.actor.id === actorId && event.timestamp >= startDate) {
        const dateStr = event.timestamp.toISOString().split('T')[0];
        const count = timeline.get(dateStr) || 0;
        timeline.set(dateStr, count + 1);
      }
    }

    return Array.from(timeline.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ==================== Retention & Export ====================

  setRetentionPolicy(policy: AuditRetentionPolicy): void {
    this.retentionPolicy = { ...this.retentionPolicy, ...policy };
    logger.info('Retention policy updated', { policy: this.retentionPolicy });
  }

  getRetentionPolicy(): AuditRetentionPolicy {
    return { ...this.retentionPolicy };
  }

  async applyRetention(): Promise<{ deleted: number; archived: number }> {
    const now = new Date();
    let deleted = 0;
    let archived = 0;
    const eventsToDelete: string[] = [];

    // Check each event against retention policy
    for (const [eventId, event] of this.events) {
      let shouldDelete = false;

      // Check max events
      if (this.retentionPolicy.maxEvents && this.events.size > this.retentionPolicy.maxEvents) {
        // Delete oldest events beyond max
        const sortedEvents = [...this.events.values()].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        const excessCount = this.events.size - this.retentionPolicy.maxEvents;
        const oldestEvents = sortedEvents.slice(0, excessCount);
        if (oldestEvents.some((e) => e.id === eventId)) {
          shouldDelete = true;
        }
      }

      // Check severity-based retention
      if (!shouldDelete && this.retentionPolicy.severityRetention) {
        const retentionDays = this.retentionPolicy.severityRetention[event.severity];
        if (retentionDays !== undefined) {
          const ageMs = now.getTime() - event.timestamp.getTime();
          const ageDays = ageMs / (24 * 60 * 60 * 1000);
          if (ageDays > retentionDays) {
            shouldDelete = true;
          }
        }
      }

      // Check max age
      if (!shouldDelete && this.retentionPolicy.maxAgeDays) {
        const ageMs = now.getTime() - event.timestamp.getTime();
        const ageDays = ageMs / (24 * 60 * 60 * 1000);
        if (ageDays > this.retentionPolicy.maxAgeDays) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        eventsToDelete.push(eventId);
      }
    }

    // Archive before delete if configured
    if (this.retentionPolicy.archiveBeforeDelete && eventsToDelete.length > 0) {
      const eventsToArchive = eventsToDelete.map((id) => this.events.get(id)!).filter(Boolean);
      // In a real implementation, this would write to archive storage
      logger.info('Archiving events before deletion', { count: eventsToArchive.length });
      archived = eventsToArchive.length;
    }

    // Delete events
    for (const eventId of eventsToDelete) {
      this.events.delete(eventId);
      deleted++;
    }

    // Rebuild timestamp index
    this.eventsByTimestamp = [...this.events.values()].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    logger.info('Retention policy applied', { deleted, archived });
    return { deleted, archived };
  }

  async export(options: AuditExportOptions = {}): Promise<AuditExportData> {
    const { filter, format = 'json', includeMetadata = true } = options;

    const events = this.filterEvents(filter);

    const exportData: AuditExportData = {
      version: '1.0.0',
      exportedAt: new Date(),
      format,
      eventCount: events.length,
    };

    if (includeMetadata && filter) {
      const timestamps = events.map((e) => e.timestamp.getTime());
      exportData.metadata = {
        filter,
        dateRange:
          timestamps.length > 0
            ? {
                start: new Date(Math.min(...timestamps)),
                end: new Date(Math.max(...timestamps)),
              }
            : undefined,
      };
    }

    switch (format) {
      case 'json':
        exportData.events = events;
        break;
      case 'csv':
        exportData.data = this.eventsToCSV(events);
        break;
      case 'ndjson':
        exportData.data = events.map((e) => JSON.stringify(e)).join('\n');
        break;
    }

    logger.info('Audit events exported', { format, count: events.length });
    return exportData;
  }

  /**
   * Convert events to CSV format
   */
  private eventsToCSV(events: AuditEvent[]): string {
    const headers = [
      'id',
      'timestamp',
      'category',
      'action',
      'severity',
      'outcome',
      'actor_id',
      'actor_type',
      'target_id',
      'target_type',
      'duration',
    ];

    const rows = events.map((event) =>
      [
        event.id,
        event.timestamp.toISOString(),
        event.category,
        event.action,
        event.severity,
        event.outcome,
        event.actor.id,
        event.actor.type,
        event.target?.id || '',
        event.target?.type || '',
        event.duration?.toString() || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  clear(filter?: AuditFilter): number {
    if (!filter) {
      const count = this.events.size;
      this.events.clear();
      this.eventsByTimestamp = [];
      logger.warn('All audit events cleared', { count });
      return count;
    }

    const eventsToDelete = this.filterEvents(filter);
    for (const event of eventsToDelete) {
      this.events.delete(event.id);
    }

    // Rebuild timestamp index
    this.eventsByTimestamp = [...this.events.values()].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    logger.warn('Audit events cleared by filter', { count: eventsToDelete.length });
    return eventsToDelete.length;
  }

  // ==================== Alerting ====================

  addAlert(config: AuditAlertConfig): void {
    this.alertConfigs.set(config.id, config);
    logger.info('Alert configuration added', { alertId: config.id, name: config.name });
  }

  removeAlert(alertId: string): boolean {
    if (!this.alertConfigs.has(alertId)) {
      return false;
    }
    this.alertConfigs.delete(alertId);
    logger.info('Alert configuration removed', { alertId });
    return true;
  }

  getAlertConfig(alertId: string): AuditAlertConfig | undefined {
    return this.alertConfigs.get(alertId);
  }

  getAlertConfigs(): AuditAlertConfig[] {
    return Array.from(this.alertConfigs.values());
  }

  /**
   * Check if event triggers any alerts
   */
  private checkAlerts(event: AuditEvent): void {
    for (const config of this.alertConfigs.values()) {
      if (!config.enabled) continue;

      // Check cooldown
      if (config.lastTriggered && config.cooldownSeconds) {
        const cooldownMs = config.cooldownSeconds * 1000;
        if (Date.now() - config.lastTriggered.getTime() < cooldownMs) {
          continue;
        }
      }

      // Check severity threshold
      if (config.severityThreshold) {
        const severityOrder: Record<AuditSeverity, number> = {
          debug: 0,
          info: 1,
          warning: 2,
          error: 3,
          critical: 4,
        };
        if (severityOrder[event.severity] < severityOrder[config.severityThreshold]) {
          continue;
        }
      }

      // Check conditions
      if (this.evaluateAlertConditions(config.conditions, event)) {
        this.triggerAlert(config, event);
      }
    }
  }

  /**
   * Evaluate alert conditions
   */
  private evaluateAlertConditions(conditions: AuditAlertCondition[], event: AuditEvent): boolean {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, event)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(condition: AuditAlertCondition, event: AuditEvent): boolean {
    switch (condition.type) {
      case 'category':
        return this.matchValue(event.category, condition.operator, condition.value);
      case 'action':
        return this.matchValue(event.action, condition.operator, condition.value);
      case 'outcome':
        return this.matchValue(event.outcome, condition.operator, condition.value);
      case 'rate': {
        const key = `${event.category}:${event.action}`;
        const count = this.recentEventCounts.get(key) || 0;
        return count > (condition.value as number);
      }
      case 'pattern':
        const detailsStr = JSON.stringify(event.details || {});
        return new RegExp(condition.value as string).test(detailsStr);
      default:
        return false;
    }
  }

  /**
   * Match value against condition
   */
  private matchValue(
    actual: unknown,
    operator: AuditAlertCondition['operator'],
    expected: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'exceeds':
        return (actual as number) > (expected as number);
      case 'matches':
        return new RegExp(expected as string).test(String(actual));
      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(config: AuditAlertConfig, event: AuditEvent): void {
    const alert: AuditAlert = {
      id: randomUUID(),
      configId: config.id,
      timestamp: new Date(),
      triggerEventIds: [event.id],
      message: `Alert "${config.name}" triggered by ${event.category}:${event.action}`,
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);
    config.lastTriggered = new Date();

    // Notify handlers
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        logger.error('Error in alert handler', { error });
      }
    }

    logger.warn('Audit alert triggered', {
      alertId: alert.id,
      configId: config.id,
      configName: config.name,
      eventId: event.id,
    });
  }

  getAlerts(includeAcknowledged = false): AuditAlert[] {
    const alerts = Array.from(this.alerts.values());
    if (includeAcknowledged) {
      return alerts;
    }
    return alerts.filter((a) => !a.acknowledged);
  }

  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    logger.info('Alert acknowledged', { alertId, acknowledgedBy });
    return true;
  }

  // ==================== Events ====================

  onEvent(handler: (event: AuditEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  onAlert(handler: (alert: AuditAlert) => void): () => void {
    this.alertHandlers.add(handler);
    return () => {
      this.alertHandlers.delete(handler);
    };
  }

  private notifyEventHandlers(event: AuditEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Error in event handler', { error });
      }
    }
  }

  // ==================== Lifecycle ====================

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.events.clear();
    this.eventsByTimestamp = [];
    this.alertConfigs.clear();
    this.alerts.clear();
    this.eventHandlers.clear();
    this.alertHandlers.clear();
    this.recentEventCounts.clear();

    logger.info('AuditManager disposed');
  }
}
