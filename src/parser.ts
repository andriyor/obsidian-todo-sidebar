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

		tasksByLine.set(lineNumber, task);

		const parent = nearestTaskAncestor(item, itemsByLine, tasksByLine);
		if (parent) parent.children.push(task);
		else roots.push(task);
	}

	return roots;
}

/**
 * Walks up `ListItemCache.parent` to the closest ancestor that is itself a task.
 * Plain-bullet ancestors are skipped, so a task nested under a plain bullet
 * becomes a root rather than a child of an unrelated task. `parent` is negative
 * for items at the root of a list.
 */
function nearestTaskAncestor(
	item: ListItemCache,
	itemsByLine: Map<number, ListItemCache>,
	tasksByLine: Map<number, TaskItem>,
): TaskItem | null {
	let parentLine = item.parent;
	const visited = new Set<number>();

	while (parentLine >= 0 && !visited.has(parentLine)) {
		visited.add(parentLine);

		const task = tasksByLine.get(parentLine);
		if (task) return task;

		const ancestor = itemsByLine.get(parentLine);
		if (!ancestor) return null;
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
