# Todo Sidebar

An Obsidian plugin that shows every checkbox from the **currently open note** in a sidebar panel.

## What it does

- Lists all `- [ ]` / `- [x]` items of the active note in the right sidebar, nested the way they are in the note.
- Refreshes when Obsidian re-indexes the note, i.e. shortly after a save (Obsidian's own save is debounced ~2s while you type).
- Click a checkbox in the panel to toggle it in the note (through the editor, so undo works). The panel updates immediately and the file is saved right away.
- Click a task's text to jump the cursor to that line in the note.
- Header shows a `done/total` count and a progress bar.
- Eye button in the header (or the command palette) hides completed tasks.
- Task text is rendered as markdown, so links, `**bold**`, and tags look right.
- Ignores checkboxes inside fenced code blocks and frontmatter.

## How it reads tasks

Tasks come from Obsidian's own metadata cache (`metadataCache.getFileCache(file).listItems`),
which supplies each item's status character, position and parent line. That means the panel
agrees with Obsidian's markdown parsing for free — code fences, frontmatter and indentation
included — with no parsing dependency in the bundle.

The trade-off: the cache describes the file *on disk*, so the panel follows saves rather than
keystrokes, and `src/parser.ts` pairs cache positions with `Vault.cachedRead` text (never the
unsaved editor buffer, which would misalign line numbers).

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
