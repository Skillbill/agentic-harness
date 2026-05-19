import { renderBox, type Section } from "./popup-frame.js";

/**
 * Overlay used by the `alt+s` shortcut. Renders a vertical selector with
 * one row per candidate branch (default branch first, then every
 * in-progress task that has a `branch:` field in its frontmatter). The
 * dev moves the focus with ↑ / ↓, presses ENTER to choose, ESC to cancel.
 *
 * Selection result is delivered through the `done` callback (the chosen
 * `BranchItem` on enter, `null` on esc). The shortcut handler in
 * `extensions/index.ts` is then responsible for the working-tree-clean
 * check and the actual `git checkout` — keeping side effects out of the
 * component so the popup itself remains a pure view.
 */

const KEY_ESC = "\x1b";
const KEY_UP = "\x1b[A";
const KEY_DOWN = "\x1b[B";
// Most terminals send CR for Enter. Some configurations / Kitty modes
// send LF. Accept both — the cost is negligible and the alternative
// (false-negative on enter) is a confusing dead key.
const KEY_ENTER_CR = "\r";
const KEY_ENTER_LF = "\n";

export interface BranchItem {
  /** Short label shown to the dev (e.g. `main`, `T-019  Title…`). */
  label: string;
  /** The actual git branch name passed to `git checkout`. */
  branch: string;
  /** True when this branch is the currently checked-out one. */
  isCurrent: boolean;
}

export interface BranchSwitchPopupOptions {
  title: string;
  items: BranchItem[];
  done: (selected: BranchItem | null) => void;
}

export class BranchSwitchPopup {
  private idx = 0;

  constructor(private readonly opts: BranchSwitchPopupOptions) {}

  invalidate(): void {
    // Stateless — no cache to invalidate.
  }

  render(width: number): string[] {
    const { title, items } = this.opts;
    if (items.length === 0) {
      return renderBox(width, [
        { lines: [title] },
        { lines: ["No branches available."] },
        { lines: ["esc close"] },
      ]);
    }

    const listLines = items.map((item, i) => {
      const marker = i === this.idx ? "▶" : " ";
      const suffix = item.isCurrent ? "  (current)" : "";
      return `${marker} ${item.label}${suffix}`;
    });

    const selected = items[this.idx]!;
    const previewLine = selected.isCurrent
      ? `Selected: ${selected.branch}  (already checked out — enter is a no-op)`
      : `Selected: ${selected.branch}`;

    const footer = "↑/↓ select · enter switch · esc cancel";

    const sections: Section[] = [
      { lines: [title] },
      { lines: listLines },
      { lines: [previewLine] },
      { lines: [footer] },
    ];

    return renderBox(width, sections);
  }

  handleInput(data: string): void {
    const { items, done } = this.opts;
    if (data === KEY_ESC) {
      done(null);
      return;
    }
    if (items.length === 0) return;
    if (data === KEY_UP) {
      this.idx = (this.idx - 1 + items.length) % items.length;
      return;
    }
    if (data === KEY_DOWN) {
      this.idx = (this.idx + 1) % items.length;
      return;
    }
    if (data === KEY_ENTER_CR || data === KEY_ENTER_LF) {
      done(items[this.idx] ?? null);
      return;
    }
  }
}
