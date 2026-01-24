/**
 * Naming Utilities
 *
 * Utility functions for naming conventions in frontend development.
 *
 * Feature: Team System
 */

/**
 * Convert title to component name (PascalCase)
 */
export function toComponentName(title: string): string {
  return title
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert to camelCase
 */
export function toCamelCase(str: string): string {
  const pascal = toComponentName(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
