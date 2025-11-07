// In app/(patient)/home.tsx

import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookingModal from '../../components/(patient)/BookingModal';


const DUMMY_AILMENTS: AilmentCategory[] = [
  { _id: '1', title: 'Fever & Flu', description: 'Consult for high temperature.', estimatedCost: 'N$ 250', color: '#ef4444', icon: 'thermometer' },
  { _id: '2', title: 'Injuries', description: 'Care for cuts, sprains, and bruises.', estimatedCost: 'N$ 400', color: '#f97316', icon: 'medkit' },
  { _id: '3', title: 'Check-ups', description: 'Routine health assessments.', estimatedCost: 'N$ 500', color: '#22c55e', icon: 'clipboard' },
  { _id: '4', title: 'Skin Issues', description: 'Rashes, acne, and infections.', estimatedCost: 'N$ 350', color: '#eab308', icon: 'eye' },
];

// Define the type for an ailment category, based on your old code
interface AilmentCategory {
  _id: string;
  title: string;
  icon: string; // We'll handle icons more flexibly
  description: string;
  estimatedCost: string;
  color: string;
}

// TODO: Replace this with your actual authentication context/state management
const DUMMY_USER = {
  _id: '12345',
  fullname: 'John Doe',
};

// A reusable card component for each ailment
const AilmentCard = ({ item, onPress }: { item: AilmentCategory, onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    className="w-[48%] bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm"
    activeOpacity={0.7}
  >
    <View className="items-center">
      <View style={{ backgroundColor: item.color || '#E9F7EF' }} className="p-3 rounded-full mb-3">
        <Feather name="activity" size={24} color="#007BFF" />
      </View>
      <Text className="text-center font-semibold text-text-main mb-2">{item.title}</Text>
      <Text className="text-xs text-gray-500 text-center mb-3">{item.description}</Text>
      <Text className="text-sm font-semibold text-secondary">{item.estimatedCost}</Text>
    </View>
  </TouchableOpacity>
);

export default function HomeScreen() {
  const [ailmentCategories, setAilmentCategories] = useState<AilmentCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Can change this to false with dummy data
  const [selectedCategory, setSelectedCategory] = useState<AilmentCategory | null>(null);

  // --- 2. REPLACE the fetchAilments and useFocusEffect with this simpler version ---
  useFocusEffect(
    useCallback(() => {
      // We are now just setting our dummy data instead of fetching
      setAilmentCategories(DUMMY_AILMENTS);
      setIsLoading(false);
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-background-light">
      {/* Custom Header */}
      <View className="bg-white px-6 py-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-text-main">Health Connect</Text>
            <Text className="text-sm text-gray-500 mt-1">Hello, {DUMMY_USER.fullname}!</Text>
          </View>
          <TouchableOpacity className="p-2">
            <Feather name="bell" size={24} color="#6C757D" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#007BFF" />
        </View>
      ) : (
        <FlatList
          data={ailmentCategories}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 16 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          ListHeaderComponent={
            <Text className="text-lg font-bold text-text-main mb-4 px-3">
              What do you need help with?
            </Text>
          }
          renderItem={({ item }) => (
            <AilmentCard item={item} onPress={() => setSelectedCategory(item)} />
          )}
        />
      )}
      
      {/* TODO: We will create and import the Booking Modal component next */}
      {/* <BookingModal 
        visible={!!selectedCategory} 
        category={selectedCategory}
        onClose={() => setSelectedCategory(null)}
        userId={DUMMY_USER._id}
      /> */}
      <BookingModal 
    visible={!!selectedCategory} 
    category={selectedCategory}
    onClose={() => setSelectedCategory(null)}
    userId={DUMMY_USER._id}
  />

    </SafeAreaView>
  );
}