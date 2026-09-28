// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    rules: {
      // React Compiler rule. It flags our fetch-on-mount / reset-on-open effects, which work fine;
      // kept visible as a warning so they can be migrated gradually instead of blocking CI.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
