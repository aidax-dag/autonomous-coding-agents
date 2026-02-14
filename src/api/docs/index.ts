/**
 * API Documentation Module
 *
 * Provides OpenAPI/Swagger spec generation from registered endpoint metadata.
 *
 * @module api/docs
 */

export type { APIEndpointDoc, APIParameter, APIResponse, OpenAPISpec, HTTPMethod, ParameterLocation, SchemaObject } from './types';
export { EndpointRegistry, registerAllEndpoints } from './endpoint-registry';
export { OpenAPIGenerator, type OpenAPIGeneratorConfig } from './openapi-generator';
