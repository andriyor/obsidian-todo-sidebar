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

### Releasing

Obsidian and BRAT both install from a GitHub release's **assets**, not from the repository tree,
so each release needs `main.js`, `manifest.json`, and `styles.css` attached. The release tag, the
release name, and the `version` inside the released `manifest.json` must all be identical — BRAT
treats the tag as the source of truth and warns if the manifest disagrees.

```bash
pnpm build   # main.js is gitignored, so build before attaching it
gh release create 1.0.0 main.js manifest.json styles.css --title 1.0.0
```

Bump the version in `manifest.json` (and `package.json`, by convention) first. Add a
`versions.json` entry only when `minAppVersion` changes. For a pre-release, use a matching
tag/name/version such as `1.0.1-beta.1` and mark the release as a pre-release.

## Install with BRAT

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) installs
plugins straight from a GitHub release and keeps them updated, so testers do not have to copy
files by hand.

1. Install and enable **BRAT** from Settings → Community plugins → Browse.
2. Run the command **Add a beta plugin for testing** (or Settings → BRAT → Add beta plugin).
3. Enter the repository path: `andriyor/obsidian-todo-sidebar`.
4. Enable **Todo Sidebar** in Settings → Community plugins.

BRAT tracks the latest release by default; use the *edit* button beside the plugin in BRAT's
settings to pin ("freeze") a specific release tag instead. Removing a plugin from BRAT's list
stops updates but does not uninstall it — remove it from Community plugins for that.

BRAT also works with private repositories, via a fine-grained personal access token with
read-only *Contents* permission for that repo. Heavy install/reinstall cycles can hit GitHub's
60-requests-per-hour anonymous API limit; adding a token in BRAT's settings raises it.

## Install manually

Download `main.js`, `manifest.json`, and `styles.css` from the
[latest release](https://github.com/andriyor/obsidian-todo-sidebar/releases/latest) into
`<vault>/.obsidian/plugins/todo-sidebar/`:

```bash
VAULT="/path/to/vault"
DEST="$VAULT/.obsidian/plugins/todo-sidebar"
mkdir -p "$DEST"
gh release download --repo andriyor/obsidian-todo-sidebar \
	-p main.js -p manifest.json -p styles.css -D "$DEST"
```

Building from a clone works too — `main.js` is not committed, so run `pnpm install && pnpm build`
first, then copy those same three files.

Then enable **Todo Sidebar** in Settings → Community plugins. (Community plugins must be
turned on, i.e. Restricted mode off.)

For development, symlink the repo instead so `pnpm dev` rebuilds land in the vault directly:

```bash
ln -s "$PWD" "$VAULT/.obsidian/plugins/todo-sidebar"
```

Reload the plugin after a rebuild with the **Reload app without saving** command, or install
the Hot Reload plugin.
