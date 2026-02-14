/**
 * Barrel Export Tests
 *
 * Verify that top-level barrel files can be imported without error.
 */

describe('Barrel Exports', () => {
  it('should export from core barrel', () => {
    expect(() => require('../../src/core')).not.toThrow();
  });

  it('should export from shared barrel', () => {
    expect(() => require('../../src/shared')).not.toThrow();
  });

  it('should export from dx barrel', () => {
    expect(() => require('../../src/dx')).not.toThrow();
  });
});
