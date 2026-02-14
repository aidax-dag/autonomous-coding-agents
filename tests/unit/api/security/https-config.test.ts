/**
 * HTTPS Configuration Manager Tests
 *
 * Covers:
 * - Certificate loading from file paths (mock fs.readFileSync)
 * - PEM format validation (valid/invalid)
 * - Expiry checking (expired, soon-to-expire, valid)
 * - Server options generation
 * - HTTP to HTTPS redirect configuration
 * - Error handling: missing files, invalid certs, wrong passphrase
 * - TLS version validation
 * - Factory function
 */

import fs from 'fs';
import crypto from 'crypto';
import {
  HTTPSConfigManager,
  createHTTPSConfig,
} from '../../../../src/api/security/https-config';
import type { TLSConfig } from '../../../../src/api/security/https-config';
import { ConfigError } from '../../../../src/shared/errors/custom-errors';

jest.mock('fs');
jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIUEexamplecertificatedata0123456789ABCDEF
-----END CERTIFICATE-----`;

const MOCK_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIBVgIBADANBgkqhkiG9w0BAQEFexamplekeydata01234567
-----END PRIVATE KEY-----`;

const MOCK_RSA_KEY_PEM = `-----BEGIN RSA PRIVATE KEY-----
MIIBVgIBADANBgkqhkiG9w0BAQEFexamplersakey0123456789
-----END RSA PRIVATE KEY-----`;

const MOCK_ENCRYPTED_KEY_PEM = `-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIBVgIBADANBgkqhkiG9w0BAQEFexampleencryptedkey01234
-----END ENCRYPTED PRIVATE KEY-----`;

const MOCK_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIUFexamplecacertificatedata0123456789ABCDEF
-----END CERTIFICATE-----`;

const VALID_CONFIG: TLSConfig = {
  certPath: '/certs/server.crt',
  keyPath: '/certs/server.key',
};

const mockedFs = jest.mocked(fs);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HTTPSConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('should create an instance with valid config', () => {
      const manager = new HTTPSConfigManager(VALID_CONFIG);
      expect(manager).toBeInstanceOf(HTTPSConfigManager);
    });

    it('should accept TLSv1.2 as minimum version', () => {
      expect(
        () => new HTTPSConfigManager({ ...VALID_CONFIG, minVersion: 'TLSv1.2' }),
      ).not.toThrow();
    });

    it('should accept TLSv1.3 as minimum version', () => {
      expect(
        () => new HTTPSConfigManager({ ...VALID_CONFIG, minVersion: 'TLSv1.3' }),
      ).not.toThrow();
    });

    it('should throw ConfigError for unsupported TLS version', () => {
      expect(
        () => new HTTPSConfigManager({ ...VALID_CONFIG, minVersion: 'TLSv1.0' }),
      ).toThrow(ConfigError);
    });

    it('should include the invalid version in the error message', () => {
      expect(
        () => new HTTPSConfigManager({ ...VALID_CONFIG, minVersion: 'SSLv3' }),
      ).toThrow(/SSLv3/);
    });
  });

  // -------------------------------------------------------------------------
  // loadCertificates
  // -------------------------------------------------------------------------

  describe('loadCertificates', () => {
    it('should load cert and key files successfully', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      expect(() => manager.loadCertificates()).not.toThrow();
    });

    it('should accept RSA private key format', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_RSA_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      expect(() => manager.loadCertificates()).not.toThrow();
    });

    it('should accept encrypted private key format', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_ENCRYPTED_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      expect(() => manager.loadCertificates()).not.toThrow();
    });

    it('should load CA certificate when caPath is provided', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM)
        .mockReturnValueOnce(MOCK_CA_PEM) as unknown as typeof fs.readFileSync;

      const config: TLSConfig = { ...VALID_CONFIG, caPath: '/certs/ca.crt' };
      const manager = new HTTPSConfigManager(config);
      expect(() => manager.loadCertificates()).not.toThrow();
    });

    it('should throw ConfigError when cert file does not exist', () => {
      mockedFs.readFileSync = jest.fn().mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      }) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      try {
        manager.loadCertificates();
        fail('Expected ConfigError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as Error).message).toMatch(/Failed to read certificate file/);
      }
    });

    it('should throw ConfigError when key file does not exist', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockImplementationOnce(() => {
          throw new Error('ENOENT: no such file or directory');
        }) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      try {
        manager.loadCertificates();
        fail('Expected ConfigError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as Error).message).toMatch(/Failed to read private key file/);
      }
    });

    it('should throw ConfigError when cert is not valid PEM', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce('NOT A CERTIFICATE')
        .mockReturnValueOnce(MOCK_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      try {
        manager.loadCertificates();
        fail('Expected ConfigError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as Error).message).toMatch(/not in valid PEM format/);
      }
    });

    it('should throw ConfigError when key is not valid PEM', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce('NOT A KEY') as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      try {
        manager.loadCertificates();
        fail('Expected ConfigError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as Error).message).toMatch(/not in valid PEM format/);
      }
    });

    it('should throw ConfigError when CA cert is not valid PEM', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM)
        .mockReturnValueOnce('INVALID CA DATA') as unknown as typeof fs.readFileSync;

      const config: TLSConfig = { ...VALID_CONFIG, caPath: '/certs/ca.crt' };
      const manager = new HTTPSConfigManager(config);
      try {
        manager.loadCertificates();
        fail('Expected ConfigError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as Error).message).toMatch(/CA certificate file is not in valid PEM format/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // validateCertificate
  // -------------------------------------------------------------------------

  describe('validateCertificate', () => {
    it('should throw ConfigError when no certificate is loaded', () => {
      const manager = new HTTPSConfigManager(VALID_CONFIG);
      try {
        manager.validateCertificate();
        fail('Expected ConfigError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as Error).message).toMatch(/No certificate loaded/);
      }
    });

    it('should validate a certificate that is far from expiry', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 365);

      const mockX509 = {
        validTo: futureDate.toISOString(),
        subject: 'CN=example.com',
        issuer: 'CN=Test CA',
      };

      jest.spyOn(crypto, 'X509Certificate').mockImplementation(
        () => mockX509 as unknown as crypto.X509Certificate,
      );

      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      manager.loadCertificates();

      const result = manager.validateCertificate();
      expect(result.valid).toBe(true);
      expect(result.daysUntilExpiry).toBeGreaterThan(EXPIRY_WARNING_DAYS_VALUE());
      expect(result.warnings).toHaveLength(0);
      expect(result.subject).toBe('CN=example.com');
      expect(result.issuer).toBe('CN=Test CA');
    });

    it('should warn when certificate expires within 30 days', () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 15);

      const mockX509 = {
        validTo: soonDate.toISOString(),
        subject: 'CN=expiring.example.com',
        issuer: 'CN=Test CA',
      };

      jest.spyOn(crypto, 'X509Certificate').mockImplementation(
        () => mockX509 as unknown as crypto.X509Certificate,
      );

      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      manager.loadCertificates();

      const result = manager.validateCertificate();
      expect(result.valid).toBe(true);
      expect(result.daysUntilExpiry).toBeLessThanOrEqual(30);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toMatch(/expires in \d+ days/);
    });

    it('should report an expired certificate as invalid', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const mockX509 = {
        validTo: pastDate.toISOString(),
        subject: 'CN=expired.example.com',
        issuer: 'CN=Test CA',
      };

      jest.spyOn(crypto, 'X509Certificate').mockImplementation(
        () => mockX509 as unknown as crypto.X509Certificate,
      );

      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      manager.loadCertificates();

      const result = manager.validateCertificate();
      expect(result.valid).toBe(false);
      expect(result.daysUntilExpiry).toBeLessThan(0);
      expect(result.warnings).toContain('Certificate has expired');
    });

    it('should accept a PEM string directly for validation', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 200);

      const mockX509 = {
        validTo: futureDate.toISOString(),
        subject: 'CN=direct.example.com',
        issuer: 'CN=Test CA',
      };

      jest.spyOn(crypto, 'X509Certificate').mockImplementation(
        () => mockX509 as unknown as crypto.X509Certificate,
      );

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      const result = manager.validateCertificate(MOCK_CERT_PEM);
      expect(result.valid).toBe(true);
      expect(result.subject).toBe('CN=direct.example.com');
    });

    it('should throw ConfigError when certificate cannot be parsed', () => {
      jest.spyOn(crypto, 'X509Certificate').mockImplementation(() => {
        throw new Error('unable to parse certificate');
      });

      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      manager.loadCertificates();

      try {
        manager.validateCertificate();
        fail('Expected ConfigError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as Error).message).toMatch(/Failed to parse certificate/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // createServerOptions
  // -------------------------------------------------------------------------

  describe('createServerOptions', () => {
    it('should throw ConfigError when certificates are not loaded', () => {
      const manager = new HTTPSConfigManager(VALID_CONFIG);
      try {
        manager.createServerOptions();
        fail('Expected ConfigError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as Error).message).toMatch(/Certificates not loaded/);
      }
    });

    it('should return server options with cert and key', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      manager.loadCertificates();

      const options = manager.createServerOptions();
      expect(options.cert).toBe(MOCK_CERT_PEM);
      expect(options.key).toBe(MOCK_KEY_PEM);
      expect(options.minVersion).toBe('TLSv1.2');
    });

    it('should include CA when caPath is configured', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM)
        .mockReturnValueOnce(MOCK_CA_PEM) as unknown as typeof fs.readFileSync;

      const config: TLSConfig = { ...VALID_CONFIG, caPath: '/certs/ca.crt' };
      const manager = new HTTPSConfigManager(config);
      manager.loadCertificates();

      const options = manager.createServerOptions();
      expect(options.ca).toBe(MOCK_CA_PEM);
    });

    it('should include passphrase when configured', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_ENCRYPTED_KEY_PEM) as unknown as typeof fs.readFileSync;

      const config: TLSConfig = { ...VALID_CONFIG, passphrase: 'my-secret-pass' };
      const manager = new HTTPSConfigManager(config);
      manager.loadCertificates();

      const options = manager.createServerOptions();
      expect(options.passphrase).toBe('my-secret-pass');
    });

    it('should use configured minVersion', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM) as unknown as typeof fs.readFileSync;

      const config: TLSConfig = { ...VALID_CONFIG, minVersion: 'TLSv1.3' };
      const manager = new HTTPSConfigManager(config);
      manager.loadCertificates();

      const options = manager.createServerOptions();
      expect(options.minVersion).toBe('TLSv1.3');
    });

    it('should not include CA or passphrase when not configured', () => {
      mockedFs.readFileSync = jest.fn()
        .mockReturnValueOnce(MOCK_CERT_PEM)
        .mockReturnValueOnce(MOCK_KEY_PEM) as unknown as typeof fs.readFileSync;

      const manager = new HTTPSConfigManager(VALID_CONFIG);
      manager.loadCertificates();

      const options = manager.createServerOptions();
      expect(options.ca).toBeUndefined();
      expect(options.passphrase).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // createRedirectServer
  // -------------------------------------------------------------------------

  describe('createRedirectServer', () => {
    it('should return an http.Server instance', () => {
      const manager = new HTTPSConfigManager(VALID_CONFIG);
      const server = manager.createRedirectServer(443);
      expect(server).toBeDefined();
      expect(typeof server.listen).toBe('function');
    });

    it('should respond with 301 redirect to HTTPS', (done) => {
      const manager = new HTTPSConfigManager(VALID_CONFIG);
      const server = manager.createRedirectServer(8443);

      // Simulate a request by extracting the request listener
      const listeners = server.listeners('request');
      expect(listeners.length).toBe(1);

      const requestHandler = listeners[0] as (
        req: { headers: Record<string, string>; url: string },
        res: { writeHead: jest.Mock; end: jest.Mock },
      ) => void;

      const mockReq = {
        headers: { host: 'example.com:80' },
        url: '/api/health',
      };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };

      requestHandler(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(301, {
        Location: 'https://example.com:8443/api/health',
      });
      expect(mockRes.end).toHaveBeenCalled();
      done();
    });

    it('should use localhost when host header is missing', (done) => {
      const manager = new HTTPSConfigManager(VALID_CONFIG);
      const server = manager.createRedirectServer(443);

      const listeners = server.listeners('request');
      const requestHandler = listeners[0] as (
        req: { headers: Record<string, string>; url: string },
        res: { writeHead: jest.Mock; end: jest.Mock },
      ) => void;

      const mockReq = {
        headers: {},
        url: '/test',
      };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };

      requestHandler(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(301, {
        Location: 'https://localhost:443/test',
      });
      done();
    });

    it('should default URL to / when request URL is undefined', (done) => {
      const manager = new HTTPSConfigManager(VALID_CONFIG);
      const server = manager.createRedirectServer(443);

      const listeners = server.listeners('request');
      const requestHandler = listeners[0] as (
        req: { headers: Record<string, string>; url?: string },
        res: { writeHead: jest.Mock; end: jest.Mock },
      ) => void;

      const mockReq = {
        headers: { host: 'example.com' },
        url: undefined,
      };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };

      requestHandler(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(301, {
        Location: 'https://example.com:443/',
      });
      done();
    });
  });

  // -------------------------------------------------------------------------
  // Factory function
  // -------------------------------------------------------------------------

  describe('createHTTPSConfig', () => {
    it('should return an HTTPSConfigManager instance', () => {
      const manager = createHTTPSConfig(VALID_CONFIG);
      expect(manager).toBeInstanceOf(HTTPSConfigManager);
    });

    it('should propagate ConfigError for invalid TLS version', () => {
      expect(() =>
        createHTTPSConfig({ ...VALID_CONFIG, minVersion: 'TLSv1.0' }),
      ).toThrow(ConfigError);
    });
  });
});

// Helper to access the constant value for assertions without exporting it
function EXPIRY_WARNING_DAYS_VALUE(): number {
  return 30;
}
