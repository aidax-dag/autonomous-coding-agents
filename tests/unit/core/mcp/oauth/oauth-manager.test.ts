/**
 * OAuth Manager Tests
 *
 * Comprehensive tests for the OAuthManager covering token acquisition,
 * management, refresh, auto-refresh scheduling, header generation,
 * PKCE utilities, error handling, and factory/dispose lifecycle.
 */

jest.mock('../../../../../src/shared/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import {
  OAuthManager,
  createOAuthManager,
} from '../../../../../src/core/mcp/oauth/oauth-manager';
import type {
  OAuthConfig,
  OAuthTokenResponse,
} from '../../../../../src/core/mcp/oauth/types';
import {
  generatePKCE,
  generateCodeVerifier,
  generateCodeChallenge,
} from '../../../../../src/core/mcp/oauth/pkce';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOAuthConfig(overrides: Partial<OAuthConfig> = {}): OAuthConfig {
  return {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    authorizationUrl: 'https://auth.example.com/authorize',
    tokenUrl: 'https://auth.example.com/token',
    scopes: ['read', 'write'],
    ...overrides,
  };
}

function makeTokenResponse(overrides: Partial<OAuthTokenResponse> = {}): OAuthTokenResponse {
  return {
    access_token: 'test-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'test-refresh-token',
    scope: 'read write',
    ...overrides,
  };
}

function createMockFetcher(
  response?: OAuthTokenResponse | Error,
): jest.Mock<Promise<OAuthTokenResponse>, [string, Record<string, string>, Record<string, string>?]> {
  const fetcher = jest.fn<Promise<OAuthTokenResponse>, [string, Record<string, string>, Record<string, string>?]>();
  if (response instanceof Error) {
    fetcher.mockRejectedValue(response);
  } else {
    fetcher.mockResolvedValue(response ?? makeTokenResponse());
  }
  return fetcher;
}

/**
 * Flush all pending microtasks/promises without advancing timers further.
 */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => jest.requireActual<typeof globalThis>('timers').setImmediate(resolve));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OAuthManager', () => {
  let manager: OAuthManager;
  let mockFetcher: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetcher = createMockFetcher();
    manager = new OAuthManager({ tokenFetcher: mockFetcher });
  });

  afterEach(() => {
    manager.dispose();
    jest.useRealTimers();
  });

  // ========================================================================
  // Token Acquisition
  // ========================================================================

  describe('acquireClientCredentials', () => {
    it('should call tokenUrl with correct params', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-1', config);

      expect(mockFetcher).toHaveBeenCalledTimes(1);
      expect(mockFetcher).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          grant_type: 'client_credentials',
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          scope: 'read write',
        }),
      );
    });

    it('should store the token with correct expiry', async () => {
      const config = makeOAuthConfig();
      const now = Date.now();
      const token = await manager.acquireClientCredentials('server-1', config);

      expect(token.accessToken).toBe('test-access-token');
      expect(token.tokenType).toBe('Bearer');
      expect(token.refreshToken).toBe('test-refresh-token');
      expect(token.expiresAt).toBeGreaterThanOrEqual(now + 3600 * 1000 - 100);
      expect(token.expiresAt).toBeLessThanOrEqual(now + 3600 * 1000 + 100);
      expect(manager.hasValidToken('server-1')).toBe(true);
    });

    it('should emit token:acquired event', async () => {
      const config = makeOAuthConfig();
      const handler = jest.fn();
      manager.on('token:acquired', handler);

      await manager.acquireClientCredentials('server-1', config);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          serverName: 'server-1',
          expiresAt: expect.any(Number),
        }),
      );
    });

    it('should omit client_secret for public clients', async () => {
      const config = makeOAuthConfig({ clientSecret: undefined });
      await manager.acquireClientCredentials('server-pub', config);

      const callBody = mockFetcher.mock.calls[0][1] as Record<string, string>;
      expect(callBody.client_secret).toBeUndefined();
    });

    it('should omit scope when no scopes configured', async () => {
      const config = makeOAuthConfig({ scopes: undefined });
      await manager.acquireClientCredentials('server-noscope', config);

      const callBody = mockFetcher.mock.calls[0][1] as Record<string, string>;
      expect(callBody.scope).toBeUndefined();
    });

    it('should throw a descriptive error on token fetch failure', async () => {
      const failFetcher = createMockFetcher(new Error('Connection refused'));
      const failManager = new OAuthManager({ tokenFetcher: failFetcher });

      const config = makeOAuthConfig();
      await expect(
        failManager.acquireClientCredentials('server-fail', config),
      ).rejects.toThrow('Connection refused');

      failManager.dispose();
    });
  });

  describe('exchangeAuthorizationCode', () => {
    it('should exchange code with correct params', async () => {
      const config = makeOAuthConfig({ redirectUri: 'http://localhost/callback' });
      await manager.exchangeAuthorizationCode('server-ac', config, 'auth-code-123');

      expect(mockFetcher).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          grant_type: 'authorization_code',
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          code: 'auth-code-123',
          redirect_uri: 'http://localhost/callback',
        }),
      );
    });

    it('should include PKCE code_verifier when provided', async () => {
      const config = makeOAuthConfig();
      await manager.exchangeAuthorizationCode(
        'server-pkce',
        config,
        'auth-code-456',
        'my-code-verifier',
      );

      const callBody = mockFetcher.mock.calls[0][1] as Record<string, string>;
      expect(callBody.code_verifier).toBe('my-code-verifier');
    });
  });

  // ========================================================================
  // Token Management
  // ========================================================================

  describe('getValidToken', () => {
    it('should return stored token when valid', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-1', config);

      const token = await manager.getValidToken('server-1');
      expect(token).not.toBeNull();
      expect(token!.accessToken).toBe('test-access-token');
    });

    it('should return null for unknown server', async () => {
      const token = await manager.getValidToken('nonexistent');
      expect(token).toBeNull();
    });

    it('should auto-refresh an expired token', async () => {
      // Acquire token with 1-second expiry (no refresh_token to avoid auto-schedule issues)
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ expires_in: 1, refresh_token: 'rt-for-manual' }),
      );

      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-exp', config);

      // Cancel the auto-scheduled refresh so we control refresh manually
      manager.cancelRefresh('server-exp');

      // Set up the refresh response
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ access_token: 'refreshed-token', expires_in: 3600 }),
      );

      // Advance past expiry + buffer
      jest.advanceTimersByTime(62_000);

      const token = await manager.getValidToken('server-exp');
      expect(token).not.toBeNull();
      expect(token!.accessToken).toBe('refreshed-token');
    });

    it('should auto-refresh near-expiry token within buffer', async () => {
      // Token that expires in 30 seconds (within default 60s buffer)
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ expires_in: 30, refresh_token: 'rt-buf' }),
      );

      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-buf', config);

      // Cancel auto-refresh timer
      manager.cancelRefresh('server-buf');

      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ access_token: 'buffer-refreshed', expires_in: 3600 }),
      );

      // Token expiresAt = now + 30s. Buffer = 60s. So it's already near-expiry.
      const token = await manager.getValidToken('server-buf');
      expect(token).not.toBeNull();
      expect(token!.accessToken).toBe('buffer-refreshed');
    });

    it('should return null and emit expired when no refresh token on expired token', async () => {
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ expires_in: 1, refresh_token: undefined }),
      );

      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-noref', config);

      jest.advanceTimersByTime(62_000);

      const expiredHandler = jest.fn();
      manager.on('token:expired', expiredHandler);

      const token = await manager.getValidToken('server-noref');
      expect(token).toBeNull();
      expect(expiredHandler).toHaveBeenCalledWith({ serverName: 'server-noref' });
    });
  });

  describe('hasValidToken', () => {
    it('should return true for valid token', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-valid', config);
      expect(manager.hasValidToken('server-valid')).toBe(true);
    });

    it('should return false for unknown server', () => {
      expect(manager.hasValidToken('nonexistent')).toBe(false);
    });

    it('should return false for expired token', async () => {
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ expires_in: 1 }),
      );

      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-stale', config);

      jest.advanceTimersByTime(2000);
      expect(manager.hasValidToken('server-stale')).toBe(false);
    });
  });

  describe('revokeToken', () => {
    it('should remove token and cancel refresh', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-revoke', config);

      expect(manager.hasValidToken('server-revoke')).toBe(true);
      const result = manager.revokeToken('server-revoke');
      expect(result).toBe(true);
      expect(manager.hasValidToken('server-revoke')).toBe(false);
    });

    it('should return false for unknown server', () => {
      const result = manager.revokeToken('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getTokenEntries', () => {
    it('should return all entries', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-a', config);
      await manager.acquireClientCredentials('server-b', config);

      const entries = manager.getTokenEntries();
      expect(entries).toHaveLength(2);

      const names = entries.map((e) => e.serverName);
      expect(names).toContain('server-a');
      expect(names).toContain('server-b');
    });

    it('should return empty array when no tokens stored', () => {
      expect(manager.getTokenEntries()).toEqual([]);
    });
  });

  // ========================================================================
  // Token Refresh
  // ========================================================================

  describe('refreshToken', () => {
    it('should use refresh_token grant', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-ref', config);
      manager.cancelRefresh('server-ref');

      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ access_token: 'new-token', expires_in: 7200 }),
      );

      await manager.refreshToken('server-ref');

      // Second call should be the refresh
      const refreshCall = mockFetcher.mock.calls[1];
      expect(refreshCall[1]).toEqual(
        expect.objectContaining({
          grant_type: 'refresh_token',
          client_id: 'test-client-id',
          refresh_token: 'test-refresh-token',
        }),
      );
    });

    it('should update stored token', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-upd', config);
      manager.cancelRefresh('server-upd');

      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ access_token: 'updated-token' }),
      );

      const refreshed = await manager.refreshToken('server-upd');
      expect(refreshed.accessToken).toBe('updated-token');

      // Cancel the re-scheduled timer from the refresh
      manager.cancelRefresh('server-upd');

      const stored = await manager.getValidToken('server-upd');
      expect(stored!.accessToken).toBe('updated-token');
    });

    it('should emit token:refreshed event', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-evt', config);
      manager.cancelRefresh('server-evt');

      const handler = jest.fn();
      manager.on('token:refreshed', handler);

      mockFetcher.mockResolvedValueOnce(makeTokenResponse());
      await manager.refreshToken('server-evt');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          serverName: 'server-evt',
          expiresAt: expect.any(Number),
        }),
      );
    });

    it('should throw when no refresh_token available', async () => {
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ refresh_token: undefined }),
      );

      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-nort', config);

      await expect(manager.refreshToken('server-nort')).rejects.toThrow(
        "No refresh token available for server 'server-nort'",
      );
    });

    it('should throw when no token stored', async () => {
      await expect(manager.refreshToken('nonexistent')).rejects.toThrow(
        "No token stored for server 'nonexistent'",
      );
    });

    it('should retry on failure up to maxRetries', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-retry', config);
      manager.cancelRefresh('server-retry');

      // All refresh attempts fail
      mockFetcher
        .mockRejectedValueOnce(new Error('Retry 1'))
        .mockRejectedValueOnce(new Error('Retry 2'))
        .mockRejectedValueOnce(new Error('Retry 3'));

      // The refreshToken method uses delay() between retries which uses setTimeout.
      // Start the refresh and attach the assertion handler immediately to avoid
      // unhandled rejection warnings, then advance timers.
      const refreshPromise = manager.refreshToken('server-retry');
      const assertion = expect(refreshPromise).rejects.toThrow(
        /Failed to refresh token.*after 3 attempts/,
      );

      // Advance past retry delay 1 (500ms) and delay 2 (1000ms)
      await jest.advanceTimersByTimeAsync(1500);
      await assertion;

      // 1 acquire + 3 retry attempts = 4 total calls
      expect(mockFetcher).toHaveBeenCalledTimes(4);
    });

    it('should succeed after initial failures within retry limit', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-retry-ok', config);
      manager.cancelRefresh('server-retry-ok');

      // First two refresh attempts fail, third succeeds
      mockFetcher
        .mockRejectedValueOnce(new Error('Retry 1'))
        .mockRejectedValueOnce(new Error('Retry 2'))
        .mockResolvedValueOnce(makeTokenResponse({ access_token: 'retry-success', refresh_token: undefined }));

      const refreshPromise = manager.refreshToken('server-retry-ok');

      // Advance past both retry delays (500ms + 1000ms)
      await jest.advanceTimersByTimeAsync(1500);

      const token = await refreshPromise;
      expect(token.accessToken).toBe('retry-success');
    });
  });

  // ========================================================================
  // Auto-Refresh
  // ========================================================================

  describe('scheduleRefresh', () => {
    it('should set timer before expiry', async () => {
      const config = makeOAuthConfig();
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ expires_in: 300 }),
      );

      await manager.acquireClientCredentials('server-sched', config);

      // Token expires in 300s, buffer is 60s, so refresh at 240s.
      // Set up a refresh response that returns no refresh_token to stop the chain.
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ refresh_token: undefined }),
      );

      // Advancing 239s should NOT trigger refresh
      jest.advanceTimersByTime(239_000);
      await flushPromises();
      expect(mockFetcher).toHaveBeenCalledTimes(1); // Only acquire

      // Advancing 1 more second triggers the refresh
      jest.advanceTimersByTime(1_000);
      await flushPromises();

      expect(mockFetcher).toHaveBeenCalledTimes(2); // acquire + refresh
    });

    it('should trigger refresh callback before expiry', async () => {
      const config = makeOAuthConfig();
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ expires_in: 120 }),
      );

      await manager.acquireClientCredentials('server-auto', config);

      const refreshedHandler = jest.fn();
      manager.on('token:refreshed', refreshedHandler);

      // Refresh response with no refresh_token to stop re-scheduling
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ access_token: 'auto-refreshed', refresh_token: undefined }),
      );

      // Advance past the refresh point (120s - 60s buffer = 60s)
      jest.advanceTimersByTime(60_000);
      await flushPromises();

      expect(refreshedHandler).toHaveBeenCalledTimes(1);
    });

    it('should not schedule refresh when no refresh_token', async () => {
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ refresh_token: undefined, expires_in: 120 }),
      );

      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-no-sched', config);

      // Advance past what would be the refresh point
      jest.advanceTimersByTime(120_000);
      await flushPromises();

      // No refresh call should have been made
      expect(mockFetcher).toHaveBeenCalledTimes(1); // Only acquire
    });

    it('should schedule refresh immediately when token is already near expiry', async () => {
      // Token expires in 30s but buffer is 60s, so timer fires at max(0, 30-60) = 0
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ expires_in: 30 }),
      );
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ access_token: 'immediate-refresh', refresh_token: undefined }),
      );

      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-imm', config);

      // Advance just 1ms for the setTimeout(0) to fire
      jest.advanceTimersByTime(1);
      await flushPromises();

      // acquire + immediate refresh = 2 calls
      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelRefresh', () => {
    it('should clear the scheduled timer', async () => {
      const config = makeOAuthConfig();
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ expires_in: 300 }),
      );

      await manager.acquireClientCredentials('server-cancel', config);
      manager.cancelRefresh('server-cancel');

      // Advance well past the refresh point
      jest.advanceTimersByTime(300_000);
      await flushPromises();

      // No refresh call
      expect(mockFetcher).toHaveBeenCalledTimes(1); // Only acquire
    });

    it('should be no-op for unknown server', () => {
      // Should not throw
      manager.cancelRefresh('nonexistent');
    });
  });

  // ========================================================================
  // Header Generation
  // ========================================================================

  describe('getAuthorizationHeader', () => {
    it('should return Bearer token header', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-hdr', config);

      const header = await manager.getAuthorizationHeader('server-hdr');
      expect(header).toBe('Bearer test-access-token');
    });

    it('should return null when no token exists', async () => {
      const header = await manager.getAuthorizationHeader('nonexistent');
      expect(header).toBeNull();
    });

    it('should refresh expired token before returning header', async () => {
      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ expires_in: 1, refresh_token: 'rt-hdr' }),
      );

      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-hdr-ref', config);

      // Cancel the auto-scheduled refresh
      manager.cancelRefresh('server-hdr-ref');

      mockFetcher.mockResolvedValueOnce(
        makeTokenResponse({ access_token: 'fresh-token' }),
      );

      jest.advanceTimersByTime(62_000);

      const header = await manager.getAuthorizationHeader('server-hdr-ref');
      expect(header).toBe('Bearer fresh-token');
    });
  });

  // ========================================================================
  // PKCE
  // ========================================================================

  describe('PKCE utilities', () => {
    it('should produce verifier and challenge', () => {
      // PKCE uses crypto.randomBytes which needs real timers
      jest.useRealTimers();
      const pkce = generatePKCE();
      jest.useFakeTimers();

      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeChallenge).toBeDefined();
      expect(pkce.codeChallengeMethod).toBe('S256');
      expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
    });

    it('should produce URL-safe verifier of correct length', () => {
      jest.useRealTimers();
      const verifier = generateCodeVerifier(64);
      jest.useFakeTimers();

      expect(verifier).toHaveLength(64);
      // base64url characters only: [A-Za-z0-9_-]
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should produce base64url-encoded SHA-256 challenge', () => {
      const challenge = generateCodeChallenge('test-verifier');
      expect(challenge).toBeDefined();
      expect(challenge.length).toBeGreaterThan(0);
      // base64url: no +, /, or = padding
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should be deterministic for same verifier', () => {
      const verifier = 'deterministic-test-verifier-0123456789abcdef';
      const challenge1 = generateCodeChallenge(verifier);
      const challenge2 = generateCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
    });

    it('should enforce minimum verifier length of 43', () => {
      jest.useRealTimers();
      const verifier = generateCodeVerifier(10); // below minimum
      jest.useFakeTimers();

      expect(verifier.length).toBeGreaterThanOrEqual(43);
    });

    it('should enforce maximum verifier length of 128', () => {
      jest.useRealTimers();
      const verifier = generateCodeVerifier(200); // above maximum
      jest.useFakeTimers();

      expect(verifier.length).toBeLessThanOrEqual(128);
    });
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe('error handling', () => {
    it('should parse OAuth error response descriptively', async () => {
      const failFetcher = createMockFetcher(
        new Error('OAuth token request failed: invalid_client: Client authentication failed'),
      );
      const failManager = new OAuthManager({ tokenFetcher: failFetcher });

      const config = makeOAuthConfig();
      await expect(
        failManager.acquireClientCredentials('server-oauth-err', config),
      ).rejects.toThrow('invalid_client: Client authentication failed');

      failManager.dispose();
    });

    it('should handle network errors gracefully', async () => {
      const failFetcher = createMockFetcher(new Error('fetch failed'));
      const failManager = new OAuthManager({ tokenFetcher: failFetcher });

      const config = makeOAuthConfig();
      await expect(
        failManager.acquireClientCredentials('server-net-err', config),
      ).rejects.toThrow('fetch failed');

      failManager.dispose();
    });

    it('should emit token:error event on failure', async () => {
      const failFetcher = createMockFetcher(new Error('Token endpoint unreachable'));
      const failManager = new OAuthManager({ tokenFetcher: failFetcher });

      const errorHandler = jest.fn();
      failManager.on('token:error', errorHandler);

      const config = makeOAuthConfig();
      await expect(
        failManager.acquireClientCredentials('server-err-evt', config),
      ).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serverName: 'server-err-evt',
          error: expect.stringContaining('Token endpoint unreachable'),
        }),
      );

      failManager.dispose();
    });
  });

  // ========================================================================
  // Factory & dispose
  // ========================================================================

  describe('createOAuthManager factory', () => {
    it('should create an OAuthManager instance', () => {
      const instance = createOAuthManager({ tokenFetcher: mockFetcher });
      expect(instance).toBeInstanceOf(OAuthManager);
      instance.dispose();
    });

    it('should work with default config', () => {
      const instance = createOAuthManager();
      expect(instance).toBeInstanceOf(OAuthManager);
      instance.dispose();
    });
  });

  describe('dispose', () => {
    it('should clean up all state', async () => {
      const config = makeOAuthConfig();
      await manager.acquireClientCredentials('server-dispose-a', config);
      await manager.acquireClientCredentials('server-dispose-b', config);

      manager.dispose();

      expect(manager.getTokenEntries()).toEqual([]);
      expect(manager.hasValidToken('server-dispose-a')).toBe(false);
      expect(manager.hasValidToken('server-dispose-b')).toBe(false);
    });

    it('should cancel all refresh timers', async () => {
      const config = makeOAuthConfig();
      mockFetcher.mockResolvedValueOnce(makeTokenResponse({ expires_in: 300 }));
      mockFetcher.mockResolvedValueOnce(makeTokenResponse({ expires_in: 300 }));

      await manager.acquireClientCredentials('server-disp-1', config);
      await manager.acquireClientCredentials('server-disp-2', config);

      manager.dispose();

      // Advance time well past refresh point - no refresh should happen
      mockFetcher.mockResolvedValue(makeTokenResponse());
      jest.advanceTimersByTime(500_000);
      await flushPromises();

      // Only the 2 acquire calls, no refresh calls
      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });
  });
});
