export const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function parseContextNeeded(planMd) {
  const fmMatch = planMd.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { ok: false, reason: "no frontmatter block" };
  const body = fmMatch[1];

  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^context-needed:\s*(.*)$/);
    if (!m) continue;
    const rest = m[1].trim();

    if (rest.startsWith("[") && rest.endsWith("]")) {
      const inner = rest.slice(1, -1).trim();
      if (inner.length === 0) return { ok: true, stems: [] };
      const stems = inner
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return { ok: true, stems };
    }

    if (rest.length === 0) {
      const stems = [];
      for (let j = i + 1; j < lines.length; j++) {
        const item = lines[j].match(/^\s*-\s+(.+?)\s*$/);
        if (!item) break;
        stems.push(item[1]);
      }
      return { ok: true, stems };
    }

    return { ok: false, reason: `unrecognized context-needed value: ${rest}` };
  }
  return { ok: false, reason: "context-needed key not present" };
}
