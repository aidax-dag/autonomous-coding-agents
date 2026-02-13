/**
 * API Key Service Tests
 */

import { createAPIKeyService } from '../../../../src/api/auth/api-key';

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createAgentLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

describe('APIKeyService', () => {
  it('should accept a valid API key', () => {
    const service = createAPIKeyService({ keys: ['key-abc-123', 'key-def-456'] });
    expect(service.validate('key-abc-123')).toBe(true);
  });

  it('should reject an invalid API key', () => {
    const service = createAPIKeyService({ keys: ['key-abc-123'] });
    expect(service.validate('wrong-key')).toBe(false);
  });

  it('should reject an empty API key', () => {
    const service = createAPIKeyService({ keys: ['key-abc-123'] });
    expect(service.validate('')).toBe(false);
  });

  it('should support multiple valid keys', () => {
    const service = createAPIKeyService({ keys: ['key1', 'key2', 'key3'] });
    expect(service.validate('key1')).toBe(true);
    expect(service.validate('key2')).toBe(true);
    expect(service.validate('key3')).toBe(true);
    expect(service.validate('key4')).toBe(false);
  });

  it('should use default header name when not specified', () => {
    const service = createAPIKeyService({ keys: ['key1'] });
    expect(service.getHeaderName()).toBe('x-api-key');
  });

  it('should use custom header name when specified', () => {
    const service = createAPIKeyService({ keys: ['key1'], headerName: 'x-custom-key' });
    expect(service.getHeaderName()).toBe('x-custom-key');
  });
});
