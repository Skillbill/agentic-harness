import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { VERSION as PI_VERSION } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmpSemver } from "./migrate-consumer.js";

/**
 * AH ↔ PI peer-version compatibility check (R-0004).
 *
 * Runs at `session_start` (before `migrateConsumer`). Reads the range that
 * AH declares in its own `package.json#peerDependencies["@earendil-works/
 * pi-coding-agent"]` and compares it against the `VERSION` constant
 * exported by the loaded PI runtime. On mismatch, emits a triple warning
 * (console.warn + ctx.ui.notify + persistent `pi.sendMessage`) so the
 * problem surfaces immediately instead of crashing mid-turn later.
 *
 * Invariants:
 * - Never throws. All filesystem / parse errors are caught and downgraded
 *   to a single diagnostic `console.warn`.
 * - Never blocks. AH keeps loading commands/tools/hooks regardless; the
 *   check is purely diagnostic. See R-0004 in REQUIREMENTS.md.
 * - Unrecognized range shapes (anything more exotic than `X.Y.Z`,
 *   `^X.Y.Z`, `~X.Y.Z`, `>=X.Y.Z`) skip the comparison and emit a single
 *   `console.warn` so a future range string doesn't silently bypass the
 *   check.
 */

const PI_PEER_NAME = "@earendil-works/pi-coding-agent";

/** Read AH's declared peer range for PI. Returns null if the field is
 *  absent or empty — caller treats that as "no constraint declared". */
export function readPiPeerRange(): string | null {
  // lib/check-pi-compat.ts -> lib/ -> package.json sibling of lib/.
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "package.json");
  const raw = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    peerDependencies?: Record<string, string>;
  };
  const range = raw.peerDependencies?.[PI_PEER_NAME];
  return typeof range === "string" && range.length > 0 ? range : null;
}

/** Read the loaded PI runtime version (re-exported here for testability). */
export function readPiInstalledVersion(): string {
  return PI_VERSION;
}

/**
 * Minimal semver-range matcher. Supports the four shapes AH actually
 * uses in its own peerDependencies history: exact (`X.Y.Z`), caret
 * (`^X.Y.Z`), tilde (`~X.Y.Z`), and `>=X.Y.Z`.
 *
 * Returns `true`/`false` on a known shape, `null` when the range is in
 * a form we don't recognize. The caller treats `null` as "skip the
 * comparison" — we never want to lie about compatibility.
 *
 * Caret semantics follow npm's pre-1.0 rule: `^0.75.0` means
 * `>=0.75.0 <0.76.0` (when major is 0, the minor is treated as the
 * stability anchor instead of major).
 */
export function satisfies(version: string, range: string): boolean | null {
  const v = version.trim();
  const r = range.trim();
  if (!/^\d+\.\d+\.\d+$/.test(v)) return null;

  // Exact match: "X.Y.Z"
  if (/^\d+\.\d+\.\d+$/.test(r)) {
    return cmpSemver(v, r) === 0;
  }

  // ">=X.Y.Z"
  const gteMatch = r.match(/^>=\s*(\d+\.\d+\.\d+)$/);
  if (gteMatch) {
    return cmpSemver(v, gteMatch[1]!) >= 0;
  }

  // "^X.Y.Z" — pre-1.0 anchors on minor.
  const caretMatch = r.match(/^\^\s*(\d+)\.(\d+)\.(\d+)$/);
  if (caretMatch) {
    const major = Number(caretMatch[1]);
    const minor = Number(caretMatch[2]);
    const lower = `${major}.${minor}.${caretMatch[3]}`;
    const upper =
      major === 0
        ? `${major}.${minor + 1}.0`
        : `${major + 1}.0.0`;
    return cmpSemver(v, lower) >= 0 && cmpSemver(v, upper) < 0;
  }

  // "~X.Y.Z" — patch-level changes only.
  const tildeMatch = r.match(/^~\s*(\d+)\.(\d+)\.(\d+)$/);
  if (tildeMatch) {
    const major = Number(tildeMatch[1]);
    const minor = Number(tildeMatch[2]);
    const lower = `${major}.${minor}.${tildeMatch[3]}`;
    const upper = `${major}.${minor + 1}.0`;
    return cmpSemver(v, lower) >= 0 && cmpSemver(v, upper) < 0;
  }

  return null;
}

/**
 * Entry point. Run from inside the `session_start` handler. Never
 * throws — the outer handler still catches as belt-and-suspenders, but
 * this function self-isolates.
 */
export async function checkPiCompat(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  let range: string | null;
  try {
    range = readPiPeerRange();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[agentic-harness] check-pi-compat: cannot read peer range (${msg}); skipping.`);
    return;
  }

  if (range === null) {
    // No declared constraint — nothing to check.
    return;
  }

  const piVersion = readPiInstalledVersion();
  const ok = satisfies(piVersion, range);

  if (ok === true) {
    // Compat satisfied. Stay quiet to avoid noise on every session_start.
    return;
  }

  if (ok === null) {
    console.warn(
      `[agentic-harness] check-pi-compat: peer range "${range}" not in a recognized shape ` +
      `(supported: X.Y.Z, ^X.Y.Z, ~X.Y.Z, >=X.Y.Z) — skipping comparison against PI ${piVersion}.`,
    );
    return;
  }

  // ok === false: real mismatch.
  const summary =
    `agentic-harness: the running PI version (${piVersion}) does NOT satisfy the range ` +
    `declared in peerDependencies ("${range}"). AH will keep loading but some commands may ` +
    `call APIs that don't exist yet. Either update PI (\`pi update @earendil-works/pi-coding-agent\`) ` +
    `or install a version of AH compatible with the current PI runtime.`;

  // 1. Console — always.
  console.warn(`[agentic-harness] PI version mismatch: ${summary}`);

  // 2. TUI toast — only when a UI exists (in print/RPC mode `hasUI` is false).
  try {
    if (ctx.hasUI) {
      ctx.ui.notify(summary, "warning");
    }
  } catch (err) {
    console.warn(
      `[agentic-harness] check-pi-compat: ctx.ui.notify failed (${err instanceof Error ? err.message : String(err)}).`,
    );
  }

  // 3. Persistent in-session message — visible in the scrollback for the
  //    lifetime of the session. `display: true` makes it user-visible;
  //    triggerTurn is omitted (default false) so it doesn't burn an LLM turn.
  try {
    pi.sendMessage({
      customType: "ah-pi-compat-warning",
      content: summary,
      display: true,
    });
  } catch (err) {
    console.warn(
      `[agentic-harness] check-pi-compat: pi.sendMessage failed (${err instanceof Error ? err.message : String(err)}).`,
    );
  }
}
