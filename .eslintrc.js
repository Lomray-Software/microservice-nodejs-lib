module.exports = {
  root: true,
  extends: [
    'prettier',
    'plugin:prettier/recommended',
    '@lomray/eslint-config'
  ],
  ignorePatterns: ['/*.*', 'src/@types'],
  plugins: [],
  env: {
    es6: true,
    node: true,
    mocha: true,
  },
  globals: {
    NodeJS: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {},
    files: ['*.ts'],
    project: ['./tsconfig.json'],
    tsconfigRootDir: './',
  },
  settings: {},
  rules: {
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    'no-await-in-loop': 'off',
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto'
      }
    ]
  }
}
