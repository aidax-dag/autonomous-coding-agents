/**
 * Type declarations bridge for ink
 *
 * ink 5.x uses the package.json "exports" field for type resolution,
 * which requires moduleResolution "node16", "nodenext", or "bundler".
 * This declaration bridges ink types for "moduleResolution": "node".
 */

declare module 'ink' {
  export * from 'ink/build/index';
}

declare module 'ink-testing-library' {
  export * from 'ink-testing-library/build/index';
}
