import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import CreateRequestModal from '../../../components/(patient)/CreateRequestModal';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../lib/socket';
import apiClient from '../../../lib/api';
import * as Location from 'expo-location';



interface Ailment {
  _id: string;
  title: string;
  provider: string;
  icon: string;
}

const AilmentCard = ({ 
  item, 
  onPress 
}: { 
  item: Ailment; 
  onPress: () => void;
}) => (
  <TouchableOpacity 
    onPress={onPress}
    className="w-[48%] bg-white rounded-lg p-4 mb-4 border-2 border-gray-200"
  >
    <Feather name={item.icon as any} size={24} color="#2563EB" />
    <Text className="text-base font-bold text-gray-800 mt-3">{item.title}</Text>
    <Text className="text-sm text-gray-600 mt-1">{item.provider}</Text>
  </TouchableOpacity>
);

export default function AllAilmentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAilment, setSelectedAilment] = useState<any>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [ailments, setAilments] = useState<Ailment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch ailments from API
  const fetchAilments = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/app/ailment/all-ailments');
      console.log('Ailments fetched from API:', response.data);
      setAilments(response.data.data || []);
    } catch (error: any) {
      console.error('Error fetching ailments:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchAilments();
    }, [])
  );

  // Filter ailments based on search
  const filteredAilments = ailments.filter((ailment: Ailment) =>
    ailment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ailment.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAilmentSelect = (ailment: any) => {
    setSelectedAilment(ailment);
    setModalVisible(true);
  };

  const handleCreateRequest = async (requestData: {
    ailmentCategory: string;
    ailmentCategoryId?: string;
    symptoms: string;
    paymentMethod: 'wallet' | 'cash';
    dueCost: number;
    street: string;
    locality: string;
    region: string;
    preferredTime?: string;
  }) => {
    // Check if location is available, if not try to get it again
    let currentLocation = location;
    
    if (!currentLocation) {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        currentLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(currentLocation);
      } catch {
        throw new Error('Location is required to create a request. Please enable location services and try again.');
      }
    }

    if (!user?.userId) {
      throw new Error('User not authenticated');
    }

    try {
      const request = await socketService.createRequest({
        patientId: user.userId,
        location: currentLocation,
        ailmentCategory: requestData.ailmentCategory,
        ailmentCategoryId: requestData.ailmentCategoryId,
        paymentMethod: requestData.paymentMethod,
        symptoms: requestData.symptoms,
        estimatedCost: requestData.dueCost,
        address: {
          route: requestData.street,
          locality: requestData.locality,
          administrative_area_level_1: requestData.region,
          coordinates: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
        },
        preferredTime: requestData.preferredTime,
      });

      console.log('Request created:', request);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create request');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center gap-3 mb-4">
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-800">Back</Text>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center bg-white border-2 border-gray-200 rounded-lg px-3 py-2">
            <Feather name="search" size={20} color="#6B7280" />
            <TextInput
              placeholder="Search ailments or providers"
              className="flex-1 ml-3 text-base"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Ailment Grid */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="mt-4 text-gray-600">Loading ailments...</Text>
          </View>
        ) : (
        <FlatList
          data={filteredAilments}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          renderItem={({ item }) => (
            <AilmentCard item={item} onPress={() => handleAilmentSelect(item)} />
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-12">
              <Feather name="search" size={40} color="#9CA3AF" />
              <Text className="text-gray-600 mt-3 text-center">
                No ailments found matching &quot;{searchQuery}&quot;
              </Text>
            </View>
          }
        />
        )}
      </View>

      {/* Create Request Modal */}
      <CreateRequestModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedAilment(null);
        }}
        onSubmit={handleCreateRequest}
        selectedAilment={selectedAilment}
      />
    </SafeAreaView>
  );
}
