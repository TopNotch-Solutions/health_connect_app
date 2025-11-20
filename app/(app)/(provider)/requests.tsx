import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../context/AuthContext";
import socketService from "../../../lib/socket";

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
    locality: string;
    administrative_area_level_1: string;
  };
  createdAt?: string;
}

export default function ProviderRequests() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'in_progress' | 'completed'>('all');
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      const availableRequests = await socketService.getAvailableRequests(user.userId);
      console.log('✅ Requests received:', availableRequests);
      setRequests(Array.isArray(availableRequests) ? availableRequests : []);
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

  // Listen for new requests
  useEffect(() => {
    const handleNewRequest = (request: Request) => {
      console.log('📨 New request available:', request);
      setRequests((prev) => [request, ...prev]);
    };

    const handleRequestHidden = (data: { requestId: string }) => {
      console.log('🚫 Request hidden:', data.requestId);
      setRequests((prev) => prev.filter((req) => req._id !== data.requestId));
    };

    const handleRequestStatusChanged = (data: { requestId: string; status: string }) => {
      console.log('📊 Request status changed:', data);
      setRequests((prev) =>
        prev.map((req) =>
          req._id === data.requestId ? { ...req, status: data.status as any } : req
        )
      );
    };

    socketService.getSocket()?.on('newRequestAvailable', handleNewRequest);
    socketService.getSocket()?.on('requestHidden', handleRequestHidden);
    socketService.getSocket()?.on('requestStatusChanged', handleRequestStatusChanged);

    return () => {
      socketService.getSocket()?.off('newRequestAvailable', handleNewRequest);
      socketService.getSocket()?.off('requestHidden', handleRequestHidden);
      socketService.getSocket()?.off('requestStatusChanged', handleRequestStatusChanged);
    };
  }, []);

  const filteredRequests = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'searching' || r.status === 'pending';
    if (filter === 'accepted') return r.status === 'accepted';
    if (filter === 'in_progress') return r.status === 'in_progress' || r.status === 'arrived' || r.status === 'en_route';
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

  // Handle accept request
  const handleAccept = async (requestId: string, patientName: string) => {
    if (!user?.userId) return;

    try {
      await socketService.acceptRequest(requestId, user.userId);
      setRequests((prev) => prev.filter((req) => req._id !== requestId));
      Alert.alert('Success', `Accepted consultation request from ${patientName}`);
    } catch (error: any) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', error.message || 'Failed to accept request');
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

                  <View className="bg-gray-50 rounded-lg p-3 flex-row items-center justify-between">
                    <Text className="text-xs text-gray-500">Consultation Fee</Text>
                    <Text className="text-base font-bold text-gray-900">{fee}</Text>
                  </View>

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
                  ) : request.status === 'accepted' && (
                    <TouchableOpacity className="bg-green-600 py-3 rounded-lg mt-3">
                      <Text className="text-white font-bold text-center">
                        View Details
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
