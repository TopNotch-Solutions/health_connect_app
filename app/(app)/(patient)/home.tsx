import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CreateRequestModal from '../../../components/(patient)/CreateRequestModal';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../lib/socket';

// --- Dummy Data (for UI development, replace with API data later) ---
const healthTips = [
  {
    id: '1',
    title: 'Stay Hydrated',
    content: 'Drink 8 glasses of water a day.',
    bgColor: 'bg-blue-100',
  },
  {
    id: '2',
    title: 'Get Enough Sleep',
    content: 'Aim for 7-9 hours per night.',
    bgColor: 'bg-purple-100',
  },
  {
    id: '3',
    title: 'Eat a Balanced Diet',
    content: 'Include fruits and vegetables.',
    bgColor: 'bg-green-100',
  },
];

// Ailment categories will be fetched from backend
const defaultAilmentCategories = [
  { _id: '1', title: 'Flu, Cold & Cough Symptoms', provider: 'Doctor', icon: 'wind' },
  { _id: '2', title: 'Sore Throat & Ear Ache', provider: 'Doctor', icon: 'alert-circle' },
  { _id: '3', title: 'New or Worsening Skin Rash', provider: 'Nurse', icon: 'alert-octagon' },
  { _id: '4', title: 'Headaches or Migraines', provider: 'Doctor', icon: 'activity' },
  { _id: '5', title: 'Elderly Parent Wellness Check', provider: 'Social Worker', icon: 'heart' },
  { _id: '6', title: 'Assessment of a Sports Injury', provider: 'Physiotherapist', icon: 'target' },
];

// --- Reusable Components for this Screen ---
const HealthTipCard = ({ item }: { item: (typeof healthTips)[0] }) => (
  <View className={`rounded-lg p-6 ${item.bgColor}`} style={{ width: '100%' }}>
    <Text className="font-bold text-lg text-gray-800">{item.title}</Text>
    <Text className="text-base text-gray-700 mt-2">{item.content}</Text>
  </View>
);

const AilmentCard = ({ 
  item, 
  onPress 
}: { 
  item: any; 
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

interface HistoryItem {
  _id: string;
  ailment: string;
  status: string;
  date: string;
}

const HistoryCard = ({ item }: { item: HistoryItem }) => (
  <View className="w-[48%] bg-white p-4 rounded-lg mb-4 border-2 border-gray-200">
    <Text className="text-base font-bold text-gray-800 mb-2">{item.ailment}</Text>
    <Text
      className={`text-xs font-bold mb-1 ${
        item.status === 'completed' ? 'text-green-600' : item.status === 'cancelled' ? 'text-red-600' : item.status === 'pending' || item.status === 'searching' ? 'text-yellow-600' : 'text-blue-600'
      }`}
    >
      {item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' ')}
    </Text>
    <Text className="text-xs text-gray-500">{item.date}</Text>
  </View>
);

export default function PatientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAilment, setSelectedAilment] = useState<any>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [recentRequests, setRecentRequests] = useState<HistoryItem[]>([]);
  const [ailmentCategories, setAilmentCategories] = useState<any[]>([]);
  const [isLoadingAilments, setIsLoadingAilments] = useState(false);

  // Function to fetch ailment categories from backend
  const loadAilmentCategories = useCallback(async () => {
    try {
      setIsLoadingAilments(true);
      const socket = socketService.getSocket();
      
      if (!socket?.connected) {
        console.warn('⚠️ Socket not connected, using default ailment categories');
        setAilmentCategories(defaultAilmentCategories);
        return;
      }

      return new Promise<void>((resolve) => {
        let resolved = false;

        const handleAilmentCategories = (categories: any) => {
          if (resolved) return;
          resolved = true;
          
          console.log('📋 Received ailment categories from backend:', categories);
          if (Array.isArray(categories) && categories.length > 0) {
            setAilmentCategories(categories);
          } else {
            console.warn('⚠️ No ailment categories received, using defaults');
            setAilmentCategories(defaultAilmentCategories);
          }
          socket?.off('ailmentCategories', handleAilmentCategories);
          resolve();
        };

        const timeout = setTimeout(() => {
          if (resolved) return;
          resolved = true;
          
          console.warn('⚠️ Ailment categories request timeout, using defaults');
          socket?.off('ailmentCategories', handleAilmentCategories);
          setAilmentCategories(defaultAilmentCategories);
          resolve();
        }, 5000);

        socket?.on('ailmentCategories', handleAilmentCategories);
        console.log('📤 Emitting getAilmentCategories request');
        socket?.emit('getAilmentCategories');
      });
    } catch (error) {
      console.error('Error loading ailment categories:', error);
      setAilmentCategories(defaultAilmentCategories);
    } finally {
      setIsLoadingAilments(false);
    }
  }, []);

  // Function to load recent requests
  const loadRecentRequests = useCallback(async () => {
    try {
      // Fetch requests from backend via socket
      if (user?.userId && socketService.getSocket()?.connected) {
        const liveRequests = await socketService.getPatientRequests(user.userId);
        console.log('🔍 Raw requests received:', liveRequests);
        
        if (Array.isArray(liveRequests) && liveRequests.length > 0) {
          console.log('First request full structure:', JSON.stringify(liveRequests[0], null, 2));
        }
        
        if (Array.isArray(liveRequests)) {
          // Load ailment mappings from local storage
          const ailmentMappingsStr = await AsyncStorage.getItem(`ailment-mappings-${user.userId}`);
          const ailmentMappings = ailmentMappingsStr ? JSON.parse(ailmentMappingsStr) : {};
          console.log('📍 Ailment mappings:', ailmentMappings);
          
          // Get the 2 most recent requests
          const recent = liveRequests
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 2)
            .map((item: any) => {
              // Log each item's ailment structure
              console.log('Item ailmentCategoryId:', item.ailmentCategoryId);
              console.log('Item ailmentCategoryId type:', typeof item.ailmentCategoryId);
              
              // Try to get ailment name from backend data first
              let ailmentName = 'Unknown';
              
              // First, try ailmentCategoryId.title (populated object)
              if (item.ailmentCategoryId?.title) {
                ailmentName = item.ailmentCategoryId.title;
              }
              // Try ailmentCategory field
              else if (item.ailmentCategory) {
                ailmentName = item.ailmentCategory;
              }
              // Try ailmentCategoryId.name (alternative field name)
              else if (item.ailmentCategoryId?.name) {
                ailmentName = item.ailmentCategoryId.name;
              }
              // Fall back to local mapping if available
              else if (ailmentMappings[item._id]) {
                ailmentName = ailmentMappings[item._id];
                console.log('✅ Got ailment from local mapping:', ailmentName);
              }
              
              console.log('Resolved ailment name:', ailmentName);
              
              return {
                _id: item._id,
                ailment: ailmentName,
                status: item.status,
                date: new Date(item.createdAt).toLocaleDateString('en-ZA', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }),
              };
            });
          console.log('📋 Final recent requests:', recent);
          setRecentRequests(recent);
        }
      }
    } catch (error) {
      console.error('Error loading recent requests:', error);
    }
  }, [user?.userId]);

  // Auto-scroll health tips
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % healthTips.length);
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, []);

  // Connect socket on mount and load ailment categories
  useEffect(() => {
    if (user?.userId) {
      // Connect with patient role
      socketService.connect(user.userId, 'patient');
      
      // Load ailment categories after a brief delay to ensure socket is connected
      const timer = setTimeout(() => {
        loadAilmentCategories();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user?.userId, loadAilmentCategories]);

  // Load recent requests on mount and when screen comes into focus
  useEffect(() => {
    loadRecentRequests();
  }, [loadRecentRequests]);

  useFocusEffect(
    useCallback(() => {
      loadRecentRequests();
    }, [loadRecentRequests])
  );

  // Request location permissions on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Location permission is needed to send requests to nearby healthcare providers.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Set a default location for development (Johannesburg)
                  setLocation({ latitude: -22.557840, longitude: 17.072891 });
                  console.log('Location permission denied - using default location');
                }
              }
            ]
          );
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } catch (error: any) {
        console.error('Location error:', error);
        // Set default location for emulator/testing
        const defaultLocation = { latitude: -26.2041, longitude: 28.0473 };
        setLocation(defaultLocation);
        
        Alert.alert(
          'Location Unavailable',
          'Could not get your current location. Using default location for testing. On a real device, please enable location services.',
          [
            {
              text: 'Try Again',
              onPress: async () => {
                try {
                  const currentLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Low,
                  });
                  setLocation({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                  });
                } catch (retryError) {
                  console.error('Retry failed:', retryError);
                  // Keep using default location
                }
              }
            },
            { text: 'Use Default', style: 'cancel' }
          ]
        );
      }
    })();
  }, []);

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
        Alert.alert('Getting Location', 'Fetching your current location...');
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

      // Save ailment mapping locally for future reference (since backend stores null)
      if (request && (request as any)._id) {
        try {
          const ailmentMappingsStr = await AsyncStorage.getItem(`ailment-mappings-${user.userId}`);
          const ailmentMappings = ailmentMappingsStr ? JSON.parse(ailmentMappingsStr) : {};
          ailmentMappings[(request as any)._id] = requestData.ailmentCategory;
          await AsyncStorage.setItem(`ailment-mappings-${user.userId}`, JSON.stringify(ailmentMappings));
          console.log('💾 Saved ailment mapping:', ailmentMappings);
        } catch (storageError) {
          console.error('Error saving ailment mapping:', storageError);
        }
      }

      Alert.alert(
        'Request Created',
        'Your request has been sent to nearby healthcare providers. You will be notified when a provider accepts.',
        [{ text: 'OK' }]
      );

      console.log('Request created:', request);
      
      // Refresh recent requests to show the newly created request
      loadRecentRequests();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create request');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    } else if (hour < 18) {
      return 'Good Afternoon';
    } else {
      return 'Good Evening';
    }
  };

  const greeting = getGreeting();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
        <ScrollView className="flex-1">
          {/* Header (matched to ProviderHome spacing + style) */}
          <View className="pt-4 px-4 flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold">
                {greeting},{' '}
                {user?.fullname || 'Patient'}
              </Text>
            </View>
          </View>

          {/* Info Banner (styled like Provider approval banner) */}
          <View className="bg-blue-100 rounded-lg p-6 mx-4 mt-2 mb-4">
            <Text className="text-lg font-semibold text-gray-800">
              Welcome to your health dashboard.
            </Text>
            <Text className="text-lg text-gray-800">
              Quickly find help and track your recent activity.
            </Text>
          </View>

          {/* Health Tips Section - Auto Scrolling */}
          <View className="mb-8 px-4">
            <Text className="text-xl font-bold text-gray-800 mb-4">
              Health Tips
            </Text>
            <HealthTipCard item={healthTips[currentTipIndex]} />
          </View>

          {/* Main Content Area */}
          <View className="px-4 mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-2xl font-bold text-gray-800">
                What do you need help with today?
              </Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(patient)/all_ailments')}>
                <Text className="font-semibold text-blue-600">See all</Text>
              </TouchableOpacity>
            </View>

            {/* Ailment Grid (cards styled like Provider request cards) */}
            {isLoadingAilments ? (
              <View className="items-center justify-center py-8">
                <Text className="text-gray-600">Loading ailments...</Text>
              </View>
            ) : (
              <FlatList
                data={ailmentCategories.length > 0 ? ailmentCategories.slice(0, 6) : defaultAilmentCategories.slice(0, 6)}
                keyExtractor={(item) => item._id}
                numColumns={2}
                scrollEnabled={false} // Disable scrolling for this nested list
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                renderItem={({ item }) => (
                  <AilmentCard item={item} onPress={() => handleAilmentSelect(item)} />
                )}
              />
            )}
          </View>

          {/* Recent Activity / History Section (similar spacing to Ailments) */}
          <View className="px-4 mb-8">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-800">
                Recent Activity
              </Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(patient)/recent-activities')}>
                <Text className="font-semibold text-blue-600">See all</Text>
              </TouchableOpacity>
            </View>

            {recentRequests.length === 0 ? (
              <View className="bg-white rounded-lg border-2 border-gray-200 p-6 items-center">
                <Feather name="clock" size={40} color="#9CA3AF" />
                <Text className="text-gray-600 mt-3 text-center">
                  No recent appointments yet
                </Text>
              </View>
            ) : (
              <FlatList
                data={recentRequests}
                keyExtractor={(item) => item._id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                renderItem={({ item }) => <HistoryCard item={item} />}
              />
            )}
          </View>
        </ScrollView>

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
      </View>
    </SafeAreaView>
  );
}
