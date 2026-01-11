/**
 * Secret Detector Tests
 *
 * Feature: F5.6 - Code Scanning 심화
 * Tests for secret leak detection implementation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  SecretDetector,
  createSecretDetector,
  SecurityIssueSeverity,
  type SecretDetectionRule,
} from '../../../../src/core/security/scanning/index.js';

describe('SecretDetector', () => {
  let detector: SecretDetector;
  let tempDir: string;

  beforeEach(() => {
    detector = new SecretDetector();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-detector-test-'));
  });

  afterEach(() => {
    detector.dispose();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Construction', () => {
    it('should create detector with default rules', () => {
      const rules = detector.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should create detector with custom rules', () => {
      const customRule: SecretDetectionRule = {
        id: 'CUSTOM001',
        name: 'custom-secret',
        secretType: 'generic_secret',
        pattern: /custom_secret_[a-z0-9]{10}/g,
        severity: SecurityIssueSeverity.HIGH,
        enabled: true,
      };

      const customDetector = new SecretDetector([customRule]);
      const rules = customDetector.getRules();

      expect(rules.some((r) => r.id === 'CUSTOM001')).toBe(true);
      customDetector.dispose();
    });

    it('should create detector using factory function', () => {
      const factoryDetector = createSecretDetector();
      expect(factoryDetector).toBeDefined();
      expect(factoryDetector.getRules().length).toBeGreaterThan(0);
      factoryDetector.dispose();
    });
  });

  describe('detectInCode', () => {
    it('should detect AWS Access Key ID', async () => {
      const code = `
        const awsKey = "AKIATESTFAKEKEY12345";
      `;

      const result = await detector.detectInCode(code);

      expect(result.success).toBe(true);
      expect(result.secrets.length).toBeGreaterThan(0);
      expect(result.secrets.some((s) => s.type === 'aws_key')).toBe(true);
    });

    it('should detect GitHub Personal Access Token', async () => {
      const code = `
        const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `;

      const result = await detector.detectInCode(code);

      expect(result.secrets.some((s) => s.type === 'github_token')).toBe(true);
    });

    it('should detect Slack webhook URL', async () => {
      const code = `
        const webhook = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX";
      `;

      const result = await detector.detectInCode(code);

      expect(result.secrets.some((s) => s.type === 'slack_webhook')).toBe(true);
    });

    it('should detect Stripe API Key', async () => {
      const code = `
        const stripeKey = "sk_test_FakeKeyForTestingOnly1234";
      `;

      const result = await detector.detectInCode(code);

      expect(result.secrets.some((s) => s.type === 'stripe_key')).toBe(true);
    });

    it('should detect SendGrid API Key', async () => {
      const code = `
        const sendgridKey = "SG.xxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `;

      const result = await detector.detectInCode(code);

      expect(result.secrets.some((s) => s.type === 'sendgrid_key')).toBe(true);
    });

    it('should detect private key headers', async () => {
      const code = `
        const privateKey = \`-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----\`;
      `;

      const result = await detector.detectInCode(code);

      expect(result.secrets.some((s) => s.type === 'private_key')).toBe(true);
    });

    it('should detect JWT tokens', async () => {
      const code = `
        const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      `;

      const result = await detector.detectInCode(code);

      expect(result.secrets.some((s) => s.type === 'jwt')).toBe(true);
    });

    it('should detect database connection strings', async () => {
      const code = `
        const dbUrl = "mongodb+srv://user:password@cluster.mongodb.net/dbname";
      `;

      const result = await detector.detectInCode(code);

      expect(result.secrets.some((s) => s.type === 'database_url')).toBe(true);
    });

    it('should detect generic API keys', async () => {
      const code = `
        const apiKey = "abcdefghijklmnopqrstuvwxyz123456";
      `;

      const result = await detector.detectInCode(code);

      expect(result.secrets.some((s) => s.type === 'api_key')).toBe(true);
    });

    it('should detect generic secrets', async () => {
      const code = `
        const secret = "myVerySecretValue123!@#";
      `;

      const result = await detector.detectInCode(code);

      expect(result.secrets.length).toBeGreaterThan(0);
    });

    it('should mask secret values', async () => {
      const code = `
        const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `;

      const result = await detector.detectInCode(code);

      const githubSecret = result.secrets.find((s) => s.type === 'github_token');
      expect(githubSecret?.maskedValue).toContain('*');
      expect(githubSecret?.maskedValue).not.toBe(code);
    });

    it('should calculate entropy', async () => {
      const code = `
        const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `;

      const result = await detector.detectInCode(code);

      const secret = result.secrets[0];
      expect(secret?.entropy).toBeGreaterThan(0);
    });

    it('should include confidence score', async () => {
      const code = `
        const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `;

      const result = await detector.detectInCode(code);

      const secret = result.secrets[0];
      expect(secret?.confidence).toBeGreaterThanOrEqual(0);
      expect(secret?.confidence).toBeLessThanOrEqual(1);
    });

    it('should include remediation advice', async () => {
      const code = `
        const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `;

      const result = await detector.detectInCode(code);

      const secret = result.secrets[0];
      expect(secret?.remediation).toBeDefined();
      expect(secret?.remediation.length).toBeGreaterThan(0);
    });

    it('should include location information', async () => {
      const code = `line1
const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
line3`;

      const result = await detector.detectInCode(code);

      const secret = result.secrets[0];
      expect(secret?.location).toBeDefined();
      expect(secret?.location.line).toBe(2);
    });

    it('should handle empty code', async () => {
      const result = await detector.detectInCode('');

      expect(result.success).toBe(true);
      expect(result.secrets).toEqual([]);
    });

    it('should not detect false positives by default', async () => {
      const code = `
        const password = "test_password";
        const apiKey = "example_key_placeholder";
      `;

      const result = await detector.detectInCode(code);

      // These should be filtered as false positives
      expect(result.secrets.filter((s) => s.confidence >= 0.7).length).toBe(0);
    });

    it('should include false positives when option is set', async () => {
      const code = `
        const password = "testPassword";
      `;

      const result = await detector.detectInCode(code, {
        includeFalsePositives: true,
      });

      expect(result.secrets.length).toBeGreaterThan(0);
    });

    it('should filter by secret types', async () => {
      const code = `
        const awsKey = "AKIATESTFAKEKEY12345";
        const stripeKey = "sk_test_FakeKeyForTestingOnly1234";
      `;

      const result = await detector.detectInCode(code, {
        secretTypes: ['aws_key'],
      });

      expect(result.secrets.every((s) => s.type === 'aws_key')).toBe(true);
    });

    it('should return secrets by type count', async () => {
      const code = `
        const awsKey = "AKIATESTFAKEKEY12345";
        const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `;

      const result = await detector.detectInCode(code);

      expect(result.secretsByType).toBeDefined();
    });
  });

  describe('detectInFile', () => {
    it('should detect secrets in a file', async () => {
      const filePath = path.join(tempDir, 'secrets.js');
      fs.writeFileSync(filePath, 'const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";');

      const result = await detector.detectInFile(filePath);

      expect(result.success).toBe(true);
      expect(result.secrets.length).toBeGreaterThan(0);
      expect(result.secrets[0].location.file).toBe(filePath);
    });

    it('should handle non-existent file', async () => {
      const result = await detector.detectInFile('/nonexistent/file.js');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('detectInDirectory', () => {
    it('should detect secrets in all files', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'file1.js'),
        'const aws = "AKIATESTFAKEKEY12345";'
      );
      fs.writeFileSync(
        path.join(tempDir, 'file2.ts'),
        'const github = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";'
      );

      const result = await detector.detectInDirectory(tempDir);

      expect(result.success).toBe(true);
      expect(result.filesScanned).toBeGreaterThanOrEqual(2);
      expect(result.secrets.length).toBeGreaterThanOrEqual(2);
    });

    it('should track files with secrets', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'with-secret.js'),
        'const aws = "AKIATESTFAKEKEY12345";'
      );
      fs.writeFileSync(path.join(tempDir, 'without-secret.js'), 'const x = 1;');

      const result = await detector.detectInDirectory(tempDir);

      expect(result.filesWithSecrets).toBe(1);
    });

    it('should respect exclude patterns', async () => {
      const nodeModules = path.join(tempDir, 'node_modules');
      fs.mkdirSync(nodeModules);
      fs.writeFileSync(
        path.join(nodeModules, 'secret.js'),
        'const aws = "AKIATESTFAKEKEY12345";'
      );
      fs.writeFileSync(path.join(tempDir, 'app.js'), 'const x = 1;');

      const result = await detector.detectInDirectory(tempDir, {
        excludePatterns: ['**/node_modules/**'],
      });

      const nodeModuleSecrets = result.secrets.filter(
        (s) => s.location.file.includes('node_modules')
      );
      expect(nodeModuleSecrets.length).toBe(0);
    });

    it('should skip binary files', async () => {
      fs.writeFileSync(path.join(tempDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      fs.writeFileSync(
        path.join(tempDir, 'code.js'),
        'const aws = "AKIATESTFAKEKEY12345";'
      );

      const result = await detector.detectInDirectory(tempDir);

      // Should only scan code.js
      expect(result.filesScanned).toBe(1);
    });
  });

  describe('detectInHistory', () => {
    it('should return warning for non-implemented git history', async () => {
      const result = await detector.detectInHistory(tempDir);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.historyScanned).toBeDefined();
    });
  });

  describe('Rule Management', () => {
    it('should add a new rule', () => {
      const newRule: SecretDetectionRule = {
        id: 'NEW001',
        name: 'new-secret',
        secretType: 'generic_secret',
        pattern: /newsecret_[a-z0-9]+/g,
        severity: SecurityIssueSeverity.HIGH,
        enabled: true,
      };

      detector.addRule(newRule);
      const rules = detector.getRules();

      expect(rules.some((r) => r.id === 'NEW001')).toBe(true);
    });

    it('should remove a rule', () => {
      const rules = detector.getRules();
      const ruleToRemove = rules[0].id;

      const removed = detector.removeRule(ruleToRemove);

      expect(removed).toBe(true);
      expect(detector.getRules().some((r) => r.id === ruleToRemove)).toBe(false);
    });

    it('should return false when removing non-existent rule', () => {
      const removed = detector.removeRule('NONEXISTENT');
      expect(removed).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('should calculate entropy correctly', () => {
      // Low entropy (repeated characters)
      const lowEntropy = detector.calculateEntropy('aaaaaaaaaa');
      expect(lowEntropy).toBe(0);

      // Higher entropy (random characters)
      const highEntropy = detector.calculateEntropy('aB3$xZ9@mK');
      expect(highEntropy).toBeGreaterThan(3);
    });

    it('should mask secrets correctly', () => {
      const masked = detector.maskSecret('abcdefghijklmnop');

      expect(masked.startsWith('abcd')).toBe(true);
      expect(masked.endsWith('mnop')).toBe(true);
      expect(masked.includes('*')).toBe(true);
    });

    it('should mask short secrets completely', () => {
      const masked = detector.maskSecret('short');

      expect(masked).toBe('*****');
    });

    it('should handle custom show chars in masking', () => {
      const masked = detector.maskSecret('abcdefghijklmnop', 2);

      expect(masked.startsWith('ab')).toBe(true);
      expect(masked.endsWith('op')).toBe(true);
    });
  });

  describe('Options', () => {
    it('should include rules by ID', async () => {
      const code = `
        const aws = "AKIATESTFAKEKEY12345";
        const github = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `;

      const result = await detector.detectInCode(code, {
        includeRules: ['SEC001'], // AWS key rule
      });

      expect(result.secrets.every((s) => s.ruleId === 'SEC001')).toBe(true);
    });

    it('should exclude rules by ID', async () => {
      const code = `
        const aws = "AKIATESTFAKEKEY12345";
      `;

      const result = await detector.detectInCode(code, {
        excludeRules: ['SEC001'],
      });

      expect(result.secrets.every((s) => s.ruleId !== 'SEC001')).toBe(true);
    });

    it('should use custom rules', async () => {
      const code = 'const secret = "custom_secret_abcd123456";';

      const customRule: SecretDetectionRule = {
        id: 'CUSTOM001',
        name: 'custom-pattern',
        secretType: 'generic_secret',
        pattern: /custom_secret_[a-z0-9]+/g,
        severity: SecurityIssueSeverity.HIGH,
        enabled: true,
      };

      const result = await detector.detectInCode(code, {
        customRules: [customRule],
      });

      expect(result.secrets.some((s) => s.ruleId === 'CUSTOM001')).toBe(true);
    });
  });

  describe('Verification', () => {
    it('should verify JWT format', async () => {
      const code = `
        const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      `;

      const result = await detector.detectInCode(code, {
        verifySecrets: true,
      });

      const jwtSecret = result.secrets.find((s) => s.type === 'jwt');
      expect(jwtSecret?.verified).toBe(true);
    });
  });

  describe('Disposal', () => {
    it('should throw error after disposal', () => {
      detector.dispose();

      expect(() => detector.getRules()).toThrow(/disposed/);
    });

    it('should throw error when detecting after disposal', async () => {
      detector.dispose();

      await expect(detector.detectInCode('test')).rejects.toThrow(/disposed/);
    });
  });
});
