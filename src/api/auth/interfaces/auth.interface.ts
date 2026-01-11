/**
 * Authentication Interfaces
 *
 * Feature: F4.4 - API Authentication
 *
 * SOLID Principles:
 * - S: Each interface has a single responsibility
 * - O: Open for extension via strategy pattern
 * - I: Segregated interfaces for JWT, API Key, RBAC
 * - D: Depends on abstractions for auth providers
 *
 * @module api/auth/interfaces
 */

// ==================== Enums ====================

/**
 * Authentication method types
 */
export enum AuthMethod {
  JWT = 'jwt',
  API_KEY = 'api_key',
  BASIC = 'basic',
  NONE = 'none',
}

/**
 * Token types for JWT
 */
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

/**
 * API Key status
 */
export enum ApiKeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

/**
 * Permission scope levels
 */
export enum PermissionScope {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',
}

/**
 * Resource types for RBAC
 */
export enum ResourceType {
  AGENT = 'agent',
  WORKFLOW = 'workflow',
  TOOL = 'tool',
  HOOK = 'hook',
  TASK = 'task',
  CONFIG = 'config',
  USER = 'user',
  API_KEY = 'api_key',
}

// ==================== JWT Types ====================

/**
 * JWT configuration
 */
export interface JwtConfig {
  /** Secret key for signing tokens (or path to private key for RS256) */
  secret: string;
  /** Public key for RS256 verification (optional) */
  publicKey?: string;
  /** Algorithm for signing */
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  /** Issuer claim */
  issuer: string;
  /** Audience claim */
  audience?: string | string[];
  /** Access token expiration (e.g., '15m', '1h') */
  accessTokenExpiry: string;
  /** Refresh token expiration (e.g., '7d', '30d') */
  refreshTokenExpiry: string;
  /** Clock tolerance in seconds for exp/nbf validation */
  clockTolerance?: number;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  /** Subject (usually user ID) */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience */
  aud?: string | string[];
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
  /** Not before timestamp */
  nbf?: number;
  /** JWT ID (unique identifier) */
  jti: string;
  /** Token type */
  type: TokenType;
  /** User permissions */
  permissions?: string[];
  /** User roles */
  roles?: string[];
  /** Additional claims */
  [key: string]: unknown;
}

/**
 * JWT token pair (access + refresh)
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * JWT verification result
 */
export interface JwtVerificationResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: JwtError;
}

/**
 * JWT error types
 */
export interface JwtError {
  code: JwtErrorCode;
  message: string;
}

/**
 * JWT error codes
 */
export type JwtErrorCode =
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_MALFORMED'
  | 'TOKEN_NOT_BEFORE'
  | 'SIGNATURE_INVALID'
  | 'ISSUER_INVALID'
  | 'AUDIENCE_INVALID'
  | 'ALGORITHM_INVALID';

/**
 * JWT service interface
 */
export interface IJwtService {
  /**
   * Generate a token pair for a user
   */
  generateTokens(userId: string, claims?: Partial<JwtPayload>): Promise<TokenPair>;

  /**
   * Verify an access token
   */
  verifyAccessToken(token: string): Promise<JwtVerificationResult>;

  /**
   * Verify a refresh token
   */
  verifyRefreshToken(token: string): Promise<JwtVerificationResult>;

  /**
   * Refresh tokens using a valid refresh token
   */
  refreshTokens(refreshToken: string): Promise<TokenPair>;

  /**
   * Decode a token without verification (for inspection)
   */
  decodeToken(token: string): JwtPayload | null;

  /**
   * Revoke a specific token
   */
  revokeToken(jti: string): Promise<void>;

  /**
   * Revoke all tokens for a user
   */
  revokeAllUserTokens(userId: string): Promise<void>;

  /**
   * Check if a token is revoked
   */
  isTokenRevoked(jti: string): Promise<boolean>;
}

// ==================== API Key Types ====================

/**
 * API Key configuration
 */
export interface ApiKeyConfig {
  /** Prefix for API keys (e.g., 'ak_') */
  prefix: string;
  /** Length of the key (excluding prefix) */
  length: number;
  /** Hash algorithm for storing keys */
  hashAlgorithm: 'sha256' | 'sha512' | 'argon2';
  /** Default expiration in days (0 = never expires) */
  defaultExpirationDays: number;
  /** Maximum keys per user */
  maxKeysPerUser: number;
  /** Rate limit per key */
  rateLimitPerMinute: number;
}

/**
 * API Key entity
 */
export interface ApiKey {
  /** Unique identifier */
  id: string;
  /** Key name/label */
  name: string;
  /** Key prefix (visible part) */
  prefix: string;
  /** Hashed key (for storage) */
  hashedKey: string;
  /** Owner user ID */
  userId: string;
  /** Key status */
  status: ApiKeyStatus;
  /** Permissions granted to this key */
  permissions: string[];
  /** Scopes/resources this key can access */
  scopes: string[];
  /** Rate limit override (per minute) */
  rateLimit?: number;
  /** IP whitelist (optional) */
  allowedIps?: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Last used timestamp */
  lastUsedAt?: Date;
  /** Expiration timestamp */
  expiresAt?: Date;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * API Key creation request
 */
export interface CreateApiKeyRequest {
  name: string;
  permissions?: string[];
  scopes?: string[];
  expiresInDays?: number;
  rateLimit?: number;
  allowedIps?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * API Key creation result (includes the raw key, only returned once)
 */
export interface CreateApiKeyResult {
  id: string;
  name: string;
  key: string; // Full key (only shown once at creation)
  prefix: string;
  permissions: string[];
  scopes: string[];
  expiresAt?: Date;
  createdAt: Date;
}

/**
 * API Key validation result
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  error?: ApiKeyError;
}

/**
 * API Key error
 */
export interface ApiKeyError {
  code: ApiKeyErrorCode;
  message: string;
}

/**
 * API Key error codes
 */
export type ApiKeyErrorCode =
  | 'KEY_NOT_FOUND'
  | 'KEY_EXPIRED'
  | 'KEY_REVOKED'
  | 'KEY_INACTIVE'
  | 'KEY_INVALID'
  | 'IP_NOT_ALLOWED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SCOPE_NOT_ALLOWED';

/**
 * API Key service interface
 */
export interface IApiKeyService {
  /**
   * Create a new API key
   */
  createApiKey(userId: string, request: CreateApiKeyRequest): Promise<CreateApiKeyResult>;

  /**
   * Validate an API key
   */
  validateApiKey(key: string, ip?: string): Promise<ApiKeyValidationResult>;

  /**
   * Get API key by ID
   */
  getApiKey(id: string): Promise<ApiKey | null>;

  /**
   * List API keys for a user
   */
  listApiKeys(userId: string): Promise<ApiKey[]>;

  /**
   * Revoke an API key
   */
  revokeApiKey(id: string): Promise<void>;

  /**
   * Update API key permissions
   */
  updateApiKeyPermissions(id: string, permissions: string[]): Promise<ApiKey>;

  /**
   * Update API key status
   */
  updateApiKeyStatus(id: string, status: ApiKeyStatus): Promise<ApiKey>;

  /**
   * Record API key usage
   */
  recordUsage(id: string): Promise<void>;

  /**
   * Check rate limit for API key
   */
  checkRateLimit(id: string): Promise<boolean>;

  /**
   * Delete expired API keys
   */
  cleanupExpiredKeys(): Promise<number>;
}

// ==================== RBAC Types ====================

/**
 * Role definition
 */
export interface Role {
  /** Role identifier */
  id: string;
  /** Role name */
  name: string;
  /** Role description */
  description?: string;
  /** Permissions granted to this role */
  permissions: Permission[];
  /** Is this a system role (cannot be deleted) */
  isSystem: boolean;
  /** Parent role (for inheritance) */
  parentRole?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Permission definition
 */
export interface Permission {
  /** Permission identifier (e.g., 'agent:read', 'workflow:execute') */
  id: string;
  /** Resource type */
  resource: ResourceType;
  /** Scope/action */
  scope: PermissionScope;
  /** Optional resource ID pattern (for specific resources) */
  resourcePattern?: string;
  /** Conditions for the permission */
  conditions?: PermissionCondition[];
}

/**
 * Permission condition (for fine-grained access control)
 */
export interface PermissionCondition {
  /** Field to check */
  field: string;
  /** Operator */
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  /** Value to compare */
  value: unknown;
}

/**
 * User role assignment
 */
export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy: string;
  expiresAt?: Date;
}

/**
 * Permission check request
 */
export interface PermissionCheckRequest {
  /** User ID or subject */
  subject: string;
  /** Resource type */
  resource: ResourceType;
  /** Action/scope */
  action: PermissionScope;
  /** Optional specific resource ID */
  resourceId?: string;
  /** Context for condition evaluation */
  context?: Record<string, unknown>;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  matchedPermission?: Permission;
}

/**
 * RBAC service interface
 */
export interface IRbacService {
  /**
   * Check if subject has permission
   */
  checkPermission(request: PermissionCheckRequest): Promise<PermissionCheckResult>;

  /**
   * Check multiple permissions at once
   */
  checkPermissions(
    subject: string,
    permissions: Array<{ resource: ResourceType; action: PermissionScope; resourceId?: string }>
  ): Promise<Map<string, PermissionCheckResult>>;

  /**
   * Get all permissions for a user
   */
  getUserPermissions(userId: string): Promise<Permission[]>;

  /**
   * Get all roles for a user
   */
  getUserRoles(userId: string): Promise<Role[]>;

  /**
   * Assign role to user
   */
  assignRole(userId: string, roleId: string, assignedBy: string, expiresAt?: Date): Promise<void>;

  /**
   * Remove role from user
   */
  removeRole(userId: string, roleId: string): Promise<void>;

  /**
   * Create a new role
   */
  createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role>;

  /**
   * Update a role
   */
  updateRole(id: string, updates: Partial<Role>): Promise<Role>;

  /**
   * Delete a role
   */
  deleteRole(id: string): Promise<void>;

  /**
   * Get role by ID
   */
  getRole(id: string): Promise<Role | null>;

  /**
   * List all roles
   */
  listRoles(): Promise<Role[]>;
}

// ==================== Auth Middleware Types ====================

/**
 * Authentication result from middleware
 */
export interface AuthResult {
  authenticated: boolean;
  method: AuthMethod;
  userId?: string;
  permissions?: string[];
  roles?: string[];
  apiKeyId?: string;
  tokenId?: string;
  expiresAt?: Date;
  error?: AuthError;
}

/**
 * Authentication error
 */
export interface AuthError {
  code: AuthErrorCode;
  message: string;
  statusCode: number;
}

/**
 * Authentication error codes
 */
export type AuthErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'INVALID_API_KEY'
  | 'API_KEY_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'IP_NOT_ALLOWED'
  | 'ACCOUNT_DISABLED';

/**
 * Auth middleware options
 */
export interface AuthMiddlewareOptions {
  /** Whether authentication is required */
  required: boolean;
  /** Allowed authentication methods */
  methods?: AuthMethod[];
  /** Required permissions (any of these) */
  permissions?: string[];
  /** Required permissions (all of these) */
  requiredPermissions?: string[];
  /** Required roles (any of these) */
  roles?: string[];
}

// ==================== Default Configurations ====================

/**
 * Default JWT configuration
 */
export const DEFAULT_JWT_CONFIG: JwtConfig = {
  secret: process.env.JWT_SECRET || 'change-me-in-production',
  algorithm: 'HS256',
  issuer: 'autonomous-coding-agents',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  clockTolerance: 30,
};

/**
 * Default API Key configuration
 */
export const DEFAULT_API_KEY_CONFIG: ApiKeyConfig = {
  prefix: 'ak_',
  length: 32,
  hashAlgorithm: 'sha256',
  defaultExpirationDays: 0, // Never expires by default
  maxKeysPerUser: 10,
  rateLimitPerMinute: 60,
};

/**
 * System roles
 */
export const SYSTEM_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  SERVICE: 'service',
  READONLY: 'readonly',
} as const;

/**
 * Permission string format helper
 */
export function formatPermission(resource: ResourceType, scope: PermissionScope): string {
  return `${resource}:${scope}`;
}

/**
 * Parse permission string to resource and scope
 */
export function parsePermission(permission: string): { resource: ResourceType; scope: PermissionScope } | null {
  const parts = permission.split(':');
  if (parts.length !== 2) return null;

  const resource = parts[0] as ResourceType;
  const scope = parts[1] as PermissionScope;

  if (!Object.values(ResourceType).includes(resource)) return null;
  if (!Object.values(PermissionScope).includes(scope)) return null;

  return { resource, scope };
}

// ==================== Auth Error Constants ====================

/**
 * Auth error code to HTTP status mapping
 */
export const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  AUTH_REQUIRED: 401,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,
  INVALID_API_KEY: 401,
  API_KEY_EXPIRED: 401,
  PERMISSION_DENIED: 403,
  RATE_LIMIT_EXCEEDED: 429,
  IP_NOT_ALLOWED: 403,
  ACCOUNT_DISABLED: 403,
};
