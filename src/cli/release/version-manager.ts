/**
 * Version Manager
 *
 * Handles semantic versioning operations: parsing, validation,
 * bumping, comparison, and tag generation for release automation.
 *
 * Feature: G-16 - Release Automation
 */

import { readFileSync } from 'fs';

const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export class VersionManager {
  constructor(private packageJsonPath: string) {}

  getCurrentVersion(): string {
    const content = readFileSync(this.packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version;
  }

  validateVersion(newVersion: string): boolean {
    return SEMVER_REGEX.test(newVersion);
  }

  bumpVersion(type: 'major' | 'minor' | 'patch' | 'prerelease'): string {
    const current = this.parseVersion(this.getCurrentVersion());

    switch (type) {
      case 'major':
        return `${current.major + 1}.0.0`;
      case 'minor':
        return `${current.major}.${current.minor + 1}.0`;
      case 'patch':
        return `${current.major}.${current.minor}.${current.patch + 1}`;
      case 'prerelease': {
        if (current.prerelease) {
          const parts = current.prerelease.split('.');
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          if (!isNaN(num)) {
            parts[parts.length - 1] = String(num + 1);
            return `${current.major}.${current.minor}.${current.patch}-${parts.join('.')}`;
          }
          return `${current.major}.${current.minor}.${current.patch}-${current.prerelease}.1`;
        }
        return `${current.major}.${current.minor}.${current.patch + 1}-beta.0`;
      }
    }
  }

  isPrerelease(version: string): boolean {
    const parsed = this.parseVersion(version);
    return parsed.prerelease !== undefined;
  }

  compareVersions(a: string, b: string): number {
    const va = this.parseVersion(a);
    const vb = this.parseVersion(b);

    if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
    if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
    if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;

    // No prerelease > prerelease (1.0.0 > 1.0.0-beta.1)
    if (!va.prerelease && vb.prerelease) return 1;
    if (va.prerelease && !vb.prerelease) return -1;
    if (!va.prerelease && !vb.prerelease) return 0;

    // Compare prerelease identifiers lexicographically
    const aParts = va.prerelease!.split('.');
    const bParts = vb.prerelease!.split('.');
    const maxLen = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLen; i++) {
      if (i >= aParts.length) return -1;
      if (i >= bParts.length) return 1;

      const aNum = parseInt(aParts[i], 10);
      const bNum = parseInt(bParts[i], 10);
      const aIsNum = !isNaN(aNum);
      const bIsNum = !isNaN(bNum);

      if (aIsNum && bIsNum) {
        if (aNum !== bNum) return aNum > bNum ? 1 : -1;
      } else if (aIsNum) {
        return -1;
      } else if (bIsNum) {
        return 1;
      } else {
        if (aParts[i] < bParts[i]) return -1;
        if (aParts[i] > bParts[i]) return 1;
      }
    }

    return 0;
  }

  getTag(version: string): string {
    return `v${version}`;
  }

  parseVersion(version: string): ParsedVersion {
    const match = version.match(SEMVER_REGEX);
    if (!match) {
      throw new Error(`Invalid semver version: ${version}`);
    }
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4] || undefined,
    };
  }
}
