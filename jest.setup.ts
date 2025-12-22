// Extend Jest with React Native Testing Library matchers
import '@testing-library/jest-native/extend-expect';

// Mock Reanimated (recommended by library for Jest)
// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Mock AsyncStorage for Jest environment
// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock SecureStore with an in-memory map
jest.mock('expo-secure-store', () => {
  const mem: Record<string, string | undefined> = {};
  return {
    getItemAsync: jest.fn(async (key: string) => (key in mem ? (mem[key] as string) : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      mem[key] = value;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete mem[key];
    }),
  };
});

// Basic mocks for expo-router to avoid navigation side effects in unit tests
jest.mock('expo-router', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({}),
    Stack: (props: any) => null,
    Tabs: (props: any) => null,
    Slot: (props: any) => null,
    Link: (props: any) => null,
  };
});

// Guard against unimplemented native modules used in Expo env during tests
jest.mock('expo-constants', () => ({
  default: { expoConfig: {}, manifest: {}, systemFonts: [] },
}));

// Note: Rely on jest-expo's react-native preset mocks for core modules
