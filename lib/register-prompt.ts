import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { type AhConfig, AH_CONFIG_DEFAULTS, languageDisplayName } from "./ah-config.js";

interface PromptFrontmatter {
  description?: string;
  argumentHint?: string;
}

function parseFrontmatter(raw: string): { meta: PromptFrontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta: PromptFrontmatter = {};
  for (const line of match[1]!.split("\n")) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (key!.trim() === "description") meta.description = value;
    if (key!.trim() === "argument-hint") meta.argumentHint = value.replace(/^["']|["']$/g, "");
  }
  return { meta, body: match[2]! };
}

/**
 * Header prepended to every prompt body that references `$EXT_DIR`. Tells the
 * agent that AH-internal paths arrive pre-resolved as absolute paths and must
 * be read directly — no `find` / `locate` / `grep -r` to "discover" them.
 *
 * Why: substituted paths point outside the consumer's `cwd` (they live inside
 * AH's installation directory), and some models default to filesystem-wide
 * searches when they don't trust an out-of-cwd path. That search can scan the
 * entire disk and stall the session for minutes.
 */
const EXT_DIR_DIRECTIVE =
  "> **Note — AH-internal file paths.** Any path in this prompt that points " +
  "inside AH's own installation (templates, prompts, skills, procedures) is " +
  "already fully resolved to an absolute path. Read it directly with your " +
  "file-reading tool at the exact path given. Do **not** run `find`, " +
  "`locate`, `grep -r`, or any filesystem-wide search to locate AH files — " +
  "the path you see is authoritative.\n\n";

/**
 * Register a `.md` prompt as an extension command.
 *
 * Substitutions performed inside the prompt body on every invocation:
 *  - `$EXT_DIR`           → AH's own repo root (where `prompts/`, `skills/`, … live)
 *  - `$@`                 → raw argument string
 *  - `$1`                 → first whitespace-separated argument
 *  - `$CONTENT_LANG`      → human-readable language name (e.g. "English", "Italian")
 *  - `$CONTENT_LANG_CODE` → raw language code from config (e.g. "en", "it")
 *
 * `getConfig` is resolved per-invocation so a mid-session edit to
 * `.pi/ah-config.json` is picked up on the next `/ah:*` call. When omitted,
 * the built-in defaults (English) are used.
 */
export function registerPrompt(
  pi: ExtensionAPI,
  name: string,
  mdPath: string,
  extDir: string,
  getConfig?: () => AhConfig,
) {
  const raw = readFileSync(mdPath, "utf-8");
  const { meta, body } = parseFrontmatter(raw);
  const hasExtDirRef = body.includes("$EXT_DIR");

  pi.registerCommand(name, {
    description: meta.description ?? name,
    handler: async (args) => {
      const config = getConfig ? getConfig() : { ...AH_CONFIG_DEFAULTS };
      const langName = languageDisplayName(config.contentLanguage);

      let prompt = body.replaceAll("$EXT_DIR", extDir);
      prompt = prompt.replaceAll("$CONTENT_LANG_CODE", config.contentLanguage);
      prompt = prompt.replaceAll("$CONTENT_LANG", langName);
      if (args) {
        prompt = prompt.replaceAll("$@", args);
        const firstArg = args.split(/\s+/)[0] ?? args;
        prompt = prompt.replaceAll("$1", firstArg);
      }
      if (hasExtDirRef) prompt = EXT_DIR_DIRECTIVE + prompt;
      pi.sendUserMessage(prompt);
    },
  });
}
