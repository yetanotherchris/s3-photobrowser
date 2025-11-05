export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: [
    '**/test/unit/**/*.test.ts',
    '**/test/integration/**/*.test.ts',
    '**/test/unit/**/*.spec.ts',
    '**/test/integration/**/*.spec.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/test/api.test.ts',
    '/test/server.test.ts',
    '/test/integration.test.ts',
  ],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.d.ts',
    '!server/**/*.test.ts',
    '!server/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};
