/**
 * OAuth Token Manager
 *
 * Manages OAuth 2.0 token lifecycle for MCP server connections.
 * Handles acquisition, storage, automatic refresh, and header generation.
 *
 * Features:
 *   - Client credentials and authorization code grants
 *   - Automatic token refresh before expiry
 *   - Pluggable HTTP fetcher for testability
 *   - Event-based token lifecycle notifications
 *
 * @module core/mcp/oauth/oauth-manager
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '../../../shared/logging/logger';
import type {
  OAuthConfig,
  OAuthToken,
  OAuthTokenResponse,
  OAuthErrorResponse,
  TokenStorageEntry,
} from './types';

const log = createAgentLogger('MCP', 'oauth-manager');

/**
 * Pluggable HTTP fetcher for token requests.
 * Allows injecting a mock for testing without real network calls.
 */
export type TokenFetcher = (
  url: string,
  body: Record<string, string>,
  headers?: Record<string, string>,
) => Promise<OAuthTokenResponse>;

/**
 * Configuration for the OAuthManager
 */
export interface OAuthManagerConfig {
  /** Milliseconds before expiry to trigger refresh (default: 60000 = 1 min) */
  tokenRefreshBufferMs?: number;
  /** Maximum retry attempts on token refresh failure (default: 3) */
  maxRetries?: number;
  /** Pluggable HTTP client for token requests (useful for testing) */
  tokenFetcher?: TokenFetcher;
}

/** Default configuration values */
const DEFAULTS = {
  tokenRefreshBufferMs: 60_000,
  maxRetries: 3,
} as const;

/**
 * Default token fetcher using global fetch.
 * Sends a URL-encoded POST to the token endpoint.
 */
async function defaultTokenFetcher(
  url: string,
  body: Record<string, string>,
  headers?: Record<string, string>,
): Promise<OAuthTokenResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    let errorDetail: string;
    try {
      const errorBody = (await response.json()) as OAuthErrorResponse;
      errorDetail = errorBody.error_description
        ? `${errorBody.error}: ${errorBody.error_description}`
        : errorBody.error;
    } catch {
      errorDetail = `HTTP ${response.status} ${response.statusText}`;
    }
    throw new Error(`OAuth token request failed: ${errorDetail}`);
  }

  return (await response.json()) as OAuthTokenResponse;
}

/**
 * OAuthManager
 *
 * Manages OAuth tokens for MCP server connections. Supports client_credentials
 * and authorization_code grants with automatic refresh scheduling.
 *
 * Events:
 *   - 'token:acquired'  → { serverName: string, expiresAt: number }
 *   - 'token:refreshed' → { serverName: string, expiresAt: number }
 *   - 'token:expired'   → { serverName: string }
 *   - 'token:error'     → { serverName: string, error: string }
 */
export class OAuthManager extends EventEmitter {
  private tokens: Map<string, TokenStorageEntry> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly tokenRefreshBufferMs: number;
  private readonly maxRetries: number;
  private readonly tokenFetcher: TokenFetcher;

  constructor(config?: OAuthManagerConfig) {
    super();
    this.tokenRefreshBufferMs = config?.tokenRefreshBufferMs ?? DEFAULTS.tokenRefreshBufferMs;
    this.maxRetries = config?.maxRetries ?? DEFAULTS.maxRetries;
    this.tokenFetcher = config?.tokenFetcher ?? defaultTokenFetcher;
  }

  // ========================================================================
  // Token Acquisition
  // ========================================================================

  /**
   * Acquire a token using the client_credentials grant.
   * Used for server-to-server authentication where no user context is needed.
   */
  async acquireClientCredentials(
    serverName: string,
    oauthConfig: OAuthConfig,
  ): Promise<OAuthToken> {
    log.info(`Acquiring client_credentials token for '${serverName}'`);

    const body: Record<string, string> = {
      grant_type: 'client_credentials',
      client_id: oauthConfig.clientId,
    };

    if (oauthConfig.clientSecret) {
      body.client_secret = oauthConfig.clientSecret;
    }

    if (oauthConfig.scopes && oauthConfig.scopes.length > 0) {
      body.scope = oauthConfig.scopes.join(' ');
    }

    const response = await this.fetchToken(serverName, oauthConfig.tokenUrl, body);
    const token = this.responseToToken(response);

    this.storeToken(serverName, token, oauthConfig);
    this.scheduleRefresh(serverName);

    this.emit('token:acquired', { serverName, expiresAt: token.expiresAt });
    log.info(`Token acquired for '${serverName}'`, { expiresAt: token.expiresAt });

    return token;
  }

  /**
   * Exchange an authorization code for a token.
   * Used for user-authorized flows (with optional PKCE).
   */
  async exchangeAuthorizationCode(
    serverName: string,
    oauthConfig: OAuthConfig,
    code: string,
    codeVerifier?: string,
  ): Promise<OAuthToken> {
    log.info(`Exchanging authorization code for '${serverName}'`);

    const body: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: oauthConfig.clientId,
      code,
    };

    if (oauthConfig.clientSecret) {
      body.client_secret = oauthConfig.clientSecret;
    }

    if (oauthConfig.redirectUri) {
      body.redirect_uri = oauthConfig.redirectUri;
    }

    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    const response = await this.fetchToken(serverName, oauthConfig.tokenUrl, body);
    const token = this.responseToToken(response);

    this.storeToken(serverName, token, oauthConfig);
    this.scheduleRefresh(serverName);

    this.emit('token:acquired', { serverName, expiresAt: token.expiresAt });
    log.info(`Token acquired via auth code for '${serverName}'`, { expiresAt: token.expiresAt });

    return token;
  }

  // ========================================================================
  // Token Management
  // ========================================================================

  /**
   * Get a valid token for a server.
   * Automatically refreshes if the token is expired or near expiry.
   * Returns null if no token exists for the server.
   */
  async getValidToken(serverName: string): Promise<OAuthToken | null> {
    const entry = this.tokens.get(serverName);
    if (!entry) {
      return null;
    }

    if (this.isTokenExpiredOrNearExpiry(entry.token)) {
      if (entry.token.refreshToken) {
        try {
          return await this.refreshToken(serverName);
        } catch {
          this.emit('token:expired', { serverName });
          return null;
        }
      }
      this.emit('token:expired', { serverName });
      return null;
    }

    return entry.token;
  }

  /**
   * Check if a valid (non-expired) token exists for a server.
   */
  hasValidToken(serverName: string): boolean {
    const entry = this.tokens.get(serverName);
    if (!entry) return false;
    return !this.isTokenExpired(entry.token);
  }

  /**
   * Refresh an existing token using the refresh_token grant.
   * Throws if no token or refresh token exists for the server.
   */
  async refreshToken(serverName: string): Promise<OAuthToken> {
    const entry = this.tokens.get(serverName);
    if (!entry) {
      throw new Error(`No token stored for server '${serverName}'`);
    }

    if (!entry.token.refreshToken) {
      throw new Error(`No refresh token available for server '${serverName}'`);
    }

    log.info(`Refreshing token for '${serverName}'`);

    const body: Record<string, string> = {
      grant_type: 'refresh_token',
      client_id: entry.oauthConfig.clientId,
      refresh_token: entry.token.refreshToken,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchToken(
          serverName,
          entry.oauthConfig.tokenUrl,
          body,
        );
        const token = this.responseToToken(response);

        // Preserve the refresh token if the response does not include a new one
        if (!token.refreshToken && entry.token.refreshToken) {
          token.refreshToken = entry.token.refreshToken;
        }

        this.storeToken(serverName, token, entry.oauthConfig);
        this.scheduleRefresh(serverName);

        this.emit('token:refreshed', { serverName, expiresAt: token.expiresAt });
        log.info(`Token refreshed for '${serverName}'`, { expiresAt: token.expiresAt });

        return token;
      } catch (error) {
        lastError = error as Error;
        log.warn(`Token refresh attempt ${attempt}/${this.maxRetries} failed for '${serverName}'`, {
          error: (error as Error).message,
        });

        if (attempt < this.maxRetries) {
          // Brief backoff before retry
          await this.delay(attempt * 500);
        }
      }
    }

    const errorMessage = lastError?.message ?? 'Unknown error';
    this.emit('token:error', { serverName, error: errorMessage });
    throw new Error(
      `Failed to refresh token for '${serverName}' after ${this.maxRetries} attempts: ${errorMessage}`,
    );
  }

  /**
   * Revoke/remove a stored token for a server.
   * Returns true if a token was removed, false if none existed.
   */
  revokeToken(serverName: string): boolean {
    this.cancelRefresh(serverName);
    const deleted = this.tokens.delete(serverName);

    if (deleted) {
      log.info(`Token revoked for '${serverName}'`);
    }

    return deleted;
  }

  /**
   * Get all stored token entries.
   */
  getTokenEntries(): TokenStorageEntry[] {
    return [...this.tokens.values()];
  }

  // ========================================================================
  // Auto-Refresh
  // ========================================================================

  /**
   * Schedule automatic token refresh before expiry.
   * Uses .unref() on the timer so it does not prevent process exit.
   */
  scheduleRefresh(serverName: string): void {
    this.cancelRefresh(serverName);

    const entry = this.tokens.get(serverName);
    if (!entry || !entry.token.refreshToken) {
      return;
    }

    const now = Date.now();
    const refreshAt = entry.token.expiresAt - this.tokenRefreshBufferMs;
    const delayMs = Math.max(0, refreshAt - now);

    const timer = setTimeout(() => {
      this.refreshToken(serverName).catch((error) => {
        log.error(`Scheduled token refresh failed for '${serverName}'`, error);
        this.emit('token:error', { serverName, error: (error as Error).message });
      });
    }, delayMs);

    // Do not block process exit
    timer.unref();

    this.refreshTimers.set(serverName, timer);
    log.debug(`Scheduled token refresh for '${serverName}'`, { delayMs });
  }

  /**
   * Cancel a scheduled refresh for a server.
   */
  cancelRefresh(serverName: string): void {
    const timer = this.refreshTimers.get(serverName);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(serverName);
    }
  }

  // ========================================================================
  // Header Generation
  // ========================================================================

  /**
   * Get the Authorization header value for a server.
   * Returns null if no valid token is available.
   * Automatically refreshes expired tokens when possible.
   */
  async getAuthorizationHeader(serverName: string): Promise<string | null> {
    const token = await this.getValidToken(serverName);
    if (!token) {
      return null;
    }
    return `${token.tokenType} ${token.accessToken}`;
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Dispose of all resources: cancel timers, clear tokens, remove listeners.
   */
  dispose(): void {
    for (const [serverName, timer] of this.refreshTimers) {
      clearTimeout(timer);
      this.refreshTimers.delete(serverName);
      log.debug(`Cancelled refresh timer for '${serverName}'`);
    }

    this.tokens.clear();
    this.removeAllListeners();
    log.info('OAuthManager disposed');
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  /**
   * Fetch a token from the token endpoint with error handling.
   */
  private async fetchToken(
    serverName: string,
    tokenUrl: string,
    body: Record<string, string>,
  ): Promise<OAuthTokenResponse> {
    try {
      return await this.tokenFetcher(tokenUrl, body);
    } catch (error) {
      const message = (error as Error).message;
      log.error(`Token fetch failed for '${serverName}'`, undefined, { error: message });
      this.emit('token:error', { serverName, error: message });
      throw error;
    }
  }

  /**
   * Convert an OAuth token response to our internal token format.
   */
  private responseToToken(response: OAuthTokenResponse): OAuthToken {
    return {
      accessToken: response.access_token,
      tokenType: response.token_type || 'Bearer',
      expiresAt: Date.now() + response.expires_in * 1000,
      refreshToken: response.refresh_token,
      scope: response.scope,
    };
  }

  /**
   * Store a token entry for a server.
   */
  private storeToken(
    serverName: string,
    token: OAuthToken,
    oauthConfig: OAuthConfig | Pick<OAuthConfig, 'tokenUrl' | 'clientId'>,
  ): void {
    const now = Date.now();
    const existing = this.tokens.get(serverName);

    this.tokens.set(serverName, {
      serverName,
      token,
      oauthConfig: {
        tokenUrl: oauthConfig.tokenUrl,
        clientId: oauthConfig.clientId,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  /**
   * Check if a token is expired (past its expiresAt timestamp).
   */
  private isTokenExpired(token: OAuthToken): boolean {
    return Date.now() >= token.expiresAt;
  }

  /**
   * Check if a token is expired or within the refresh buffer window.
   */
  private isTokenExpiredOrNearExpiry(token: OAuthToken): boolean {
    return Date.now() >= token.expiresAt - this.tokenRefreshBufferMs;
  }

  /**
   * Async delay helper.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create an OAuthManager instance.
 */
export function createOAuthManager(config?: OAuthManagerConfig): OAuthManager {
  return new OAuthManager(config);
}
