import { renderBox, type Section } from "./popup-frame.js";
import type { TaskInfo } from "./show-task.js";

/**
 * Overlay component used by the keyboard shortcuts that surface a
 * bucket's tasks (alt+p / alt+k / alt+c). Shows the full TASK.md body
 * of the focused task, truncated to a maximum number of lines, and
 * lets the dev cycle with ↑/↓ and dismiss with ESC.
 *
 * Implements the minimal `Component` shape declared by
 * `@earendil-works/pi-tui` (render / handleInput / invalidate). Key
 * matching is done from raw ANSI bytes so AH stays free of a runtime
 * pi-tui dependency.
 */

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
      return renderBox(width, [
        { lines: [`${title} — no tasks`] },
        { lines: ["esc close"] },
      ]);
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
    if (bodyLines.length > MAX_BODY_LINES) {
      body = [
        ...bodyLines.slice(0, MAX_BODY_LINES),
        "",
        `… ${bodyLines.length - MAX_BODY_LINES} more line(s) truncated — open ${task.relPath} for full text`,
      ];
    } else {
      body = bodyLines;
    }

    const sections: Section[] = [
      { lines: [titleLine, metaLine] },
      { lines: body },
      { lines: [footer] },
    ];

    return renderBox(width, sections);
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
