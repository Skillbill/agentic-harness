import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync } from "node:fs";

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

export function registerPrompt(pi: ExtensionAPI, name: string, mdPath: string) {
  const raw = readFileSync(mdPath, "utf-8");
  const { meta, body } = parseFrontmatter(raw);

  pi.registerCommand(name, {
    description: meta.description ?? name,
    handler: async (args) => {
      let prompt = body;
      if (args) {
        prompt = prompt.replaceAll("$@", args);
        const firstArg = args.split(/\s+/)[0] ?? args;
        prompt = prompt.replaceAll("$1", firstArg);
      }
      pi.sendUserMessage(prompt);
    },
  });
}
