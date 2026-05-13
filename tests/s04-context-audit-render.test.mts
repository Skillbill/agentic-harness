import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAudit,
  onToolCall,
  onToolResult,
  renderContextAuditMarkdown,
  type ContextAudit,
} from "../context-audit.ts";

const NOW = "2026-05-12T00:00:00.000Z";

function mkContent(text: string) {
  return [{ type: "text", text }];
}

function load(
  audit: ContextAudit,
  name: string,
  callId: string,
  text = "X",
  iso = NOW,
) {
  onToolCall(audit, {
    toolName: "load_codebase_doc",
    toolCallId: callId,
    input: { name },
  });
  onToolResult(audit, { toolCallId: callId, content: mkContent(text) }, iso);
}

test("label on-budget: declared [A] loaded [A] → on-budget synthesis", () => {
  const a = createAudit("T-001", ["A"], 1000);
  load(a, "A", "tc-1", "alpha");
  const md = renderContextAuditMarkdown(a);

  assert.match(md, /^Label: on-budget$/m);
  assert.match(md, /^declared: \[A\] {3}\(≈1000 tok\)$/m);
  assert.match(md, /^loaded: \[A\] {3}\(≈\d+ tok, 1 calls\)$/m);
  assert.match(md, /^delta_token: [+-]?\d+$/m);
  assert.match(md, /on-budget\.?$/m);
  assert.ok(!md.includes("errors:"), "no errors block when errors[] empty");
});

test("label over-load: declared [A] loaded [A,B] → over-load synthesis", () => {
  const a = createAudit("T-002", ["A"], 0);
  load(a, "A", "tc-1", "alpha");
  load(a, "B", "tc-2", "beta");
  const md = renderContextAuditMarkdown(a);

  assert.match(md, /^Label: over-load$/m);
  assert.match(md, /^declared: \[A\] {3}\(≈0 tok\)$/m);
  assert.match(md, /^loaded: \[A, B\] {3}\(≈\d+ tok, 2 calls\)$/m);
  assert.match(md, /^delta_token: \+\d+$/m);
  assert.match(md, /over-load\.?$/m);
});

test("label under-load: declared [A,B] loaded [A] → under-load synthesis + negative delta", () => {
  const a = createAudit("T-003", ["A", "B"], 10_000);
  load(a, "A", "tc-1", "alpha");
  const md = renderContextAuditMarkdown(a);

  assert.match(md, /^Label: under-load$/m);
  assert.match(md, /^declared: \[A, B\] {3}\(≈10000 tok\)$/m);
  assert.match(md, /^loaded: \[A\] {3}\(≈\d+ tok, 1 calls\)$/m);
  assert.match(md, /^delta_token: -\d+$/m);
  assert.match(md, /under-load\.?$/m);
});

test("label divergent: declared [A] loaded [B] → divergent synthesis", () => {
  const a = createAudit("T-004", ["A"], null);
  load(a, "B", "tc-1", "beta");
  const md = renderContextAuditMarkdown(a);

  assert.match(md, /^Label: divergent$/m);
  // No declaredBudgetTokens → no (≈N tok) suffix on declared line.
  assert.match(md, /^declared: \[A\]$/m);
  assert.match(md, /^loaded: \[B\] {3}\(≈\d+ tok, 1 calls\)$/m);
  assert.match(md, /^delta_token: [+-]?\d+$/m);
  assert.match(md, /divergent\.?$/m);
});

test("label no-declaration: declared null → emits placeholder + no-declaration synthesis", () => {
  const a = createAudit("T-005", null, null);
  load(a, "A", "tc-1", "alpha");
  const md = renderContextAuditMarkdown(a);

  assert.match(md, /^Label: no-declaration$/m);
  assert.match(md, /^declared: <none — no PLAN\.md or no context-needed:>$/m);
  assert.match(md, /^loaded: \[A\] {3}\(≈\d+ tok, 1 calls\)$/m);
  assert.match(md, /^delta_token: [+-]?\d+$/m);
  assert.match(md, /no-declaration/m);
});

test("edge: null audit → emits explicit unavailable line and nothing else", () => {
  const md = renderContextAuditMarkdown(null);
  assert.equal(
    md,
    "> Context audit not available — Inspector did not record `load_codebase_doc` calls for this task.",
  );
  assert.ok(!md.includes("Label:"));
  assert.ok(!md.includes("declared:"));
  assert.ok(!md.includes("loaded:"));
  assert.ok(!md.includes("delta_token:"));
});

test("edge: declared:[] with no loads → on-budget label, declared:[], loaded:[]", () => {
  const a = createAudit("T-007", [], null);
  const md = renderContextAuditMarkdown(a);

  assert.match(md, /^Label: on-budget$/m);
  assert.match(md, /^declared: \[\]$/m);
  assert.match(md, /^loaded: \[\] {3}\(≈0 tok, 0 calls\)$/m);
  assert.match(md, /^delta_token: \+0$/m);
  assert.match(md, /on-budget\.?$/m);
  assert.ok(!md.includes("errors:"));
});

test("edge: errors-only happy path → declared loaded fine, errors[] entry rendered", () => {
  const a = createAudit("T-008", ["A"], null);
  // Load A successfully.
  load(a, "A", "tc-ok", "alpha");
  // Then a failed call for stem B.
  onToolCall(a, {
    toolName: "load_codebase_doc",
    toolCallId: "tc-bad",
    input: { name: "B" },
  });
  onToolResult(
    a,
    {
      toolCallId: "tc-bad",
      content: [{ type: "text", text: "doc not found" }],
      isError: true,
    },
    NOW,
  );

  const md = renderContextAuditMarkdown(a);

  // Label remains on-budget because failed loads do not enter `loaded`.
  assert.match(md, /^Label: on-budget$/m);
  assert.match(md, /^declared: \[A\]$/m);
  assert.match(md, /^loaded: \[A\] {3}\(≈\d+ tok, 1 calls\)$/m);
  assert.match(md, /^delta_token: [+-]?\d+$/m);
  assert.match(md, /^errors:$/m);
  assert.match(md, /^ {2}- B: doc not found$/m);
});
