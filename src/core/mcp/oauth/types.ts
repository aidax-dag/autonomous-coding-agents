/**
 * OAuth Type Definitions
 *
 * Types for OAuth 2.0 authentication flows used by MCP server connections.
 * Supports client_credentials, authorization_code, and refresh_token grants.
 *
 * @module core/mcp/oauth/types
 */

/**
 * OAuth configuration for an MCP server connection
 */
export interface OAuthConfig {
  /** OAuth client identifier */
  clientId: string;
  /** OAuth client secret (optional for public clients) */
  clientSecret?: string;
  /** Authorization endpoint URL */
  authorizationUrl: string;
  /** Token endpoint URL */
  tokenUrl: string;
  /** Requested OAuth scopes */
  scopes?: string[];
  /** Redirect URI for authorization code flow */
  redirectUri?: string;
  /** Use PKCE (default: true for public clients without clientSecret) */
  pkce?: boolean;
}

/**
 * Stored OAuth token
 */
export interface OAuthToken {
  /** The access token string */
  accessToken: string;
  /** Token type, typically 'Bearer' */
  tokenType: string;
  /** Unix timestamp in milliseconds when the token expires */
  expiresAt: number;
  /** Refresh token for obtaining new access tokens */
  refreshToken?: string;
  /** Granted scope string */
  scope?: string;
}

/**
 * Persistent storage entry for a server's OAuth token
 */
export interface TokenStorageEntry {
  /** MCP server name this token belongs to */
  serverName: string;
  /** The stored token */
  token: OAuthToken;
  /** Subset of OAuth config needed for refresh operations */
  oauthConfig: Pick<OAuthConfig, 'tokenUrl' | 'clientId'>;
  /** Unix timestamp in ms when the entry was created */
  createdAt: number;
  /** Unix timestamp in ms when the entry was last updated */
  updatedAt: number;
}

/**
 * Supported OAuth grant types
 */
export type OAuthGrantType = 'client_credentials' | 'authorization_code' | 'refresh_token';

/**
 * Parameters for an OAuth token request
 */
export interface OAuthTokenRequest {
  /** The grant type being used */
  grantType: OAuthGrantType;
  /** OAuth client identifier */
  clientId: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** Authorization code (for authorization_code grant) */
  code?: string;
  /** Redirect URI (for authorization_code grant) */
  redirectUri?: string;
  /** Refresh token (for refresh_token grant) */
  refreshToken?: string;
  /** Requested scope */
  scope?: string;
  /** PKCE code verifier */
  codeVerifier?: string;
}

/**
 * OAuth token endpoint success response (snake_case per RFC 6749)
 */
export interface OAuthTokenResponse {
  /** The access token */
  access_token: string;
  /** Token type (e.g. 'Bearer') */
  token_type: string;
  /** Token lifetime in seconds */
  expires_in: number;
  /** Refresh token for obtaining new access tokens */
  refresh_token?: string;
  /** Granted scope */
  scope?: string;
}

/**
 * OAuth token endpoint error response (per RFC 6749 Section 5.2)
 */
export interface OAuthErrorResponse {
  /** Error code (e.g. 'invalid_grant', 'invalid_client') */
  error: string;
  /** Human-readable error description */
  error_description?: string;
  /** URI for additional error information */
  error_uri?: string;
}
