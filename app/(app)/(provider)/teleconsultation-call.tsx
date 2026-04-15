import TeleconsultationCallScreen from "@/components/teleconsultation/TeleconsultationCallScreen";
import { useLocalSearchParams } from "expo-router";
import React from "react";

export default function ProviderTeleconsultationCallRoute() {
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const requestId = Array.isArray(params.requestId)
    ? params.requestId[0]
    : params.requestId;

  return (
    <TeleconsultationCallScreen requestId={requestId || ""} role="provider" />
  );
}
