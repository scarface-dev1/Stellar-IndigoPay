# Storage Versioning & Automated Migration Framework (Closes #379)

## Summary

Implements a storage versioning system with automated post-upgrade migrations for the IndigoPay contract. This establishes a safe, auditable pattern for evolving the contract's storage schema without risking data corruption on upgrade.

## Problem

When the contract's storage layout changes (new DataKey variants, struct field additions/removals, value encoding changes), existing on-chain data must be migrated to the new schema. Without a versioning system:

1. The contract has no way to know which migrations have already been applied
2. Migration logic can be applied multiple times (data corruption)
3. Missing migration steps are silently skipped (incomplete schema)
4. There's no safety net to catch deployer mistakes

## Solution

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   CONTRACT UPGRADE                       │
│                                                         │
│  execute_upgrade()                                      │
│    │                                                    │
│    ├─ 1. Verify timelock elapsed                        │
│    ├─ 2. Swap WASM via update_current_contract_wasm()   │
│    ├─ 3. migrate() ◄── NEW                              │
│    │     │                                              │
│    │     ├─ Read current version (default: 1)           │
│    │     ├─ if < 2: migrate_v1_to_v2() [empty example]  │
│    │     ├─ if < 3: migrate_v2_to_v3() [future]          │
│    │     └─ Assert final == CURRENT_STORAGE_VERSION     │
│    │                                                    │
│    ├─ 4. Record LastExecutedUpgrade                     │
│    └─ 5. Emit upg_exec event                            │
└─────────────────────────────────────────────────────────┘
```

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| Symbol key for version tracking | Avoids adding a DataKey variant, which would increase XDR codegen and push the slim WASM over the 64KB limit |
| `#[cfg(feature = "upgrade")]` gates | Slim WASM builds (--no-default-features) exclude all migration code; only the Symbol constant adds negligible overhead |
| `CURRENT_STORAGE_VERSION = 2` | v1 = original schema (no version tracking); v2 = Symbol-keyed version added. New deploys start at 2, skip the empty v1→v2 migration |
| `unwrap_or(1)` on version reads | Pre-versioning contracts return v1, triggering the v1→v2 migration on first upgrade |
| Final assertion in `migrate()` | Panics if `CURRENT_STORAGE_VERSION` was bumped but the corresponding migration step wasn't added — catches deployer mistakes at upgrade time |
| Empty `migrate_v1_to_v2()` | Establishes the pattern; replaced with real transformations when the first schema change is introduced |

### Idempotency

Migrations are idempotent by design:
- After `migrate_v1_to_v2()` runs, `StorageVersion` is set to `2`
- On subsequent `migrate()` calls, `current >= 2`, so the step is skipped
- The final assertion verifies `StorageVersion == CURRENT_STORAGE_VERSION`

## Changes

### Files modified

| File | Lines | Description |
|------|-------|-------------|
| `contracts/indigopay-contract/src/lib.rs` | +146 | Core versioning framework, migration logic, tests |
| `contracts/indigopay-contract/UPGRADE.md` | +50 | Documentation for storage versioning and migration workflow |

### Code changes in detail

**1. Version constant** (`lib.rs`, near other constants)
```rust
const CURRENT_STORAGE_VERSION: u32 = 2;
#[cfg(feature = "upgrade")]
const STORAGE_VERSION_KEY: Symbol = symbol_short!("sv");
```

**2. `migrate()` function** (standalone, `#[cfg(feature = "upgrade")]`)
- Reads current version from `STORAGE_VERSION_KEY` (defaults to 1)
- Applies pending migrations sequentially
- Asserts final version equals `CURRENT_STORAGE_VERSION`

**3. `migrate_v1_to_v2()` example** (standalone, `#[cfg(feature = "upgrade")]`)
- Empty — v1 data is v2-compatible
- Includes commented example pattern for real migrations

**4. Updated `initialize()`** (`#[cfg(feature = "upgrade")]`)
- Sets `STORAGE_VERSION_KEY = CURRENT_STORAGE_VERSION` after other init keys
- New deploys skip all historical migrations

**5. Updated `execute_upgrade()`** 
- Calls `migrate(&env)` after WASM swap, before recording upgrade complete

**6. `get_storage_version()` getter** (`#[cfg(feature = "upgrade")]`)
- Public read-only access to current schema version
- Returns 1 for pre-versioning contracts

**7. Three new tests** (all `#[cfg(feature = "upgrade")]`)
- `test_storage_version_initialized` — verifies version is set on init
- `test_migration_runs_on_upgrade` — verifies migrate() runs without error on same-code upgrade
- `test_migration_idempotent` — verifies migrate() can be called twice safely

## Adding a future migration

1. Bump `CURRENT_STORAGE_VERSION` to 3
2. Write `migrate_v2_to_v3(env: &Env)` with actual data transformations
3. Add `if current < 3 { migrate_v2_to_v3(env); set_storage_version(3); }` in `migrate()`
4. If the migration changes struct layouts, add tests that verify old data survives the migration
5. Update UPGRADE.md with the new storage keys and migration notes

## CI Verification

All checks pass locally:

```
✅ cargo fmt --all -- --check
✅ cargo clippy --workspace -- -D warnings
✅ cargo test --features testutils -p indigopay-contract (storage version tests: 3 passed)
✅ WASM slim build: 65,459 bytes (under 64KB limit)
```

## Backward Compatibility

- Existing contracts without `STORAGE_VERSION_KEY` return version 1 via `unwrap_or(1)`
- All existing storage keys and struct layouts are unchanged
- `test_upgrade_preserves_donation_state_and_storage_keys` continues to pass (existing upgrade simulation unaffected)
- New contracts start at version 2, skipping the empty v1→v2 migration
