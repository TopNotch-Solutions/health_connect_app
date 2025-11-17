// app/(provider)/home.tsx

import { Feather } from "@expo/vector-icons";
import React, { useState, useRef, useCallback } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback, // Correct import from 'react-native'
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../context/AuthContext";

const INITIAL_REGION: Region = {
  latitude: -22,
  longitude: 16,
  latitudeDelta: 2,
  longitudeDelta: 2,
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

export default function ProviderHome() {
  const [requests, setRequests] = useState([
    { id: 1, name: "Linda Robertson", condition: "Fever", distance: "1.9 km", fee: "N$ 100", commission: "N$ 10" },
    { id: 2, name: "Dennis Wheeler", condition: "Cold", distance: "3.7 km", fee: "N$ 150", commission: "N$ 15" },
    { id: 3, name: "Jennifer Chavez", condition: "Headache", distance: "1.4 km", fee: "N$ 120", commission: "N$ 12" },
    { id: 4, name: "Carl Bradley", condition: "Back pain", distance: "3.7 km", fee: "N$ 180", commission: "N$ 18" },
  ]);
  const { user } = useAuth();

  // Online/Offline toggle
  const [isOnline, setIsOnline] = useState(true);
  const toggleOnline = () => setIsOnline((prev) => !prev);

  // Map refs + helpers
  const mapRef = useRef<MapView | null>(null);
  const focusMap = useCallback(() => {
    const greenBayStadium: Region = {
      latitude: 44.5013,
      longitude: -88.0622,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
    mapRef.current?.animateToRegion(greenBayStadium);
  }, []);
  const onRegionChange = (region: Region) => console.log("Region changed:", region);

  const [selectedRequest, setSelectedRequest] = useState<null | typeof requests[0]>(null);

  const handleAccept = (id: number, name: string) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));
    setSelectedRequest(null); // Close modal on accept
    alert(`Accepted consultation request from ${name}`);
  };
  const handleDecline = (id: number, name: string) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));
    setSelectedRequest(null); // Close modal on decline
    alert(`Declined consultation request from ${name}`);
  };
  const greeting = getGreeting();

  return (
    <SafeAreaView className="flex-1">
      <ScrollView className="flex-1">
        {/* Header with provider name + Online/Offline toggle */}
        <View className="pt-4 px-4 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold">
              {greeting}, {user?.fullname || "Provider"}
            </Text>
          </View>

          {/* Online/Offline toggle button */}
          <TouchableOpacity
            onPress={toggleOnline}
            className={`px-4 py-2 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-400"
              }`}
          >
            <Text className="text-white font-semibold text-sm">{isOnline ? "Online" : "Offline"}</Text>
          </TouchableOpacity>
        </View>

        {/* Approval Banner */}
        <View className="bg-blue-100 rounded-lg p-6 mx-4 mt-2 mb-4">
          <Text className="text-lg font-semibold text-gray-800">
            Your account is approved.
          </Text>
          <Text className="text-lg text-gray-800">
            You are now ready to accept requests.
          </Text>
        </View>

        {/* Stats Cards */}
        <View className="flex-row gap-3 px-4 mb-6">
          <View className="flex-1 bg-white rounded-lg border-2 border-gray-200 p-4">
            <Text className="text-sm text-gray-600 mb-2">Consultations</Text>
            <Text className="text-xl font-bold">{requests.length}</Text>
          </View>
          <View className="flex-1 bg-white rounded-lg border-2 border-gray-200 p-4">
            <Text className="text-sm text-gray-600 mb-2">Earnings Per Month</Text>
            <Text className="text-xl font-bold">N$435.00</Text>
          </View>
        </View>

        {/* Incoming Consultation Requests */}
        <View className="px-4 mb-6">
          <Text className="text-2xl font-bold mb-4">
            Incoming Consultation Requests
          </Text>

          {requests.length === 0 ? (
            <View className="bg-white rounded-lg border-2 border-gray-200 p-8 items-center">
              <Feather name="check-circle" size={48} color="#10B981" />
              <Text className="text-gray-600 mt-3 text-center">
                No pending consultation requests
              </Text>
            </View>
          ) : (
            requests.map((request) => (
              <TouchableOpacity
                key={request.id}
                onPress={() => setSelectedRequest(request)}
                className="bg-white rounded-lg border-2 border-gray-200 p-5 mb-3"
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1 space-y-1">
                    <Text className="text-lg font-bold">{request.name}</Text>
                    <Text className="text-gray-700">{request.condition}</Text>
                    <Text className="text-gray-600 text-sm">{request.distance}</Text>
                    {/* Added labels for clarity */}
                    <View className="flex-row justify-between pr-4 mt-2">
                      <Text className="text-gray-600 text-sm font-semibold">Fee: {request.fee}</Text>
                      <Text className="text-gray-600 text-sm font-semibold">Commission: {request.commission}</Text>
                    </View>
                  </View>
                  <View className="bg-blue-100 px-3 py-1 rounded-full">
                    <Text className="text-blue-600 text-xs font-semibold">
                      Consultation
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); handleDecline(request.id, request.name); }}
                    className="flex-1 bg-red-200 py-3 rounded-lg"
                  >
                    <Text className="text-black font-semibold text-center">
                      Decline
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); handleAccept(request.id, request.name); }}
                    className="flex-1 bg-blue-600 py-3 rounded-lg"
                  >
                    <Text className="text-white font-semibold text-center">
                      Accept
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Map Section */}
        <View className="px-4 mb-8">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-semibold">Map View</Text>

            <TouchableOpacity
              onPress={focusMap}
              className="px-3 py-1 rounded-full bg-blue-600"
            >
              <Text className="text-xs font-semibold text-white">Focus</Text>
            </TouchableOpacity>
          </View>

          <View className="rounded-lg overflow-hidden h-80 bg-gray-200">
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={INITIAL_REGION}
              provider={PROVIDER_GOOGLE}
              showsUserLocation
              showsMyLocationButton
              onRegionChangeComplete={onRegionChange}
            />
          </View>
        </View>
      </ScrollView>

      {/* --- MODAL WITH TRANSPARENT BACKGROUND --- */}
      {selectedRequest && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={!!selectedRequest}
          onRequestClose={() => setSelectedRequest(null)}
        >
          {/* This wrapper handles the tap on the background */}
          <TouchableWithoutFeedback onPress={() => setSelectedRequest(null)}>
            <View style={styles.modalOverlay}>
              {/* This wrapper prevents the modal content from closing when tapped */}
              <TouchableWithoutFeedback>
                <View className="bg-white rounded-lg p-6 w-11/12">
                  <Text className="text-xl font-bold mb-2">{selectedRequest.name}</Text>
                  <Text className="text-gray-700 mb-2">{selectedRequest.condition}</Text>
                  <Text className="text-gray-600 mb-4">{selectedRequest.distance}</Text>

                  {/* Added labels for clarity in the modal */}
                  <View className="bg-gray-100 p-3 rounded-lg mb-4">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-gray-800 font-semibold">Consultation Fee:</Text>
                      <Text className="text-gray-800">{selectedRequest.fee}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-gray-800 font-semibold">Our Commission:</Text>
                      <Text className="text-gray-800">{selectedRequest.commission}</Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-lg font-semibold">Map View</Text>
                    <TouchableOpacity
                      onPress={focusMap}
                      className="px-3 py-1 rounded-full bg-blue-600"
                    >
                      <Text className="text-xs font-semibold text-white">Focus</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="rounded-lg overflow-hidden h-80 bg-gray-200">
                    <MapView
                      ref={mapRef}
                      style={styles.map}
                      initialRegion={INITIAL_REGION}
                      provider={PROVIDER_GOOGLE}
                      showsUserLocation
                      showsMyLocationButton
                    />
                  </View>

                  <View className="flex-row gap-2 mt-4">
                    <TouchableOpacity
                      onPress={() => handleDecline(selectedRequest.id, selectedRequest.name)}
                      className="flex-1 bg-red-200 py-3 rounded-lg"
                    >
                      <Text className="text-black font-semibold text-center">Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleAccept(selectedRequest.id, selectedRequest.name)}
                      className="flex-1 bg-blue-600 py-3 rounded-lg"
                    >
                      <Text className="text-white font-semibold text-center">Accept</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedRequest(null)}
                    className="mt-4 py-2"
                  >
                    <Text className="text-center text-blue-600 font-semibold">Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});