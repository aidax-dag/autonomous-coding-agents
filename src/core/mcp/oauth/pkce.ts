/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Implements RFC 7636 PKCE for OAuth 2.0 authorization code flows.
 * Generates code verifier / challenge pairs using the S256 method.
 *
 * @module core/mcp/oauth/pkce
 */

import * as crypto from 'crypto';

/**
 * A PKCE code verifier and its corresponding challenge
 */
export interface PKCEChallenge {
  /** Random URL-safe string used as the code verifier */
  codeVerifier: string;
  /** SHA-256 hash of the verifier, base64url-encoded */
  codeChallenge: string;
  /** Challenge derivation method (always S256) */
  codeChallengeMethod: 'S256';
}

/**
 * Generate a PKCE code verifier and challenge pair.
 *
 * The verifier is a cryptographically random URL-safe string.
 * The challenge is its SHA-256 hash, base64url-encoded.
 */
export function generatePKCE(): PKCEChallenge {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Generate a random code verifier string.
 *
 * Per RFC 7636 Section 4.1, the verifier must be 43-128 characters
 * using unreserved URL-safe characters [A-Z, a-z, 0-9, '-', '.', '_', '~'].
 *
 * @param length - Desired length (default 64, must be 43-128)
 */
export function generateCodeVerifier(length = 64): string {
  const clamped = Math.max(43, Math.min(128, length));
  const bytes = crypto.randomBytes(clamped);
  return bytes
    .toString('base64url')
    .slice(0, clamped);
}

/**
 * Generate a code challenge from a verifier using SHA-256.
 *
 * Per RFC 7636 Section 4.2:
 *   code_challenge = BASE64URL(SHA256(code_verifier))
 *
 * @param verifier - The code verifier string
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}
