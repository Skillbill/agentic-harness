import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ConsumerMigration } from "./types.js";

/**
 * v0.7.0 — Rename the 5 Italian-named `.pi/codebase/*.md` docs to English.
 *
 * Why: AH became English-only at v0.7.0. The 5 thematic docs that used
 * Italian basenames (INTEGRAZIONI, ARCHITETTURA, STRUTTURA, CONVENZIONI,
 * CRITICITA) are renamed in every consumer project to the new English
 * basenames. `STACK.md` and `TESTING.md` are unchanged (already English).
 *
 * Behavior:
 * - Idempotent: a rename is performed only when the source file exists
 *   and the target file does not. Re-runs are no-ops.
 * - INDEX.md and `.cache.json` (if present) are rewritten so the index
 *   and the staleness tracker keep pointing at the new names.
 * - No git mutations: the dev stages and commits the renames themselves.
 */

const RENAMES: ReadonlyArray<readonly [string, string]> = [
  ["INTEGRAZIONI.md", "INTEGRATIONS.md"],
  ["ARCHITETTURA.md", "ARCHITECTURE.md"],
  ["STRUTTURA.md", "STRUCTURE.md"],
  ["CONVENZIONI.md", "CONVENTIONS.md"],
  ["CRITICITA.md", "TECHNICAL_DEBT.md"],
];

export const migration: ConsumerMigration = {
  version: "0.7.0",
  description: "Rename .pi/codebase docs from Italian to English filenames",
  apply: async (consumerRoot) => {
    const codebaseDir = join(consumerRoot, ".pi", "codebase");
    if (!existsSync(codebaseDir)) return;

    // 1. Rename the .md files themselves.
    for (const [oldName, newName] of RENAMES) {
      const oldPath = join(codebaseDir, oldName);
      const newPath = join(codebaseDir, newName);
      if (!existsSync(oldPath)) continue; // already renamed or never existed
      if (existsSync(newPath)) continue; // don't clobber an existing target
      renameSync(oldPath, newPath);
    }

    // 2. Rewrite INDEX.md so entries reference the new basenames.
    const indexPath = join(codebaseDir, "INDEX.md");
    if (existsSync(indexPath)) {
      let content = readFileSync(indexPath, "utf-8");
      let changed = false;
      for (const [oldName, newName] of RENAMES) {
        // Match the basename on word boundaries, case-sensitive.
        const re = new RegExp(`\\b${oldName.replace(/\./g, "\\.")}\\b`, "g");
        if (re.test(content)) {
          content = content.replace(re, newName);
          changed = true;
        }
      }
      if (changed) writeFileSync(indexPath, content, "utf-8");
    }

    // 3. Rewrite .cache.json: rename doc keys while preserving entries.
    const cachePath = join(codebaseDir, ".cache.json");
    if (existsSync(cachePath)) {
      let parsed: { docs?: Record<string, unknown> } | null = null;
      try {
        parsed = JSON.parse(readFileSync(cachePath, "utf-8")) as {
          docs?: Record<string, unknown>;
        };
      } catch {
        // Malformed cache: leave it alone — codebase-cache will rebuild it.
        return;
      }
      if (!parsed || typeof parsed !== "object" || !parsed.docs) return;

      let changed = false;
      const docs = parsed.docs;
      for (const [oldName, newName] of RENAMES) {
        if (Object.prototype.hasOwnProperty.call(docs, oldName)) {
          if (!Object.prototype.hasOwnProperty.call(docs, newName)) {
            docs[newName] = docs[oldName];
          }
          delete docs[oldName];
          changed = true;
        }
      }
      if (changed) {
        writeFileSync(cachePath, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
      }
    }
  },
};
