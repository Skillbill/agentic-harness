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

// `load-codebase-doc.ts` does `import { Type } from "typebox"` at module scope.
// The worktree itself has no node_modules; the PI host installs typebox as a
// transitive dep of pi-coding-agent under the global node_modules tree. Create
// a `node_modules/typebox` symlink pointing at that copy so the dynamic import
// below resolves. node_modules/ is gitignored.
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

const { buildCodebaseIndex } = await import("../codebase-index.ts");
const { resolveCodebaseDocPath } = await import("../load-codebase-doc.ts");

let tmpDir: string;
let codebaseDir: string;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ah-s01-"));
  codebaseDir = join(tmpDir, ".pi", "codebase");
  mkdirSync(codebaseDir, { recursive: true });
  writeFileSync(join(codebaseDir, "FOO.md"), "# Foo\n\nSome convention.");
  writeFileSync(join(codebaseDir, "BAR.md"), "# Bar\n\nAnother thing.");
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

test("buildCodebaseIndex returns 2 entries with header-derived summaries under budget", () => {
  const result = buildCodebaseIndex(codebaseDir);

  assert.equal(result.entries.length, 2, "expected 2 entries");

  const byPath = Object.fromEntries(result.entries.map((e) => [e.relPath, e.summary]));
  assert.ok("FOO.md" in byPath, "FOO.md missing from entries");
  assert.ok("BAR.md" in byPath, "BAR.md missing from entries");

  for (const e of result.entries) {
    assert.ok(
      e.summary.length > 0 && e.summary.length <= 120,
      `summary length out of range for ${e.relPath}: ${e.summary.length}`,
    );
  }
  assert.equal(byPath["FOO.md"], "Foo", "FOO.md summary should derive from '# Foo' header");
  assert.equal(byPath["BAR.md"], "Bar", "BAR.md summary should derive from '# Bar' header");

  assert.ok(
    result.messageContent.length < 2048,
    `messageContent too large: ${result.messageContent.length} bytes`,
  );
  assert.match(
    result.messageContent,
    /load_codebase_doc/,
    "messageContent must reference the load_codebase_doc tool",
  );
});

test("resolveCodebaseDocPath returns ok for a valid name and points under .pi/codebase/", () => {
  const r = resolveCodebaseDocPath(tmpDir, "FOO");
  assert.equal(r.ok, true, `expected ok, got: ${JSON.stringify(r)}`);
  if (r.ok) {
    const expected = join(tmpDir, ".pi", "codebase", "FOO.md");
    assert.equal(r.path, expected, "resolved path should be the FOO.md fixture");
    assert.ok(
      r.path.startsWith(join(tmpDir, ".pi", "codebase")),
      `path should be under .pi/codebase/: ${r.path}`,
    );
  }
});

test("resolveCodebaseDocPath rejects path-traversal, absolute paths, separators, and missing files", () => {
  const traversal = resolveCodebaseDocPath(tmpDir, "../etc/passwd");
  assert.equal(traversal.ok, false, "'../etc/passwd' must be rejected");

  const absolute = resolveCodebaseDocPath(tmpDir, "/etc/passwd");
  assert.equal(absolute.ok, false, "'/etc/passwd' must be rejected");

  const embedded = resolveCodebaseDocPath(tmpDir, "FOO/../BAR");
  assert.equal(embedded.ok, false, "'FOO/../BAR' must be rejected");

  const missing = resolveCodebaseDocPath(tmpDir, "NONEXISTENT");
  assert.equal(missing.ok, false, "'NONEXISTENT' must be rejected (file does not exist)");
});
