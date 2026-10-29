import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const FORBIDDEN_DASH_REGEX = '/[\\u2013\\u2014]/';
const FORBIDDEN_EMOJI_REGEX = '/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.next/**',
      '.turbo/**',
      '**/*.min.js',
      '.pnpm-store/**',
      'docs/uml/**',
      'cdk.out/**',
      '**/cdk.out/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      camelcase: ['error', { properties: 'always' }],
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      indent: ['error', 2, { SwitchCase: 1 }],
      'eol-last': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal:not([regex])[value=${FORBIDDEN_DASH_REGEX}]`,
          message:
            'Em dashes and en dashes are forbidden. Use a hyphen, comma, colon, or new sentence.',
        },
        {
          selector: `TemplateElement[value.raw=${FORBIDDEN_DASH_REGEX}]`,
          message:
            'Em dashes and en dashes are forbidden. Use a hyphen, comma, colon, or new sentence.',
        },
        {
          selector: `Literal:not([regex])[value=${FORBIDDEN_EMOJI_REGEX}]`,
          message: 'Emojis are forbidden in source code.',
        },
        {
          selector: `TemplateElement[value.raw=${FORBIDDEN_EMOJI_REGEX}]`,
          message: 'Emojis are forbidden in source code.',
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
