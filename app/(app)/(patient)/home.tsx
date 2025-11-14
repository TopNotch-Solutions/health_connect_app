import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';

// --- Dummy Data (for UI development, replace with API data later) ---
const healthTips = [
  { id: '1', title: 'Stay Hydrated', content: 'Drink 8 glasses of water a day.', bgColor: 'bg-blue-100' },
  { id: '2', title: 'Get Enough Sleep', content: 'Aim for 7-9 hours per night.', bgColor: 'bg-purple-100' },
  { id: '3', title: 'Eat a Balanced Diet', content: 'Include fruits and vegetables.', bgColor: 'bg-green-100' },
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
const HealthTipCard = ({ item }: { item: typeof healthTips[0] }) => (
  <View className={`w-64 rounded-xl p-4 mr-4 ${item.bgColor}`}>
    <Text className="font-bold text-base text-text-main">{item.title}</Text>
    <Text className="text-sm text-gray-600 mt-1">{item.content}</Text>
  </View>
);

const AilmentCard = ({ item }: { item: typeof ailmentCategories[0] }) => (
  <TouchableOpacity className="w-[48%] bg-white rounded-2xl p-4 mb-4 border border-gray-200 shadow-sm">
    <Feather name={item.icon as any} size={28} color="#007BFF" />
    <Text className="text-base font-bold text-text-main mt-3">{item.title}</Text>
    <Text className="text-sm text-gray-500 mt-1">{item.provider}</Text>
  </TouchableOpacity>
);

const HistoryCard = ({ item }: { item: typeof appointmentHistory[0] }) => (
  <View className="bg-white p-4 rounded-xl border border-gray-200 flex-1">
    <Text className="text-base font-semibold text-text-main">{item.ailment}</Text>
    <Text
      className={`text-sm font-bold ${
        item.status === 'Completed' ? 'text-secondary' : 'text-primary'
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
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      router.replace('/sign-in'); // goes back to the sign-in screen
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Custom Header */}
          <View className="px-6 pt-4 flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-gray-500">Welcome back</Text>
              <Text className="text-xl font-bold text-text-main">
                {user?.fullname || 'Patient'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleLogout}
              disabled={isLoggingOut}
              className="flex-row items-center"
            >
              <Feather name="log-out" size={20} color="#EF4444" />
              <Text className="ml-2 text-sm font-semibold text-red-500">
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Health Tips Section */}
          <View className="mt-6">
            <Text className="text-xl font-bold text-text-main mb-3 px-6">Health Tips</Text>
            <FlatList
              data={healthTips}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24 }}
              renderItem={({ item }) => <HealthTipCard item={item} />}
            />
          </View>

          {/* Main Content Area */}
          <View className="px-6 mt-8">
            <Text className="text-3xl font-bold text-text-main mb-4">
              What do you need help with today?
            </Text>

            {/* Search Bar */}
            <View className="flex-row items-center bg-white border border-gray-200 rounded-xl p-3 mb-6">
              <Feather name="search" size={20} color="#6C757D" />
              <TextInput
                placeholder="Search or select ailment"
                className="flex-1 ml-3 text-base"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Ailment Grid */}
            <FlatList
              data={ailmentCategories}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false} // Disable scrolling for this nested list
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={({ item }) => <AilmentCard item={item} />}
            />
          </View>

          {/* History Appointments Section */}
          <View className="mt-8 px-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xl font-bold text-text-main">Recent Activity</Text>
              <TouchableOpacity>
                <Text className="font-semibold text-primary">See all</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row" style={{ gap: 16 }}>
              {appointmentHistory.map((item) => (
                <HistoryCard key={item.id} item={item} />
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Sticky Call Now Button */}
        <View className="absolute bottom-0 left-0 right-0 p-6 border-t border-t-gray-200">
          <TouchableOpacity className="w-full bg-primary p-4 rounded-xl">
            <Text className="text-white text-center text-lg font-semibold">Call Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
