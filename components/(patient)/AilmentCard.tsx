import { Image } from "expo-image";
import React from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { buildBackendAssetUrl } from "../../lib/backend";

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
  const cardKey = item._id ?? item.id ?? item.title;
  const imageUri = buildBackendAssetUrl("ailments", item.image);
  const [imageLoading, setImageLoading] = React.useState(!!imageUri);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    if (!imageUri) {
      setImageError(true);
      setImageLoading(false);
      return;
    }
    setImageError(false);
    setImageLoading(true);
  }, [imageUri]);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="w-[48%] mb-4 rounded-2xl overflow-hidden"
      style={{
        borderWidth: 1,
        borderColor: "#E5E7EB",
        height: 150,
        shadowColor: "#000",
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
            <View
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                backgroundColor: "#F3F4F6",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1,
              }}
            >
              <ActivityIndicator size="small" color="#10B981" />
            </View>
          )}
          <Image
            source={imageUri}
            style={{
              width: "100%",
              height: "100%",
            }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={cardKey}
            transition={150}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
        </>
      ) : (
        <View
          style={{ width: "100%", height: "100%", backgroundColor: "#F3F4F6" }}
        />
      )}

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          paddingVertical: 12,
          paddingHorizontal: 12,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: "#FFFFFF",
            textShadowColor: "rgba(0, 0, 0, 0.75)",
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
              color: "#E5E7EB",
              marginTop: 4,
              textShadowColor: "rgba(0, 0, 0, 0.75)",
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
