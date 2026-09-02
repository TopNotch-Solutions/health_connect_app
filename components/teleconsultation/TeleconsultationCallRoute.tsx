import { isExpoGoRuntime } from "@/lib/isExpoGoRuntime";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type TeleconsultationCallScreenProps = {
  requestId: string;
  role: "patient" | "provider";
};

type CallScreenComponent = React.ComponentType<TeleconsultationCallScreenProps>;

type TeleconsultationCallRouteProps = {
  role: "patient" | "provider";
};

export default function TeleconsultationCallRoute({
  role,
}: TeleconsultationCallRouteProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const requestId = Array.isArray(params.requestId)
    ? params.requestId[0]
    : params.requestId ?? "";

  const [CallScreen, setCallScreen] = useState<CallScreenComponent | null>(
    null,
  );
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (isExpoGoRuntime()) {
      setBlocked(true);
      return;
    }

    let cancelled = false;

    import("./TeleconsultationCallScreen")
      .then((module) => {
        if (!cancelled) {
          setCallScreen(() => module.default);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBlocked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (blocked) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedTitle}>Video call unavailable</Text>
        <Text style={styles.blockedBody}>
          Teleconsultation requires a development build. Expo Go does not
          include the WebRTC native module.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!CallScreen) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  return <CallScreen requestId={requestId} role={role} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    backgroundColor: "#FFFFFF",
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#14532D",
    marginBottom: 12,
    textAlign: "center",
  },
  blockedBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#16A34A",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});
