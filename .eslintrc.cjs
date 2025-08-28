module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'unused-imports', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier'
  ],
  env: { node: true, browser: true, es2022: true },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', '.next/'],
  settings: {
    next: { rootDir: ['apps/frontend/'] }
  },
  overrides: [
    {
      files: ['apps/frontend/**/*.{ts,tsx}'],
      extends: ['next', 'next/core-web-vitals']
    }
  ],
  rules: {
    'unused-imports/no-unused-imports': 'warn'
  }
};

