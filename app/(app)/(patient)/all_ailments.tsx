import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CreateRequestModal from '../../../components/(patient)/CreateRequestModal';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../lib/socket';



interface Ailment {
  _id: string;
  title: string;
  provider?: string;
  description?: string;
  linkedSpecializations?: string[];
  image?: string;
  specialization?: Array<{
    _id: string;
    title: string;
    role: string;
    description?: string;
  }>;
}

const AilmentCard = ({ 
  item, 
  onPress 
}: { 
  item: Ailment; 
  onPress: () => void;
}) => {
  const AILMENT_IMAGE_BASE_URL = 'http://13.51.207.99:4000/ailments/';
  const imageUri = item.image ? `${AILMENT_IMAGE_BASE_URL}${item.image}` : null;
  const [imageLoading, setImageLoading] = React.useState(true);
  const [imageError, setImageError] = React.useState(false);

  // Prefetch image when component mounts
  React.useEffect(() => {
    if (imageUri) {
      Image.prefetch(imageUri)
        .then(() => {
          setImageLoading(false);
        })
        .catch(() => {
          setImageError(true);
          setImageLoading(false);
        });
    }
  }, [imageUri]);

  return (
    <TouchableOpacity 
      onPress={onPress}
      className="w-[48%] mb-4 rounded-2xl overflow-hidden"
      style={{
        height: 150,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      }}
      activeOpacity={0.7}
    >
      {imageUri && !imageError ? (
        <>
          {imageLoading && (
            <View style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backgroundColor: '#F3F4F6',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1,
            }}>
              <ActivityIndicator size="small" color="#10B981" />
            </View>
          )}
          <Image 
            source={{ uri: imageUri }} 
            style={{
              width: '100%',
              height: '100%',
            }}
            resizeMode="cover"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
        </>
      ) : (
        <View style={{ width: '100%', height: '100%', backgroundColor: '#F3F4F6' }} />
      )}
      
      {/* Blurred overlay at the bottom with title */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          paddingVertical: 12,
          paddingHorizontal: 12,
        }}
      >
        <Text 
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: '#FFFFFF',
            textShadowColor: 'rgba(0, 0, 0, 0.75)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.provider && (
          <Text 
            style={{
              fontSize: 12,
              color: '#E5E7EB',
              marginTop: 4,
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {item.provider}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

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
  
  // ADD THESE LOGS:
  console.log('📊 Total categories received:', categories?.length);
  if (categories && categories.length > 0) {
    console.log('📊 First category full data:', JSON.stringify(categories[0], null, 2));
    console.log('📊 First category provider field:', categories[0].provider);
    console.log('📊 Provider field type:', typeof categories[0].provider);
    console.log('📊 All provider values:', categories.map((cat: any) => ({
      title: cat.title,
      provider: cat.provider
    })));
  }
  
  if (Array.isArray(categories) && categories.length > 0) {
    // Ensure provider field is properly set from specialization roles
    const mappedCategories = categories.map((category: any) => {
      // Extract unique roles from specializations
      const roles = category.specialization?.map((spec: any) => spec.role) || [];
      const uniqueRoles = [...new Set(roles)];
      const provider = uniqueRoles.length > 0 ? uniqueRoles.join(', ') : 'Other';
      
      return {
        ...category,
        provider,
      };
    });
    // ADD THIS LOG AFTER MAPPING:
    console.log('📊 After mapping - first category provider:', mappedCategories[0].provider);
    
    setAilments(mappedCategories);
            
            // Prefetch ailment images for faster loading
            const AILMENT_IMAGE_BASE_URL = 'http://13.51.207.99:4000/ailments/';
            mappedCategories.forEach((category: any) => {
              if (category.image) {
                const imageUri = `${AILMENT_IMAGE_BASE_URL}${category.image}`;
                Image.prefetch(imageUri).catch((err) => {
                  console.log('Failed to prefetch image:', imageUri, err);
                });
              }
            });
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

  // Filter and sort ailments alphabetically by title
  const filteredAilments = ailments
    .filter((ailment: Ailment) =>
      ailment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ailment.provider?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: Ailment, b: Ailment) => {
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
    coordinates?: { latitude: number; longitude: number };
  }) => {
    // Use coordinates from the modal if provided, otherwise try to get current location
    let currentLocation = requestData.coordinates || location;
    
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {filteredAilments.map((item) => (
                <AilmentCard 
                  key={item._id} 
                  item={item} 
                  onPress={() => handleAilmentSelect(item)} 
                />
              ))}
            </View>
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
