module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^next/(.*)$': '<rootDir>/src/__mocks__/next.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globals: {
    'ts-jest': { tsconfig: { esModuleInterop: true, jsx: 'react' } },
  },
};
