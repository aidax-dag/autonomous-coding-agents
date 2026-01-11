/**
 * SSO Manager Tests
 *
 * Feature: F5.12 - SSO Integration
 */

import {
  SSOManager,
  type CreateSAMLProviderRequest,
  type CreateOIDCProviderRequest,
} from '../../../../src/core/enterprise/sso/index.js';

describe('SSOManager', () => {
  let manager: SSOManager;

  const mockSAMLRequest: CreateSAMLProviderRequest = {
    name: 'Test SAML Provider',
    config: {
      idpEntityId: 'https://idp.example.com',
      idpSsoUrl: 'https://idp.example.com/sso',
      idpSloUrl: 'https://idp.example.com/slo',
      idpCertificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
      binding: 'HTTP-POST',
      signAuthnRequests: true,
      wantAssertionsSigned: true,
      wantAssertionsEncrypted: false,
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      allowedClockSkew: 300,
      forceAuthn: false,
    },
    attributeMapping: {
      userId: 'nameId',
      email: 'email',
      displayName: 'displayName',
    },
  };

  const mockOIDCRequest: CreateOIDCProviderRequest = {
    name: 'Test OIDC Provider',
    config: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      issuer: 'https://idp.example.com',
      authorizationUrl: 'https://idp.example.com/authorize',
      tokenUrl: 'https://idp.example.com/token',
      userInfoUrl: 'https://idp.example.com/userinfo',
      jwksUri: 'https://idp.example.com/.well-known/jwks.json',
      endSessionUrl: 'https://idp.example.com/logout',
      responseType: 'code',
      grantType: 'authorization_code',
      scopes: ['openid', 'profile', 'email'],
      pkceEnabled: true,
      stateEnabled: true,
      nonceEnabled: true,
      tokenSignatureAlgorithm: 'RS256',
      allowedClockSkew: 300,
    },
    attributeMapping: {
      userId: 'sub',
      email: 'email',
      displayName: 'name',
    },
  };

  beforeEach(() => {
    manager = new SSOManager('http://localhost:3000');
  });

  afterEach(() => {
    manager.dispose();
  });

  // ==================== Provider Management ====================

  describe('Provider Management', () => {
    describe('createSAMLProvider', () => {
      it('should create a SAML provider', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);

        expect(provider.id).toBeDefined();
        expect(provider.name).toBe('Test SAML Provider');
        expect(provider.type).toBe('saml');
        expect(provider.status).toBe('configuring');
        expect(provider.samlConfig).toBeDefined();
        expect(provider.samlConfig?.entityId).toContain('/sso/saml/');
        expect(provider.samlConfig?.acsUrl).toContain('/sso/saml/acs/');
      });

      it('should set default provider when requested', async () => {
        const provider = await manager.createSAMLProvider({
          ...mockSAMLRequest,
          isDefault: true,
        });

        expect(provider.isDefault).toBe(true);

        const defaultProvider = await manager.getDefaultProvider();
        expect(defaultProvider).toBeUndefined(); // Not active yet
      });

      it('should emit provider.created event', async () => {
        const handler = jest.fn();
        manager.onSSOEvent(handler);

        await manager.createSAMLProvider(mockSAMLRequest);

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'provider.created',
          })
        );
      });
    });

    describe('createOIDCProvider', () => {
      it('should create an OIDC provider', async () => {
        const provider = await manager.createOIDCProvider(mockOIDCRequest);

        expect(provider.id).toBeDefined();
        expect(provider.name).toBe('Test OIDC Provider');
        expect(provider.type).toBe('oidc');
        expect(provider.status).toBe('configuring');
        expect(provider.oidcConfig).toBeDefined();
        expect(provider.oidcConfig?.redirectUri).toContain('/sso/oidc/callback/');
      });

      it('should apply default OIDC config values', async () => {
        const minimalRequest: CreateOIDCProviderRequest = {
          name: 'Minimal OIDC',
          config: {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            issuer: 'https://idp.example.com',
            authorizationUrl: 'https://idp.example.com/authorize',
            tokenUrl: 'https://idp.example.com/token',
            responseType: 'code',
            grantType: 'authorization_code',
            scopes: ['openid'],
            pkceEnabled: true,
            stateEnabled: true,
            nonceEnabled: true,
            tokenSignatureAlgorithm: 'RS256',
            allowedClockSkew: 300,
          },
          attributeMapping: {
            userId: 'sub',
            email: 'email',
          },
        };

        const provider = await manager.createOIDCProvider(minimalRequest);

        expect(provider.oidcConfig?.scopes).toContain('openid');
      });
    });

    describe('getProvider', () => {
      it('should get provider by ID', async () => {
        const created = await manager.createSAMLProvider(mockSAMLRequest);
        const retrieved = await manager.getProvider(created.id);

        expect(retrieved).toEqual(created);
      });

      it('should return undefined for non-existent provider', async () => {
        const retrieved = await manager.getProvider('non-existent');

        expect(retrieved).toBeUndefined();
      });
    });

    describe('updateProvider', () => {
      it('should update provider name', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        const updated = await manager.updateProvider(provider.id, {
          name: 'Updated Provider',
        });

        expect(updated.name).toBe('Updated Provider');
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(provider.updatedAt.getTime());
      });

      it('should update SAML config', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        const updated = await manager.updateProvider(provider.id, {
          samlConfig: {
            forceAuthn: true,
          },
        });

        expect(updated.samlConfig?.forceAuthn).toBe(true);
        // Original config preserved
        expect(updated.samlConfig?.idpEntityId).toBe('https://idp.example.com');
      });

      it('should update OIDC config', async () => {
        const provider = await manager.createOIDCProvider(mockOIDCRequest);
        const updated = await manager.updateProvider(provider.id, {
          oidcConfig: {
            scopes: ['openid', 'profile', 'email', 'groups'],
          },
        });

        expect(updated.oidcConfig?.scopes).toContain('groups');
      });

      it('should reject non-existent provider', async () => {
        await expect(
          manager.updateProvider('non-existent', { name: 'Updated' })
        ).rejects.toThrow('Provider not found');
      });
    });

    describe('deleteProvider', () => {
      it('should delete provider', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        const result = await manager.deleteProvider(provider.id);

        expect(result).toBe(true);
        expect(await manager.getProvider(provider.id)).toBeUndefined();
      });

      it('should return false for non-existent provider', async () => {
        const result = await manager.deleteProvider('non-existent');

        expect(result).toBe(false);
      });
    });

    describe('getProviders', () => {
      it('should get all providers', async () => {
        await manager.createSAMLProvider(mockSAMLRequest);
        await manager.createOIDCProvider(mockOIDCRequest);

        const providers = await manager.getProviders();

        expect(providers).toHaveLength(2);
      });

      it('should filter by team', async () => {
        await manager.createSAMLProvider({
          ...mockSAMLRequest,
          teamId: 'team-1',
        });
        await manager.createOIDCProvider({
          ...mockOIDCRequest,
          teamId: 'team-2',
        });

        const team1Providers = await manager.getProviders('team-1');

        expect(team1Providers).toHaveLength(1);
        expect(team1Providers[0].teamId).toBe('team-1');
      });
    });

    describe('activateProvider', () => {
      it('should activate a valid provider', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        const activated = await manager.activateProvider(provider.id);

        expect(activated.status).toBe('active');
      });

      it('should set as default provider when activated and is default', async () => {
        const provider = await manager.createSAMLProvider({
          ...mockSAMLRequest,
          isDefault: true,
        });

        await manager.activateProvider(provider.id);

        const defaultProvider = await manager.getDefaultProvider();
        expect(defaultProvider?.id).toBe(provider.id);
      });

      it('should reject invalid provider', async () => {
        const provider = await manager.createSAMLProvider({
          ...mockSAMLRequest,
          config: {
            ...mockSAMLRequest.config,
            idpEntityId: '', // Invalid - required field
          },
        });

        await expect(manager.activateProvider(provider.id)).rejects.toThrow('validation failed');
      });
    });

    describe('deactivateProvider', () => {
      it('should deactivate provider', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        await manager.activateProvider(provider.id);

        const deactivated = await manager.deactivateProvider(provider.id);

        expect(deactivated.status).toBe('inactive');
      });
    });

    describe('validateProvider', () => {
      it('should validate SAML provider', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        const result = await manager.validateProvider(provider.id);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing required fields', async () => {
        const provider = await manager.createSAMLProvider({
          ...mockSAMLRequest,
          config: {
            ...mockSAMLRequest.config,
            idpEntityId: '',
            idpSsoUrl: '',
          },
        });

        const result = await manager.validateProvider(provider.id);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should validate OIDC provider', async () => {
        const provider = await manager.createOIDCProvider(mockOIDCRequest);
        const result = await manager.validateProvider(provider.id);

        expect(result.valid).toBe(true);
      });

      it('should warn about missing optional fields', async () => {
        const provider = await manager.createSAMLProvider({
          ...mockSAMLRequest,
          config: {
            ...mockSAMLRequest.config,
            idpSloUrl: undefined, // Optional but recommended
          },
        });

        const result = await manager.validateProvider(provider.id);

        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });
  });

  // ==================== Authentication ====================

  describe('Authentication', () => {
    describe('startAuthentication', () => {
      it('should start SAML authentication', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        await manager.activateProvider(provider.id);

        const request = await manager.startAuthentication(provider.id, '/dashboard');

        expect(request.id).toBeDefined();
        expect(request.providerId).toBe(provider.id);
        expect(request.state).toBeDefined();
        expect(request.relayState).toBeDefined();
        expect(request.redirectUrl).toBe('/dashboard');
      });

      it('should start OIDC authentication with PKCE', async () => {
        const provider = await manager.createOIDCProvider(mockOIDCRequest);
        await manager.activateProvider(provider.id);

        const request = await manager.startAuthentication(provider.id, '/dashboard');

        expect(request.state).toBeDefined();
        expect(request.nonce).toBeDefined();
        expect(request.codeVerifier).toBeDefined();
      });

      it('should reject inactive provider', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);

        await expect(
          manager.startAuthentication(provider.id, '/dashboard')
        ).rejects.toThrow('not active');
      });
    });

    describe('getAuthenticationUrl', () => {
      it('should build SAML auth URL', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        await manager.activateProvider(provider.id);

        const request = await manager.startAuthentication(provider.id, '/dashboard');
        const url = await manager.getAuthenticationUrl(request);

        expect(url).toContain('https://idp.example.com/sso');
        expect(url).toContain('SAMLRequest');
        expect(url).toContain('RelayState');
      });

      it('should build OIDC auth URL', async () => {
        const provider = await manager.createOIDCProvider(mockOIDCRequest);
        await manager.activateProvider(provider.id);

        const request = await manager.startAuthentication(provider.id, '/dashboard');
        const url = await manager.getAuthenticationUrl(request);

        expect(url).toContain('https://idp.example.com/authorize');
        expect(url).toContain('client_id=test-client-id');
        expect(url).toContain('state=');
        expect(url).toContain('code_challenge=');
      });
    });

    describe('handleAuthenticationResponse', () => {
      it('should handle SAML response', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        await manager.activateProvider(provider.id);

        const request = await manager.startAuthentication(provider.id, '/dashboard');

        const result = await manager.handleAuthenticationResponse(
          provider.id,
          {
            type: 'saml',
            samlResponse: Buffer.from('mock-response').toString('base64'),
            relayState: request.relayState,
          },
          request.id
        );

        expect(result.success).toBe(true);
        expect(result.session).toBeDefined();
        expect(result.userIdentity).toBeDefined();
      });

      it('should handle OIDC response', async () => {
        const provider = await manager.createOIDCProvider(mockOIDCRequest);
        await manager.activateProvider(provider.id);

        const request = await manager.startAuthentication(provider.id, '/dashboard');

        const result = await manager.handleAuthenticationResponse(
          provider.id,
          {
            type: 'oidc',
            code: 'mock-auth-code',
            state: request.state,
          },
          request.id
        );

        expect(result.success).toBe(true);
        expect(result.session).toBeDefined();
      });

      it('should reject invalid state', async () => {
        const provider = await manager.createOIDCProvider(mockOIDCRequest);
        await manager.activateProvider(provider.id);

        const request = await manager.startAuthentication(provider.id, '/dashboard');

        const result = await manager.handleAuthenticationResponse(
          provider.id,
          {
            type: 'oidc',
            code: 'mock-auth-code',
            state: 'invalid-state',
          },
          request.id
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('state');
      });

      it('should handle error response', async () => {
        const provider = await manager.createOIDCProvider(mockOIDCRequest);
        await manager.activateProvider(provider.id);

        const request = await manager.startAuthentication(provider.id, '/dashboard');

        const result = await manager.handleAuthenticationResponse(
          provider.id,
          {
            type: 'oidc',
            error: 'access_denied',
            errorDescription: 'User denied access',
          },
          request.id
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('User denied access');
        expect(result.errorCode).toBe('access_denied');
      });
    });
  });

  // ==================== Session Management ====================

  describe('Session Management', () => {
    let provider: Awaited<ReturnType<typeof manager.createOIDCProvider>>;
    let session: NonNullable<Awaited<ReturnType<typeof manager.handleAuthenticationResponse>>['session']>;

    beforeEach(async () => {
      provider = await manager.createOIDCProvider(mockOIDCRequest);
      await manager.activateProvider(provider.id);

      const request = await manager.startAuthentication(provider.id, '/dashboard');
      const result = await manager.handleAuthenticationResponse(
        provider.id,
        {
          type: 'oidc',
          code: 'mock-code',
          state: request.state,
        },
        request.id
      );

      session = result.session!;
    });

    describe('getSession', () => {
      it('should get session by ID', async () => {
        const retrieved = await manager.getSession(session.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(session.id);
      });

      it('should return undefined for non-existent session', async () => {
        const retrieved = await manager.getSession('non-existent');

        expect(retrieved).toBeUndefined();
      });
    });

    describe('getUserSessions', () => {
      it('should get sessions for a user', async () => {
        const sessions = await manager.getUserSessions(session.userIdentity.providerUserId);

        expect(sessions).toHaveLength(1);
        expect(sessions[0].id).toBe(session.id);
      });
    });

    describe('validateSession', () => {
      it('should validate active session', async () => {
        const valid = await manager.validateSession(session.id);

        expect(valid).toBe(true);
      });

      it('should return false for non-existent session', async () => {
        const valid = await manager.validateSession('non-existent');

        expect(valid).toBe(false);
      });

      it('should return false for revoked session', async () => {
        await manager.revokeSession(session.id);

        const valid = await manager.validateSession(session.id);

        expect(valid).toBe(false);
      });
    });

    describe('revokeSession', () => {
      it('should revoke session', async () => {
        const result = await manager.revokeSession(session.id);

        expect(result).toBe(true);

        const retrieved = await manager.getSession(session.id);
        expect(retrieved?.status).toBe('revoked');
      });

      it('should return false for non-existent session', async () => {
        const result = await manager.revokeSession('non-existent');

        expect(result).toBe(false);
      });
    });

    describe('revokeUserSessions', () => {
      it('should revoke all sessions for user', async () => {
        // Revoke the session from beforeEach
        const count = await manager.revokeUserSessions(session.userIdentity.providerUserId);

        // Should revoke at least 1 session (the one created in beforeEach)
        expect(count).toBeGreaterThanOrEqual(1);

        // Verify session is revoked
        const retrieved = await manager.getSession(session.id);
        expect(retrieved?.status).toBe('revoked');
      });
    });
  });

  // ==================== Logout ====================

  describe('Logout', () => {
    let provider: Awaited<ReturnType<typeof manager.createOIDCProvider>>;
    let session: NonNullable<Awaited<ReturnType<typeof manager.handleAuthenticationResponse>>['session']>;

    beforeEach(async () => {
      provider = await manager.createOIDCProvider(mockOIDCRequest);
      await manager.activateProvider(provider.id);

      const request = await manager.startAuthentication(provider.id, '/dashboard');
      const result = await manager.handleAuthenticationResponse(
        provider.id,
        {
          type: 'oidc',
          code: 'mock-code',
          state: request.state,
          idToken: 'mock-id-token',
        },
        request.id
      );

      session = result.session!;
    });

    describe('logout', () => {
      it('should logout locally', async () => {
        const result = await manager.logout({
          sessionId: session.id,
          singleLogout: false,
        });

        expect(result.success).toBe(true);

        const retrieved = await manager.getSession(session.id);
        expect(retrieved?.status).toBe('revoked');
      });

      it('should return logout URL for single logout', async () => {
        const result = await manager.logout({
          sessionId: session.id,
          singleLogout: true,
        });

        expect(result.success).toBe(true);
        expect(result.logoutUrl).toContain('https://idp.example.com/logout');
      });

      it('should return error for non-existent session', async () => {
        const result = await manager.logout({
          sessionId: 'non-existent',
          singleLogout: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Session not found');
      });
    });
  });

  // ==================== Service Provider Metadata ====================

  describe('Service Provider Metadata', () => {
    describe('getSAMLMetadata', () => {
      it('should generate SAML SP metadata', async () => {
        const provider = await manager.createSAMLProvider(mockSAMLRequest);
        const metadata = await manager.getSAMLMetadata(provider.id);

        expect(metadata).toContain('EntityDescriptor');
        expect(metadata).toContain('SPSSODescriptor');
        expect(metadata).toContain('AssertionConsumerService');
      });

      it('should reject for OIDC provider', async () => {
        const provider = await manager.createOIDCProvider(mockOIDCRequest);

        await expect(manager.getSAMLMetadata(provider.id)).rejects.toThrow('SAML provider not found');
      });
    });

    describe('getOIDCDiscoveryDocument', () => {
      it('should return discovery document', async () => {
        const doc = await manager.getOIDCDiscoveryDocument();

        expect(doc.issuer).toBeDefined();
        expect(doc.authorization_endpoint).toBeDefined();
        expect(doc.token_endpoint).toBeDefined();
      });
    });
  });

  // ==================== Events ====================

  describe('Events', () => {
    it('should subscribe and unsubscribe from events', async () => {
      const handler = jest.fn();
      const unsubscribe = manager.onSSOEvent(handler);

      await manager.createSAMLProvider(mockSAMLRequest);

      expect(handler).toHaveBeenCalled();

      unsubscribe();
      handler.mockClear();

      await manager.createOIDCProvider(mockOIDCRequest);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==================== Lifecycle ====================

  describe('Lifecycle', () => {
    it('should throw after dispose', async () => {
      manager.dispose();

      await expect(manager.createSAMLProvider(mockSAMLRequest)).rejects.toThrow('disposed');
    });

    it('should clean up data on dispose', async () => {
      await manager.createSAMLProvider(mockSAMLRequest);

      manager.dispose();

      // Create new manager to verify old data is gone
      const newManager = new SSOManager();
      const providers = await newManager.getProviders();

      expect(providers).toHaveLength(0);

      newManager.dispose();
    });
  });
});
