import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../context/RouteContext';
import socketService from '../../lib/socket';
import ProviderMap from '../(patient)/ProviderMap';

export default function GlobalRouteModal() {
    const { user, isAuthenticated } = useAuth();
    const { activeRoute, clearRoute } = useRoute();
    const [providerLocation, setProviderLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const routeWatcherRef = useRef<any>(null);

    useEffect(() => {
        let isMounted = true;
        const startRouteWatch = async () => {
            if (!activeRoute || !user?.userId || !isAuthenticated) return;

            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') throw new Error("Location permission is required to track the route.");

                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                if (!isMounted) return;
                setProviderLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

                routeWatcherRef.current = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, distanceInterval: 25, timeInterval: 5000 },
                    (position) => {
                        if (!isMounted) return;
                        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                        setProviderLocation(coords);
                        try {
                            socketService.updateProviderLocation(activeRoute._id, user.userId, coords);
                        } catch (error) {
                            console.error('Error updating provider location:', error);
                        }
                    }
                );
            } catch (e: any) { 
                console.error('Error starting route watch:', e.message);
                Alert.alert("Route Error", e.message);
                clearRoute(); // Close modal if location fails
            }
        };

        if (activeRoute) {
            startRouteWatch();
        }

        return () => {
            isMounted = false;
            if (routeWatcherRef.current) {
                routeWatcherRef.current.remove();
                routeWatcherRef.current = null;
            }
        };
    }, [activeRoute, user?.userId, isAuthenticated, clearRoute]);

    if (!activeRoute) return null;

    const handleArrived = async () => {
        if (!user?.userId) return;
        try {
            await socketService.updateRequestStatus(activeRoute._id, user.userId, 'arrived', providerLocation!);
            clearRoute();
            Alert.alert('Success', "You've arrived at the patient's location!");
        } catch (error: any) {
            console.error('Error marking as arrived:', error);
            Alert.alert('Error', error.message || 'Failed to mark as arrived');
        }
    };
    
    const handleCancelRoute = () => {
        Alert.alert("Cancel Route", "Are you sure you want to cancel this route?", [
            { text: "No", style: "cancel" },
            { text: "Yes, Cancel", style: "destructive", onPress: () => {
                // TODO: Add socket event for cancellation if it exists
                clearRoute();
            }}
        ]);
    };

    return (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'white' }}>
            <View style={{ paddingTop: 50, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                <View>
                    <Text style={{ fontSize: 18, fontWeight: '700' }}>Route to {activeRoute.patientId?.fullname || 'Patient'}</Text>
                </View>
                <TouchableOpacity onPress={clearRoute}><Feather name="x" size={24} /></TouchableOpacity>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
                {(providerLocation && activeRoute.address?.coordinates) ? (
                    <ProviderMap
                        userLatitude={providerLocation.latitude}
                        userLongitude={providerLocation.longitude}
                        destinationLatitude={activeRoute.address.coordinates.latitude}
                        destinationLongitude={activeRoute.address.coordinates.longitude}
                    />
                ) : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View>}
            </View>
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={handleCancelRoute} style={{ flex: 1, backgroundColor: '#fee2e2', padding: 14, borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#ef4444', fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleArrived} style={{ flex: 1, backgroundColor: '#10b981', padding: 14, borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Mark as Arrived</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
