/**
 * App-wide ring + vibrate + voice when consultation status changes.
 * Mount once in patient and provider tab layouts so alerts fire
 * even if the user is not on waiting-room / requests.
 */

import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  alertConsultationStatusChange,
  alertNewRequestAvailable,
  type ConsultationAlertRole,
} from "./consultationAlert";
import socketService from "./socket";

const PROVIDER_ROLES = new Set([
  "doctor",
  "nurse",
  "physiotherapist",
  "social worker",
  "pharmacist",
]);

export function useConsultationStatusAlerts(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.userId) return;

    const roleRaw = String(user.role || "").trim().toLowerCase();
    const isPatient = roleRaw === "patient";
    const alertRole: ConsultationAlertRole = isPatient
      ? "patient"
      : "provider";
    const socketRole = isPatient
      ? "patient"
      : PROVIDER_ROLES.has(roleRaw)
        ? (roleRaw as
            | "doctor"
            | "nurse"
            | "physiotherapist"
            | "social worker"
            | "pharmacist")
        : undefined;

    socketService.connect(user.userId, socketRole);

    // Prefer requestUpdated — backend sends it only to the involved patient/provider.
    // requestStatusChanged is a global broadcast and would falsely alert other users.
    const handleRequestUpdated = (data: {
      _id?: string;
      status?: string;
    }) => {
      if (!data?.status) return;
      void alertConsultationStatusChange(data.status, data._id, alertRole);
    };

    const handleNewRequest = () => {
      if (isPatient) return;
      void alertNewRequestAvailable();
    };

    const attach = () => {
      // Re-bind cleanly after reconnect (avoid duplicate handlers)
      socketService.off("requestUpdated", handleRequestUpdated);
      socketService.off("newRequestAvailable", handleNewRequest);

      socketService.onRequestUpdated(handleRequestUpdated);
      if (!isPatient) {
        socketService.onNewRequestAvailable(handleNewRequest);
      }
    };

    attach();

    const sock = socketService.getSocket();
    const onConnect = () => attach();
    sock?.on("connect", onConnect);

    return () => {
      sock?.off("connect", onConnect);
      socketService.off("requestUpdated", handleRequestUpdated);
      socketService.off("newRequestAvailable", handleNewRequest);
    };
  }, [user?.userId, user?.role]);
}
