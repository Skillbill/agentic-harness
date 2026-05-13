import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

export interface CodebaseIndexEntry {
  relPath: string;
  summary: string;
}

export interface CodebaseIndex {
  entries: CodebaseIndexEntry[];
  messageContent: string;
  approxTokens: number;
}

function collectMarkdownFiles(dir: string, baseDir?: string): { relPath: string; content: string }[] {
  if (!existsSync(dir)) return [];
  const base = baseDir ?? dir;
  const results: { relPath: string; content: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath, base));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push({
        relPath: relative(base, fullPath),
        content: readFileSync(fullPath, "utf-8"),
      });
    }
  }
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function deriveSummary(content: string): string {
  const lines = content.split(/\r?\n/);
  let headerCandidate: string | undefined;
  let bodyCandidate: string | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      if (!headerCandidate) {
        headerCandidate = line.replace(/^#+\s*/, "").trim();
      }
      continue;
    }
    if (!bodyCandidate) {
      bodyCandidate = line;
    }
    if (headerCandidate && bodyCandidate) break;
  }

  const picked = headerCandidate ?? bodyCandidate ?? "";
  return picked.length > 120 ? picked.slice(0, 117) + "..." : picked;
}

export function buildCodebaseIndex(codebaseDir: string): CodebaseIndex {
  const files = collectMarkdownFiles(codebaseDir);
  const entries: CodebaseIndexEntry[] = files.map((f) => ({
    relPath: f.relPath,
    summary: deriveSummary(f.content),
  }));

  const lines: string[] = [
    "## 📚 Project Codebase Index",
    "",
    "The following documents live under `.pi/codebase/`. Each entry is `<path>: <one-line summary>`.",
    "",
  ];
  for (const e of entries) {
    lines.push(`- ${e.relPath}: ${e.summary}`);
  }
  lines.push(
    "",
    'To read the full content of a codebase document, call the tool `load_codebase_doc({ name: "<filename-without-.md>" })`. Do not read `.pi/codebase/*.md` directly with the `read` tool.',
  );

  const messageContent = lines.join("\n");
  const approxTokens = Math.round(messageContent.length / 4);
  return { entries, messageContent, approxTokens };
}
