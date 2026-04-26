module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/../testing/unit_testing/backend'],
  testMatch: ['**/*.test.js'],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
  verbose: true,
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/../testing/unit_testing/backend',
        outputName: 'backend_unit_test_results.xml',
      },
    ],
  ],
};

