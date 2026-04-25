let globalViewErrorLoggerInstalled = false;

const VIEW_LOG_PREFIX = "[ViewMountDebug]";

export const logViewMountDebug = (
  viewName: string,
  message: string,
  details?: Record<string, unknown>,
) => {
  console.log(`${VIEW_LOG_PREFIX} ${viewName}: ${message}`, details ?? {});
};

export const logViewMountWarning = (
  viewName: string,
  message: string,
  details?: Record<string, unknown>,
) => {
  console.warn(`${VIEW_LOG_PREFIX} ${viewName}: ${message}`, details ?? {});
};

export const installGlobalViewErrorLogger = () => {
  if (globalViewErrorLoggerInstalled) return;
  globalViewErrorLoggerInstalled = true;

  const errorUtils = (globalThis as any).ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler?.();

  if (!errorUtils?.setGlobalHandler) {
    logViewMountWarning("GlobalErrorHandler", "ErrorUtils is not available");
    return;
  }

  errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const message = error?.message || String(error);
    const stack = error?.stack;
    const looksLikeNativeViewError =
      message.includes("addViewAt") ||
      message.includes("failed to insert view") ||
      message.includes("API key not found") ||
      stack?.includes("SurfaceMountingManager") ||
      stack?.includes("MapView");

    if (looksLikeNativeViewError) {
      console.error(`${VIEW_LOG_PREFIX} Native view crash captured`, {
        isFatal,
        message,
        stack,
      });
    } else {
      console.error(`${VIEW_LOG_PREFIX} Global JS error captured`, {
        isFatal,
        message,
        stack,
      });
    }

    previousHandler?.(error, isFatal);
  });

  logViewMountDebug("GlobalErrorHandler", "installed");
};
