/**
 * Minimal DI interfaces retained for hook/logging consumers.
 */

/**
 * Disposable interface for resource cleanup
 */
export interface IDisposable {
  dispose(): void | Promise<void>;
}
