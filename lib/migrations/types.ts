import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Contract for a consumer-side migration applied by AH at `session_start`
 * when the installed AH version is newer than the marker `.pi/ah-version`
 * in the consumer project.
 *
 * Invariants:
 * - **Idempotent**: must be safe to re-run on an already-migrated tree
 *   (use `existsSync`, `mkdirSync(..., { recursive: true })`, rename only
 *   if source exists and target doesn't, etc.).
 * - **No git mutations**: per the Git Safety Rule (CLAUDE.md). May touch
 *   files under `.pi/` and elsewhere in the working tree; staging and
 *   committing remain the dev's responsibility.
 * - **Non-blocking**: throwing aborts only this migration; AH keeps loading
 *   and the marker is left at the previous successful step.
 */
export interface ConsumerMigration {
  /**
   * Target version of AH that this migration brings the consumer up to.
   * Must equal `package.json#version` of the release that ships it
   * (so the registry stays in sync with semver order).
   */
  version: string;
  /** Short human-readable line, in italiano. Shown to the dev during apply. */
  description: string;
  /** Apply the migration to the consumer project rooted at `consumerRoot`. */
  apply: (consumerRoot: string, pi: ExtensionAPI) => Promise<void>;
}
