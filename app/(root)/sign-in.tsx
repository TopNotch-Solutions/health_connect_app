import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";

const SignInScreen = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<{
    message: string;
    type: "invalid" | "network" | "server";
  } | null>(null);
  const credentialErrorAnim = useRef(new Animated.Value(0)).current;
  const credentialErrorHeight = useRef(new Animated.Value(0)).current;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Start animations on mount
    const animationRef = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]);

    animationRef.start();

    return () => {
      // Clean up animation on unmount
      animationRef.stop?.();
    };
  }, [fadeAnim, scaleAnim]);

  const handleSignIn = async () => {
    // Clear previous errors
    setEmailError("");
    setPasswordError("");
    // Reset animation values before clearing error
    credentialErrorAnim.setValue(0);
    credentialErrorHeight.setValue(0);
    setCredentialError(null);

    // Validate inputs
    let hasError = false;

    if (!email) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!email.includes("@") || !email.includes(".")) {
      setEmailError("Please enter a valid email address");
      hasError = true;
    }

    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    }

    if (hasError) {
      return;
    }

    try {
      setIsLoading(true);

      console.log("🔐 Starting login process...");
      const user = await login(email, password);
      console.log(
        "✅ Login successful for user:",
        user.email,
        "Role:",
        user.role,
      );
      // Don't manually navigate - let the root layout handle it automatically
      // The _layout.tsx will detect the authentication change and redirect to the correct home screen
    } catch (error: any) {
      console.error("❌ Sign-in error:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        code: error?.code,
      });

      // Determine error type and message
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;
      const code = error?.code;

      let errorType: "invalid" | "network" | "server" = "server";
      let errorMessage = "Failed to sign in. Please try again.";

      // Network errors (no response from server)
      if (
        !error?.response ||
        code === "ECONNABORTED" ||
        code === "ERR_NETWORK" ||
        code === "ECONNREFUSED"
      ) {
        errorType = "network";
        errorMessage =
          "Cannot connect to server. Please check your internet connection and try again.";
      }
      // Timeout errors
      else if (
        code === "ETIMEDOUT" ||
        message?.toLowerCase().includes("timeout")
      ) {
        errorType = "network";
        errorMessage =
          "Connection timeout. Please check your internet and try again.";
      }
      // Invalid credentials
      else if (
        status === 401 ||
        message?.toLowerCase().includes("invalid") ||
        message?.toLowerCase().includes("incorrect")
      ) {
        errorType = "invalid";
        errorMessage =
          "The email address or password you entered is incorrect. Double-check the credentials or sign up to get started.";
      }
      // Account not found
      else if (
        status === 403 ||
        status === 404 ||
        message?.toLowerCase().includes("not found")
      ) {
        errorType = "invalid";
        errorMessage =
          "The email address or password you entered is incorrect. Double-check the credentials or sign up to get started.";
      }
      // Server errors
      else if (status && status >= 500) {
        errorType = "server";
        errorMessage = "Server error. Please try again later.";
      }
      // Generic error with backend message
      else if (message) {
        errorType = "server";
        errorMessage = message;
      }

      setCredentialError({ message: errorMessage, type: errorType });

      // Animate error appearance
      Animated.parallel([
        Animated.spring(credentialErrorAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: false, // Height animation requires useNativeDriver: false
        }),
        Animated.spring(credentialErrorHeight, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: false,
        }),
      ]).start(() => {
        // After showing, wait 5 seconds then fade out
        Animated.sequence([
          Animated.delay(5000), // Show for 5 seconds
          Animated.parallel([
            Animated.timing(credentialErrorAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }),
            Animated.timing(credentialErrorHeight, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }),
          ]),
        ]).start(() => {
          // Clear error after animation completes
          setCredentialError(null);
        });
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (text: string) => {
    try {
      setEmail(text);
      if (emailError) {
        setEmailError("");
      }
      // Animate out and clear credential error when user starts typing
      if (credentialError) {
        Animated.parallel([
          Animated.timing(credentialErrorAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(credentialErrorHeight, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start(() => {
          setCredentialError(null);
        });
      }
    } catch (error) {
      console.error("Error in handleEmailChange:", error);
    }
  };

  const handlePasswordChange = (text: string) => {
    try {
      setPassword(text);
      if (passwordError) {
        setPasswordError("");
      }
      // Animate out and clear credential error when user starts typing
      if (credentialError) {
        Animated.parallel([
          Animated.timing(credentialErrorAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(credentialErrorHeight, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start(() => {
          setCredentialError(null);
        });
      }
    } catch (error) {
      console.error("Error in handlePasswordChange:", error);
    }
  };

  if (renderError) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-red-600 text-lg font-semibold mb-4">
          An error occurred
        </Text>
        <Text className="text-gray-600 text-base mb-6 px-4 text-center">
          {renderError}
        </Text>
        <TouchableOpacity
          className="bg-green-600 px-6 py-3 rounded-lg"
          onPress={() => setRenderError(null)}
        >
          <Text className="text-white font-semibold">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  try {
    return (
      <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
        <KeyboardAwareScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 0,
            paddingBottom: 5,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={150}
        >
          {/* Logo/Icon Section */}
          <View className="items-center" style={{ marginBottom: 0 }}>
            <Image
              source={require("../../assets/images/healthconnectlogo-cropped.png")}
              style={{ width: 180, height: 180, marginBottom: 0 }}
              resizeMode="contain"
            />
          </View>

          {/* Form Section */}
          <View className="mb-4">
            <Text className="text-2xl mb-2 font-bold text-gray-900">
              Welcome
            </Text>

            {/* Credential Error Display */}
            {credentialError && (
              <Animated.View
                style={{
                  opacity: credentialErrorAnim,
                  maxHeight: credentialErrorHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 200], // Max height for error message
                  }),
                  overflow: "hidden",
                  marginBottom: credentialErrorHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 16], // Match mb-4 (16px)
                  }),
                  transform: [
                    {
                      translateY: credentialErrorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                }}
              >
                <View
                  className="rounded-lg px-4 py-3 flex-row items-start"
                  style={{
                    backgroundColor:
                      credentialError.type === "network"
                        ? "#FEF3C7"
                        : credentialError.type === "invalid"
                          ? "#FEE2E2"
                          : "#FEF3C7",
                    borderLeftWidth: 4,
                    borderLeftColor:
                      credentialError.type === "network"
                        ? "#F59E0B"
                        : credentialError.type === "invalid"
                          ? "#EF4444"
                          : "#F59E0B",
                  }}
                >
                  <Feather
                    name={
                      credentialError.type === "network"
                        ? "wifi-off"
                        : credentialError.type === "invalid"
                          ? "alert-circle"
                          : "alert-triangle"
                    }
                    size={18}
                    color={
                      credentialError.type === "network"
                        ? "#D97706"
                        : credentialError.type === "invalid"
                          ? "#DC2626"
                          : "#D97706"
                    }
                    style={{ marginRight: 10, marginTop: 2 }}
                  />
                  <Text
                    style={{
                      color:
                        credentialError.type === "network"
                          ? "#92400E"
                          : credentialError.type === "invalid"
                            ? "#B91C1C"
                            : "#92400E",
                      fontSize: 14,
                      fontWeight: "500",
                      flex: 1,
                    }}
                  >
                    {credentialError.message}
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Email Input */}
            <View className="mb-5">
              <Text className="text-base text-gray-900 mb-2 font-medium">
                Email
              </Text>
              <View
                className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 border-2"
                style={{
                  borderColor: emailError ? "#EF4444" : "#D1D5DB",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <MaterialCommunityIcons
                  name="email"
                  size={20}
                  color={emailError ? "#EF4444" : "#10B981"}
                />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {emailError ? (
                <Text className="text-red-500 text-sm mt-1 ml-1">
                  {emailError}
                </Text>
              ) : null}
            </View>

            {/* Password Input */}
            <View className="mb-4">
              <Text className="text-base text-gray-900 mb-2 font-medium">
                Password
              </Text>
              <View
                className="flex-row items-center bg-white rounded-2xl px-5 py-4 border-2"
                style={{
                  borderColor: passwordError ? "#EF4444" : "#D1D5DB",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <MaterialCommunityIcons
                  name="lock"
                  size={20}
                  color={passwordError ? "#EF4444" : "#10B981"}
                />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="ml-3"
                >
                  <Feather
                    name={showPassword ? "eye" : "eye-off"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <Text className="text-red-500 text-sm mt-1 ml-1">
                  {passwordError}
                </Text>
              ) : null}
            </View>

            {/* Forgot Password */}
            <View className="flex-row justify-end mb-4">
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(verification)/verify-phone",
                    params: { flow: "resetPassword" },
                  })
                }
              >
                <Text className="text-base text-green-600 font-medium">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View className="flex-row justify-center items-center">
              <Text className="text-gray-600 text-base">
                Don&apos;t have an account?{" "}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/selection",
                    params: { mode: "signup" },
                  })
                }
              >
                <Text className="text-green-600 font-semibold text-base">
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAwareScrollView>

        {/* Section 4: Login Button - Fixed at bottom with safe area */}
        <SafeAreaView edges={["bottom"]} className="px-6 pb-4">
          <TouchableOpacity
            className="w-full py-5 rounded-2xl items-center justify-center"
            style={{
              backgroundColor: isLoading ? "#9CA3AF" : "#10B981",
              shadowColor: "#10B981",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View className="flex-row items-center">
                <Text className="text-white text-xl font-semibold mr-2">
                  Log In
                </Text>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <View className="flex-row justify-center items-center">
            <Text className="text-gray-600 text-xs mt-4">
              A digital health solution by{" "}
              <Text
                className="text-blue-600"
                onPress={() => Linking.openURL("https://kopanovertex.com")}
              >
                Kopano-Vertex Trading cc
              </Text>
            </Text>
          </View>
        </SafeAreaView>
        <StatusBar backgroundColor="#EFF6FF" style="dark" />
      </SafeAreaView>
    );
  } catch (error: any) {
    console.error("Error rendering SignInScreen:", error);
    setRenderError(
      error?.message || "An unknown error occurred while rendering",
    );
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-red-600 text-lg font-semibold mb-4">
          Render Error
        </Text>
        <Text className="text-gray-600 text-base mb-6 px-4 text-center">
          {error?.message}
        </Text>
        <TouchableOpacity
          className="bg-green-600 px-6 py-3 rounded-lg"
          onPress={() => setRenderError(null)}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
};

export default SignInScreen;
