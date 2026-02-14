/**
 * Authentication Module
 *
 * @module api/auth
 */

export { JWTService, createJWTService, type JWTPayload, type JWTConfig } from './jwt';
export { APIKeyService, createAPIKeyService, type APIKeyConfig } from './api-key';
export { installLoginHandler, type LoginConfig } from './login-handler';
export {
  JWTSecurityManager,
  createJWTSecurityManager,
  validateSecretStrength,
  type JWTSecurityConfig,
  type SecretStrengthResult,
  type TokenPair,
  type SecureJWTPayload,
} from './jwt-security';
