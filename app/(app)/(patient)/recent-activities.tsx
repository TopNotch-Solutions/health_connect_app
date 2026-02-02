import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../lib/socket';

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
  acceptedAt: number;
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

const ActivityCard = ({ item }: { item: StoredRequest }) => {
  const request = item.request;

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
    <View className="bg-white rounded-xl p-4 mb-3 border border-gray-200 shadow-sm">
      {/* Header with status */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800 mb-2">
            {request.ailmentCategoryId?.title || 'Healthcare Request'}
          </Text>
          <StatusBadge status={request.status} />
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

      {/* Request details */}
      <View className="bg-gray-50 rounded-lg p-3">
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
    </View>
  );
};

export default function RecentActivities() {
  const { user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<StoredRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
            // Merge live requests with stored ones, prioritizing live data
            const mergedRequests = new Map<string, StoredRequest>();

            // Add stored requests first
            storedRequests.forEach((item) => {
              mergedRequests.set(item.request._id, item);
            });

            // Override with live requests
            liveRequests.forEach((req: RequestStatus) => {
              const stored = mergedRequests.get(req._id);
              const now = Date.now();
              const acceptedAt = req.status === 'accepted' && !stored ? now : stored?.acceptedAt || now;
              mergedRequests.set(req._id, { request: req, acceptedAt });
            });

            const merged = Array.from(mergedRequests.values());
            setRequests(merged);

            // Save updated requests to storage
            await AsyncStorage.setItem(`waiting-room-${user?.userId}`, JSON.stringify(merged));
          } else {
            setRequests(storedRequests);
          }
        } catch (error) {
          console.log('Could not fetch live requests, using stored:', error);
          setRequests(storedRequests);
        }
      } else {
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

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadRequests();
  }, [loadRequests]);

  // Sort all requests by creation date (newest first)
  const sortedRequests = [...requests].sort(
    (a, b) =>
      new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime()
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#007BFF" />
        <Text className="text-gray-600 mt-4">Loading your activities...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Top Bar with Back Arrow */}
      <FlatList
        data={sortedRequests}
        keyExtractor={(item) => item.request._id}
        renderItem={({ item }) => <ActivityCard item={item} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="mb-4">
            <Text className="text-xl font-bold text-gray-600">
              All your healthcare requests and their status
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="bg-white rounded-xl p-6 items-center border border-gray-200">
            <Feather name="inbox" size={48} color="#9CA3AF" />
            <Text className="text-lg font-semibold text-gray-800 mt-4">No Activities Yet</Text>
            <Text className="text-sm text-gray-600 text-center mt-2">
              When you submit healthcare requests, they will appear here with their status.
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      />
    </SafeAreaView>
  );
}
