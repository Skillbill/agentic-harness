import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Consumer-side configuration for agentic-harness (R-0005).
 *
 * AH itself is English-only (prompts, skills, docs, logs). The consumer
 * project can override the language of content AH generates *inside* the
 * consumer (TASK.md, DISCUSS.md, PLAN.md, VERIFY.md bodies, `.pi/codebase/
 * *.md` content) by committing a `.pi/ah-config.json` file at its root.
 *
 * Filenames are never localized — they stay as AH defines them (English).
 * Only the natural-language *content* honors `contentLanguage`.
 *
 * Shape (configVersion = "1"):
 *
 *   {
 *     "configVersion": "1",
 *     "contentLanguage": "en"   // or "it", "es", "fr", ... or any code
 *   }
 *
 * Behavior:
 * - File absent: defaults are used at read time. From v0.8.1, `session_start`
 *   also calls `ensureAhConfigFile` which auto-creates the file using a
 *   detected language (Italian if existing `.pi/codebase/*.md` content
 *   looks Italian — legacy v0.7.x consumers; English otherwise).
 * - JSON malformed: single console.warn, defaults are used.
 * - `configVersion` missing or != CURRENT_AH_CONFIG_VERSION: single
 *   console.warn with an upgrade hint; known keys are still honored
 *   best-effort.
 * - Unknown `contentLanguage` code: the raw string is passed through to
 *   the prompt (so users can target languages the dictionary doesn't
 *   list yet); a diagnostic console.warn surfaces the fallback.
 *
 * Never throws. AH must keep loading even if the file is broken.
 */

export interface AhConfig {
  configVersion: string;
  contentLanguage: string;
}

export const CURRENT_AH_CONFIG_VERSION = "1";

export const AH_CONFIG_DEFAULTS: AhConfig = {
  configVersion: CURRENT_AH_CONFIG_VERSION,
  contentLanguage: "en",
};

const CONFIG_REL_PATH = [".pi", "ah-config.json"] as const;

/**
 * Display-name dictionary for the LLM prompt. Keep this list short and
 * curated — unknown codes pass through unchanged.
 *
 * BCP-47 simple codes preferred; we don't enforce them.
 */
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  en: "English",
  it: "Italian",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  nl: "Dutch",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
  ru: "Russian",
};

/**
 * Map a language code to a human-readable name used in prompt injection.
 * Unknown codes return the raw code so prompts still produce something
 * targeted (the LLM is usually able to interpret an ISO code anyway).
 */
export function languageDisplayName(code: string): string {
  const normalized = code.trim().toLowerCase();
  return LANGUAGE_DISPLAY_NAMES[normalized] ?? code;
}

/**
 * Read `<consumerRoot>/.pi/ah-config.json`. Always returns a fully
 * populated AhConfig — defaults fill any missing field. Never throws.
 */
export function readAhConfig(consumerRoot: string): AhConfig {
  const p = join(consumerRoot, ...CONFIG_REL_PATH);
  if (!existsSync(p)) return { ...AH_CONFIG_DEFAULTS };

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(p, "utf-8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[agentic-harness] .pi/ah-config.json: malformed JSON (${msg}); using defaults.`,
    );
    return { ...AH_CONFIG_DEFAULTS };
  }

  if (!parsed || typeof parsed !== "object") {
    console.warn(
      `[agentic-harness] .pi/ah-config.json: expected an object; using defaults.`,
    );
    return { ...AH_CONFIG_DEFAULTS };
  }

  const obj = parsed as Record<string, unknown>;
  const result: AhConfig = { ...AH_CONFIG_DEFAULTS };

  const cv = obj.configVersion;
  if (typeof cv === "string" && cv.length > 0) {
    result.configVersion = cv;
    if (cv !== CURRENT_AH_CONFIG_VERSION) {
      console.warn(
        `[agentic-harness] .pi/ah-config.json: configVersion "${cv}" is not "${CURRENT_AH_CONFIG_VERSION}". ` +
          `Reading known keys best-effort; consider upgrading the file schema.`,
      );
    }
  } else {
    console.warn(
      `[agentic-harness] .pi/ah-config.json: configVersion missing or not a string; ` +
        `assuming "${CURRENT_AH_CONFIG_VERSION}".`,
    );
  }

  const cl = obj.contentLanguage;
  if (typeof cl === "string" && cl.length > 0) {
    result.contentLanguage = cl;
    const normalized = cl.trim().toLowerCase();
    if (!(normalized in LANGUAGE_DISPLAY_NAMES)) {
      console.warn(
        `[agentic-harness] .pi/ah-config.json: contentLanguage "${cl}" is not in AH's display-name ` +
          `dictionary. Passing it through as-is to prompts.`,
      );
    }
  }

  return result;
}

/**
 * Return the absolute path AH would read or write for the config.
 */
export function ahConfigPath(consumerRoot: string): string {
  return join(consumerRoot, ...CONFIG_REL_PATH);
}

/**
 * Atomic write of `.pi/ah-config.json`. Writes to a sibling `.tmp` and
 * renames into place to avoid leaving a half-written file if the
 * process crashes between bytes. Creates the `.pi/` directory if needed.
 * Never throws — failures log a single console.warn and return false.
 *
 * Returns `true` if the file was written, `false` on any failure.
 */
export function writeAhConfig(consumerRoot: string, config: AhConfig): boolean {
  const p = ahConfigPath(consumerRoot);
  try {
    mkdirSync(dirname(p), { recursive: true });
    const tmp = p + ".tmp";
    const body = JSON.stringify(config, null, 2) + "\n";
    writeFileSync(tmp, body, "utf-8");
    renameSync(tmp, p);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[agentic-harness] failed to write .pi/ah-config.json (${msg}); ignoring.`);
    return false;
  }
}

/**
 * Lightweight heuristic to guess the dominant natural language of the
 * existing `.pi/codebase/*.md` documents in the consumer project.
 *
 * Used at `session_start` to pick a sensible default when AH auto-creates
 * a missing `.pi/ah-config.json`: if AH detects Italian content (because
 * the consumer was already using AH at v0.7.x or earlier, when the
 * implicit default was Italian), it writes `"contentLanguage": "it"`
 * instead of `"en"` so the existing voice is preserved.
 *
 * Algorithm: scan all `.md` files under `.pi/codebase/` (excluding
 * `INDEX.md` which is too short and structurally English-skewed) for a
 * curated list of unambiguous Italian function words; if at least 3
 * **distinct** words appear, conclude Italian. Otherwise default to
 * English. Returns `null` when there is nothing to scan (folder absent,
 * empty, or only INDEX.md present) so the caller can fall back to the
 * AH default without a false-negative bias.
 *
 * Never throws.
 */
export function detectConsumerLanguage(consumerRoot: string): string | null {
  const codebaseDir = join(consumerRoot, ".pi", "codebase");
  if (!existsSync(codebaseDir)) return null;

  let entries: string[];
  try {
    entries = readdirSync(codebaseDir);
  } catch {
    return null;
  }

  const docs = entries.filter(
    (name) => name.endsWith(".md") && name !== "INDEX.md",
  );
  if (docs.length === 0) return null;

  let combined = "";
  for (const name of docs) {
    try {
      combined += readFileSync(join(codebaseDir, name), "utf-8") + "\n";
    } catch {
      // Skip unreadable file, keep going.
    }
  }
  if (combined.length === 0) return null;

  // Italian function words that are not English words. Word-boundary
  // matched, case-insensitive. The set is intentionally small and
  // unambiguous; we only need 3 distinct hits to be confident.
  const ITALIAN_MARKERS = [
    "della", "dello", "degli", "delle",
    "perché", "perchè", "anche",
    "sono", "essere", "questo", "questa", "questi", "queste",
    "quando", "ogni", "tutti", "tutte",
    "molto", "molti", "molta", "molte",
    "deve", "devono", "fare", "fatto",
  ];

  const distinctHits = new Set<string>();
  for (const word of ITALIAN_MARKERS) {
    const re = new RegExp(`\\b${word}\\b`, "i");
    if (re.test(combined)) distinctHits.add(word);
    if (distinctHits.size >= 3) return "it";
  }

  return "en";
}

/**
 * Auto-create `.pi/ah-config.json` if missing, with a content language
 * detected from the existing `.pi/codebase/*.md` content (Italian for
 * legacy v0.7.x consumers, English otherwise).
 *
 * Returns a small struct describing what happened so the caller can log
 * it. Never throws.
 *
 *   { action: "exists" }                 — file already present, untouched
 *   { action: "written", lang, source }  — AH wrote the file; `source`
 *                                          is "detected" (heuristic
 *                                          recognized italian content)
 *                                          or "default" (no signal,
 *                                          fell back to AH's default)
 *   { action: "failed" }                 — write attempt failed; AH keeps
 *                                          going with in-memory defaults
 */
export type AutoEnsureResult =
  | { action: "exists" }
  | { action: "written"; lang: string; source: "detected" | "default" }
  | { action: "failed" };

export function ensureAhConfigFile(consumerRoot: string): AutoEnsureResult {
  if (existsSync(ahConfigPath(consumerRoot))) return { action: "exists" };

  const detected = detectConsumerLanguage(consumerRoot);
  const lang = detected ?? AH_CONFIG_DEFAULTS.contentLanguage;
  const source: "detected" | "default" = detected !== null ? "detected" : "default";

  const ok = writeAhConfig(consumerRoot, {
    configVersion: CURRENT_AH_CONFIG_VERSION,
    contentLanguage: lang,
  });
  return ok ? { action: "written", lang, source } : { action: "failed" };
}
