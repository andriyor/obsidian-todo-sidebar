import { strict as assert } from "node:assert";
import test from "node:test";
import type { CachedMetadata, ListItemCache, Pos } from "obsidian";
import { countTasks, groupByHeading, tasksFromCache } from "../src/parser.ts";

/**
 * Builds the parts of Obsidian's cache that the parser reads, from markdown.
 *
 * `parent` follows Obsidian's contract: the parent item's line number, or the
 * negative of the list's first line for a root item — including the `-0` that
 * a list starting on line 0 produces.
 */
function cacheFor(md: string): CachedMetadata {
	const headings: NonNullable<CachedMetadata["headings"]> = [];
	const listItems: ListItemCache[] = [];
	/** Open ancestors of the current item, outermost first. */
	const stack: { col: number; line: number }[] = [];
	let listStart = -1;

	md.split("\n").forEach((text, line) => {
		const heading = /^(#+) (.*)$/.exec(text);
		if (heading) {
			headings.push({
				heading: heading[2],
				level: heading[1].length,
				position: pos(line, 0, text.length),
			});
			stack.length = 0;
			listStart = -1;
			return;
		}

		const bullet = /^(\s*)- (\[(.)\] )?/.exec(text);
		if (!bullet) {
			if (text.trim() === "") {
				stack.length = 0;
				listStart = -1;
			}
			return;
		}

		const col = bullet[1].length;
		if (listStart === -1) listStart = line;
		while (stack.length > 0 && stack[stack.length - 1].col >= col) stack.pop();

		listItems.push({
			parent: stack.length > 0 ? stack[stack.length - 1].line : -listStart,
			task: bullet[3],
			position: pos(line, col, text.length),
		});
		stack.push({ col, line });
	});

	return { headings, listItems };
}

function pos(line: number, col: number, endCol: number): Pos {
	return {
		start: { line, col, offset: 0 },
		end: { line, col: endCol, offset: 0 },
	};
}

const NOTE = [
	"# Alpha", // 0
	"- [ ] one", // 1
	"\t- [x] two", // 2
	"- plain bullet", // 3
	"\t- [ ] three", // 4
	"## Empty", // 5
	"nothing to check here", // 6
	"## Beta", // 7
	"- [x] four", // 8
].join("\n");

test("nests child tasks and skips plain-bullet ancestors", () => {
	const roots = tasksFromCache(cacheFor(NOTE), NOTE);

	// `three` hangs off a plain bullet, so it is a root rather than a child of `one`.
	assert.deepEqual(
		roots.map((t) => t.text),
		["one", "three", "four"],
	);
	assert.deepEqual(
		roots[0].children.map((t) => t.text),
		["two"],
	);
	assert.equal(roots[1].children.length, 0);
	assert.deepEqual(countTasks(roots), { total: 4, done: 2 });
});

test("groups by heading and drops headings without tasks", () => {
	const cache = cacheFor(NOTE);
	const groups = groupByHeading(cache, tasksFromCache(cache, NOTE));

	// `## Empty` contains no checkboxes, so it never reaches the sidebar.
	assert.deepEqual(
		groups.map((g) => [g.heading?.text, g.tasks.map((t) => t.text)]),
		[
			["Alpha", ["one", "three"]],
			["Beta", ["four"]],
		],
	);
});

test("a list starting on line 0 keeps its root and child", () => {
	// `parent` is -0 here, which is 0 — indistinguishable from "parent on line 0".
	const md = "- [ ] root\n\t- [ ] child";
	const roots = tasksFromCache(cacheFor(md), md);

	assert.deepEqual(
		roots.map((t) => t.text),
		["root"],
	);
	assert.deepEqual(
		roots[0].children.map((t) => t.text),
		["child"],
	);
});

test("reads the status character and its column", () => {
	const md = "  - [/] partly done **bold**";
	const [task] = tasksFromCache(cacheFor(md), md);

	assert.equal(task.status, "/");
	assert.equal(task.checked, true);
	assert.equal(md[task.markerCol], "/");
	assert.equal(task.text, "partly done **bold**");
});

test("tasks before the first heading land in a null group", () => {
	const md = "- [ ] loose\n\n# Later\n\n- [ ] under";
	const cache = cacheFor(md);
	const groups = groupByHeading(cache, tasksFromCache(cache, md));

	assert.deepEqual(
		groups.map((g) => [g.heading?.text ?? null, g.tasks.map((t) => t.text)]),
		[
			[null, ["loose"]],
			["Later", ["under"]],
		],
	);
});
