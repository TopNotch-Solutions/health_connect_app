import React from "react";
import { TouchableOpacity, View, ActivityIndicator, Image, Text } from "react-native";

interface AilmentCardProps {
    item: {
        _id?: string;
        id?: string;
        title: string;
        image?: string;
        provider?: string;
    };
    onPress: () => void;
}

const AilmentCard = ({ item, onPress }: AilmentCardProps) => {
    const AILMENT_IMAGE_BASE_URL = 'http://13.51.207.99:4000/ailments/';
    const imageUri = item.image ? `${AILMENT_IMAGE_BASE_URL}${item.image}` : null;
    const [imageLoading, setImageLoading] = React.useState(false);
    const [imageError, setImageError] = React.useState(false);
    const loadingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image is already prefetched when categories load, so start with loading false
  // Only show loading if image actually takes time to load
  React.useEffect(() => {
    if (!imageUri) {
      setImageError(true);
      setImageLoading(false);
    }
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [imageUri]);

  return (
    <TouchableOpacity 
      onPress={onPress}
      className="w-[48%] mb-4 rounded-2xl overflow-hidden"
      style={{
        borderWidth: 1,
        borderColor: '#E5E7EB',
        height: 150,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      }}
      activeOpacity={0.7}
    >
      {imageUri && !imageError ? (
        <>
          {imageLoading && (
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
          <Image 
            source={{ uri: imageUri }} 
            style={{
              width: '100%',
              height: '100%',
            }}
            resizeMode="cover"
            onLoadStart={() => {
              // Only show loading indicator if image takes more than 150ms to load
              // This way prefetched images won't show loading
              if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
              }
              loadingTimeoutRef.current = setTimeout(() => {
                setImageLoading(true);
              }, 150);
            }}
            onLoadEnd={() => {
              if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
              }
              setImageLoading(false);
            }}
            onError={() => {
              if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
              }
              setImageError(true);
              setImageLoading(false);
            }}
          />
        </>
      ) : (
        <View style={{ width: '100%', height: '100%', backgroundColor: '#F3F4F6' }} />
      )}
      
      {/* Blurred overlay at the bottom with title */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          paddingVertical: 12,
          paddingHorizontal: 12,
        }}
      >
        <Text 
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: '#FFFFFF',
            textShadowColor: 'rgba(0, 0, 0, 0.75)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.provider && (
          <Text 
            style={{
              fontSize: 12,
              color: '#E5E7EB',
              marginTop: 4,
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {item.provider}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default AilmentCard;