import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../context/RouteContext';
import ProviderRouteModal from '../ProviderRouteModal';

export default function GlobalRouteModal() {
    const authContext = useAuth();
    const { activeRoute, clearRoute } = useRoute();

    // Safely get user from auth context
    const user = authContext?.user || null;

    // Early return if user or activeRoute is not available
    // Check both that user exists and has userId
    const isReady = useMemo(() => {
        return activeRoute && user && user.userId;
    }, [activeRoute, user]);

    if (!isReady) {
        return null;
    }

    // At this point, TypeScript should know user is not null
    // But we'll add an extra safety check
    if (!user || !user.userId || !activeRoute) {
        console.warn('GlobalRouteModal: Missing required data', { user: !!user, userId: user?.userId, activeRoute: !!activeRoute });
        return null;
    }

    // Debug logging
    console.log('GlobalRouteModal - Provider profileImage:', user.profileImage);
    console.log('GlobalRouteModal - Patient profileImage:', activeRoute.patientId?.profileImage);
    console.log('GlobalRouteModal - ActiveRoute:', JSON.stringify(activeRoute, null, 2));

    return (
        <ProviderRouteModal
            visible={!!activeRoute}
            onClose={clearRoute}
            requestId={activeRoute._id}
            providerId={user.userId}
            patientLocation={activeRoute.address?.coordinates}
            patientName={activeRoute.patientId?.fullname}
            patientAddress={activeRoute.address?.route || activeRoute.address?.locality || undefined}
            providerProfileImage={user.profileImage}
            patientProfileImage={activeRoute.patientId?.profileImage}
            onCompleteRoute={clearRoute}
        />
    );
}
