import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
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

// Mirrors tests/s03-inspector-wire.test.mts: context-inspector.ts pulls in
// typebox transitively (via load-codebase-doc), so symlink the global package
// into the worktree's node_modules.
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

// ── Mock pi & fixture wiring (mirrors s03) ───────────────────────────────

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

function mkCaptureCtx(): { ctx: any; notes: Array<{ msg: string; level: string }> } {
  const notes: Array<{ msg: string; level: string }> = [];
  const ctx = {
    sessionManager: { getSessionId: () => "abcdef0123456789" },
    ui: {
      notify: (msg: string, level: string) => {
        notes.push({ msg, level });
      },
    },
  };
  return { ctx, notes };
}

let tmpDir: string;
let savedCwd: string;

before(() => {
  savedCwd = process.cwd();
  tmpDir = mkdtempSync(join(tmpdir(), "ah-s04-"));

  const codebaseDir = join(tmpDir, ".pi", "codebase");
  mkdirSync(codebaseDir, { recursive: true });
  writeFileSync(join(codebaseDir, "INDEX.md"), "- CONVENZIONI.md: rules\n");
  writeFileSync(join(codebaseDir, "CONVENZIONI.md"), "C".repeat(400));

  const taskDir = join(tmpDir, ".pi", "tasks", "in-progress", "T-001-demo");
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(join(taskDir, "TASK.md"), "---\ntitle: demo task\n---\n# T-001\n");
  writeFileSync(
    join(taskDir, "PLAN.md"),
    "---\nestimated_steps: 1\ncontext-needed: [CONVENZIONI]\n---\n# Plan body\n",
  );

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

test("ah:ctx-audit renders persisted audit for an existing task", async () => {
  const pi = mkMockPi();
  registerContextInspector(pi as any);

  const { ctx: sessionCtx } = mkCaptureCtx();
  await Promise.all(pi.dispatch("session_start", {}, sessionCtx));

  // Drive one declared load so persistContextAudit writes context-audit.json.
  pi.dispatch("tool_call", {
    type: "tool_call",
    toolName: "load_codebase_doc",
    toolCallId: "tc1",
    input: { name: "CONVENZIONI" },
  });
  pi.dispatch("tool_result", {
    type: "tool_result",
    toolName: "load_codebase_doc",
    toolCallId: "tc1",
    input: { name: "CONVENZIONI" },
    content: [{ type: "text", text: "X".repeat(390) }],
    isError: false,
  });

  const cmd = pi.commands.get("ah:ctx-audit");
  assert.ok(cmd, "ah:ctx-audit command must be registered");

  const { ctx: cmdCtx, notes } = mkCaptureCtx();
  await cmd!.handler("T-001", cmdCtx);
  assert.equal(notes.length, 1, "handler must emit exactly one ui.notify call");
  const rendered = notes[0]!.msg;
  assert.equal(notes[0]!.level, "info");
  assert.ok(rendered.includes("Label:"), `rendered output must include 'Label:' — got: ${rendered}`);
  assert.ok(
    rendered.includes("declared: [CONVENZIONI]"),
    `rendered output must include declared list — got: ${rendered}`,
  );
  assert.ok(
    rendered.includes("loaded: [CONVENZIONI]"),
    `rendered output must include loaded list — got: ${rendered}`,
  );
  assert.ok(
    rendered.includes("delta_token:"),
    `rendered output must include delta_token — got: ${rendered}`,
  );
});

test("ah:ctx-audit emits 'not available' when no audit file exists for the task", async () => {
  const pi = mkMockPi();
  registerContextInspector(pi as any);

  const { ctx: sessionCtx } = mkCaptureCtx();
  await Promise.all(pi.dispatch("session_start", {}, sessionCtx));

  // No tool_call/tool_result cycle ⇒ no per-task audit file on disk.
  const cmd = pi.commands.get("ah:ctx-audit");
  assert.ok(cmd, "ah:ctx-audit command must be registered");

  const { ctx: cmdCtx, notes } = mkCaptureCtx();
  await cmd!.handler("T-999", cmdCtx);
  assert.equal(notes.length, 1, "handler must emit exactly one ui.notify call");
  assert.ok(
    notes[0]!.msg.includes("Context audit not available"),
    `expected 'Context audit not available' message — got: ${notes[0]!.msg}`,
  );
});
