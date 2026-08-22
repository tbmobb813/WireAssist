module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript' }, target: 'es2020' }, module: { type: 'commonjs' } },
    ],
  },
};
