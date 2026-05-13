import { test } from "node:test";
import assert from "node:assert/strict";
import { parseContextNeeded, NAME_PATTERN } from '../plan-context.js';

test("parses non-empty inline list context-needed: [CONVENZIONI, STRUTTURA]", () => {
  const fixture = [
    "---",
    "estimated_steps: 3",
    "context-needed: [CONVENZIONI, STRUTTURA]",
    "---",
    "",
    "# T0X: Some task",
    "",
    "Body text.",
  ].join("\n");

  const r = parseContextNeeded(fixture);
  assert.equal(r.ok, true, `expected parse ok, got: ${JSON.stringify(r)}`);
  if (r.ok) {
    assert.equal(r.stems.length, 2, "expected 2 stems");
    assert.deepEqual(r.stems, ["CONVENZIONI", "STRUTTURA"]);
    for (const stem of r.stems) {
      assert.match(
        stem,
        NAME_PATTERN,
        `stem ${stem} must match NAME_PATTERN ${NAME_PATTERN}`,
      );
    }
  }
});

test("parses empty list context-needed: [] to a zero-length array", () => {
  const fixture = [
    "---",
    "estimated_steps: 1",
    "context-needed: []",
    "---",
    "",
    "# T0Y: Trivial task with no codebase context",
  ].join("\n");

  const r = parseContextNeeded(fixture);
  assert.equal(r.ok, true, `expected parse ok, got: ${JSON.stringify(r)}`);
  if (r.ok) {
    assert.equal(r.stems.length, 0, "empty list must parse to a zero-length array");
    assert.deepEqual(r.stems, []);
  }
});
