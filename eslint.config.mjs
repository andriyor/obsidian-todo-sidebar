import e18e from "@e18e/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
	{ ignores: ["main.js"] },
	e18e.configs.recommended,
	...obsidianmd.configs.recommended,
	{
		// The build script and the tests run under Node, not inside Obsidian.
		files: ["esbuild.config.mjs", "test/**/*.mts"],
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			"@typescript-eslint/no-floating-promises": "off",
		},
	},
	{
		files: ["src/**/*.ts", "test/**/*.mts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: { projectService: true },
		},
	},
];
