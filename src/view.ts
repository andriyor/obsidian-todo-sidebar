import {
	ItemView,
	MarkdownRenderer,
	MarkdownView,
	TFile,
	WorkspaceLeaf,
	debounce,
	setIcon,
} from "obsidian";
import {
	TaskGroup,
	TaskItem,
	countTasks,
	groupByHeading,
	tasksFromCache,
} from "./parser";
import type TodoSidebarPlugin from "./main";

export const VIEW_TYPE_TODO_SIDEBAR = "todo-sidebar-view";

export class TodoSidebarView extends ItemView {
	private plugin: TodoSidebarPlugin;
	private titleEl!: HTMLElement;
	private progressEl!: HTMLElement;
	private progressBarEl!: HTMLElement;
	private progressFillEl!: HTMLElement;
	private bodyEl!: HTMLElement;
	private toggleCompletedEl!: HTMLElement;

	/** Guards against an older async render overwriting a newer one. */
	private renderToken = 0;
	/** Last task tree built from the cache, kept so a toggle can redraw at once. */
	private tasks: TaskItem[] = [];
	/** The same tasks, partitioned by heading. Shares TaskItem references. */
	private groups: TaskGroup[] = [];
	private file: TFile | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TodoSidebarPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_TODO_SIDEBAR;
	}

	getDisplayText(): string {
		return "Note tasks";
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("todo-sidebar");

		const headerEl = this.contentEl.createDiv({ cls: "todo-sidebar-header" });
		const titleRow = headerEl.createDiv({ cls: "todo-sidebar-title-row" });
		this.titleEl = titleRow.createDiv({ cls: "todo-sidebar-title" });
		this.progressEl = titleRow.createDiv({ cls: "todo-sidebar-count" });

		this.toggleCompletedEl = titleRow.createDiv({
			cls: "clickable-icon todo-sidebar-action",
		});
		this.toggleCompletedEl.addEventListener("click", async () => {
			this.plugin.settings.hideCompleted = !this.plugin.settings.hideCompleted;
			await this.plugin.saveSettings();
			this.updateHideCompletedIcon();
			await this.repaint();
		});

		this.progressBarEl = headerEl.createDiv({ cls: "todo-sidebar-progress" });
		this.progressFillEl = this.progressBarEl.createDiv({
			cls: "todo-sidebar-progress-fill",
		});

		this.bodyEl = this.contentEl.createDiv({ cls: "todo-sidebar-body" });

		this.registerEvent(
			this.app.workspace.on("file-open", () => this.requestRender()),
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				// Focusing the sidebar itself does not change which note we show.
				if (leaf === this.leaf) return;
				this.requestRender();
			}),
		);
		// Fires after Obsidian re-indexes a saved file, which is what the task
		// list is built from.
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (file.path === this.app.workspace.getActiveFile()?.path) {
					this.requestRender();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", () => this.requestRender()),
		);

		await this.render();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	requestRender = debounce(() => void this.render(), 250, true);

	async render(): Promise<void> {
		const token = ++this.renderToken;
		const file = this.app.workspace.getActiveFile();
		this.updateHideCompletedIcon();

		if (!file || file.extension !== "md") {
			this.tasks = [];
			this.groups = [];
			this.file = null;
			this.titleEl.setText("No note open");
			this.progressEl.setText("");
			this.setProgress(0, 0);
			this.renderEmpty("Open a markdown note to see its checkboxes.");
			return;
		}

		this.titleEl.setText(file.basename);

		// Read the saved text, not the editor buffer: cache positions describe
		// the file on disk and would not line up with unsaved edits.
		const content = await this.app.vault.cachedRead(file);
		if (token !== this.renderToken) return;

		const cache = this.app.metadataCache.getFileCache(file);
		this.tasks = tasksFromCache(cache, content);
		this.groups = groupByHeading(cache, this.tasks);
		this.file = file;
		await this.paint(token);
	}

	/**
	 * Redraws from the task tree already in memory. Used after a toggle so the
	 * panel reacts immediately, before the metadata cache catches up.
	 */
	private async repaint(): Promise<void> {
		await this.paint(++this.renderToken);
	}

	private async paint(token: number): Promise<void> {
		const file = this.file;
		if (!file) return;

		const { total, done } = countTasks(this.tasks);
		this.progressEl.setText(total > 0 ? `${done}/${total}` : "");
		this.setProgress(done, total);

		if (total === 0) {
			this.renderEmpty("This note has no checkboxes.");
			return;
		}

		const groups = this.plugin.settings.groupByHeading
			? this.groups
			: [{ heading: null, tasks: this.tasks }];

		// Build off-DOM and swap in once markdown rendering settles, to avoid flicker.
		const container = createDiv({ cls: "todo-sidebar-groups" });
		const pending: Promise<void>[] = [];
		let shown = 0;

		for (const group of groups) {
			// A group whose tasks are all hidden leaves no heading behind.
			const visible = group.tasks.filter((task) => this.isVisible(task));
			if (visible.length === 0) continue;
			shown += visible.length;

			if (group.heading) this.renderGroupHeading(container, group, file);
			const list = container.createEl("ul", {
				cls: "todo-sidebar-list todo-sidebar-list-root",
			});
			this.renderTasks(visible, list, file, pending);
		}

		if (shown === 0) {
			this.renderEmpty("All tasks are done. 🎉");
			return;
		}

		await Promise.all(pending);
		if (token !== this.renderToken) return;

		const scrollTop = this.bodyEl.scrollTop;
		this.bodyEl.empty();
		this.bodyEl.appendChild(container);
		this.bodyEl.scrollTop = scrollTop;
	}

	private renderGroupHeading(
		parentEl: HTMLElement,
		group: TaskGroup,
		file: TFile,
	): void {
		const heading = group.heading;
		if (!heading) return;

		const row = parentEl.createDiv({ cls: "todo-sidebar-group" });
		// Levels are not indented — two hierarchies in one narrow pane read badly —
		// but expose the level so themes and CSS snippets can style it.
		row.setAttribute("data-level", String(heading.level));
		row.createSpan({ cls: "todo-sidebar-group-name", text: heading.text });

		const { total, done } = countTasks(group.tasks);
		row.createSpan({ cls: "todo-sidebar-group-count", text: `${done}/${total}` });

		row.setAttribute("aria-label", `Line ${heading.line + 1}`);
		row.addEventListener("click", () => void this.jumpToLine(file, heading.line));
	}

	/** Hidden only when "hide completed" is on and nothing below it is still open. */
	private isVisible(task: TaskItem): boolean {
		if (!this.plugin.settings.hideCompleted || !task.checked) return true;
		return task.children.some((child) => this.isVisible(child));
	}

	private updateHideCompletedIcon(): void {
		const hiding = this.plugin.settings.hideCompleted;
		setIcon(this.toggleCompletedEl, hiding ? "eye-off" : "eye");
		this.toggleCompletedEl.setAttribute(
			"aria-label",
			hiding ? "Show completed tasks" : "Hide completed tasks",
		);
	}

	private renderEmpty(message: string): void {
		this.bodyEl.empty();
		this.bodyEl.createDiv({ cls: "todo-sidebar-empty", text: message });
	}

	private setProgress(done: number, total: number): void {
		this.progressBarEl.toggleClass("is-hidden", total === 0);
		this.progressFillEl.style.width = `${total > 0 ? (done / total) * 100 : 0}%`;
	}

	private renderTasks(
		tasks: TaskItem[],
		parentEl: HTMLElement,
		file: TFile,
		pending: Promise<void>[],
	): void {
		for (const task of tasks) {
			const li = parentEl.createEl("li", { cls: "todo-sidebar-item" });
			li.toggleClass("is-checked", task.checked);

			const row = li.createDiv({ cls: "todo-sidebar-row" });

			const checkbox = row.createEl("input", {
				cls: "task-list-item-checkbox",
				type: "checkbox",
			});
			checkbox.checked = task.checked;
			if (task.checked && task.status !== "x" && task.status !== "X") {
				checkbox.setAttribute("data-task", task.status);
			}
			checkbox.addEventListener("click", (event) => {
				event.stopPropagation();
				void this.toggleTask(file, task);
			});

			const textEl = row.createSpan({ cls: "todo-sidebar-text" });
			if (task.text === "") {
				textEl.addClass("todo-sidebar-text-empty");
				textEl.setText("(empty task)");
			} else {
				// The `<p>` MarkdownRenderer wraps inline content in is flattened by
				// `.todo-sidebar-text p { display: inline }` in styles.css.
				pending.push(
					MarkdownRenderer.render(this.app, task.text, textEl, file.path, this),
				);
			}

			textEl.setAttribute("aria-label", `Line ${task.line + 1}`);
			row.addEventListener("click", (event) => {
				// Let links inside the task text behave normally.
				if ((event.target as HTMLElement).closest("a")) return;
				void this.jumpToLine(file, task.line);
			});

			const children = task.children.filter((child) => this.isVisible(child));
			if (children.length > 0) {
				const childList = li.createEl("ul", { cls: "todo-sidebar-list" });
				this.renderTasks(children, childList, file, pending);
			}
		}
	}

	private getMarkdownViewFor(file: TFile): MarkdownView | null {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === file.path) return view;
		}
		return null;
	}

	private async toggleTask(file: TFile, task: TaskItem): Promise<void> {
		const next = task.checked ? " " : "x";
		const view = this.getMarkdownViewFor(file);

		if (view) {
			const editor = view.editor;
			if (!isMarkerAt(editor.getLine(task.line), task.markerCol)) {
				// The note changed under us; re-read instead of corrupting a line.
				await this.render();
				return;
			}
			editor.replaceRange(
				next,
				{ line: task.line, ch: task.markerCol },
				{ line: task.line, ch: task.markerCol + 1 },
			);
			// Editing through the editor keeps undo history, but the metadata cache
			// only updates on save — which is otherwise debounced by 2 seconds.
			await view.save();
		} else {
			let written = false;
			await this.app.vault.process(file, (data) => {
				const lines = data.split("\n");
				const line = lines[task.line];
				if (line === undefined || !isMarkerAt(line, task.markerCol)) return data;
				lines[task.line] =
					line.slice(0, task.markerCol) + next + line.slice(task.markerCol + 1);
				written = true;
				return lines.join("\n");
			});
			if (!written) {
				await this.render();
				return;
			}
		}

		// Reflect the change now; the metadata cache event will follow with the
		// authoritative state a moment later.
		task.status = next;
		task.checked = next !== " ";
		await this.repaint();
	}

	private async jumpToLine(file: TFile, line: number): Promise<void> {
		const view = this.getMarkdownViewFor(file);

		if (view) {
			this.app.workspace.setActiveLeaf(view.leaf, { focus: true });
			const editor = view.editor;
			const ch = editor.getLine(line)?.length ?? 0;
			editor.setCursor({ line, ch });
			editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch } }, true);
			return;
		}

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, { eState: { line } });
	}
}

/** True when `col` sits between a `[` and `]` pair, i.e. it is a task marker. */
function isMarkerAt(line: string | undefined, col: number): boolean {
	if (line === undefined) return false;
	return line[col - 1] === "[" && line[col + 1] === "]";
}
