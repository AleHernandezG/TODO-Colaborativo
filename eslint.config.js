const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const prettierConfig = require('eslint-config-prettier')
const simpleImportSort = require('eslint-plugin-simple-import-sort')

const features = ['catalog', 'community', 'expenses', 'items', 'session']

const domainPurity = {
  group: ['react', 'react-native', 'react-native-*', '@supabase/*', 'expo*', '**/data/**'],
  message:
    'domain/ no puede importar React, React Native ni Supabase. Los casos de uso son funciones puras.',
}

const paper = {
  name: 'react-native-paper',
  message:
    'Paper solo se usa dentro de src/shared/ui, y solo para Snackbar, Dialog y Portal (ADR-0004).',
}

function internalsOf(feature) {
  return {
    group: [
      `**/${feature}/domain/**`,
      `**/${feature}/data/**`,
      `**/${feature}/presentation/**`,
    ],
    message: `El interior de ${feature} es privado. Importa desde '@/features/${feature}', y si falta algo, expórtalo en su index.ts.`,
  }
}

function restricted({ paths = [], patterns }) {
  return {
    'no-restricted-imports': ['error', paths.length ? { paths, patterns } : { patterns }],
  }
}

const featureBlocks = features.flatMap((feature) => {
  const foreign = features.filter((other) => other !== feature).map(internalsOf)
  return [
    {
      files: [`src/features/${feature}/**/*.ts`],
      ignores: [`src/features/${feature}/domain/**`],
      rules: restricted({ patterns: foreign }),
    },
    {
      files: [`src/features/${feature}/domain/**/*.ts`],
      rules: restricted({ patterns: [domainPurity, ...foreign] }),
    },
    {
      files: [`src/features/${feature}/**/*.tsx`],
      rules: restricted({ paths: [paper], patterns: foreign }),
    },
  ]
})

const allInternals = features.map(internalsOf)

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
  ...featureBlocks,
  {
    files: ['src/app/**/*.ts', 'src/shared/**/*.ts', 'src/theme/**/*.ts'],
    rules: restricted({ patterns: allInternals }),
  },
  {
    files: ['src/app/**/*.tsx', 'src/shared/**/*.tsx', 'src/theme/**/*.tsx'],
    ignores: ['src/shared/ui/**', 'src/app/_layout.tsx'],
    rules: restricted({ paths: [paper], patterns: allInternals }),
  },
  {
    files: ['src/shared/ui/**/*.tsx', 'src/app/_layout.tsx'],
    rules: restricted({ patterns: allInternals }),
  },
])
