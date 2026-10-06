import type { NetInfoState } from "@react-native-community/netinfo";
import NetInfo from "@react-native-community/netinfo";
import {
  checkIsOnline,
  isNetworkError,
  isNetworkOnline,
  subscribeToNetworkStatus,
  toNetworkStatus,
  waitUntilOnline,
} from "../networkDetector";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(),
  },
}));

const mockedNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

function makeState(
  overrides: Partial<NetInfoState> = {},
): NetInfoState {
  return {
    type: "wifi",
    isConnected: true,
    isInternetReachable: true,
    details: null,
    ...overrides,
  } as NetInfoState;
}

describe("networkDetector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("isNetworkOnline", () => {
    it("returns false for null state", () => {
      expect(isNetworkOnline(null)).toBe(false);
    });

    it("returns false when disconnected", () => {
      expect(
        isNetworkOnline(makeState({ isConnected: false, isInternetReachable: true })),
      ).toBe(false);
    });

    it("returns false when connected but internet is not reachable", () => {
      expect(
        isNetworkOnline(
          makeState({ isConnected: true, isInternetReachable: false }),
        ),
      ).toBe(false);
    });

    it("returns true when connected and internet reachable", () => {
      expect(
        isNetworkOnline(
          makeState({ isConnected: true, isInternetReachable: true }),
        ),
      ).toBe(true);
    });

    it("returns true when connected and reachability is unknown (null)", () => {
      expect(
        isNetworkOnline(
          makeState({ isConnected: true, isInternetReachable: null }),
        ),
      ).toBe(true);
    });
  });

  describe("toNetworkStatus", () => {
    it("maps a connected reachable state", () => {
      expect(
        toNetworkStatus(
          makeState({ isConnected: true, isInternetReachable: true }),
        ),
      ).toEqual({
        isConnected: true,
        isInternetReachable: true,
        isOnline: true,
      });
    });

    it("maps a disconnected state", () => {
      expect(
        toNetworkStatus(
          makeState({ isConnected: false, isInternetReachable: false }),
        ),
      ).toEqual({
        isConnected: false,
        isInternetReachable: false,
        isOnline: false,
      });
    });

    it("normalizes undefined reachability to null", () => {
      expect(
        toNetworkStatus(
          makeState({
            isConnected: true,
            isInternetReachable: undefined as unknown as null,
          }),
        ),
      ).toEqual({
        isConnected: true,
        isInternetReachable: null,
        isOnline: true,
      });
    });
  });

  describe("checkIsOnline", () => {
    it("returns true when NetInfo reports online", async () => {
      mockedNetInfo.fetch.mockResolvedValueOnce(
        makeState({ isConnected: true, isInternetReachable: true }),
      );

      await expect(checkIsOnline()).resolves.toBe(true);
      expect(mockedNetInfo.fetch).toHaveBeenCalledTimes(1);
    });

    it("returns false when NetInfo reports offline", async () => {
      mockedNetInfo.fetch.mockResolvedValueOnce(
        makeState({ isConnected: false, isInternetReachable: false }),
      );

      await expect(checkIsOnline()).resolves.toBe(false);
    });
  });

  describe("subscribeToNetworkStatus", () => {
    it("forwards mapped status updates and returns unsubscribe", () => {
      const unsubscribe = jest.fn();
      let listener: ((state: NetInfoState) => void) | undefined;

      mockedNetInfo.addEventListener.mockImplementation((cb) => {
        listener = cb;
        return unsubscribe;
      });

      const onStatus = jest.fn();
      const cleanup = subscribeToNetworkStatus(onStatus);

      expect(mockedNetInfo.addEventListener).toHaveBeenCalledTimes(1);

      listener?.(
        makeState({ isConnected: true, isInternetReachable: true }),
      );
      expect(onStatus).toHaveBeenCalledWith({
        isConnected: true,
        isInternetReachable: true,
        isOnline: true,
      });

      listener?.(
        makeState({ isConnected: false, isInternetReachable: false }),
      );
      expect(onStatus).toHaveBeenCalledWith({
        isConnected: false,
        isInternetReachable: false,
        isOnline: false,
      });

      cleanup();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("waitUntilOnline", () => {
    it("resolves true immediately when already online", async () => {
      mockedNetInfo.fetch.mockResolvedValueOnce(
        makeState({ isConnected: true, isInternetReachable: true }),
      );

      await expect(waitUntilOnline(1000)).resolves.toBe(true);
      expect(mockedNetInfo.addEventListener).not.toHaveBeenCalled();
    });

    it("resolves true when connectivity returns before timeout", async () => {
      jest.useFakeTimers();

      mockedNetInfo.fetch.mockResolvedValueOnce(
        makeState({ isConnected: false, isInternetReachable: false }),
      );

      let listener: ((state: NetInfoState) => void) | undefined;
      const unsubscribe = jest.fn();
      mockedNetInfo.addEventListener.mockImplementation((cb) => {
        listener = cb;
        return unsubscribe;
      });

      const promise = waitUntilOnline(5000);

      // Allow the initial checkIsOnline() to settle
      await Promise.resolve();
      await Promise.resolve();

      listener?.(
        makeState({ isConnected: true, isInternetReachable: true }),
      );

      await expect(promise).resolves.toBe(true);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("resolves false when timeout elapses while still offline", async () => {
      jest.useFakeTimers();

      mockedNetInfo.fetch.mockResolvedValueOnce(
        makeState({ isConnected: false, isInternetReachable: false }),
      );

      const unsubscribe = jest.fn();
      mockedNetInfo.addEventListener.mockImplementation(() => unsubscribe);

      const promise = waitUntilOnline(2000);

      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(2000);

      await expect(promise).resolves.toBe(false);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("isNetworkError", () => {
    it("returns false for non-objects", () => {
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
      expect(isNetworkError("offline")).toBe(false);
      expect(isNetworkError(42)).toBe(false);
    });

    it("returns true for timeout flag", () => {
      expect(isNetworkError({ isTimeout: true })).toBe(true);
    });

    it("returns true when request exists without response", () => {
      expect(isNetworkError({ request: {}, response: undefined })).toBe(true);
    });

    it("returns false when a server response exists", () => {
      expect(
        isNetworkError({
          request: {},
          response: { status: 500 },
          code: "ERR_BAD_RESPONSE",
        }),
      ).toBe(false);
    });

    it.each([
      "ECONNABORTED",
      "ERR_NETWORK",
      "ENOTFOUND",
      "ECONNREFUSED",
      "ETIMEDOUT",
    ])("returns true for network code %s", (code) => {
      expect(isNetworkError({ code })).toBe(true);
    });

    it("returns false for unrelated error codes", () => {
      expect(isNetworkError({ code: "ERR_BAD_REQUEST" })).toBe(false);
    });
  });
});
