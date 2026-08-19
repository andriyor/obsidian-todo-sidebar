import e18e from "@e18e/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
	{ ignores: ["main.js"] },
	e18e.configs.recommended,
	{
		files: ["src/**/*.ts", "test/**/*.mts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: { projectService: true },
		},
	},
];
