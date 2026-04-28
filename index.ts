import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { registerPrompt } from "./register-prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = join(__dirname, "commands");

/**
 * Recursively collect all .md files under a directory.
 * Returns an array of { relPath, content } sorted by path.
 */
function collectMarkdownFiles(dir: string, baseDir?: string): { relPath: string; content: string }[] {
  if (!existsSync(dir)) return [];
  const base = baseDir ?? dir;
  const results: { relPath: string; content: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath, base));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push({
        relPath: relative(base, fullPath),
        content: readFileSync(fullPath, "utf-8"),
      });
    }
  }
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/** Detect current task from git branch + task files on disk. */
function detectCurrentTask(cwd: string): { id: string; title: string; branch: string; taskFile: string } | null {
  try {
    const branch = execSync("git branch --show-current", { cwd, encoding: "utf-8" }).trim();
    const match = branch.match(/^feature\/(T-\d+)/);
    if (!match) return null;
    const id = match[1]!;

    // Search task file in all status dirs
    const tasksRoot = join(cwd, ".pi", "tasks");
    for (const status of ["in-progress", "review", "backlog", "done"]) {
      const statusDir = join(tasksRoot, status);
      if (!existsSync(statusDir)) continue;
      for (const entry of readdirSync(statusDir)) {
        if (!entry.startsWith(id + "-")) continue;
        const taskFile = join(statusDir, entry, "TASK.md");
        if (!existsSync(taskFile)) continue;
        const raw = readFileSync(taskFile, "utf-8");
        const titleMatch = raw.match(/^title:\s*(.+)$/m);
        return { id, title: titleMatch?.[1] ?? entry, branch, taskFile };
      }
    }
    return { id, title: id, branch, taskFile: "" };
  } catch {
    return null;
  }
}

export default function (pi: ExtensionAPI) {
  let currentTask: ReturnType<typeof detectCurrentTask> = null;

  for (const file of readdirSync(commandsDir)) {
    if (!file.endsWith(".md")) continue;
    const name = `ah:${basename(file, ".md")}`;
    registerPrompt(pi, name, join(commandsDir, file), __dirname);
  }

  pi.on("session_start", async (_event, _ctx) => {
    // Detect current task
    currentTask = detectCurrentTask(process.cwd());

    if (currentTask) {
      console.log(`\n[agentic-harness] 🎯 Current task: ${currentTask.id} — ${currentTask.title} (${currentTask.branch})`);
    } else {
      console.log("\n[agentic-harness] No active task detected (not on a feature/ branch).");
    }

    const commands = pi.getCommands();
    const tools = pi.getAllTools();

    const extCommands = commands.filter(c => c.source === "extension");
    const extTools = tools.filter(
      t => t.sourceInfo.source !== "builtin" && t.sourceInfo.source !== "sdk"
    );

    console.log("[agentic-harness] commands:");
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

  // Inject project docs context into every LLM turn
  pi.on("before_agent_start", async (_event, _ctx) => {
    const cwd = process.cwd();
    const docsDir = join(cwd, "docs");
    const codebaseDir = join(cwd, ".pi", "codebase");

    const docFiles = collectMarkdownFiles(docsDir);
    const codebaseFiles = collectMarkdownFiles(codebaseDir);

    if (docFiles.length === 0 && codebaseFiles.length === 0) return;

    const sections: string[] = [
      `## 📚 Project Documentation Context`,
      ``,
    ];

    if (codebaseFiles.length > 0) {
      sections.push(`### .pi/codebase`, ``);
      for (const f of codebaseFiles) {
        sections.push(`#### ${f.relPath}`, ``, f.content, ``);
      }
    }

    if (docFiles.length > 0) {
      sections.push(`### docs/`, ``);
      for (const f of docFiles) {
        sections.push(`#### ${f.relPath}`, ``, f.content, ``);
      }
    }

    return {
      message: {
        customType: "project-docs-context",
        content: sections.join("\n"),
        display: false,
      },
    };
  });

  // Inject current-task context into every LLM turn
  pi.on("before_agent_start", async (_event, _ctx) => {
    // Re-detect in case of branch switch during session
    currentTask = detectCurrentTask(process.cwd());

    if (!currentTask) return;

    const taskContent = currentTask.taskFile && existsSync(currentTask.taskFile)
      ? readFileSync(currentTask.taskFile, "utf-8")
      : null;

    const contextBlock = [
      `## 🎯 Current Task Context`,
      ``,
      `- **Task:** ${currentTask.id} — ${currentTask.title}`,
      `- **Branch:** ${currentTask.branch}`,
      `- **Task file:** ${currentTask.taskFile}`,
    ];

    if (taskContent) {
      contextBlock.push(``, `<task-frontmatter>`, taskContent.split("---")[1]?.trim() ?? "", `</task-frontmatter>`);
    }

    return {
      message: {
        customType: "current-task-context",
        content: contextBlock.join("\n"),
        display: false,
      },
    };
  });
}
