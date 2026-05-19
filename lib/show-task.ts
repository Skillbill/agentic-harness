import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Lookup helpers backing the three keyboard shortcuts registered by
 * `extensions/index.ts` (alt+p / alt+k / alt+c — popup viewer per bucket).
 *
 * Lives in `lib/` so the parsing & sorting logic can be unit-tested
 * independently of the PI runtime. The shortcut handlers are thin wrappers
 * around `listBucketTasks` + `TaskPopup` (see `task-popup.ts`).
 */

export const TASK_BUCKETS = [
  "in-progress",
  "review",
  "backlog",
  "done",
] as const;
export type TaskBucket = (typeof TASK_BUCKETS)[number];

export const PRIORITY_LEVELS = ["IMMEDIATE", "HIGH", "NORMAL", "LOW"] as const;
export type Priority = (typeof PRIORITY_LEVELS)[number];

/** Normalize a free-form id into the canonical `T-NNN` form (3-digit zero-padded). */
export function normalizeTaskId(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const match = trimmed.match(/^[Tt]?-?(\d+)$/);
  if (!match) return null;
  return `T-${match[1]!.padStart(3, "0")}`;
}

/** Normalize a free-form priority value to the canonical uppercase token. */
export function normalizePriority(raw: string | undefined | null): Priority {
  if (!raw) return "NORMAL";
  const up = raw.trim().toUpperCase();
  if ((PRIORITY_LEVELS as readonly string[]).includes(up)) return up as Priority;
  return "NORMAL";
}

export interface TaskInfo {
  id: string;
  bucket: TaskBucket;
  taskDir: string;
  taskFile: string;
  /** Path of `taskFile` relative to the consumer root, for display. */
  relPath: string;
  /** Title from frontmatter (falls back to directory name when absent). */
  title: string;
  priority: Priority;
  /** ISO date `YYYY-MM-DD` from frontmatter (`updated`, then `created`), or null. */
  updated: string | null;
  /** Raw contents of TASK.md (full file, including frontmatter). */
  content: string;
}

/**
 * Minimal YAML-ish frontmatter parser scoped to the keys used by `TaskInfo`.
 * We deliberately don't pull a full YAML library — only six keys are read
 * and all are simple scalars. Anything more elaborate stays the dev's
 * concern.
 */
function parseTaskFrontmatter(content: string): {
  title?: string;
  priority?: string;
  updated?: string;
  created?: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const out: { [key: string]: string } = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2]!;
    // Strip wrapping quotes if any.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]!] = value;
  }
  return out;
}

function readTaskInfo(
  consumerRoot: string,
  bucket: TaskBucket,
  entry: string,
): TaskInfo | null {
  const idMatch = entry.match(/^(T-\d+)/);
  if (!idMatch) return null;
  const taskDir = join(consumerRoot, ".pi", "tasks", bucket, entry);
  try {
    if (!statSync(taskDir).isDirectory()) return null;
  } catch {
    return null;
  }
  const taskFile = join(taskDir, "TASK.md");
  if (!existsSync(taskFile)) return null;

  let content: string;
  try {
    content = readFileSync(taskFile, "utf-8");
  } catch {
    return null;
  }

  const fm = parseTaskFrontmatter(content);
  return {
    id: idMatch[1]!,
    bucket,
    taskDir,
    taskFile,
    relPath: relative(consumerRoot, taskFile),
    title: fm.title ?? entry,
    priority: normalizePriority(fm.priority),
    updated: fm.updated ?? fm.created ?? null,
    content,
  };
}

/** Read all TASK.md inside a single bucket directory, unsorted. */
export function listBucketTasks(
  consumerRoot: string,
  bucket: TaskBucket,
): TaskInfo[] {
  const bucketDir = join(consumerRoot, ".pi", "tasks", bucket);
  if (!existsSync(bucketDir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(bucketDir);
  } catch {
    return [];
  }

  const out: TaskInfo[] = [];
  for (const entry of entries) {
    const info = readTaskInfo(consumerRoot, bucket, entry);
    if (info) out.push(info);
  }
  return out;
}

const PRIORITY_RANK: Record<Priority, number> = {
  IMMEDIATE: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

/**
 * Return `tasks` sorted with the order each shortcut expects:
 * - `in-progress`: by id ascending (stable, predictable for the dev cycling tasks)
 * - `backlog`: by priority descending (IMMEDIATE → LOW), tie-break by id asc
 * - `done`: by `updated` descending (most recent first), tie-break by id desc
 * - `review`: by id ascending (rarely used by the shortcut; kept for completeness)
 */
export function sortForBucket(tasks: TaskInfo[], bucket: TaskBucket): TaskInfo[] {
  const copy = tasks.slice();
  if (bucket === "backlog") {
    copy.sort((a, b) => {
      const dp = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      return dp !== 0 ? dp : a.id.localeCompare(b.id);
    });
  } else if (bucket === "done") {
    copy.sort((a, b) => {
      const ua = a.updated ?? "";
      const ub = b.updated ?? "";
      if (ua !== ub) return ub.localeCompare(ua);
      return b.id.localeCompare(a.id);
    });
  } else {
    copy.sort((a, b) => a.id.localeCompare(b.id));
  }
  return copy;
}

/**
 * Backwards-compatible single-task lookup. Kept exported because the prompt
 * documentation references the helper name; the keyboard shortcuts use
 * `listBucketTasks` instead.
 */
export interface FoundTask {
  id: string;
  bucket: TaskBucket;
  taskDir: string;
  taskFile: string;
  relPath: string;
  content: string;
}

export function findTask(
  consumerRoot: string,
  rawInput: string,
): { ok: true; task: FoundTask } | { ok: false; reason: string } {
  const id = normalizeTaskId(rawInput);
  if (!id) {
    return {
      ok: false,
      reason: `'${rawInput}' is not a valid task id (expected e.g. 24, T-24, or T-024)`,
    };
  }
  for (const bucket of TASK_BUCKETS) {
    const bucketDir = join(consumerRoot, ".pi", "tasks", bucket);
    if (!existsSync(bucketDir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(bucketDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.startsWith(`${id}-`) && entry !== id) continue;
      const info = readTaskInfo(consumerRoot, bucket, entry);
      if (!info) continue;
      return {
        ok: true,
        task: {
          id: info.id,
          bucket: info.bucket,
          taskDir: info.taskDir,
          taskFile: info.taskFile,
          relPath: info.relPath,
          content: info.content,
        },
      };
    }
  }
  return {
    ok: false,
    reason: `Task ${id} not found in .pi/tasks/{in-progress,review,backlog,done}/`,
  };
}
