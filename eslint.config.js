import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      '**/target/**',
      'vendor/**',
      // Installed agent skills. Third-party files this repo neither owns nor
      // edits, written for a Node runtime this config does not declare — every
      // report against them is a false positive about someone else's code.
      '.agents/**',
      // The libm / critical-section shim, copied verbatim from the vendored
      // upstream. Browser JS with no build step; linting it against this
      // project's Node-flavoured environment reports only false positives.
      'crates/**/*.js',
      // Generated wasm-bindgen glue, staged by scripts/build-wasm.sh. It is a
      // build artifact, not source, and it targets the browser rather than this
      // project's lint environment.
      'apps/web/public/wasm/**',
      // The apps/ui Vite bundle, staged into the web app's public tree. Also a
      // build artifact, and already gitignored, so CI never sees it — but a
      // local `eslint .` would otherwise report ~1600 findings against minified
      // output that no one edits.
      'apps/web/public/ui/**',
      // The Python worker's virtualenv. google-adk ships a prebuilt browser
      // bundle inside site-packages; it is a third-party artifact this repo
      // neither owns nor edits.
      'apps/adk-worker/.venv/**',
      'packages/fixtures/cases/**',
      'packages/event-schema/schemas/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'Read configuration through @fleetscope/shared config, not process.env.',
        },
      ],
    },
  },
  {
    // Config loaders, CLIs and scripts are the only places allowed to touch the environment.
    files: [
      'packages/shared/src/env.ts',
      'apps/api/src/config/**/*.ts',
      'packages/*/src/cli.ts',
      'packages/*/src/emit-json-schema.ts',
      'scripts/**/*.ts',
      'eslint.config.js',
      'vitest.config.ts',
    ],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['**/tests/**/*.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
);
