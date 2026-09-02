import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { AppTextInput as TextInput } from "../../components/AppTextInput";
import ScreenLayout, {
  KEYBOARD_AWARE_EXTRA_SCROLL,
} from "../../components/ScreenLayout";
import { useAuth } from "../../context/AuthContext";
import {
  iosInputIconSize,
  withIosInputContainerStyle,
  withIosTextInputStyle,
} from "../../lib/iosInputStyles";

const COLORS = {
  bg: "#FAFFFE",
  textDark: "#14532D",
  textMuted: "#4B5563",
  green: "#16A34A",
  greenSoft: "rgba(187, 247, 208, 0.45)",
  placeholder: "#C4A574",
  inputBorder: "#BBF7D0",
  white: "#FFFFFF",
  footer: "#6B7280",
};

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
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const showCredentialError = (
    errorMessage: string,
    errorType: "invalid" | "network" | "server",
  ) => {
    setCredentialError({ message: errorMessage, type: errorType });
    Animated.parallel([
      Animated.spring(credentialErrorAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: false,
      }),
      Animated.spring(credentialErrorHeight, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: false,
      }),
    ]).start(() => {
      Animated.sequence([
        Animated.delay(5000),
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
      ]).start(() => setCredentialError(null));
    });
  };

  const dismissCredentialError = () => {
    if (!credentialError) return;
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
    ]).start(() => setCredentialError(null));
  };

  const handleSignIn = async () => {
    setEmailError("");
    setPasswordError("");
    credentialErrorAnim.setValue(0);
    credentialErrorHeight.setValue(0);
    setCredentialError(null);

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
    if (hasError) return;

    try {
      setIsLoading(true);
      await login(email, password);
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;
      const code = error?.code;

      let errorType: "invalid" | "network" | "server" = "server";
      let errorMessage = "Failed to sign in. Please try again.";

      if (
        !error?.response ||
        code === "ECONNABORTED" ||
        code === "ERR_NETWORK" ||
        code === "ECONNREFUSED"
      ) {
        errorType = "network";
        errorMessage =
          "Cannot connect to server. Please check your internet connection and try again.";
      } else if (
        code === "ETIMEDOUT" ||
        message?.toLowerCase().includes("timeout")
      ) {
        errorType = "network";
        errorMessage =
          "Connection timeout. Please check your internet and try again.";
      } else if (
        status === 401 ||
        message?.toLowerCase().includes("invalid") ||
        message?.toLowerCase().includes("incorrect")
      ) {
        errorType = "invalid";
        errorMessage =
          "The email address or password you entered is incorrect. Double-check the credentials or sign up to get started.";
      } else if (
        status === 403 ||
        status === 404 ||
        message?.toLowerCase().includes("not found")
      ) {
        errorType = "invalid";
        errorMessage =
          "The email address or password you entered is incorrect. Double-check the credentials or sign up to get started.";
      } else if (status && status >= 500) {
        errorType = "server";
        errorMessage = "Server error. Please try again later.";
      } else if (message) {
        errorType = "server";
        errorMessage = message;
      }

      showCredentialError(errorMessage, errorType);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError) setEmailError("");
    dismissCredentialError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordError) setPasswordError("");
    dismissCredentialError();
  };

  const inputBorder = (hasError: boolean) =>
    hasError ? "#EF4444" : COLORS.inputBorder;

  if (renderError) {
    return (
      <ScreenLayout
        backgroundColor={COLORS.bg}
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <Text style={styles.errorTitle}>An error occurred</Text>
        <Text style={styles.errorBody}>{renderError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => setRenderError(null)}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </ScreenLayout>
    );
  }

  try {
    return (
      <ScreenLayout backgroundColor={COLORS.bg}>
        <View style={styles.root}>
          <View style={styles.bgBlobTop} pointerEvents="none" />
          <View style={styles.bgBlobMid} pointerEvents="none" />
          <View style={styles.bgBlobBottom} pointerEvents="none" />

          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <KeyboardAwareScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              enableOnAndroid
              enableAutomaticScroll
              extraScrollHeight={KEYBOARD_AWARE_EXTRA_SCROLL}
            >
              <View style={styles.brandRow}>
                <View style={styles.logoGlow}>
                  <Image
                    source={require("../../assets/images/connectlogo.png")}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.brandTextWrap}>
                  <Text style={styles.brandTitle}>Health Connect</Text>
                  <Text style={styles.brandSubtitle}>Namibia</Text>
                </View>
              </View>

              <Text style={styles.greeting}>Hello there!</Text>
              <Text style={styles.greetingSub}>Welcome back.</Text>

              {credentialError ? (
                <Animated.View
                  style={{
                    opacity: credentialErrorAnim,
                    maxHeight: credentialErrorHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 200],
                    }),
                    overflow: "hidden",
                    marginBottom: credentialErrorHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 16],
                    }),
                  }}
                >
                  <View style={styles.credentialErrorBox}>
                    <Feather
                      name={
                        credentialError.type === "network"
                          ? "wifi-off"
                          : "alert-circle"
                      }
                      size={18}
                      color={COLORS.textDark}
                      style={{ marginRight: 10, marginTop: 2 }}
                    />
                    <Text style={styles.credentialErrorText}>
                      {credentialError.message}
                    </Text>
                  </View>
                </Animated.View>
              ) : null}

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Email</Text>
                <View
                  style={[
                    styles.inputField,
                    withIosInputContainerStyle({
                      borderColor: inputBorder(Boolean(emailError)),
                    }),
                  ]}
                >
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={iosInputIconSize}
                    color={emailError ? "#EF4444" : COLORS.green}
                  />
                  <TextInput
                    style={[styles.inputText, withIosTextInputStyle()]}
                    placeholder="Email Address"
                    placeholderTextColor={COLORS.placeholder}
                    value={email}
                    onChangeText={handleEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {emailError ? (
                  <Text style={styles.fieldError}>{emailError}</Text>
                ) : null}
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Password</Text>
                <View
                  style={[
                    styles.inputField,
                    withIosInputContainerStyle({
                      borderColor: inputBorder(Boolean(passwordError)),
                    }),
                  ]}
                >
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={iosInputIconSize}
                    color={passwordError ? "#EF4444" : COLORS.green}
                  />
                  <TextInput
                    style={[styles.inputText, withIosTextInputStyle()]}
                    placeholder="Password"
                    placeholderTextColor={COLORS.placeholder}
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather
                      name={showPassword ? "eye" : "eye-off"}
                      size={iosInputIconSize}
                      color={COLORS.green}
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <Text style={styles.fieldError}>{passwordError}</Text>
                ) : null}
              </View>

              <View style={styles.ctaGlowWrap}>
                <TouchableOpacity
                  style={[
                    styles.ctaButton,
                    isLoading && styles.ctaButtonDisabled,
                  ]}
                  onPress={handleSignIn}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <Text style={styles.ctaText}>Log in</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotWrap}
                onPress={() =>
                  router.push({
                    pathname: "/(verification)/verify-phone",
                    params: { flow: "resetPassword" },
                  })
                }
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <View style={styles.signUpRow}>
                <Text style={styles.signUpMuted}>
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
                  <Text style={styles.signUpLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                A digital health solution by{" "}
                <Text
                  style={styles.footerLink}
                  onPress={() => Linking.openURL("https://kopanovertex.com")}
                >
                  Kopano-Vertex Trading CC
                </Text>
              </Text>
            </View>
          </Animated.View>
        </View>
        <StatusBar backgroundColor={COLORS.bg} style="dark" />
      </ScreenLayout>
    );
  } catch (error: any) {
    setRenderError(
      error?.message || "An unknown error occurred while rendering",
    );
    return null;
  }
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 8 : 24,
    paddingBottom: 16,
  },
  bgBlobTop: {
    position: "absolute",
    top: -40,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.greenSoft,
  },
  bgBlobMid: {
    position: "absolute",
    top: 120,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(134, 239, 172, 0.25)",
  },
  bgBlobBottom: {
    position: "absolute",
    bottom: 140,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.greenSoft,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
    marginTop: 8,
  },
  logoGlow: {
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 72,
    height: 72,
  },
  brandTextWrap: {
    marginLeft: 14,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textDark,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.textDark,
    marginTop: -2,
  },
  greeting: {
    fontSize: 34,
    fontWeight: "700",
    color: COLORS.textDark,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 34,
    fontWeight: "700",
    color: COLORS.textDark,
    letterSpacing: -0.5,
    marginBottom: 28,
  },
  credentialErrorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  credentialErrorText: {
    flex: 1,
    color: "#991B1B",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  inputWrap: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderWidth: 2,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  inputText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.textDark,
  },
  fieldError: {
    color: "#EF4444",
    fontSize: 13,
    marginTop: 6,
    marginLeft: 16,
  },
  ctaGlowWrap: {
    marginTop: 8,
    marginBottom: 20,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaButton: {
    backgroundColor: COLORS.green,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#15803D",
  },
  ctaButtonDisabled: {
    backgroundColor: "#9CA3AF",
    borderColor: "#6B7280",
  },
  ctaText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  forgotWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  forgotText: {
    color: COLORS.textDark,
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  signUpRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  signUpMuted: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  signUpLink: {
    color: COLORS.textDark,
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  footerText: {
    textAlign: "center",
    fontSize: 10,
    color: COLORS.footer,
    lineHeight: 14,
  },
  footerLink: {
    color: COLORS.footer,
    fontWeight: "600",
  },
  errorTitle: {
    color: "#DC2626",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  errorBody: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
});

export default SignInScreen;
