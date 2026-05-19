/**
 * Shared chrome for AH's TUI overlays: a Unicode-box border with one
 * horizontal divider per logical section. Used by `info-popup.ts` and
 * `task-popup.ts` so the two overlays look like siblings.
 *
 * Kept in its own file because both popups must agree on the inner
 * width budget (outer width minus left/right border + spaces).
 *
 * **Why we have our own `visibleWidth`**: PI's overlay compositor (in
 * pi-tui) measures lines by visible columns and slices anything wider
 * than the overlay width — including the right border. Padding lines
 * with `.length` arithmetic breaks for emoji like `✅` (1 code unit but
 * 2 visible cols), pushing the right `│` past the overlay edge so it
 * gets clipped. The hand-rolled `visibleWidth` below counts emoji as 2
 * cols (matches pi-tui's heuristic for our content), so padded lines
 * stay within the budget and the box stays closed.
 *
 * We deliberately do **not** import `visibleWidth` from
 * `@earendil-works/pi-tui` at runtime: pi-tui is bundled by PI as a
 * regular dependency (not exposed via AH's peer-deps), so a runtime
 * import would be fragile. Type-only imports are erased by jiti, but a
 * value import would crash AH on load if module resolution couldn't
 * walk into PI's own node_modules. The local heuristic is good enough
 * for AH's content (English prose + emoji icons + box-drawing chars).
 */

/** Number of columns consumed by the border + padding on each side. */
const INNER_PADDING = 4; // "│ " + content + " │"

const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;

/**
 * Visible width in terminal columns. Treats Emoji_Presentation graphemes
 * and non-BMP code points as 2 cols, everything else as 1.
 *
 * Iterates by code point (`for…of`) so surrogate pairs count once.
 * Box-drawing characters (U+2500–U+257F), arrows ↑/↓ (text-default), and
 * the middle dot · all stay at 1 col — exactly what we want.
 */
function visibleWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    w += EMOJI_PRESENTATION.test(ch) || cp > 0xffff ? 2 : 1;
  }
  return w;
}

export interface Section {
  /** Lines rendered inside this section. Empty strings act as blank lines. */
  lines: string[];
}

/**
 * Truncate a string to `width` visible columns. Appends `…` when clipped
 * so the dev sees that the line was longer than the popup.
 */
export function clipToWidth(line: string, width: number): string {
  let w = 0;
  let out = "";
  for (const ch of line) {
    const cw = visibleWidth(ch);
    if (w + cw > width) {
      // Replace the last placed grapheme with `…` if there's room.
      if (out.length > 0 && width >= 1) {
        // Find last grapheme width and back off until we have 1 free col.
        let trimmed = out;
        let trimmedW = w;
        while (trimmedW > 0 && trimmedW > width - 1) {
          // Pop last grapheme by code-point.
          const last = [...trimmed].pop()!;
          trimmed = trimmed.slice(0, trimmed.length - last.length);
          trimmedW -= visibleWidth(last);
        }
        return trimmed + "…";
      }
      return out;
    }
    w += cw;
    out += ch;
  }
  return out;
}

/** Right-pad with spaces so the line spans exactly `width` visible columns. */
function padRight(line: string, width: number): string {
  const w = visibleWidth(line);
  if (w >= width) return line;
  return line + " ".repeat(width - w);
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
