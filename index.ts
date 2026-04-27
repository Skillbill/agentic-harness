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
    registerPrompt(pi, name, join(commandsDir, file), __dirname);
  }

  pi.on("session_start", async (_event, _ctx) => {
    const commands = pi.getCommands();
    const tools = pi.getAllTools();

    const extCommands = commands.filter(c => c.source === "extension");
    const extTools = tools.filter(
      t => t.sourceInfo.source !== "builtin" && t.sourceInfo.source !== "sdk"
    );

    console.log("\n[agentic-harness] commands:");
    for (const cmd of extCommands) {
      console.log(`  /${cmd.name} — ${cmd.description ?? "(no description)"}`);
    }

    console.log("[agentic-harness] tools:");
    if (extTools.length === 0) {
      console.log("  (none)");
    } else {
      for (const tool of extTools) {
        console.log(`  ${tool.name} — ${tool.description?.slice(0, 80) ?? "(no description)"}`);
      }
    }
    console.log("");
  });
}
