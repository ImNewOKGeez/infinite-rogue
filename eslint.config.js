import globals from 'globals';

const unusedVarsRule = ['warn', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
}];

export default [
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': unusedVarsRule,
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
    rules: {
      // Catch real bugs
      'no-undef': 'error',
      'no-unused-vars': unusedVarsRule,
      'no-unreachable': 'error',
      'no-duplicate-case': 'error',
      'no-self-assign': 'error',
      'no-constant-condition': 'warn',

      // Common mistakes
      'eqeqeq': ['warn', 'smart'],
      'no-implicit-coercion': ['warn', { allow: ['!!', '+'] }],
      'no-fallthrough': 'warn',

      // Console noise in production
      'no-console': 'warn',
    },
  },
];
