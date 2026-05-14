/**
 * Detection di come agentic-harness è installato in PI.
 *
 * Risponde a due domande indipendenti, entrambe rilevanti per il flow OTA:
 *
 *   1. **scope**: l'utente ha fatto `pi install` (global, ~/.pi/agent/settings.json)
 *      oppure `pi install -l` (project, <cwd>/.pi/settings.json)?
 *      → impatta il flag da passare a `pi update`.
 *
 *   2. **pinned**: la source spec dichiara un ref esplicito (`@v0.1.0`)?
 *      → se sì, `pi update` salterebbe il pacchetto (docs PI packages.md),
 *        quindi non vale la pena di proporre il prompt OTA.
 *
 * Letto strettamente dalle settings PI a runtime; non muta nulla.
 * Fallback safe: `{ scope: "global", pinned: false, source: null }`
 * quando non rileva nulla — il vecchio comportamento pre-detection.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type InstallScope = "global" | "local";

export interface InstallInfo {
  /** Dove è registrato il pacchetto. */
  scope: InstallScope;
  /** True se la source spec ha un `@<ref>` esplicito (git URL pinnato). */
  pinned: boolean;
  /** Source spec esatta letta dalle settings, o null se non trovata. */
  source: string | null;
}

/** Identificatore canonico del repo in qualsiasi forma di git URL. */
const REPO_FRAGMENT = "Skillbill/agentic-harness";

/**
 * Ispeziona le settings PI per stabilire scope + pinning.
 *
 * Ordine di lookup (PI: project entry wins):
 *   1. <cwd>/.pi/settings.json → scope "local"
 *   2. <homeDir>/.pi/agent/settings.json → scope "global"
 *
 * Per ciascun file, scorre `packages[]` cercando un'entry che matchi AH:
 *   - source git/https/ssh: match per `Skillbill/agentic-harness` nel path
 *   - source local path: match per absolute path == repoRoot
 */
export function detectInstallInfo(cwd: string, homeDir: string, repoRoot: string): InstallInfo {
  const resolvedRepoRoot = resolve(repoRoot);
  const candidates: { path: string; scope: InstallScope; baseForRelative: string }[] = [
    {
      path: join(cwd, ".pi", "settings.json"),
      scope: "local",
      baseForRelative: join(cwd, ".pi"),
    },
    {
      path: join(homeDir, ".pi", "agent", "settings.json"),
      scope: "global",
      baseForRelative: join(homeDir, ".pi", "agent"),
    },
  ];
  for (const { path, scope, baseForRelative } of candidates) {
    const source = findOurSource(path, resolvedRepoRoot, baseForRelative);
    if (source !== null) {
      return { scope, pinned: isPinned(source), source };
    }
  }
  return { scope: "global", pinned: false, source: null };
}

function findOurSource(settingsPath: string, resolvedRepoRoot: string, baseForRelative: string): string | null {
  if (!existsSync(settingsPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf-8")) as { packages?: unknown };
    if (!Array.isArray(parsed.packages)) return null;
    for (const entry of parsed.packages) {
      const source = extractSource(entry);
      if (!source) continue;
      if (matchesAgenticHarness(source, resolvedRepoRoot, baseForRelative)) {
        return source;
      }
    }
  } catch {
    // malformed settings → no match (silent)
  }
  return null;
}

function extractSource(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && "source" in entry) {
    const s = (entry as { source: unknown }).source;
    if (typeof s === "string") return s;
  }
  return null;
}

function matchesAgenticHarness(source: string, resolvedRepoRoot: string, baseForRelative: string): boolean {
  // git / https / ssh: match per fragment del repo path.
  // Copre: git:github.com/Skillbill/agentic-harness[@ref],
  //        git:git@github.com:Skillbill/agentic-harness[@ref],
  //        https://github.com/Skillbill/agentic-harness[@ref],
  //        ssh://git@github.com/Skillbill/agentic-harness[@ref].
  if (source.includes(REPO_FRAGMENT)) return true;
  // Local path: assoluto o relativo (rispetto alla dir del settings file
  // per docs PI: "Relative paths are resolved against the settings file
  // they appear in.").
  if (source.startsWith("/")) {
    return resolve(source) === resolvedRepoRoot;
  }
  if (source.startsWith(".")) {
    return resolve(baseForRelative, source) === resolvedRepoRoot;
  }
  return false;
}

/**
 * Una source git/https/ssh è "pinned" se ha un `@<ref>` esplicito DOPO
 * la parte host/path. Local paths e bare source senza `@` non sono mai
 * pinned.
 *
 * Pattern coperti:
 *   git:github.com/user/repo@v1               → pinned
 *   git:github.com/user/repo                  → no
 *   git:git@github.com:user/repo@v1           → pinned (skip user@host)
 *   git:git@github.com:user/repo              → no    (skip user@host)
 *   https://github.com/user/repo@v1.2.3       → pinned
 *   /abs/path/to/dir                          → no
 *   ./rel/path                                → no
 */
export function isPinned(source: string): boolean {
  // Local paths non hanno mai un @ref.
  if (source.startsWith("/") || source.startsWith(".")) return false;
  // L'`@<ref>` valido viene dopo l'ultimo separatore di path ("/" o ":")
  // — questo evita di confondere `git@github.com:...` (user@host) con un ref.
  const sepIdx = Math.max(source.lastIndexOf("/"), source.lastIndexOf(":"));
  const tail = sepIdx >= 0 ? source.slice(sepIdx + 1) : source;
  return tail.includes("@");
}
