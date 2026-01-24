/**
 * Accessibility Utilities
 *
 * Helper functions for generating accessibility-related code.
 *
 * Feature: Team System
 */

/**
 * Generate ARIA props based on accessibility requirements
 */
export function generateA11yProps(requirements: string[]): string {
  const props: string[] = [];

  if (requirements.includes('button-role')) {
    props.push('role="button"');
    props.push('tabIndex={0}');
  }

  if (requirements.includes('form-labels')) {
    props.push('aria-labelledby="form-label"');
  }

  if (requirements.includes('focus-trap')) {
    props.push('aria-modal="true"');
  }

  return props.join('\n      ');
}

/**
 * Breakpoint configuration
 */
export const BREAKPOINT_MAP: Record<string, string> = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

/**
 * Generate responsive breakpoint styles
 */
export function generateBreakpointStyle(breakpoint: string, className: string): string {
  const minWidth = BREAKPOINT_MAP[breakpoint] || '768px';

  return `
@media (min-width: ${minWidth}) {
  .${className} {
    /* ${breakpoint} breakpoint styles */
  }
}`;
}
