#!/usr/bin/env tsx
/**
 * Static OpenAPI Spec Generator
 *
 * Generates docs/api/openapi.json from the endpoint registry.
 * Run via: npx tsx scripts/generate-openapi.ts
 *
 * @module scripts/generate-openapi
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { buildOpenAPISpec } from '../src/api/docs/openapi-serve';

const outPath = resolve('docs/api/openapi.json');
mkdirSync(dirname(outPath), { recursive: true });

const spec = buildOpenAPISpec();
writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n', 'utf-8');

console.log(`OpenAPI spec written to ${outPath}`);
