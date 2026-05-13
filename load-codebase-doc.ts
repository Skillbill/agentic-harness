import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { Type } from "typebox";

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export type ResolveResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export function resolveCodebaseDocPath(cwd: string, name: string): ResolveResult {
  if (typeof name !== "string" || name.length === 0) {
    return { ok: false, error: "name is required" };
  }
  if (!NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error: `invalid name "${name}": must match ^[a-zA-Z0-9_-]+$ (no path separators, no extension, no dots)`,
    };
  }

  const codebaseRoot = resolve(join(cwd, ".pi", "codebase"));
  const candidate = resolve(join(codebaseRoot, name + ".md"));
  const rootWithSep = codebaseRoot.endsWith(sep) ? codebaseRoot : codebaseRoot + sep;

  if (candidate !== codebaseRoot && !candidate.startsWith(rootWithSep)) {
    return { ok: false, error: `resolved path escapes .pi/codebase/: ${candidate}` };
  }

  if (!existsSync(candidate)) {
    return { ok: false, error: `codebase doc not found: ${name}.md` };
  }

  return { ok: true, path: candidate };
}

const LOAD_PARAMS = Type.Object({
  name: Type.String({
    description:
      "Filename of the codebase doc without the .md extension (e.g. \"convenzioni\"). Must match ^[a-zA-Z0-9_-]+$.",
  }),
});

export function registerLoadCodebaseDoc(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "load_codebase_doc",
    label: "Load Codebase Doc",
    description:
      "Read the full content of a single document under .pi/codebase/ by name (without .md). Use this instead of the generic `read` tool when fetching codebase docs listed in the Project Codebase Index.",
    promptSnippet:
      "Fetch a full .pi/codebase/<name>.md document on demand instead of using the generic read tool.",
    promptGuidelines: [
      "Use load_codebase_doc to fetch the full body of a codebase document listed in the Project Codebase Index.",
      "Prefer load_codebase_doc over read when the target file lives under .pi/codebase/.",
    ],
    parameters: LOAD_PARAMS,
    async execute(_toolCallId, params) {
      const cwd = process.cwd();
      const result = resolveCodebaseDocPath(cwd, params.name);
      if (!result.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: result.error }],
        };
      }
      try {
        const body = readFileSync(result.path, "utf-8");
        return {
          content: [{ type: "text", text: body }],
          details: { path: result.path, bytes: body.length },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `failed to read ${result.path}: ${msg}` }],
        };
      }
    },
  });
}
