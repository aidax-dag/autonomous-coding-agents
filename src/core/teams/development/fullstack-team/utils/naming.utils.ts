/**
 * Naming Utilities for Fullstack Team
 *
 * Utility functions for naming conventions.
 *
 * Feature: Team System
 */

/**
 * Convert to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join('');
}

/**
 * Convert to kebab-case
 */
export function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

/**
 * Extract resource name from title
 */
export function toResourceName(title: string): string {
  return toCamelCase(title.replace(/crud|feature|fullstack/gi, '').trim());
}

/**
 * Extract component name from title
 */
export function toComponentName(title: string): string {
  return toPascalCase(title.replace(/component|ui|page/gi, '').trim());
}
