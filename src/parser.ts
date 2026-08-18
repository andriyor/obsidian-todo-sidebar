import type { CachedMetadata, ListItemCache } from "obsidian";

/**
 * Task extraction from Obsidian's metadata cache.
 *
 * The cache already knows which list items are tasks, their status character and
 * their parent item, and it applies Obsidian's own markdown rules — so fenced
 * code blocks, frontmatter and indentation never have to be handled here.
 *
 * The cache describes the file *on disk*, so `content` must be the saved text
 * (`Vault.cachedRead`, or the `data` argument of `metadataCache.on("changed")`).
 * Pairing cache positions with unsaved editor text would misalign line numbers.
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
	children: TaskItem[];
}

/** A run of root-level tasks that sit under the same heading. */
export interface TaskGroup {
	/** `null` for tasks that appear before the note's first heading. */
	heading: { text: string; level: number; line: number } | null;
	tasks: TaskItem[];
}

/**
 * Splits root tasks into groups by the heading they fall under.
 *
 * Groups are only created for headings that actually contain tasks, so headings
 * without checkboxes never reach the sidebar. Tasks are passed through by
 * reference, not copied, so callers can mutate them in place.
 */
export function groupByHeading(
	cache: CachedMetadata | null,
	roots: TaskItem[],
): TaskGroup[] {
	const headings = cache?.headings;
	if (!headings || headings.length === 0 || roots.length === 0) {
		return roots.length > 0 ? [{ heading: null, tasks: roots }] : [];
	}

	const groups: TaskGroup[] = [];
	let index = 0;
	// Both lists are in document order, so one pass over each is enough.
	let current: TaskGroup["heading"] = null;

	for (const task of roots) {
		while (index < headings.length && headings[index].position.start.line < task.line) {
			const heading = headings[index];
			current = {
				text: heading.heading,
				level: heading.level,
				line: heading.position.start.line,
			};
			index++;
		}

		const last = groups[groups.length - 1];
		if (last && last.heading === current) last.tasks.push(task);
		else groups.push({ heading: current, tasks: [task] });
	}

	return groups;
}

/** Builds the task tree for a note from its cached metadata. */
export function tasksFromCache(
	cache: CachedMetadata | null,
	content: string,
): TaskItem[] {
	const items = cache?.listItems;
	if (!items || items.length === 0) return [];

	const lines = content.split("\n");
	const roots: TaskItem[] = [];
	/** Every list item by its start line, tasks and plain bullets alike. */
	const itemsByLine = new Map<number, ListItemCache>();
	/** Only the items that are tasks, so ancestors can be resolved. */
	const tasksByLine = new Map<number, TaskItem>();

	for (const item of items) {
		itemsByLine.set(item.position.start.line, item);
	}

	// listItems is in document order, so parents are always seen before children.
	for (const item of items) {
		if (item.task === undefined) continue;

		const lineNumber = item.position.start.line;
		const line = lines[lineNumber];
		if (line === undefined) continue;

		// Between the bullet and the checkbox there is only whitespace, so the
		// first '[' at or after the item's start column is the task marker.
		const bracket = line.indexOf("[", Math.max(0, item.position.start.col));
		if (bracket === -1 || line[bracket + 2] !== "]") continue;

		const markerCol = bracket + 1;
		const status = line[markerCol];

		const task: TaskItem = {
			line: lineNumber,
			markerCol,
			status,
			checked: status !== " ",
			text: line.slice(bracket + 3).trim(),
			children: [],
		};

		const parent = nearestTaskAncestor(item, itemsByLine, tasksByLine);
		if (parent) parent.children.push(task);
		else roots.push(task);

		// Registered after resolving, so an item can never become its own parent.
		tasksByLine.set(lineNumber, task);
	}

	return roots;
}

/**
 * Walks up `ListItemCache.parent` to the closest ancestor that is itself a task.
 * Plain-bullet ancestors are skipped, so a task nested under a plain bullet
 * becomes a root rather than a child of an unrelated task.
 *
 * `parent` is the negative of the list's first line for root items — but a list
 * starting on line 0 gives `-0`, which is `0`, and so is indistinguishable from
 * "my parent is on line 0". Candidates are therefore also required to be
 * indented less than the item itself, which no sibling or self ever is.
 */
function nearestTaskAncestor(
	item: ListItemCache,
	itemsByLine: Map<number, ListItemCache>,
	tasksByLine: Map<number, TaskItem>,
): TaskItem | null {
	const itemCol = item.position.start.col;
	let parentLine = item.parent;
	const visited = new Set<number>();

	while (parentLine >= 0 && !visited.has(parentLine)) {
		visited.add(parentLine);

		const ancestor = itemsByLine.get(parentLine);
		if (!ancestor || ancestor.position.start.col >= itemCol) return null;

		const task = tasksByLine.get(parentLine);
		if (task) return task;

		parentLine = ancestor.parent;
	}

	return null;
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
