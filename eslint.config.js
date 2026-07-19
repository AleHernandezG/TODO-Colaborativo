const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const prettierConfig = require('eslint-config-prettier')
const simpleImportSort = require('eslint-plugin-simple-import-sort')

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'supabase/*'],
  },
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    files: ['src/features/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-native', 'react-native-*', '@supabase/*', 'expo*', '**/data/**'],
              message:
                'domain/ no puede importar React, React Native ni Supabase. Los casos de uso son funciones puras.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/shared/ui/**', 'src/app/_layout.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native-paper',
              message:
                'Paper solo se usa dentro de src/shared/ui, y solo para Snackbar, Dialog y Portal (ADR-0004).',
            },
          ],
        },
      ],
    },
  },
])
