/**
 * Tests for Natural Language Test Generation Module
 */

import { RequirementParser } from '@/core/test-gen/requirement-parser';
import { TestCaseGenerator, resetTestCaseCounter } from '@/core/test-gen/test-case-generator';
import { TestCodeEmitter } from '@/core/test-gen/code-emitter';
import { TestGenerator } from '@/core/test-gen/test-generator';
import {
  DEFAULT_TESTGEN_CONFIG,
  type Requirement,
  type TestCase,
  type TestGenConfig,
  type TestStep,
} from '@/core/test-gen/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: 'REQ-001',
    text: 'User should be able to login with valid credentials',
    category: 'functional',
    priority: 'medium',
    acceptanceCriteria: ['Verify: User should be able to login with valid credentials'],
    ...overrides,
  };
}

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'TC-0001',
    name: 'should be able to login with valid credentials',
    description: 'Happy path: User should be able to login with valid credentials',
    type: 'unit',
    requirement: 'REQ-001',
    steps: [{ action: 'User should be able to login with valid credentials', expected: 'Condition is met' }],
    expectedResult: 'be able to login with valid credentials',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// RequirementParser
// ---------------------------------------------------------------------------

describe('RequirementParser', () => {
  let parser: RequirementParser;

  beforeEach(() => {
    parser = new RequirementParser();
  });

  it('should parse numbered list requirements', () => {
    const text = `
      1. User should be able to login
      2. System must validate email format
      3. Admin can manage users
    `;
    const reqs = parser.parseRequirements(text);

    expect(reqs).toHaveLength(3);
    expect(reqs[0].text).toContain('login');
    expect(reqs[1].text).toContain('validate email');
    expect(reqs[2].text).toContain('manage users');
  });

  it('should parse bullet point requirements', () => {
    const text = `
      - User should be able to register
      - System should send confirmation email
      - User can reset password
    `;
    const reqs = parser.parseRequirements(text);

    expect(reqs).toHaveLength(3);
    expect(reqs[0].text).toContain('register');
    expect(reqs[1].text).toContain('confirmation email');
  });

  it('should parse Given/When/Then format', () => {
    const text = 'Given a logged-in user When they click logout Then they should be redirected to login page';
    const reqs = parser.parseRequirements(text);

    expect(reqs.length).toBeGreaterThanOrEqual(1);
    const req = reqs[0];
    expect(req.acceptanceCriteria.length).toBeGreaterThanOrEqual(1);
  });

  it('should categorize functional requirements', () => {
    const text = '1. User should be able to update profile';
    const reqs = parser.parseRequirements(text);

    expect(reqs[0].category).toBe('functional');
  });

  it('should categorize non-functional requirements', () => {
    const text = '1. The system has a clean user interface';
    const reqs = parser.parseRequirements(text);

    expect(reqs[0].category).toBe('non-functional');
  });

  it('should categorize edge-case requirements', () => {
    const text = '1. System handles empty input gracefully';
    const reqs = parser.parseRequirements(text);

    expect(reqs[0].category).toBe('edge-case');
  });

  it('should categorize security requirements', () => {
    const text = '1. System must encrypt user passwords';
    const reqs = parser.parseRequirements(text);

    expect(reqs[0].category).toBe('security');
  });

  it('should categorize performance requirements', () => {
    const text = '1. Response time should be under 200ms for all API calls';
    const reqs = parser.parseRequirements(text);

    expect(reqs[0].category).toBe('performance');
  });

  it('should prioritize high priority requirements', () => {
    const text = '1. System must validate all user input';
    const reqs = parser.parseRequirements(text);

    expect(reqs[0].priority).toBe('high');
  });

  it('should prioritize medium priority by default', () => {
    const text = '1. User should be able to view dashboard';
    const reqs = parser.parseRequirements(text);

    expect(reqs[0].priority).toBe('medium');
  });

  it('should prioritize low priority requirements', () => {
    const text = '1. User may optionally configure theme colors';
    const reqs = parser.parseRequirements(text);

    expect(reqs[0].priority).toBe('low');
  });

  it('should extract acceptance criteria from Given/When/Then', () => {
    const criteria = parser.extractAcceptanceCriteria(
      'Given a valid user When they submit login Then they see the dashboard',
    );

    expect(criteria.length).toBeGreaterThanOrEqual(2);
    const joined = criteria.join(' ');
    expect(joined).toContain('Precondition');
    expect(joined).toContain('Action');
  });

  it('should generate basic acceptance criteria when none detected', () => {
    const criteria = parser.extractAcceptanceCriteria('User should see a welcome message');

    expect(criteria.length).toBeGreaterThanOrEqual(1);
    expect(criteria[0]).toMatch(/Verify|Confirm/);
  });

  it('should assign unique IDs to requirements', () => {
    const text = '1. Requirement A\n2. Requirement B\n3. Requirement C';
    const reqs = parser.parseRequirements(text);

    const ids = reqs.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should handle sentence-delimited requirements', () => {
    const text = 'Users should login. Admins should manage roles. Guests can browse public pages.';
    const reqs = parser.parseRequirements(text);

    expect(reqs.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// TestCaseGenerator
// ---------------------------------------------------------------------------

describe('TestCaseGenerator', () => {
  let generator: TestCaseGenerator;

  beforeEach(() => {
    resetTestCaseCounter();
    generator = new TestCaseGenerator();
  });

  it('should generate a happy path test case', () => {
    const req = makeRequirement();
    const cases = generator.generateTestCases(req);
    const happyPath = cases[0];

    expect(happyPath.name).toContain('should');
    expect(happyPath.description).toContain('Happy path');
    expect(happyPath.requirement).toBe(req.id);
    expect(happyPath.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate edge cases for input-related requirements', () => {
    const req = makeRequirement({
      text: 'System should validate user input before processing',
    });
    const cases = generator.generateTestCases(req);
    const edgeCases = cases.filter((c) => c.description.includes('Edge case'));

    expect(edgeCases.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate edge cases for boundary requirements', () => {
    const req = makeRequirement({
      text: 'System should handle values between minimum and maximum range',
      category: 'edge-case',
    });
    const cases = generator.generateTestCases(req);
    const edgeCases = cases.filter((c) => c.description.includes('Edge case'));

    expect(edgeCases.length).toBeGreaterThanOrEqual(1);
    expect(edgeCases.some((c) => c.name.includes('boundary'))).toBe(true);
  });

  it('should generate negative cases for functional requirements', () => {
    const req = makeRequirement({ category: 'functional' });
    const cases = generator.generateTestCases(req);
    const negativeCases = cases.filter((c) => c.description.includes('Negative'));

    expect(negativeCases.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate security-specific negative cases', () => {
    const req = makeRequirement({
      text: 'System must enforce authentication for all API endpoints',
      category: 'security',
    });
    const cases = generator.generateTestCases(req);
    const securityCases = cases.filter((c) => c.name.includes('unauthorized'));

    expect(securityCases.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate performance-specific negative cases', () => {
    const req = makeRequirement({
      text: 'System should handle concurrent requests without degradation',
      category: 'performance',
    });
    const cases = generator.generateTestCases(req);
    const perfCases = cases.filter((c) => c.name.includes('overload'));

    expect(perfCases.length).toBeGreaterThanOrEqual(1);
  });

  it('should infer steps from acceptance criteria', () => {
    const req = makeRequirement({
      acceptanceCriteria: [
        'Precondition: user is logged in',
        'Action: user clicks submit',
        'Expected: form is saved',
      ],
    });
    const cases = generator.generateTestCases(req);
    const happyPath = cases[0];

    expect(happyPath.steps.length).toBe(3);
    expect(happyPath.steps[0].action).toContain('Set up');
    expect(happyPath.steps[1].action).toContain('clicks submit');
    expect(happyPath.steps[2].expected).toContain('form is saved');
  });

  it('should generate unique IDs for all test cases', () => {
    const req = makeRequirement();
    const cases = generator.generateTestCases(req);
    const ids = cases.map((c) => c.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should infer integration test type for API requirements', () => {
    const req = makeRequirement({
      text: 'API should return user profile data',
    });
    const cases = generator.generateTestCases(req);

    expect(cases[0].type).toBe('integration');
  });

  it('should infer e2e test type for workflow requirements', () => {
    const req = makeRequirement({
      text: 'The end-to-end checkout workflow should complete successfully',
    });
    const cases = generator.generateTestCases(req);

    expect(cases[0].type).toBe('e2e');
  });

  it('should default to unit test type', () => {
    const req = makeRequirement({
      text: 'Function should return correct sum',
    });
    const cases = generator.generateTestCases(req);

    expect(cases[0].type).toBe('unit');
  });
});

// ---------------------------------------------------------------------------
// TestCodeEmitter
// ---------------------------------------------------------------------------

describe('TestCodeEmitter', () => {
  it('should emit Jest format test code', () => {
    const emitter = new TestCodeEmitter({ ...DEFAULT_TESTGEN_CONFIG, framework: 'jest' });
    const result = emitter.emit([makeTestCase()], { suiteName: 'LoginTests' });

    expect(result.framework).toBe('jest');
    expect(result.content).toContain("describe('LoginTests'");
    expect(result.content).toContain("it('should");
    expect(result.content).toContain('expect(');
  });

  it('should emit Mocha format test code', () => {
    const emitter = new TestCodeEmitter({ ...DEFAULT_TESTGEN_CONFIG, framework: 'mocha' });
    const result = emitter.emit([makeTestCase()], { suiteName: 'LoginTests' });

    expect(result.framework).toBe('mocha');
    expect(result.content).toContain("describe('LoginTests'");
    expect(result.content).toContain('function ()');
    expect(result.content).toContain("from 'mocha'");
    expect(result.content).toContain("from 'chai'");
  });

  it('should emit Vitest format test code', () => {
    const emitter = new TestCodeEmitter({ ...DEFAULT_TESTGEN_CONFIG, framework: 'vitest' });
    const result = emitter.emit([makeTestCase()], { suiteName: 'LoginTests' });

    expect(result.framework).toBe('vitest');
    expect(result.content).toContain("describe('LoginTests'");
    expect(result.content).toContain("from 'vitest'");
    expect(result.content).toContain("it('should");
  });

  it('should generate correct imports for each framework', () => {
    const jestEmitter = new TestCodeEmitter({ ...DEFAULT_TESTGEN_CONFIG, framework: 'jest' });
    const mochaEmitter = new TestCodeEmitter({ ...DEFAULT_TESTGEN_CONFIG, framework: 'mocha' });
    const vitestEmitter = new TestCodeEmitter({ ...DEFAULT_TESTGEN_CONFIG, framework: 'vitest' });

    const jestImports = jestEmitter.generateImports('jest');
    const mochaImports = mochaEmitter.generateImports('mocha');
    const vitestImports = vitestEmitter.generateImports('vitest');

    // Jest needs no additional imports
    expect(jestImports).toHaveLength(0);
    // Mocha needs mocha + chai
    expect(mochaImports.length).toBeGreaterThanOrEqual(2);
    // Vitest needs vitest import
    expect(vitestImports.length).toBeGreaterThanOrEqual(1);
  });

  it('should include setup block when configured', () => {
    const emitter = new TestCodeEmitter({
      ...DEFAULT_TESTGEN_CONFIG,
      includeSetup: true,
    });
    const tc = makeTestCase({ setup: 'Initialize test database' });
    const result = emitter.emit([tc], { suiteName: 'Suite' });

    expect(result.content).toContain('beforeEach');
    expect(result.content).toContain('Initialize test database');
  });

  it('should include teardown block when configured', () => {
    const emitter = new TestCodeEmitter({
      ...DEFAULT_TESTGEN_CONFIG,
      includeTeardown: true,
    });
    const tc = makeTestCase({ teardown: 'Clean up test data' });
    const result = emitter.emit([tc], { suiteName: 'Suite' });

    expect(result.content).toContain('afterEach');
    expect(result.content).toContain('Clean up test data');
  });

  it('should skip setup/teardown when not configured', () => {
    const emitter = new TestCodeEmitter({
      ...DEFAULT_TESTGEN_CONFIG,
      includeSetup: false,
      includeTeardown: false,
    });
    const tc = makeTestCase({ setup: 'Something', teardown: 'Something' });
    const result = emitter.emit([tc], { suiteName: 'Suite' });

    expect(result.content).not.toContain('beforeEach');
    expect(result.content).not.toContain('afterEach');
  });

  it('should generate correct file name', () => {
    const emitter = new TestCodeEmitter({
      ...DEFAULT_TESTGEN_CONFIG,
      language: 'typescript',
    });
    const result = emitter.emit([makeTestCase()], { suiteName: 'UserProfile' });

    expect(result.fileName).toBe('user-profile.test.ts');
  });

  it('should generate .test.js file name for javascript', () => {
    const emitter = new TestCodeEmitter({
      ...DEFAULT_TESTGEN_CONFIG,
      language: 'javascript',
    });
    const result = emitter.emit([makeTestCase()], { suiteName: 'UserProfile' });

    expect(result.fileName).toBe('user-profile.test.js');
  });

  it('should include custom imports when provided', () => {
    const emitter = new TestCodeEmitter({ ...DEFAULT_TESTGEN_CONFIG, framework: 'jest' });
    const result = emitter.emit([makeTestCase()], {
      suiteName: 'Suite',
      imports: ["import { UserService } from './user-service';"],
    });

    expect(result.content).toContain("import { UserService } from './user-service'");
    expect(result.imports).toContain("import { UserService } from './user-service';");
  });

  it('should format steps with input values', () => {
    const tc = makeTestCase({
      steps: [
        { action: 'Enter username', input: 'testuser', expected: 'Field populated' },
      ],
    });
    const emitter = new TestCodeEmitter(DEFAULT_TESTGEN_CONFIG);
    const result = emitter.emit([tc], { suiteName: 'Suite' });

    expect(result.content).toContain('"testuser"');
    expect(result.content).toContain('Enter username');
  });
});

// ---------------------------------------------------------------------------
// TestGenerator (Orchestrator)
// ---------------------------------------------------------------------------

describe('TestGenerator', () => {
  beforeEach(() => {
    resetTestCaseCounter();
  });

  it('should generate test code from natural language text', () => {
    const gen = new TestGenerator();
    const result = gen.generate('1. User should be able to login with valid credentials');

    expect(result.content).toContain('describe(');
    expect(result.content).toContain('it(');
    expect(result.testCases.length).toBeGreaterThanOrEqual(1);
    expect(result.framework).toBe('jest');
  });

  it('should emit requirements:parsed event', () => {
    const gen = new TestGenerator();
    const events: string[] = [];

    gen.on('requirements:parsed', (reqs) => {
      events.push('requirements:parsed');
      expect(Array.isArray(reqs)).toBe(true);
    });

    gen.generate('1. User should be able to login');
    expect(events).toContain('requirements:parsed');
  });

  it('should emit cases:generated event', () => {
    const gen = new TestGenerator();
    const events: string[] = [];

    gen.on('cases:generated', (cases) => {
      events.push('cases:generated');
      expect(Array.isArray(cases)).toBe(true);
    });

    gen.generate('1. User should be able to login');
    expect(events).toContain('cases:generated');
  });

  it('should emit code:emitted event', () => {
    const gen = new TestGenerator();
    const events: string[] = [];

    gen.on('code:emitted', (result) => {
      events.push('code:emitted');
      expect(result.content).toBeDefined();
    });

    gen.generate('1. User should be able to login');
    expect(events).toContain('code:emitted');
  });

  it('should respect framework configuration', () => {
    const gen = new TestGenerator({ ...DEFAULT_TESTGEN_CONFIG, framework: 'vitest' });
    const result = gen.generate('1. User should be able to login');

    expect(result.framework).toBe('vitest');
    expect(result.content).toContain("from 'vitest'");
  });

  it('should generate from pre-parsed requirements', () => {
    const gen = new TestGenerator();
    const reqs: Requirement[] = [
      makeRequirement({ id: 'REQ-100', text: 'User should view profile' }),
    ];
    const result = gen.generateFromRequirements(reqs);

    expect(result.testCases.length).toBeGreaterThanOrEqual(1);
    expect(result.testCases[0].requirement).toBe('REQ-100');
  });
});

// ---------------------------------------------------------------------------
// Integration: Full Pipeline
// ---------------------------------------------------------------------------

describe('Integration: Full Pipeline', () => {
  beforeEach(() => {
    resetTestCaseCounter();
  });

  it('should process complex requirements into valid test code', () => {
    const input = `
      1. User must be able to login with valid credentials
      2. System should validate email format before registration
      3. API should return 401 for unauthorized requests
      4. System must encrypt passwords using bcrypt
      5. Response time should be under 200ms for all endpoints
    `;

    const gen = new TestGenerator();
    const result = gen.generate(input);

    // Should produce multiple test cases from 5 requirements
    expect(result.testCases.length).toBeGreaterThanOrEqual(5);

    // Generated content should be syntactically structured
    expect(result.content).toContain("describe('");
    expect(result.content).toContain("it('");
    expect(result.content).toContain('expect(');

    // Should have a valid file name
    expect(result.fileName).toMatch(/\.test\.ts$/);
  });

  it('should handle Given/When/Then requirements through full pipeline', () => {
    const input = 'Given a registered user When they enter correct password Then they should see the dashboard';

    const gen = new TestGenerator();
    const result = gen.generate(input);

    expect(result.testCases.length).toBeGreaterThanOrEqual(1);
    expect(result.content).toContain('describe(');
    expect(result.content).toContain('it(');
  });

  it('should generate different frameworks through full pipeline', () => {
    const input = '1. User should be able to search products';

    const jestResult = new TestGenerator({ ...DEFAULT_TESTGEN_CONFIG, framework: 'jest' }).generate(input);
    const mochaResult = new TestGenerator({ ...DEFAULT_TESTGEN_CONFIG, framework: 'mocha' }).generate(input);
    const vitestResult = new TestGenerator({ ...DEFAULT_TESTGEN_CONFIG, framework: 'vitest' }).generate(input);

    expect(jestResult.framework).toBe('jest');
    expect(mochaResult.framework).toBe('mocha');
    expect(vitestResult.framework).toBe('vitest');

    // Mocha should have mocha/chai imports
    expect(mochaResult.content).toContain("from 'mocha'");
    expect(mochaResult.content).toContain("from 'chai'");

    // Vitest should have vitest import
    expect(vitestResult.content).toContain("from 'vitest'");
  });

  it('should produce test code with proper structure', () => {
    const input = '1. User should be able to create a new account';
    const gen = new TestGenerator();
    const result = gen.generate(input);

    // Verify structural elements
    const lines = result.content.split('\n');
    const describeCount = lines.filter((l) => l.includes('describe(')).length;
    const itCount = lines.filter((l) => l.includes("it('")).length;
    const expectCount = lines.filter((l) => l.includes('expect(')).length;

    expect(describeCount).toBeGreaterThanOrEqual(1);
    expect(itCount).toBeGreaterThanOrEqual(1);
    expect(expectCount).toBeGreaterThanOrEqual(1);

    // Each it() should have a matching expect()
    expect(expectCount).toBeGreaterThanOrEqual(itCount);
  });
});
