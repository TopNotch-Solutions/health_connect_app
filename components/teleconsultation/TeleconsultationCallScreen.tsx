import { useAuth } from "@/context/AuthContext";
import socketService from "@/lib/socket";
import {
  getTeleconsultationCallAccess,
  type TeleconsultationCallAccess,
} from "@/lib/teleconsultation";
import {
  CallContent,
  CallingState,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  useCallStateHooks,
} from "@stream-io/video-react-native-sdk";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TeleconsultationCallScreenProps = {
  requestId: string;
  role: "patient" | "provider";
};

type StreamResources = {
  client: StreamVideoClient;
  call: ReturnType<StreamVideoClient["call"]>;
  access: TeleconsultationCallAccess;
};

type CallStateWatcherProps = {
  requestId: string;
  requestStatus: TeleconsultationCallAccess["requestStatus"];
  userId: string;
  onJoined: () => void;
};

function CallStateWatcher({
  requestId,
  requestStatus,
  userId,
  onJoined,
}: CallStateWatcherProps) {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const hasMarkedInCall = useRef(false);

  useEffect(() => {
    if (callingState !== CallingState.JOINED) {
      return;
    }

    onJoined();

    if (requestStatus !== "ready_for_call" || hasMarkedInCall.current) {
      return;
    }

    hasMarkedInCall.current = true;
    void socketService
      .updateRequestStatus(requestId, userId, "in_call")
      .catch((error) => {
        console.warn("Unable to mark teleconsultation as in_call:", error);
      });
  }, [callingState, onJoined, requestId, requestStatus, userId]);

  return null;
}

export default function TeleconsultationCallScreen({
  requestId,
  role,
}: TeleconsultationCallScreenProps) {
  const { user } = useAuth();
  const router = useRouter();
  const currentUserId = user?.userId ?? "";
  const [resources, setResources] = useState<StreamResources | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!requestId) {
      setErrorMessage("Missing teleconsultation request id.");
      setIsLoading(false);
      return;
    }

    if (!user?.userId) {
      setErrorMessage("Your session is not ready yet. Please reopen the call.");
      setIsLoading(false);
      return;
    }

    let isActive = true;
    let currentClient: StreamVideoClient | null = null;
    let currentCall: ReturnType<StreamVideoClient["call"]> | null = null;

    const setupCall = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const access = await getTeleconsultationCallAccess(requestId);

        if (!isActive) {
          return;
        }

        const streamUser = {
          id: user.userId,
          name:
            user.fullname ||
            (role === "patient" ? "Patient User" : "Provider User"),
          image: user.profileImage || undefined,
        };

        currentClient = new StreamVideoClient({
          apiKey: access.apiKey,
          user: streamUser,
          token: access.token,
        });

        currentCall = currentClient.call(access.callType, access.callId);
        await currentCall.getOrCreate();
        await currentCall.join();

        if (!isActive || !currentClient || !currentCall) {
          return;
        }

        setResources({
          client: currentClient,
          call: currentCall,
          access,
        });
      } catch (error: any) {
        console.error("Failed to prepare teleconsultation call:", error);
        if (isActive) {
          setErrorMessage(
            error?.response?.data?.message ||
              error?.message ||
              "We could not open the teleconsultation call right now.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void setupCall();

    return () => {
      isActive = false;

      const teardown = async () => {
        try {
          await currentCall?.leave();
        } catch (error) {
          console.warn("Error leaving Stream call during cleanup:", error);
        }

        try {
          await currentClient?.disconnectUser();
        } catch (error) {
          console.warn("Error disconnecting Stream client during cleanup:", error);
        }
      };

      void teardown();
    };
  }, [requestId, role, user?.fullname, user?.profileImage, user?.userId]);

  const handleHangup = async () => {
    if (!resources || !user?.userId) {
      router.back();
      return;
    }

    try {
      await resources.call.leave();
    } catch (error) {
      console.warn("Error leaving teleconsultation call:", error);
    }

    if (role === "provider" && joinedRef.current) {
      try {
        await socketService.updateRequestStatus(
          requestId,
          user.userId,
          "completed",
        );
      } catch (error) {
        console.warn("Unable to mark teleconsultation as completed:", error);
      }
    }

    try {
      await resources.client.disconnectUser();
    } catch (error) {
      console.warn("Error disconnecting Stream client after hangup:", error);
    }

    router.back();
  };

  const handleRetry = () => {
    router.replace({
      pathname:
        role === "patient"
          ? "/(app)/(patient)/teleconsultation-call"
          : "/(app)/(provider)/teleconsultation-call",
      params: { requestId },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.stateTitle}>Joining teleconsultation...</Text>
        <Text style={styles.stateSubtitle}>
          We&apos;re preparing your secure video session.
        </Text>
      </SafeAreaView>
    );
  }

  if (errorMessage || !resources) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Text style={styles.errorTitle}>Unable to open call</Text>
        <Text style={styles.errorText}>
          {errorMessage ||
            "We could not prepare this teleconsultation call right now."}
        </Text>
        <TouchableOpacity onPress={handleRetry} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Teleconsultation</Text>
        <Text style={styles.headerSubtitle}>
          Connected through secure video consultation
        </Text>
      </View>

      <View style={styles.callShell}>
        <StreamVideo client={resources.client}>
          <StreamCall call={resources.call}>
            <CallStateWatcher
              requestId={requestId}
              requestStatus={resources.access.requestStatus}
              userId={currentUserId}
              onJoined={() => {
                joinedRef.current = true;
              }}
            />
            <CallContent onHangupCallHandler={handleHangup} />
          </StreamCall>
        </StreamVideo>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
  },
  callShell: {
    flex: 1,
    backgroundColor: "#020617",
  },
  stateScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F8FAFC",
  },
  stateTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  stateSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  linkButton: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
});
