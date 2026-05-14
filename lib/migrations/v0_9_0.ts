import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConsumerMigration } from "./types.js";

/**
 * v0.9.0 — Drop an empty `.pi/REQUIREMENTS.md` skeleton in the consumer.
 *
 * Why: starting from v0.9.0 AH treats project requirements as a first-class
 * input to the task workflow. The consumer project owns a single document
 * `<consumerRoot>/.pi/REQUIREMENTS.md` listing R-NNNN entries, which AH reads
 * during the discuss / plan / verify phases. The file is populated organically
 * by `/ah:task-new` (link to / create an R-NNNN inline) and
 * `/ah:task-discuss` (new / amend post-discussion). This migration only lays
 * down the empty scaffold so those flows have a target file to append to.
 *
 * Behavior:
 * - Idempotent: if `.pi/REQUIREMENTS.md` already exists, this migration is a
 *   no-op (do not clobber dev-authored content; do not even rewrite the
 *   `updated:` date).
 * - Reads the skeleton from `<ahRoot>/templates/REQUIREMENTS.md`, substitutes
 *   `{{DATE}}` with today and `{{PROJECT}}` with the literal `<TBD>` (the dev
 *   edits it by hand or AH proposes it on the next /ah:task-new).
 * - No git mutations: the file is just written, the dev stages and commits.
 *
 * The single advisory line emitted at the end is informational; it does not
 * gate the rest of the session.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// lib/migrations/v0_9_0.ts → lib/migrations → lib → AH root
const AH_ROOT = join(__dirname, "..", "..");
const TEMPLATE_PATH = join(AH_ROOT, "templates", "REQUIREMENTS.md");

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const migration: ConsumerMigration = {
  version: "0.9.0",
  description:
    "Create empty .pi/REQUIREMENTS.md skeleton for project requirements (R-NNNN)",
  apply: async (consumerRoot) => {
    const piDir = join(consumerRoot, ".pi");
    const target = join(piDir, "REQUIREMENTS.md");

    if (existsSync(target)) {
      // Idempotent: the dev (or a previous run) already owns this file.
      return;
    }

    let template: string;
    try {
      template = readFileSync(TEMPLATE_PATH, "utf-8");
    } catch (err) {
      // The template ships with AH; absence is a packaging bug, not a
      // consumer concern. Log and skip — the framework will leave the
      // marker at the previous step so a fixed release retries.
      console.warn(
        `[ah] v0.9.0 migration: template not found at ${TEMPLATE_PATH} — skipping`,
        err,
      );
      return;
    }

    const rendered = template
      .replaceAll("{{DATE}}", today())
      .replaceAll("{{PROJECT}}", "<TBD>");

    mkdirSync(piDir, { recursive: true });
    writeFileSync(target, rendered, "utf-8");

    // Single advisory line, same shape as the `📝 Created .pi/ah-config.json`
    // log in extensions/index.ts. Visible in session_start scrollback; no
    // UI toast, no LLM turn burned.
    console.log(
      "[agentic-harness] 📝 Created .pi/REQUIREMENTS.md — " +
        "R-NNNN entries will be proposed inline during /ah:task-new and /ah:task-discuss.",
    );
  },
};
