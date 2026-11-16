import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'local/**', 'services/**/data/**', 'web/js/vendor/**'] },
  { files: ['**/*.mjs'], languageOptions: { globals: globals.node } },
  { files: ['web/**/*.js'], languageOptions: { globals: globals.browser } },
  { rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }] } },
];
