import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    FlatList,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';

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
  { id: '1', title: 'Flu, Cold & Cough', provider: 'Doctor', icon: 'thermometer' },
  { id: '2', title: 'Sore Throat & Ear Ache', provider: 'Doctor', icon: 'mic' },
  { id: '3', title: 'Skin Rash', provider: 'Nurse', icon: 'aperture' },
  { id: '4', title: 'Headache or Migraine', provider: 'Doctor', icon: 'zap' },
  { id: '5', title: 'Elderly Wellness Check', provider: 'Social Worker', icon: 'heart' },
  { id: '6', title: 'Sports Injury', provider: 'Physiotherapist', icon: 'activity' },
];

const appointmentHistory = [
  { id: '1', ailment: 'Fever & Flu', status: 'Completed', date: 'Oct 26, 2023' },
  { id: '2', ailment: 'Sports Injury', status: 'Upcoming', date: 'Nov 15, 2023' },
];

// --- Reusable Components for this Screen ---
const HealthTipCard = ({ item }: { item: (typeof healthTips)[0] }) => (
  <View className={`w-64 rounded-lg p-4 mr-3 ${item.bgColor}`}>
    <Text className="font-bold text-base text-gray-800">{item.title}</Text>
    <Text className="text-sm text-gray-700 mt-1">{item.content}</Text>
  </View>
);

const AilmentCard = ({ item }: { item: (typeof ailmentCategories)[0] }) => (
  <TouchableOpacity className="w-[48%] bg-white rounded-lg p-4 mb-4 border-2 border-gray-200">
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
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      // Don't manually navigate - let the root layout handle it
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
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

            <TouchableOpacity
              onPress={handleLogout}
              disabled={isLoggingOut}
              className="flex-row items-center justify-center bg-red-500 px-4 py-2 rounded-lg"
            >
              <Feather name="log-out" size={20} color="#FFFFFFFF" />
              <Text className="ml-2 text-sm font-semibold text-white">
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </Text>
            </TouchableOpacity>
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

          {/* Health Tips Section (with Provider-style padding) */}
          <View className="px-4 mb-6">
            <Text className="text-xl font-bold text-gray-800 mb-3">
              Health Tips
            </Text>
            <FlatList
              data={healthTips}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
              renderItem={({ item }) => <HealthTipCard item={item} />}
            />
          </View>

          {/* Main Content Area */}
          <View className="px-4 mb-6">
            <Text className="text-2xl font-bold text-gray-800 mb-4">
              What do you need help with today?
            </Text>

            {/* Search Bar (card-like, similar borders to Provider stats) */}
            <View className="flex-row items-center bg-white border-2 border-gray-200 rounded-lg px-3 py-2 mb-6">
              <Feather name="search" size={20} color="#6B7280" />
              <TextInput
                placeholder="Search or select ailment"
                className="flex-1 ml-3 text-base"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Ailment Grid (cards styled like Provider request cards) */}
            <FlatList
              data={ailmentCategories}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false} // Disable scrolling for this nested list
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={({ item }) => <AilmentCard item={item} />}
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

          {/* Spacer so content isn't hidden behind sticky button */}
          <View className="h-24" />
        </ScrollView>

        {/* Sticky Call Now Button (styled like Provider “Accept” button) */}
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <TouchableOpacity className="w-full bg-blue-600 py-3 rounded-lg">
            <Text className="text-white text-center text-lg font-semibold">
              Call Now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
