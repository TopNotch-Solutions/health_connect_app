import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAuth } from "../../../context/AuthContext";
import socketService from "../../../lib/socket";
import ProviderRouteModal from "../../../components/ProviderRouteModal";

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
  const [modalVisible, setModalVisible] = useState(false);
  const [estimatedArrivalInput, setEstimatedArrivalInput] = useState('');
  const [currentAcceptingRequestId, setCurrentAcceptingRequestId] = useState<string | null>(null);
  const [isSubmittingArrival, setIsSubmittingArrival] = useState(false);
  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [currentRouteRequest, setCurrentRouteRequest] = useState<Request | null>(null);
  const { user } = useAuth();
  const loadRequests = useCallback(async () => {
    if (!user?.userId) {
      console.log('⚠️ No userId available');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('📥 Fetching available requests for provider:', user.userId);
      
      // Fetch both available requests (searching) AND provider's own requests (accepted/active)
      const [availableRequests, providerRequests] = await Promise.all([
        socketService.getAvailableRequests(user.userId),
        socketService.getProviderRequests(user.userId)
      ]);
      
      console.log('✅ Available requests received:', availableRequests);
      console.log('📊 Available requests count:', Array.isArray(availableRequests) ? availableRequests.length : 0);
      console.log('✅ Provider requests received:', providerRequests);
      console.log('📊 Provider requests count:', Array.isArray(providerRequests) ? providerRequests.length : 0);
      
      // Clear old AsyncStorage cache as it can contain stale requests
      // Only use requests from the live backend database
      await AsyncStorage.removeItem(`provider-requests-${user.userId}`);
      console.log('🧹 Cleared stale cached requests from AsyncStorage');
      
      // Combine both lists: provider's active requests + available requests
      const available = Array.isArray(availableRequests) ? availableRequests : [];
      const assigned = Array.isArray(providerRequests) ? providerRequests : [];
      const allRequests = [...assigned, ...available];
      
      console.log('✅ Total requests from backend:', allRequests.length);
      console.log('✅ All requests:', allRequests.map(r => ({ id: r._id, status: r.status })));
      
      setRequests(allRequests);
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
      
      // Update stored requests with new status - IMPORTANT for persistence
      if (user?.userId) {
        try {
          const storedRequestsJson = await AsyncStorage.getItem(`provider-requests-${user.userId}`);
          const storedRequests = storedRequestsJson ? JSON.parse(storedRequestsJson) : [];
          console.log('📦 Current stored requests before update:', storedRequests.length);
          
          let updatedStored = storedRequests.map((req: Request) =>
            req._id === data.requestId 
              ? { ...req, ...data.request, status: correctStatus } 
              : req
          );
          
          // Add if not in stored - this is critical for accepted requests
          if (!updatedStored.some((r: Request) => r._id === data.requestId)) {
            console.log('📌 Adding new request to AsyncStorage:', data.requestId, 'status:', correctStatus);
            if (data.request) {
              updatedStored.push({ ...data.request, status: correctStatus });
            } else {
              // If request object isn't provided, we need to find it in current state
              const requestToStore = requests.find(r => r._id === data.requestId);
              if (requestToStore) {
                updatedStored.push({ ...requestToStore, status: correctStatus });
              }
            }
          }
          
          console.log('💾 Saving to AsyncStorage - total requests after update:', updatedStored.length);
          await AsyncStorage.setItem(`provider-requests-${user.userId}`, JSON.stringify(updatedStored));
          console.log('✅ Successfully saved to AsyncStorage');
        } catch (error) {
          console.error('❌ Error saving to AsyncStorage:', error);
        }
      }
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

  // Handle accept request - show modal for estimated arrival
  const handleAccept = async (requestId: string, patientName: string) => {
    if (!user?.userId) return;

    try {
      // Accept the request first
      const response = (await socketService.acceptRequest(requestId, user.userId)) as any;
      
      console.log('📥 Response from acceptRequest:', response);
      
      // Store provider info for later use
      setCurrentAcceptingRequestId(requestId);
      setEstimatedArrivalInput('');
      setModalVisible(true);
      
    } catch (error: any) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', error.message || 'Failed to accept request');
    }
  };

  // Handle submitting estimated arrival
  const handleSubmitArrival = async () => {
    if (!estimatedArrivalInput.trim() || !currentAcceptingRequestId || !user?.userId) {
      Alert.alert('Error', 'Please enter estimated arrival time');
      return;
    }

    setIsSubmittingArrival(true);

    try {
      // Get provider's current location
      console.log('📍 Requesting provider location...');
      const providerLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const providerCoords = {
        latitude: providerLocation.coords.latitude,
        longitude: providerLocation.coords.longitude,
      };
      
      console.log('📍 Provider location obtained:', providerCoords);
      
      // Send provider response with estimated arrival and location
      console.log('📤 Sending provider response with estimated arrival...');
      await socketService.updateProviderResponse(
        currentAcceptingRequestId, 
        estimatedArrivalInput, 
        providerCoords
      );
      console.log('✅ Provider response sent successfully');
      
      // Update UI
      const requestInState = requests.find(r => r._id === currentAcceptingRequestId);
      
      if (requestInState) {
        const updatedRequest = { ...requestInState, status: 'accepted' as any };
        setRequests((prev) =>
          prev.map((req) =>
            req._id === currentAcceptingRequestId ? updatedRequest : req
          )
        );

        // No need to save to AsyncStorage - only use backend as source of truth
      }
      
      setModalVisible(false);
      setCurrentAcceptingRequestId(null);
      setEstimatedArrivalInput('');
      
      Alert.alert('Success', 'Request accepted! Provider notified of estimated arrival.');
    } catch (error: any) {
      console.error('Error submitting arrival:', error);
      Alert.alert('Error', error.message || 'Failed to submit estimated arrival');
    } finally {
      setIsSubmittingArrival(false);
    }
  };

  // Handle mark route - open route tracking modal
  const handleMarkRoute = async (request: Request) => {
    if (!user?.userId || !request.address?.coordinates) {
      Alert.alert('Error', 'Patient location not available');
      return;
    }

    try {
      console.log('🚗 Opening route modal for request:', request._id);
      console.log('🚗 Request status:', request.status);
      console.log('🚗 Is resuming:', request.status === 'en_route');
      
      // Request location permission first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to mark route');
        return;
      }
      console.log('✅ Location permission granted');
      
      // Get provider's current location first
      console.log('📍 Requesting current location from device...');
      const providerLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const providerCoords = {
        latitude: providerLocation.coords.latitude,
        longitude: providerLocation.coords.longitude,
      };
      
      console.log('📍 Provider location retrieved:', providerCoords);
      
      // Only update status to en_route if it's currently 'accepted'
      // If it's already 'en_route', skip the status update (resuming route)
      if (request.status === 'accepted') {
        console.log('📤 First time marking route - updating status to en_route');
        await socketService.updateRequestStatus(request._id, 'en_route', providerCoords);
        
        // Update local state
        setRequests((prev) =>
          prev.map((req) =>
            req._id === request._id ? { ...req, status: 'en_route' as any } : req
          )
        );
      } else if (request.status === 'en_route') {
        console.log('🚗 Resuming existing route - skipping status update');
        // Just open the modal, don't update status
      }

      // Open route modal
      setCurrentRouteRequest(request);
      setRouteModalVisible(true);
      
      console.log('✅ Route modal opened');
    } catch (error: any) {
      console.error('Error marking route:', error);
      Alert.alert('Error', error.message || 'Failed to mark route');
    }
  };

  // Handle route completion
  const handleRouteComplete = useCallback(() => {
    console.log('✅ Route completed');
    try {
      setRouteModalVisible(false);
      setCurrentRouteRequest(null);
      
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
      await socketService.updateRequestStatus(requestId, 'completed', undefined);
      
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
    <SafeAreaView className="flex-1 bg-gray-50">
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
                        onPress={() => handleAccept(request._id, patientName)}
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

      {/* Estimated Arrival Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isSubmittingArrival && setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-xl font-bold text-gray-900 mb-4">
              Estimated Arrival Time
            </Text>
            
            <Text className="text-sm text-gray-600 mb-4">
              Enter how long it will take you to arrive at the patient location
            </Text>
            
            <TextInput
              className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-base mb-6"
              placeholder="e.g., 15 minutes, 30 mins"
              value={estimatedArrivalInput}
              onChangeText={setEstimatedArrivalInput}
              editable={!isSubmittingArrival}
              placeholderTextColor="#9CA3AF"
            />
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => !isSubmittingArrival && setModalVisible(false)}
                disabled={isSubmittingArrival}
                className="flex-1 bg-gray-100 py-3 rounded-lg border border-gray-200"
              >
                <Text className="text-gray-700 font-bold text-center">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleSubmitArrival}
                disabled={isSubmittingArrival}
                className={`flex-1 py-3 rounded-lg ${isSubmittingArrival ? 'bg-blue-400' : 'bg-blue-600'}`}
              >
                <Text className="text-white font-bold text-center">
                  {isSubmittingArrival ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Provider Route Tracking Modal */}
      <ProviderRouteModal
        visible={routeModalVisible}
        onClose={() => setRouteModalVisible(false)}
        requestId={currentRouteRequest?._id || ''}
        providerId={user?.userId || ''}
        patientLocation={currentRouteRequest?.address?.coordinates}
        patientName={currentRouteRequest?.patientId?.fullname || 'Patient'}
        onCompleteRoute={handleRouteComplete}
      />
    </SafeAreaView>
  );
}
