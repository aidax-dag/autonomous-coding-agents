/**
 * API Documentation Types
 *
 * Type definitions for OpenAPI/Swagger spec generation
 * and endpoint metadata representation.
 *
 * @module api/docs/types
 */

/** HTTP methods supported by API endpoints. */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Parameter location within the HTTP request. */
export type ParameterLocation = 'path' | 'query' | 'header';

/** Schema for request/response body documentation. */
export interface SchemaObject {
  [key: string]: unknown;
}

/** Describes a single API endpoint for documentation. */
export interface APIEndpointDoc {
  /** Route path (Express-style, e.g. '/api/agents/:id'). */
  path: string;
  /** HTTP method. */
  method: HTTPMethod;
  /** Short summary of the endpoint's purpose. */
  summary: string;
  /** Longer description with usage details. */
  description: string;
  /** Grouping tags for the endpoint. */
  tags: string[];
  /** Whether authentication is required. */
  auth: boolean;
  /** Request body specification (POST/PUT/PATCH). */
  requestBody?: {
    contentType: string;
    schema: SchemaObject;
    required?: boolean;
  };
  /** URL/query/header parameters. */
  parameters?: APIParameter[];
  /** Response specifications keyed by HTTP status code. */
  responses: Record<string, APIResponse>;
}

/** Describes a single parameter in an API endpoint. */
export interface APIParameter {
  /** Parameter name. */
  name: string;
  /** Where the parameter appears in the request. */
  in: ParameterLocation;
  /** Whether the parameter is mandatory. */
  required: boolean;
  /** JSON Schema describing the parameter's type. */
  schema: SchemaObject;
  /** Human-readable description. */
  description?: string;
}

/** Describes a single response from an API endpoint. */
export interface APIResponse {
  /** Human-readable description of the response. */
  description: string;
  /** JSON Schema for the response body. */
  schema?: SchemaObject;
}

/** Full OpenAPI 3.0 specification structure. */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}
