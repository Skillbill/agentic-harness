import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MIGRATIONS } from "./migrations/index.js";
import type { ConsumerMigration } from "./migrations/types.js";

/**
 * Consumer migration runner (R-0003).
 *
 * On every `session_start`, AH compares its installed version (from its own
 * `package.json`) with the marker file `<consumerRoot>/.pi/ah-version`. If
 * the marker is missing or older, every migration with `marker < target <=
 * installed` is applied in semver order. The marker is checkpointed after
 * each successful step, so a partial failure can be resumed on next start.
 *
 * Failure is non-blocking: an error is logged, the marker is left at the
 * last successful step, and AH keeps loading. The dev fixes the issue and
 * restarts.
 */

const markerPath = (consumerRoot: string) => join(consumerRoot, ".pi", "ah-version");

/** Read AH's own version from the package.json shipped alongside this file. */
export function readInstalledVersion(): string {
  // lib/migrate-consumer.ts -> lib/ -> package.json sibling of lib/.
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "package.json");
  const raw = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
  if (typeof raw.version !== "string" || raw.version.length === 0) {
    throw new Error(`agentic-harness: package.json#version missing or invalid at ${pkgPath}`);
  }
  return raw.version;
}

/**
 * Read the consumer marker. Accepts plain text (`0.7.0\n`) or JSON
 * (`{ "version": "0.7.0" }`). Returns `null` if absent or unparseable.
 */
export function readMarker(consumerRoot: string): string | null {
  const p = markerPath(consumerRoot);
  if (!existsSync(p)) return null;
  const body = readFileSync(p, "utf-8").trim();
  if (!body) return null;
  if (body.startsWith("{")) {
    try {
      const v = (JSON.parse(body) as { version?: string }).version;
      return typeof v === "string" && v.length > 0 ? v : null;
    } catch {
      return null;
    }
  }
  return body;
}

function writeMarker(consumerRoot: string, version: string): void {
  const p = markerPath(consumerRoot);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, version + "\n", "utf-8");
}

/**
 * Strict semver compare for plain `X.Y.Z`. Returns negative if a < b,
 * positive if a > b, zero if equal. No prerelease/build support — AH
 * tags don't use them.
 */
export function cmpSemver(a: string, b: string): number {
  const pa = a.split(".").map((s) => Number(s) || 0);
  const pb = b.split(".").map((s) => Number(s) || 0);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

/**
 * Pick the migrations to apply: `marker < target <= installed`. When the
 * marker is `null` (first install) we still cap at `installed` so a stale
 * registry can't run anything beyond what's actually shipped.
 */
export function selectPending(
  installed: string,
  marker: string | null,
  all: readonly ConsumerMigration[],
): ConsumerMigration[] {
  return [...all]
    .sort((a, b) => cmpSemver(a.version, b.version))
    .filter((m) => {
      if (cmpSemver(m.version, installed) > 0) return false;
      if (marker === null) return true;
      return cmpSemver(m.version, marker) > 0;
    });
}

export async function migrateConsumer(pi: ExtensionAPI, consumerRoot: string): Promise<void> {
  const installed = readInstalledVersion();
  const marker = readMarker(consumerRoot);

  // Up-to-date: marker present and >= installed. Nothing to do.
  if (marker !== null && cmpSemver(marker, installed) >= 0) return;

  const pending = selectPending(installed, marker, MIGRATIONS);

  // No migrations to run, but the marker is stale (or absent). Advance it
  // so subsequent starts skip this branch entirely. This is the common
  // case at v0.6.0 baseline.
  if (pending.length === 0) {
    if (marker !== installed) writeMarker(consumerRoot, installed);
    return;
  }

  const from = marker ?? "(first install)";
  console.log(`[agentic-harness] Migrating consumer project: ${from} → ${installed}`);

  let lastApplied: string | null = marker;
  for (const m of pending) {
    console.log(`[agentic-harness]   • ${m.version}: ${m.description}`);
    try {
      await m.apply(consumerRoot, pi);
      lastApplied = m.version;
      writeMarker(consumerRoot, lastApplied);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[agentic-harness]   ✗ migration ${m.version} failed: ${msg}`);
      console.error(
        `[agentic-harness]   marker NOT advanced past ${lastApplied ?? "(none)"} — fix and retry`,
      );
      return; // non-blocking: AH keeps loading
    }
  }
}
