/**
 * UUID Mock for Jest
 *
 * Mocks the uuid package for testing purposes.
 */

let uuidCounter = 0;

export const v4 = jest.fn((): string => {
  uuidCounter++;
  return `mock-uuid-${uuidCounter}-${Date.now()}`;
});

export const v1 = jest.fn((): string => {
  uuidCounter++;
  return `mock-uuid-v1-${uuidCounter}-${Date.now()}`;
});

export const validate = jest.fn((uuid: string): boolean => {
  return typeof uuid === 'string' && uuid.length > 0;
});

export const version = jest.fn((uuid: string): number => {
  if (uuid.includes('v1')) return 1;
  return 4;
});

export default {
  v4,
  v1,
  validate,
  version,
};

// Reset function for tests
export const resetMock = (): void => {
  uuidCounter = 0;
  v4.mockClear();
  v1.mockClear();
  validate.mockClear();
  version.mockClear();
};
