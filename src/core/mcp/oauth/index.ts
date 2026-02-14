/**
 * OAuth Module
 *
 * OAuth 2.0 authentication support for MCP server connections.
 *
 * @module core/mcp/oauth
 */

export type {
  OAuthConfig,
  OAuthToken,
  TokenStorageEntry,
  OAuthGrantType,
  OAuthTokenRequest,
  OAuthTokenResponse,
  OAuthErrorResponse,
} from './types';

export {
  OAuthManager,
  createOAuthManager,
  type OAuthManagerConfig,
  type TokenFetcher,
} from './oauth-manager';

export {
  generatePKCE,
  generateCodeVerifier,
  generateCodeChallenge,
  type PKCEChallenge,
} from './pkce';
