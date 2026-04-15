import apiClient from "./api";

export interface TeleconsultationCallAccess {
  apiKey: string;
  callId: string;
  callType: string;
  token: string;
  requestId: string;
  requestStatus: "ready_for_call" | "in_call";
}

export const getTeleconsultationCallAccess = async (
  requestId: string,
): Promise<TeleconsultationCallAccess> => {
  const response = await apiClient.get(
    `/app/teleconsultation/call-access/${requestId}`,
  );

  return response.data.data as TeleconsultationCallAccess;
};
