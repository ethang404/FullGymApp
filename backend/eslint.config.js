const { defineConfig } = require("eslint/config");
const js = require("@eslint/js");
const globals = require("globals");

module.exports = defineConfig([
	{ ignores: ["node_modules/**"] },
	js.configs.recommended,
	{
		files: ["**/*.js"],
		languageOptions: {
			sourceType: "commonjs",
			globals: { ...globals.node, ...globals.jest },
		},
		rules: {
			"no-unused-vars": ["error", { ignoreRestSiblings: true }],
		},
	},
]);
