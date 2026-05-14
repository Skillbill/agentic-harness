/**
 * OTA update per agentic-harness.
 *
 * Flow (chiamato da `session_start` con reason === "startup"):
 *   1. Legge versione corrente da package.json (lib/version.ts).
 *   2. Cache TTL su ~/.pi/agent/.cache/agentic-harness-ota.json (default 6h).
 *      Se la cache è fresca, riusa l'ultima latestSeen senza chiamare GitHub.
 *   3. Fetch GET https://api.github.com/repos/<owner>/<repo>/releases/latest.
 *      Timeout 5s, User-Agent identificativo, niente token (anonimo).
 *   4. Confronto semver naive (split su "."): se latest > current,
 *      propone ctx.ui.confirm(...).
 *   5. Se l'utente accetta: execFile("pi", ["update", "--extension", spec])
 *      con timeout 60s. Su successo: ctx.ui.notify(success) + ctx.reload().
 *   6. Su qualsiasi errore (rete, 404, timeout, exec): notify error o
 *      silenzio totale (vedi nota in catch). Mai bloccare lo startup.
 *
 * **Best-effort**: nessun errore di questo modulo deve mai propagarsi
 * fuori da `maybeProposeUpdate`. Il chiamante usa `void ...catch(noop)`.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const execFileP = promisify(execFile);

/** Identità del repository GitHub usata per il check OTA. */
export const GITHUB_OWNER = "Skillbill";
export const GITHUB_REPO = "agentic-harness";

/** Pi-source spec passata a `pi update --extension <spec>`. */
export const PI_PACKAGE_SPEC = `git:github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const FETCH_TIMEOUT_MS = 5_000;
const PI_UPDATE_TIMEOUT_MS = 60_000;

const CACHE_PATH = join(homedir(), ".pi", "agent", ".cache", "agentic-harness-ota.json");

interface OtaCache {
  lastCheck: number;     // epoch ms
  latestSeen: string;    // version string sans leading "v", or "" if none
}

/**
 * Confronto semver naive: split su ".", parsing numerico, lessicografico
 * sui pre-release tag (se presenti). Sufficiente per release "X.Y.Z" e
 * "X.Y.Z-alpha.N". Non gestisce edge case di semver 2.0 completo.
 */
export function isNewer(latest: string, current: string): boolean {
  const norm = (v: string) => v.replace(/^v/, "");
  const [latestCore, latestPre = ""] = norm(latest).split("-", 2);
  const [currentCore, currentPre = ""] = norm(current).split("-", 2);

  const la = latestCore!.split(".").map((n) => parseInt(n, 10) || 0);
  const ca = currentCore!.split(".").map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(la.length, ca.length); i++) {
    const a = la[i] ?? 0;
    const b = ca[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  // Core uguale: presenza di pre-release significa "minore di"
  // (es. 1.0.0-alpha < 1.0.0). Tra due pre-release: confronto lessicografico.
  if (latestPre === "" && currentPre !== "") return true;
  if (latestPre !== "" && currentPre === "") return false;
  return latestPre > currentPre;
}

/** Legge la cache. Ritorna null se assente, corrotta o stantia. */
function readCache(now: number): OtaCache | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    const raw = readFileSync(CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<OtaCache>;
    if (typeof parsed.lastCheck !== "number") return null;
    if (typeof parsed.latestSeen !== "string") return null;
    if (now - parsed.lastCheck > CACHE_TTL_MS) return null;
    return { lastCheck: parsed.lastCheck, latestSeen: parsed.latestSeen };
  } catch {
    return null;
  }
}

function writeCache(cache: OtaCache): void {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // silenzioso: la cache è ottimizzazione, non requisito
  }
}

/**
 * Interroga GitHub Releases API. Ritorna la versione (senza "v" iniziale)
 * o null su qualsiasi errore (offline, 404 = nessuna release, rate limit, etc.).
 */
async function fetchLatestRelease(currentVersion: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": `agentic-harness-ota/${currentVersion}`,
      },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { tag_name?: string };
    if (typeof body.tag_name !== "string" || body.tag_name.length === 0) return null;
    return body.tag_name.replace(/^v/, "");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface PiUpdateResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

async function runPiUpdate(): Promise<PiUpdateResult> {
  try {
    const { stdout, stderr } = await execFileP("pi", ["update", "--extension", PI_PACKAGE_SPEC], {
      timeout: PI_UPDATE_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { ok: true, stdout, stderr };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "unknown error",
    };
  }
}

/**
 * Subset minimo del context che ci serve. Evita l'import di `ExtensionContext`
 * dal pacchetto PI (che varia di shape tra versioni) e tiene questo modulo
 * indipendente dal type system di PI.
 */
export interface OtaCtx {
  ui: {
    confirm(title: string, message: string): Promise<boolean>;
    notify(message: string, level?: "info" | "success" | "warning" | "error"): void;
  };
  reload(): Promise<void>;
}

/**
 * Punto d'ingresso. Mai lanciare: chi chiama usa `void ...catch(noop)`.
 */
export async function maybeProposeUpdate(ctx: OtaCtx, currentVersion: string): Promise<void> {
  const now = Date.now();
  let latest: string | null = null;

  const cache = readCache(now);
  if (cache) {
    latest = cache.latestSeen;
  } else {
    latest = await fetchLatestRelease(currentVersion);
    writeCache({ lastCheck: now, latestSeen: latest ?? "" });
  }

  if (!latest) return;
  if (!isNewer(latest, currentVersion)) return;

  const ok = await ctx.ui.confirm(
    `AH ${currentVersion} → ${latest}`,
    `Nuova versione di agentic-harness disponibile. Aggiornare ora? (richiede reload dell'ambiente)`,
  );
  if (!ok) return;

  ctx.ui.notify("Aggiornamento agentic-harness in corso…", "info");
  const result = await runPiUpdate();
  if (!result.ok) {
    const detail = (result.stderr || result.stdout || "").slice(0, 200).trim();
    ctx.ui.notify(`Aggiornamento fallito: ${detail}`, "error");
    return;
  }

  ctx.ui.notify(`Aggiornato a ${latest}. Reloading…`, "success");
  await ctx.reload();
  // ctx.reload() è terminal: nessun codice dopo. Vedi docs PI extensions.md.
}
