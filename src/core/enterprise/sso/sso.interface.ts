/**
 * SSO Integration Interfaces
 *
 * Feature: F5.12 - SSO Integration
 * Provides SAML 2.0 and OpenID Connect (OIDC) support for enterprise authentication
 *
 * @module core/enterprise/sso
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';

/**
 * SSO provider type
 */
export type SSOProviderType = 'saml' | 'oidc';

/**
 * SSO provider status
 */
export type SSOProviderStatus = 'active' | 'inactive' | 'error' | 'configuring';

/**
 * SSO session status
 */
export type SSOSessionStatus = 'active' | 'expired' | 'revoked' | 'pending';

/**
 * SAML binding type
 */
export type SAMLBinding = 'HTTP-POST' | 'HTTP-Redirect';

/**
 * OIDC response type
 */
export type OIDCResponseType = 'code' | 'token' | 'id_token' | 'code id_token' | 'code token';

/**
 * OIDC grant type
 */
export type OIDCGrantType =
  | 'authorization_code'
  | 'implicit'
  | 'refresh_token'
  | 'client_credentials';

/**
 * SSO Identity Provider configuration
 */
export interface SSOProvider {
  /** Provider unique identifier */
  id: string;
  /** Provider name */
  name: string;
  /** Provider type */
  type: SSOProviderType;
  /** Provider status */
  status: SSOProviderStatus;
  /** Team ID (for team-specific providers) */
  teamId?: string;
  /** Whether this is the default provider */
  isDefault: boolean;
  /** SAML configuration (if type is 'saml') */
  samlConfig?: SAMLConfiguration;
  /** OIDC configuration (if type is 'oidc') */
  oidcConfig?: OIDCConfiguration;
  /** Attribute mapping */
  attributeMapping: AttributeMapping;
  /** Provider metadata */
  metadata?: Record<string, unknown>;
  /** When provider was created */
  createdAt: Date;
  /** When provider was last updated */
  updatedAt: Date;
  /** Last error message */
  lastError?: string;
}

/**
 * SAML 2.0 configuration
 */
export interface SAMLConfiguration {
  /** Entity ID (our service provider) */
  entityId: string;
  /** Assertion Consumer Service URL */
  acsUrl: string;
  /** Single Logout Service URL */
  sloUrl?: string;
  /** Identity Provider Entity ID */
  idpEntityId: string;
  /** Identity Provider SSO URL */
  idpSsoUrl: string;
  /** Identity Provider SLO URL */
  idpSloUrl?: string;
  /** Identity Provider Certificate (PEM format) */
  idpCertificate: string;
  /** Service Provider Certificate (PEM format) */
  spCertificate?: string;
  /** Service Provider Private Key (PEM format) */
  spPrivateKey?: string;
  /** Binding type */
  binding: SAMLBinding;
  /** Sign authentication requests */
  signAuthnRequests: boolean;
  /** Want assertions signed */
  wantAssertionsSigned: boolean;
  /** Want assertions encrypted */
  wantAssertionsEncrypted: boolean;
  /** Name ID format */
  nameIdFormat: string;
  /** Allowed clock skew in seconds */
  allowedClockSkew: number;
  /** Force authentication */
  forceAuthn: boolean;
  /** Authentication context */
  authnContext?: string[];
}

/**
 * OpenID Connect configuration
 */
export interface OIDCConfiguration {
  /** Client ID */
  clientId: string;
  /** Client Secret */
  clientSecret: string;
  /** Issuer URL */
  issuer: string;
  /** Authorization endpoint */
  authorizationUrl: string;
  /** Token endpoint */
  tokenUrl: string;
  /** UserInfo endpoint */
  userInfoUrl?: string;
  /** JWKS URI */
  jwksUri?: string;
  /** End session endpoint (for logout) */
  endSessionUrl?: string;
  /** Redirect URI */
  redirectUri: string;
  /** Post logout redirect URI */
  postLogoutRedirectUri?: string;
  /** Response type */
  responseType: OIDCResponseType;
  /** Grant type */
  grantType: OIDCGrantType;
  /** Scopes */
  scopes: string[];
  /** PKCE enabled */
  pkceEnabled: boolean;
  /** State parameter enabled */
  stateEnabled: boolean;
  /** Nonce parameter enabled */
  nonceEnabled: boolean;
  /** Token signature algorithm */
  tokenSignatureAlgorithm: string;
  /** Allowed clock skew in seconds */
  allowedClockSkew: number;
}

/**
 * Attribute mapping configuration
 */
export interface AttributeMapping {
  /** Map to user ID */
  userId: string;
  /** Map to email */
  email: string;
  /** Map to display name */
  displayName?: string;
  /** Map to first name */
  firstName?: string;
  /** Map to last name */
  lastName?: string;
  /** Map to groups/roles */
  groups?: string;
  /** Map to avatar URL */
  avatarUrl?: string;
  /** Custom attribute mappings */
  custom?: Record<string, string>;
}

/**
 * SSO user identity from provider
 */
export interface SSOUserIdentity {
  /** Provider ID */
  providerId: string;
  /** Provider user ID (nameId or sub) */
  providerUserId: string;
  /** Email address */
  email: string;
  /** Display name */
  displayName?: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Groups */
  groups?: string[];
  /** Avatar URL */
  avatarUrl?: string;
  /** Raw attributes from provider */
  rawAttributes: Record<string, unknown>;
  /** When identity was retrieved */
  retrievedAt: Date;
}

/**
 * SSO session
 */
export interface SSOSession {
  /** Session unique identifier */
  id: string;
  /** Provider ID */
  providerId: string;
  /** User identity */
  userIdentity: SSOUserIdentity;
  /** Session status */
  status: SSOSessionStatus;
  /** Session index (for SAML) */
  sessionIndex?: string;
  /** Access token (for OIDC) */
  accessToken?: string;
  /** Refresh token (for OIDC) */
  refreshToken?: string;
  /** ID token (for OIDC) */
  idToken?: string;
  /** Token expiry */
  tokenExpiry?: Date;
  /** Session created at */
  createdAt: Date;
  /** Session expires at */
  expiresAt: Date;
  /** Last activity */
  lastActivityAt: Date;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
}

/**
 * Authentication request
 */
export interface AuthenticationRequest {
  /** Request ID */
  id: string;
  /** Provider ID */
  providerId: string;
  /** State parameter */
  state: string;
  /** Nonce parameter (for OIDC) */
  nonce?: string;
  /** PKCE code verifier (for OIDC) */
  codeVerifier?: string;
  /** Relay state (for SAML) */
  relayState?: string;
  /** Redirect URL after authentication */
  redirectUrl: string;
  /** Request created at */
  createdAt: Date;
  /** Request expires at */
  expiresAt: Date;
}

/**
 * Authentication response (from IdP)
 */
export interface AuthenticationResponse {
  /** Provider type */
  type: SSOProviderType;
  /** SAML response (base64 encoded) */
  samlResponse?: string;
  /** Relay state */
  relayState?: string;
  /** Authorization code (for OIDC) */
  code?: string;
  /** State parameter */
  state?: string;
  /** ID token (for OIDC implicit flow) */
  idToken?: string;
  /** Access token (for OIDC implicit flow) */
  accessToken?: string;
  /** Error code */
  error?: string;
  /** Error description */
  errorDescription?: string;
}

/**
 * SSO authentication result
 */
export interface SSOAuthResult {
  /** Success flag */
  success: boolean;
  /** SSO session (if successful) */
  session?: SSOSession;
  /** User identity */
  userIdentity?: SSOUserIdentity;
  /** Error message */
  error?: string;
  /** Error code */
  errorCode?: string;
}

/**
 * Logout request
 */
export interface LogoutRequest {
  /** Session ID to logout */
  sessionId: string;
  /** Perform single logout (propagate to IdP) */
  singleLogout: boolean;
  /** Redirect URL after logout */
  redirectUrl?: string;
}

/**
 * Logout result
 */
export interface LogoutResult {
  /** Success flag */
  success: boolean;
  /** Single logout URL (if redirect needed) */
  logoutUrl?: string;
  /** Error message */
  error?: string;
}

/**
 * Provider validation result
 */
export interface ProviderValidationResult {
  /** Is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * SSO event
 */
export interface SSOEvent {
  /** Event type */
  type: SSOEventType;
  /** Provider ID */
  providerId?: string;
  /** Session ID */
  sessionId?: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * SSO event types
 */
export type SSOEventType =
  | 'provider.created'
  | 'provider.updated'
  | 'provider.deleted'
  | 'provider.activated'
  | 'provider.deactivated'
  | 'provider.error'
  | 'session.created'
  | 'session.refreshed'
  | 'session.expired'
  | 'session.revoked'
  | 'auth.started'
  | 'auth.success'
  | 'auth.failed'
  | 'logout.started'
  | 'logout.success'
  | 'logout.failed';

/**
 * Create SAML provider request
 */
export interface CreateSAMLProviderRequest {
  /** Provider name */
  name: string;
  /** Team ID */
  teamId?: string;
  /** SAML configuration */
  config: Omit<SAMLConfiguration, 'entityId' | 'acsUrl' | 'sloUrl'>;
  /** Attribute mapping */
  attributeMapping: AttributeMapping;
  /** Set as default */
  isDefault?: boolean;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create OIDC provider request
 */
export interface CreateOIDCProviderRequest {
  /** Provider name */
  name: string;
  /** Team ID */
  teamId?: string;
  /** OIDC configuration */
  config: Omit<OIDCConfiguration, 'redirectUri' | 'postLogoutRedirectUri'>;
  /** Attribute mapping */
  attributeMapping: AttributeMapping;
  /** Set as default */
  isDefault?: boolean;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Update provider request
 */
export interface UpdateProviderRequest {
  /** Provider name */
  name?: string;
  /** SAML configuration updates */
  samlConfig?: Partial<SAMLConfiguration>;
  /** OIDC configuration updates */
  oidcConfig?: Partial<OIDCConfiguration>;
  /** Attribute mapping updates */
  attributeMapping?: Partial<AttributeMapping>;
  /** Set as default */
  isDefault?: boolean;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * SSO Manager interface
 */
export interface ISSOManager extends IDisposable {
  // ==================== Provider Management ====================

  /**
   * Create a SAML provider
   * @param request Create request
   */
  createSAMLProvider(request: CreateSAMLProviderRequest): Promise<SSOProvider>;

  /**
   * Create an OIDC provider
   * @param request Create request
   */
  createOIDCProvider(request: CreateOIDCProviderRequest): Promise<SSOProvider>;

  /**
   * Get a provider by ID
   * @param providerId Provider identifier
   */
  getProvider(providerId: string): Promise<SSOProvider | undefined>;

  /**
   * Get the default provider
   * @param teamId Optional team ID
   */
  getDefaultProvider(teamId?: string): Promise<SSOProvider | undefined>;

  /**
   * Update a provider
   * @param providerId Provider identifier
   * @param updates Update request
   */
  updateProvider(providerId: string, updates: UpdateProviderRequest): Promise<SSOProvider>;

  /**
   * Delete a provider
   * @param providerId Provider identifier
   */
  deleteProvider(providerId: string): Promise<boolean>;

  /**
   * Get all providers
   * @param teamId Optional team ID filter
   */
  getProviders(teamId?: string): Promise<SSOProvider[]>;

  /**
   * Activate a provider
   * @param providerId Provider identifier
   */
  activateProvider(providerId: string): Promise<SSOProvider>;

  /**
   * Deactivate a provider
   * @param providerId Provider identifier
   */
  deactivateProvider(providerId: string): Promise<SSOProvider>;

  /**
   * Validate provider configuration
   * @param providerId Provider identifier
   */
  validateProvider(providerId: string): Promise<ProviderValidationResult>;

  // ==================== Authentication ====================

  /**
   * Start authentication flow
   * @param providerId Provider identifier
   * @param redirectUrl URL to redirect after auth
   */
  startAuthentication(providerId: string, redirectUrl: string): Promise<AuthenticationRequest>;

  /**
   * Get authentication URL
   * @param request Authentication request
   */
  getAuthenticationUrl(request: AuthenticationRequest): Promise<string>;

  /**
   * Handle authentication callback/response
   * @param providerId Provider identifier
   * @param response Authentication response
   * @param requestId Original request ID
   */
  handleAuthenticationResponse(
    providerId: string,
    response: AuthenticationResponse,
    requestId: string
  ): Promise<SSOAuthResult>;

  /**
   * Refresh session tokens (OIDC only)
   * @param sessionId Session identifier
   */
  refreshSession(sessionId: string): Promise<SSOSession>;

  // ==================== Session Management ====================

  /**
   * Get a session
   * @param sessionId Session identifier
   */
  getSession(sessionId: string): Promise<SSOSession | undefined>;

  /**
   * Get active sessions for a user
   * @param providerUserId Provider user ID
   */
  getUserSessions(providerUserId: string): Promise<SSOSession[]>;

  /**
   * Validate a session
   * @param sessionId Session identifier
   */
  validateSession(sessionId: string): Promise<boolean>;

  /**
   * Revoke a session
   * @param sessionId Session identifier
   */
  revokeSession(sessionId: string): Promise<boolean>;

  /**
   * Revoke all sessions for a user
   * @param providerUserId Provider user ID
   */
  revokeUserSessions(providerUserId: string): Promise<number>;

  // ==================== Logout ====================

  /**
   * Initiate logout
   * @param request Logout request
   */
  logout(request: LogoutRequest): Promise<LogoutResult>;

  /**
   * Handle logout callback (for SAML SLO)
   * @param providerId Provider identifier
   * @param response Logout response
   */
  handleLogoutResponse(providerId: string, response: string): Promise<LogoutResult>;

  // ==================== Service Provider Metadata ====================

  /**
   * Get SAML service provider metadata
   * @param providerId Provider identifier
   */
  getSAMLMetadata(providerId: string): Promise<string>;

  /**
   * Get OIDC discovery document
   */
  getOIDCDiscoveryDocument(): Promise<Record<string, unknown>>;

  // ==================== Events ====================

  /**
   * Subscribe to SSO events
   * @param handler Event handler
   */
  onSSOEvent(handler: (event: SSOEvent) => void): () => void;
}

/**
 * Default SAML configuration values
 */
export const DEFAULT_SAML_CONFIG: Partial<SAMLConfiguration> = {
  binding: 'HTTP-POST',
  signAuthnRequests: true,
  wantAssertionsSigned: true,
  wantAssertionsEncrypted: false,
  nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  allowedClockSkew: 300, // 5 minutes
  forceAuthn: false,
};

/**
 * Default OIDC configuration values
 */
export const DEFAULT_OIDC_CONFIG: Partial<OIDCConfiguration> = {
  responseType: 'code',
  grantType: 'authorization_code',
  scopes: ['openid', 'profile', 'email'],
  pkceEnabled: true,
  stateEnabled: true,
  nonceEnabled: true,
  tokenSignatureAlgorithm: 'RS256',
  allowedClockSkew: 300, // 5 minutes
};

/**
 * Default attribute mapping
 */
export const DEFAULT_ATTRIBUTE_MAPPING: AttributeMapping = {
  userId: 'sub',
  email: 'email',
  displayName: 'name',
  firstName: 'given_name',
  lastName: 'family_name',
  groups: 'groups',
};
