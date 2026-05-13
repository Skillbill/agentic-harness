export function createAudit(taskId, declared, declaredBudgetTokens) {
  const audit = {
    taskId,
    declared,
    declaredBudgetTokens,
    loaded: {},
    loadedTokens: 0,
    deltaToken: 0,
    label: "on-budget",
    errors: [],
    pending: {},
  };
  recomputeDelta(audit);
  return audit;
}

export function onToolCall(audit, event) {
  if (event.toolName !== "load_codebase_doc") return;
  const name = event && event.input && event.input.name;
  if (typeof name !== "string") return;
  audit.pending[event.toolCallId] = name;
}

export function onToolResult(audit, event, nowIso) {
  const stem = audit.pending[event.toolCallId];
  if (stem === undefined) return;
  delete audit.pending[event.toolCallId];

  if (event.isError) {
    audit.errors.push({ name: stem, reason: extractReason(event.content) });
    return;
  }

  const stringified = JSON.stringify(event.content) ?? "";
  const bytes = Buffer.byteLength(stringified, "utf8");

  if (audit.loaded[stem]) {
    audit.loaded[stem].calls += 1;
  } else {
    audit.loaded[stem] = {
      bytes,
      approxTokens: Math.round(bytes / 4),
      calls: 1,
      firstSeenAt: nowIso,
    };
  }
  recomputeDelta(audit);
}

function extractReason(content) {
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0];
    if (first && typeof first === "object" && typeof first.text === "string") {
      return first.text;
    }
  }
  return "unknown";
}

export function recomputeDelta(audit) {
  let sum = 0;
  for (const k of Object.keys(audit.loaded)) {
    sum += audit.loaded[k].approxTokens;
  }
  audit.loadedTokens = sum;
  audit.deltaToken = sum - (audit.declaredBudgetTokens ?? 0);

  if (audit.declared === null) {
    audit.label = "no-declaration";
    return;
  }

  const declaredSet = new Set(audit.declared);
  const loadedSet = new Set(Object.keys(audit.loaded));

  const declaredArr = [...declaredSet];
  const loadedArr = [...loadedSet];

  const declaredSubsetOfLoaded = declaredArr.every((x) => loadedSet.has(x));
  const loadedSubsetOfDeclared = loadedArr.every((x) => declaredSet.has(x));

  if (declaredSubsetOfLoaded && loadedSubsetOfDeclared) {
    audit.label = "on-budget";
  } else if (loadedSubsetOfDeclared) {
    audit.label = "under-load";
  } else if (declaredSubsetOfLoaded) {
    audit.label = "over-load";
  } else {
    audit.label = "divergent";
  }
}

export function serializeAudit(audit) {
  const { pending: _pending, ...rest } = audit;
  return rest;
}

function fmtN(n) {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n));
}

function synthesisFor(label) {
  switch (label) {
    case "on-budget":
      return "Loaded stems match declared set — on-budget.";
    case "over-load":
      return "Loaded stems exceed declared set — over-load.";
    case "under-load":
      return "Some declared stems were not loaded — under-load.";
    case "divergent":
      return "Loaded stems diverge from declared set — divergent.";
    case "no-declaration":
      return "No declaration available — load tracking only (no-declaration).";
  }
}

export function renderContextAuditMarkdown(audit, _opts) {
  if (audit === null) {
    return "> Context audit not available — Inspector did not record `load_codebase_doc` calls for this task.";
  }

  const lines = [];
  lines.push(`Label: ${audit.label}`);

  if (audit.declared === null) {
    lines.push("declared: <none — no PLAN.md or no context-needed:>");
  } else if (audit.declared.length === 0) {
    lines.push("declared: []");
  } else {
    const declaredList = `[${audit.declared.join(", ")}]`;
    const budget = audit.declaredBudgetTokens;
    if (budget !== null && budget !== undefined) {
      lines.push(`declared: ${declaredList}   (≈${fmtN(budget)} tok)`);
    } else {
      lines.push(`declared: ${declaredList}`);
    }
  }

  const loadedNames = Object.keys(audit.loaded).sort();
  const loadedList = `[${loadedNames.join(", ")}]`;
  let totalCalls = 0;
  for (const k of loadedNames) totalCalls += audit.loaded[k].calls;
  lines.push(
    `loaded: ${loadedList}   (≈${fmtN(audit.loadedTokens)} tok, ${totalCalls} calls)`,
  );

  const dt = audit.deltaToken;
  const dtFmt = dt >= 0 ? `+${fmtN(dt)}` : `${fmtN(dt)}`;
  lines.push(`delta_token: ${dtFmt}`);

  lines.push(synthesisFor(audit.label));

  if (audit.errors.length > 0) {
    lines.push("errors:");
    for (const e of audit.errors) {
      lines.push(`  - ${e.name}: ${e.reason}`);
    }
  }

  return lines.join("\n");
}
