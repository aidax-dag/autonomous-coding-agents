/**
 * Type Mapping Utilities
 *
 * Maps between different type systems (TypeScript, Prisma, SQL).
 *
 * Feature: Team System
 */

/**
 * Map generic type to Prisma type
 */
export function toPrismaType(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'String',
    number: 'Int',
    boolean: 'Boolean',
    datetime: 'DateTime',
    date: 'DateTime',
    uuid: 'String',
    text: 'String',
    json: 'Json',
    float: 'Float',
  };
  return typeMap[type.toLowerCase()] || 'String';
}

/**
 * Map generic type to SQL type
 */
export function toSQLType(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'VARCHAR(255)',
    number: 'INTEGER',
    boolean: 'BOOLEAN',
    datetime: 'TIMESTAMPTZ',
    date: 'DATE',
    uuid: 'UUID',
    text: 'TEXT',
    json: 'JSONB',
    float: 'DECIMAL(10,2)',
  };
  return typeMap[type.toLowerCase()] || 'VARCHAR(255)';
}

/**
 * Map generic type to TypeScript type
 */
export function toTypeScriptType(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    datetime: 'Date',
    date: 'Date',
    uuid: 'string',
    text: 'string',
    json: 'Record<string, unknown>',
    float: 'number',
  };
  return typeMap[type.toLowerCase()] || 'string';
}
