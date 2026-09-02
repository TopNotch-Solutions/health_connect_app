import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getAilmentProviderLabel } from "../../lib/ailmentCache";
import { buildBackendAssetUrl } from "../../lib/backend";
import { AUTH_COLORS } from "../../lib/authScreenTheme";

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
  const providerLabel = getAilmentProviderLabel(item);
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
      style={styles.card}
      activeOpacity={0.88}
    >
      {imageUri && !imageError ? (
        <>
          {imageLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={AUTH_COLORS.textMuted} />
            </View>
          )}
          <Image
            source={imageUri}
            style={styles.image}
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
        <View style={styles.placeholder}>
          <Feather name="heart" size={28} color={AUTH_COLORS.textMuted} />
        </View>
      )}

      <View style={styles.overlay}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.provider} numberOfLines={1}>
          {providerLabel}
        </Text>
      </View>

      <View style={styles.arrowBadge}>
        <Feather name="arrow-right" size={14} color={AUTH_COLORS.white} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "48%",
    marginBottom: 14,
    borderRadius: 16,
    overflow: "hidden",
    height: 156,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(17, 24, 39, 0.78)",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.white,
  },
  provider: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    marginTop: 3,
    fontWeight: "500",
  },
  arrowBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.textDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default AilmentCard;
