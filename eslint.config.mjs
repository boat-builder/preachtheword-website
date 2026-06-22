import next from 'eslint-config-next';

/**
 * ESLint flat config (ESLint 9). Next.js 16 removed the built-in `next lint`
 * command, so linting now runs via the ESLint CLI (`npm run lint`).
 * `eslint-config-next` ships a native flat-config array covering the Next.js
 * core-web-vitals rules plus React, React Hooks, import, jsx-a11y, and
 * TypeScript.
 */
const eslintConfig = [
  ...next,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'sermon-discovery-platform/**',
      'sermon-discovery-platform 2/**',
    ],
  },
];

export default eslintConfig;
