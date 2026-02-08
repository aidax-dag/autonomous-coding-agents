# Legacy Agents

> **Status**: Deprecated - Migration to `core/agents` in progress
> **Migration Start**: 2026-02-08
> **Removal Target**: 2026-08-08 (6 months)

## Overview

This directory contains legacy agent implementations that are being migrated to the new unified agent architecture in `src/core/agents/`.

## Migration Status

| Legacy Module | New Location | Status |
|--------------|--------------|--------|
| `base/` | `../base-agent.ts` | ✅ Migrated |
| `coder/` | `../specialized/coder-agent.ts` | ✅ Migrated |
| `reviewer/` | `../specialized/reviewer-agent.ts` | ✅ Migrated |
| `manager/` | `../teams/planning-agent.ts` | ✅ Migrated |
| `repo-manager/` | TBD | ⏳ Pending |

## Migration Guide

### For Consumers

Replace legacy imports:

```typescript
// OLD (deprecated)
import { CoderAgent } from '@/agents/coder';
import { ReviewerAgent } from '@/agents/reviewer';

// NEW (recommended)
import { CoderAgent } from '@/core/agents/specialized';
import { ReviewerAgent } from '@/core/agents/specialized';
```

### For Contributors

1. Do NOT add new features to legacy agents
2. Bug fixes should be applied to both locations temporarily
3. New agents should be created in `core/agents/specialized/` or `core/agents/teams/`

## Deprecation Timeline

| Date | Milestone |
|------|-----------|
| 2026-02-08 | Deprecation notice added |
| 2026-05-08 | Console warnings enabled in dev mode |
| 2026-08-08 | Legacy directory removed |

## Re-export Compatibility

The root `src/agents/index.ts` now re-exports from `core/agents` for backward compatibility.
This re-export layer will be removed along with this directory.

---

```yaml
document_info:
  created: 2026-02-08
  last_updated: 2026-02-08
```
