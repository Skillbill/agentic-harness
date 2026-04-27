import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerPrompt } from "./register-prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = join(__dirname, "commands");

export default function (pi: ExtensionAPI) {
  for (const file of readdirSync(commandsDir)) {
    if (!file.endsWith(".md")) continue;
    const name = basename(file, ".md");
    registerPrompt(pi, name, join(commandsDir, file));
  }
}
