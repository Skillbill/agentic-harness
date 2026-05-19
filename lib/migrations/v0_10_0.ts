import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ConsumerMigration } from "./types.js";

/**
 * v0.10.0 — Add `priority: NORMAL` to every TASK.md frontmatter that doesn't
 * already declare a priority.
 *
 * Why: v0.10.0 introduces the `priority` field on tasks
 * (`LOW | NORMAL | HIGH | IMMEDIATE`, default `NORMAL`). New tasks created via
 * `/ah:task-new` get the field straight from the template, but pre-existing
 * tasks in the consumer's backlog / in-progress / review / done directories
 * have no such key. `/ah:project-status` now sorts the Backlog by priority,
 * so missing-the-key would silently bucket every legacy task into the same
 * lane. This migration writes `priority: NORMAL` explicitly so the data
 * matches what every reader (current and future) expects.
 *
 * Behavior:
 * - Idempotent: skips a TASK.md that already has any `priority:` line in
 *   its frontmatter (we don't normalize the value — that's the dev's call).
 * - Insertion point: right after the `status:` line in the frontmatter
 *   (matches the order used by `templates/task.md`). If `status:` is
 *   absent, append `priority: NORMAL` just before the closing `---`.
 * - Skips files without a valid `---\n…\n---` frontmatter block (they're
 *   malformed; let the dev fix them by hand).
 * - No git mutations.
 */

const TASK_BUCKETS = ["backlog", "in-progress", "review", "done"] as const;

function listTaskFiles(consumerRoot: string): string[] {
  const tasksDir = join(consumerRoot, ".pi", "tasks");
  if (!existsSync(tasksDir)) return [];

  const results: string[] = [];
  for (const bucket of TASK_BUCKETS) {
    const bucketDir = join(tasksDir, bucket);
    if (!existsSync(bucketDir)) continue;

    let entries: string[];
    try {
      entries = readdirSync(bucketDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const taskDir = join(bucketDir, entry);
      try {
        if (!statSync(taskDir).isDirectory()) continue;
      } catch {
        continue;
      }
      const taskFile = join(taskDir, "TASK.md");
      if (existsSync(taskFile)) results.push(taskFile);
    }
  }
  return results;
}

/**
 * Return `{ changed: true, next }` if `priority:` was inserted; otherwise
 * `{ changed: false, next: content }`.
 */
export function ensurePriorityField(content: string): {
  changed: boolean;
  next: string;
} {
  const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/);
  if (!fmMatch) return { changed: false, next: content };

  const [whole, openFence, fmBody, closeFence] = fmMatch;
  if (/^priority\s*:/m.test(fmBody!)) {
    return { changed: false, next: content };
  }

  const statusMatch = fmBody!.match(/^status\s*:.*$/m);
  let newFmBody: string;
  if (statusMatch) {
    const idx = fmBody!.indexOf(statusMatch[0]) + statusMatch[0].length;
    newFmBody =
      fmBody!.slice(0, idx) + "\npriority: NORMAL" + fmBody!.slice(idx);
  } else {
    // No status line — append at the end of the frontmatter block.
    newFmBody = fmBody!.replace(/\s*$/, "") + "\npriority: NORMAL";
  }

  const next = content.replace(whole!, `${openFence}${newFmBody}${closeFence}`);
  return { changed: true, next };
}

export const migration: ConsumerMigration = {
  version: "0.10.0",
  description:
    "Add priority: NORMAL to TASK.md frontmatter where the field is missing",
  apply: async (consumerRoot) => {
    const files = listTaskFiles(consumerRoot);
    let touched = 0;

    for (const file of files) {
      let raw: string;
      try {
        raw = readFileSync(file, "utf-8");
      } catch (err) {
        console.warn(`[ah] v0.10.0 migration: cannot read ${file}`, err);
        continue;
      }
      const { changed, next } = ensurePriorityField(raw);
      if (!changed) continue;
      try {
        writeFileSync(file, next, "utf-8");
        touched += 1;
      } catch (err) {
        console.warn(`[ah] v0.10.0 migration: cannot write ${file}`, err);
      }
    }

    if (touched > 0) {
      console.log(
        `[agentic-harness] 📝 Added \`priority: NORMAL\` to ${touched} TASK.md ` +
          "frontmatter(s). Edit individual tasks to bump them to HIGH / IMMEDIATE / LOW.",
      );
    }
  },
};
