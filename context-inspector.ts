/**
 * Context Inspector — modulo di agentic-harness.
 *
 * Monitora in modo fine cosa pi invia al provider LLM e cosa riceve, per
 * ottimizzare i token in upload/download durante i task (Efesto e altri
 * progetti che caricano AH).
 *
 * Eventi pi usati (vedi docs/extensions.md di pi):
 *   - before_provider_request  → payload completo in uscita verso il provider
 *   - after_provider_response  → status + headers in ingresso
 *   - message_end              → AssistantMessage con Usage autoritativa
 *   - turn_end                 → contatore turni
 *   - session_start            → (re)inizializza cartella per la sessione
 *
 * Output: sotto <cwd>/.pi/context-inspector/<YYYYMMDD-HHMMSS>_<sid8>/
 *   - requests.ndjson   breakdown granulare del payload (1 riga per richiesta)
 *   - responses.ndjson  status + headers (1 riga per risposta)
 *   - usage.ndjson      usage autoritativa per ogni assistant message
 *   - summary.json      totali live
 *
 * Comandi registrati:
 *   /ah:ctx-stats   riepilogo leggibile
 *   /ah:ctx-open    apre la cartella della sessione
 *   /ah:ctx-tail N  ultime N richieste dal log
 *
 * Nota: l'estensione è osservativa. `before_provider_request` ritorna
 * sempre undefined, quindi non altera mai il payload.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  existsSync,
  mkdirSync,
  appendFileSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { spawn, execSync } from "node:child_process";
import {
  createAudit,
  onToolCall,
  onToolResult,
  renderContextAuditMarkdown,
  serializeAudit,
  type ContextAudit,
  type AuditError,
} from './context-audit.js';
import { parseContextNeeded } from './plan-context.js';
import { sep } from "node:path";

// Inlined copy of resolveCodebaseDocPath from ./load-codebase-doc.ts. We
// avoid the import because load-codebase-doc.ts imports typebox at module
// scope and the runtime test path resolves .js specifiers against on-disk
// files; duplicating the ~25-LOC pure function keeps this module typebox-free.
const NAME_PATTERN_CB = /^[a-zA-Z0-9_-]+$/;
type ResolveResult = { ok: true; path: string } | { ok: false; error: string };
function resolveCodebaseDocPath(cwd: string, name: string): ResolveResult {
  if (typeof name !== "string" || name.length === 0) {
    return { ok: false, error: "name is required" };
  }
  if (!NAME_PATTERN_CB.test(name)) {
    return { ok: false, error: `invalid name "${name}"` };
  }
  const codebaseRoot = resolve(join(cwd, ".pi", "codebase"));
  const candidate = resolve(join(codebaseRoot, name + ".md"));
  const rootWithSep = codebaseRoot.endsWith(sep) ? codebaseRoot : codebaseRoot + sep;
  if (candidate !== codebaseRoot && !candidate.startsWith(rootWithSep)) {
    return { ok: false, error: `resolved path escapes .pi/codebase/: ${candidate}` };
  }
  if (!existsSync(candidate)) {
    return { ok: false, error: `codebase doc not found: ${name}.md` };
  }
  return { ok: true, path: candidate };
}

// ── Stato per sessione ───────────────────────────────────────────────────

interface Totals {
  requests: number;
  turns: number;
  payloadBytes: number;        // Σ bytes di JSON.stringify(payload)
  payloadApproxTokens: number; // ≈ payloadBytes / 4
  usageInput: number;          // token input autoritativi dal provider
  usageOutput: number;
  usageCacheRead: number;
  usageCacheWrite: number;
  costTotal: number;
  models: Record<string, number>; // "<provider>/<model>" → count assistant msg
  tools: Record<string, number>;  // toolName → count presenze nel payload
  startedAt: string;
}

interface SessionCtx {
  dir: string;
  reqFile: string;
  resFile: string;
  usageFile: string;
  summaryFile: string;
  totals: Totals;
  // Per-task context audit. Key = taskId (e.g. "T-001").
  context: Record<string, ContextAudit>;
}

let current: SessionCtx | undefined;

// ── Utility ──────────────────────────────────────────────────────────────

function tsFolder(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function approxTokens(bytes: number): number {
  // Stima ~4 bytes/token. Serve solo per "ordine di grandezza" pre-risposta.
  // Il conteggio autoritativo arriva da usage.input del provider.
  return Math.round(bytes / 4);
}

function sizeOf(x: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(x) ?? "", "utf8");
  } catch {
    return 0;
  }
}

function fmtN(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

function initSession(cwd: string, sessionId: string): SessionCtx {
  const root = join(resolve(cwd), ".pi", "context-inspector");
  const dir = join(root, `${tsFolder()}_${sessionId.slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  const sc: SessionCtx = {
    dir,
    reqFile: join(dir, "requests.ndjson"),
    resFile: join(dir, "responses.ndjson"),
    usageFile: join(dir, "usage.ndjson"),
    summaryFile: join(dir, "summary.json"),
    totals: {
      requests: 0,
      turns: 0,
      payloadBytes: 0,
      payloadApproxTokens: 0,
      usageInput: 0,
      usageOutput: 0,
      usageCacheRead: 0,
      usageCacheWrite: 0,
      costTotal: 0,
      models: {},
      tools: {},
      startedAt: new Date().toISOString(),
    },
    context: {},
  };
  persistSummary(sc);
  return sc;
}

function persistSummary(sc: SessionCtx): void {
  try {
    const context: Record<string, object> = {};
    for (const [k, v] of Object.entries(sc.context)) {
      context[k] = serializeAudit(v);
    }
    const payload = { ...sc.totals, context };
    writeFileSync(sc.summaryFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  } catch {
    /* ignore */
  }
}

// Inlined task detector. Duplicated (~25 LOC) instead of imported from
// ./index.js to avoid the import cycle index → context-inspector → index.
function detectCurrentTaskLocal(
  cwd: string,
): { id: string; taskFile: string } | null {
  try {
    const branch = execSync("git branch --show-current", { cwd, encoding: "utf-8" }).trim();
    const match = branch.match(/^feature\/(T-\d+)/);
    if (!match) return null;
    const id = match[1]!;
    const tasksRoot = join(cwd, ".pi", "tasks");
    for (const status of ["in-progress", "review", "backlog", "done"]) {
      const statusDir = join(tasksRoot, status);
      if (!existsSync(statusDir)) continue;
      for (const entry of readdirSync(statusDir)) {
        if (!entry.startsWith(id + "-")) continue;
        const taskFile = join(statusDir, entry, "TASK.md");
        if (!existsSync(taskFile)) continue;
        return { id, taskFile };
      }
    }
    return { id, taskFile: "" };
  } catch {
    return null;
  }
}

function ensureAuditForCurrentTask(cwd: string, sc: SessionCtx): ContextAudit | null {
  const task = detectCurrentTaskLocal(cwd);
  if (!task) return null;
  const existing = sc.context[task.id];
  if (existing) return existing;

  let declared: string[] | null = null;
  const initialErrors: AuditError[] = [];

  if (task.taskFile) {
    const planFile = join(dirname(task.taskFile), "PLAN.md");
    if (existsSync(planFile)) {
      try {
        const raw = readFileSync(planFile, "utf-8");
        const r = parseContextNeeded(raw);
        if (r.ok) {
          declared = r.stems;
        } else {
          initialErrors.push({ name: "<plan>", reason: `parse-failed: ${r.reason}` });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        initialErrors.push({ name: "<plan>", reason: `read-failed: ${msg}` });
      }
    }
  }

  let declaredBudgetTokens: number | null = null;
  if (declared !== null) {
    let sumBytes = 0;
    for (const stem of declared) {
      const r = resolveCodebaseDocPath(cwd, stem);
      if (r.ok) {
        try {
          sumBytes += statSync(r.path).size;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          initialErrors.push({ name: stem, reason: `stat-failed: ${msg}` });
        }
      } else {
        initialErrors.push({ name: stem, reason: r.error });
      }
    }
    declaredBudgetTokens = Math.round(sumBytes / 4);
  }

  const audit = createAudit(task.id, declared, declaredBudgetTokens);
  for (const e of initialErrors) audit.errors.push(e);
  sc.context[task.id] = audit;
  return audit;
}

// Session dir naming is `${YYYYMMDD-HHMMSS}_${sid8}` (see initSession). The
// timestamp prefix is monotonic and lexicographically sortable, so we sort by
// name descending rather than by mtime — survives clock skew across mounts.
const SESSION_DIR_PATTERN = /^\d{8}-\d{6}_[A-Za-z0-9]+$/;

export function findLatestAuditForTask(cwd: string, taskId: string): string | null {
  const root = join(resolve(cwd), ".pi", "context-inspector");
  if (!existsSync(root)) return null;
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return null;
  }
  const sessions = entries
    .filter((name) => SESSION_DIR_PATTERN.test(name))
    .sort()
    .reverse();
  for (const name of sessions) {
    const candidate = join(root, name, "tasks", taskId, "context-audit.json");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const TASK_ID_PATTERN = /^T-\d+$/;

function persistContextAudit(sc: SessionCtx, audit: ContextAudit): void {
  persistSummary(sc);
  try {
    const taskDir = join(sc.dir, "tasks", audit.taskId);
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(
      join(taskDir, "context-audit.json"),
      JSON.stringify(serializeAudit(audit), null, 2) + "\n",
      "utf8",
    );
  } catch {
    /* ignore */
  }
}

// ── Analisi del payload ──────────────────────────────────────────────────

interface PayloadBreakdown {
  provider?: string;
  model?: string;
  totalBytes: number;
  totalApproxTokens: number;
  parts: {
    system: { bytes: number; approxTokens: number; present: boolean };
    tools: { bytes: number; approxTokens: number; count: number };
    messages: {
      bytes: number;
      approxTokens: number;
      count: number;
      byRole: Record<string, { count: number; bytes: number; approxTokens: number }>;
      perMessage: Array<{
        idx: number;
        role: string;
        bytes: number;
        approxTokens: number;
        hasToolCalls?: boolean;
        hasToolResult?: boolean;
        hasImage?: boolean;
        preview?: string; // primi ~120 char del primo text block
      }>;
    };
    other: { bytes: number; approxTokens: number; keys: string[] };
  };
}

function analyzePayload(payload: any): PayloadBreakdown {
  const totalBytes = sizeOf(payload);
  const bd: PayloadBreakdown = {
    provider: payload?.provider,
    model: payload?.model ?? payload?.modelId,
    totalBytes,
    totalApproxTokens: approxTokens(totalBytes),
    parts: {
      system: { bytes: 0, approxTokens: 0, present: false },
      tools: { bytes: 0, approxTokens: 0, count: 0 },
      messages: {
        bytes: 0,
        approxTokens: 0,
        count: 0,
        byRole: {},
        perMessage: [],
      },
      other: { bytes: 0, approxTokens: 0, keys: [] },
    },
  };

  const obj = payload && typeof payload === "object" ? payload : {};

  // system (chiavi tipiche Anthropic / OpenAI / Google)
  const systemVal =
    obj.system ?? obj.systemPrompt ?? obj.system_instruction ?? obj.systemInstruction ?? obj.instructions;
  if (systemVal !== undefined && systemVal !== null && systemVal !== "") {
    const b = sizeOf(systemVal);
    bd.parts.system = { bytes: b, approxTokens: approxTokens(b), present: true };
  }

  // tools
  const toolsVal = obj.tools ?? obj.toolDeclarations ?? obj.tool_declarations;
  if (Array.isArray(toolsVal)) {
    const b = sizeOf(toolsVal);
    bd.parts.tools = { bytes: b, approxTokens: approxTokens(b), count: toolsVal.length };
  }

  // messages / contents / input
  const msgs: any[] =
    obj.messages ?? obj.contents ?? (Array.isArray(obj.input) ? obj.input : []);
  if (Array.isArray(msgs) && msgs.length > 0) {
    const byRole: Record<string, { count: number; bytes: number; approxTokens: number }> = {};
    const perMessage: PayloadBreakdown["parts"]["messages"]["perMessage"] = [];
    let msgsBytes = 0;
    msgs.forEach((m, idx) => {
      const role = String(m?.role ?? "unknown");
      const b = sizeOf(m);
      msgsBytes += b;
      if (!byRole[role]) byRole[role] = { count: 0, bytes: 0, approxTokens: 0 };
      byRole[role].count += 1;
      byRole[role].bytes += b;
      byRole[role].approxTokens += approxTokens(b);

      let hasToolCalls = false;
      let hasToolResult = false;
      let hasImage = false;
      let preview: string | undefined;

      const content = m?.content ?? m?.parts;
      if (Array.isArray(content)) {
        for (const c of content) {
          const t = c?.type;
          if (t === "tool_use" || t === "toolCall" || c?.toolUse || c?.functionCall) hasToolCalls = true;
          if (t === "tool_result" || t === "toolResult" || c?.functionResponse) hasToolResult = true;
          if (t === "image" || c?.inlineData?.mimeType?.startsWith?.("image/")) hasImage = true;
          if (!preview) {
            const txt = c?.text ?? c?.content ?? (typeof c === "string" ? c : undefined);
            if (typeof txt === "string") preview = txt.slice(0, 120);
          }
        }
      } else if (typeof content === "string") {
        preview = content.slice(0, 120);
      }

      perMessage.push({
        idx,
        role,
        bytes: b,
        approxTokens: approxTokens(b),
        hasToolCalls: hasToolCalls || undefined,
        hasToolResult: hasToolResult || undefined,
        hasImage: hasImage || undefined,
        preview,
      });
    });
    bd.parts.messages = {
      bytes: msgsBytes,
      approxTokens: approxTokens(msgsBytes),
      count: msgs.length,
      byRole,
      perMessage,
    };
  }

  // other (tutto ciò che non è system/tools/messages)
  const known = new Set([
    "system",
    "systemPrompt",
    "system_instruction",
    "systemInstruction",
    "instructions",
    "tools",
    "toolDeclarations",
    "tool_declarations",
    "messages",
    "contents",
    "input",
  ]);
  let otherBytes = 0;
  const otherKeys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (known.has(k)) continue;
    otherKeys.push(k);
    otherBytes += sizeOf(v);
  }
  bd.parts.other = { bytes: otherBytes, approxTokens: approxTokens(otherBytes), keys: otherKeys };

  return bd;
}

// ── Public: registrazione nell'estensione AH ─────────────────────────────

export function registerContextInspector(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    const sid = ctx.sessionManager.getSessionId() ?? "ephemeral";
    current = initSession(process.cwd(), sid);
    ctx.ui.notify(`[ah:ctx] Context Inspector attivo → ${current.dir}`, "info");
  });

  pi.on("before_provider_request", (event, _ctx) => {
    if (!current) return;
    const bd = analyzePayload(event.payload);

    current.totals.requests += 1;
    current.totals.payloadBytes += bd.totalBytes;
    current.totals.payloadApproxTokens += bd.totalApproxTokens;

    const toolsInPayload =
      (event.payload as any)?.tools ?? (event.payload as any)?.toolDeclarations ?? [];
    if (Array.isArray(toolsInPayload)) {
      for (const t of toolsInPayload) {
        const name = t?.name ?? t?.function?.name ?? t?.functionDeclarations?.[0]?.name;
        if (typeof name === "string") {
          current.totals.tools[name] = (current.totals.tools[name] ?? 0) + 1;
        }
      }
    }

    const line = {
      ts: new Date().toISOString(),
      reqIndex: current.totals.requests,
      breakdown: bd,
    };
    try {
      appendFileSync(current.reqFile, JSON.stringify(line) + "\n", "utf8");
    } catch {
      /* ignore */
    }
    persistSummary(current);
    return undefined; // osservativo: non modifichiamo il payload
  });

  pi.on("after_provider_response", (event, _ctx) => {
    if (!current) return;
    const line = {
      ts: new Date().toISOString(),
      reqIndex: current.totals.requests,
      status: event.status,
      headers: event.headers,
    };
    try {
      appendFileSync(current.resFile, JSON.stringify(line) + "\n", "utf8");
    } catch {
      /* ignore */
    }
  });

  pi.on("message_end", async (event, _ctx) => {
    if (!current) return;
    const msg: any = (event as any).message;
    if (!msg || msg.role !== "assistant") return;

    const usage = msg.usage ?? {};
    current.totals.usageInput += usage.input ?? 0;
    current.totals.usageOutput += usage.output ?? 0;
    current.totals.usageCacheRead += usage.cacheRead ?? 0;
    current.totals.usageCacheWrite += usage.cacheWrite ?? 0;
    current.totals.costTotal += usage.cost?.total ?? 0;

    const modelKey = `${msg.provider ?? "?"}/${msg.model ?? "?"}`;
    current.totals.models[modelKey] = (current.totals.models[modelKey] ?? 0) + 1;

    const line = {
      ts: new Date().toISOString(),
      provider: msg.provider,
      model: msg.model,
      stopReason: msg.stopReason,
      usage,
    };
    try {
      appendFileSync(current.usageFile, JSON.stringify(line) + "\n", "utf8");
    } catch {
      /* ignore */
    }
    persistSummary(current);
  });

  pi.on("turn_end", async () => {
    if (!current) return;
    current.totals.turns += 1;
    persistSummary(current);
  });

  // ── Context audit (declared vs loaded per-task) ──────────────────────
  // Observer-only: handlers MUST NOT return a non-undefined value (D-Q3=A).

  pi.on("tool_call", (event, _ctx) => {
    if (!current) return;
    const audit = ensureAuditForCurrentTask(process.cwd(), current);
    if (!audit) return;
    onToolCall(audit, {
      toolName: event.toolName,
      toolCallId: event.toolCallId,
      input: (event as any).input,
    });
  });

  pi.on("tool_result", (event, _ctx) => {
    if (!current) return;
    const audit = ensureAuditForCurrentTask(process.cwd(), current);
    if (!audit) return;
    onToolResult(
      audit,
      {
        toolCallId: event.toolCallId,
        content: event.content,
        isError: event.isError,
      },
      new Date().toISOString(),
    );
    persistContextAudit(current, audit);
  });

  // ── Comandi ────────────────────────────────────────────────────────

  pi.registerCommand("ah:ctx-stats", {
    description: "Context Inspector: riepilogo token/payload della sessione",
    handler: async (_args, ctx) => {
      if (!current) {
        ctx.ui.notify("Context Inspector non inizializzato", "warning");
        return;
      }
      const t = current.totals;
      const lines: string[] = [];
      lines.push("📊 Context Inspector — sessione corrente");
      lines.push(`   cartella:     ${current.dir}`);
      lines.push(`   iniziata:     ${t.startedAt}`);
      lines.push("");
      lines.push("⬆️  Upload (stime da payload JSON)");
      lines.push(`   richieste:    ${t.requests}`);
      lines.push(`   turni:        ${t.turns}`);
      lines.push(`   bytes tot:    ${fmtBytes(t.payloadBytes)}`);
      lines.push(`   ≈ token:      ${fmtN(t.payloadApproxTokens)}`);
      lines.push("");
      lines.push("⬇️  Usage autoritativa (dal provider)");
      lines.push(`   input:        ${fmtN(t.usageInput)} tok`);
      lines.push(`   output:       ${fmtN(t.usageOutput)} tok`);
      lines.push(`   cache read:   ${fmtN(t.usageCacheRead)} tok`);
      lines.push(`   cache write:  ${fmtN(t.usageCacheWrite)} tok`);
      lines.push(`   costo tot:    $${t.costTotal.toFixed(4)}`);
      lines.push("");
      const topTools = Object.entries(t.tools)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      if (topTools.length) {
        lines.push("🧰 Tool dichiarati nel payload (count req)");
        for (const [name, n] of topTools) lines.push(`   ${name.padEnd(24)} ${n}`);
        lines.push("");
      }
      const models = Object.entries(t.models);
      if (models.length) {
        lines.push("🤖 Modelli usati (count assistant msg)");
        for (const [m, n] of models) lines.push(`   ${m.padEnd(32)} ${n}`);
        lines.push("");
      }
      const audits = Object.entries(current.context);
      for (const [taskId, audit] of audits) {
        lines.push(`📚 Context audit — ${taskId}`);
        if (audit.declared === null) {
          lines.push(`   declared:    <none — no PLAN.md or no context-needed:>`);
        } else {
          const budget = audit.declaredBudgetTokens ?? 0;
          lines.push(
            `   declared:    [${audit.declared.join(", ")}]   (≈${fmtN(budget)} tok)`,
          );
        }
        const loadedNames = Object.keys(audit.loaded);
        let totalCalls = 0;
        for (const n of loadedNames) totalCalls += audit.loaded[n].calls;
        lines.push(
          `   loaded:      [${loadedNames.join(", ")}]      (≈${fmtN(audit.loadedTokens)} tok, ${totalCalls} calls)`,
        );
        const sign = audit.deltaToken >= 0 ? "+" : "";
        lines.push(`   delta_token: ${sign}${audit.deltaToken}`);
        lines.push(`   label:       ${audit.label}`);
        if (audit.errors.length > 0) {
          lines.push(`   errors:      ${audit.errors.length}`);
          for (const e of audit.errors) {
            lines.push(`     - ${e.name}: ${e.reason}`);
          }
        }
        lines.push("");
      }
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("ah:ctx-audit", {
    description: "Context Inspector: rendered per-task context audit (declared vs loaded)",
    handler: async (args, ctx) => {
      const raw = typeof args === "string" ? args.trim() : "";
      let taskId: string | null = null;
      if (raw && TASK_ID_PATTERN.test(raw)) {
        taskId = raw;
      } else {
        const detected = detectCurrentTaskLocal(process.cwd());
        if (detected && TASK_ID_PATTERN.test(detected.id)) taskId = detected.id;
      }
      if (!taskId) {
        ctx.ui.notify(renderContextAuditMarkdown(null), "info");
        return;
      }
      const auditPath = findLatestAuditForTask(process.cwd(), taskId);
      if (!auditPath) {
        ctx.ui.notify(renderContextAuditMarkdown(null), "info");
        return;
      }
      let parsed: ContextAudit;
      try {
        const raw = readFileSync(auditPath, "utf-8");
        parsed = JSON.parse(raw) as ContextAudit;
      } catch {
        ctx.ui.notify(renderContextAuditMarkdown(null), "info");
        return;
      }
      ctx.ui.notify(renderContextAuditMarkdown(parsed), "info");
    },
  });

  pi.registerCommand("ah:ctx-open", {
    description: "Context Inspector: apre la cartella della sessione",
    handler: async (_args, ctx) => {
      if (!current) {
        ctx.ui.notify("Context Inspector non inizializzato", "warning");
        return;
      }
      const opener =
        process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
      spawn(opener, [current.dir], { stdio: "ignore", detached: true }).unref();
      ctx.ui.notify(`Aperto: ${current.dir}`, "info");
    },
  });

  pi.registerCommand("ah:ctx-tail", {
    description: "Context Inspector: ultime N richieste dal log (default 1)",
    handler: async (args, ctx) => {
      if (!current) {
        ctx.ui.notify("Context Inspector non inizializzato", "warning");
        return;
      }
      const n = Math.max(1, parseInt((args ?? "1").trim(), 10) || 1);
      if (!existsSync(current.reqFile)) {
        ctx.ui.notify("Nessuna richiesta ancora loggata", "info");
        return;
      }
      const all = readFileSync(current.reqFile, "utf8").trim().split("\n");
      const tail = all.slice(-n);
      const out: string[] = [];
      for (const raw of tail) {
        try {
          const obj = JSON.parse(raw);
          const bd = obj.breakdown as PayloadBreakdown;
          out.push(
            `#${obj.reqIndex} ${obj.ts} ${bd.provider ?? "?"}/${bd.model ?? "?"}  ` +
              `tot ${fmtBytes(bd.totalBytes)} ≈${fmtN(bd.totalApproxTokens)}tok  ` +
              `sys=${fmtBytes(bd.parts.system.bytes)} tools=${fmtBytes(bd.parts.tools.bytes)}(${bd.parts.tools.count}) ` +
              `msgs=${fmtBytes(bd.parts.messages.bytes)}(${bd.parts.messages.count})`,
          );
          const roles = Object.entries(bd.parts.messages.byRole)
            .map(([r, v]) => `${r}:${v.count}/${fmtBytes(v.bytes)}`)
            .join(" ");
          if (roles) out.push(`   roles → ${roles}`);
        } catch {
          out.push(raw.slice(0, 200));
        }
      }
      ctx.ui.notify(out.join("\n"), "info");
    },
  });
}
