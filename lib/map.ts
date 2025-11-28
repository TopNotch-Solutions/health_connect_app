import { MarkerData, Provider } from '../types';

const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;

export const generateMarkersFromProviders = ({
  data,
  userLatitude,
  userLongitude,
}: {
  data: Provider[];
  userLatitude: number;
  userLongitude: number;
}) => {
  return data.map((provider) => {
    const latOffset = (Math.random() - 0.5) * 0.01;
    const lngOffset = (Math.random() - 0.5) * 0.01;

    return {
      latitude: (provider.location?.latitude as number) || userLatitude + latOffset,
      longitude: (provider.location?.longitude as number) || userLongitude + lngOffset,
      title: `${provider.firstname || provider.name || 'Provider'}`,
      ...provider,
    } as MarkerData;
  });
};

export const calculateRegion = ({
  userLatitude,
  userLongitude,
  destinationLatitude,
  destinationLongitude,
}: {
  userLatitude: number | null;
  userLongitude: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
}) => {
  // Namibia default center (Windhoek area)
  const NAMIBIA_DEFAULT = { latitude: -22.55784, longitude: 17.072891 };

  if (!userLatitude || !userLongitude) {
    return {
      latitude: NAMIBIA_DEFAULT.latitude,
      longitude: NAMIBIA_DEFAULT.longitude,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  }

  if (!destinationLatitude || !destinationLongitude) {
    return {
      latitude: userLatitude,
      longitude: userLongitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }

  const minLat = Math.min(userLatitude, destinationLatitude);
  const maxLat = Math.max(userLatitude, destinationLatitude);
  const minLng = Math.min(userLongitude, destinationLongitude);
  const maxLng = Math.max(userLongitude, destinationLongitude);

  const latitudeDelta = (maxLat - minLat) * 1.3 || 0.05;
  const longitudeDelta = (maxLng - minLng) * 1.3 || 0.05;

  const latitude = (userLatitude + destinationLatitude) / 2;
  const longitude = (userLongitude + destinationLongitude) / 2;

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
};

export const calculateProviderTimes = async ({
  markers,
  userLatitude,
  userLongitude,
  destinationLatitude,
  destinationLongitude,
}: {
  markers: MarkerData[];
  userLatitude: number | null;
  userLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
}) => {
  if (
    !userLatitude ||
    !userLongitude ||
    !destinationLatitude ||
    !destinationLongitude
  )
    return;

  try {
    const timesPromises = markers.map(async (marker) => {
      const responseToUser = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${marker.latitude},${marker.longitude}&destination=${userLatitude},${userLongitude}&key=${directionsAPI}`,
      );
      const dataToUser = await responseToUser.json();
      const timeToUser = dataToUser?.routes?.[0]?.legs?.[0]?.duration?.value || 0;

      const responseToDestination = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${userLatitude},${userLongitude}&destination=${destinationLatitude},${destinationLongitude}&key=${directionsAPI}`,
      );
      const dataToDestination = await responseToDestination.json();
      const timeToDestination = dataToDestination?.routes?.[0]?.legs?.[0]?.duration?.value || 0;

      const totalTime = (timeToUser + timeToDestination) / 60; // minutes

      return { ...marker, time: totalTime } as MarkerData;
    });

    return await Promise.all(timesPromises);
  } catch (error) {
    console.error('Error calculating provider times:', error);
  }
};
