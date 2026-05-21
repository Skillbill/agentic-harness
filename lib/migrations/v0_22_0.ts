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
 * v0.22.0 — Add `customer: null` and `project: null` to every TASK.md
 * frontmatter that doesn't already declare them.
 *
 * Why: v0.22.0 introduces two optional commercial-routing fields on tasks
 * (`customer:` / `project:`, see R-0017). They are pure metadata —
 * `/ah:project-status` renders them as `[customer/project]` next to each
 * task. New tasks created via `/ah:task-new` get the keys straight from
 * the template; pre-existing tasks would otherwise miss the keys
 * entirely and force every reader to special-case "missing vs null".
 * This migration writes the explicit `null` so the contract is uniform.
 *
 * Behavior:
 * - Idempotent per key: skips the insert for whichever of `customer:`
 *   / `project:` is already present in the frontmatter (we never
 *   normalize existing values — that's the dev's call).
 * - Insertion point: right after the `assignee:` line (matches the
 *   order in `templates/task.md`). If `assignee:` is absent, append
 *   the missing key(s) just before the closing `---`.
 * - Skips files without a valid `---\n…\n---` frontmatter block.
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
 * Return `{ changed, next }`: `changed: true` iff at least one of
 * `customer:` / `project:` was inserted.
 */
export function ensureCustomerProjectFields(content: string): {
  changed: boolean;
  next: string;
} {
  const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/);
  if (!fmMatch) return { changed: false, next: content };

  const [whole, openFence, fmBody, closeFence] = fmMatch;
  const hasCustomer = /^customer\s*:/m.test(fmBody!);
  const hasProject = /^project\s*:/m.test(fmBody!);
  if (hasCustomer && hasProject) return { changed: false, next: content };

  // Build the snippet to insert in template order: customer first, then project.
  const toInsert: string[] = [];
  if (!hasCustomer) toInsert.push("customer: null");
  if (!hasProject) toInsert.push("project: null");
  const snippet = toInsert.join("\n");

  let newFmBody: string;
  const assigneeMatch = fmBody!.match(/^assignee\s*:.*$/m);
  if (assigneeMatch) {
    const idx = fmBody!.indexOf(assigneeMatch[0]) + assigneeMatch[0].length;
    newFmBody = fmBody!.slice(0, idx) + "\n" + snippet + fmBody!.slice(idx);
  } else {
    newFmBody = fmBody!.replace(/\s*$/, "") + "\n" + snippet;
  }

  const next = content.replace(whole!, `${openFence}${newFmBody}${closeFence}`);
  return { changed: true, next };
}

export const migration: ConsumerMigration = {
  version: "0.22.0",
  description:
    "Add customer: null and project: null to TASK.md frontmatter where missing",
  apply: async (consumerRoot) => {
    const files = listTaskFiles(consumerRoot);
    let touched = 0;

    for (const file of files) {
      let raw: string;
      try {
        raw = readFileSync(file, "utf-8");
      } catch (err) {
        console.warn(`[ah] v0.22.0 migration: cannot read ${file}`, err);
        continue;
      }
      const { changed, next } = ensureCustomerProjectFields(raw);
      if (!changed) continue;
      try {
        writeFileSync(file, next, "utf-8");
        touched += 1;
      } catch (err) {
        console.warn(`[ah] v0.22.0 migration: cannot write ${file}`, err);
      }
    }

    if (touched > 0) {
      console.log(
        `[agentic-harness] 📝 Added \`customer: null\` / \`project: null\` to ${touched} TASK.md ` +
          "frontmatter(s). Edit individual tasks to set a customer / project.",
      );
    }
  },
};
