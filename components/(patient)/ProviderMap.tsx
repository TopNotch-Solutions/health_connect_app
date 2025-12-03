import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
let MapViewDirections: any = null;

import { generateMarkersFromProviders, calculateRegion, calculateProviderTimes } from '../../lib/map';
import { MarkerData, Provider } from '../../types';

const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;

type Props = {
  userLatitude?: number | null;
  userLongitude?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  providers?: Provider[];
  onTimesCalculated?: (providers: MarkerData[]) => void;
};

const ProviderMap = ({ userLatitude, userLongitude, destinationLatitude, destinationLongitude, providers = [], onTimesCalculated }: Props) => {
  const [markers, setMarkers] = useState<MarkerData[]>([]);

  useEffect(() => {
    if (providers.length === 0 || !userLatitude || !userLongitude) return;

    const newMarkers = generateMarkersFromProviders({ data: providers, userLatitude, userLongitude });
    setMarkers(newMarkers);
  }, [providers, userLatitude, userLongitude]);

  useEffect(() => {
    if (markers.length > 0 && destinationLatitude !== undefined && destinationLongitude !== undefined) {
      calculateProviderTimes({ markers, userLatitude: userLatitude || null, userLongitude: userLongitude || null, destinationLatitude: destinationLatitude || null, destinationLongitude: destinationLongitude || null })
        .then((res) => {
          if (res && onTimesCalculated) onTimesCalculated(res as MarkerData[]);
        })
        .catch((e) => console.error(e));
    }
  }, [markers, destinationLatitude, destinationLongitude]);

  const region = calculateRegion({ userLatitude: userLatitude || null, userLongitude: userLongitude || null, destinationLatitude: destinationLatitude || null, destinationLongitude: destinationLongitude || null });

  if (!userLatitude || !userLongitude) return (
    <View className="flex justify-center items-center w-full">
      <ActivityIndicator size="small" color="#000" />
    </View>
  );

  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={{ width: '100%', height: '100%' }}
      initialRegion={region}
      showsUserLocation={true}
    >
      {markers.map((marker) => (
        <Marker
          key={(marker as any).id || `${marker.latitude}-${marker.longitude}`}
          coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
          title={marker.title}
          // image can be set to custom marker assets if available
        />
      ))}

      {destinationLatitude && destinationLongitude && (
        <>
          <Marker
            key="destination"
            coordinate={{ latitude: destinationLatitude, longitude: destinationLongitude }}
            title="Destination"
          />
          {directionsAPI ? (
            (() => {
              try {
                if (!MapViewDirections) MapViewDirections = require('react-native-maps-directions').default;
                return (
                  <MapViewDirections
                    origin={{ latitude: userLatitude!, longitude: userLongitude! }}
                    destination={{ latitude: destinationLatitude, longitude: destinationLongitude }}
                    apikey={directionsAPI}
                    strokeColor="#0286FF"
                    strokeWidth={2}
                  />
                );
              } catch (err) {
                console.warn('MapViewDirections not installed, skipping route rendering');
                return null;
              }
            })()
          ) : null}
        </>
      )}
    </MapView>
  );
};

export default ProviderMap;
