// app/(provider)/map.tsx

import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';

const INITIAL_REGION: Region = {
  latitude: -22,
  longitude: 16,
  latitudeDelta: 2,
  longitudeDelta: 2,
};

export default function ProviderMapScreen() {
  const navigation = useNavigation();
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

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={focusMap}>
          <View style={{ padding: 10 }}>
            <Text>Focus</Text>
          </View>
        </TouchableOpacity>
      ),
      title: 'Map',
    });
  }, [navigation, focusMap]);

  const onRegionChange = (region: Region) => {
    console.log('Region changed:', region);
  };

  return (
    <View style={{ flex: 1 }}>
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
  );
}
