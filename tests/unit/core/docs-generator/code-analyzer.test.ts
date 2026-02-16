/**
 * Tests for Default Code Analyzer (DocsGenerator backend)
 *
 * Uses temporary directories with sample TypeScript files to verify
 * that the analyzer produces real HLD/MLD/LLD content.
 */

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  DocsGenerator,
  createDocsGenerator,
  createDefaultAnalyzer,
} from '@/core/docs-generator';

let tempDir: string;

/**
 * Helper: create a directory tree with sample TS files
 * for a realistic mini-project.
 */
async function scaffoldProject(root: string): Promise<void> {
  // src/
  const src = join(root, 'src');
  await mkdir(src, { recursive: true });

  // src/auth/
  const auth = join(src, 'auth');
  await mkdir(auth, { recursive: true });
  await mkdir(join(auth, 'interfaces'), { recursive: true });

  await writeFile(
    join(auth, 'index.ts'),
    `/**
 * Auth Module
 *
 * Handles authentication and authorization.
 *
 * @module auth
 */

export { AuthService } from './auth-service';
export type { IAuthService } from './interfaces/auth.interface';
export { TokenManager } from './token-manager';
`,
  );

  await writeFile(
    join(auth, 'interfaces', 'auth.interface.ts'),
    `export interface IAuthService {
  login(email: string, password: string): Promise<Token>;
  logout(userId: string): Promise<void>;
  verify(token: string): Promise<boolean>;
}

export interface Token {
  access: string;
  refresh: string;
  expiresAt: number;
}
`,
  );

  await writeFile(
    join(auth, 'auth-service.ts'),
    `import type { IAuthService, Token } from './interfaces/auth.interface';
import { TokenManager } from './token-manager';
import { UserRepo } from '../database/user-repo';

export class AuthService implements IAuthService {
  private tokenManager: TokenManager;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  async login(email: string, password: string): Promise<Token> {
    if (!email || !password) {
      throw new AuthError('Invalid credentials');
    }
    // authentication logic
    return this.tokenManager.create(email);
  }

  async logout(userId: string): Promise<void> {
    await this.tokenManager.revoke(userId);
  }

  async verify(token: string): Promise<boolean> {
    try {
      return await this.tokenManager.validate(token);
    } catch (e) {
      return false;
    }
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
  }
}
`,
  );

  await writeFile(
    join(auth, 'token-manager.ts'),
    `import type { Token } from './interfaces/auth.interface';

export class TokenManager {
  async create(userId: string): Promise<Token> {
    const access = 'tok_' + userId;
    return { access, refresh: 'ref_' + userId, expiresAt: Date.now() + 3600 };
  }

  async validate(token: string): Promise<boolean> {
    return token.length > 0;
  }

  async revoke(userId: string): Promise<void> {
    // revocation logic
  }
}
`,
  );

  // src/database/
  const database = join(src, 'database');
  await mkdir(database, { recursive: true });

  await writeFile(
    join(database, 'index.ts'),
    `/**
 * Database Module
 *
 * Persistence layer for the application.
 *
 * @module database
 */

export { UserRepo } from './user-repo';
export type { IRepository } from './repository.interface';
`,
  );

  await writeFile(
    join(database, 'repository.interface.ts'),
    `export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
`,
  );

  await writeFile(
    join(database, 'user-repo.ts'),
    `import type { IRepository } from './repository.interface';

interface User {
  id: string;
  email: string;
  name: string;
}

export class UserRepo implements IRepository<User> {
  private users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findAll(): Promise<User[]> {
    return [...this.users.values()];
  }

  async create(data: Partial<User>): Promise<User> {
    const user: User = {
      id: String(this.users.size + 1),
      email: data.email ?? '',
      name: data.name ?? '',
    };
    this.users.set(user.id, user);
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error('Not found');
    const updated = { ...existing, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}
`,
  );

  // src/utils/
  const utils = join(src, 'utils');
  await mkdir(utils, { recursive: true });

  await writeFile(
    join(utils, 'index.ts'),
    `export { hash } from './hash';
export { validate } from './validate';
`,
  );

  await writeFile(
    join(utils, 'hash.ts'),
    `export async function hash(input: string): Promise<string> {
  return 'hashed_' + input;
}
`,
  );

  await writeFile(
    join(utils, 'validate.ts'),
    `export function validate(email: string): boolean {
  return email.includes('@');
}

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};
`,
  );

  // package.json at root
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          typescript: '^5.0.0',
          zod: '^3.0.0',
        },
        devDependencies: {
          jest: '^29.0.0',
        },
        engines: {
          node: '>=20.0.0',
        },
      },
      null,
      2,
    ),
  );

  // tsconfig.json at root
  await writeFile(
    join(root, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          strict: true,
        },
      },
      null,
      2,
    ),
  );
}

describe('DefaultDocsAnalyzer', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'docs-analyzer-'));
    await scaffoldProject(tempDir);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // createDefaultAnalyzer
  // -----------------------------------------------------------------------

  describe('createDefaultAnalyzer', () => {
    it('should return a function conforming to ContentAnalyzer type', () => {
      const analyzer = createDefaultAnalyzer();
      expect(typeof analyzer).toBe('function');
    });

    it('should return HLD content for HLD level', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(tempDir, 'HLD');
      expect(result.hld).toBeDefined();
      expect(result.mld).toBeUndefined();
      expect(result.lld).toBeUndefined();
    });

    it('should return MLD content for MLD level', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(join(tempDir, 'src', 'auth'), 'MLD');
      expect(result.mld).toBeDefined();
      expect(result.hld).toBeUndefined();
      expect(result.lld).toBeUndefined();
    });

    it('should return LLD content for LLD level', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(
        join(tempDir, 'src', 'auth', 'auth-service.ts'),
        'LLD',
      );
      expect(result.lld).toBeDefined();
      expect(result.hld).toBeUndefined();
      expect(result.mld).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // HLD analysis
  // -----------------------------------------------------------------------

  describe('HLD analysis', () => {
    it('should discover actual modules from the project', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateHLD(tempDir);

      expect(doc.level).toBe('HLD');
      expect(doc.content).toContain('High-Level Design');
      // Must contain actual module names from src/
      expect(doc.content).toContain('auth');
      expect(doc.content).toContain('database');
      expect(doc.content).toContain('utils');
    });

    it('should have non-empty components list', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(tempDir, 'HLD');
      const hld = result.hld!;

      expect(hld.components.length).toBeGreaterThan(0);

      // Verify actual component data
      const authModule = hld.components.find((c) => c.name === 'auth');
      expect(authModule).toBeDefined();
      expect(authModule!.loc).toBeGreaterThan(0);
      expect(authModule!.path).toBeTruthy();
    });

    it('should detect inter-module relationships', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(tempDir, 'HLD');
      const hld = result.hld!;

      // auth imports from database (UserRepo)
      const authToDb = hld.relationships.find(
        (r) => r.source === 'auth' && r.target === 'database',
      );
      expect(authToDb).toBeDefined();
      expect(authToDb!.type).toBe('imports');
    });

    it('should detect tech stack from package.json', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(tempDir, 'HLD');
      const hld = result.hld!;

      expect(hld.techStack).toContain('TypeScript');
      expect(hld.techStack).toContain('Zod');
      expect(hld.techStack).toContain('Jest');
    });

    it('should include overview with module and LOC counts', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(tempDir, 'HLD');
      const hld = result.hld!;

      expect(hld.overview).toMatch(/\d+ modules/);
      expect(hld.overview).toMatch(/Total LOC: \d+/);
    });

    it('should report module exports', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(tempDir, 'HLD');
      const hld = result.hld!;

      const authModule = hld.components.find((c) => c.name === 'auth');
      expect(authModule).toBeDefined();
      expect(authModule!.exports.length).toBeGreaterThan(0);
    });

    it('should set systemName from directory basename', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(tempDir, 'HLD');
      const hld = result.hld!;

      // The temp dir has a generated name; just verify it's set
      expect(hld.systemName).toBeTruthy();
      expect(hld.systemName.length).toBeGreaterThan(0);
    });

    it('should generate formatted doc with Components section', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateHLD(tempDir);

      expect(doc.content).toContain('## Components');
      expect(doc.content).toContain('## Technology Stack');
      expect(doc.content).toContain('LOC:');
    });
  });

  // -----------------------------------------------------------------------
  // MLD analysis
  // -----------------------------------------------------------------------

  describe('MLD analysis', () => {
    it('should detect classes and interfaces in a module', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateMLD(join(tempDir, 'src', 'auth'));

      expect(doc.level).toBe('MLD');
      expect(doc.content).toContain('Mid-Level Design');
      // Should contain actual class/interface names
      expect(doc.content).toContain('AuthService');
      expect(doc.content).toContain('IAuthService');
    });

    it('should detect implements relationships', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(join(tempDir, 'src', 'auth'), 'MLD');
      const mld = result.mld!;

      // AuthService implements IAuthService
      const authServiceDesc = mld.interfaces.find((i) =>
        i.includes('AuthService') && i.includes('implements'),
      );
      expect(authServiceDesc).toBeDefined();
      expect(authServiceDesc).toContain('IAuthService');
    });

    it('should list exported interfaces', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(join(tempDir, 'src', 'auth'), 'MLD');
      const mld = result.mld!;

      // Should list IAuthService and Token interfaces
      const interfaceNames = mld.interfaces.map((i) => i);
      const hasAuthInterface = interfaceNames.some((i) => i.includes('IAuthService'));
      expect(hasAuthInterface).toBe(true);
    });

    it('should detect class methods', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(join(tempDir, 'src', 'auth'), 'MLD');
      const mld = result.mld!;

      // AuthService should have methods listed
      const authServiceEntry = mld.interfaces.find((i) =>
        i.includes('AuthService') && i.includes('{'),
      );
      expect(authServiceEntry).toBeDefined();
      if (authServiceEntry) {
        expect(authServiceEntry).toContain('login');
        expect(authServiceEntry).toContain('logout');
      }
    });

    it('should produce non-empty overview', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(join(tempDir, 'src', 'auth'), 'MLD');
      const mld = result.mld!;

      expect(mld.overview).toMatch(/\d+ files/);
      expect(mld.moduleName).toBe('auth');
    });

    it('should detect error handling patterns', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(join(tempDir, 'src', 'auth'), 'MLD');
      const mld = result.mld!;

      // auth-service.ts has try/catch and custom error class
      expect(mld.errorHandling).toContain('try/catch error handling');
      expect(mld.errorHandling).toContain('Custom error classes');
    });

    it('should list sub-components for modules with subdirectories', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(join(tempDir, 'src', 'auth'), 'MLD');
      const mld = result.mld!;

      // auth has an interfaces/ subdirectory
      const interfacesSub = mld.subComponents.find((sc) => sc.name === 'interfaces');
      expect(interfacesSub).toBeDefined();
    });

    it('should include interfaces section in formatted MLD doc', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateMLD(join(tempDir, 'src', 'auth'));

      expect(doc.content).toContain('## Interfaces');
    });
  });

  // -----------------------------------------------------------------------
  // LLD analysis
  // -----------------------------------------------------------------------

  describe('LLD analysis', () => {
    it('should extract function signatures from a file', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateLLD(join(tempDir, 'src', 'utils', 'hash.ts'));

      expect(doc.level).toBe('LLD');
      expect(doc.content).toContain('Low-Level Design');
      expect(doc.content).toContain('hash');
    });

    it('should detect exported function signatures', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(
        join(tempDir, 'src', 'utils', 'validate.ts'),
        'LLD',
      );
      const lld = result.lld!;

      // validate is an exported function
      const validateSig = lld.signatures.find((s) => s.includes('validate'));
      expect(validateSig).toBeDefined();
    });

    it('should detect type definitions as IO types', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(
        join(tempDir, 'src', 'utils', 'validate.ts'),
        'LLD',
      );
      const lld = result.lld!;

      // ValidationResult is exported type
      expect(lld.ioTypes).toContain('ValidationResult');
    });

    it('should detect async patterns', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(
        join(tempDir, 'src', 'utils', 'hash.ts'),
        'LLD',
      );
      const lld = result.lld!;

      expect(lld.algorithms).toContain('Async/await pattern');
    });

    it('should detect edge case handling patterns', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(
        join(tempDir, 'src', 'auth', 'auth-service.ts'),
        'LLD',
      );
      const lld = result.lld!;

      expect(lld.edgeCases).toContain('Null/falsy guard checks');
      expect(lld.edgeCases).toContain('Exception handling');
    });

    it('should extract class method signatures', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(
        join(tempDir, 'src', 'auth', 'auth-service.ts'),
        'LLD',
      );
      const lld = result.lld!;

      // AuthService is exported and has methods
      const authMethods = lld.signatures.filter((s) => s.includes('AuthService'));
      expect(authMethods.length).toBeGreaterThan(0);
    });

    it('should include API Signatures section in formatted doc', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateLLD(join(tempDir, 'src', 'utils', 'hash.ts'));

      expect(doc.content).toContain('## API Signatures');
    });

    it('should analyze a directory as LLD target', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(join(tempDir, 'src', 'utils'), 'LLD');
      const lld = result.lld!;

      expect(lld.componentName).toBe('utils');
      expect(lld.signatures.length).toBeGreaterThan(0);
      // Should find both hash and validate functions
      const hasHash = lld.signatures.some((s) => s.includes('hash'));
      const hasValidate = lld.signatures.some((s) => s.includes('validate'));
      expect(hasHash).toBe(true);
      expect(hasValidate).toBe(true);
    });

    it('should detect Map/Set data structure usage', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(
        join(tempDir, 'src', 'database', 'user-repo.ts'),
        'LLD',
      );
      const lld = result.lld!;

      expect(lld.algorithms).toContain('Map/Set data structures');
    });

    it('should detect interface IO types', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(
        join(tempDir, 'src', 'auth', 'interfaces', 'auth.interface.ts'),
        'LLD',
      );
      const lld = result.lld!;

      expect(lld.ioTypes).toContain('IAuthService');
      expect(lld.ioTypes).toContain('Token');
    });

    it('should set componentName from filename', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(
        join(tempDir, 'src', 'utils', 'hash.ts'),
        'LLD',
      );
      const lld = result.lld!;

      expect(lld.componentName).toBe('hash.ts');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle non-existent paths gracefully for HLD', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer('/nonexistent/path/xyz', 'HLD');
      const hld = result.hld!;

      expect(hld.systemName).toBe('xyz');
      expect(hld.components).toHaveLength(0);
      expect(hld.relationships).toHaveLength(0);
    });

    it('should handle non-existent paths gracefully for MLD', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer('/nonexistent/module', 'MLD');
      const mld = result.mld!;

      expect(mld.moduleName).toBe('module');
      expect(mld.subComponents).toHaveLength(0);
      expect(mld.interfaces).toHaveLength(0);
    });

    it('should handle non-existent file paths gracefully for LLD', async () => {
      const analyzer = createDefaultAnalyzer();
      const result = await analyzer('/nonexistent/file.ts', 'LLD');
      const lld = result.lld!;

      expect(lld.componentName).toBe('file.ts');
      expect(lld.signatures).toHaveLength(0);
    });

    it('should handle empty directories', async () => {
      const emptyDir = join(tempDir, 'empty-module');
      await mkdir(emptyDir, { recursive: true });

      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(emptyDir, 'MLD');
      const mld = result.mld!;

      expect(mld.moduleName).toBe('empty-module');
      expect(mld.subComponents).toHaveLength(0);
      expect(mld.interfaces).toHaveLength(0);
    });

    it('should ignore non-TS files', async () => {
      const mixedDir = join(tempDir, 'mixed-files');
      await mkdir(mixedDir, { recursive: true });
      await writeFile(join(mixedDir, 'readme.md'), '# Readme');
      await writeFile(join(mixedDir, 'config.json'), '{}');
      await writeFile(
        join(mixedDir, 'code.ts'),
        'export function hello(): string { return "hi"; }',
      );

      const analyzer = createDefaultAnalyzer();
      const result = await analyzer(mixedDir, 'LLD');
      const lld = result.lld!;

      // Should only find the TS file's function
      expect(lld.signatures.length).toBe(1);
      expect(lld.signatures[0]).toContain('hello');
    });
  });

  // -----------------------------------------------------------------------
  // Integration with DocsGenerator
  // -----------------------------------------------------------------------

  describe('integration with DocsGenerator', () => {
    it('should use default analyzer when no custom analyzer is set', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateHLD(tempDir);

      // Must produce real content, not empty stubs
      expect(doc.content).toContain('## Components');
      expect(doc.content).toContain('auth');
    });

    it('should use default analyzer via createDocsGenerator factory', async () => {
      const gen = createDocsGenerator();
      const doc = await gen.generateMLD(join(tempDir, 'src', 'auth'));

      expect(doc.content).toContain('AuthService');
    });

    it('should override default analyzer with custom one', async () => {
      const customAnalyzer = createDefaultAnalyzer();
      const gen = new DocsGenerator({ analyzer: customAnalyzer });
      const doc = await gen.generateHLD(tempDir);

      // Custom analyzer is the same as default here; verify it works
      expect(doc.content).toContain('## Components');
    });

    it('should produce all three levels from generateAll', async () => {
      const gen = new DocsGenerator();
      const docs = await gen.generateAll(tempDir);

      expect(docs).toHaveLength(3);
      expect(docs[0].level).toBe('HLD');
      expect(docs[1].level).toBe('MLD');
      expect(docs[2].level).toBe('LLD');

      // HLD should have real content
      expect(docs[0].content).toContain('## Components');
    });

    it('should include real source file paths', async () => {
      const gen = new DocsGenerator();
      const doc = await gen.generateHLD(tempDir);

      expect(doc.sourceFiles).toContain(tempDir);
    });
  });
});
