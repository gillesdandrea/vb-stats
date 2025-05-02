import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
// import reactCompiler from 'eslint-plugin-react-compiler';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const fileMasks = '**/*.{js,jsx,cjs,mjs,ts,tsx}';
const files = [fileMasks];

/** @type {import('eslint').Linter.Config} */
const eslintConfig = [
  {
    name: '::global-ignore',
    ignores: ['.history', 'dist', 'public'],
  },
  ...pluginQuery.configs['flat/recommended'],
  jsxA11y.flatConfigs.recommended,
  ...tseslint.config({
    name: '::typescript-eslint',
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files,
    languageOptions: {
      ecmaVersion: 2025,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      import: importPlugin,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
      'import/no-duplicates': 'error',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      '@tanstack/query/exhaustive-deps': 'warn',
    },
  }),
  // {
  //   name: '::react-compiler',
  //   ...reactCompiler.configs.recommended,
  // },
  {
    name: '::no-relative-import-paths',
    files,
    plugins: {
      'no-relative-import-paths': noRelativeImportPaths,
    },
    rules: {
      'no-relative-import-paths/no-relative-import-paths': [
        'error',
        { allowSameFolder: true, rootDir: 'src', prefix: '@' },
      ],
    },
  },
  {
    name: '::simple-import-sort',
    files,
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // `node` packages
            ['^node:'],
            // `react`, `react-dom`
            ['^react$', '^react-dom$', '^react-dom/'],
            // `storybook`
            ['^@storybook', '^storybook'],
            // `next` or `vite` packages
            ['^next', '^vite$', '^vitest'],
            // External packages
            ['^@[a-z]', '^[a-z]'],
            // Local absolute packages (starting with `@` or `~`)
            ['^@/', '^~/'],
            // Imports starting with `../`
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // Imports starting with `./`
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            // Style imports
            ['^.+\\.s?css(\\?url)?$'],
            // Side effect imports
            ['^\\u0000'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
  {
    name: '::unused-imports',
    files,
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off', // replaced by 'unused-imports/no-unused-vars'
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': 'warn',
    },
  },
  {
    name: 'prettier/recommended',
    files,
    ...prettierRecommended,
  },
];

export default eslintConfig;
