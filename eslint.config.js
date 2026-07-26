const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**'],
    rules: {
      // Metro and TypeScript resolve RouteMap.native.tsx/RouteMap.web.tsx from this shared import.
      'import/no-unresolved': ['error', { ignore: ['^@/components/RouteMap$', '^@/lib/auth-storage$'] }],
    },
  },
]);
