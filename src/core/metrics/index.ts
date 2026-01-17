/**
 * Metrics Foundation Module
 *
 * Feature: F0.7 - Metrics Foundation
 * Provides counter, gauge, histogram metrics with labels support
 *
 * @module core/metrics
 */

// Interfaces and types
export * from './metrics.interface.js';

// Metric implementations
export * from './counter.js';
export * from './gauge.js';
export * from './histogram.js';

// Registry
export * from './registry.js';

// Metrics Collection and Monitoring
export * from './metrics-collector.js';
export * from './quality-dashboard.js';
export * from './alert-system.js';
