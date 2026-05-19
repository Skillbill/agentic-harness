import type { TaskInfo } from "./show-task.js";

/**
 * Overlay component used by the three keyboard shortcuts that surface
 * a bucket's tasks (alt+p / alt+k / alt+c). The component renders the
 * full TASK.md body of the focused task, truncated to a maximum number
 * of lines, and lets the dev cycle with ↑/↓ and dismiss with ESC.
 *
 * Implements the minimal `Component` shape declared by
 * `@earendil-works/pi-tui` — render(width) → string[] + handleInput +
 * invalidate. We hand-roll the key matching from raw escape byte
 * sequences so AH doesn't need a runtime import of pi-tui (it isn't in
 * AH's peerDependencies; PI bundles it but module resolution from an
 * extension loaded via jiti is fragile). The trade-off: we only
 * recognize ESC / ↑ / ↓ in standard mode. That's all the popup needs.
 */

// Standard ANSI sequences emitted by most terminals (xterm, modern
// terminals in non-Kitty-protocol mode). Kitty's CSI-u mode emits
// different sequences but ↑/↓/ESC remain compatible in practice.
const KEY_ESC = "\x1b";
const KEY_UP = "\x1b[A";
const KEY_DOWN = "\x1b[B";

const MAX_BODY_LINES = 30;

const PRIORITY_BADGE: Record<string, string> = {
  IMMEDIATE: "!!",
  HIGH: "^ ",
  NORMAL: " ·",
  LOW: "v ",
};

export interface TaskPopupOptions {
  /** Section title shown on the first line (e.g. "📋 In progress"). */
  title: string;
  tasks: TaskInfo[];
  /** Called with the popup result when the dev closes it. */
  done: (closed: true) => void;
}

export class TaskPopup {
  private idx = 0;

  constructor(private readonly opts: TaskPopupOptions) {}

  invalidate(): void {
    // Stateless rendering — nothing to invalidate.
  }

  render(width: number): string[] {
    const { title, tasks } = this.opts;
    if (tasks.length === 0) {
      return [
        `${title} — no tasks`,
        "",
        "esc to close",
      ];
    }

    const task = tasks[this.idx]!;
    const counter = `[${this.idx + 1}/${tasks.length}]`;
    const badge = PRIORITY_BADGE[task.priority] ?? " ·";
    const titleLine = `${title}  ${counter}  [${badge}] ${task.id} — ${task.title}`;
    const metaLine = task.updated
      ? `priority: ${task.priority}  ·  updated ${task.updated}  ·  ${task.relPath}`
      : `priority: ${task.priority}  ·  ${task.relPath}`;
    const footer = "↑/↓ navigate · esc close";

    const bodyLines = task.content.replace(/\r\n/g, "\n").split("\n");
    let body: string[];
    let truncatedNote: string | null = null;
    if (bodyLines.length > MAX_BODY_LINES) {
      body = bodyLines.slice(0, MAX_BODY_LINES);
      truncatedNote = `… ${bodyLines.length - MAX_BODY_LINES} more line(s) truncated — open ${task.relPath} for full text`;
    } else {
      body = bodyLines;
    }

    const sepWidth = Math.max(10, Math.min(width, 100));
    const sep = "─".repeat(sepWidth);

    const lines: string[] = [];
    lines.push(clipToWidth(titleLine, width));
    lines.push(clipToWidth(metaLine, width));
    lines.push(sep);
    for (const line of body) lines.push(clipToWidth(line, width));
    if (truncatedNote) {
      lines.push("");
      lines.push(clipToWidth(truncatedNote, width));
    }
    lines.push(sep);
    lines.push(clipToWidth(footer, width));
    return lines;
  }

  handleInput(data: string): void {
    const { tasks, done } = this.opts;
    if (data === KEY_ESC) {
      done(true);
      return;
    }
    if (data === KEY_UP) {
      if (tasks.length > 0) {
        this.idx = (this.idx - 1 + tasks.length) % tasks.length;
      }
      return;
    }
    if (data === KEY_DOWN) {
      if (tasks.length > 0) {
        this.idx = (this.idx + 1) % tasks.length;
      }
      return;
    }
  }
}

/**
 * Truncate a string to `width` columns, appending an ellipsis when the
 * line is clipped. Counts code units (not Unicode graphemes) — good
 * enough for ASCII / Latin content; emoji-heavy titles may be off by a
 * column but won't overflow the overlay.
 */
function clipToWidth(line: string, width: number): string {
  if (line.length <= width) return line;
  if (width <= 1) return line.slice(0, width);
  return `${line.slice(0, Math.max(0, width - 1))}…`;
}
