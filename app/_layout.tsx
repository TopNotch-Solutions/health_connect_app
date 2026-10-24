// In app/_layout.tsx
import { persistor, store } from "@/store/store";
import { Feather } from "@expo/vector-icons";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import GlobalRouteModal from "../components/(provider)/GlobalRouteModal";
import { ScreenCaptureProtection } from "../components/ScreenCaptureProtection";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { RouteProvider } from "../context/RouteContext";
import {
  flushPendingNotificationNavigation,
  handleNotificationOpen,
} from "../lib/notificationNavigation";
import {
  addNotificationListeners,
  configureForegroundHandler,
  getLastNotificationResponse,
  getNotificationData,
} from "../lib/pushNotifications";
import { AlertDialogHost } from "../components/AlertDialog";
import { isExpoGoRuntime } from "../lib/isExpoGoRuntime";
import { installGlobalViewErrorLogger } from "../lib/viewErrorLogger";
import "./globals.css";

// Keep the native splash visible until IntroSplash is ready to take over.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if the splash was already hidden (e.g. Fast Refresh).
});

// Import splash image
const splashImage = require("../assets/images/splashscreen_image.jpg");

// Simple in-app splash screen that fades in on app open for both patients and providers
const IntroSplash = () => {
  const opacity = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(40))[0];

  useEffect(() => {
    void SplashScreen.hideAsync();

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: "#000",
          zIndex: 999,
          flexDirection: "column",
        },
      ]}
    >
      {/* Top half: splash image */}
      <View style={{ flex: 1, overflow: "hidden" }}>
        <Image
          source={splashImage}
          style={{
            width: "100%",
            height: "100%",
          }}
          resizeMode="cover"
        />
        {/* Subtle overlay to keep tone consistent */}
        <View
          style={{
            ...StyleSheet.absoluteFill,
            backgroundColor: "rgba(0, 0, 0, 0.25)",
          }}
        />
      </View>

      {/* Bottom half: animated text block */}
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 50,
          paddingBottom: 40,
          paddingTop: 24,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Animated.View
          style={{
            opacity,
            transform: [{ translateY }],
          }}
        >
          <Text
            style={{
              fontSize: 30,
              fontWeight: "700",
              marginBottom: 12,
              color: "#0F172A", // very dark for strong visibility
              textAlign: "center",
            }}
          >
            Health Connect
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              marginBottom: 8,
              color: "#374151", // text-gray-700 for better contrast
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            One place to coordinate care, stay informed, and feel supported
            every step of the way.
          </Text>

          {/* Feature bullets similar to onboarding-patient.tsx */}
          <View
            style={{
              width: "100%",
              marginTop: 16,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "#DCFCE7", // bg-green-100
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Feather name="check" size={20} color="#10B981" />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#808080", // slightly lighter than #0F172A
                  flexShrink: 1,
                  fontStyle: "italic",
                }}
              >
                Request trusted medical consultations and check-ups without
                leaving your house.
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "#DCFCE7",
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Feather name="check" size={20} color="#10B981" />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#808080", // slightly lighter than #0F172A
                  flexShrink: 1,
                  fontStyle: "italic",
                }}
              >
                Skip the waiting room—get quality medical care delivered
                straight to your door.
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "#DCFCE7",
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Feather name="check" size={20} color="#10B981" />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#808080", // very dark, highly visible
                  flexShrink: 1,
                  fontStyle: "italic",
                }}
              >
                Connect with licensed healthcare professionals for personalized
                medical care in the comfort of your home.
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const ProtectedLayout = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [showIntroSplash, setShowIntroSplash] = useState(true);
  const authRef = useRef({
    isAuthenticated,
    isLoading,
    role: user?.role as string | undefined,
  });
  const handledColdStartRef = useRef(false);

  useEffect(() => {
    authRef.current = {
      isAuthenticated,
      isLoading,
      role: user?.role,
    };
  }, [isAuthenticated, isLoading, user?.role]);

  // Hide the intro splash a short moment after auth state is known
  useEffect(() => {
    if (isLoading) return;

    const timeout = setTimeout(() => {
      setShowIntroSplash(false);
    }, 7000);

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Open the correct screen when a push notification is tapped (if logged in).
  useEffect(() => {
    if (isExpoGoRuntime()) return;

    let isMounted = true;
    const subscriptions: {
      notificationSubscription?: { remove: () => void };
      responseSubscription?: { remove: () => void };
    } = {};

    const openFromResponse = (
      response: import("expo-notifications").NotificationResponse,
    ) => {
      const auth = authRef.current;
      handleNotificationOpen({
        data: getNotificationData(response),
        isAuthenticated: auth.isAuthenticated,
        userRole: auth.role,
        router,
      });
    };

    void (async () => {
      await configureForegroundHandler();

      const listeners = await addNotificationListeners({
        onReceive: (notification) => {
          console.log("📬 Foreground notification received:", notification);
        },
        onResponse: (response) => {
          if (!isMounted) return;
          openFromResponse(response);
        },
      });
      subscriptions.notificationSubscription =
        listeners.notificationSubscription;
      subscriptions.responseSubscription = listeners.responseSubscription;

      // Cold start: app launched by tapping a notification (once per app launch)
      if (!handledColdStartRef.current) {
        handledColdStartRef.current = true;
        const lastResponse = await getLastNotificationResponse();
        if (isMounted && lastResponse) {
          openFromResponse(lastResponse);
        }
      }
    })();

    return () => {
      isMounted = false;
      subscriptions.notificationSubscription?.remove();
      subscriptions.responseSubscription?.remove();
    };
  }, [router]);

  // If the user tapped a notification before login finished restoring, navigate now.
  // Delay slightly so the default role home redirect does not override the deep link.
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const timeout = setTimeout(() => {
      flushPendingNotificationNavigation({
        isAuthenticated,
        userRole: user?.role,
        router,
      });
    }, 450);
    return () => clearTimeout(timeout);
  }, [isLoading, isAuthenticated, user?.role, router]);

  useEffect(() => {
    if (isLoading) return;

    // Use setTimeout to ensure state updates have completed
    const timeout = setTimeout(() => {
      try {
        const inAuth = segments[0] === "(auth)";
        const inVerification = segments[0] === "(verification)";
        const inRoot = segments[0] === "(root)";
        const inApp = segments[0] === "(app)";

        if (!isAuthenticated) {
          // User is not authenticated
          if (inApp) {
            // Trying to access protected app routes, redirect to sign-in
            router.replace("/(root)/sign-in");
          }
        } else {
          // User is authenticated
          if (inAuth || inVerification || inRoot) {
            // User is logged in but on auth/verification/root screens
            // Redirect based on user role
            if (user?.role === "patient") {
              router.replace("/(app)/(patient)/home");
            } else if (
              user?.role === "doctor" ||
              user?.role === "nurse" ||
              user?.role === "physiotherapist" ||
              user?.role === "social worker" ||
              user?.role === "pharmacist"
            ) {
              router.replace("/(app)/(provider)/home");
            } else {
              // Fallback if role is not set
              console.warn("User has unknown role:", user?.role);
              router.replace("/(root)/selection");
            }
          } else if (inApp) {
            // User is in app section, verify they're in the correct role section
            const inPatient = segments[1] === "(patient)";
            const inProvider = segments[1] === "(provider)";

            if (user?.role === "patient" && inProvider) {
              // Patient trying to access provider area
              router.replace("/(app)/(patient)/home");
            } else if (
              (user?.role === "doctor" ||
                user?.role === "nurse" ||
                user?.role === "physiotherapist" ||
                user?.role === "social worker" ||
                user?.role === "pharmacist") &&
              inPatient
            ) {
              // Provider trying to access patient area
              router.replace("/(app)/(provider)/home");
            }
          }
        }
      } catch (error) {
        console.error("Error in ProtectedLayout routing logic:", error);
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, isLoading, segments, router, user?.role]);

  // Keep a single IntroSplash instance across auth loading → ready so the
  // animation does not restart when isLoading flips.
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Protects every page except teleconsultation-call */}
      <ScreenCaptureProtection />
      {showIntroSplash && <IntroSplash />}
      {!isLoading && (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(root)" />
          <Stack.Screen name="(verification)" />
        </Stack>
      )}
    </View>
  );
};

export default function RootLayout() {
  useEffect(() => {
    installGlobalViewErrorLogger();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <AuthProvider>
            <RouteProvider>
              <ProtectedLayout />
              <GlobalRouteModal />
              {/* Last so confirmation dialogs draw above every screen */}
              <AlertDialogHost />
            </RouteProvider>
          </AuthProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
}
