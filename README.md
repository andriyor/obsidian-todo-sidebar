# Todo Sidebar

An Obsidian plugin that shows every checkbox from the **currently open note** in a sidebar panel.

## What it does

- Lists all `- [ ]` / `- [x]` items of the active note in the right sidebar, nested the way they are in the note.
- Updates live as you type — it reads the editor buffer, so you do not have to save first.
- Click a checkbox in the panel to toggle it in the note (through the editor, so undo works).
- Click a task's text to jump the cursor to that line in the note.
- Header shows a `done/total` count and a progress bar.
- Eye button in the header (or the command palette) hides completed tasks.
- Task text is rendered as markdown, so links, `**bold**`, and tags look right.
- Ignores checkboxes inside fenced code blocks and frontmatter.

## Usage

Open the panel with the ribbon icon (checklist) or the command palette: **Show note tasks in sidebar**.

Commands:

- `Todo Sidebar: Show note tasks in sidebar`
- `Todo Sidebar: Toggle completed tasks visibility`

Settings: hide completed tasks, open the panel automatically on startup.

## Development

Uses **pnpm** (pinned via `packageManager` in `package.json`).

```bash
pnpm install
pnpm dev     # esbuild watch mode → main.js
pnpm build   # typecheck + minified production bundle
```

`esbuild` is listed under `pnpm.onlyBuiltDependencies` because pnpm blocks postinstall
scripts by default and esbuild needs its to fetch the platform binary.

Source lives in `src/`; `main.js` at the repo root is the generated bundle and is gitignored.

## Install into a vault

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/todo-sidebar/`:

```bash
VAULT="/path/to/vault"
mkdir -p "$VAULT/.obsidian/plugins/todo-sidebar"
cp main.js manifest.json styles.css "$VAULT/.obsidian/plugins/todo-sidebar/"
```

Then enable **Todo Sidebar** in Settings → Community plugins. (Community plugins must be
turned on, i.e. Restricted mode off.)

For development, symlink the repo instead so `pnpm dev` rebuilds land in the vault directly:

```bash
ln -s "$PWD" "$VAULT/.obsidian/plugins/todo-sidebar"
```

Reload the plugin after a rebuild with the **Reload app without saving** command, or install
the Hot Reload plugin.
