/**
 * Auth Interfaces Module
 *
 * Feature: F4.4 - API Authentication
 *
 * @module api/auth/interfaces
 */

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
} from './auth.interface.js';
