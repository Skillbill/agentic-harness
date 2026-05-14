import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { registerPrompt } from "../lib/register-prompt.js";
import { registerContextInspector } from "../lib/context-inspector.js";
import { buildCodebaseIndex } from "../lib/codebase-index.js";
import { registerLoadCodebaseDoc } from "../lib/load-codebase-doc.js";
import { migrateConsumer } from "../lib/migrate-consumer.js";
import { checkPiCompat } from "../lib/check-pi-compat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// repoRoot = parent di extensions/ — è la dir radice dell'estensione,
// quella dove vivono prompts/, skills/, templates/, package.json.
// $EXT_DIR nei prompt template viene risolto a questo valore.
const repoRoot = dirname(__dirname);
const promptsDir = join(repoRoot, "prompts");

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

  // Context Inspector: monitora token/payload upload e download per
  // ottimizzazione fine durante i task.
  registerContextInspector(pi);

  // Tool: load_codebase_doc — on-demand path-safe loader for .pi/codebase/*.md
  registerLoadCodebaseDoc(pi);

  for (const file of readdirSync(promptsDir)) {
    if (!file.endsWith(".md")) continue;
    const name = `ah:${basename(file, ".md")}`;
    registerPrompt(pi, name, join(promptsDir, file), repoRoot);
  }

  pi.on("session_start", async (_event, ctx) => {
    // R-0004: verify that the currently loaded PI runtime satisfies AH's
    // declared peerDependencies range. Runs before migrateConsumer because
    // if PI is too old the migration step might itself call APIs that
    // don't exist yet — better to warn the user up front. Non-blocking.
    try {
      await checkPiCompat(pi, ctx);
    } catch (err) {
      console.error("[agentic-harness] check-pi-compat crashed:", err);
    }

    // R-0003: bring the consumer project in line with the currently installed
    // AH version. Runs once per session; non-blocking on error so that a
    // broken migration never wedges AH startup.
    try {
      await migrateConsumer(pi, process.cwd());
    } catch (err) {
      console.error("[agentic-harness] migrate-consumer crashed:", err);
    }

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

  // Inject .pi/codebase/*.md ONCE per session, cached in closure.
  // NOTE (2026-04-30): docs/ is NO LONGER loaded here. Rationale: the
  // generic project-docs dump hit every LLM turn, inflating uploads by
  // ~100kB per request even when the content wasn't relevant to the
  // current task. We now keep only the compact codebase map, and will
  // layer task-scoped context selection on top of it (likely via
  // /task-new in the future).
  let codebaseContextInjected = false;
  let cachedCodebaseContext: string | null = null;

  pi.on("before_agent_start", async (_event, _ctx) => {
    if (codebaseContextInjected) return;

    if (cachedCodebaseContext === null) {
      const cwd = process.cwd();
      const codebaseDir = join(cwd, ".pi", "codebase");

      if (!existsSync(codebaseDir)) {
        codebaseContextInjected = true;
        return;
      }

      const indexPath = join(codebaseDir, "INDEX.md");
      let messageContent: string;
      let entriesCount: number;
      let approxTokens: number;

      if (existsSync(indexPath)) {
        // Use the on-disk INDEX.md verbatim (authoritative when freshly
        // generated by map-codebase).
        messageContent = readFileSync(indexPath, "utf-8");
        // Count list-style entries ("- <path>: ...") as a rough sentinel.
        entriesCount = messageContent
          .split(/\r?\n/)
          .filter((l) => /^- \S+\.md:/.test(l)).length;
        approxTokens = Math.round(messageContent.length / 4);
      } else {
        const built = buildCodebaseIndex(codebaseDir);
        if (built.entries.length === 0) {
          codebaseContextInjected = true;
          return;
        }
        messageContent = built.messageContent;
        entriesCount = built.entries.length;
        approxTokens = built.approxTokens;
      }

      cachedCodebaseContext = messageContent;

      console.log(
        `[agentic-harness] codebase-index: injecting ${entriesCount} entries ` +
        `(~${approxTokens} tokens)`
      );
    }

    codebaseContextInjected = true;

    return {
      message: {
        customType: "project-codebase-index",
        content: cachedCodebaseContext,
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
