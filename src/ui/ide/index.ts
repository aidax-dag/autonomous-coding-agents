/**
 * IDE Integration Module
 *
 * Server-side adapter layer for IDE extensions (VS Code, JetBrains)
 * to communicate with the ACA system via JSON-RPC.
 *
 * @module ui/ide
 */

export {
  IDEBridge,
  createIDEBridge,
  type IDEBridgeConfig,
  type IDEClient,
  type RPCRequest,
  type RPCResponse,
  type RPCNotification,
  type RPCError,
  type CommandHandler,
  RPC_ERRORS,
} from './ide-bridge';

export {
  IDECommandRegistry,
  createIDECommandRegistry,
  type CommandDefinition,
  type ParamDefinition,
} from './ide-command-registry';
