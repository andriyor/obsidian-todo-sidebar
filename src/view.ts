import {
	Editor,
	ItemView,
	MarkdownRenderer,
	MarkdownView,
	TFile,
	WorkspaceLeaf,
	debounce,
	setIcon,
} from "obsidian";
import { TaskItem, countTasks, filterCompleted, parseTasks } from "./parser";
import type TodoSidebarPlugin from "./main";

export const VIEW_TYPE_TODO_SIDEBAR = "todo-sidebar-view";

export class TodoSidebarView extends ItemView {
	private plugin: TodoSidebarPlugin;
	private headerEl!: HTMLElement;
	private titleEl!: HTMLElement;
	private progressEl!: HTMLElement;
	private progressBarEl!: HTMLElement;
	private bodyEl!: HTMLElement;
	private toggleCompletedEl!: HTMLElement;

	/** Guards against an older async render overwriting a newer one. */
	private renderToken = 0;

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

		this.headerEl = this.contentEl.createDiv({ cls: "todo-sidebar-header" });
		const titleRow = this.headerEl.createDiv({ cls: "todo-sidebar-title-row" });
		this.titleEl = titleRow.createDiv({ cls: "todo-sidebar-title" });
		this.progressEl = titleRow.createDiv({ cls: "todo-sidebar-count" });

		this.toggleCompletedEl = titleRow.createDiv({
			cls: "clickable-icon todo-sidebar-action",
		});
		this.toggleCompletedEl.addEventListener("click", async () => {
			this.plugin.settings.hideCompleted = !this.plugin.settings.hideCompleted;
			await this.plugin.saveSettings();
			this.render();
		});

		this.progressBarEl = this.headerEl.createDiv({ cls: "todo-sidebar-progress" });
		this.progressBarEl.createDiv({ cls: "todo-sidebar-progress-fill" });

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
		this.registerEvent(
			this.app.workspace.on("editor-change", (_editor, info) => {
				if (info.file && info.file.path === this.app.workspace.getActiveFile()?.path) {
					this.requestRender();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
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

		setIcon(this.toggleCompletedEl, this.plugin.settings.hideCompleted ? "eye-off" : "eye");
		this.toggleCompletedEl.setAttribute(
			"aria-label",
			this.plugin.settings.hideCompleted ? "Show completed tasks" : "Hide completed tasks",
		);

		if (!file || file.extension !== "md") {
			this.titleEl.setText("No note open");
			this.progressEl.setText("");
			this.setProgress(0, 0);
			this.renderEmpty("Open a markdown note to see its checkboxes.");
			return;
		}

		this.titleEl.setText(file.basename);

		const content = await this.readContent(file);
		if (token !== this.renderToken) return;

		const allTasks = parseTasks(content);
		const { total, done } = countTasks(allTasks);
		this.progressEl.setText(total > 0 ? `${done}/${total}` : "");
		this.setProgress(done, total);

		if (total === 0) {
			this.renderEmpty("This note has no checkboxes.");
			return;
		}

		const tasks = this.plugin.settings.hideCompleted
			? filterCompleted(allTasks)
			: allTasks;

		if (tasks.length === 0) {
			this.renderEmpty("All tasks are done. 🎉");
			return;
		}

		// Build off-DOM and swap in once markdown rendering settles, to avoid flicker.
		const list = createEl("ul", { cls: "todo-sidebar-list todo-sidebar-list-root" });
		const pending: Promise<void>[] = [];
		this.renderTasks(tasks, list, file, pending);
		await Promise.all(pending);
		if (token !== this.renderToken) return;

		const scrollTop = this.bodyEl.scrollTop;
		this.bodyEl.empty();
		this.bodyEl.appendChild(list);
		this.bodyEl.scrollTop = scrollTop;
	}

	private renderEmpty(message: string): void {
		this.bodyEl.empty();
		this.bodyEl.createDiv({ cls: "todo-sidebar-empty", text: message });
	}

	private setProgress(done: number, total: number): void {
		const fill = this.progressBarEl.firstElementChild as HTMLElement | null;
		const percent = total > 0 ? (done / total) * 100 : 0;
		this.progressBarEl.toggleClass("is-hidden", total === 0);
		if (fill) fill.style.width = `${percent}%`;
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
				pending.push(
					MarkdownRenderer.render(this.app, task.text, textEl, file.path, this).then(
						() => unwrapParagraph(textEl),
					),
				);
			}

			textEl.setAttribute("aria-label", `Line ${task.line + 1}`);
			row.addEventListener("click", (event) => {
				// Let links inside the task text behave normally.
				if ((event.target as HTMLElement).closest("a")) return;
				void this.jumpToLine(file, task.line);
			});

			if (task.children.length > 0) {
				const childList = li.createEl("ul", { cls: "todo-sidebar-list" });
				this.renderTasks(task.children, childList, file, pending);
			}
		}
	}

	/** Prefers unsaved editor text so the sidebar tracks typing, not just saves. */
	private async readContent(file: TFile): Promise<string> {
		const editor = this.getEditorFor(file);
		if (editor) return editor.getValue();
		return this.app.vault.cachedRead(file);
	}

	private getEditorFor(file: TFile): Editor | null {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view as MarkdownView;
			if (view.file?.path === file.path) return view.editor;
		}
		return null;
	}

	private async toggleTask(file: TFile, task: TaskItem): Promise<void> {
		const next = task.checked ? " " : "x";
		const editor = this.getEditorFor(file);

		if (editor) {
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
		} else {
			await this.app.vault.process(file, (data) => {
				const lines = data.split("\n");
				const line = lines[task.line];
				if (line === undefined || !isMarkerAt(line, task.markerCol)) return data;
				lines[task.line] =
					line.slice(0, task.markerCol) + next + line.slice(task.markerCol + 1);
				return lines.join("\n");
			});
		}

		await this.render();
	}

	private async jumpToLine(file: TFile, line: number): Promise<void> {
		const leaf = this.app.workspace
			.getLeavesOfType("markdown")
			.find((candidate) => (candidate.view as MarkdownView).file?.path === file.path);

		if (leaf) {
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
			const editor = (leaf.view as MarkdownView).editor;
			const ch = editor.getLine(line)?.length ?? 0;
			editor.setCursor({ line, ch });
			editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch } }, true);
			return;
		}

		const newLeaf = this.app.workspace.getLeaf(false);
		await newLeaf.openFile(file, { eState: { line } });
	}
}

/** True when `col` sits between a `[` and `]` pair, i.e. it is a task marker. */
function isMarkerAt(line: string | undefined, col: number): boolean {
	if (line === undefined) return false;
	return line[col - 1] === "[" && line[col + 1] === "]";
}

/** MarkdownRenderer wraps inline content in a `<p>`; flatten it for inline layout. */
function unwrapParagraph(el: HTMLElement): void {
	if (el.childNodes.length !== 1) return;
	const only = el.firstElementChild;
	if (only instanceof HTMLParagraphElement) {
		while (only.firstChild) el.appendChild(only.firstChild);
		only.remove();
	}
}
