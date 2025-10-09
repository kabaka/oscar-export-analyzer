import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import testingLibraryPlugin from 'eslint-plugin-testing-library';
import jestDomPlugin from 'eslint-plugin-jest-dom';
import noUnsanitizedPlugin from 'eslint-plugin-no-unsanitized';
import eslintConfigPrettier from 'eslint-config-prettier';

const testingLibraryReactConfig = testingLibraryPlugin.configs['flat/react'];
const jestDomRecommendedConfig = jestDomPlugin.configs['flat/recommended'];

export default [
  {
    ignores: ['dist/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        vi: 'readonly',
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'no-unsanitized': noUnsanitizedPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooksPlugin.configs['recommended-latest'].rules,
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'no-unsanitized/method': 'error',
      'no-unsanitized/property': 'error',
      'no-magic-numbers': 'warn',
    },
  },
  {
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.{test,spec}.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
        ...globals.jest,
      },
    },
    plugins: {
      ...testingLibraryReactConfig.plugins,
      ...jestDomRecommendedConfig.plugins,
    },
    rules: {
      ...testingLibraryReactConfig.rules,
      ...jestDomRecommendedConfig.rules,
      'testing-library/no-node-access': 'off',
      'testing-library/prefer-screen-queries': 'off',
    },
  },
  eslintConfigPrettier,
];
