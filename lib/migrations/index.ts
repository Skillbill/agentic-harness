import type { ConsumerMigration } from "./types.js";

/**
 * Registry of consumer migrations, ordered by semver ascending.
 *
 * Empty as of v0.6.0 (baseline). To add a migration:
 *
 *   1. Create `lib/migrations/v<MAJOR>_<MINOR>_<PATCH>.ts` exporting:
 *        export const migration: ConsumerMigration = { version, description, apply };
 *   2. Add `import { migration as v<...> } from "./v<...>.js";` below
 *      and insert it in the array in correct semver order.
 *   3. Document the behavior in `CHANGELOG.md` under that version's
 *      `Migration` section (the doc-side counterpart of the code change).
 *
 * The runner in `../migrate-consumer.ts` re-sorts defensively, but keep
 * the source order semver-ascending for readability.
 */
export const MIGRATIONS: readonly ConsumerMigration[] = [
  // (none — v0.6.0 is the baseline; first entry will land in v0.7.0)
];
