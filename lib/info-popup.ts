/**
 * Single-page overlay used by `/ah:help` (and any future read-only popup
 * that just needs to dump text and exit on ESC).
 *
 * Sibling of `lib/task-popup.ts`: same duck-typed `Component` shape, same
 * "no `@earendil-works/pi-tui` runtime import" trick (we match ESC from
 * its raw ANSI byte). The difference is that `InfoPopup` has no
 * navigation — it's static text + an ESC closer.
 *
 * Body is truncated to `MAX_BODY_LINES` so a future caller that passes a
 * huge string doesn't blow the overlay; the title and footer are always
 * rendered.
 */

const KEY_ESC = "\x1b";

const MAX_BODY_LINES = 120;

export interface InfoPopupOptions {
  /** First line of the popup (e.g. "🆘 AH help"). */
  title: string;
  /** Optional second-row subtitle (e.g. "agentic-harness v0.13.0"). */
  subtitle?: string;
  /** Body — array of pre-rendered lines (empty strings are valid spacers). */
  lines: string[];
  /** Footer hint shown below the bottom separator. */
  footer?: string;
  /** Called when the dev presses ESC. */
  done: (closed: true) => void;
}

export class InfoPopup {
  constructor(private readonly opts: InfoPopupOptions) {}

  invalidate(): void {
    // Stateless rendering — nothing to invalidate.
  }

  render(width: number): string[] {
    const { title, subtitle, lines, footer } = this.opts;
    const sepWidth = Math.max(10, Math.min(width, 100));
    const sep = "─".repeat(sepWidth);

    const body =
      lines.length > MAX_BODY_LINES
        ? [
            ...lines.slice(0, MAX_BODY_LINES),
            "",
            `… ${lines.length - MAX_BODY_LINES} more line(s) truncated`,
          ]
        : lines;

    const out: string[] = [];
    out.push(clipToWidth(title, width));
    if (subtitle) out.push(clipToWidth(subtitle, width));
    out.push(sep);
    for (const line of body) out.push(clipToWidth(line, width));
    out.push(sep);
    out.push(clipToWidth(footer ?? "esc close", width));
    return out;
  }

  handleInput(data: string): void {
    if (data === KEY_ESC) this.opts.done(true);
  }
}

function clipToWidth(line: string, width: number): string {
  if (line.length <= width) return line;
  if (width <= 1) return line.slice(0, width);
  return `${line.slice(0, Math.max(0, width - 1))}…`;
}
