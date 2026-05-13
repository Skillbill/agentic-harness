import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAudit,
  onToolCall,
  onToolResult,
  recomputeDelta,
  serializeAudit,
  type ContextAudit,
} from "../context-audit.ts";

const NOW = "2026-05-12T00:00:00.000Z";

function mkContent(text: string) {
  return [{ type: "text", text }];
}

function load(audit: ContextAudit, name: string, callId: string, text = "X", iso = NOW) {
  onToolCall(audit, { toolName: "load_codebase_doc", toolCallId: callId, input: { name } });
  onToolResult(audit, { toolCallId: callId, content: mkContent(text) }, iso);
}

test("case 1: empty declared list + zero events → on-budget, zero loaded", () => {
  const a = createAudit("T-001", [], null);
  assert.deepEqual(a.loaded, {});
  assert.equal(a.loadedTokens, 0);
  assert.equal(a.deltaToken, 0);
  assert.equal(a.label, "on-budget");
  assert.deepEqual(a.errors, []);
});

test("case 2: declared [CONVENZIONI] + one successful load → bytes ≈ json length, calls:1, on-budget", () => {
  const a = createAudit("T-002", ["CONVENZIONI"], null);
  const text = "X".repeat(400);
  onToolCall(a, {
    toolName: "load_codebase_doc",
    toolCallId: "tc-1",
    input: { name: "CONVENZIONI" },
  });
  onToolResult(a, { toolCallId: "tc-1", content: mkContent(text) }, NOW);

  const expectedBytes = Buffer.byteLength(JSON.stringify(mkContent(text)), "utf8");
  assert.ok(a.loaded.CONVENZIONI, "expected loaded.CONVENZIONI");
  assert.equal(a.loaded.CONVENZIONI.bytes, expectedBytes);
  assert.equal(a.loaded.CONVENZIONI.calls, 1);
  assert.equal(a.loaded.CONVENZIONI.firstSeenAt, NOW);
  assert.equal(a.label, "on-budget");
});

test("case 3: declared [A,B], load A only → under-load, deltaToken < 0 with budget", () => {
  const a = createAudit("T-003", ["A", "B"], 10_000);
  load(a, "A", "tc-1", "alpha");
  assert.equal(a.label, "under-load");
  assert.ok(a.deltaToken < 0, `expected deltaToken < 0, got ${a.deltaToken}`);
});

test("case 4: declared [A], load A and B → over-load, deltaToken > 0", () => {
  const a = createAudit("T-004", ["A"], 0);
  load(a, "A", "tc-1", "alpha");
  load(a, "B", "tc-2", "beta");
  assert.equal(a.label, "over-load");
  assert.ok(a.deltaToken > 0, `expected deltaToken > 0, got ${a.deltaToken}`);
});

test("case 5: declared [A], load B only → divergent", () => {
  const a = createAudit("T-005", ["A"], null);
  load(a, "B", "tc-1", "beta");
  assert.equal(a.label, "divergent");
});

test("case 6: repeated successful load of A → calls:2, bytes unchanged", () => {
  const a = createAudit("T-006", ["A"], null);
  load(a, "A", "tc-1", "alpha-once");
  const firstBytes = a.loaded.A.bytes;
  const firstSeen = a.loaded.A.firstSeenAt;
  load(a, "A", "tc-2", "a-MUCH-LONGER-PAYLOAD-the-second-time", "2026-05-12T00:00:01.000Z");
  assert.equal(a.loaded.A.calls, 2, "calls must increment");
  assert.equal(a.loaded.A.bytes, firstBytes, "bytes must NOT change on repeated load");
  assert.equal(a.loaded.A.firstSeenAt, firstSeen, "firstSeenAt must stick to first load");
});

test("case 7: isError:true result → errors entry, no loaded entry", () => {
  const a = createAudit("T-007", ["A"], null);
  onToolCall(a, {
    toolName: "load_codebase_doc",
    toolCallId: "tc-1",
    input: { name: "A" },
  });
  onToolResult(
    a,
    { toolCallId: "tc-1", content: [{ type: "text", text: "doc not found" }], isError: true },
    NOW,
  );
  assert.equal(a.errors.length, 1);
  assert.equal(a.errors[0].name, "A");
  assert.equal(a.errors[0].reason, "doc not found");
  assert.equal(a.loaded.A, undefined);
});

test("case 8: declared:null → label:'no-declaration' regardless of events", () => {
  const a = createAudit("T-008", null, null);
  assert.equal(a.label, "no-declaration");
  load(a, "A", "tc-1", "alpha");
  load(a, "B", "tc-2", "beta");
  assert.equal(a.label, "no-declaration", "label must remain no-declaration after loads");
  assert.ok(a.loaded.A, "loaded.A should still be recorded even with no declaration");
});

test("case 9: serializeAudit strips 'pending' and roundtrips through JSON", () => {
  const a = createAudit("T-009", ["A"], 100);
  // Leave one pending tool call to prove it gets stripped.
  onToolCall(a, { toolName: "load_codebase_doc", toolCallId: "tc-pending", input: { name: "A" } });
  assert.ok(a.pending["tc-pending"], "precondition: pending entry exists in live audit");

  const serialized = serializeAudit(a) as Record<string, unknown>;
  assert.equal((serialized as any).pending, undefined, "serialized must not include pending");

  const roundtripped = JSON.parse(JSON.stringify(serialized));
  assert.equal(roundtripped.pending, undefined);
  assert.equal(roundtripped.taskId, "T-009");
  assert.deepEqual(roundtripped.declared, ["A"]);
  assert.equal(roundtripped.declaredBudgetTokens, 100);
  assert.equal(roundtripped.label, "under-load");
  assert.deepEqual(roundtripped.loaded, {});
  assert.deepEqual(roundtripped.errors, []);
});
