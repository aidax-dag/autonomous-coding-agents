/**
 * Naming Utilities
 *
 * String transformation utilities for backend code generation.
 *
 * Feature: Team System
 */

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Extract controller name from task title
 */
export function toControllerName(title: string): string {
  return toPascalCase(title.replace(/controller/gi, '')) + 'Controller';
}

/**
 * Extract resource name from task title
 */
export function toResourceName(title: string): string {
  return toCamelCase(
    title
      .replace(/api|endpoint|controller|service|model|schema/gi, '')
      .trim()
  );
}

/**
 * Extract service name from task title
 */
export function toServiceName(title: string): string {
  return toPascalCase(title.replace(/service/gi, '')) + 'Service';
}

/**
 * Extract middleware name from task title
 */
export function toMiddlewareName(title: string): string {
  return toPascalCase(title.replace(/middleware/gi, '')) + 'Middleware';
}
