/**
 * Mock for @mistralai/mistralai module
 *
 * Provides a compatible mock for testing when the package is not installed.
 */

export class Mistral {
  chat: {
    complete: jest.Mock;
    stream: jest.Mock;
  };

  constructor(_config?: { apiKey: string }) {
    this.chat = {
      complete: jest.fn(),
      stream: jest.fn(),
    };
  }
}

export default { Mistral };
