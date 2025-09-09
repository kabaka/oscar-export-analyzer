module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  globals: {
    vi: 'readonly',
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:prettier/recommended',
  ],
  plugins: ['no-unsanitized'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/exhaustive-deps': 'error',
    'no-unused-vars': 'error',
    'no-empty': 'error',
    'no-irregular-whitespace': 'error',
    'prettier/prettier': 'warn',
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',
    'no-magic-numbers': 'warn',
  },
};
