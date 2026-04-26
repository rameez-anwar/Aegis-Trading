module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/../testing/integration'],
  testMatch: ['**/*.test.js'],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
  verbose: true,
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/../testing/integration',
        outputName: 'integration_test_results.xml',
      },
    ],
  ],
};

