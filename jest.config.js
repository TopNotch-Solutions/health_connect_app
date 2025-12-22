/**
 * Jest configuration for the Expo React Native app.
 * Uses jest-expo preset and configures common mocks and transforms.
 */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-native-community|@react-navigation|expo(nent)?|@expo(nent)?/.*|expo-router|react-native-reanimated|react-native-gesture-handler)'
  ],
  moduleNameMapper: {
    // Style mocks (rare in RN, harmless if encountered)
    '\\.(css|less|scss)$': 'identity-obj-proxy'
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)'
  ],
};
