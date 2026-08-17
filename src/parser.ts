/**
 * Markdown checkbox parsing.
 *
 * We parse the note text ourselves rather than reading `metadataCache.listItems`
 * so the sidebar can update from unsaved editor content, which the cache does
 * not see until Obsidian re-indexes the file.
 */

export interface TaskItem {
	/** 0-based line number in the note. */
	line: number;
	/** Column of the status character between the brackets. */
	markerCol: number;
	/** Raw character between the brackets: ' ' for open, anything else for done. */
	status: string;
	checked: boolean;
	/** Markdown source of the task text (everything after `[x] `). */
	text: string;
	/** Visual indent width of the line, tabs expanded. */
	indent: number;
	children: TaskItem[];
}

/** `- [ ] text`, `* [x] text`, `1. [-] text`, … */
const TASK_RE = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)\[(.)\](?:[ \t]+(.*))?$/;
/** Any list item, task or not — used to keep the indent stack sane. */
const LIST_RE = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+/;
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})/;

const TAB_WIDTH = 4;

function indentWidth(whitespace: string): number {
	let width = 0;
	for (const ch of whitespace) {
		width += ch === "\t" ? TAB_WIDTH - (width % TAB_WIDTH) : 1;
	}
	return width;
}

function popTo(stack: { indent: number; item: TaskItem | null }[], indent: number): void {
	while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
		stack.pop();
	}
}

/**
 * Extracts every checkbox in `content` as a tree, nested by indentation.
 * Frontmatter and fenced code blocks are skipped.
 */
export function parseTasks(content: string): TaskItem[] {
	const lines = content.split("\n");
	const roots: TaskItem[] = [];
	// Every enclosing list item, tasks and plain bullets alike. Plain bullets are
	// tracked as `null` so a task nested under one is not mistakenly attached to
	// an unrelated task that happens to sit at a shallower indent.
	const stack: { indent: number; item: TaskItem | null }[] = [];

	let start = 0;
	// Skip YAML frontmatter.
	if (lines[0]?.trim() === "---") {
		for (let i = 1; i < lines.length; i++) {
			const trimmed = lines[i].trim();
			if (trimmed === "---" || trimmed === "...") {
				start = i + 1;
				break;
			}
		}
	}

	let fence: string | null = null;

	for (let i = start; i < lines.length; i++) {
		const line = lines[i].replace(/\r$/, "");

		const fenceMatch = FENCE_RE.exec(line);
		if (fence !== null) {
			// Inside a code block: only a matching closing fence is interesting.
			if (
				fenceMatch &&
				fenceMatch[1][0] === fence[0] &&
				fenceMatch[1].length >= fence.length &&
				line.slice(fenceMatch[0].length).trim() === ""
			) {
				fence = null;
			}
			continue;
		}
		if (fenceMatch) {
			fence = fenceMatch[1];
			continue;
		}

		const task = TASK_RE.exec(line);
		if (task) {
			const [, whitespace, bullet, gap, status, text] = task;
			const indent = indentWidth(whitespace);
			popTo(stack, indent);

			const item: TaskItem = {
				line: i,
				markerCol: whitespace.length + bullet.length + gap.length + 1,
				status,
				checked: status !== " ",
				text: (text ?? "").trim(),
				indent,
				children: [],
			};

			// Nearest enclosing task, if any; plain-bullet ancestors are skipped.
			let parent: TaskItem | null = null;
			for (let s = stack.length - 1; s >= 0; s--) {
				if (stack[s].item) {
					parent = stack[s].item;
					break;
				}
			}

			if (parent) parent.children.push(item);
			else roots.push(item);

			stack.push({ indent, item });
			continue;
		}

		const list = LIST_RE.exec(line);
		if (list) {
			const indent = indentWidth(list[1]);
			popTo(stack, indent);
			stack.push({ indent, item: null });
			continue;
		}

		// A non-list, non-blank line at the left margin ends the current list,
		// so following tasks are not nested under the previous section's tasks.
		if (line.trim() !== "" && !/^[ \t]/.test(line)) {
			stack.length = 0;
		}
	}

	return roots;
}

export function countTasks(tasks: TaskItem[]): { total: number; done: number } {
	let total = 0;
	let done = 0;
	const walk = (items: TaskItem[]) => {
		for (const item of items) {
			total++;
			if (item.checked) done++;
			walk(item.children);
		}
	};
	walk(tasks);
	return { total, done };
}

/** Drops completed tasks, keeping any that still have an open descendant. */
export function filterCompleted(tasks: TaskItem[]): TaskItem[] {
	const result: TaskItem[] = [];
	for (const item of tasks) {
		const children = filterCompleted(item.children);
		if (!item.checked || children.length > 0) {
			result.push({ ...item, children });
		}
	}
	return result;
}
