/**
 * Default Code Analyzer for Documentation Generator
 *
 * Provides regex-based TypeScript code structure analysis to generate
 * real HLD/MLD/LLD documents from actual source files.
 *
 * @module core/docs-generator/code-analyzer
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename, relative, extname } from 'node:path';

import type {
  DocLevel,
  DocGeneratorOptions,
  HLDContent,
  MLDContent,
  LLDContent,
  ModuleDescriptor,
  ModuleRelation,
} from './interfaces/docs-generator.interface';
import type { ContentAnalyzer } from './docs-generator';
import { MAX_EXPORTED_SYMBOLS, MIN_COMPONENT_LOC } from './constants';

/**
 * Parsed class/interface declaration
 */
interface ParsedDeclaration {
  kind: 'class' | 'interface' | 'type' | 'enum';
  name: string;
  exported: boolean;
  extends?: string;
  implements?: string[];
  methods: string[];
}

/**
 * Parsed function signature
 */
interface ParsedFunction {
  name: string;
  exported: boolean;
  async: boolean;
  generator: boolean;
  params: string;
  returnType: string;
  signature: string;
}

/**
 * Parsed import statement
 */
interface ParsedImport {
  source: string;
  specifiers: string[];
  isRelative: boolean;
}

// ---------------------------------------------------------------------------
// Regex patterns for TypeScript parsing
// ---------------------------------------------------------------------------

const CLASS_RE =
  /^(export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+([\w.]+))?(?:\s+implements\s+([^{]+))?\s*\{/gm;

const INTERFACE_RE =
  /^(export\s+)?interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{/gm;

const TYPE_RE =
  /^(export\s+)?type\s+(\w+)\s*(?:<[^>]*>)?\s*=/gm;

const ENUM_RE =
  /^(export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{/gm;

const FUNCTION_RE =
  /^(export\s+)?(?:async\s+)?function\s*(\*?)\s*(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^{;]+))?/gm;

const ARROW_EXPORT_RE =
  /^export\s+(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(async\s+)?\([^)]*\)\s*(?::\s*([^=>{]+))?\s*=>/gm;

const METHOD_RE =
  /^\s+(?:(?:public|private|protected|static|abstract|readonly|async|override)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*:\s*[^{;]+)?/gm;

const IMPORT_RE =
  /^import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/gm;

const EXPORT_FROM_RE =
  /^export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/gm;

const EXPORT_STAR_RE =
  /^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm;

const EXPORT_NAMED_RE =
  /^export\s+(?:const|let|var|function|class|interface|type|enum|abstract\s+class|async\s+function)\s+(\w+)/gm;

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function readTextFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

async function countLines(filePath: string): Promise<number> {
  const content = await readTextFile(filePath);
  if (!content) return 0;
  return content.split('\n').length;
}

/**
 * Recursively collect all TypeScript files under a directory.
 */
async function collectTsFiles(dir: string, maxDepth = 10): Promise<string[]> {
  if (maxDepth <= 0) return [];
  if (!(await isDirectory(dir))) return [];

  const files: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    if (await isDirectory(full)) {
      files.push(...(await collectTsFiles(full, maxDepth - 1)));
    } else if (extname(entry) === '.ts' || extname(entry) === '.tsx') {
      files.push(full);
    }
  }

  return files;
}

/**
 * List immediate subdirectories of a directory (non-recursive).
 */
async function listSubdirs(dir: string): Promise<string[]> {
  if (!(await isDirectory(dir))) return [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const dirs: string[] = [];
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    if (await isDirectory(full)) {
      dirs.push(full);
    }
  }
  return dirs;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseImports(content: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  let match: RegExpExecArray | null;

  const re = new RegExp(IMPORT_RE.source, IMPORT_RE.flags);
  while ((match = re.exec(content)) !== null) {
    const specifiers = (match[1] ?? match[2] ?? '')
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    const source = match[3];
    imports.push({
      source,
      specifiers,
      isRelative: source.startsWith('.') || source.startsWith('@/'),
    });
  }

  return imports;
}

function parseExports(content: string): string[] {
  const exports = new Set<string>();

  // export { Foo, Bar } from ...
  let match: RegExpExecArray | null;
  let re = new RegExp(EXPORT_FROM_RE.source, EXPORT_FROM_RE.flags);
  while ((match = re.exec(content)) !== null) {
    for (const spec of match[1].split(',')) {
      const name = spec.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) exports.add(name);
    }
  }

  // export * from ...
  re = new RegExp(EXPORT_STAR_RE.source, EXPORT_STAR_RE.flags);
  while ((match = re.exec(content)) !== null) {
    exports.add(`* from ${match[1]}`);
  }

  // export const/function/class/interface/type/enum Name
  re = new RegExp(EXPORT_NAMED_RE.source, EXPORT_NAMED_RE.flags);
  while ((match = re.exec(content)) !== null) {
    exports.add(match[1]);
  }

  return [...exports];
}

function parseDeclarations(content: string): ParsedDeclaration[] {
  const decls: ParsedDeclaration[] = [];

  // Classes
  let re = new RegExp(CLASS_RE.source, CLASS_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const implementsList = match[4]
      ? match[4].split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // Extract method names from the class body
    const classBodyStart = match.index + match[0].length;
    const methods = extractMethodNames(content, classBodyStart);

    decls.push({
      kind: 'class',
      name: match[2],
      exported: !!match[1],
      extends: match[3] || undefined,
      implements: implementsList.length > 0 ? implementsList : undefined,
      methods,
    });
  }

  // Interfaces
  re = new RegExp(INTERFACE_RE.source, INTERFACE_RE.flags);
  while ((match = re.exec(content)) !== null) {
    const bodyStart = match.index + match[0].length;
    const methods = extractMethodNames(content, bodyStart);

    decls.push({
      kind: 'interface',
      name: match[2],
      exported: !!match[1],
      extends: match[3]?.trim() || undefined,
      methods,
    });
  }

  // Type aliases
  re = new RegExp(TYPE_RE.source, TYPE_RE.flags);
  while ((match = re.exec(content)) !== null) {
    decls.push({
      kind: 'type',
      name: match[2],
      exported: !!match[1],
      methods: [],
    });
  }

  // Enums
  re = new RegExp(ENUM_RE.source, ENUM_RE.flags);
  while ((match = re.exec(content)) !== null) {
    decls.push({
      kind: 'enum',
      name: match[2],
      exported: !!match[1],
      methods: [],
    });
  }

  return decls;
}

/**
 * Extract method-like names from a brace-delimited body starting at the given offset.
 * Uses a simple brace-depth counter to avoid matching nested bodies.
 */
function extractMethodNames(content: string, startOffset: number): string[] {
  const methods: string[] = [];
  let depth = 1;
  let pos = startOffset;

  // Find the extent of the current body (depth 1)
  while (pos < content.length && depth > 0) {
    if (content[pos] === '{') depth++;
    else if (content[pos] === '}') depth--;
    pos++;
  }

  const body = content.slice(startOffset, pos);
  const re = new RegExp(METHOD_RE.source, METHOD_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const name = match[1];
    // Skip common non-method keywords
    if (['if', 'else', 'for', 'while', 'switch', 'return', 'new', 'throw', 'catch', 'try', 'constructor'].includes(name)) continue;
    if (!methods.includes(name)) {
      methods.push(name);
    }
  }

  return methods;
}

function parseFunctions(content: string): ParsedFunction[] {
  const fns: ParsedFunction[] = [];

  // Standard function declarations
  let re = new RegExp(FUNCTION_RE.source, FUNCTION_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const exported = !!match[1];
    const generator = match[2] === '*';
    const name = match[3];
    const params = match[4]?.trim() ?? '';
    const returnType = match[5]?.trim() ?? 'void';
    const isAsync = match[0].includes('async');

    const sig = buildSignature(name, params, returnType, isAsync, generator);
    fns.push({ name, exported, async: isAsync, generator, params, returnType, signature: sig });
  }

  // Arrow function exports
  re = new RegExp(ARROW_EXPORT_RE.source, ARROW_EXPORT_RE.flags);
  while ((match = re.exec(content)) !== null) {
    const name = match[1];
    const isAsync = !!match[2];
    const returnType = match[3]?.trim() ?? 'void';

    fns.push({
      name,
      exported: true,
      async: isAsync,
      generator: false,
      params: '',
      returnType,
      signature: `${isAsync ? 'async ' : ''}${name}(): ${returnType}`,
    });
  }

  return fns;
}

function buildSignature(
  name: string,
  params: string,
  returnType: string,
  isAsync: boolean,
  isGenerator: boolean,
): string {
  const prefix = isAsync ? 'async ' : '';
  const star = isGenerator ? '*' : '';
  return `${prefix}${star}${name}(${params}): ${returnType}`;
}

// ---------------------------------------------------------------------------
// Module analysis helpers
// ---------------------------------------------------------------------------

async function analyzeModule(
  modulePath: string,
  rootPath: string,
): Promise<ModuleDescriptor> {
  const name = basename(modulePath);
  const tsFiles = await collectTsFiles(modulePath, 5);

  let totalLoc = 0;
  const allExports: string[] = [];
  const allImportSources: string[] = [];
  let description = '';

  for (const file of tsFiles) {
    totalLoc += await countLines(file);
    const content = await readTextFile(file);

    // Collect exports
    const exports = parseExports(content);
    allExports.push(...exports);

    // Collect import sources for dependency detection
    const imports = parseImports(content);
    for (const imp of imports) {
      if (imp.isRelative) {
        allImportSources.push(imp.source);
      }
    }

    // Extract description from module-level JSDoc if it's index.ts
    if (basename(file) === 'index.ts' && !description) {
      const docMatch = content.match(/\/\*\*\s*\n([^*]*(?:\*[^/][^*]*)*)\*\//);
      if (docMatch) {
        const lines = docMatch[1]
          .split('\n')
          .map((l) => l.replace(/^\s*\*\s?/, '').trim())
          .filter(Boolean);
        description = lines[0] ?? '';
      }
    }
  }

  if (!description) {
    description = `${name} module (${tsFiles.length} files)`;
  }

  // Deduplicate exports (strip "* from ..." duplicates)
  const uniqueExports = [...new Set(allExports)].slice(0, MAX_EXPORTED_SYMBOLS);

  // Resolve dependencies: look for imports that reference sibling modules
  const dependencies = resolveModuleDependencies(allImportSources, modulePath);

  return {
    name,
    path: relative(rootPath, modulePath) || name,
    description,
    exports: uniqueExports,
    dependencies,
    loc: totalLoc,
  };
}

/**
 * Determine which sibling modules this module depends on, based on its import paths.
 */
function resolveModuleDependencies(
  importSources: string[],
  modulePath: string,
): string[] {
  const deps = new Set<string>();

  for (const source of importSources) {
    // Handle @/ alias imports
    if (source.startsWith('@/')) {
      const parts = source.replace('@/', '').split('/');
      if (parts.length >= 2) {
        // e.g. @/core/hooks -> hooks
        deps.add(parts[parts.length >= 3 ? 1 : 0]);
      }
      continue;
    }

    // Handle relative imports that go up to sibling modules (../)
    if (source.startsWith('../')) {
      const parts = source.replace(/^(\.\.\/)+/, '').split('/');
      if (parts[0]) {
        deps.add(parts[0]);
      }
    }
  }

  // Remove self-references
  const selfName = basename(modulePath);
  deps.delete(selfName);

  // Remove non-module references (e.g. 'interfaces', 'utils')
  const commonNonModules = ['interfaces', 'utils', 'types', 'helpers', 'constants', 'index'];
  for (const nm of commonNonModules) {
    deps.delete(nm);
  }

  return [...deps];
}

/**
 * Detect inter-module relationships from import analysis.
 */
function detectRelationships(modules: ModuleDescriptor[]): ModuleRelation[] {
  const relations: ModuleRelation[] = [];
  const moduleNames = new Set(modules.map((m) => m.name));

  for (const mod of modules) {
    for (const dep of mod.dependencies) {
      if (moduleNames.has(dep)) {
        relations.push({
          source: mod.name,
          target: dep,
          type: 'imports',
        });
      }
    }
  }

  return relations;
}

/**
 * Detect technology stack from package.json and file extensions.
 */
async function detectTechStack(rootPath: string): Promise<string[]> {
  const stack: string[] = [];

  // Check for package.json
  const pkgPath = join(rootPath, 'package.json');
  const pkgContent = await readTextFile(pkgPath);
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
      const deps = {
        ...(pkg.dependencies as Record<string, string> | undefined),
        ...(pkg.devDependencies as Record<string, string> | undefined),
      };

      if (deps.typescript) stack.push('TypeScript');
      if (deps.react) stack.push('React');
      if (deps.jest || deps['@jest/globals']) stack.push('Jest');
      if (deps.express) stack.push('Express');
      if (deps.zod) stack.push('Zod');
      if (deps.winston) stack.push('Winston');
      if (deps.openai) stack.push('OpenAI SDK');
      if (deps['@anthropic-ai/sdk']) stack.push('Anthropic SDK');
      if (deps.commander) stack.push('Commander');

      // Runtime
      if (pkg.engines && typeof pkg.engines === 'object') {
        const engines = pkg.engines as Record<string, string>;
        if (engines.node) stack.push(`Node.js ${engines.node}`);
      }
    } catch {
      // Malformed package.json — skip
    }
  }

  // Check tsconfig.json
  const tsconfigPath = join(rootPath, 'tsconfig.json');
  if (await pathExists(tsconfigPath)) {
    if (!stack.includes('TypeScript')) stack.push('TypeScript');
  }

  if (stack.length === 0) {
    stack.push('TypeScript');
  }

  return stack;
}

// ---------------------------------------------------------------------------
// HLD Analyzer
// ---------------------------------------------------------------------------

async function analyzeHLD(
  rootPath: string,
  _options?: DocGeneratorOptions,
): Promise<HLDContent> {
  const systemName = basename(rootPath);

  // Determine src directory
  const srcPath = join(rootPath, 'src');
  const scanRoot = (await isDirectory(srcPath)) ? srcPath : rootPath;

  // Discover top-level modules
  const subdirs = await listSubdirs(scanRoot);

  // If the scan root has its own subdirectories (e.g. src/core/*), go one level deeper
  // when the scan root only has a few entries that are clearly container dirs (core, shared, etc.)
  let moduleDirs = subdirs;
  if (subdirs.length <= 5 && subdirs.length > 0) {
    // Check if these are container directories with their own subdirectories
    const expanded: string[] = [];
    for (const sub of subdirs) {
      const innerDirs = await listSubdirs(sub);
      if (innerDirs.length > 0) {
        expanded.push(...innerDirs);
      } else {
        expanded.push(sub);
      }
    }
    if (expanded.length > subdirs.length) {
      moduleDirs = expanded;
    }
  }

  // Apply module filter
  const modules = _options?.modules;
  if (modules && modules.length > 0) {
    moduleDirs = moduleDirs.filter((d) =>
      modules.includes(basename(d)),
    );
  }

  // Analyze each module
  const components: ModuleDescriptor[] = [];
  for (const dir of moduleDirs) {
    const descriptor = await analyzeModule(dir, rootPath);
    components.push(descriptor);
  }

  // Sort by LOC descending
  components.sort((a, b) => b.loc - a.loc);

  // Detect relationships
  const relationships = detectRelationships(components);

  // Detect tech stack
  const techStack = await detectTechStack(rootPath);

  // Generate architecture decisions from file patterns
  const decisions = deriveArchitectureDecisions(components);

  const overview =
    `System with ${components.length} modules, ` +
    `${relationships.length} inter-module dependencies. ` +
    `Total LOC: ${components.reduce((sum, c) => sum + c.loc, 0)}.`;

  return {
    systemName,
    overview,
    components,
    relationships,
    decisions,
    techStack,
  };
}

function deriveArchitectureDecisions(components: ModuleDescriptor[]): string[] {
  const decisions: string[] = [];

  const moduleNames = components.map((c) => c.name);

  if (moduleNames.includes('orchestrator')) {
    decisions.push('Orchestrator pattern for agent coordination');
  }
  if (moduleNames.includes('plugins') || moduleNames.includes('hooks')) {
    decisions.push('Plugin/hook system for extensibility');
  }
  if (moduleNames.includes('mcp')) {
    decisions.push('MCP (Model Context Protocol) integration');
  }
  if (moduleNames.includes('security') || moduleNames.includes('permission')) {
    decisions.push('Dedicated security and permission boundary');
  }
  if (moduleNames.includes('persistence')) {
    decisions.push('Persistence layer abstraction');
  }
  if (moduleNames.includes('lsp')) {
    decisions.push('LSP integration for code intelligence');
  }

  return decisions;
}

// ---------------------------------------------------------------------------
// MLD Analyzer
// ---------------------------------------------------------------------------

async function analyzeMLD(
  modulePath: string,
  _options?: DocGeneratorOptions,
): Promise<MLDContent> {
  const moduleName = basename(modulePath);

  // Collect all TS files in this module
  const maxDepth = _options?.maxDepth ?? 5;
  const tsFiles = await collectTsFiles(modulePath, maxDepth);

  const allDeclarations: ParsedDeclaration[] = [];
  const allImports: ParsedImport[] = [];
  const interfaceNames: string[] = [];
  const subComponentMap = new Map<string, { file: string; loc: number; exports: string[]; deps: string[] }>();

  for (const file of tsFiles) {
    const content = await readTextFile(file);
    const decls = parseDeclarations(content);
    allDeclarations.push(...decls);

    const imports = parseImports(content);
    allImports.push(...imports);

    const exports = parseExports(content);
    const loc = content.split('\n').length;
    const relPath = relative(modulePath, file);
    const depSources = imports.filter((i) => i.isRelative).map((i) => i.source);

    subComponentMap.set(relPath, { file, loc, exports, deps: depSources });

    // Collect interface names
    for (const decl of decls) {
      if (decl.kind === 'interface' && decl.exported) {
        interfaceNames.push(decl.name);
      }
    }
  }

  // Build sub-component descriptors from significant files/subdirectories
  const subComponents: ModuleDescriptor[] = [];
  const subdirs = await listSubdirs(modulePath);

  for (const subdir of subdirs) {
    const descriptor = await analyzeModule(subdir, modulePath);
    subComponents.push(descriptor);
  }

  // If no subdirectories, create descriptors from individual files
  if (subComponents.length === 0) {
    for (const [relPath, info] of subComponentMap) {
      if (info.exports.length > 0 || info.loc > MIN_COMPONENT_LOC) {
        subComponents.push({
          name: basename(relPath, extname(relPath)),
          path: relPath,
          description: `${info.exports.length} exports, ${info.loc} LOC`,
          exports: info.exports,
          dependencies: [],
          loc: info.loc,
        });
      }
    }
  }

  // Build interface list with extends/implements info
  const interfaceDescriptions: string[] = [];
  for (const decl of allDeclarations) {
    if ((decl.kind === 'interface' || decl.kind === 'class') && decl.exported) {
      let desc = `${decl.kind} ${decl.name}`;
      if (decl.extends) desc += ` extends ${decl.extends}`;
      if (decl.implements && decl.implements.length > 0) {
        desc += ` implements ${decl.implements.join(', ')}`;
      }
      if (decl.methods.length > 0) {
        desc += ` { ${decl.methods.join(', ')} }`;
      }
      interfaceDescriptions.push(desc);
    }
  }

  // Detect data flow from import chains
  const dataFlow = deriveDataFlow(allImports, moduleName);

  // Detect error handling patterns
  const errorHandling = await detectErrorHandling(tsFiles);

  const overview =
    `Module ${moduleName}: ${tsFiles.length} files, ` +
    `${allDeclarations.filter((d) => d.exported).length} exported declarations, ` +
    `${interfaceNames.length} interfaces.`;

  return {
    moduleName,
    overview,
    subComponents,
    interfaces: interfaceDescriptions,
    dataFlow,
    errorHandling,
  };
}

function deriveDataFlow(imports: ParsedImport[], _moduleName: string): string[] {
  const flows: string[] = [];
  const externalDeps = new Set<string>();

  for (const imp of imports) {
    if (!imp.isRelative && !imp.source.startsWith('node:')) {
      externalDeps.add(imp.source.split('/')[0]);
    }
  }

  if (externalDeps.size > 0) {
    flows.push(`External dependencies: ${[...externalDeps].join(', ')}`);
  }

  // Count relative imports to detect internal coupling
  const relativeImportCount = imports.filter((i) => i.isRelative).length;
  if (relativeImportCount > 0) {
    flows.push(`Internal imports: ${relativeImportCount} cross-file references`);
  }

  return flows;
}

async function detectErrorHandling(tsFiles: string[]): Promise<string[]> {
  const patterns: string[] = [];
  let hasTryCatch = false;
  let hasCustomErrors = false;
  let hasResultType = false;

  for (const file of tsFiles) {
    const content = await readTextFile(file);
    if (/try\s*\{/.test(content)) hasTryCatch = true;
    if (/class\s+\w+Error\s+extends\s+(Error|Base\w*Error)/.test(content)) hasCustomErrors = true;
    if (/Result<|Either<|Success|Failure/.test(content)) hasResultType = true;
  }

  if (hasTryCatch) patterns.push('try/catch error handling');
  if (hasCustomErrors) patterns.push('Custom error classes');
  if (hasResultType) patterns.push('Result/Either type pattern');

  return patterns;
}

// ---------------------------------------------------------------------------
// LLD Analyzer
// ---------------------------------------------------------------------------

async function analyzeLLD(
  componentPath: string,
  _options?: DocGeneratorOptions,
): Promise<LLDContent> {
  const isDir = await isDirectory(componentPath);
  const componentName = basename(componentPath);

  let tsFiles: string[];
  if (isDir) {
    tsFiles = await collectTsFiles(componentPath, _options?.maxDepth ?? 3);
  } else {
    tsFiles = (await pathExists(componentPath)) ? [componentPath] : [];
  }

  const allSignatures: string[] = [];
  const ioTypes: string[] = [];
  const algorithms: string[] = [];
  const edgeCases: string[] = [];
  const descriptions: string[] = [];

  for (const file of tsFiles) {
    const content = await readTextFile(file);

    // Parse function signatures
    const fns = parseFunctions(content);
    for (const fn of fns) {
      if (fn.exported) {
        allSignatures.push(fn.signature);
      }
    }

    // Parse class/interface methods as signatures
    const decls = parseDeclarations(content);
    for (const decl of decls) {
      if (decl.exported && decl.methods.length > 0) {
        for (const method of decl.methods) {
          allSignatures.push(`${decl.name}.${method}()`);
        }
      }
    }

    // Extract type definitions as IO types
    for (const decl of decls) {
      if (decl.kind === 'type' && decl.exported) {
        ioTypes.push(decl.name);
      }
      if (decl.kind === 'interface' && decl.exported) {
        ioTypes.push(decl.name);
      }
    }

    // Detect algorithmic patterns
    if (/async\s+(function|\w+\s*\()/.test(content)) {
      if (!algorithms.includes('Async/await pattern')) {
        algorithms.push('Async/await pattern');
      }
    }
    if (/function\s*\*|yield\s/.test(content)) {
      if (!algorithms.includes('Generator pattern')) {
        algorithms.push('Generator pattern');
      }
    }
    if (/Promise\.all|Promise\.allSettled|Promise\.race/.test(content)) {
      if (!algorithms.includes('Concurrent promise execution')) {
        algorithms.push('Concurrent promise execution');
      }
    }
    if (/\.map\(|\.filter\(|\.reduce\(/.test(content)) {
      if (!algorithms.includes('Functional collection operations')) {
        algorithms.push('Functional collection operations');
      }
    }
    if (/new Map[<(]|new Set[<(]/.test(content)) {
      if (!algorithms.includes('Map/Set data structures')) {
        algorithms.push('Map/Set data structures');
      }
    }
    if (/RegExp|\/[^/]+\/[gimsuy]/.test(content)) {
      if (!algorithms.includes('Regex-based parsing')) {
        algorithms.push('Regex-based parsing');
      }
    }

    // Detect edge case handling patterns
    if (/if\s*\(\s*!/.test(content)) {
      if (!edgeCases.includes('Null/falsy guard checks')) {
        edgeCases.push('Null/falsy guard checks');
      }
    }
    if (/catch\s*\(/.test(content)) {
      if (!edgeCases.includes('Exception handling')) {
        edgeCases.push('Exception handling');
      }
    }
    if (/default\s*:/.test(content)) {
      if (!edgeCases.includes('Default case handling')) {
        edgeCases.push('Default case handling');
      }
    }
    if (/\.length\s*[=<>!]==?\s*0|\.size\s*[=<>!]==?\s*0/.test(content)) {
      if (!edgeCases.includes('Empty collection handling')) {
        edgeCases.push('Empty collection handling');
      }
    }

    // Module JSDoc description
    const docMatch = content.match(/\/\*\*\s*\n([\s\S]*?)\*\//);
    if (docMatch) {
      const lines = docMatch[1]
        .split('\n')
        .map((l) => l.replace(/^\s*\*\s?/, '').trim())
        .filter((l) => l && !l.startsWith('@'));
      if (lines[0]) {
        descriptions.push(lines[0]);
      }
    }
  }

  const description =
    descriptions.length > 0
      ? descriptions[0]
      : `Component ${componentName} (${tsFiles.length} files)`;

  return {
    componentName,
    description,
    signatures: allSignatures,
    ioTypes: [...new Set(ioTypes)],
    algorithms,
    edgeCases,
  };
}

// ---------------------------------------------------------------------------
// Default analyzer factory
// ---------------------------------------------------------------------------

/**
 * Creates a default content analyzer that performs regex-based
 * TypeScript code structure analysis against the filesystem.
 *
 * Usage:
 * ```ts
 * import { createDefaultAnalyzer } from './code-analyzer';
 * import { DocsGenerator } from './docs-generator';
 *
 * const gen = new DocsGenerator({ analyzer: createDefaultAnalyzer() });
 * const hld = await gen.generateHLD('/path/to/project');
 * ```
 */
export function createDefaultAnalyzer(): ContentAnalyzer {
  return async (
    path: string,
    level: DocLevel,
    options?: DocGeneratorOptions,
  ) => {
    switch (level) {
      case 'HLD':
        return { hld: await analyzeHLD(path, options) };
      case 'MLD':
        return { mld: await analyzeMLD(path, options) };
      case 'LLD':
        return { lld: await analyzeLLD(path, options) };
      default:
        return {};
    }
  };
}
