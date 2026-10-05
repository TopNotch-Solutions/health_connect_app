import React, { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRoute } from "../../context/RouteContext";
import { getPatientLocationFromRequest } from "../../lib/coordinate";
import ProviderRouteModal from "../ProviderRouteModal";

export default function GlobalRouteModal() {
  const authContext = useAuth();
  const { activeRoute, clearRoute } = useRoute();

  const user = authContext?.user || null;

  const patientLocation = useMemo(
    () => (activeRoute ? getPatientLocationFromRequest(activeRoute) : null),
    [activeRoute],
  );

  const isReady = useMemo(() => {
    return activeRoute && user && user.userId;
  }, [activeRoute, user]);

  if (!isReady || !user?.userId || !activeRoute) {
    return null;
  }

  const patientAddress = [
    activeRoute.address?.route,
    activeRoute.address?.locality,
    activeRoute.address?.administrative_area_level_1,
  ]
    .filter(Boolean)
    .join(", ");

  const ailmentTitle =
    typeof activeRoute.ailmentCategoryId === "object"
      ? activeRoute.ailmentCategoryId?.title || "Healthcare Request"
      : activeRoute.ailmentCategoryId || "Healthcare Request";

  return (
    <ProviderRouteModal
      visible={!!activeRoute}
      onClose={clearRoute}
      requestId={activeRoute._id}
      providerId={user.userId}
      patientLocation={patientLocation ?? undefined}
      patientName={activeRoute.patientId?.fullname}
      patientAddress={patientAddress || undefined}
      providerProfileImage={user.profileImage}
      patientProfileImage={activeRoute.patientId?.profileImage}
      onCompleteRoute={clearRoute}
      ailmentTitle={ailmentTitle}
      consultationMode={activeRoute.consultationMode}
      createdAt={activeRoute.createdAt}
    />
  );
}
