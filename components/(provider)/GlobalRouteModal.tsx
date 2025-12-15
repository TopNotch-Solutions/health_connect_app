import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../context/RouteContext';
import ProviderRouteModal from '../ProviderRouteModal';

export default function GlobalRouteModal() {
    const { user } = useAuth();
    const { activeRoute, clearRoute } = useRoute();

    if (!activeRoute || !user?.userId) return null;

    return (
        <ProviderRouteModal
            visible={!!activeRoute}
            onClose={clearRoute}
            requestId={activeRoute._id}
            providerId={user.userId}
            patientLocation={activeRoute.address?.coordinates}
            patientName={activeRoute.patientId?.fullname}
            patientAddress={activeRoute.address?.route}
            onCompleteRoute={clearRoute}
        />
    );
}
