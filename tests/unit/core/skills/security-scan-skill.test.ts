/**
 * Security Scan Skill Tests
 */

import { SecurityScanSkill, createSecurityScanSkill } from '../../../../src/core/skills/skills/security-scan-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('SecurityScanSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new SecurityScanSkill();
    expect(skill.name).toBe('security-scan');
    expect(skill.description).toContain('security vulnerabilities');
    expect(skill.tags).toContain('security');
    expect(skill.tags).toContain('scan');
    expect(skill.tags).toContain('owasp');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new SecurityScanSkill();
    expect(skill.validate({ files: ['a.ts'] })).toBe(true);
    expect(skill.validate({ files: ['a.ts'], checks: ['xss'] })).toBe(true);
    expect(skill.validate({ files: [] })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new SecurityScanSkill();
    expect(skill.canHandle({ files: ['a.ts'] })).toBe(true);
    expect(skill.canHandle({ files: [] })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new SecurityScanSkill({
      executor: async (input) => ({
        findings: [{ file: input.files[0], severity: 'high' as const, category: 'xss', message: 'XSS found' }],
        summary: 'Custom scan complete',
        score: 50,
      }),
    });

    const result = await skill.execute({ files: ['app.ts'] }, context);
    expect(result.success).toBe(true);
    expect(result.output!.findings).toHaveLength(1);
    expect(result.output!.score).toBe(50);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior', async () => {
    const skill = new SecurityScanSkill();
    const result = await skill.execute({ files: ['a.ts', 'b.ts'] }, context);

    expect(result.success).toBe(true);
    expect(result.output!.findings).toHaveLength(0);
    expect(result.output!.score).toBe(100);
    expect(result.output!.summary).toContain('2 file(s)');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should fail on invalid input', async () => {
    const skill = new SecurityScanSkill();
    const result = await skill.execute({ files: [] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('files array is required');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new SecurityScanSkill({
      executor: async () => { throw new Error('scan failed'); },
    });

    const result = await skill.execute({ files: ['a.ts'] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('scan failed');
  });

  it('should create via factory function', () => {
    const skill = createSecurityScanSkill();
    expect(skill).toBeInstanceOf(SecurityScanSkill);
    expect(skill.name).toBe('security-scan');
  });
});
