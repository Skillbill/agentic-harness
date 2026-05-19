/**
 * Shared chrome for AH's TUI overlays: a Unicode-box border with one
 * horizontal divider per logical section. Used by `info-popup.ts` and
 * `task-popup.ts` so the two overlays look like siblings.
 *
 * Kept in its own file because both popups must agree on the inner
 * width budget (outer width minus left/right border + spaces). If you
 * ever change `INNER_PADDING` here, both popups update automatically.
 */

/** Number of columns consumed by the border + padding on each side. */
const INNER_PADDING = 4; // "│ " + content + " │"

export interface Section {
  /** Lines rendered inside this section. Empty strings act as blank lines. */
  lines: string[];
}

/**
 * Truncate a string to `width` columns. Appends `…` when clipped (so the
 * dev sees that the line was longer than the popup). Counts code units —
 * good enough for ASCII / Latin content; emoji-heavy lines may be off by
 * a column but won't overflow the border.
 */
export function clipToWidth(line: string, width: number): string {
  if (line.length <= width) return line;
  if (width <= 1) return line.slice(0, width);
  return `${line.slice(0, Math.max(0, width - 1))}…`;
}

/** Right-pad with spaces so the line spans exactly `width` columns. */
function padRight(line: string, width: number): string {
  if (line.length >= width) return line;
  return line + " ".repeat(width - line.length);
}

/**
 * Render one or more sections wrapped in a Unicode-box frame.
 *
 * Layout (for two sections):
 *
 *     ┌─ … ─┐
 *     │ a   │
 *     │ b   │
 *     ├─ … ─┤
 *     │ c   │
 *     └─ … ─┘
 */
export function renderBox(outerWidth: number, sections: Section[]): string[] {
  const w = Math.max(INNER_PADDING + 2, outerWidth);
  const inner = w - INNER_PADDING;
  const top = `┌${"─".repeat(w - 2)}┐`;
  const mid = `├${"─".repeat(w - 2)}┤`;
  const bot = `└${"─".repeat(w - 2)}┘`;

  const out: string[] = [top];
  for (let i = 0; i < sections.length; i++) {
    if (i > 0) out.push(mid);
    for (const raw of sections[i]!.lines) {
      const clipped = clipToWidth(raw, inner);
      out.push(`│ ${padRight(clipped, inner)} │`);
    }
  }
  out.push(bot);
  return out;
}
