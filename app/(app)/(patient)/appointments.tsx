// In app/(patient)/appointments.tsx

import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../../lib/api';

// In app/(patient)/appointments.tsx

// --- THIS IS THE NEW, CORRECTED DUMMY DATA ---
const DUMMY_APPOINTMENTS_DATA: BookingRequest[] = [
  {
    _id: 'appt-1',
    ailmentCategoryId: { title: 'Fever & Flu Follow-up' },
    status: 'accepted',
    createdAt: new Date('2025-11-10T14:30:00Z').toISOString(), // Use a future date
    providerId: { fullname: 'Dr. Emily Jones' },
  },
  {
    _id: 'appt-2',
    ailmentCategoryId: { title: 'Routine Physical Check-up' },
    status: 'accepted',
    createdAt: new Date('2025-11-15T09:00:00Z').toISOString(), // Use a future date
    providerId: { fullname: 'Dr. David Chen' },
  },
  {
    _id: 'appt-3',
    ailmentCategoryId: { title: 'Dermatology Consultation' },
    status: 'accepted',
    createdAt: new Date('2025-11-22T11:00:00Z').toISOString(), // Use a future date
    providerId: { fullname: 'Dr. Sarah Smith' },
  },
  // We can include a non-accepted item to ensure the filter is working
  {
    _id: 'appt-4',
    ailmentCategoryId: { title: 'Injury Assessment' },
    status: 'pending',
    createdAt: new Date().toISOString(),
    providerId: { fullname: 'To be assigned' },
  },
];
// ---------------------------------------------

// Reusing the same BookingRequest type
interface BookingRequest {
  _id: string;
  ailmentCategoryId: {
    title: string;
  };
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  createdAt: string; // This would ideally be an appointmentDate
  // We'll assume the provider's name is populated by the backend
  providerId?: {
    fullname: string;
  };
}

// TODO: Replace this with your actual authentication context/state management
const DUMMY_USER = {
  _id: '12345',
};

// A reusable card for each upcoming appointment
const AppointmentCard = ({ item }: { item: BookingRequest }) => (
  <View className="bg-white p-4 rounded-xl mb-4 border border-gray-100 shadow-sm">
    <View className="flex-row justify-between items-start">
      <View className="flex-1">
        <Text className="text-lg font-bold text-text-main mb-2">
          {item.ailmentCategoryId?.title || 'General Consultation'}
        </Text>
        <View className="flex-row items-center mb-2">
          <Feather name="user-check" size={14} color="#6C757D" />
          <Text className="text-sm text-gray-600 ml-2">
            Provider: {item.providerId?.fullname || 'To be assigned'}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Feather name="calendar" size={14} color="#6C757D" />
          {/* NOTE: We're using createdAt for now. Ideally, your backend would provide an `appointmentDate` field. */}
          <Text className="text-sm text-gray-600 ml-2">
            Date: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View className="items-center">
        {/* You could add a "Cancel" or "Reschedule" button here in the future */}
      </View>
    </View>
  </View>
);


export default function AppointmentsScreen() {
  const [appointments, setAppointments] = React.useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchAppointments = React.useCallback(async () => {
    try {
      setIsLoading(true);
      // We fetch all requests, same as the history screen
      const response = await apiClient.get(`/request/my-requests/${DUMMY_USER._id}`);
      
      // --- THE KEY LOGIC: We filter on the frontend ---
      const acceptedAppointments = (response.data.data || []).filter(
        (request: BookingRequest) => request.status === 'accepted'
      );
      
      setAppointments(acceptedAppointments);

    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      alert('Failed to load appointments. ' + (error.response?.data?.message || ''));
    } finally {
      setIsLoading(false);
    }
  }, []);

   useFocusEffect(
    React.useCallback(() => {
      setIsLoading(true);
      setTimeout(() => {
        // We still apply the filter to the dummy data, just like with real data
        const acceptedAppointments = DUMMY_APPOINTMENTS_DATA.filter(
          (request) => request.status === 'accepted'
        );
        setAppointments(acceptedAppointments);
        setIsLoading(false);
      }, 500);
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-background-light">
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#007BFF" />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => <AppointmentCard item={item} />}
          ListHeaderComponent={
            <Text className="text-2xl font-bold text-text-main mb-4">
              Your Upcoming Appointments
            </Text>
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center mt-20">
              <Feather name="calendar" size={48} color="#CBD5E1" />
              <Text className="text-lg text-gray-500 mt-4">No upcoming appointments.</Text>
              <Text className="text-base text-gray-400 mt-1 text-center">
                When a provider accepts your request, your appointment will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}