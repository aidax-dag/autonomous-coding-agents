/**
 * Session Recovery Module
 *
 * Provides session persistence, checkpointing, and recovery hooks.
 *
 * @module core/hooks/session-recovery
 */

// Interfaces
export * from './session-recovery.interface.js';

// Hook
export { SessionRecoveryHook } from './session-recovery.hook.js';
