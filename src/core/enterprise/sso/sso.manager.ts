/**
 * SSO Manager Implementation
 *
 * Feature: F5.12 - SSO Integration
 * Provides SAML 2.0 and OpenID Connect (OIDC) support for enterprise authentication
 *
 * @module core/enterprise/sso
 */

import { randomUUID, randomBytes, createHash } from 'crypto';
import type {
  ISSOManager,
  SSOProvider,
  SSOSession,
  SSOUserIdentity,
  AuthenticationRequest,
  AuthenticationResponse,
  SSOAuthResult,
  LogoutRequest,
  LogoutResult,
  ProviderValidationResult,
  SSOEvent,
  SSOEventType,
  CreateSAMLProviderRequest,
  CreateOIDCProviderRequest,
  UpdateProviderRequest,
  SAMLConfiguration,
  OIDCConfiguration,
} from './sso.interface.js';
import {
  DEFAULT_SAML_CONFIG,
  DEFAULT_OIDC_CONFIG,
  DEFAULT_ATTRIBUTE_MAPPING,
} from './sso.interface.js';

/**
 * SSO Manager implementation
 */
export class SSOManager implements ISSOManager {
  private providers: Map<string, SSOProvider> = new Map();
  private sessions: Map<string, SSOSession> = new Map();
  private authRequests: Map<string, AuthenticationRequest> = new Map();
  private eventHandlers: Set<(event: SSOEvent) => void> = new Set();
  private disposed = false;

  // Base URLs for SP endpoints
  private baseUrl: string;
  private acsPath = '/sso/saml/acs';
  private sloPath = '/sso/saml/slo';
  private oidcCallbackPath = '/sso/oidc/callback';

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  // ==================== Provider Management ====================

  async createSAMLProvider(request: CreateSAMLProviderRequest): Promise<SSOProvider> {
    this.ensureNotDisposed();

    const now = new Date();
    const providerId = randomUUID();

    // Build full SAML config with SP endpoints
    const samlConfig: SAMLConfiguration = {
      ...DEFAULT_SAML_CONFIG,
      ...request.config,
      entityId: `${this.baseUrl}/sso/saml/${providerId}`,
      acsUrl: `${this.baseUrl}${this.acsPath}/${providerId}`,
      sloUrl: `${this.baseUrl}${this.sloPath}/${providerId}`,
    } as SAMLConfiguration;

    const provider: SSOProvider = {
      id: providerId,
      name: request.name,
      type: 'saml',
      status: 'configuring',
      teamId: request.teamId,
      isDefault: request.isDefault || false,
      samlConfig,
      attributeMapping: { ...DEFAULT_ATTRIBUTE_MAPPING, ...request.attributeMapping },
      metadata: request.metadata,
      createdAt: now,
      updatedAt: now,
    };

    // If setting as default, clear other defaults
    if (provider.isDefault) {
      await this.clearDefaultProvider(request.teamId);
    }

    this.providers.set(provider.id, provider);
    this.emitEvent('provider.created', provider.id, undefined, { provider });

    return provider;
  }

  async createOIDCProvider(request: CreateOIDCProviderRequest): Promise<SSOProvider> {
    this.ensureNotDisposed();

    const now = new Date();
    const providerId = randomUUID();

    // Build full OIDC config with redirect URIs
    const oidcConfig: OIDCConfiguration = {
      ...DEFAULT_OIDC_CONFIG,
      ...request.config,
      redirectUri: `${this.baseUrl}${this.oidcCallbackPath}/${providerId}`,
      postLogoutRedirectUri: `${this.baseUrl}/logout-complete`,
    } as OIDCConfiguration;

    const provider: SSOProvider = {
      id: providerId,
      name: request.name,
      type: 'oidc',
      status: 'configuring',
      teamId: request.teamId,
      isDefault: request.isDefault || false,
      oidcConfig,
      attributeMapping: { ...DEFAULT_ATTRIBUTE_MAPPING, ...request.attributeMapping },
      metadata: request.metadata,
      createdAt: now,
      updatedAt: now,
    };

    // If setting as default, clear other defaults
    if (provider.isDefault) {
      await this.clearDefaultProvider(request.teamId);
    }

    this.providers.set(provider.id, provider);
    this.emitEvent('provider.created', provider.id, undefined, { provider });

    return provider;
  }

  async getProvider(providerId: string): Promise<SSOProvider | undefined> {
    this.ensureNotDisposed();
    return this.providers.get(providerId);
  }

  async getDefaultProvider(teamId?: string): Promise<SSOProvider | undefined> {
    this.ensureNotDisposed();

    for (const provider of this.providers.values()) {
      if (provider.isDefault && provider.status === 'active') {
        if (teamId && provider.teamId === teamId) {
          return provider;
        }
        if (!teamId && !provider.teamId) {
          return provider;
        }
      }
    }

    return undefined;
  }

  async updateProvider(providerId: string, updates: UpdateProviderRequest): Promise<SSOProvider> {
    this.ensureNotDisposed();

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    // Handle default flag change
    if (updates.isDefault && !provider.isDefault) {
      await this.clearDefaultProvider(provider.teamId);
    }

    const updatedProvider: SSOProvider = {
      ...provider,
      name: updates.name ?? provider.name,
      isDefault: updates.isDefault ?? provider.isDefault,
      samlConfig:
        provider.type === 'saml' && updates.samlConfig
          ? { ...provider.samlConfig!, ...updates.samlConfig }
          : provider.samlConfig,
      oidcConfig:
        provider.type === 'oidc' && updates.oidcConfig
          ? { ...provider.oidcConfig!, ...updates.oidcConfig }
          : provider.oidcConfig,
      attributeMapping: updates.attributeMapping
        ? { ...provider.attributeMapping, ...updates.attributeMapping }
        : provider.attributeMapping,
      metadata: updates.metadata ? { ...provider.metadata, ...updates.metadata } : provider.metadata,
      updatedAt: new Date(),
    };

    this.providers.set(providerId, updatedProvider);
    this.emitEvent('provider.updated', providerId, undefined, { updates });

    return updatedProvider;
  }

  async deleteProvider(providerId: string): Promise<boolean> {
    this.ensureNotDisposed();

    if (!this.providers.has(providerId)) {
      return false;
    }

    // Revoke all sessions for this provider
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.providerId === providerId) {
        this.sessions.delete(sessionId);
      }
    }

    this.providers.delete(providerId);
    this.emitEvent('provider.deleted', providerId, undefined, {});

    return true;
  }

  async getProviders(teamId?: string): Promise<SSOProvider[]> {
    this.ensureNotDisposed();

    let providers = Array.from(this.providers.values());

    if (teamId !== undefined) {
      providers = providers.filter((p) => p.teamId === teamId);
    }

    return providers;
  }

  async activateProvider(providerId: string): Promise<SSOProvider> {
    this.ensureNotDisposed();

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    // Validate before activating
    const validation = await this.validateProvider(providerId);
    if (!validation.valid) {
      throw new Error(`Provider validation failed: ${validation.errors.join(', ')}`);
    }

    provider.status = 'active';
    provider.updatedAt = new Date();
    this.providers.set(providerId, provider);

    this.emitEvent('provider.activated', providerId, undefined, {});

    return provider;
  }

  async deactivateProvider(providerId: string): Promise<SSOProvider> {
    this.ensureNotDisposed();

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    provider.status = 'inactive';
    provider.updatedAt = new Date();
    this.providers.set(providerId, provider);

    this.emitEvent('provider.deactivated', providerId, undefined, {});

    return provider;
  }

  async validateProvider(providerId: string): Promise<ProviderValidationResult> {
    this.ensureNotDisposed();

    const provider = this.providers.get(providerId);
    if (!provider) {
      return { valid: false, errors: ['Provider not found'], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (provider.type === 'saml') {
      const config = provider.samlConfig!;

      // Required fields
      if (!config.idpEntityId) errors.push('IdP Entity ID is required');
      if (!config.idpSsoUrl) errors.push('IdP SSO URL is required');
      if (!config.idpCertificate) errors.push('IdP Certificate is required');

      // Validate certificate format
      if (config.idpCertificate && !this.isValidCertificate(config.idpCertificate)) {
        errors.push('IdP Certificate is not in valid PEM format');
      }

      // Warnings
      if (!config.idpSloUrl) warnings.push('IdP SLO URL not configured - single logout disabled');
      if (!config.spCertificate && config.signAuthnRequests) {
        warnings.push('SP Certificate not configured - request signing disabled');
      }
    } else if (provider.type === 'oidc') {
      const config = provider.oidcConfig!;

      // Required fields
      if (!config.clientId) errors.push('Client ID is required');
      if (!config.clientSecret) errors.push('Client Secret is required');
      if (!config.issuer) errors.push('Issuer is required');
      if (!config.authorizationUrl) errors.push('Authorization URL is required');
      if (!config.tokenUrl) errors.push('Token URL is required');

      // Warnings
      if (!config.jwksUri) warnings.push('JWKS URI not configured - token validation limited');
      if (!config.endSessionUrl) warnings.push('End Session URL not configured - SSO logout disabled');
    }

    // Validate attribute mapping
    if (!provider.attributeMapping.userId) errors.push('User ID attribute mapping is required');
    if (!provider.attributeMapping.email) errors.push('Email attribute mapping is required');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==================== Authentication ====================

  async startAuthentication(providerId: string, redirectUrl: string): Promise<AuthenticationRequest> {
    this.ensureNotDisposed();

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.status !== 'active') {
      throw new Error('Provider is not active');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    const request: AuthenticationRequest = {
      id: randomUUID(),
      providerId,
      state: this.generateSecureRandom(32),
      nonce: provider.type === 'oidc' ? this.generateSecureRandom(32) : undefined,
      codeVerifier:
        provider.type === 'oidc' && provider.oidcConfig?.pkceEnabled
          ? this.generateSecureRandom(64)
          : undefined,
      relayState: provider.type === 'saml' ? this.generateSecureRandom(32) : undefined,
      redirectUrl,
      createdAt: now,
      expiresAt,
    };

    this.authRequests.set(request.id, request);
    this.emitEvent('auth.started', providerId, undefined, { requestId: request.id });

    return request;
  }

  async getAuthenticationUrl(request: AuthenticationRequest): Promise<string> {
    this.ensureNotDisposed();

    const provider = this.providers.get(request.providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.type === 'saml') {
      return this.buildSAMLAuthUrl(provider, request);
    } else {
      return this.buildOIDCAuthUrl(provider, request);
    }
  }

  async handleAuthenticationResponse(
    providerId: string,
    response: AuthenticationResponse,
    requestId: string
  ): Promise<SSOAuthResult> {
    this.ensureNotDisposed();

    const provider = this.providers.get(providerId);
    if (!provider) {
      return { success: false, error: 'Provider not found', errorCode: 'PROVIDER_NOT_FOUND' };
    }

    const authRequest = this.authRequests.get(requestId);
    if (!authRequest) {
      return { success: false, error: 'Authentication request not found', errorCode: 'REQUEST_NOT_FOUND' };
    }

    // Verify request hasn't expired
    if (new Date() > authRequest.expiresAt) {
      this.authRequests.delete(requestId);
      return { success: false, error: 'Authentication request expired', errorCode: 'REQUEST_EXPIRED' };
    }

    // Handle error responses
    if (response.error) {
      this.emitEvent('auth.failed', providerId, undefined, {
        error: response.error,
        description: response.errorDescription,
      });
      return {
        success: false,
        error: response.errorDescription || response.error,
        errorCode: response.error,
      };
    }

    try {
      let userIdentity: SSOUserIdentity;

      if (provider.type === 'saml') {
        // Verify relay state
        if (response.relayState !== authRequest.relayState) {
          throw new Error('Invalid relay state');
        }

        userIdentity = await this.processSAMLResponse(provider, response.samlResponse!);
      } else {
        // Verify state
        if (response.state !== authRequest.state) {
          throw new Error('Invalid state parameter');
        }

        userIdentity = await this.processOIDCResponse(provider, response, authRequest);
      }

      // Create session
      const session = await this.createSession(provider, userIdentity, response);

      // Clean up auth request
      this.authRequests.delete(requestId);

      this.emitEvent('auth.success', providerId, session.id, {
        userId: userIdentity.providerUserId,
      });

      return {
        success: true,
        session,
        userIdentity,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitEvent('auth.failed', providerId, undefined, { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
        errorCode: 'AUTH_FAILED',
      };
    }
  }

  async refreshSession(sessionId: string): Promise<SSOSession> {
    this.ensureNotDisposed();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const provider = this.providers.get(session.providerId);
    if (!provider || provider.type !== 'oidc') {
      throw new Error('Session refresh only supported for OIDC providers');
    }

    if (!session.refreshToken) {
      throw new Error('No refresh token available');
    }

    // In a real implementation, this would call the token endpoint
    // For now, simulate token refresh
    const now = new Date();
    session.accessToken = this.generateSecureRandom(64);
    session.tokenExpiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    session.lastActivityAt = now;

    this.sessions.set(sessionId, session);
    this.emitEvent('session.refreshed', provider.id, sessionId, {});

    return session;
  }

  // ==================== Session Management ====================

  async getSession(sessionId: string): Promise<SSOSession | undefined> {
    this.ensureNotDisposed();
    return this.sessions.get(sessionId);
  }

  async getUserSessions(providerUserId: string): Promise<SSOSession[]> {
    this.ensureNotDisposed();

    return Array.from(this.sessions.values()).filter(
      (s) => s.userIdentity.providerUserId === providerUserId && s.status === 'active'
    );
  }

  async validateSession(sessionId: string): Promise<boolean> {
    this.ensureNotDisposed();

    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      session.status = 'expired';
      this.sessions.set(sessionId, session);
      this.emitEvent('session.expired', session.providerId, sessionId, {});
      return false;
    }

    // Check if revoked
    if (session.status !== 'active') {
      return false;
    }

    // Check token expiry for OIDC sessions
    if (session.tokenExpiry && new Date() > session.tokenExpiry) {
      // Try to refresh
      try {
        await this.refreshSession(sessionId);
      } catch {
        session.status = 'expired';
        this.sessions.set(sessionId, session);
        return false;
      }
    }

    // Update last activity
    session.lastActivityAt = new Date();
    this.sessions.set(sessionId, session);

    return true;
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    this.ensureNotDisposed();

    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'revoked';
    this.sessions.set(sessionId, session);
    this.emitEvent('session.revoked', session.providerId, sessionId, {});

    return true;
  }

  async revokeUserSessions(providerUserId: string): Promise<number> {
    this.ensureNotDisposed();

    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userIdentity.providerUserId === providerUserId && session.status === 'active') {
        await this.revokeSession(session.id);
        count++;
      }
    }

    return count;
  }

  // ==================== Logout ====================

  async logout(request: LogoutRequest): Promise<LogoutResult> {
    this.ensureNotDisposed();

    const session = this.sessions.get(request.sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    this.emitEvent('logout.started', session.providerId, session.id, {
      singleLogout: request.singleLogout,
    });

    // Revoke local session
    await this.revokeSession(request.sessionId);

    // If single logout requested, build logout URL
    if (request.singleLogout) {
      const provider = this.providers.get(session.providerId);
      if (provider) {
        let logoutUrl: string | undefined;

        if (provider.type === 'saml' && provider.samlConfig?.idpSloUrl) {
          logoutUrl = this.buildSAMLLogoutUrl(provider, session);
        } else if (provider.type === 'oidc' && provider.oidcConfig?.endSessionUrl) {
          logoutUrl = this.buildOIDCLogoutUrl(provider, session);
        }

        if (logoutUrl) {
          this.emitEvent('logout.success', session.providerId, session.id, {});
          return { success: true, logoutUrl };
        }
      }
    }

    this.emitEvent('logout.success', session.providerId, session.id, {});
    return { success: true };
  }

  async handleLogoutResponse(providerId: string, _response: string): Promise<LogoutResult> {
    this.ensureNotDisposed();

    const provider = this.providers.get(providerId);
    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    // In a real implementation, validate the logout response
    // For now, just return success
    return { success: true };
  }

  // ==================== Service Provider Metadata ====================

  async getSAMLMetadata(providerId: string): Promise<string> {
    this.ensureNotDisposed();

    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'saml') {
      throw new Error('SAML provider not found');
    }

    const config = provider.samlConfig!;

    // Generate SAML SP metadata XML
    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="${config.entityId}">
  <SPSSODescriptor AuthnRequestsSigned="${config.signAuthnRequests}"
                   WantAssertionsSigned="${config.wantAssertionsSigned}"
                   protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>${config.nameIdFormat}</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                              Location="${config.acsUrl}"
                              index="0" isDefault="true"/>
    ${
      config.sloUrl
        ? `<SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                            Location="${config.sloUrl}"/>`
        : ''
    }
  </SPSSODescriptor>
</EntityDescriptor>`;

    return metadata;
  }

  async getOIDCDiscoveryDocument(): Promise<Record<string, unknown>> {
    this.ensureNotDisposed();

    // This would be the OIDC discovery document for the service
    return {
      issuer: this.baseUrl,
      authorization_endpoint: `${this.baseUrl}/oauth/authorize`,
      token_endpoint: `${this.baseUrl}/oauth/token`,
      userinfo_endpoint: `${this.baseUrl}/oauth/userinfo`,
      jwks_uri: `${this.baseUrl}/.well-known/jwks.json`,
      response_types_supported: ['code', 'token', 'id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'profile', 'email'],
    };
  }

  // ==================== Events ====================

  onSSOEvent(handler: (event: SSOEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  // ==================== Lifecycle ====================

  dispose(): void {
    this.disposed = true;
    this.providers.clear();
    this.sessions.clear();
    this.authRequests.clear();
    this.eventHandlers.clear();
  }

  // ==================== Private Helpers ====================

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('SSOManager has been disposed');
    }
  }

  private emitEvent(
    type: SSOEventType,
    providerId: string | undefined,
    sessionId: string | undefined,
    data: Record<string, unknown>
  ): void {
    const event: SSOEvent = {
      type,
      providerId,
      sessionId,
      data,
      timestamp: new Date(),
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  private async clearDefaultProvider(teamId?: string): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.isDefault && provider.teamId === teamId) {
        provider.isDefault = false;
        provider.updatedAt = new Date();
      }
    }
  }

  private generateSecureRandom(length: number): string {
    return randomBytes(length).toString('base64url');
  }

  private isValidCertificate(cert: string): boolean {
    return cert.includes('BEGIN CERTIFICATE') && cert.includes('END CERTIFICATE');
  }

  private buildSAMLAuthUrl(provider: SSOProvider, request: AuthenticationRequest): string {
    const config = provider.samlConfig!;

    // In a real implementation, this would build a proper SAML AuthnRequest
    const params = new URLSearchParams({
      SAMLRequest: this.buildSAMLAuthnRequest(provider, request),
      RelayState: request.relayState || '',
    });

    return `${config.idpSsoUrl}?${params.toString()}`;
  }

  private buildSAMLAuthnRequest(_provider: SSOProvider, request: AuthenticationRequest): string {
    // Simplified - in reality, this would be a proper SAML XML document
    return Buffer.from(
      JSON.stringify({
        id: request.id,
        issueInstant: new Date().toISOString(),
      })
    ).toString('base64');
  }

  private buildOIDCAuthUrl(provider: SSOProvider, request: AuthenticationRequest): string {
    const config = provider.oidcConfig!;

    const params = new URLSearchParams({
      response_type: config.responseType,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state: request.state,
    });

    if (config.nonceEnabled && request.nonce) {
      params.append('nonce', request.nonce);
    }

    if (config.pkceEnabled && request.codeVerifier) {
      const codeChallenge = createHash('sha256')
        .update(request.codeVerifier)
        .digest('base64url');
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  private async processSAMLResponse(
    provider: SSOProvider,
    _samlResponse: string
  ): Promise<SSOUserIdentity> {
    // In a real implementation, this would parse and validate the SAML assertion
    // and use provider.attributeMapping to map attributes
    // For now, simulate parsing
    return {
      providerId: provider.id,
      providerUserId: 'saml-user-' + randomUUID(),
      email: 'user@example.com',
      displayName: 'SAML User',
      rawAttributes: {},
      retrievedAt: new Date(),
    };
  }

  private async processOIDCResponse(
    provider: SSOProvider,
    _response: AuthenticationResponse,
    _request: AuthenticationRequest
  ): Promise<SSOUserIdentity> {
    // In a real implementation, this would:
    // 1. Exchange the authorization code for tokens using provider.oidcConfig
    // 2. Validate the ID token
    // 3. Optionally call the userinfo endpoint
    // 4. Map attributes using provider.attributeMapping
    // For now, simulate the process
    return {
      providerId: provider.id,
      providerUserId: 'oidc-user-' + randomUUID(),
      email: 'user@example.com',
      displayName: 'OIDC User',
      rawAttributes: {},
      retrievedAt: new Date(),
    };
  }

  private async createSession(
    provider: SSOProvider,
    userIdentity: SSOUserIdentity,
    response: AuthenticationResponse
  ): Promise<SSOSession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours

    const session: SSOSession = {
      id: randomUUID(),
      providerId: provider.id,
      userIdentity,
      status: 'active',
      accessToken: response.accessToken,
      idToken: response.idToken,
      tokenExpiry: response.accessToken ? new Date(now.getTime() + 60 * 60 * 1000) : undefined,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
    };

    this.sessions.set(session.id, session);
    this.emitEvent('session.created', provider.id, session.id, {
      userId: userIdentity.providerUserId,
    });

    return session;
  }

  private buildSAMLLogoutUrl(provider: SSOProvider, session: SSOSession): string {
    const config = provider.samlConfig!;

    // In a real implementation, this would build a proper SAML LogoutRequest
    const params = new URLSearchParams({
      SAMLRequest: Buffer.from(
        JSON.stringify({
          sessionIndex: session.sessionIndex,
          nameId: session.userIdentity.providerUserId,
        })
      ).toString('base64'),
    });

    return `${config.idpSloUrl}?${params.toString()}`;
  }

  private buildOIDCLogoutUrl(provider: SSOProvider, session: SSOSession): string {
    const config = provider.oidcConfig!;

    const params = new URLSearchParams();

    if (session.idToken) {
      params.append('id_token_hint', session.idToken);
    }

    if (config.postLogoutRedirectUri) {
      params.append('post_logout_redirect_uri', config.postLogoutRedirectUri);
    }

    return `${config.endSessionUrl}?${params.toString()}`;
  }
}
