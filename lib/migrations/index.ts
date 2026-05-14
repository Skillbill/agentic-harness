import type { ConsumerMigration } from "./types.js";
import { migration as v0_8_0 } from "./v0_8_0.js";
import { migration as v0_9_0 } from "./v0_9_0.js";

/**
 * Registry of consumer migrations, ordered by semver ascending.
 *
 * To add a migration:
 *
 *   1. Create `lib/migrations/v<MAJOR>_<MINOR>_<PATCH>.ts` exporting:
 *        export const migration: ConsumerMigration = { version, description, apply };
 *   2. Add `import { migration as v<...> } from "./v<...>.js";` above
 *      and insert it in the array below in correct semver order.
 *   3. Document the behavior in `CHANGELOG.md` under that version's
 *      `Migration` section (the doc-side counterpart of the code change).
 *
 * The runner in `../migrate-consumer.ts` re-sorts defensively, but keep
 * the source order semver-ascending for readability.
 */
export const MIGRATIONS: readonly ConsumerMigration[] = [
  v0_8_0,
  v0_9_0,
];
