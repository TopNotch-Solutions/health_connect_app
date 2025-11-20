import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const ailmentCategories = [
  { id: '1', title: 'Flu, Cold & Cough', provider: 'Doctor', icon: 'wind' },
  { id: '2', title: 'Sore Throat & Ear Ache', provider: 'Doctor', icon: 'alert-circle' },
  { id: '3', title: 'Skin Rash', provider: 'Nurse', icon: 'alert-octagon' },
  { id: '4', title: 'Headache or Migraine', provider: 'Doctor', icon: 'activity' },
  { id: '5', title: 'Elderly Wellness Check', provider: 'Social Worker', icon: 'heart' },
  { id: '6', title: 'Sports Injury', provider: 'Physiotherapist', icon: 'target' },
];

const appointmentHistory = [
  { id: '1', ailment: 'Fever & Flu', status: 'Completed', date: 'Oct 26, 2023' },
  { id: '2', ailment: 'Sports Injury', status: 'Upcoming', date: 'Nov 15, 2023' },
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
  item: (typeof ailmentCategories)[0]; 
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

const HistoryCard = ({ item }: { item: (typeof appointmentHistory)[0] }) => (
  <View className="bg-white p-4 rounded-lg border-2 border-gray-200 flex-1">
    <Text className="text-base font-semibold text-gray-800">{item.ailment}</Text>
    <Text
      className={`text-sm font-bold mt-1 ${
        item.status === 'Completed' ? 'text-green-600' : 'text-blue-600'
      }`}
    >
      {item.status}
    </Text>
    <Text className="text-xs text-gray-500 mt-1">{item.date}</Text>
  </View>
);

export default function PatientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAilment, setSelectedAilment] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Auto-scroll health tips
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % healthTips.length);
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, []);

  // Connect socket on mount
  useEffect(() => {
    if (user?.userId) {
      // Connect with patient role
      socketService.connect(user.userId, 'patient');
    }

    return () => {
      socketService.disconnect();
    };
  }, [user?.userId]);

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

  const handleAilmentSelect = (ailment: string) => {
    setSelectedAilment(ailment);
    setModalVisible(true);
  };

  const handleCreateRequest = async (requestData: {
    ailmentCategory: string;
    symptoms: string;
    urgencyLevel: 'low' | 'medium' | 'high';
    paymentMethod: 'wallet' | 'cash';
    estimatedCost: number;
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
        urgencyLevel: requestData.urgencyLevel,
        paymentMethod: requestData.paymentMethod,
        symptoms: requestData.symptoms,
        estimatedCost: requestData.estimatedCost,
      });

      Alert.alert(
        'Request Created',
        'Your request has been sent to nearby healthcare providers. You will be notified when a provider accepts.',
        [{ text: 'OK' }]
      );

      console.log('Request created:', request);
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
            <FlatList
              data={ailmentCategories}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false} // Disable scrolling for this nested list
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={({ item }) => (
                <AilmentCard item={item} onPress={() => handleAilmentSelect(item.title)} />
              )}
            />
          </View>

          {/* Recent Activity / History Section (similar spacing to Incoming Requests) */}
          <View className="px-4 mb-8">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xl font-bold text-gray-800">
                Recent Activity
              </Text>
              <TouchableOpacity>
                <Text className="font-semibold text-blue-600">See all</Text>
              </TouchableOpacity>
            </View>

            {appointmentHistory.length === 0 ? (
              <View className="bg-white rounded-lg border-2 border-gray-200 p-6 items-center">
                <Feather name="clock" size={40} color="#9CA3AF" />
                <Text className="text-gray-600 mt-3 text-center">
                  No recent appointments yet
                </Text>
              </View>
            ) : (
              <View className="flex-row" style={{ gap: 12 }}>
                {appointmentHistory.map((item) => (
                  <HistoryCard key={item.id} item={item} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Create Request Modal */}
        <CreateRequestModal
          visible={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setSelectedAilment('');
          }}
          onSubmit={handleCreateRequest}
          selectedAilment={selectedAilment}
        />
      </View>
    </SafeAreaView>
  );
}
