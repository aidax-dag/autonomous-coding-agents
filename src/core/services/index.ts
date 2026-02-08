/**
 * Core Services Module
 *
 * @module core/services
 */

export { ILogger, LogLevel, type LogContext } from './logger.interface.js';
export {
  ConsoleLogger,
  configureLogger,
  createLogger,
  createCorrelatedLogger,
  setCorrelationId,
  getCorrelationId,
  clearCorrelationId,
  generateCorrelationId,
  LogFormat,
  type LoggerConfig,
  type StructuredLogEntry,
  type TimerResult,
} from './logger.js';

// Service Registry
export { ServiceRegistry, type ServiceRegistryConfig } from './service-registry.js';
