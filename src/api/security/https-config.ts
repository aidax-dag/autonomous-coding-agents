/**
 * HTTPS Configuration Manager
 *
 * Provides TLS/HTTPS support for the API server:
 * - Certificate and key loading from file paths
 * - PEM format validation
 * - Certificate expiry checking with 30-day warning
 * - HTTPS server options generation
 * - HTTP to HTTPS redirect server creation
 *
 * @module api/security/https-config
 */

import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { logger } from '../../shared/logging/logger';
import { ConfigError } from '../../shared/errors/custom-errors';

/** Number of days before expiry to trigger a warning. */
const EXPIRY_WARNING_DAYS = 30;

/** PEM certificate header pattern. */
const PEM_CERT_PATTERN = /-----BEGIN CERTIFICATE-----/;

/** PEM private key header pattern. */
const PEM_KEY_PATTERN = /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/;

/** Supported TLS minimum versions. */
const SUPPORTED_TLS_VERSIONS = ['TLSv1.2', 'TLSv1.3'] as const;

type TLSVersion = (typeof SUPPORTED_TLS_VERSIONS)[number];

/**
 * TLS configuration specifying certificate file paths and options.
 */
export interface TLSConfig {
  /** Path to the PEM-encoded certificate file. */
  certPath: string;
  /** Path to the PEM-encoded private key file. */
  keyPath: string;
  /** Optional path to the PEM-encoded CA certificate file. */
  caPath?: string;
  /** Optional passphrase for an encrypted private key. */
  passphrase?: string;
  /** Minimum TLS version to accept (default: TLSv1.2). */
  minVersion?: string;
}

/**
 * Result of certificate validation.
 */
export interface CertificateValidationResult {
  valid: boolean;
  expiresAt: Date;
  daysUntilExpiry: number;
  subject: string;
  issuer: string;
  warnings: string[];
}

/**
 * Manages HTTPS/TLS configuration for the API server including
 * certificate loading, validation, and HTTP-to-HTTPS redirection.
 */
export class HTTPSConfigManager {
  private readonly config: TLSConfig;
  private cert: string | null = null;
  private key: string | null = null;
  private ca: string | null = null;

  constructor(config: TLSConfig) {
    this.config = config;
    this.validateMinVersion();

    logger.info('HTTPSConfigManager initialised', {
      certPath: config.certPath,
      keyPath: config.keyPath,
      caPath: config.caPath ?? 'none',
      minVersion: config.minVersion ?? 'TLSv1.2',
    });
  }

  /**
   * Load certificate and key files from disk and validate their PEM format.
   *
   * @throws {ConfigError} When files cannot be read or are not valid PEM.
   */
  loadCertificates(): void {
    this.cert = this.readFile(this.config.certPath, 'certificate');
    this.key = this.readFile(this.config.keyPath, 'private key');

    if (!PEM_CERT_PATTERN.test(this.cert)) {
      throw new ConfigError('Certificate file is not in valid PEM format', {
        path: this.config.certPath,
      });
    }

    if (!PEM_KEY_PATTERN.test(this.key)) {
      throw new ConfigError('Private key file is not in valid PEM format', {
        path: this.config.keyPath,
      });
    }

    if (this.config.caPath) {
      this.ca = this.readFile(this.config.caPath, 'CA certificate');
      if (!PEM_CERT_PATTERN.test(this.ca)) {
        throw new ConfigError('CA certificate file is not in valid PEM format', {
          path: this.config.caPath,
        });
      }
    }

    logger.info('TLS certificates loaded successfully');
  }

  /**
   * Validate a loaded certificate for expiry and extract metadata.
   *
   * @param certPem - Optional PEM string to validate. Falls back to the loaded certificate.
   * @returns Validation result with expiry details and warnings.
   * @throws {ConfigError} When no certificate is available for validation.
   */
  validateCertificate(certPem?: string): CertificateValidationResult {
    const pem = certPem ?? this.cert;
    if (!pem) {
      throw new ConfigError('No certificate loaded for validation. Call loadCertificates() first.');
    }

    let x509: crypto.X509Certificate;
    try {
      x509 = new crypto.X509Certificate(pem);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ConfigError(`Failed to parse certificate: ${message}`, {
        error: message,
      });
    }

    const expiresAt = new Date(x509.validTo);
    const now = new Date();
    const msPerDay = 86_400_000;
    const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / msPerDay);
    const warnings: string[] = [];

    if (daysUntilExpiry < 0) {
      warnings.push('Certificate has expired');
      logger.error('TLS certificate has expired', {
        expiresAt: expiresAt.toISOString(),
        daysExpired: Math.abs(daysUntilExpiry),
      });
    } else if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
      warnings.push(`Certificate expires in ${daysUntilExpiry} days`);
      logger.warn('TLS certificate expiring soon', {
        expiresAt: expiresAt.toISOString(),
        daysUntilExpiry,
      });
    }

    const result: CertificateValidationResult = {
      valid: daysUntilExpiry >= 0,
      expiresAt,
      daysUntilExpiry,
      subject: x509.subject,
      issuer: x509.issuer,
      warnings,
    };

    logger.info('Certificate validation complete', {
      valid: result.valid,
      daysUntilExpiry: result.daysUntilExpiry,
      subject: result.subject,
    });

    return result;
  }

  /**
   * Build Node.js HTTPS server options from the loaded certificates.
   *
   * @returns Options suitable for passing to `https.createServer()`.
   * @throws {ConfigError} When certificates have not been loaded.
   */
  createServerOptions(): https.ServerOptions {
    if (!this.cert || !this.key) {
      throw new ConfigError(
        'Certificates not loaded. Call loadCertificates() before createServerOptions().',
      );
    }

    const options: https.ServerOptions = {
      cert: this.cert,
      key: this.key,
      minVersion: (this.config.minVersion as TLSVersion) ?? 'TLSv1.2',
    };

    if (this.ca) {
      options.ca = this.ca;
    }

    if (this.config.passphrase) {
      options.passphrase = this.config.passphrase;
    }

    logger.info('HTTPS server options created', {
      minVersion: options.minVersion,
      hasCA: !!this.ca,
      hasPassphrase: !!this.config.passphrase,
    });

    return options;
  }

  /**
   * Create an HTTP server that redirects all requests to HTTPS on the given port.
   *
   * @param targetPort - The HTTPS port to redirect to.
   * @returns An `http.Server` configured with 301 redirect responses.
   */
  createRedirectServer(targetPort: number): http.Server {
    const server = http.createServer((req, res) => {
      const host = (req.headers.host ?? 'localhost').replace(/:\d+$/, '');
      const location = `https://${host}:${targetPort}${req.url ?? '/'}`;

      res.writeHead(301, { Location: location });
      res.end();

      logger.debug('HTTP to HTTPS redirect', {
        from: req.url,
        to: location,
      });
    });

    logger.info('HTTP redirect server created', { targetPort });

    return server;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private readFile(filePath: string, description: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ConfigError(`Failed to read ${description} file: ${message}`, {
        path: filePath,
        error: message,
      });
    }
  }

  private validateMinVersion(): void {
    const version = this.config.minVersion;
    if (version && !SUPPORTED_TLS_VERSIONS.includes(version as TLSVersion)) {
      throw new ConfigError(
        `Unsupported TLS minimum version: ${version}. Supported: ${SUPPORTED_TLS_VERSIONS.join(', ')}`,
        { providedVersion: version },
      );
    }
  }
}

/**
 * Factory function matching the project's createXxx convention.
 */
export function createHTTPSConfig(config: TLSConfig): HTTPSConfigManager {
  return new HTTPSConfigManager(config);
}
