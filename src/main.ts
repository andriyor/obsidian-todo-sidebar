import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { TodoSidebarView, VIEW_TYPE_TODO_SIDEBAR } from "./view";

interface TodoSidebarSettings {
	hideCompleted: boolean;
	groupByHeading: boolean;
	openOnLoad: boolean;
}

const DEFAULT_SETTINGS: TodoSidebarSettings = {
	hideCompleted: false,
	groupByHeading: true,
	openOnLoad: false,
};

export default class TodoSidebarPlugin extends Plugin {
	settings: TodoSidebarSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_TODO_SIDEBAR,
			(leaf: WorkspaceLeaf) => new TodoSidebarView(leaf, this),
		);

		this.addRibbonIcon("list-checks", "Show note tasks", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-todo-sidebar",
			name: "Show note tasks in sidebar",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "toggle-completed-tasks",
			name: "Toggle completed tasks visibility",
			callback: async () => {
				this.settings.hideCompleted = !this.settings.hideCompleted;
				await this.saveSettings();
				this.refreshViews();
			},
		});

		this.addSettingTab(new TodoSidebarSettingTab(this.app, this));

		if (this.settings.openOnLoad) {
			this.app.workspace.onLayoutReady(() => void this.activateView(false));
		}
	}

	async activateView(reveal = true): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_TODO_SIDEBAR);

		let leaf: WorkspaceLeaf | null = existing[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) return;
			await leaf.setViewState({ type: VIEW_TYPE_TODO_SIDEBAR, active: true });
		}

		if (reveal) await workspace.revealLeaf(leaf);
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TODO_SIDEBAR)) {
			const view = leaf.view;
			if (view instanceof TodoSidebarView) void view.render();
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

class TodoSidebarSettingTab extends PluginSettingTab {
	private plugin: TodoSidebarPlugin;

	constructor(app: App, plugin: TodoSidebarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Hide completed tasks")
			.setDesc("Only show tasks that are still open. Also toggleable from the panel header.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.hideCompleted).onChange(async (value) => {
					this.plugin.settings.hideCompleted = value;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}),
			);

		new Setting(containerEl)
			.setName("Group by heading")
			.setDesc(
				"Show tasks under the note heading they belong to. Headings without tasks are skipped.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.groupByHeading).onChange(async (value) => {
					this.plugin.settings.groupByHeading = value;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}),
			);

		new Setting(containerEl)
			.setName("Open panel on startup")
			.setDesc("Add the task panel to the right sidebar when Obsidian starts.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.openOnLoad).onChange(async (value) => {
					this.plugin.settings.openOnLoad = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}
