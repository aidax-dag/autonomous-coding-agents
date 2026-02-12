# F018 -- InstinctTransfer

> Portable import/export of learned instincts between projects with confidence discounting and serialization.

## 1. Purpose

InstinctTransfer enables the transfer of learned behavioral patterns (instincts) from one project to another. When an agent has accumulated instincts in one codebase -- for example, code style preferences, testing patterns, or architectural conventions -- this module packages them into a portable bundle that can be imported into a different project. A confidence discount mechanism prevents blindly trusting imported instincts at their original confidence levels, and a minimum confidence filter allows pruning low-value instincts during import.

## 2. Interface

```typescript
// From learning module (dependency)
import type { Instinct, InstinctFilter, ImportResult } from '../../learning/interfaces/learning.interface';

interface TransferManifest {
  version: string;          // Format version (currently "1.0.0")
  sourceProject: string;
  exportedAt: string;       // ISO timestamp
  count: number;
  filter?: InstinctFilter;  // Filter applied during export
}

interface InstinctBundle {
  manifest: TransferManifest;
  instincts: Instinct[];
}

interface TransferOptions {
  confidenceDiscount?: number;   // 0-1, default 0.8
  minConfidence?: number;        // Floor filter after discount, default 0
  mergeStrategy?: 'skip' | 'overwrite' | 'merge-higher';
}

interface IInstinctTransfer {
  exportBundle(projectName: string, filter?: InstinctFilter): Promise<InstinctBundle>;
  importBundle(bundle: InstinctBundle, options?: TransferOptions): Promise<ImportResult>;
  serialize(bundle: InstinctBundle): string;
  deserialize(json: string): InstinctBundle;
}
```

## 3. Implementation

- **Class**: `InstinctTransfer` implements `IInstinctTransfer`
- **Factory**: `createInstinctTransfer(config: InstinctTransferConfig): InstinctTransfer`
- **Configuration** (`InstinctTransferConfig`):
  - `store` -- required `IInstinctStore` backing store
- **Constant**: `TRANSFER_VERSION = '1.0.0'`

**Key behaviors:**

- `exportBundle()` delegates to `store.export(filter)`, wraps results in a `TransferManifest` with version, project name, timestamp, and count.
- `importBundle()` applies confidence discount (default 0.8) by multiplying each instinct's confidence, then filters out instincts below `minConfidence`. The filtered and adjusted instincts are passed to `store.import()`. Filtering happens *after* the discount is applied.
- `serialize()` produces pretty-printed JSON (`JSON.stringify` with 2-space indent).
- `deserialize()` parses JSON and validates that `manifest` exists and `instincts` is an array, throwing `'Invalid instinct bundle format'` on malformed input.

## 4. Dependencies

**Depends on:**

- `IInstinctStore` from `core/learning/interfaces/learning.interface` -- the backing store for export/import operations.
- `Instinct`, `InstinctFilter`, `ImportResult` types from the learning module.

**Depended on by:**

- CLI or orchestration layer that manages cross-project knowledge transfer.
- Could be used by session persistence to bundle instincts for archival.

## 5. Testing

- **Test file**: `tests/unit/core/instinct-transfer/instinct-transfer.test.ts`
- **Test count**: 10 tests
- **Key test scenarios**:
  - Export produces bundle with correct manifest (version, project name, count)
  - Export passes filter to underlying store
  - Import applies confidence discount (e.g., 1.0 * 0.5 = 0.5)
  - Import filters by minConfidence *after* discount (e.g., 0.3 * 0.8 = 0.24, filtered below 0.5)
  - Default confidence discount of 0.8 is applied when no options given
  - Serialize/deserialize round-trip preserves bundle data
  - Deserialize throws on invalid format (missing manifest or non-array instincts)
  - Serialize produces pretty-printed (multi-line) JSON
  - Factory function `createInstinctTransfer` creates valid instance
