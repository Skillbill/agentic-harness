import { renderBox, type Section } from "./popup-frame.js";

/**
 * Overlay used by `/ah:help` and the `alt+h` shortcut. Renders three
 * sections — a static prelude (shortcuts + docs), a selectable list of
 * AH slash commands, and a footer. The dev moves the focus inside the
 * command list with ↑ / ↓, presses ENTER to pick, ESC to close.
 *
 * Sibling of `lib/branch-switch-popup.ts`: same duck-typed `Component`
 * shape, same raw-byte ESC handling, same "view is side-effect-free"
 * posture. The selection result is delivered through the `done`
 * callback — the shortcut handler in `extensions/index.ts` decides what
 * to do with the chosen command (currently: prefill the editor with
 * `/<name> ` and let the dev append arguments before submitting).
 */

const KEY_ESC = "\x1b";
const KEY_UP = "\x1b[A";
const KEY_DOWN = "\x1b[B";
const KEY_ENTER_CR = "\r";
const KEY_ENTER_LF = "\n";

export interface HelpCommand {
  /** Slash command name without the leading `/` (e.g. `ah:task-new`). */
  name: string;
  description?: string;
}

export interface HelpPopupOptions {
  title: string;
  /** Static lines rendered above the selectable list (shortcuts + docs). */
  prelude: string[];
  /** Heading rendered immediately above the selectable list. */
  commandsHeading: string;
  /** Selectable AH commands — ENTER returns the focused one via `done`. */
  commands: HelpCommand[];
  /** Footer hint shown below the bottom divider. */
  footer?: string;
  done: (selected: HelpCommand | null) => void;
}

const NAME_COL = 22;

export class HelpPopup {
  private idx = 0;

  constructor(private readonly opts: HelpPopupOptions) {}

  invalidate(): void {
    // Stateless rendering — nothing to invalidate.
  }

  render(width: number): string[] {
    const { title, prelude, commandsHeading, commands, footer } = this.opts;

    const cmdLines: string[] = [commandsHeading];
    if (commands.length === 0) {
      cmdLines.push("  (none registered)");
    } else {
      for (let i = 0; i < commands.length; i++) {
        const c = commands[i]!;
        const marker = i === this.idx ? "▶" : " ";
        const pad = "".padEnd(Math.max(1, NAME_COL - c.name.length), " ");
        cmdLines.push(
          `${marker} /${c.name}${pad} ${c.description ?? ""}`.trimEnd(),
        );
      }
    }

    const sections: Section[] = [
      { lines: [title] },
      { lines: prelude },
      { lines: cmdLines },
      { lines: [footer ?? "↑/↓ select · enter run · esc close"] },
    ];

    return renderBox(width, sections);
  }

  handleInput(data: string): void {
    const { commands, done } = this.opts;
    if (data === KEY_ESC) {
      done(null);
      return;
    }
    if (commands.length === 0) return;
    if (data === KEY_UP) {
      this.idx = (this.idx - 1 + commands.length) % commands.length;
      return;
    }
    if (data === KEY_DOWN) {
      this.idx = (this.idx + 1) % commands.length;
      return;
    }
    if (data === KEY_ENTER_CR || data === KEY_ENTER_LF) {
      done(commands[this.idx] ?? null);
      return;
    }
  }
}
