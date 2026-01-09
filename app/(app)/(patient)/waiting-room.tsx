import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PatientProviderTracking from '../../../components/(patient)/PatientProviderTracking';
import ProviderMap from '../../../components/(patient)/ProviderMap';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../lib/socket';

interface RequestStatus {
  _id: string;
  status: 'searching' | 'pending' | 'accepted' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'rejected';
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
    profileImage?: string;
  };
  patientId?: {
    _id: string;
    fullname: string;
    walletID: string;
    profileImage?: string;
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

const RequestCard = ({ item, onCancel, patientLocation, patientProfileImage }: { item: StoredRequest; onCancel?: (requestId: string) => void; patientLocation?: { latitude: number; longitude: number } | null; patientProfileImage?: string }) => {
  const request = item.request;
  const acceptedAt = item.acceptedAt;
  const expiresAt = acceptedAt + 24 * 60 * 60 * 1000; // 24 hours
  const timeRemaining = expiresAt - Date.now();
  const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
  const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
  const [isCancelling, setIsCancelling] = useState(false);
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);

  // Debug logging for profile images
  useEffect(() => {
    if (trackingModalVisible) {
      console.log('RequestCard - Provider profileImage:', request.providerId?.profileImage);
      console.log('RequestCard - Provider object:', JSON.stringify(request.providerId, null, 2));
      console.log('RequestCard - Patient profileImage:', patientProfileImage);
    }
  }, [trackingModalVisible, request.providerId, patientProfileImage]);

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
    <View style={styles.requestCard}>
      {/* Header with status */}
      <View style={styles.requestHeaderRow}>
        <View className="flex-1">
          <Text style={styles.requestTitle}>
            {request.ailmentCategoryId?.title || 'Healthcare Request'}
          </Text>
          <View style={styles.requestStatusRow}>
            <StatusBadge status={request.status} />
          </View>
        </View>
      </View>

      {/* Status description */}
      <Text style={styles.requestDescription}>{getStatusDescription(request.status)}</Text>

      {/* Provider info - only show if accepted */}
      {request.status === 'accepted' && request.providerId && (
        <View style={styles.providerCard}>
          <Text style={styles.providerCardLabel}>Provider Details</Text>
          <View style={styles.providerHeaderRow}>
            <Feather name="user" size={14} color="#1e40af" />
            <Text style={styles.providerName}>
              {request.providerId.fullname}
            </Text>
            <View style={styles.providerRolePill}>
              <Text style={styles.providerRoleText}>
                {request.providerId.role}
              </Text>
            </View>
          </View>
          <View style={styles.providerPhoneRow}>
            <Feather name="phone" size={14} color="#1e40af" />
            <Text style={styles.providerPhone}>{request.providerId.cellphoneNumber}</Text>
          </View>
        </View>
      )}

      {/* ETA info - show if provider responded */}
      {request.providerResponse?.estimatedArrival && request.status !== 'in_progress' && request.status !== 'completed' && (
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <Feather name="navigation" size={14} color="#15803d" />
            <Text style={styles.etaText}>
              Estimated Arrival: {request.providerResponse.estimatedArrival}
            </Text>
          </View>
        </View>
      )}

      {/* Request details */}
      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={14} color="#6b7280" />
          <Text style={styles.metaText} numberOfLines={2}>
            {request.address?.route}, {request.address?.locality}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={14} color="#6b7280" />
          <Text style={styles.metaText}>
            Requested: {new Date(request.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Expiration notice for accepted requests */}
      {request.status === 'accepted' && timeRemaining > 0 && (
        <View style={styles.expiryCard}>
          <Text style={styles.expiryText}>
            This entry will expire in <Text className="font-semibold">{hoursRemaining}h {minutesRemaining}m</Text>
          </Text>
        </View>
      )}

      {/* Track Provider button - show if en_route or arrived */}
      {['en_route', 'arrived'].includes(request.status) && request.providerId && (
        <>
          <TouchableOpacity
            onPress={() => setTrackingModalVisible(true)}
            style={styles.trackButton}
          >
            <View style={styles.trackButtonRow}>
              <Feather name="map" size={16} color="#15803d" />
              <Text style={styles.trackButtonText}>Track Provider on Map</Text>
            </View>
          </TouchableOpacity>

          <PatientProviderTracking
            visible={trackingModalVisible}
            onClose={() => setTrackingModalVisible(false)}
            requestId={request._id}
            patientLocation={patientLocation || request.address?.coordinates}
            providerName={request.providerId.fullname}
            providerRole={request.providerId.role}
            providerProfileImage={request.providerId.profileImage}
            patientProfileImage={patientProfileImage}
          />
        </>
      )}

      {/* Cancel button for active requests */}
      {['searching', 'pending', 'accepted', 'en_route'].includes(request.status) && (
        <TouchableOpacity
          onPress={handleCancel}
          disabled={isCancelling}
          style={styles.cancelButton}
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <View style={styles.cancelButtonRow}>
              <Feather name="x-circle" size={16} color="#dc2626" />
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
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

    const handleRequestStatusChanged = (data: { requestId: string; status: any }) => {
      console.log('🔔 Request status changed:', data);
      setRequests((prev) => {
        return prev.map((item) => {
          if (item.request._id === data.requestId) {
            // Update status locally
            const updatedRequest = { ...item.request, status: data.status };
            
            // If accepted, update timestamp
            const acceptedAt = data.status === 'accepted' && item.request.status !== 'accepted' 
              ? Date.now() 
              : item.acceptedAt;

            return { request: updatedRequest, acceptedAt };
          }
          return item;
        });
      });
      
      // If status changed to something that might have new data (like accepted -> provider assigned),
      // we should probably reload the full request to get provider details if we don't have them.
      if (data.status === 'accepted' || data.status === 'en_route') {
        loadRequests();
      }
    };

    // Set up listeners
    socketService.onRequestUpdated(handleRequestUpdated);
    socketService.onNewRequestAvailable(handleNewRequestAvailable);
    socketService.onRequestStatusChanged(handleRequestStatusChanged);

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
      socketService.off('requestStatusChanged', handleRequestStatusChanged);
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
            firstname: activeRequest.request.providerId.fullname,
            location: providerLocations[activeRequest.request._id],
          },
        ]
      : [];

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={styles.loadingText}>Loading your requests...</Text>
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
        renderItem={({ item }) => <RequestCard item={item} onCancel={handleRequestCancelled} patientLocation={patientLocation} patientProfileImage={user?.profileImage} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Track your healthcare requests and provider status</Text>
            <Text style={styles.headerSubtitle}>
              Track your healthcare requests and see your provider&apos;s status in real time.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Feather name="inbox" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Active Requests</Text>
            <Text style={styles.emptyText}>
              When you submit a healthcare request, it will appear here. You can track the status of your request and
              see provider details once they accept.
            </Text>
            <Text style={styles.emptyHint}>
              Accepted requests will be shown here for 24 hours
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  requestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  requestStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestDescription: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 10,
  },
  providerCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  providerCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  providerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 6,
    flex: 1,
  },
  providerRolePill: {
    marginLeft: 'auto',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  providerRoleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
    textTransform: 'capitalize',
  },
  providerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerPhone: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 6,
  },
  etaCard: {
    backgroundColor: '#ECFDF3',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#14532D',
    marginLeft: 6,
  },
  metaCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#4B5563',
    marginLeft: 6,
    flex: 1,
  },
  expiryCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  expiryText: {
    fontSize: 11,
    color: '#92400E',
  },
  trackButton: {
    backgroundColor: '#ECFDF3',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 8,
  },
  trackButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803D',
    marginLeft: 6,
  },
  cancelButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 6,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 8,
  },
});
