// app/(provider)/home.tsx

import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../context/AuthContext";
import socketService from "../../../lib/socket";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

export default function ProviderHome() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const { user } = useAuth();

  // Online/Offline toggle
  const [isOnline, setIsOnline] = useState(true);
  const toggleOnline = () => setIsOnline((prev) => !prev);

  const [selectedRequest, setSelectedRequest] = useState<null | any>(null);

  // Define loadAvailableRequests before using it in useEffect
  const loadAvailableRequests = useCallback(async () => {
    if (!user?.userId) {
      console.log('⚠️ No userId, skipping request load');
      return;
    }

    console.log('📥 Starting to load available requests for provider:', user.userId);

    try {
      setIsLoadingRequests(true);
      
      // Wait for socket to be ready
      console.log('⏳ Waiting for socket to connect...');
      await socketService.waitForConnection(5000);
      
      console.log('📡 Socket is ready, fetching requests');
      const availableRequests = await socketService.getAvailableRequests(user.userId);
      console.log('✅ Available requests received:', availableRequests);
      setRequests(Array.isArray(availableRequests) ? availableRequests : []);
    } catch (error: any) {
      console.error('❌ Error loading requests:', error);
      Alert.alert('Error', 'Failed to load available requests: ' + error.message);
    } finally {
      setIsLoadingRequests(false);
      console.log('✅ Loading complete, isLoadingRequests set to false');
    }
  }, [user?.userId]);

  // Connect socket and fetch available requests
  useEffect(() => {
    if (user?.userId) {
      console.log('🔌 Connecting socket for provider:', user.userId);
      // Default to doctor role, but should ideally use user.role if available
      socketService.connect(user.userId, user.role as any || 'doctor');
      
      const socket = socketService.getSocket();
      console.log('📡 Initial socket state:', socket?.connected);
      
      // Listen for connect event
      const handleConnect = () => {
        console.log('✅ Socket connected event fired, loading requests...');
        loadAvailableRequests();
      };
      
      // If already connected, wait a bit and try loading
      if (socket?.connected) {
        console.log('✅ Socket already connected, loading requests...');
        loadAvailableRequests();
      } else {
        console.log('⏳ Socket not yet connected, waiting for connect event...');
        socket?.on('connect', handleConnect);
      }

      return () => {
        socket?.off('connect', handleConnect);
      };
    }
  }, [user?.userId, user?.role, loadAvailableRequests]);

  // Refresh requests when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Screen came into focus, refreshing requests');
      if (user?.userId) {
        loadAvailableRequests();
      }
    }, [user?.userId, loadAvailableRequests])
  );

  // Listen for new request notifications
  useEffect(() => {
    const handleNewRequest = (request: any) => {
      console.log('New request received:', request);
      setRequests((prev) => [request, ...prev]);
    };

    socketService.getSocket()?.on('newRequest', handleNewRequest);

    return () => {
      socketService.getSocket()?.off('newRequest', handleNewRequest);
    };
  }, []);

  const handleAccept = async (requestId: string, patientName: string) => {
    if (!user?.userId) return;

    try {
      await socketService.acceptRequest(requestId, user.userId);
      // Remove from available requests and reload to get updated list
      setRequests((prev) => prev.filter((req) => req._id !== requestId));
      setSelectedRequest(null);
      Alert.alert('Success', `Accepted consultation request from ${patientName}`);
      // Reload requests to ensure state is synced
      setTimeout(() => {
        loadAvailableRequests();
      }, 500);
    } catch (error: any) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', error.message || 'Failed to accept request');
    }
  };

  const handleDecline = async (requestId: string, patientName: string) => {
    if (!user?.userId) return;

    try {
      await socketService.rejectRequest(requestId, user.userId);
      setRequests((prev) => prev.filter((req) => req._id !== requestId));
      setSelectedRequest(null);
      Alert.alert('Declined', `Declined consultation request from ${patientName}`);
    } catch (error: any) {
      console.error('Error declining request:', error);
      Alert.alert('Error', error.message || 'Failed to decline request');
    }
  };
  const greeting = getGreeting();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        {/* Header with provider name + Online/Offline toggle */}
        <View className="bg-white pt-6 pb-4 px-6 border-b border-gray-200">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-gray-500">{greeting}</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-1">
                {user?.fullname || "Provider"}
              </Text>
            </View>

            {/* Online/Offline toggle button */}
            <TouchableOpacity
              onPress={toggleOnline}
              className={`flex-row items-center px-5 py-2.5 rounded-full ${
                isOnline ? "bg-green-500" : "bg-gray-400"
              }`}
            >
              <View className={`w-2 h-2 rounded-full mr-2 ${
                isOnline ? "bg-white" : "bg-gray-200"
              }`} />
              <Text className="text-white font-bold text-sm">
                {isOnline ? "Online" : "Offline"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View className="px-6 py-6">
          <View className="flex-row" style={{ gap: 12 }}>
            <View className="flex-1 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs text-gray-500 uppercase font-bold tracking-wide">Requests</Text>
                <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center">
                  <Feather name="users" size={16} color="#3B82F6" />
                </View>
              </View>
              <Text className="text-3xl font-bold text-gray-900">{requests.length}</Text>
              <Text className="text-xs text-gray-500 mt-1">Pending</Text>
            </View>
            <View className="flex-1 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs text-gray-500 uppercase font-bold tracking-wide">Earnings</Text>
                <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center">
                  <Feather name="dollar-sign" size={16} color="#10B981" />
                </View>
              </View>
              <Text className="text-3xl font-bold text-gray-900">N$435</Text>
              <Text className="text-xs text-gray-500 mt-1">This Month</Text>
            </View>
          </View>
        </View>

        {/* Incoming Consultation Requests */}
        <View className="px-6 pb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            Incoming Requests
          </Text>

          {isLoadingRequests ? (
            <View className="bg-white rounded-xl border border-gray-200 p-10 items-center">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-sm text-gray-500 mt-4">Loading requests...</Text>
            </View>
          ) : requests.length === 0 ? (
            <View className="bg-white rounded-xl border border-gray-200 p-10 items-center">
              <View className="w-16 h-16 bg-green-50 rounded-full items-center justify-center mb-4">
                <Feather name="check-circle" size={32} color="#10B981" />
              </View>
              <Text className="text-lg font-semibold text-gray-900 mb-1">
                All Caught Up!
              </Text>
              <Text className="text-sm text-gray-500 text-center">
                No pending consultation requests
              </Text>
            </View>
          ) : (
            requests.map((request) => {
              const patientName = request.patientId?.fullname || 'Unknown Patient';
              const ailment = request.ailmentCategory || 'Consultation';
              const fee = `N$ ${request.estimatedCost || 0}`;
              const commission = `N$ ${Math.round((request.estimatedCost || 0) * 0.1)}`; // 10% commission
              const distance = '-- km'; // Calculate distance if coordinates available
              
              return (
                <TouchableOpacity
                  key={request._id}
                  onPress={() => setSelectedRequest(request)}
                  className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-gray-900 mb-1">{patientName}</Text>
                      <View className="flex-row items-center mb-2">
                        <Feather name="alert-circle" size={14} color="#6B7280" />
                        <Text className="text-sm text-gray-600 ml-1.5">{ailment}</Text>
                      </View>
                      <View className="flex-row items-center">
                        <Feather name="map-pin" size={14} color="#6B7280" />
                        <Text className="text-sm text-gray-500 ml-1.5">{distance}</Text>
                      </View>
                    </View>
                    <View className="bg-blue-50 px-3 py-1.5 rounded-full">
                      <Text className="text-blue-600 text-xs font-bold">NEW</Text>
                    </View>
                  </View>

                  <View className="flex-row bg-gray-50 rounded-lg p-3 mb-3">
                    <View className="flex-1">
                      <Text className="text-xs text-gray-500 mb-0.5">Fee</Text>
                      <Text className="text-base font-bold text-gray-900">{fee}</Text>
                    </View>
                    <View className="flex-1 border-l border-gray-200 pl-4">
                      <Text className="text-xs text-gray-500 mb-0.5">Commission</Text>
                      <Text className="text-base font-bold text-gray-900">{commission}</Text>
                    </View>
                  </View>

                  <View className="flex-row" style={{ gap: 8 }}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDecline(request._id, patientName);
                      }}
                      className="flex-1 bg-gray-100 py-3 rounded-lg border border-gray-200"
                    >
                      <Text className="text-gray-700 font-bold text-center">Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAccept(request._id, patientName);
                      }}
                      className="flex-1 bg-blue-600 py-3 rounded-lg"
                    >
                      <Text className="text-white font-bold text-center">Accept</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* --- MODAL WITH TRANSPARENT BACKGROUND --- */}
      {selectedRequest && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={!!selectedRequest}
          onRequestClose={() => setSelectedRequest(null)}
        >
          <TouchableWithoutFeedback onPress={() => setSelectedRequest(null)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View className="bg-white rounded-2xl p-6 w-11/12 max-w-lg">
                  {/* Header */}
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-xl font-bold text-gray-900">
                      Request Details
                    </Text>
                    <TouchableOpacity
                      onPress={() => setSelectedRequest(null)}
                      className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
                    >
                      <Feather name="x" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  {/* Patient Info */}
                  <View className="bg-gray-50 rounded-xl p-4 mb-4">
                    <Text className="text-lg font-bold text-gray-900 mb-2">
                      {selectedRequest.patientId?.fullname || 'Unknown Patient'}
                    </Text>
                    <View className="flex-row items-center mb-2">
                      <Feather name="alert-circle" size={14} color="#6B7280" />
                      <Text className="text-sm text-gray-600 ml-2">
                        {selectedRequest.ailmentCategory}
                      </Text>
                    </View>
                    {selectedRequest.symptoms && (
                      <View className="mt-2">
                        <Text className="text-xs text-gray-500 mb-1">Symptoms:</Text>
                        <Text className="text-sm text-gray-700">{selectedRequest.symptoms}</Text>
                      </View>
                    )}
                    <View className="flex-row items-center mt-2">
                      <Feather name="map-pin" size={14} color="#6B7280" />
                      <Text className="text-sm text-gray-600 ml-2">
                        {selectedRequest.address?.locality || 'Unknown location'}
                      </Text>
                    </View>
                  </View>

                  {/* Fee Breakdown */}
                  <View className="bg-blue-50 rounded-xl p-4 mb-4">
                    <View className="flex-row justify-between mb-3">
                      <Text className="text-sm text-gray-700">Consultation Fee:</Text>
                      <Text className="text-base font-bold text-gray-900">
                        N$ {selectedRequest.estimatedCost || 0}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-gray-700">Platform Commission:</Text>
                      <Text className="text-base font-bold text-gray-900">
                        N$ {Math.round((selectedRequest.estimatedCost || 0) * 0.1)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between mt-3 pt-3 border-t border-blue-100">
                      <Text className="text-sm font-bold text-gray-900">Your Earnings:</Text>
                      <Text className="text-base font-bold text-blue-600">
                        N$ {Math.round((selectedRequest.estimatedCost || 0) * 0.9)}
                      </Text>
                    </View>
                  </View>

                  {/* Map */}
                  {selectedRequest.address?.coordinates && (
                    <View className="mb-4">
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-base font-bold text-gray-900">Location</Text>
                      </View>

                      <View className="rounded-xl overflow-hidden h-48 bg-gray-100 border border-gray-200">
                        <MapView
                          style={styles.map}
                          initialRegion={{
                            latitude: selectedRequest.address.coordinates.latitude,
                            longitude: selectedRequest.address.coordinates.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                          }}
                          provider={PROVIDER_GOOGLE}
                        >
                          <Marker
                            coordinate={{
                              latitude: selectedRequest.address.coordinates.latitude,
                              longitude: selectedRequest.address.coordinates.longitude,
                            }}
                            title={selectedRequest.patientId?.fullname}
                            description={selectedRequest.ailmentCategory}
                          />
                        </MapView>
                      </View>
                    </View>
                  )}

                  {/* Actions */}
                  <View className="flex-row" style={{ gap: 10 }}>
                    <TouchableOpacity
                      onPress={() =>
                        handleDecline(selectedRequest._id, selectedRequest.patientId?.fullname || 'Unknown')
                      }
                      className="flex-1 bg-gray-100 py-3.5 rounded-xl border border-gray-200"
                    >
                      <Text className="text-gray-700 font-bold text-center">
                        Decline
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleAccept(selectedRequest._id, selectedRequest.patientId?.fullname || 'Unknown')
                      }
                      className="flex-1 bg-blue-600 py-3.5 rounded-xl"
                    >
                      <Text className="text-white font-bold text-center">
                        Accept Request
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});