import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const tsParser = require("@typescript-eslint/parser");
const nextPlugin = require("@next/eslint-plugin-next");
const nextRecommended = nextPlugin.configs.recommended;

export default [
	{
		ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**"],
	},
	{
		files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: "latest",
			sourceType: "module",
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
		plugins: {
			"@next/next": nextPlugin,
		},
		rules: {
			...nextRecommended.rules,
			"@next/next/no-img-element": "off",
		},
	},
];
