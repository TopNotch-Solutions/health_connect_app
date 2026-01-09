import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CreateRequestModal from '../../../components/(patient)/CreateRequestModal';
import AilmentCard from '../../../components/(patient)/AilmentCard';
import HistoryCard from '../../../components/(patient)/HistoryCard';
import { HistoryItem } from '../../../components/(patient)/HistoryCard';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/api';
import { getLocationCoordinates } from '../../../lib/geocoding';
import socketService from '../../../lib/socket';

interface Advert {
  _id: string;
  description: string;
  image: string;
  createdAt: string;
  updatedAt: string;
}

export default function PatientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAilment, setSelectedAilment] = useState<any>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [recentRequests, setRecentRequests] = useState<HistoryItem[]>([]);
  const [ailmentCategories, setAilmentCategories] = useState<any[]>([]);
  const [isLoadingAilments, setIsLoadingAilments] = useState(false);
  const [adverts, setAdverts] = useState<Advert[]>([]);
  const [isLoadingAdverts, setIsLoadingAdverts] = useState(false);
  const [selectedAdvert, setSelectedAdvert] = useState<Advert | null>(null);
  const [advertModalVisible, setAdvertModalVisible] = useState(false);
  const [currentAdvertIndex, setCurrentAdvertIndex] = useState(0);
  const [advertImageLoading, setAdvertImageLoading] = useState(true);
  const [advertImageError, setAdvertImageError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const advertSlideAnim = React.useRef(new Animated.Value(0)).current;
  
  const IMAGE_BASE_URL = 'http://13.51.207.99:4000/adverts/';

  // Function to fetch adverts from API
  const loadAdverts = useCallback(async () => {
    setIsLoadingAdverts(true);
    try {
      const response = await apiClient.get('/app/adverts/all-adverts');
      if (response.data?.adverts && Array.isArray(response.data.adverts) && response.data.adverts.length > 0) {
        setAdverts(response.data.adverts);
        
        // Prefetch all advert images for faster loading
        const IMAGE_BASE_URL = 'http://13.51.207.99:4000/adverts/';
        response.data.adverts.forEach((advert: Advert) => {
          if (advert.image) {
            const imageUri = `${IMAGE_BASE_URL}${advert.image}`;
            Image.prefetch(imageUri).catch((err) => {
              console.log('Failed to prefetch advert image:', imageUri, err);
            });
          }
        });
      } else {
        setAdverts([]);
      }
    } catch (error) {
      console.error('Error loading adverts:', error);
      setAdverts([]);
    } finally {
      setIsLoadingAdverts(false);
    }
  }, []);

  // Function to fetch ailment categories from backend via socket
  const loadAilmentCategories = useCallback(async () => {
    setIsLoadingAilments(true);
    try {
      const socket = socketService.getSocket();
      
      if (!socket?.connected) {
        console.warn('⚠️ Socket not connected');
        setIsLoadingAilments(false);
        return;
      }

      return new Promise<void>((resolve) => {
        let resolved = false;

        const handleAilmentCategories = (categories: any) => {
          if (resolved) return;
          resolved = true;
          
          console.log('📋 Received ailment categories from backend:', categories);
          if (Array.isArray(categories) && categories.length > 0) {
            setAilmentCategories(categories);
            
            // Prefetch ailment images for faster loading - prioritize first 6 for home page
            const AILMENT_IMAGE_BASE_URL = 'http://13.51.207.99:4000/ailments/';
            const categoriesToPrefetch = categories.slice(0, 6); // Only prefetch first 6 for home page
            
            // Prefetch in parallel for faster loading
            const prefetchPromises = categoriesToPrefetch.map((category: any) => {
              if (category.image) {
                const imageUri = `${AILMENT_IMAGE_BASE_URL}${category.image}`;
                return Image.prefetch(imageUri).catch((err) => {
                  console.log('Failed to prefetch image:', imageUri, err);
                });
              }
              return Promise.resolve();
            });
            
            // Wait for all prefetches to complete
            Promise.all(prefetchPromises).then(() => {
              console.log('✅ Prefetched first 6 ailment images');
            });
          }
          socket?.off('ailmentCategories', handleAilmentCategories);
          setIsLoadingAilments(false);
          resolve();
        };

        const timeout = setTimeout(() => {
          if (resolved) return;
          resolved = true;
          
          console.warn('⚠️ Ailment categories request timeout');
          socket?.off('ailmentCategories', handleAilmentCategories);
          setIsLoadingAilments(false);
          resolve();
        }, 5000);

        socket?.on('ailmentCategories', handleAilmentCategories);
        console.log('📤 Emitting getAilmentCategories request');
        socket?.emit('getAilmentCategories');

        return () => clearTimeout(timeout);
      });
    } catch (error) {
      console.error('Error loading ailment categories:', error);
      setIsLoadingAilments(false);
    }
  }, []);

  // Function to load recent requests
  const loadRecentRequests = useCallback(async () => {
    try {
      // Fetch requests from backend via socket
      const socket = socketService.getSocket();
      if (!user?.userId || !socket || !socket.connected) {
        console.warn('Socket not ready or user ID missing. Skipping recent requests load.');
        setRecentRequests([]);
        return;
      }

      const liveRequests = await socketService.getPatientRequests(user.userId);
      console.log('🔍 Raw requests received:', liveRequests);
      
      if (Array.isArray(liveRequests) && liveRequests.length > 0) {
        console.log('First request full structure:', JSON.stringify(liveRequests[0], null, 2));
      }
      
      if (Array.isArray(liveRequests)) {
        // Load ailment mappings from local storage
        const ailmentMappingsStr = await AsyncStorage.getItem(`ailment-mappings-${user.userId}`);
        const ailmentMappings = ailmentMappingsStr ? JSON.parse(ailmentMappingsStr) : {};
        console.log('📍 Ailment mappings:', ailmentMappings);
        
        // Get the 2 most recent requests
        const recent = liveRequests
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 2)
          .map((item: any) => {
            // Log each item's ailment structure
            console.log('Item ailmentCategoryId:', item.ailmentCategoryId);
            console.log('Item ailmentCategoryId type:', typeof item.ailmentCategoryId);
            
            // Try to get ailment name from backend data first
            let ailmentName = 'Unknown';
            
            // First, try ailmentCategoryId.title (populated object)
            if (item.ailmentCategoryId?.title) {
              ailmentName = item.ailmentCategoryId.title;
            }
            // Try ailmentCategory field
            else if (item.ailmentCategory) {
              ailmentName = item.ailmentCategory;
            }
            // Try ailmentCategoryId.name (alternative field name)
            else if (item.ailmentCategoryId?.name) {
              ailmentName = item.ailmentCategoryId.name;
            }
            // Fall back to local mapping if available
            else if (ailmentMappings[item._id]) {
              ailmentName = ailmentMappings[item._id];
              console.log('✅ Got ailment from local mapping:', ailmentName);
            }
            
            console.log('Resolved ailment name:', ailmentName);
            
            return {
              _id: item._id,
              ailment: ailmentName,
              status: item.status,
              date: new Date(item.createdAt).toLocaleDateString('en-ZA', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }),
            };
          });
        console.log('📋 Final recent requests:', recent);
        setRecentRequests(recent);
      }
    } catch (error) {
      console.error('Error loading recent requests:', error);
    }
  }, [user?.userId]);

  // Auto-scroll adverts with animation
  useEffect(() => {
    if (adverts.length > 0) {
      setAdvertImageLoading(true);
      setAdvertImageError(false);

      const currentAdvert = adverts[currentAdvertIndex];
      if (currentAdvert?.image) {
        const imageUri = `${IMAGE_BASE_URL}${currentAdvert.image}`;
        Image.prefetch(imageUri)
          .then(() => {
            setAdvertImageLoading(false);
          })
          .catch(() => {
            setAdvertImageError(true);
            setAdvertImageLoading(false);
          });
      }
      
      advertSlideAnim.setValue(0);
      Animated.timing(advertSlideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [currentAdvertIndex, advertSlideAnim, adverts.length]);

  useEffect(() => {
    if (adverts.length > 0) {
      const interval = setInterval(() => {
        setCurrentAdvertIndex((prev) => (prev + 1) % adverts.length);
      }, 5000); // Change every 5 seconds

      return () => clearInterval(interval);
    }
  }, [adverts.length]);

  // Connect socket on mount and load ailment categories
  useEffect(() => {
    if (user?.userId) {
      try {
        // Connect with patient role
        socketService.connect(user.userId, 'patient');
        
        // Load ailment categories after a brief delay to ensure socket is connected
        const timer = setTimeout(() => {
          try {
            loadAilmentCategories();
          } catch (error) {
            console.error('Error loading ailment categories:', error);
          }
        }, 1000);

        return () => clearTimeout(timer);
      } catch (error) {
        console.error('Error connecting to socket:', error);
      }
    }
  }, [user?.userId, loadAilmentCategories]);

  // Load recent requests on mount and when screen comes into focus
  useEffect(() => {
    loadRecentRequests();
  }, [loadRecentRequests]);

  // Load adverts on mount
  useEffect(() => {
    loadAdverts();
  }, [loadAdverts]);

  useFocusEffect(
    useCallback(() => {
      loadRecentRequests();
      loadAdverts();
    }, [loadRecentRequests, loadAdverts])
  );

  // Universal refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh all data in parallel
      await Promise.all([
        loadAilmentCategories(),
        loadAdverts(),
        loadRecentRequests(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadAilmentCategories, loadAdverts, loadRecentRequests]);

  // Request location permissions on mount
  useEffect(() => {
    (async () => {
      try {
        const coords = await getLocationCoordinates();
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        console.log('✅ Location obtained successfully:', coords);
      } catch (error: any) {
        console.error('Location error:', error);
        // Set default location for emulator/testing
        const defaultLocation = { latitude: -22.557840, longitude: 17.072891 };
        setLocation(defaultLocation);
        
        Alert.alert(
          'Location Error',
          error.message || 'Could not get your current location. Using default location for testing. On a real device, please enable location services.',
          [
            {
              text: 'Try Again',
              onPress: async () => {
                try {
                  const coords = await getLocationCoordinates();
                  setLocation({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                  });
                  console.log('✅ Location retry successful:', coords);
                } catch (retryError: any) {
                  console.error('Retry failed:', retryError);
                  // Keep using default location
                }
              }
            },
            { text: 'Use Default', style: 'cancel' }
          ]
        );
      }
    })();
  }, []);

  const handleAilmentSelect = (ailment: any) => {
    setSelectedAilment(ailment);
    setModalVisible(true);
  };

  const handleCreateRequest = async (requestData: {
    ailmentCategory: string;
    ailmentCategoryId?: string;
    symptoms: string;
    paymentMethod: 'wallet' | 'cash';
    dueCost: number;
    street: string;
    locality: string;
    region: string;
    preferredTime?: string;
    coordinates?: { latitude: number; longitude: number };
  }) => {
    // Use coordinates from the modal if provided, otherwise try to get current location
    let currentLocation = requestData.coordinates || location;
    
    if (!currentLocation) {
      try {
        Alert.alert('Getting Location', 'Fetching your current location...');
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        currentLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(currentLocation);
      } catch {
        throw new Error('Location is required to create a request. Please enable location services and try again.');
      }
    }

    if (!user?.userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Sanitize ailmentCategoryId: backend expects a MongoDB ObjectId (24 hex chars).
      // If the selected/default category uses a placeholder id (like '1'), omit it so the
      // socket service will use its safe fallback. This avoids Mongoose "Cast to ObjectId failed" errors.
      const safeAilmentCategoryId = requestData.ailmentCategoryId && /^[0-9a-fA-F]{24}$/.test(requestData.ailmentCategoryId)
        ? requestData.ailmentCategoryId
        : undefined;

      const request = await socketService.createRequest({
        patientId: user.userId,
        location: currentLocation,
        ailmentCategory: requestData.ailmentCategory,
        ailmentCategoryId: safeAilmentCategoryId,
        paymentMethod: requestData.paymentMethod,
        symptoms: requestData.symptoms,
        estimatedCost: requestData.dueCost,
        address: {
          route: requestData.street,
          locality: requestData.locality,
          administrative_area_level_1: requestData.region,
          coordinates: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
        },
        preferredTime: requestData.preferredTime,
      });

      // Save ailment mapping locally for future reference (since backend stores null)
      if (request && (request as any)._id) {
        try {
          const ailmentMappingsStr = await AsyncStorage.getItem(`ailment-mappings-${user.userId}`);
          const ailmentMappings = ailmentMappingsStr ? JSON.parse(ailmentMappingsStr) : {};
          ailmentMappings[(request as any)._id] = requestData.ailmentCategory;
          await AsyncStorage.setItem(`ailment-mappings-${user.userId}`, JSON.stringify(ailmentMappings));
          console.log('💾 Saved ailment mapping:', ailmentMappings);
        } catch (storageError) {
          console.error('Error saving ailment mapping:', storageError);
        }
      }

      Alert.alert(
        'Request Created',
        'Your request has been sent to nearby healthcare providers. You will be notified when a provider accepts.',
        [{ text: 'OK' }]
      );

      console.log('Request created:', request);
      
      // Refresh recent requests to show the newly created request
      loadRecentRequests();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create request');
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
    <SafeAreaView className="flex-1 bg-gray-100" edges={['bottom', 'left', 'right']}>
      <View className="flex-1">
        <ScrollView 
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#10B981']}
              tintColor="#10B981"
            />
          }
        >
          <View className="px-2 px-4">
            <View>
              <Text className="text-2xl font-bold">
                {greeting},
              </Text>
              
            </View>
            <View>
              <Text className="font-bold text-gray-500">
                {user?.fullname || 'Patient'}
              </Text>
              
            </View>
          </View>

          {/* Adverts or Health Tips Section */}
          {adverts.length > 0 ? (
            <View className="mb-8 py-2 px-4">
              <Animated.View
                style={[
                  {
                    opacity: advertSlideAnim,
                    transform: [
                      {
                        translateX: advertSlideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [50, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => {
                    setSelectedAdvert(adverts[currentAdvertIndex]);
                    setAdvertModalVisible(true);
                  }}
                  activeOpacity={0.9}
                  style={styles.advertContainer}
                >
                  {advertImageLoading && (
                    <View style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#F3F4F6',
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 1,
                    }}>
                      <ActivityIndicator size="small" color="#10B981" />
                    </View>
                  )}
                  {!advertImageError && adverts[currentAdvertIndex]?.image && (
                    <Image
                      source={{ uri: `${IMAGE_BASE_URL}${adverts[currentAdvertIndex].image}` }}
                      style={styles.advertImage}
                      resizeMode="contain"
                      onLoadStart={() => setAdvertImageLoading(true)}
                      onLoadEnd={() => setAdvertImageLoading(false)}
                      onError={() => {
                        setAdvertImageError(true);
                        setAdvertImageLoading(false);
                      }}
                    />
                  )}
                  {advertImageError && (
                    <View style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#F3F4F6',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Feather name="image" size={32} color="#9CA3AF" />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
              
              {/* Advert Indicators */}
              <View className="flex-row justify-center mt-4 gap-2">
                {adverts.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setCurrentAdvertIndex(index)}
                    className={`rounded-full transition-all ${
                      index === currentAdvertIndex
                        ? 'bg-blue-600 w-3 h-3'
                        : 'bg-gray-300 w-2 h-2'
                    }`}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Main Content Area */}
          <View className="px-4 mb-6">
            <View className="flex-row justify-between items-center mb-4 flex-wrap gap-2">
              <Text className="text-xl font-bold text-gray-800 flex-shrink">
                What do you need help with today?
              </Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(patient)/all_ailments')} className="flex-shrink-0">
                <Text className="font-bold text-blue-600 text-xl">See all</Text>
              </TouchableOpacity>
            </View>

            {/* Ailment Grid (cards styled like Provider request cards) */}
            {isLoadingAilments ? (
              <View className="items-center justify-center py-8">
                <Text className="text-gray-600">Loading ailments...</Text>
              </View>
            ) : ailmentCategories.length > 0 ? (
              <FlatList
                data={ailmentCategories.slice(0, 6)}
                keyExtractor={(item) => item._id}
                numColumns={2}
                scrollEnabled={false} // Disable scrolling for this nested list
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                renderItem={({ item }) => (
                  <AilmentCard item={item} onPress={() => handleAilmentSelect(item)} />
                )}
              />
            ) : (
              <View className="items-center justify-center py-8">
                <Text className="text-gray-500">No ailments available</Text>
              </View>
            )}
          </View>

          {/* Recent Activity / History Section (similar spacing to Ailments) */}
          <View className="px-4 mb-8">
            <View className="flex-row justify-between items-center mb-4 flex-wrap gap-2">
              <Text className="text-xl font-bold text-gray-800 flex-shrink">
                Recent Activity
              </Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(patient)/recent-activities')} className="flex-shrink-0">
                <Text className="font-bold text-blue-600 text-xl">See all</Text>
              </TouchableOpacity>
            </View>

            {recentRequests.length === 0 ? (
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                padding: 24,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}>
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#F3F4F6',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <Feather name="clock" size={32} color="#9CA3AF" />
                </View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 4,
                }}>
                  No Recent Activity
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#6B7280',
                  textAlign: 'center',
                }}>
                  Your recent healthcare requests will appear here
                </Text>
              </View>
            ) : (
              <FlatList
                data={recentRequests}
                keyExtractor={(item) => item._id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                renderItem={({ item }) => <HistoryCard item={item} />}
              />
            )}
          </View>
        </ScrollView>

        {/* Create Request Modal */}
        <CreateRequestModal
          visible={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setSelectedAilment(null);
          }}
          onSubmit={handleCreateRequest}
          selectedAilment={selectedAilment}
        />

        {/* Advert Detail Modal */}
        <Modal
          visible={advertModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            setAdvertModalVisible(false);
            setSelectedAdvert(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedAdvert && (
                <>
                  <Image
                    source={{ uri: `${IMAGE_BASE_URL}${selectedAdvert.image}` }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                  <ScrollView
                    style={styles.modalDescriptionContainer}
                    contentContainerStyle={styles.modalDescriptionContent}
                    showsVerticalScrollIndicator={true}
                  >
                    <Text style={styles.modalDescription}>{selectedAdvert.description}</Text>
                  </ScrollView>
                  <TouchableOpacity
                    onPress={() => {
                      setAdvertModalVisible(false);
                      setSelectedAdvert(null);
                    }}
                    style={styles.modalCancelButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalCancelButtonText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  advertContainer: {
    width: '100%',
    height: 200,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  advertImage: {
    width: '100%',
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    padding: 20,
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalDescriptionContainer: {
    width: '100%',
    maxHeight: 200,
    marginBottom: 20,
  },
  modalDescriptionContent: {
    paddingHorizontal: 4,
  },
  modalDescription: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    textAlign: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 120,
  },
  modalCancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
