import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAuth } from "../../../context/AuthContext";
import socketService from "../../../lib/socket";
import { useRoute } from "../../../context/RouteContext";

interface Request {
  _id: string;
  patientId: {
    fullname: string;
    cellphoneNumber?: string;
    walletID?: string;
  };
  ailmentCategoryId?: {
    title: string;
  } | string;
  status: 'searching' | 'pending' | 'accepted' | 'rejected' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
  estimatedCost: number | string;
  symptoms?: string;
  address?: {
    route?: string;
    locality: string;
    administrative_area_level_1: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  createdAt?: string;
  timeline?: any;
  [key: string]: any;
}

export default function ProviderRequests() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'completed'>('all');
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { startRoute } = useRoute();
  const { user } = useAuth();
  const loadRequests = useCallback(async () => {
    if (!user?.userId) {
      console.log('⚠️ No userId available');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('📥 Fetching provider requests for:', user.userId);

      // This screen is authoritative for provider requests
      const providerRequests = await socketService.getProviderRequests(user.userId);
      console.log('✅ Fetched provider requests:', providerRequests);
      setRequests(Array.isArray(providerRequests) ? providerRequests : []);
    } catch (error: any) {
      console.error('❌ Error loading requests:', error);
      Alert.alert('Error', 'Failed to load requests: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.userId]);

  // Connect to socket and load initial requests
  useEffect(() => {
    if (user?.userId) {
      console.log('🔌 Connecting socket for requests tab');
      // Default to doctor role, but should ideally use user.role if available
      socketService.connect(user.userId, user.role as any || 'doctor');
      
      const socket = socketService.getSocket();
      
      const handleConnect = () => {
        console.log('✅ Socket connected, loading requests');
        loadRequests();
      };

      if (socket?.connected) {
        console.log('✅ Socket already connected');
        loadRequests();
      } else {
        socket?.on('connect', handleConnect);
      }

      return () => {
        socket?.off('connect', handleConnect);
      };
    }
  }, [user?.userId, user?.role, loadRequests]);

  // Refresh requests when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Requests screen came into focus, refreshing requests');
      console.log('🔄 Current requests in state before reload:', requests.length);
      if (user?.userId) {
        loadRequests();
      }
    }, [user?.userId, loadRequests, requests.length])
  );

  // Listen for new requests and status changes
  useEffect(() => {
    const handleNewRequest = (request: Request) => {
      console.log('📨 New request available:', request);
      setRequests((prev) => [request, ...prev.filter(r => r._id !== request._id)]);
    };

    const handleRequestHidden = (data: { requestId: string }) => {
      console.log('🚫 Request hidden:', data.requestId);
      setRequests((prev) => prev.filter((req) => req._id !== data.requestId));
    };

    const handleRequestStatusChanged = async (data: { requestId: string; status: string; request?: Request }) => {
      console.log('📊 Request status changed:', data);
      console.log('📊 Full request data:', data.request);
      console.log('📊 Request timeline:', data.request?.timeline);
      
      // WORKAROUND: If backend says cancelled but providerAccepted exists, it was actually accepted
      let correctStatus = data.status as any;
      if (data.status === 'cancelled' && data.request?.timeline?.providerAccepted) {
        console.log('⚠️  Backend returned cancelled but providerAccepted exists - correcting status to accepted');
        correctStatus = 'accepted';
      }
      
      setRequests((prev) => {
        const updated = prev.map((req) =>
          req._id === data.requestId 
            ? { ...req, ...data.request, status: correctStatus }
            : req
        );
        
        // Add request if it's not already in the list (e.g., status changed to accepted)
        const exists = updated.some(r => r._id === data.requestId);
        if (!exists && data.request) {
          console.log('📌 Adding new request to state from status change:', data.request._id);
          return [{ ...data.request, status: correctStatus }, ...updated];
        }
        
        return updated;
      });
      
      // Note: persistence to AsyncStorage intentionally removed for Requests tab.
      // The Requests screen uses live data from the server (getProviderRequests)
      // so we only update local state here and avoid writing cached copies.
    };

    socketService.getSocket()?.on('newRequestAvailable', handleNewRequest);
    socketService.getSocket()?.on('requestHidden', handleRequestHidden);
    socketService.getSocket()?.on('requestStatusChanged', handleRequestStatusChanged);

    return () => {
      socketService.getSocket()?.off('newRequestAvailable', handleNewRequest);
      socketService.getSocket()?.off('requestHidden', handleRequestHidden);
      socketService.getSocket()?.off('requestStatusChanged', handleRequestStatusChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.role, loadRequests]);

  const filteredRequests = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'searching' || r.status === 'pending';
    if (filter === 'accepted') return r.status === 'accepted' || r.status === 'in_progress' || r.status === 'arrived' || r.status === 'en_route';
    if (filter === 'completed') return r.status === 'completed';
    return true;
  });

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'searching':
      case 'pending': return { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'clock' };
      case 'accepted': return { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'check-circle' };
      case 'in_progress':
      case 'arrived':
      case 'en_route': return { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'activity' };
      case 'completed': return { bg: 'bg-green-50', text: 'text-green-700', icon: 'check-square' };
      default: return { bg: 'bg-gray-50', text: 'text-gray-700', icon: 'circle' };
    }
  };

  const getAilmentName = (ailment: any) => {
    if (!ailment) return 'Consultation';
    if (typeof ailment === 'string') return ailment;
    return ailment.title || 'Consultation';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Today';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Today';
    }
  };

  // Calculate distance using Haversine formula
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Handle accept request - automatically open map with calculated ETA
  const handleAccept = async (request: Request) => {
    if (!user?.userId || !request.address?.coordinates) {
      Alert.alert('Error', 'Patient location not available');
      return;
    }

    try {
      console.log('✅ Accepting request:', request._id);
      
      // OPEN MAP IMMEDIATELY - synchronously, before any async operations
      console.log('🗺️ Opening map immediately and marking route locally...');
      setCurrentRouteRequest({
        ...request,
        status: 'en_route' as any,
      });
      setRouteModalVisible(true);

      // Update local state immediately to reflect that provider started routing
      setRequests((prev) => {
        const updated = prev.map((req) => (req._id === request._id ? { ...req, status: 'en_route' as any } : req));

        // Persist to AsyncStorage so other screens/refreshes see en_route immediately
        (async () => {
          try {
            if (user?.userId) {
              await AsyncStorage.setItem(`provider-requests-${user.userId}`, JSON.stringify(updated));
              console.log('💾 Persisted en_route to AsyncStorage for request', request._id);
            }
          } catch (e) {
            console.warn('⚠️ Failed to persist requests to AsyncStorage', e);
          }
        })();

        return updated;
      });
      
      // ALL OTHER OPERATIONS HAPPEN IN BACKGROUND (non-blocking, no await)
      (async () => {
        try {
          // Request location permission
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            console.warn('Location permission denied');
            return;
          }

          // Get provider's current location
          const providerLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const providerCoords = {
            latitude: providerLocation.coords.latitude,
            longitude: providerLocation.coords.longitude,
          };

          console.log('📍 Provider location obtained:', providerCoords);

          // Calculate distance and ETA
          if (request.address?.coordinates) {
            const distance = calculateDistance(
              providerCoords.latitude,
              providerCoords.longitude,
              request.address.coordinates.latitude,
              request.address.coordinates.longitude
            );

            const avgSpeed = 40;
            const estimatedMinutes = Math.round((distance / avgSpeed) * 60);
            console.log(`📊 Distance: ${distance.toFixed(1)} km, Estimated time: ${estimatedMinutes} minutes`);

            // Prepare handshake listener BEFORE accepting so we don't miss server event
            const sock = socketService.getSocket();
            let handled = false;

            const onConfirm = async (data: any) => {
              if (!data || data.requestId !== request._id) return;
              if (handled) return;
              handled = true;
              try {
                sock?.off('acceptConfirmed', onConfirm);
                await socketService.updateRequestStatus(request._id, user.userId, 'en_route', providerCoords);
                console.log('✅ Request status updated to en_route after acceptConfirmed');
                setRequests((prev) => prev.map((req) => (req._id === request._id ? { ...req, status: 'en_route' as any } : req)));
              } catch (err) {
                console.warn('⚠️ Failed to update request status to en_route after acceptConfirmed:', err);
              }
            };

            sock?.on('acceptConfirmed', onConfirm);

            // Accept request (now that listener is in place)
            await socketService.acceptRequest(request._id, user.userId);
            console.log('✅ Request accepted by backend (acceptRequest returned)');

            // Fallback: if no acceptConfirmed within 10s, attempt update with retry
            setTimeout(async () => {
              if (handled) return;
              handled = true;
              sock?.off('acceptConfirmed', onConfirm);
              try {
                await socketService.updateRequestStatus(request._id, user.userId, 'en_route', providerCoords);
                console.log('✅ Request status updated to en_route via fallback');
                setRequests((prev) => prev.map((req) => (req._id === request._id ? { ...req, status: 'en_route' as any } : req)));
              } catch (err) {
                console.warn('⚠️ Fallback: failed to set en_route, will retry once', err);
                setTimeout(async () => {
                  try {
                    await socketService.updateRequestStatus(request._id, user.userId, 'en_route', providerCoords);
                    console.log('✅ Request status updated to en_route via fallback retry');
                    setRequests((prev) => prev.map((req) => (req._id === request._id ? { ...req, status: 'en_route' as any } : req)));
                  } catch (e) {
                    console.warn('⚠️ Fallback retry failed', e);
                  }
                }, 2000);
              }
            }, 10000);

            // Send provider response (ETA and location)
            await socketService.updateProviderResponse(request._id, estimatedMinutes.toString(), providerCoords);
            console.log('✅ Provider response sent successfully');
          }
        } catch (error) {
          console.error('❌ Background error:', error);
          // User already has map open, errors are silently handled
        }
      })();
      
    } catch (error: any) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', error.message || 'Failed to accept request');
    }
  };

  // Handle mark route - open route tracking modal
  const handleMarkRoute = async (request: Request) => {
    // 1. Double-check assignment to current user to avoid backend 'not assigned' errors
    const providerIdStr = request.providerId?._id ? String(request.providerId._id) : String(request.providerId || '');
    if (providerIdStr !== String(user?.userId)) {
      console.error('State mismatch detected!');
      console.error('Request providerId:', request.providerId);
      console.error('Current userId:', user?.userId);
      Alert.alert('Sync Error', 'This request is no longer assigned to you. Refreshing the list.', [{ text: 'OK', onPress: loadRequests }]);
      return;
    }

    if (!user?.userId || !request.address?.coordinates) {
      Alert.alert('Error', 'Patient location not available');
      return;
    }

    try {
      console.log('🚗 Opening route modal for request:', request._id);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission Denied', 'Location permission is required.');
      }

      const providerLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const providerCoords = { latitude: providerLocation.coords.latitude, longitude: providerLocation.coords.longitude };

      // Only update status if it's the first time marking the route
      if (request.status === 'accepted') {
      await socketService.updateRequestStatus(request._id, user.userId, 'en_route', providerCoords);
        // Optimistically update the local state for immediate UI feedback
        setRequests(prev => prev.map(req => req._id === request._id ? { ...req, status: 'en_route' as any } : req));
      }

      // Start global route modal via context with updated request status
      startRoute({ ...request, status: 'en_route' as any });
    } catch (error: any) {
      console.error('Error marking route:', error);
      Alert.alert('Error', error.message || 'Failed to mark route');
    }
  };

  // Handle route completion
  const handleRouteComplete = useCallback(() => {
    console.log('✅ Route completed');
    try {
      // Reload requests after a small delay to ensure modal is closed first
      setTimeout(() => {
        console.log('🔄 Reloading requests after route completion');
        loadRequests();
      }, 500);
    } catch (error) {
      console.error('Error in handleRouteComplete:', error);
    }
  }, [loadRequests]);

  // Handle complete request
  const handleComplete = async (requestId: string, patientName: string) => {
    if (!user?.userId) return;

    try {
      console.log('✅ Completing request:', requestId);
      await socketService.updateRequestStatus(requestId, user.userId, 'completed', undefined);
      
      // Update local state
      setRequests((prev) =>
        prev.map((req) =>
          req._id === requestId ? { ...req, status: 'completed' as any } : req
        )
      );
      
      Alert.alert('Success', `Consultation completed for ${patientName}!`);
    } catch (error: any) {
      console.error('Error completing request:', error);
      Alert.alert('Error', error.message || 'Failed to complete request');
    }
  };

  // Handle decline request
  const handleDecline = async (requestId: string, patientName: string) => {
    if (!user?.userId) return;

    try {
      await socketService.rejectRequest(requestId, user.userId);
      setRequests((prev) => prev.filter((req) => req._id !== requestId));
      Alert.alert('Declined', `Declined consultation request from ${patientName}`);
    } catch (error: any) {
      console.error('Error declining request:', error);
      Alert.alert('Error', error.message || 'Failed to decline request');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom', 'left', 'right']}>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="bg-white pt-6 pb-4 px-6 border-b border-gray-200">
          <Text className="text-2xl font-bold text-gray-900 mb-1">
            My Requests
          </Text>
          <Text className="text-sm text-gray-500">
            View and manage your consultations
          </Text>
        </View>

        {/* Filter Tabs */}
        <View className="px-6 pt-4 pb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row" style={{ gap: 8 }}>
              {['all', 'pending', 'accepted', 'completed'].map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f as any)}
                  className={`px-5 py-2.5 rounded-xl ${
                    filter === f ? 'bg-blue-600' : 'bg-white border border-gray-200'
                  }`}
                >
                  <Text className={`font-bold text-sm capitalize ${
                    filter === f ? 'text-white' : 'text-gray-600'
                  }`}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Requests List */}
        <View className="px-6 pt-4 pb-6">
          {isLoading ? (
            <View className="bg-white rounded-xl border border-gray-200 p-10 items-center">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-sm text-gray-500 mt-4">Loading requests...</Text>
            </View>
          ) : filteredRequests.length === 0 ? (
            <View className="bg-white rounded-xl border border-gray-200 p-10 items-center">
              <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4">
                <Feather name="folder" size={32} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-semibold text-gray-900 mb-1">
                No Requests
              </Text>
              <Text className="text-sm text-gray-500 text-center">
                No {filter !== 'all' && filter} requests found
              </Text>
            </View>
          ) : (
            filteredRequests.map((request) => {
              const statusStyle = getStatusStyle(request.status);
              const patientName = request.patientId?.fullname || 'Unknown Patient';
              const ailmentName = getAilmentName(request.ailmentCategoryId);
              const fee = `N$ ${request.estimatedCost || 0}`;
              
              return (
                <View
                  key={request._id}
                  className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-gray-900 mb-1">
                        {patientName}
                      </Text>
                      <View className="flex-row items-center mb-1">
                        <Feather name="alert-circle" size={14} color="#6B7280" />
                        <Text className="text-sm text-gray-600 ml-1.5">
                          {ailmentName}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Feather name="calendar" size={14} color="#6B7280" />
                        <Text className="text-sm text-gray-500 ml-1.5">
                          {formatDate(request.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <View className={`${statusStyle.bg} px-3 py-1.5 rounded-full`}>
                      <Text className={`${statusStyle.text} text-xs font-bold capitalize`}>
                        {request.status}
                      </Text>
                    </View>
                  </View>

                  <View className="bg-gray-50 rounded-lg p-3 flex-row items-center justify-between mb-3">
                    <Text className="text-xs text-gray-500">Consultation Fee</Text>
                    <Text className="text-base font-bold text-gray-900">{fee}</Text>
                  </View>

                  {/* Location Information */}
                  {request.address && (
                    <View className="bg-blue-50 rounded-lg p-3 mb-3 flex-row items-start">
                      <Feather name="map-pin" size={16} color="#3B82F6" style={{ marginTop: 2, marginRight: 8 }} />
                      <View className="flex-1">
                        <Text className="text-xs text-blue-700 font-semibold">
                          {request.address.locality}, {request.address.administrative_area_level_1}
                        </Text>
                        <Text className="text-xs text-blue-600 mt-0.5">
                          {request.address.route}
                        </Text>
                      </View>
                    </View>
                  )}

                  {request.status === 'searching' || request.status === 'pending' ? (
                    <View className="flex-row gap-2 mt-3">
                      <TouchableOpacity 
                        onPress={() => handleDecline(request._id, patientName)}
                        className="flex-1 bg-gray-100 py-3 rounded-lg border border-gray-200"
                      >
                        <Text className="text-gray-700 font-bold text-center">Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleAccept(request)}
                        className="flex-1 bg-blue-600 py-3 rounded-lg"
                      >
                        <Text className="text-white font-bold text-center">Accept</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (request.status === 'accepted' || request.status === 'en_route') ? (
                    <TouchableOpacity 
                      onPress={() => handleMarkRoute(request)}
                      className={`py-3 rounded-lg mt-3 ${request.status === 'en_route' ? 'bg-purple-600' : 'bg-green-600'}`}
                    >
                      <Text className="text-white font-bold text-center">
                        {request.status === 'en_route' ? 'Resume Route' : 'Mark Route'}
                      </Text>
                    </TouchableOpacity>
                  ) : request.status === 'arrived' ? (
                    <TouchableOpacity 
                      onPress={() => handleComplete(request._id, patientName)}
                      className="bg-emerald-600 py-3 rounded-lg mt-3"
                    >
                      <Text className="text-white font-bold text-center">Complete Consultation</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Provider Route Tracking Modal */}
      {/* GlobalRouteModal is used at the root via RouteProvider; ProviderRouteModal removed */}
    </SafeAreaView>
  );
}
