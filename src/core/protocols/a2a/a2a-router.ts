/**
 * A2A Message Router
 *
 * Routes incoming A2A messages to registered handlers based on
 * message type patterns. Supports exact match and regex patterns
 * with priority-based ordering.
 *
 * @module core/protocols/a2a
 */

import { createAgentLogger } from '../../../shared/logging/logger';
import type { A2AMessage, A2AMessageType } from './types';

const logger = createAgentLogger('Protocols', 'a2a-router');

/**
 * Handler function for A2A messages
 */
export type A2AMessageHandler = (
  message: A2AMessage,
) => Promise<A2AMessage | null>;

/**
 * A route definition mapping a pattern to a handler
 */
export interface A2ARoute {
  /** Exact message type or regex pattern to match */
  pattern: A2AMessageType | RegExp;
  /** Handler function to invoke on match */
  handler: A2AMessageHandler;
  /** Priority for ordering (higher = checked first, default 0) */
  priority?: number;
}

/**
 * Routes incoming A2A messages to the appropriate handler.
 *
 * Routes are matched in priority order (highest first). For routes
 * with equal priority, the order of registration is preserved.
 */
export class A2ARouter {
  private routes: A2ARoute[] = [];

  /**
   * Add a route to the router
   */
  addRoute(route: A2ARoute): void {
    this.routes.push(route);
    // Sort by priority descending (stable sort preserves insertion order for ties)
    this.routes.sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
    logger.debug('Route added', {
      pattern: String(route.pattern),
      priority: route.priority ?? 0,
      totalRoutes: this.routes.length,
    });
  }

  /**
   * Remove routes matching the given pattern
   */
  removeRoute(pattern: A2AMessageType | RegExp): boolean {
    const before = this.routes.length;
    const patternStr = String(pattern);
    this.routes = this.routes.filter(
      (r) => String(r.pattern) !== patternStr,
    );
    const removed = this.routes.length < before;
    if (removed) {
      logger.debug('Route removed', { pattern: patternStr });
    }
    return removed;
  }

  /**
   * Route a message to the first matching handler.
   * Returns the handler response or null if no match.
   */
  async route(message: A2AMessage): Promise<A2AMessage | null> {
    for (const route of this.routes) {
      if (this.matches(route.pattern, message.type)) {
        logger.debug('Route matched', {
          messageType: message.type,
          pattern: String(route.pattern),
          messageId: message.id,
        });
        return route.handler(message);
      }
    }

    logger.debug('No route matched', {
      messageType: message.type,
      messageId: message.id,
    });
    return null;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): A2ARoute[] {
    return [...this.routes];
  }

  /**
   * Clear all routes
   */
  clear(): void {
    this.routes = [];
    logger.debug('All routes cleared');
  }

  // ── Private ────────────────────────────────────────────────

  private matches(
    pattern: A2AMessageType | RegExp,
    type: A2AMessageType,
  ): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(type);
    }
    return pattern === type;
  }
}

/**
 * Factory function for creating an A2ARouter
 */
export function createA2ARouter(): A2ARouter {
  return new A2ARouter();
}
