import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = dirname(__dirname);

// Pattern from tests/s01-load-on-demand.test.mts: load-codebase-doc.ts pulls
// in typebox at module scope. context-inspector.ts transitively imports it
// for `resolveCodebaseDocPath`, so the same symlink shim is required.
function ensureTypeboxResolvable(): void {
  const linkPath = join(repoRoot, "node_modules", "typebox");
  if (existsSync(linkPath)) return;
  let globalRoot: string;
  try {
    globalRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
  } catch {
    return;
  }
  const candidates = [
    join(globalRoot, "@earendil-works", "pi-coding-agent", "node_modules", "typebox"),
    join(globalRoot, "@mariozechner", "pi-coding-agent", "node_modules", "typebox"),
  ];
  const upstream = candidates.find((p) => existsSync(p));
  if (!upstream) return;
  mkdirSync(join(repoRoot, "node_modules"), { recursive: true });
  try {
    symlinkSync(upstream, linkPath, "dir");
  } catch {
    // race-safe no-op
  }
}

ensureTypeboxResolvable();

const { registerContextInspector } = await import("../context-inspector.ts");

// ── Mock pi & fixture wiring ────────────────────────────────────────────

type Handler = (event: any, ctx: any) => any;

interface MockPi {
  handlers: Map<string, Handler[]>;
  commands: Map<string, { description: string; handler: Handler }>;
  on(event: string, handler: Handler): void;
  registerCommand(name: string, opts: { description: string; handler: Handler }): void;
  dispatch(event: string, payload: any, ctx?: any): any[];
}

function mkMockPi(): MockPi {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, { description: string; handler: Handler }>();
  return {
    handlers,
    commands,
    on(event, h) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(h);
    },
    registerCommand(name, opts) {
      commands.set(name, opts);
    },
    dispatch(event, payload, ctx) {
      const list = handlers.get(event) ?? [];
      const out: any[] = [];
      for (const h of list) out.push(h(payload, ctx ?? {}));
      return out;
    },
  };
}

let tmpDir: string;
let savedCwd: string;

before(() => {
  savedCwd = process.cwd();
  tmpDir = mkdtempSync(join(tmpdir(), "ah-s03-"));

  const codebaseDir = join(tmpDir, ".pi", "codebase");
  mkdirSync(codebaseDir, { recursive: true });
  writeFileSync(join(codebaseDir, "INDEX.md"), "- CONVENZIONI.md: rules\n- STRUTTURA.md: layout\n");
  writeFileSync(join(codebaseDir, "CONVENZIONI.md"), "C".repeat(400));
  writeFileSync(join(codebaseDir, "STRUTTURA.md"), "S".repeat(200));

  const taskDir = join(tmpDir, ".pi", "tasks", "in-progress", "T-001-demo");
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(join(taskDir, "TASK.md"), "---\ntitle: demo task\n---\n# T-001\n");
  writeFileSync(
    join(taskDir, "PLAN.md"),
    "---\nestimated_steps: 2\ncontext-needed: [CONVENZIONI]\n---\n# Plan body\n",
  );

  // Real git repo + feature/T-001 branch so detectCurrentTaskLocal resolves.
  execSync("git init -q", { cwd: tmpDir });
  execSync("git config user.email test@test.test", { cwd: tmpDir });
  execSync("git config user.name test", { cwd: tmpDir });
  execSync("git checkout -q -b feature/T-001-demo", { cwd: tmpDir });

  process.chdir(tmpDir);
});

after(() => {
  process.chdir(savedCwd);
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

test("e2e: tool_call/tool_result wire into context audit + on-disk artifacts", async () => {
  const pi = mkMockPi();
  registerContextInspector(pi as any);

  // Initialise the session via the registered session_start handler.
  await Promise.all(
    pi.dispatch(
      "session_start",
      {},
      {
        sessionManager: { getSessionId: () => "abcdef0123456789" },
        ui: { notify: () => {} },
      },
    ),
  );

  // Drive a happy-path declared load (CONVENZIONI) and an over-load (STRUTTURA).
  const tcResults1 = pi.dispatch("tool_call", {
    type: "tool_call",
    toolName: "load_codebase_doc",
    toolCallId: "tc1",
    input: { name: "CONVENZIONI" },
  });
  const trResults1 = pi.dispatch("tool_result", {
    type: "tool_result",
    toolName: "load_codebase_doc",
    toolCallId: "tc1",
    input: { name: "CONVENZIONI" },
    content: [{ type: "text", text: "X".repeat(390) }],
    isError: false,
  });

  pi.dispatch("tool_call", {
    type: "tool_call",
    toolName: "load_codebase_doc",
    toolCallId: "tc2",
    input: { name: "STRUTTURA" },
  });
  pi.dispatch("tool_result", {
    type: "tool_result",
    toolName: "load_codebase_doc",
    toolCallId: "tc2",
    input: { name: "STRUTTURA" },
    content: [{ type: "text", text: "Y".repeat(180) }],
    isError: false,
  });

  // Observer invariant: neither tool_call nor tool_result handlers may
  // return a non-undefined value (D-Q3=A).
  for (const r of [...tcResults1, ...trResults1]) {
    assert.equal(r, undefined, `listener must return undefined, got ${JSON.stringify(r)}`);
  }

  // Find the session dir under .pi/context-inspector/
  const inspectorRoot = join(tmpDir, ".pi", "context-inspector");
  const sessionDirs = readdirSync(inspectorRoot);
  assert.equal(sessionDirs.length, 1, "expected exactly one session dir");
  const sessionDir = join(inspectorRoot, sessionDirs[0]);

  const summaryRaw = readFileSync(join(sessionDir, "summary.json"), "utf-8");
  const summary = JSON.parse(summaryRaw);
  assert.ok(summary.context, "summary must include context block");
  const t001 = summary.context["T-001"];
  assert.ok(t001, "summary.context['T-001'] must exist");
  assert.deepEqual(t001.declared, ["CONVENZIONI"]);
  assert.ok(t001.loaded.CONVENZIONI, "summary loaded.CONVENZIONI must exist");
  assert.equal(t001.loaded.CONVENZIONI.calls, 1);
  assert.equal(t001.label, "over-load");
  assert.deepEqual(t001.errors, [], "errors must be empty on happy path");

  // Per-task on-disk artifact
  const auditPath = join(sessionDir, "tasks", "T-001", "context-audit.json");
  assert.ok(existsSync(auditPath), `expected per-task audit at ${auditPath}`);
  const audit = JSON.parse(readFileSync(auditPath, "utf-8"));
  assert.equal(audit.taskId, "T-001");
  assert.deepEqual(audit.declared, ["CONVENZIONI"]);
  assert.equal(audit.label, "over-load");
  assert.equal(audit.pending, undefined, "serialised audit must not include pending");

  // Negative case: isError result must populate errors[] and NOT add to loaded.
  pi.dispatch("tool_call", {
    type: "tool_call",
    toolName: "load_codebase_doc",
    toolCallId: "tc3",
    input: { name: "NONEXISTENT" },
  });
  pi.dispatch("tool_result", {
    type: "tool_result",
    toolName: "load_codebase_doc",
    toolCallId: "tc3",
    input: { name: "NONEXISTENT" },
    content: [{ type: "text", text: "codebase doc not found: NONEXISTENT.md" }],
    isError: true,
  });

  const summary2 = JSON.parse(readFileSync(join(sessionDir, "summary.json"), "utf-8"));
  const t001b = summary2.context["T-001"];
  assert.ok(t001b.errors.length >= 1, "errors must include the failed NONEXISTENT load");
  const nonexistent = t001b.errors.find((e: any) => e.name === "NONEXISTENT");
  assert.ok(nonexistent, "errors must contain NONEXISTENT entry");
  assert.equal(t001b.loaded.NONEXISTENT, undefined, "NONEXISTENT must NOT enter loaded");

  // /ah:ctx-stats command body sanity (string contents, not invocation):
  const cmd = pi.commands.get("ah:ctx-stats");
  assert.ok(cmd, "ah:ctx-stats command must be registered");
});
