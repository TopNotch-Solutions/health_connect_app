// In components/(patient)/BookingModal.tsx

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { namibianRegions, townsByRegion } from '../../constants/locations';
import apiClient from '../../lib/api';

// Define the types needed for this component
interface AilmentCategory {
  _id: string;
  title: string;
  estimatedCost: string;
  color: string;
}

interface BookingModalProps {
  visible: boolean;
  category: AilmentCategory | null;
  onClose: () => void;
  userId: string; // We'll pass the user ID as a prop
}

const UrgencyOption = ({ value, label, color, selected, onPress }: any) => (
  <TouchableOpacity
    onPress={() => onPress(value)}
    className={`flex-row items-center p-3 rounded-xl mb-2 ${selected ? 'bg-primary/10 border-2 border-primary' : 'bg-gray-100'}`}
  >
    <View style={{ backgroundColor: color }} className="w-3 h-3 rounded-full mr-3" />
    <Text className="font-medium text-text-main">{label}</Text>
  </TouchableOpacity>
);

export default function BookingModal({ visible, category, onClose, userId }: BookingModalProps) {
  const router = useRouter();
  const [isBooking, setIsBooking] = useState(false);
  
  const [bookingData, setBookingData] = useState({
    symptoms: '',
    urgency: 'medium',
    address: '',
    town: '',
    region: '',
  });

  const [availableTowns, setAvailableTowns] = useState<{ label: string; value: string }[]>([]);

  // Reset form when the modal is closed or category changes
  useEffect(() => {
    if (visible) {
      setBookingData({
        symptoms: '',
        urgency: 'medium',
        address: '',
        town: '',
        region: '',
      });
      setAvailableTowns([]);
    }
  }, [visible, category]);

  const handleInputChange = (name: string, value: any) => {
    setBookingData(prev => ({ ...prev, [name]: value }));
    if (name === 'region') {
      setAvailableTowns(townsByRegion[value] || []);
      setBookingData(prev => ({ ...prev, town: '' }));
    }
  };

  const handleBookingSubmit = async () => {
    if (!category || !userId) return;
    if (!bookingData.address || !bookingData.town || !bookingData.region) {
      return Alert.alert("Validation Error", "Please provide your complete address details.");
    }

    setIsBooking(true);
    try {
      // NOTE: Update this endpoint to match your current backend route for creating a request.
      // Your old code used `/api/request/request/${currentUser._id}`.
      const response = await apiClient.post(`/request/request/${userId}`, {
        ailmentCategoryId: category._id,
        address: {
          street: bookingData.address,
          city: bookingData.town,
          region: bookingData.region,
          // Using default coordinates as in the old code.
          // TODO: Implement real location services later.
          coordinates: { latitude: -22.5609, longitude: 17.0658 }
        },
        symptoms: bookingData.symptoms.trim(),
        urgency: bookingData.urgency,
        paymentMethod: "wallet" // Hardcoded as in the old code
      });

      if (response.status === 201 || response.status === 200) {
        Alert.alert(
          "Request Submitted!",
          "We're searching for available providers. You'll be notified shortly.",
          [{ text: "OK", onPress: () => {
              onClose(); // Close the modal
              router.push('/(patient)/history'); // Navigate to history/requests screen
            }
          }]
        );
      }
    } catch (error: any) {
      Alert.alert("Booking Failed", error.response?.data?.message || "An unexpected error occurred.");
    } finally {
      setIsBooking(false);
    }
  };

  const urgencyOptions = [
    { value: "low", label: "Low Priority", color: '#22c55e' }, // green-500
    { value: "medium", label: "Medium Priority", color: '#f59e0b' }, // yellow-500
    { value: "high", label: "High Priority", color: '#f97316' }, // orange-500
    { value: "emergency", label: "Emergency", color: '#ef4444' }, // red-500
  ];

  if (!category) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6 max-h-[85%]">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-text-main">Book Consultation</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#6C757D" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ backgroundColor: `${category.color}1A` }} className="p-4 rounded-xl mb-6">
              <View className="flex-row items-center">
                <View style={{ backgroundColor: category.color }} className="p-2 rounded-lg mr-3">
                  <Feather name="activity" size={20} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-text-main">{category.title}</Text>
                  <Text className="text-sm text-gray-600">Est. Cost: {category.estimatedCost}</Text>
                </View>
              </View>
            </View>

            <Text className="text-lg font-semibold text-text-main mb-3">Your Location</Text>
            <TextInput
              className="bg-gray-100 p-4 rounded-xl mb-3"
              placeholder="Street Address or P.O. Box"
              value={bookingData.address}
              onChangeText={(text) => handleInputChange('address', text)}
            />
            <View className="bg-gray-100 border-gray-200 rounded-xl px-3 mb-3" style={{ height: 56, justifyContent: 'center' }}>
              <RNPickerSelect onValueChange={(value) => handleInputChange('region', value)} items={namibianRegions} placeholder={{ label: "Select a region...", value: null }} value={bookingData.region} Icon={() => <Feather name="chevron-down" size={24} color="gray" />} />
            </View>
            <View className="bg-gray-100 border-gray-200 rounded-xl px-3 mb-6" style={{ height: 56, justifyContent: 'center' }}>
              <RNPickerSelect onValueChange={(value) => handleInputChange('town', value)} items={availableTowns} placeholder={{ label: "Select a town...", value: null }} value={bookingData.town} disabled={!bookingData.region} Icon={() => <Feather name="chevron-down" size={24} color="gray" />} />
            </View>

            <Text className="text-lg font-semibold text-text-main mb-3">Describe Symptoms (Optional)</Text>
            <TextInput
              className="bg-gray-100 p-4 rounded-xl h-24"
              placeholder="Briefly describe what you're experiencing..."
              multiline
              textAlignVertical="top"
              value={bookingData.symptoms}
              onChangeText={(text) => handleInputChange('symptoms', text)}
            />

            <Text className="text-lg font-semibold text-text-main my-3">Priority Level</Text>
            {urgencyOptions.map((option) => (
              <UrgencyOption key={option.value} {...option} selected={bookingData.urgency === option.value} onPress={handleInputChange.bind(null, 'urgency')} />
            ))}

            <TouchableOpacity
              className={`bg-primary py-4 rounded-xl items-center mt-6 ${isBooking ? 'opacity-50' : ''}`}
              onPress={handleBookingSubmit}
              disabled={isBooking}
            >
              {isBooking ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Request Healthcare Provider</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}