/**
 * JSON-RPC 2.0 Protocol
 *
 * Lightweight JSON-RPC 2.0 implementation for TCP-based communication
 * between JetBrains IDE plugins and the ACA server. Handles message
 * framing with Content-Length headers, partial buffer management,
 * and message factory functions.
 *
 * @module platform/jetbrains
 */

// ── Types ──────────────────────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ── Standard Error Codes ───────────────────────────────────────────

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ── Message ID Generator ───────────────────────────────────────────

let nextId = 1;

export function resetIdCounter(): void {
  nextId = 1;
}

// ── Factory Functions ──────────────────────────────────────────────

export function createRequest(method: string, params?: unknown): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: nextId++,
    method,
    params,
  };
}

export function createNotification(method: string, params?: unknown): JsonRpcNotification {
  return {
    jsonrpc: '2.0',
    method,
    params,
  };
}

// ── Type Guards ────────────────────────────────────────────────────

export function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return 'id' in msg && ('result' in msg || 'error' in msg) && !('method' in msg);
}

export function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return 'method' in msg && !('id' in msg);
}

export function isRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return 'method' in msg && 'id' in msg;
}

// ── Serialization ──────────────────────────────────────────────────

const HEADER_SEPARATOR = '\r\n\r\n';

/**
 * Serialize a JSON-RPC message with Content-Length header framing.
 * Format: `Content-Length: <n>\r\n\r\n<json>`
 */
export function serializeMessage(msg: JsonRpcMessage): Buffer {
  const body = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(body, 'utf8')}${HEADER_SEPARATOR}`;
  return Buffer.concat([Buffer.from(header, 'utf8'), Buffer.from(body, 'utf8')]);
}

/**
 * Parse JSON-RPC messages from an accumulating buffer.
 *
 * Handles partial reads by returning the unconsumed remainder alongside
 * any fully-parsed messages. Callers should prepend the returned remainder
 * to the next incoming data chunk.
 */
export function parseMessages(buffer: Buffer): {
  messages: JsonRpcMessage[];
  remainder: Buffer;
} {
  const messages: JsonRpcMessage[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    // Look for the header separator in the remaining buffer
    const headerEnd = buffer.indexOf(HEADER_SEPARATOR, offset);
    if (headerEnd === -1) {
      break; // Incomplete header — wait for more data
    }

    // Extract and parse the Content-Length header
    const headerStr = buffer.slice(offset, headerEnd).toString('utf8');
    const match = headerStr.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      // Malformed header — skip past the separator and try again
      offset = headerEnd + HEADER_SEPARATOR.length;
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + HEADER_SEPARATOR.length;
    const bodyEnd = bodyStart + contentLength;

    if (bodyEnd > buffer.length) {
      break; // Incomplete body — wait for more data
    }

    // Parse the JSON body
    const bodyStr = buffer.slice(bodyStart, bodyEnd).toString('utf8');
    try {
      const parsed = JSON.parse(bodyStr) as JsonRpcMessage;
      messages.push(parsed);
    } catch {
      // Skip malformed JSON — advance past this message
    }

    offset = bodyEnd;
  }

  return {
    messages,
    remainder: buffer.slice(offset),
  };
}
