import { renderBox, type Section } from "./popup-frame.js";

/**
 * Single-page overlay used by `/ah:help` (and any future read-only popup
 * that just needs to dump text and exit on ESC).
 *
 * Sibling of `lib/task-popup.ts`: same duck-typed `Component` shape, same
 * "no `@earendil-works/pi-tui` runtime import" trick (we match ESC from
 * its raw ANSI byte). Difference: no navigation.
 *
 * The body is truncated to `MAX_BODY_LINES` so a future caller that
 * hands in a huge string doesn't blow the overlay; the title and footer
 * always render.
 */

const KEY_ESC = "\x1b";

const MAX_BODY_LINES = 120;

export interface InfoPopupOptions {
  /** First line of the popup (e.g. "🆘 AH help"). */
  title: string;
  /** Body — array of pre-rendered lines (empty strings are valid spacers). */
  lines: string[];
  /** Footer hint shown below the bottom divider. */
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
    const { title, lines, footer } = this.opts;
    const body =
      lines.length > MAX_BODY_LINES
        ? [
            ...lines.slice(0, MAX_BODY_LINES),
            "",
            `… ${lines.length - MAX_BODY_LINES} more line(s) truncated`,
          ]
        : lines;

    const sections: Section[] = [
      { lines: [title] },
      { lines: body },
      { lines: [footer ?? "esc close"] },
    ];

    return renderBox(width, sections);
  }

  handleInput(data: string): void {
    if (data === KEY_ESC) this.opts.done(true);
  }
}
