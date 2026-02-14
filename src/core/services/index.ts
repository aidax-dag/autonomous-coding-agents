/**
 * Core Services Module
 *
 * @module core/services
 */

export { ILogger, LogLevel, type LogContext } from './logger.interface';
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
} from './logger';

// Service Registry
export { ServiceRegistry, type ServiceRegistryConfig } from './service-registry';

// Module Initializer (extracted from service-registry)
export {
  ModuleInitializer,
  createEmptyModuleResult,
  type ModuleInitResult,
} from './module-initializer';
