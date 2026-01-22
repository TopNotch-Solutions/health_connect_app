import { Feather } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import React, { useMemo, useRef } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ChangePasswordModal from "../../../components/ChangePasswordModal";
import EditProviderProfileModal from "../../../components/EditProviderProfileModal";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../lib/api";

const ProfileMenuItem = ({
  icon,
  label,
  onPress,
  isDestructive = false,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-row items-center justify-between p-4"
  >
    <View className="flex-row items-center">
      <View
        className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
          isDestructive ? "bg-red-50" : "bg-gray-50"
        }`}
      >
        <Feather
          name={icon}
          size={18}
          color={isDestructive ? "#EF4444" : "#6B7280"}
        />
      </View>
      <Text
        className={`text-base font-semibold ${
          isDestructive ? "text-red-500" : "text-gray-900"
        }`}
      >
        {label}
      </Text>
    </View>
    {!isDestructive && (
      <Feather name="chevron-right" size={20} color="#D1D5DB" />
    )}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [editProfileVisible, setEditProfileVisible] = React.useState(false);
  const [changePasswordVisible, setChangePasswordVisible] =
    React.useState(false);
  const [selectedImage, setSelectedImage] =
    React.useState<ImagePicker.ImagePickerAsset | null>(null);

  const helpSupportSheetRef = useRef<BottomSheet>(null);
  const helpSupportSnapPoints = useMemo(() => ["85%"], []);
  const aboutHealthConnectSheetRef = useRef<BottomSheet>(null);
  const aboutHealthConnectSnapPoints = useMemo(() => ["90%"], []);

  const IMAGE_BASE_URL = "http://13.51.207.99:4000/images/";

  const handlePickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "We need gallery permissions to select an image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
        await handleUploadImage(result.assets[0]);
      }
    } catch (error: any) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
      console.error("Image picker error:", error);
    }
  };

  const handleUploadImage = async (image: ImagePicker.ImagePickerAsset) => {
    if (!user?.userId) {
      Alert.alert("Error", "User not found. Please try again.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("profileImage", {
        uri: image.uri,
        name: image.fileName || `profile-${Date.now()}.jpg`,
        type: image.mimeType || "image/jpeg",
      } as any);

      const response = await apiClient.put(
        "/app/auth/upload-profile-image/",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data?.profileImage) {
        await updateUser({ profileImage: response.data.profileImage });
        Alert.alert("Success", "Profile photo updated successfully!");
      } else {
        Alert.alert("Success", "Profile photo updated successfully!");
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          "Failed to upload profile photo. Please try again.",
      );
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      setSelectedImage(null);
    }
  };

  const handleDeactivateAccount = () => {
    Alert.alert(
      "Deactivate Account",
      "Are you sure you want to deactivate your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await apiClient.patch(
                `/app/auth/deactivate-account/${user?.userId}`,
              );
              Alert.alert(
                "Account Deactivated",
                "Your account has been deactivated",
                [
                  {
                    text: "OK",
                    onPress: async () => {
                      await logout();
                    },
                  },
                ],
              );
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to deactivate account",
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setIsLoading(true);
          try {
            await logout();
          } catch {
            Alert.alert("Error", "Could not log out. Please try again.");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const handleEmailPress = () =>
    Linking.openURL("mailto:support@healthconnect.com?subject=Support Request");
  const handlePhonePress = () => Linking.openURL("tel:+264818111703");
  const handleAmbulancePress = () => Linking.openURL("tel:956");
  const handleHelpSupportPress = () => {
    helpSupportSheetRef.current?.expand();
  };
  const handleAboutHealthConnectPress = () => {
    aboutHealthConnectSheetRef.current?.expand();
  };

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
      edges={["bottom", "left", "right"]}
    >
      <ScrollView className="flex-1">
        {/* Profile Header */}
        <View className="bg-white items-center pt-8 pb-6 px-6 border-b border-gray-200">
          {selectedImage ? (
            <Image
              source={{ uri: selectedImage.uri }}
              className="w-32 h-32 rounded-full mb-4 border-4 border-blue-100"
              style={{ width: 128, height: 128, borderRadius: 64 }}
            />
          ) : user?.profileImage ? (
            <Image
              source={{ uri: `${IMAGE_BASE_URL}${user.profileImage}` }}
              className="w-32 h-32 rounded-full mb-4 border-4 border-blue-100"
              style={{ width: 128, height: 128, borderRadius: 64 }}
            />
          ) : (
            <View className="w-32 h-32 rounded-full bg-blue-50 justify-center items-center mb-4 border-4 border-blue-100">
              <Feather name="user" size={50} color="#3B82F6" />
            </View>
          )}
          <Text className="text-2xl font-bold text-gray-900">
            {user?.fullname || "Provider Name"}
          </Text>
          <Text className="text-base text-gray-500 mt-1">
            {user?.email || "provider@email.com"}
          </Text>
          {user?.role && (
            <View className="bg-blue-50 px-4 py-1.5 rounded-full mt-3">
              <Text className="text-blue-600 font-bold text-sm capitalize">
                {user.role}
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={isLoading || isUploading}
            className="mt-4 bg-blue-100 px-4 py-2 rounded-lg"
            style={{ opacity: isLoading || isUploading ? 0.6 : 1 }}
          >
            {isUploading ? (
              <View className="flex-row items-center">
                <ActivityIndicator
                  size="small"
                  color="#3B82F6"
                  style={{ marginRight: 8 }}
                />
                <Text className="text-blue-600 font-semibold text-sm">
                  Uploading...
                </Text>
              </View>
            ) : (
              <Text className="text-blue-600 font-semibold text-sm">
                Upload Photo
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Menu Sections */}
        <View className="px-6 pt-6">
          {/* Account Section */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-2">
              Account
            </Text>
            <View className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <ProfileMenuItem
                icon="edit-3"
                label="Edit Profile"
                onPress={() => setEditProfileVisible(true)}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileMenuItem
                icon="lock"
                label="Change Password"
                onPress={() => setChangePasswordVisible(true)}
              />
            </View>
          </View>

          {/* Support Section */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-2">
              Support
            </Text>
            <View className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <ProfileMenuItem
                icon="help-circle"
                label="Help & Support"
                onPress={handleHelpSupportPress}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileMenuItem
                icon="info"
                label="About HealthConnect"
                onPress={handleAboutHealthConnectPress}
              />
            </View>
          </View>

          {/* Danger Zone */}
          <View className="mb-6">
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-2">
              Danger Zone
            </Text>
            <View className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <ProfileMenuItem
                icon="alert-circle"
                label="Deactivate Account"
                onPress={handleDeactivateAccount}
                isDestructive
              />
            </View>
          </View>

          {/* Logout */}
          <View className="mb-6">
            <View className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <ProfileMenuItem
                icon="log-out"
                label="Log Out"
                onPress={handleLogout}
                isDestructive
              />
            </View>
          </View>
        </View>

        {isLoading && (
          <View className="absolute inset-0 bg-black/20 justify-center items-center">
            <View className="bg-white rounded-2xl p-6">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-900 mt-3 font-semibold">
                Logging out...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditProviderProfileModal
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
      />

      {/* Help & Support Bottom Sheet */}
      <BottomSheet
        ref={helpSupportSheetRef}
        index={-1}
        snapPoints={helpSupportSnapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: "#FFFFFF", borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: "#9CA3AF", width: 40 }}
      >
        <BottomSheetScrollView
          style={{ paddingTop: 24, paddingHorizontal: 24 }}
        >
          <Text style={styles.bottomSheetTitle}>Help & Support</Text>
          <Text style={styles.bottomSheetSubtitle}>Get in touch with us</Text>

          <TouchableOpacity
            onPress={handleEmailPress}
            style={styles.contactCard}
            activeOpacity={0.7}
          >
            <View style={styles.contactIconContainer}>
              <Feather name="mail" size={32} color="#10B981" />
            </View>
            <Text style={styles.contactTitle}>Contact Support</Text>
            <Text style={styles.contactText}>support@healthconnect.com</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePhonePress}
            style={styles.contactCard}
            activeOpacity={0.7}
          >
            <View style={styles.contactIconContainer}>
              <Feather name="phone" size={32} color="#10B981" />
            </View>
            <Text style={styles.contactTitle}>Call Us</Text>
            <Text style={styles.contactText}>+264 81 811 1703</Text>
          </TouchableOpacity>

          {/* Ambulance Emergency Section */}
          <View style={styles.ambulanceCard}>
            <Image
              source={require("../../../assets/images/eme.png")}
              style={styles.ambulanceImage}
              resizeMode="contain"
            />
            <Text style={styles.ambulanceTitle}>
              Do you require an ambulance?
            </Text>
            <Text style={styles.ambulanceDescription}>
              For immediate medical emergencies, please contact our partner MR
              24/7 directly. They are available 24 hours a day to provide rapid
              emergency response.
            </Text>
            <TouchableOpacity
              onPress={handleAmbulancePress}
              style={styles.ambulanceButton}
              activeOpacity={0.7}
            >
              <Feather name="phone" size={20} color="#FFFFFF" />
              <Text style={styles.ambulanceButtonText}>
                Dial 956 immediately
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* About HealthConnect Bottom Sheet */}
      <BottomSheet
        ref={aboutHealthConnectSheetRef}
        index={-1}
        snapPoints={aboutHealthConnectSnapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: "#FFFFFF", borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: "#9CA3AF", width: 40 }}
      >
        <BottomSheetScrollView
          style={{ paddingTop: 24, paddingHorizontal: 24 }}
        >
          <Text style={styles.bottomSheetTitle}>About HealthConnect</Text>
          <Text style={styles.bottomSheetSubtitle}>
            Your trusted healthcare platform
          </Text>

          {/* Functionality Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Feather name="activity" size={24} color="#10B981" />
              <Text style={styles.sectionTitle}>Functionality</Text>
            </View>
            <Text style={styles.sectionText}>
              HealthConnect is a comprehensive healthcare platform designed to
              connect healthcare providers with patients seamlessly. Our
              platform offers:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  Secure payment processing and billing management
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  Professional profile and practice information management
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  Issue reporting and support ticket system
                </Text>
              </View>
            </View>
          </View>

          {/* Privacy Policy Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Feather name="shield" size={24} color="#10B981" />
              <Text style={styles.sectionTitle}>Privacy Policy</Text>
            </View>
            <Text style={styles.sectionText}>
              Your privacy and data security are our top priorities. We are
              committed to protecting patient and provider information:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  Patient information is only accessible to authorized
                  healthcare providers
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  We never sell or share patient data with third parties for
                  marketing purposes
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  Providers have full control over their practice information
                  and can update it at any time
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  Regular security audits and updates ensure data remains
                  protected
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  All communications are encrypted end-to-end for maximum
                  security
                </Text>
              </View>
            </View>
          </View>

          {/* User Rights Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Feather name="user-check" size={24} color="#10B981" />
              <Text style={styles.sectionTitle}>
                Provider Rights & Responsibilities
              </Text>
            </View>
            <Text style={styles.sectionText}>
              As a HealthConnect healthcare provider, you have the following
              rights and responsibilities:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>Right to Access:</Text> Full
                  access to your practice profile
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>Right to Control:</Text> Manage
                  your availability, and practice information
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>Right to Privacy:</Text> Your
                  professional information is protected and confidential
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>Right to Support:</Text> Access
                  to 24/7 technical support and issue reporting
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>Your Responsibility:</Text>{" "}
                  Maintain accurate practice information and comply with medical
                  regulations
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>Patient Confidentiality:</Text>{" "}
                  Protect patient privacy and maintain confidentiality of all
                  medical information
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>Professional Standards:</Text>{" "}
                  Adhere to professional medical standards and ethical
                  guidelines
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>
              For more information, contact our support team or visit our
              website.
            </Text>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bottomSheetTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  bottomSheetSubtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 24,
  },
  contactCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  contactText: {
    fontSize: 16,
    color: "#6B7280",
  },
  ambulanceCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ambulanceImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  ambulanceTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  ambulanceDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  ambulanceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  ambulanceButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionContainer: {
    backgroundColor: "#F9FAFB",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginLeft: 12,
  },
  sectionText: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletList: {
    marginTop: 8,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 10,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 16,
    color: "#10B981",
    marginRight: 12,
    fontWeight: "700",
  },
  bulletText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    flex: 1,
  },
  boldText: {
    fontWeight: "700",
    color: "#111827",
  },
  footerContainer: {
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
  },
  footerText: {
    fontSize: 14,
    color: "#1E40AF",
    lineHeight: 20,
    fontStyle: "italic",
  },
});
