// In app/(patient)/history.tsx

import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../../lib/api';


// --- 1. ADD THIS DUMMY DATA ARRAY ---
const DUMMY_HISTORY: BookingRequest[] = [
  {
    _id: '1',
    ailmentCategoryId: { title: 'General Check-up', color: '#22c55e' },
    status: 'completed',
    createdAt: new Date('2023-10-26T10:00:00Z').toISOString(),
    address: { city: 'Windhoek', region: 'Khomas' },
  },
  {
    _id: '2',
    ailmentCategoryId: { title: 'Fever & Flu', color: '#ef4444' },
    status: 'accepted',
    createdAt: new Date('2023-11-05T14:30:00Z').toISOString(),
    address: { city: 'Swakopmund', region: 'Erongo' },
  },
  {
    _id: '3',
    ailmentCategoryId: { title: 'Injury Assessment', color: '#f97316' },
    status: 'pending',
    createdAt: new Date().toISOString(), // Today
    address: { city: 'Windhoek', region: 'Khomas' },
  },
  {
    _id: '4',
    ailmentCategoryId: { title: 'Skin Consultation', color: '#eab308' },
    status: 'cancelled',
    createdAt: new Date('2023-10-20T09:00:00Z').toISOString(),
    address: { city: 'Oshakati', region: 'Oshana' },
  },
];
// ------------------------------------

// Define the type for a booking request
interface BookingRequest {
  _id: string;
  ailmentCategoryId: { // Assuming the backend populates this
    title: string;
    color: string;
  };
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  createdAt: string;
  address: {
    city: string;
    region: string;
  };
}

// TODO: Replace this with your actual authentication context/state management
const DUMMY_USER = {
  _id: '12345',
};

// A map to get human-readable status and colors
const statusMap = {
  pending: { text: 'Pending', color: 'bg-yellow-500' },
  accepted: { text: 'Accepted', color: 'bg-blue-500' },
  completed: { text: 'Completed', color: 'bg-green-500' },
  cancelled: { text: 'Cancelled', color: 'bg-red-500' },
};

// A reusable card component for each history item
const HistoryCard = ({ item }: { item: BookingRequest }) => {
  const statusInfo = statusMap[item.status] || { text: 'Unknown', color: 'bg-gray-500' };

  return (
    <View className="bg-white p-4 rounded-xl mb-4 border border-gray-100 shadow-sm">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="text-lg font-bold text-text-main mb-1">
            {item.ailmentCategoryId?.title || 'General Consultation'}
          </Text>
          <View className="flex-row items-center mb-2">
            <Feather name="map-pin" size={14} color="#6C757D" />
            <Text className="text-sm text-gray-600 ml-2">
              {item.address.city}, {item.address.region}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Feather name="calendar" size={14} color="#6C757D" />
            <Text className="text-sm text-gray-600 ml-2">
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View className={`px-3 py-1 rounded-full ${statusInfo.color}`}>
          <Text className="text-white text-xs font-bold">{statusInfo.text}</Text>
        </View>
      </View>
    </View>
  );
};

export default function HistoryScreen() {
  const [requests, setRequests] = React.useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchHistory = React.useCallback(async () => {
    try {
      setIsLoading(true);
      // NOTE: Update this endpoint to match your backend route for fetching a user's requests.
      const response = await apiClient.get(`/request/my-requests/${DUMMY_USER._id}`);
      setRequests(response.data.data || []);
    } catch (error: any) {
      console.error('Error fetching history:', error);
      alert('Failed to load history. ' + (error.response?.data?.message || ''));
    } finally {
      setIsLoading(false);
    }
  }, []);

    useFocusEffect(
    React.useCallback(() => {
      setIsLoading(true);
      // Simulate a network delay
      setTimeout(() => {
        setRequests(DUMMY_HISTORY);
        setIsLoading(false);
      }, 500); // 0.5 second delay
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-background-light">
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#007BFF" />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => <HistoryCard item={item} />}
          ListHeaderComponent={
            <Text className="text-2xl font-bold text-text-main mb-4">
              Your Request History
            </Text>
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center mt-20">
              <Feather name="folder" size={48} color="#CBD5E1" />
              <Text className="text-lg text-gray-500 mt-4">No requests found.</Text>
              <Text className="text-base text-gray-400 mt-1">Your past and pending requests will appear here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}