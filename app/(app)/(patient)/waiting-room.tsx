import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../lib/socket';
import PatientProviderTracking from '../../../components/(patient)/PatientProviderTracking';
import ProviderMap from '../../../components/(patient)/ProviderMap';

interface RequestStatus {
  _id: string;
  status: 'searching' | 'pending' | 'accepted' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'rejected';
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  createdAt: string;
  ailmentCategoryId?: {
    _id: string;
    title: string;
  };
  providerId?: {
    _id: string;
    fullname: string;
    cellphoneNumber: string;
    role: string;
    walletID: string;
  };
  patientId?: {
    _id: string;
    fullname: string;
    walletID: string;
  };
  providerResponse?: {
    responseTime: string;
    estimatedArrival: string;
  };
  timeline?: {
    requested: string;
    providerAccepted: string;
    providerEnRoute: string;
    providerArrived: string;
    consultationStarted: string;
    consultationCompleted: string;
  };
  address?: {
    route: string;
    locality: string;
    administrative_area_level_1: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
}

interface StoredRequest {
  request: RequestStatus;
  acceptedAt: number; // Timestamp when request was accepted
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'searching':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'search' };
      case 'pending':
        return { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'clock' };
      case 'accepted':
        return { bg: 'bg-green-100', text: 'text-green-800', icon: 'check-circle' };
      case 'en_route':
        return { bg: 'bg-purple-100', text: 'text-purple-800', icon: 'navigation' };
      case 'arrived':
        return { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: 'map-pin' };
      case 'in_progress':
        return { bg: 'bg-orange-100', text: 'text-orange-800', icon: 'activity' };
      case 'completed':
        return { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: 'check' };
      case 'cancelled':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: 'x-circle' };
      case 'expired':
      case 'rejected':
        return { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'alert-circle' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'help-circle' };
    }
  };

  const colors = getStatusColor();
  return (
    <View className={`${colors.bg} px-3 py-1 rounded-full flex-row items-center gap-1`}>
      <Feather name={colors.icon as any} size={12} color={colors.text.replace('text-', '')} />
      <Text className={`${colors.text} text-xs font-semibold capitalize`}>
        {status.replace('_', ' ')}
      </Text>
    </View>
  );
};

const UrgencyBadge = ({ urgency }: { urgency: string }) => {
  const getUrgencyColor = () => {
    switch (urgency) {
      case 'emergency':
        return 'bg-red-100';
      case 'high':
        return 'bg-orange-100';
      case 'medium':
        return 'bg-yellow-100';
      case 'low':
        return 'bg-blue-100';
      default:
        return 'bg-gray-100';
    }
  };

  return (
    <View className={`${getUrgencyColor()} px-2 py-1 rounded`}>
      <Text className="text-xs font-semibold capitalize">{urgency}</Text>
    </View>
  );
};

const RequestCard = ({ item, onCancel, patientLocation }: { item: StoredRequest; onCancel?: (requestId: string) => void; patientLocation?: { latitude: number; longitude: number } | null }) => {
  const request = item.request;
  const acceptedAt = item.acceptedAt;
  const expiresAt = acceptedAt + 24 * 60 * 60 * 1000; // 24 hours
  const timeRemaining = expiresAt - Date.now();
  const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
  const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
  const [isCancelling, setIsCancelling] = useState(false);
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this healthcare request?',
      [
        {
          text: 'No',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          onPress: async () => {
            try {
              setIsCancelling(true);
              await socketService.cancelRequest(request._id, 'patient', 'Patient cancelled the request');
              // Remove from UI immediately
              onCancel?.(request._id);
              Alert.alert('Cancelled', 'Your request has been cancelled');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel request');
              setIsCancelling(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'searching':
        return 'Searching for available providers...';
      case 'pending':
        return 'Request sent to provider, waiting for response...';
      case 'accepted':
        return `Provider ${request.providerId?.fullname || 'has'} accepted your request`;
      case 'en_route':
        return `Provider is on the way (${request.providerResponse?.estimatedArrival || 'ETA pending'})`;
      case 'arrived':
        return 'Provider has arrived at your location';
      case 'in_progress':
        return 'Consultation is in progress...';
      case 'completed':
        return 'Consultation has been completed';
      case 'cancelled':
        return 'Request was cancelled';
      case 'expired':
        return 'Request expired - no providers available';
      case 'rejected':
        return 'Request was rejected';
      default:
        return status;
    }
  };

  return (
    <View className="bg-white rounded-xl p-4 mb-4 border border-gray-200 shadow-sm">
      {/* Header with status */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800 mb-2">
            {request.ailmentCategoryId?.title || 'Healthcare Request'}
          </Text>
          <View className="flex-row gap-2 items-center">
            <StatusBadge status={request.status} />
            <UrgencyBadge urgency={request.urgency} />
          </View>
        </View>
      </View>

      {/* Status description */}
      <Text className="text-sm text-gray-600 mb-3">{getStatusDescription(request.status)}</Text>

      {/* Provider info - only show if accepted */}
      {request.status === 'accepted' && request.providerId && (
        <View className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-200">
          <Text className="text-xs font-semibold text-blue-900 mb-1">Provider Details</Text>
          <View className="flex-row items-center mb-2">
            <Feather name="user" size={14} color="#1e40af" />
            <Text className="text-sm font-semibold text-gray-800 ml-2">
              {request.providerId.fullname}
            </Text>
            <View className="ml-auto bg-blue-100 px-2 py-1 rounded">
              <Text className="text-xs font-semibold text-blue-800 capitalize">
                {request.providerId.role}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <Feather name="phone" size={14} color="#1e40af" />
            <Text className="text-sm text-gray-700 ml-2">{request.providerId.cellphoneNumber}</Text>
          </View>
        </View>
      )}

      {/* ETA info - show if provider responded */}
      {request.providerResponse?.estimatedArrival && request.status !== 'in_progress' && request.status !== 'completed' && (
        <View className="bg-green-50 rounded-lg p-3 mb-3 border border-green-200">
          <View className="flex-row items-center">
            <Feather name="navigation" size={14} color="#15803d" />
            <Text className="text-sm font-semibold text-gray-800 ml-2">
              Estimated Arrival: {request.providerResponse.estimatedArrival}
            </Text>
          </View>
        </View>
      )}

      {/* Request details */}
      <View className="bg-gray-50 rounded-lg p-3 mb-3">
        <View className="flex-row items-center mb-2">
          <Feather name="map-pin" size={14} color="#6b7280" />
          <Text className="text-xs text-gray-600 ml-2 flex-1">
            {request.address?.route}, {request.address?.locality}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Feather name="calendar" size={14} color="#6b7280" />
          <Text className="text-xs text-gray-600 ml-2">
            Requested: {new Date(request.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Expiration notice for accepted requests */}
      {request.status === 'accepted' && timeRemaining > 0 && (
        <View className="bg-amber-50 rounded-lg p-2 border border-amber-200 mb-3">
          <Text className="text-xs text-amber-800">
            This entry will expire in <Text className="font-semibold">{hoursRemaining}h {minutesRemaining}m</Text>
          </Text>
        </View>
      )}

      {/* Track Provider button - show if en_route or arrived */}
      {['en_route', 'arrived'].includes(request.status) && request.providerId && (
        <>
          <TouchableOpacity
            onPress={() => setTrackingModalVisible(true)}
            className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3"
          >
            <View className="flex-row items-center justify-center">
              <Feather name="map" size={16} color="#15803d" />
              <Text className="text-green-600 font-semibold text-sm ml-2">Track Provider on Map</Text>
            </View>
          </TouchableOpacity>

          <PatientProviderTracking
            visible={trackingModalVisible}
            onClose={() => setTrackingModalVisible(false)}
            requestId={request._id}
            patientLocation={patientLocation || request.address?.coordinates}
            providerName={request.providerId.fullname}
            providerRole={request.providerId.role}
          />
        </>
      )}

      {/* Cancel button for active requests */}
      {['searching', 'pending', 'accepted', 'en_route'].includes(request.status) && (
        <TouchableOpacity
          onPress={handleCancel}
          disabled={isCancelling}
          className="bg-red-50 border border-red-200 rounded-lg p-3"
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <View className="flex-row items-center justify-center">
              <Feather name="x-circle" size={16} color="#dc2626" />
              <Text className="text-red-600 font-semibold text-sm ml-2">Cancel Request</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function WaitingRoom() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<StoredRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [patientLocation, setPatientLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  // Track provider locations keyed by requestId (populated after provider accepts and via realtime updates)
  const [providerLocations, setProviderLocations] = useState<Record<string, { latitude: number; longitude: number }>>({});

  const handleRequestCancelled = useCallback((requestId: string) => {
    setRequests((prev) => prev.filter((item) => item.request._id !== requestId));
  }, []);

  // Get patient's current location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission denied, using default');
          setPatientLocation({ latitude: -26.2041, longitude: 28.0473 }); // Pretoria default
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setPatientLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } catch (error) {
        console.error('Error getting location:', error);
        setPatientLocation({ latitude: -26.2041, longitude: 28.0473 }); // Default location
      }
    })();
  }, []);

  // Fetch requests from socket and load stored requests
  const loadRequests = useCallback(async () => {
    try {
      // Get stored requests from AsyncStorage
      const storedData = await AsyncStorage.getItem(`waiting-room-${user?.userId}`);
      let storedRequests: StoredRequest[] = storedData ? JSON.parse(storedData) : [];

      // Also fetch live requests from socket
      if (user?.userId && socketService.getSocket()?.connected) {
        try {
          const liveRequests = await socketService.getPatientRequests(user.userId);
          if (Array.isArray(liveRequests)) {
            // Create a set of live request IDs for filtering
            const liveRequestIds = new Set(liveRequests.map((req: RequestStatus) => req._id));

            // Filter stored requests to only keep those that exist in live data
            storedRequests = storedRequests.filter((item) => liveRequestIds.has(item.request._id));

            // Merge live requests with stored ones, prioritizing live data
            const mergedRequests = new Map<string, StoredRequest>();

            // Add stored requests first
            storedRequests.forEach((item) => {
              mergedRequests.set(item.request._id, item);
            });

            const now = Date.now();

            // Override with live requests
            liveRequests.forEach((req: RequestStatus) => {
              const stored = mergedRequests.get(req._id);
              if (stored && stored.request.status === 'accepted' && req.status !== 'accepted') {
                // Keep the original acceptedAt timestamp
                mergedRequests.set(req._id, { request: req, acceptedAt: stored.acceptedAt });
              } else {
                // For newly accepted requests, record the time
                const acceptedAt = req.status === 'accepted' && !stored ? now : stored?.acceptedAt || now;
                mergedRequests.set(req._id, { request: req, acceptedAt });
              }
            });

            const merged = Array.from(mergedRequests.values());
            setRequests(merged);

            // For any already-accepted requests, try to fetch initial provider location
            merged.forEach((item) => {
              try {
                if (item.request.status === 'accepted' && item.request._id) {
                  socketService.getSocket()?.emit('getProviderLocation', { requestId: item.request._id }, (location: any) => {
                    if (location && location.latitude && location.longitude) {
                      setProviderLocations((prev) => ({ ...prev, [item.request._id]: location }));
                    }
                  });
                }
              } catch (e) {
                console.warn('Could not fetch provider location for stored accepted request', e);
              }
            });

            // Save updated requests to storage (now only valid ones)
            await AsyncStorage.setItem(`waiting-room-${user?.userId}`, JSON.stringify(merged));
          } else {
            setRequests(storedRequests);
          }
        } catch (error) {
          console.log('Could not fetch live requests, using stored:', error);
          setRequests(storedRequests);
        }
      } else {
        // If not connected, still validate stored requests against last known state
        const now = Date.now();
        storedRequests = storedRequests.filter((item) => {
          if (item.request.status === 'accepted') {
            const expiresAt = item.acceptedAt + 24 * 60 * 60 * 1000;
            return now < expiresAt;
          }
          // For non-accepted requests, only keep recent ones (within 6 hours)
          const age = now - new Date(item.request.createdAt).getTime();
          return age < 6 * 60 * 60 * 1000;
        });
        setRequests(storedRequests);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      setRequests([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.userId]);

  // Initial load on mount
  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  // Set up socket listeners
  useEffect(() => {
    if (!user?.userId) return;

    const handleRequestUpdated = async (updatedRequest: RequestStatus) => {
      setRequests((prev) => {
        const updated = prev.map((item) => {
          if (item.request._id === updatedRequest._id) {
            // Preserve acceptedAt timestamp if transitioning to accepted
            const acceptedAt =
              updatedRequest.status === 'accepted' && item.request.status !== 'accepted'
                ? Date.now()
                : item.acceptedAt;
            return { request: updatedRequest, acceptedAt };
          }
          return item;
        });

        // If request not in list but is in active state, add it
        if (
          !updated.find((r) => r.request._id === updatedRequest._id) &&
          ['searching', 'pending', 'accepted', 'en_route', 'arrived', 'in_progress'].includes(updatedRequest.status)
        ) {
          updated.push({
            request: updatedRequest,
            acceptedAt: updatedRequest.status === 'accepted' ? Date.now() : Date.now(),
          });
        }

        // Save to storage
        AsyncStorage.setItem(`waiting-room-${user.userId}`, JSON.stringify(updated)).catch((e) =>
          console.error('Failed to save requests:', e)
        );

        // If this request just moved to accepted, try fetching provider's last known location
        try {
          if (updatedRequest.status === 'accepted' && updatedRequest._id) {
            socketService.getSocket()?.emit('getProviderLocation', { requestId: updatedRequest._id }, (location: any) => {
              if (location && location.latitude && location.longitude) {
                setProviderLocations((prev) => ({ ...prev, [updatedRequest._id]: location }));
              }
            });
          }
        } catch (e) {
          console.warn('Could not fetch provider location on accept:', e);
        }

        return updated;
      });
    };

    const handleNewRequestAvailable = async (newRequest: RequestStatus) => {
      setRequests((prev) => {
        if (prev.find((r) => r.request._id === newRequest._id)) {
          return prev;
        }
        return [
          { request: newRequest, acceptedAt: Date.now() },
          ...prev,
        ];
      });
    };

    // Set up listeners
    socketService.onRequestUpdated(handleRequestUpdated);
    socketService.onNewRequestAvailable(handleNewRequestAvailable);

    // Listen for provider location realtime updates and store by requestId
    const handleProviderLocationUpdate = (data: any) => {
      try {
        if (data?.requestId && data.location && data.location.latitude && data.location.longitude) {
          setProviderLocations((prev) => ({ ...prev, [data.requestId]: data.location }));
        }
      } catch (e) {
        console.warn('Error handling provider location update', e);
      }
    };

    socketService.getSocket()?.on('updateProviderLocation', handleProviderLocationUpdate);

    return () => {
      socketService.off('requestUpdated', handleRequestUpdated);
      socketService.off('newRequestAvailable', handleNewRequestAvailable);
      socketService.getSocket()?.off('updateProviderLocation', handleProviderLocationUpdate);
    };
  }, [user?.userId]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadRequests();
  }, [loadRequests]);

  // Sort requests: active/current ones first, then past ones
  const sortedRequests = [...requests]
    .filter(
      (item) =>
        !['completed', 'cancelled', 'expired', 'rejected'].includes(item.request.status)
    )
    .sort((a, b) => {
      const activeStatuses = ['searching', 'pending', 'accepted', 'en_route', 'arrived', 'in_progress'];
      const aIsActive = activeStatuses.includes(a.request.status);
      const bIsActive = activeStatuses.includes(b.request.status);

      // Active requests come first
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // Within same category, sort by creation date (newest first)
      return new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime();
    });

    // Determine first active request (if any) for mapping/visual tracking
    const activeRequest = requests.find((item) =>
      ['accepted', 'en_route', 'arrived', 'in_progress'].includes(item.request.status)
    );

    const showProviderMap = !!patientLocation && !!activeRequest;

    const providersForMap = activeRequest && activeRequest.request.providerId
      ? [
          {
            _id: activeRequest.request.providerId._id || `provider-${activeRequest.request._id}`,
            firstname: activeRequest.request.providerId.fullname || activeRequest.request.providerId.name,
            location: providerLocations[activeRequest.request._id],
          },
        ]
      : [];

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#007BFF" />
        <Text className="text-gray-600 mt-4">Loading your requests...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom', 'left', 'right']}>
      {/* Map panel: shows provider + route when a provider has accepted and location is available */}
      {showProviderMap && patientLocation && (
        <View style={{ height: 220, width: '100%' }} className="px-4 mb-4">
          <ProviderMap
            userLatitude={patientLocation.latitude}
            userLongitude={patientLocation.longitude}
            destinationLatitude={providerLocations[activeRequest?.request._id!]?.latitude}
            destinationLongitude={providerLocations[activeRequest?.request._id!]?.longitude}
            providers={providersForMap}
            onTimesCalculated={() => { /* can store times if needed */ }}
          />
        </View>
      )}
      <FlatList
        data={sortedRequests}
        keyExtractor={(item) => item.request._id}
        renderItem={({ item }) => <RequestCard item={item} onCancel={handleRequestCancelled} patientLocation={patientLocation} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="mb-4">
            <Text className="text-2xl font-bold">
              Track your healthcare requests and provider status
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="bg-white rounded-xl p-6 items-center border border-gray-200">
            <Feather name="inbox" size={48} color="#9CA3AF" />
            <Text className="text-lg font-semibold text-gray-800 mt-4">No Active Requests</Text>
            <Text className="text-sm text-gray-600 text-center mt-2">
              When you submit a healthcare request, it will appear here. You can track the status of your request and
              see provider details once they accept.
            </Text>
            <Text className="text-xs text-gray-500 text-center mt-3">
              Accepted requests will be shown here for 24 hours
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      />
    </SafeAreaView>
  );
}
