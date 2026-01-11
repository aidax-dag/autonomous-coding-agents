/**
 * Audit Logging Interfaces
 *
 * Feature: F5.4 - Audit Logging
 * Provides comprehensive audit logging and tracking capabilities
 *
 * @module core/security/audit
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';

/**
 * Audit event category
 */
export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'system_operation'
  | 'configuration'
  | 'security'
  | 'agent_operation'
  | 'plugin_operation'
  | 'tool_execution'
  | 'workflow_execution'
  | 'error';

/**
 * Audit event severity/importance
 */
export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

/**
 * Audit event outcome
 */
export type AuditOutcome = 'success' | 'failure' | 'partial' | 'unknown';

/**
 * Audit event
 */
export interface AuditEvent {
  /** Unique event identifier */
  id: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event category */
  category: AuditCategory;
  /** Event action (e.g., 'login', 'create', 'delete') */
  action: string;
  /** Event severity */
  severity: AuditSeverity;
  /** Event outcome */
  outcome: AuditOutcome;
  /** Actor who performed the action */
  actor: AuditActor;
  /** Target of the action */
  target?: AuditTarget;
  /** Event details */
  details?: Record<string, unknown>;
  /** Request context */
  context?: AuditContext;
  /** Related event IDs */
  relatedEvents?: string[];
  /** Event tags for filtering */
  tags?: string[];
  /** Error information if applicable */
  error?: AuditError;
  /** Duration of operation in ms */
  duration?: number;
}

/**
 * Actor who performed the action
 */
export interface AuditActor {
  /** Actor identifier */
  id: string;
  /** Actor type */
  type: 'user' | 'agent' | 'plugin' | 'service' | 'system';
  /** Actor name */
  name?: string;
  /** Actor attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Target of the action
 */
export interface AuditTarget {
  /** Target identifier */
  id: string;
  /** Target type */
  type: string;
  /** Target name */
  name?: string;
  /** Target attributes */
  attributes?: Record<string, unknown>;
  /** Previous state (for modifications) */
  previousState?: unknown;
  /** New state (for modifications) */
  newState?: unknown;
}

/**
 * Request context
 */
export interface AuditContext {
  /** Session identifier */
  sessionId?: string;
  /** Request identifier */
  requestId?: string;
  /** Source IP address */
  sourceIp?: string;
  /** User agent */
  userAgent?: string;
  /** Project context */
  projectId?: string;
  /** Workspace context */
  workspaceId?: string;
  /** Additional context */
  additional?: Record<string, unknown>;
}

/**
 * Error information
 */
export interface AuditError {
  /** Error code */
  code?: string;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Error type/name */
  type?: string;
}

/**
 * Audit query filter
 */
export interface AuditFilter {
  /** Filter by event ID */
  id?: string;
  /** Filter by category */
  category?: AuditCategory | AuditCategory[];
  /** Filter by action */
  action?: string | string[];
  /** Filter by severity */
  severity?: AuditSeverity | AuditSeverity[];
  /** Filter by outcome */
  outcome?: AuditOutcome | AuditOutcome[];
  /** Filter by actor ID */
  actorId?: string;
  /** Filter by actor type */
  actorType?: AuditActor['type'];
  /** Filter by target ID */
  targetId?: string;
  /** Filter by target type */
  targetType?: string;
  /** Filter by start time */
  startTime?: Date;
  /** Filter by end time */
  endTime?: Date;
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by tags */
  tags?: string[];
  /** Text search in details */
  searchText?: string;
}

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  /** Skip first N results */
  offset?: number;
  /** Limit number of results */
  limit?: number;
  /** Sort field */
  sortBy?: 'timestamp' | 'severity' | 'category';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Include related events */
  includeRelated?: boolean;
}

/**
 * Audit query result
 */
export interface AuditQueryResult {
  /** Matching events */
  events: AuditEvent[];
  /** Total count (without limit) */
  total: number;
  /** Query offset */
  offset: number;
  /** Query limit */
  limit: number;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  /** Total events */
  totalEvents: number;
  /** Events by category */
  byCategory: Record<AuditCategory, number>;
  /** Events by severity */
  bySeverity: Record<AuditSeverity, number>;
  /** Events by outcome */
  byOutcome: Record<AuditOutcome, number>;
  /** Events in last hour */
  lastHourCount: number;
  /** Events in last 24 hours */
  last24HoursCount: number;
  /** Failed operations count */
  failedOperationsCount: number;
  /** Security events count */
  securityEventsCount: number;
  /** Top actors */
  topActors: Array<{ id: string; count: number }>;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * Audit retention policy
 */
export interface AuditRetentionPolicy {
  /** Maximum events to retain */
  maxEvents?: number;
  /** Maximum age in days */
  maxAgeDays?: number;
  /** Retention by severity */
  severityRetention?: Partial<Record<AuditSeverity, number>>;
  /** Archive before delete */
  archiveBeforeDelete?: boolean;
}

/**
 * Audit export options
 */
export interface AuditExportOptions {
  /** Filter to apply */
  filter?: AuditFilter;
  /** Export format */
  format?: 'json' | 'csv' | 'ndjson';
  /** Include metadata */
  includeMetadata?: boolean;
  /** Compress output */
  compress?: boolean;
}

/**
 * Audit export data
 */
export interface AuditExportData {
  /** Export version */
  version: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Export format */
  format: string;
  /** Event count */
  eventCount: number;
  /** Events (for JSON format) */
  events?: AuditEvent[];
  /** Raw data (for CSV/compressed formats) */
  data?: string | Buffer;
  /** Export metadata */
  metadata?: {
    filter?: AuditFilter;
    dateRange?: { start: Date; end: Date };
  };
}

/**
 * Audit alert configuration
 */
export interface AuditAlertConfig {
  /** Alert identifier */
  id: string;
  /** Alert name */
  name: string;
  /** Alert description */
  description?: string;
  /** Enabled status */
  enabled: boolean;
  /** Trigger conditions */
  conditions: AuditAlertCondition[];
  /** Alert severity threshold */
  severityThreshold?: AuditSeverity;
  /** Cooldown period in seconds */
  cooldownSeconds?: number;
  /** Last triggered time */
  lastTriggered?: Date;
}

/**
 * Alert condition
 */
export interface AuditAlertCondition {
  /** Condition type */
  type: 'category' | 'action' | 'outcome' | 'rate' | 'pattern';
  /** Condition operator */
  operator: 'equals' | 'contains' | 'exceeds' | 'matches';
  /** Condition value */
  value: unknown;
  /** Time window for rate conditions (seconds) */
  timeWindow?: number;
}

/**
 * Audit alert
 */
export interface AuditAlert {
  /** Alert identifier */
  id: string;
  /** Alert config ID */
  configId: string;
  /** Trigger timestamp */
  timestamp: Date;
  /** Triggering event IDs */
  triggerEventIds: string[];
  /** Alert message */
  message: string;
  /** Alert acknowledged */
  acknowledged: boolean;
  /** Acknowledged by */
  acknowledgedBy?: string;
  /** Acknowledged at */
  acknowledgedAt?: Date;
}

/**
 * Audit Manager interface
 */
export interface IAuditManager extends IDisposable {
  // ==================== Event Logging ====================

  /**
   * Log an audit event
   * @param event Event to log (id and timestamp auto-generated if not provided)
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'> & Partial<Pick<AuditEvent, 'id' | 'timestamp'>>): AuditEvent;

  /**
   * Log authentication event
   */
  logAuth(
    action: 'login' | 'logout' | 'token_refresh' | 'password_change' | 'mfa_challenge',
    actor: AuditActor,
    outcome: AuditOutcome,
    details?: Record<string, unknown>
  ): AuditEvent;

  /**
   * Log authorization event
   */
  logAuthz(
    action: 'access_granted' | 'access_denied' | 'permission_check' | 'role_assigned',
    actor: AuditActor,
    target: AuditTarget,
    outcome: AuditOutcome,
    details?: Record<string, unknown>
  ): AuditEvent;

  /**
   * Log data access event
   */
  logDataAccess(
    action: 'read' | 'list' | 'search' | 'export',
    actor: AuditActor,
    target: AuditTarget,
    outcome: AuditOutcome,
    details?: Record<string, unknown>
  ): AuditEvent;

  /**
   * Log data modification event
   */
  logDataModification(
    action: 'create' | 'update' | 'delete' | 'import',
    actor: AuditActor,
    target: AuditTarget,
    outcome: AuditOutcome,
    details?: Record<string, unknown>
  ): AuditEvent;

  /**
   * Log agent operation
   */
  logAgentOperation(
    action: string,
    actor: AuditActor,
    target: AuditTarget,
    outcome: AuditOutcome,
    duration?: number,
    details?: Record<string, unknown>
  ): AuditEvent;

  /**
   * Log tool execution
   */
  logToolExecution(
    toolName: string,
    actor: AuditActor,
    outcome: AuditOutcome,
    duration?: number,
    details?: Record<string, unknown>
  ): AuditEvent;

  /**
   * Log security event
   */
  logSecurityEvent(
    action: string,
    severity: AuditSeverity,
    actor: AuditActor,
    details?: Record<string, unknown>,
    error?: AuditError
  ): AuditEvent;

  /**
   * Log error event
   */
  logError(
    action: string,
    actor: AuditActor,
    error: AuditError,
    target?: AuditTarget,
    details?: Record<string, unknown>
  ): AuditEvent;

  // ==================== Event Querying ====================

  /**
   * Get event by ID
   * @param eventId Event identifier
   */
  getEvent(eventId: string): AuditEvent | undefined;

  /**
   * Query events
   * @param filter Query filter
   * @param options Query options
   */
  query(filter?: AuditFilter, options?: AuditQueryOptions): AuditQueryResult;

  /**
   * Get recent events
   * @param limit Number of events to return
   */
  getRecent(limit?: number): AuditEvent[];

  /**
   * Get events by actor
   * @param actorId Actor identifier
   * @param options Query options
   */
  getByActor(actorId: string, options?: AuditQueryOptions): AuditQueryResult;

  /**
   * Get events by target
   * @param targetId Target identifier
   * @param options Query options
   */
  getByTarget(targetId: string, options?: AuditQueryOptions): AuditQueryResult;

  /**
   * Get events in time range
   * @param startTime Start time
   * @param endTime End time
   * @param options Query options
   */
  getByTimeRange(startTime: Date, endTime: Date, options?: AuditQueryOptions): AuditQueryResult;

  // ==================== Statistics & Reporting ====================

  /**
   * Get audit statistics
   */
  getStatistics(): AuditStatistics;

  /**
   * Get activity timeline for an actor
   * @param actorId Actor identifier
   * @param days Number of days to include
   */
  getActivityTimeline(actorId: string, days?: number): Array<{ date: string; count: number }>;

  // ==================== Retention & Export ====================

  /**
   * Set retention policy
   * @param policy Retention policy
   */
  setRetentionPolicy(policy: AuditRetentionPolicy): void;

  /**
   * Get retention policy
   */
  getRetentionPolicy(): AuditRetentionPolicy;

  /**
   * Apply retention policy (cleanup old events)
   */
  applyRetention(): Promise<{ deleted: number; archived: number }>;

  /**
   * Export audit events
   * @param options Export options
   */
  export(options?: AuditExportOptions): Promise<AuditExportData>;

  /**
   * Clear all events (use with caution)
   * @param filter Optional filter to clear specific events
   */
  clear(filter?: AuditFilter): number;

  // ==================== Alerting ====================

  /**
   * Add alert configuration
   * @param config Alert configuration
   */
  addAlert(config: AuditAlertConfig): void;

  /**
   * Remove alert configuration
   * @param alertId Alert configuration ID
   */
  removeAlert(alertId: string): boolean;

  /**
   * Get alert configuration
   * @param alertId Alert configuration ID
   */
  getAlertConfig(alertId: string): AuditAlertConfig | undefined;

  /**
   * Get all alert configurations
   */
  getAlertConfigs(): AuditAlertConfig[];

  /**
   * Get triggered alerts
   * @param includeAcknowledged Include acknowledged alerts
   */
  getAlerts(includeAcknowledged?: boolean): AuditAlert[];

  /**
   * Acknowledge an alert
   * @param alertId Alert ID
   * @param acknowledgedBy Who acknowledged the alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean;

  // ==================== Events ====================

  /**
   * Subscribe to new audit events
   * @param handler Event handler
   */
  onEvent(handler: (event: AuditEvent) => void): () => void;

  /**
   * Subscribe to alerts
   * @param handler Alert handler
   */
  onAlert(handler: (alert: AuditAlert) => void): () => void;
}

/**
 * Helper function to create audit actor
 */
export function createAuditActor(
  id: string,
  type: AuditActor['type'],
  name?: string,
  attributes?: Record<string, unknown>
): AuditActor {
  return { id, type, name, attributes };
}

/**
 * Helper function to create audit target
 */
export function createAuditTarget(
  id: string,
  type: string,
  name?: string,
  attributes?: Record<string, unknown>
): AuditTarget {
  return { id, type, name, attributes };
}

/**
 * Helper function to create audit error
 */
export function createAuditError(error: Error | string): AuditError {
  if (typeof error === 'string') {
    return { message: error };
  }
  return {
    code: (error as Error & { code?: string }).code,
    message: error.message,
    stack: error.stack,
    type: error.name,
  };
}
