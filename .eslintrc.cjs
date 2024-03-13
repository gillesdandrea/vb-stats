module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // 'plugin:import/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:@tanstack/eslint-plugin-query/recommended',
    'eslint-config-prettier',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'prettier', 'react', 'simple-import-sort', '@typescript-eslint', '@tanstack/query'],
  rules: {
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'prettier/prettier': 'error',
    'react/react-in-jsx-scope': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    '@tanstack/query/exhaustive-deps': 'warn',
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          // `react`, `react-dom`, then `next` packages
          ['^react$', '^react-dom$', '^react-dom/', '^next', '^vite$'],
          // External packages
          ['^@[a-z]', '^[a-z]'],
          // Local absolute packages (starting with `@` or `~`)
          ['^@/', '^~/'],
          // Imports starting with `../`
          ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
          // Imports starting with `./`
          ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
          // Style imports
          ['^.+\\.s?css$'],
          // Side effect imports
          ['^\\u0000'],
        ],
      },
    ],
  },
};
