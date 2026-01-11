/**
 * Auth Module
 *
 * Feature: F4.4 - API Authentication
 *
 * Provides JWT authentication, API Key authentication, and RBAC
 * for the REST API and WebSocket API.
 *
 * SOLID Principles:
 * - S: Each service has a single responsibility
 * - O: Open for extension via configuration and custom providers
 * - I: Segregated interfaces for JWT, API Key, RBAC
 * - D: Depends on abstractions (interfaces)
 *
 * @module api/auth
 */

// ==================== Interfaces ====================
export {
  // Enums
  AuthMethod,
  TokenType,
  ApiKeyStatus,
  PermissionScope,
  ResourceType,
  // JWT Types
  type JwtConfig,
  type JwtPayload,
  type TokenPair,
  type JwtVerificationResult,
  type JwtError,
  type JwtErrorCode,
  type IJwtService,
  // API Key Types
  type ApiKeyConfig,
  type ApiKey,
  type CreateApiKeyRequest,
  type CreateApiKeyResult,
  type ApiKeyValidationResult,
  type ApiKeyError,
  type ApiKeyErrorCode,
  type IApiKeyService,
  // RBAC Types
  type Role,
  type Permission,
  type PermissionCondition,
  type UserRoleAssignment,
  type PermissionCheckRequest,
  type PermissionCheckResult,
  type IRbacService,
  // Auth Result Types
  type AuthResult,
  type AuthError,
  type AuthErrorCode,
  type AuthMiddlewareOptions,
  // Constants
  DEFAULT_JWT_CONFIG,
  DEFAULT_API_KEY_CONFIG,
  SYSTEM_ROLES,
  AUTH_ERROR_STATUS,
  // Utilities
  formatPermission,
  parsePermission,
} from './interfaces/index.js';

// ==================== Services ====================
export { JwtService, createJwtService } from './services/jwt.service.js';
export { ApiKeyService, createApiKeyService } from './services/api-key.service.js';

// ==================== Middlewares ====================
export {
  createAuthMiddleware,
  createAuthGuard,
  authPlugin,
  requireAuth,
  requirePermissions,
  requireRoles,
  type AuthMiddlewareConfig,
} from './middlewares/auth.middleware.js';

export {
  InMemoryRbacService,
  createRbacMiddleware,
  createRbacService,
  rbac,
  type RbacConfig,
} from './middlewares/rbac.middleware.js';
