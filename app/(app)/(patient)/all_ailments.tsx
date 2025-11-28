import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useState, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import CreateRequestModal from '../../../components/(patient)/CreateRequestModal';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../lib/socket';
import * as Location from 'expo-location';



interface Ailment {
  _id: string;
  title: string;
  provider: string;
  description?: string;
  linkedSpecializations?: string[];
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
    <Feather name="alert-circle" size={24} color="#2563EB" />
    <Text className="text-base font-bold text-gray-800 mt-3">{item.title}</Text>
    <Text className="text-sm text-gray-600 mt-1">{item.provider}</Text>
  </TouchableOpacity>
);

export default function AllAilmentsScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAilment, setSelectedAilment] = useState<any>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [ailments, setAilments] = useState<Ailment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch ailments from socket
  const fetchAilments = useCallback(async () => {
    setIsLoading(true);
    try {
      const socket = socketService.getSocket();
      
      if (!socket?.connected) {
        console.warn('⚠️ Socket not connected');
        setIsLoading(false);
        return;
      }

      return new Promise<void>((resolve) => {
        let resolved = false;

        const handleAilmentCategories = (categories: any) => {
          if (resolved) return;
          resolved = true;
          
          console.log('📋 Received ailment categories from backend:', categories);
          if (Array.isArray(categories) && categories.length > 0) {
            setAilments(categories);
          }
          socket?.off('ailmentCategories', handleAilmentCategories);
          setIsLoading(false);
          resolve();
        };

        const timeout = setTimeout(() => {
          if (resolved) return;
          resolved = true;
          
          console.warn('⚠️ Ailment categories request timeout');
          socket?.off('ailmentCategories', handleAilmentCategories);
          setIsLoading(false);
          resolve();
        }, 5000);

        socket?.on('ailmentCategories', handleAilmentCategories);
        console.log('📤 Emitting getAilmentCategories request');
        socket?.emit('getAilmentCategories');

        return () => clearTimeout(timeout);
      });
    } catch (error) {
      console.error('Error loading ailment categories:', error);
      setIsLoading(false);
    }
  }, []);

  // Connect to socket on mount
  useEffect(() => {
    if (user?.userId) {
      socketService.connect(user.userId, 'patient');
    }
  }, [user?.userId]);

  useFocusEffect(
    React.useCallback(() => {
      fetchAilments();
    }, [fetchAilments])
  );

  // Filter and sort ailments based on search and provider order
  const providerOrder: Record<string, number> = {
    'Doctor': 1,
    'Nurse': 2,
    'Physiotherapist': 3,
    'Social Worker': 4,
  };

  const filteredAilments = ailments
    .filter((ailment: Ailment) =>
      ailment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ailment.provider.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: Ailment, b: Ailment) => {
      const orderA = providerOrder[a.provider] || 999;
      const orderB = providerOrder[b.provider] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If same provider, sort by title alphabetically
      return a.title.localeCompare(b.title);
    });

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
          {/* <View className="flex-row items-center gap-3 mb-4">
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-800">Back</Text>
          </View> */}

          {/* Search Bar */}
          <View className="flex-row items-center bg-white border-2 border-gray-200 rounded-lg px-3 py-2">
            <Feather name="search" size={20} color="#6B7280" />
            <TextInput
              placeholder="Search ailments..."
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
        ) : filteredAilments.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Feather name="search" size={40} color="#9CA3AF" />
            <Text className="text-gray-600 mt-3 text-center">
              No ailments found matching &quot;{searchQuery}&quot;
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/** Group ailments by provider so headers can span full width and cards can wrap underneath */}
            {Object.entries(filteredAilments.reduce((acc: Record<string, Ailment[]>, ailment) => {
              const key = ailment.provider || 'Other';
              if (!acc[key]) acc[key] = [];
              acc[key].push(ailment);
              return acc;
            }, {})).map(([provider, items]) => (
              <View key={provider} className="mb-6">
                <View className="w-full px-2 py-1">
                  <Text className="text-lg font-bold text-blue-600">{provider}</Text>
                  <View className="h-1 bg-blue-600 rounded-full mt-1" style={{ width: '30%' }} />
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 }}>
                  {items.map((item) => (
                    <AilmentCard key={item._id} item={item} onPress={() => handleAilmentSelect(item)} />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
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
