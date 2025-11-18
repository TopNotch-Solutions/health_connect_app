// app/(provider)/home.tsx

import { Feather } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

  if (hour < 12) {
    return "Good morning"
  } else if (hour < 18) {
    return "Good Afternoon"
  } else {
    return "Good Evening"
  }
}

export default function ProviderHome() {
  const [requests, setRequests] = useState([
    { id: 1, name: "Linda Robertson", condition: "Fever", distance: "1.9 km" },
    { id: 2, name: "Dennis Wheeler", condition: "Cold", distance: "3.7 km" },
    { id: 3, name: "Jennifer Chavez", condition: "Headache", distance: "1.4 km" },
    { id: 4, name: "Carl Bradley", condition: "Back pain", distance: "3.7 km" },
  ]);

  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    // Or with camera:
    // mapRef.current?.animateCamera({ center: greenBayStadium, zoom: 10 }, { duration: 2000 });
  }, []);

  const onRegionChange = (region: Region) => {
    console.log("Region changed:", region);
  };

  const handleAccept = (id: number, name: string) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));
    alert(`Accepted consultation request from ${name}`);
  };

  const handleDecline = (id: number, name: string) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));
    alert(`Declined consultation request from ${name}`);
  };

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

  const greeting = getGreeting();

  return (
    <SafeAreaView className="flex-1">
      <ScrollView className="flex-1">
        {/* Header with provider name + logout */}
        <View className="pt-4 px-4 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold">
              {greeting}, {""}
              {user?.fullname || "Provider"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleLogout}
            disabled={isLoggingOut}
            className="flex-row items-center justify-center bg-red-500 px-4 py-2 rounded-lg"
          >
            <Feather name="log-out" size={20} color="#ffffffff" />
            <Text className="ml-2 text-sm font-semibold text-white">
              {isLoggingOut ? "Logging out..." : "Logout"}
            </Text>
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
          <View className="flex-1 bg-white rounded-lg border-2 border-gray-200 p-4">
            <Text className="text-sm text-gray-600 mb-2">Availability</Text>
            <Text className="text-xl font-bold text-blue-600">Online</Text>
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
              <View
                key={request.id}
                className="bg-white rounded-lg border-2 border-gray-200 p-5 mb-3"
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-lg font-bold mb-1">
                      {request.name}
                    </Text>
                    <Text className="text-gray-700 mb-1">
                      {request.condition}
                    </Text>
                    <Text className="text-gray-600 text-sm">
                      {request.distance}
                    </Text>
                  </View>
                  <View className="bg-blue-100 px-3 py-1 rounded-full">
                    <Text className="text-blue-600 text-xs font-semibold">
                      Consultation
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() =>
                      handleDecline(request.id, request.name)
                    }
                    className="flex-1 bg-red-200 py-3 rounded-lg"
                  >
                    <Text className="text-black font-semibold text-center">
                      Decline
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      handleAccept(request.id, request.name)
                    }
                    className="flex-1 bg-blue-600 py-3 rounded-lg"
                  >
                    <Text className="text-white font-semibold text-center">
                      Accept
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
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
              style={StyleSheet.absoluteFillObject}
              initialRegion={INITIAL_REGION}
              provider={PROVIDER_GOOGLE}
              showsUserLocation
              showsMyLocationButton
              onRegionChangeComplete={onRegionChange}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
