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
    if (marker !== installed) {
      writeMarker(consumerRoot, installed);
      await autoCommitMarkerBump(pi, consumerRoot, installed);
    }
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

  // After the loop ends (all migrations applied successfully), try the
  // marker-only auto-commit. When a migration touched real consumer files
  // (e.g. v0.10.0 added `priority:` to every TASK.md), the working tree
  // won't be "marker only" and the auto-commit silently skips — exactly
  // what we want: the dev reviews and commits.
  await autoCommitMarkerBump(pi, consumerRoot, installed);
}

/**
 * Sanctioned exception to the Git Safety Rule (R-0013). Auto-commit
 * `.pi/ah-version` **only** when the change is trivially mechanical: the
 * consumer is on `main` / `master` and the marker is the **only** thing
 * the working tree shows as dirty. Any other working-tree state — feature
 * branch, other files modified by a real migration, other dev work in
 * progress — leaves the modification for the dev to handle.
 *
 * Never throws. Every git failure is downgraded to a console warning so a
 * dirty exec environment can't block session start.
 */
async function autoCommitMarkerBump(
  pi: ExtensionAPI,
  consumerRoot: string,
  installed: string,
): Promise<void> {
  // 1. We must be inside a git working tree.
  try {
    const r = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: consumerRoot,
    });
    if (r.code !== 0 || r.stdout.trim() !== "true") return;
  } catch {
    return;
  }

  // 2. Branch must be the project's default (best-effort detection — we
  //    don't run `git symbolic-ref refs/remotes/origin/HEAD` because that
  //    requires a remote and adds latency for what's essentially a paper
  //    cut. Accept the two near-universal defaults.)
  let branch: string;
  try {
    const r = await pi.exec("git", ["branch", "--show-current"], {
      cwd: consumerRoot,
    });
    if (r.code !== 0) return;
    branch = r.stdout.trim();
  } catch {
    return;
  }
  if (branch !== "main" && branch !== "master") return;

  // 3. Working tree must contain exactly one entry, and that entry must
  //    be `.pi/ah-version`. Anything else (multiple files, a different
  //    path) means a real migration touched the tree or the dev has
  //    work in progress — leave it for review.
  let porcelain: string;
  try {
    const r = await pi.exec("git", ["status", "--porcelain"], {
      cwd: consumerRoot,
    });
    if (r.code !== 0) return;
    porcelain = r.stdout;
  } catch {
    return;
  }
  const lines = porcelain.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length !== 1) return;
  // Porcelain v1 line shape: "XY <path>" — X = staged flag, Y = unstaged
  // flag. The path starts at column 3.
  const path = lines[0]!.slice(3).trim();
  if (path !== ".pi/ah-version") return;

  // 4. Stage and commit. No push — that's still the dev's call.
  try {
    const add = await pi.exec("git", ["add", ".pi/ah-version"], {
      cwd: consumerRoot,
    });
    if (add.code !== 0) {
      console.warn(
        `[agentic-harness] auto-commit of .pi/ah-version: git add failed (${(add.stderr || add.stdout).trim() || "exit " + add.code})`,
      );
      return;
    }
    const commit = await pi.exec(
      "git",
      ["commit", "-m", `chore: bump AH consumer marker to v${installed}`],
      { cwd: consumerRoot },
    );
    if (commit.code !== 0) {
      console.warn(
        `[agentic-harness] auto-commit of .pi/ah-version: git commit failed (${(commit.stderr || commit.stdout).trim() || "exit " + commit.code})`,
      );
      return;
    }
    console.log(
      `[agentic-harness] 📝 Auto-committed .pi/ah-version bump to v${installed} on ${branch} (working tree was clean otherwise).`,
    );
  } catch (err) {
    console.warn(
      `[agentic-harness] auto-commit of .pi/ah-version threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
