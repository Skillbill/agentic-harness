import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
 * - File absent: defaults are used, no warning (this is the common case).
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
