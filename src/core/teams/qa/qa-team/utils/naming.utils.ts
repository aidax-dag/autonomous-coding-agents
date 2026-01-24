/**
 * Naming Utilities for QA Team
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
 * Convert to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Extract test target from task title
 */
export function extractTestTarget(title: string): string {
  const cleaned = title
    .replace(/test(s)?|write|create|generate/gi, '')
    .replace(/for|of/gi, '')
    .trim();
  return cleaned || 'Component';
}
