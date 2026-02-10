/**
 * Skill Registry
 *
 * Manages registration, discovery, and lookup of skills.
 *
 * @module core/skills
 */

import type {
  ISkill,
  ISkillRegistry,
  SkillContext,
  SkillInfo,
} from './interfaces/skill.interface';

/**
 * SkillRegistry options
 */
export interface SkillRegistryOptions {
  /** Allow overwriting existing skills on register */
  allowOverwrite?: boolean;
}

/**
 * In-memory skill registry implementation
 */
export class SkillRegistry implements ISkillRegistry {
  private readonly skills = new Map<string, ISkill>();
  private readonly allowOverwrite: boolean;

  constructor(options: SkillRegistryOptions = {}) {
    this.allowOverwrite = options.allowOverwrite ?? false;
  }

  register(skill: ISkill): void {
    if (!skill.name) {
      throw new Error('Skill must have a name');
    }
    if (this.skills.has(skill.name) && !this.allowOverwrite) {
      throw new Error(`Skill '${skill.name}' is already registered`);
    }
    this.skills.set(skill.name, skill);
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  get(name: string): ISkill | undefined {
    return this.skills.get(name);
  }

  findByTag(tag: string): ISkill[] {
    const results: ISkill[] = [];
    for (const skill of this.skills.values()) {
      if (skill.tags.includes(tag)) {
        results.push(skill);
      }
    }
    return results;
  }

  findByCapability(input: unknown, context: SkillContext): ISkill[] {
    const results: ISkill[] = [];
    for (const skill of this.skills.values()) {
      if (skill.canHandle?.(input, context)) {
        results.push(skill);
      }
    }
    return results;
  }

  list(): SkillInfo[] {
    const infos: SkillInfo[] = [];
    for (const skill of this.skills.values()) {
      infos.push({
        name: skill.name,
        description: skill.description,
        tags: skill.tags,
        version: skill.version,
      });
    }
    return infos;
  }

  count(): number {
    return this.skills.size;
  }

  clear(): void {
    this.skills.clear();
  }
}

/**
 * Factory function for creating a SkillRegistry
 */
export function createSkillRegistry(
  options?: SkillRegistryOptions,
): SkillRegistry {
  return new SkillRegistry(options);
}
