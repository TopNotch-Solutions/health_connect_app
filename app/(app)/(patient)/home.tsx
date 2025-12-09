import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import CreateRequestModal from '../../../components/(patient)/CreateRequestModal';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../lib/socket';
import { getLocationCoordinates } from '../../../lib/geocoding';

// Import ailment icons directly
const bacteriaIcon = require('../../../assets/icons/bacteria.png');
const painIcon = require('../../../assets/icons/pain.png');
const mosquitoIcon = require('../../../assets/icons/mosquito (1).png');
const bloodPressureIcon = require('../../../assets/icons/blood-pressure-check.png');
const careIcon = require('../../../assets/icons/care.png');
const woundCareIcon = require('../../../assets/icons/wound-care.png');

const AilmentIconMap: { [key: string]: any } = {
  // The KEY must EXACTLY match the 'title' from your backend (case-sensitive)
  'Allergic Reactions or Bites': require('../../../assets/icons/mosquito (1).png'),
  'Bladder Infection / UTI Symptoms': require('../../../assets/icons/bacteria.png'),
  'Blood Pressure & Sugar Monitoring': require('../../../assets/icons/blood-pressure-check.png'),
  'Caregiver Stress & Burnout': require('../../../assets/icons/care.png'),
  'Assessment of a Sports Injury': require('../../../assets/icons/wound-care.png'), // Assuming 'check' is the right name
  'Back, Neck, or Shoulder Pain': require('../../../assets/icons/pain.png'),
};

const ailmentIcons = [
  bacteriaIcon,
  painIcon,
  mosquitoIcon,
  bloodPressureIcon,
  careIcon,
  woundCareIcon,
];

const assignAilmentIcons = (categories: any[] = []) => {
  // Mapping keywords -> local asset
  const keywordMap: { [key: string]: any } = {
    bacteria: bacteriaIcon,
    uti: bacteriaIcon,
    bladder: bacteriaIcon,
    pain: painIcon,
    back: painIcon,
    neck: painIcon,
    shoulder: painIcon,
    mosquito: mosquitoIcon,
    allerg: mosquitoIcon,
    bite: mosquitoIcon,
    rash: mosquitoIcon,
    blood: bloodPressureIcon,
    pressure: bloodPressureIcon,
    sugar: bloodPressureIcon,
    bp: bloodPressureIcon,
    care: careIcon,
    caregiver: careIcon,
    wound: woundCareIcon,
    sport: woundCareIcon,
    injury: woundCareIcon,
    check: woundCareIcon,
    assessment: woundCareIcon,
  };

  

  const resolveFromString = (s: string, index: number) => {
    const trimmed = s.trim();
    if (!trimmed) return ailmentIcons[index % ailmentIcons.length];

    // URL or data URI
    const looksLikeUrl = /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:');
    if (looksLikeUrl) return { uri: trimmed };

    const lw = trimmed.toLowerCase();
    // Try keyword map
    for (const key of Object.keys(keywordMap)) {
      if (lw.includes(key)) return keywordMap[key];
    }

    // Fallback: if string looks like a filename (contains png/jpg), try to map by filename
    if (lw.includes('.png') || lw.includes('.jpg') || lw.includes('.jpeg')) {
      if (lw.includes('bacteria')) return bacteriaIcon;
      if (lw.includes('pain')) return painIcon;
      if (lw.includes('mosquito')) return mosquitoIcon;
      if (lw.includes('blood')) return bloodPressureIcon;
      if (lw.includes('care')) return careIcon;
      if (lw.includes('wound') || lw.includes('sport') || lw.includes('injury')) return woundCareIcon;
    }

    return ailmentIcons[index % ailmentIcons.length];
  };

  const mapped = categories.map((category = {}, index: number) => {
    const fallbackIcon = ailmentIcons[index % ailmentIcons.length];
    const rawIcon = category?.icon;
    let resolvedIcon = fallbackIcon;

    if (rawIcon) {
      if (typeof rawIcon === 'string') {
        resolvedIcon = resolveFromString(rawIcon, index);
      } else {
        // If backend already sent a require/object, use it
        resolvedIcon = rawIcon;
      }
    } else {
      // No icon provided by backend: infer from title or name
      const title = (category && (category.title || category.name || '')) as string;
      resolvedIcon = resolveFromString(title, index);
    }

    const out = {
      ...category,
      icon: resolvedIcon,
    };

    console.log(`🔧 assignAilmentIcons: resolved icon for [${index}] "${(category as any).title || (category as any).name || ''}" ->`,
      typeof resolvedIcon === 'object' && (resolvedIcon as any).uri ? (resolvedIcon as any).uri : 'local-asset');

    return out;
  });

  console.log('🧩 assignAilmentIcons -> input count:', categories?.length ?? 0);
  console.log('🧩 assignAilmentIcons -> first mapped item:', mapped[0]);

  return mapped;
};
// --- Dummy Data (for UI development, replace with API data later) ---
const healthTips = [
  {
    id: '1',
    title: 'Stay Hydrated',
    content: 'Drink 8 glasses of water a day.',
    bgColor: 'bg-blue-100',
    bgGradientColor: '#E0F2FE',
    icon: 'water',
    iconColor: '#0284C7',
  },
  {
    id: '2',
    title: 'Get Enough Sleep',
    content: 'Aim for 7-9 hours per night.',
    bgColor: 'bg-purple-100',
    bgGradientColor: '#F3E8FF',
    icon: 'sleep',
    iconColor: '#A855F7',
  },
  {
    id: '3',
    title: 'Eat a Balanced Diet',
    content: 'Include fruits and vegetables.',
    bgColor: 'bg-green-100',
    bgGradientColor: '#DCFCE7',
    icon: 'leaf',
    iconColor: '#22C55E',
  },
  {
    id: '4',
    title: 'Regular Exercise',
    content: 'Move for at least 30 minutes daily.',
    bgColor: 'bg-orange-100',
    bgGradientColor: '#FED7AA',
    icon: 'run',
    iconColor: '#F97316',
  },
];

// Ailment categories will be fetched from backend
// const defaultAilmentCategories = assignAilmentIcons([
//   { _id: '1', title: 'Flu, Cold & Cough Symptoms', provider: 'Doctor', icon: bacteriaIcon },
//   { _id: '2', title: 'Sore Throat & Ear Ache', provider: 'Doctor', icon: painIcon },
//   { _id: '3', title: 'New or Worsening Skin Rash', provider: 'Nurse', icon: mosquitoIcon },
//   { _id: '4', title: 'Headaches or Migraines', provider: 'Doctor', icon: bloodPressureIcon },
//   { _id: '5', title: 'Elderly Parent Wellness Check', provider: 'Social Worker', icon: careIcon },
//   { _id: '6', title: 'Assessment of a Sports Injury', provider: 'Physiotherapist', icon: woundCareIcon },
// ]);
const defaultAilmentCategories = assignAilmentIcons([
  { _id: '1', title: 'Bladder Infection / UTI Symptoms', provider: 'Doctor' },
  { _id: '2', title: 'Back, Neck or Shoulder Pain', provider: 'Doctor' },
  { _id: '3', title: 'Allergic Reactions or Bites', provider: 'Nurse' },
  { _id: '4', title: 'Blood Pressure & Sugar Monitoring', provider: 'Doctor' },
  { _id: '5', title: 'Caregiver Stress & Burnout', provider: 'Social Worker' },
  { _id: '6', title: 'Assessment of a Sports Injury', provider: 'Physiotherapist' },
]);

// --- Reusable Components for this Screen ---
const HealthTipCard = ({ item }: { item: (typeof healthTips)[0] }) => (
  <View 
    className={`rounded-lg p-6 ${item.bgColor}`} 
    style={{ 
      width: '100%',
      backgroundColor: item.bgGradientColor,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    }}
  >
    <View className="flex-row items-center mb-3">
      <MaterialCommunityIcons name={item.icon as any} size={32} color={item.iconColor} />
      <Text className="font-bold text-xl text-gray-800 ml-3 flex-1">{item.title}</Text>
    </View>
    <Text className="text-base text-gray-700 ml-10">{item.content}</Text>
  </View>
);

const AilmentCard = ({ item, onPress }: { item: any; onPress: () => void; }) => {
  return (
    <TouchableOpacity 
      onPress={onPress}
      className="w-[48%] bg-white rounded-2xl p-4 mb-4 border-2 border-gray-200"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      }}
      activeOpacity={0.7}
    >
      {/* The item.icon property is now a direct `require()` path */}
      {item.icon && (
        <Image 
          source={item.icon} 
          style={{ width: 40, height: 40, marginBottom: 8 }} 
          resizeMode="contain"
        />
      )}
      <Text className="text-base font-bold text-gray-800 mt-3">{item.title}</Text>
      <Text className="text-sm text-gray-600 mt-1">{item.provider}</Text>
    </TouchableOpacity>
  );
};

interface HistoryItem {
  _id: string;
  ailment: string;
  status: string;
  date: string;
}

const HistoryCard = ({ item }: { item: HistoryItem }) => (
  <View 
    className="w-[48%] bg-white p-4 rounded-2xl mb-4 border-2 border-gray-200"
    style={{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    }}
  >
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
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  // Function to fetch ailment categories from backend via socket
  const loadAilmentCategories = useCallback(async () => {
    setIsLoadingAilments(true);
    try {
      const socket = socketService.getSocket();
      
      if (!socket?.connected) {
        console.warn('⚠️ Socket not connected');
        setIsLoadingAilments(false);
        return;
      }

      return new Promise<void>((resolve) => {
        let resolved = false;

        const handleAilmentCategories = (categories: any) => {
          if (resolved) return;
          resolved = true;
          
          console.log('📋 Received ailment categories from backend:', categories);
          if (Array.isArray(categories) && categories.length > 0) {
            // Map the backend data to include the correct icon
            const mappedCategories = categories.map((category: any) => ({
              ...category,
              icon: AilmentIconMap[category.title] || AilmentIconMap.default,
            }));
            setAilmentCategories(mappedCategories);
          }
          socket?.off('ailmentCategories', handleAilmentCategories);
          setIsLoadingAilments(false);
          resolve();
        };

        const timeout = setTimeout(() => {
          if (resolved) return;
          resolved = true;
          
          console.warn('⚠️ Ailment categories request timeout');
          socket?.off('ailmentCategories', handleAilmentCategories);
          setIsLoadingAilments(false);
          resolve();
        }, 5000);

        socket?.on('ailmentCategories', handleAilmentCategories);
        console.log('📤 Emitting getAilmentCategories request');
        socket?.emit('getAilmentCategories');

        return () => clearTimeout(timeout);
      });
    } catch (error) {
      console.error('Error loading ailment categories:', error);
      setIsLoadingAilments(false);
    }
  }, []);

  // Function to load recent requests
  const loadRecentRequests = useCallback(async () => {
    try {
      // Fetch requests from backend via socket
      const socket = socketService.getSocket();
      if (!user?.userId || !socket || !socket.connected) {
        console.warn('Socket not ready or user ID missing. Skipping recent requests load.');
        setRecentRequests([]);
        return;
      }

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
    } catch (error) {
      console.error('Error loading recent requests:', error);
    }
  }, [user?.userId]);

  // Auto-scroll health tips with animation
  useEffect(() => {
    slideAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentTipIndex, slideAnim]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % healthTips.length);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Connect socket on mount and load ailment categories
  useEffect(() => {
    if (user?.userId) {
      try {
        // Connect with patient role
        socketService.connect(user.userId, 'patient');
        
        // Load ailment categories after a brief delay to ensure socket is connected
        const timer = setTimeout(() => {
          try {
            loadAilmentCategories();
          } catch (error) {
            console.error('Error loading ailment categories:', error);
          }
        }, 1000);

        return () => clearTimeout(timer);
      } catch (error) {
        console.error('Error connecting to socket:', error);
      }
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
        const coords = await getLocationCoordinates();
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        console.log('✅ Location obtained successfully:', coords);
      } catch (error: any) {
        console.error('Location error:', error);
        // Set default location for emulator/testing
        const defaultLocation = { latitude: -22.557840, longitude: 17.072891 };
        setLocation(defaultLocation);
        
        Alert.alert(
          'Location Error',
          error.message || 'Could not get your current location. Using default location for testing. On a real device, please enable location services.',
          [
            {
              text: 'Try Again',
              onPress: async () => {
                try {
                  const coords = await getLocationCoordinates();
                  setLocation({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                  });
                  console.log('✅ Location retry successful:', coords);
                } catch (retryError: any) {
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
      // Sanitize ailmentCategoryId: backend expects a MongoDB ObjectId (24 hex chars).
      // If the selected/default category uses a placeholder id (like '1'), omit it so the
      // socket service will use its safe fallback. This avoids Mongoose "Cast to ObjectId failed" errors.
      const safeAilmentCategoryId = requestData.ailmentCategoryId && /^[0-9a-fA-F]{24}$/.test(requestData.ailmentCategoryId)
        ? requestData.ailmentCategoryId
        : undefined;

      const request = await socketService.createRequest({
        patientId: user.userId,
        location: currentLocation,
        ailmentCategory: requestData.ailmentCategory,
        ailmentCategoryId: safeAilmentCategoryId,
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
    <SafeAreaView className="flex-1 bg-white" edges={['bottom', 'left', 'right']}>
      <View className="flex-1 p-2">
        <ScrollView className="flex-1">
          <View className="px-4 pb-2">
            <View>
              <Text className="text-2xl font-bold">
                {greeting},
              </Text>
              <Text className="text-2xl font-bold">
                {user?.fullname || 'Patient'}
              </Text>
            </View>
          </View>

          {/* Health Tips Section - Auto Scrolling with Animation */}
          <View className="mb-8 px-4">
            <Animated.View
              style={[
                {
                  opacity: slideAnim,
                  transform: [
                    {
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <HealthTipCard item={healthTips[currentTipIndex]} />
            </Animated.View>
            
            {/* Tip Indicators */}
            <View className="flex-row justify-center mt-4 gap-2">
              {healthTips.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setCurrentTipIndex(index)}
                  className={`rounded-full transition-all ${
                    index === currentTipIndex
                      ? 'bg-blue-600 w-3 h-3'
                      : 'bg-gray-300 w-2 h-2'
                  }`}
                />
              ))}
            </View>
          </View>

          {/* Main Content Area */}
          <View className="px-4 mb-6">
            <View className="flex-row justify-between items-center mb-4 flex-wrap gap-2">
              <Text className="text-xl font-bold text-gray-800 flex-shrink">
                What do you need help with today?
              </Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(patient)/all_ailments')} className="flex-shrink-0">
                <Text className="font-semibold text-blue-600 text-sm">See all</Text>
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
            <View className="flex-row justify-between items-center mb-4 flex-wrap gap-2">
              <Text className="text-lg font-bold text-gray-800 flex-shrink">
                Recent Activity
              </Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(patient)/recent-activities')} className="flex-shrink-0">
                <Text className="font-semibold text-blue-600 text-sm">See all</Text>
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
