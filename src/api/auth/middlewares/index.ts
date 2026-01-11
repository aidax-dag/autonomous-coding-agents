/**
 * Auth Middlewares Module
 *
 * Feature: F4.4 - API Authentication
 *
 * @module api/auth/middlewares
 */

export {
  createAuthMiddleware,
  createAuthGuard,
  authPlugin,
  requireAuth,
  requirePermissions,
  requireRoles,
  type AuthMiddlewareConfig,
} from './auth.middleware.js';

export {
  InMemoryRbacService,
  createRbacMiddleware,
  createRbacService,
  rbac,
  type RbacConfig,
} from './rbac.middleware.js';
