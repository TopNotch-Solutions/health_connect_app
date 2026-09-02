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
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
  AppBottomSheetHeader,
  appBottomSheetAppearance,
  appBottomSheetScrollPadding,
  appBottomSheetStyles,
} from "../../../components/app/AppBottomSheetUI";
import {
  AppMenuDivider,
  AppMenuItem,
  AppMenuSection,
  AppScreenShell,
  appScreenStyles,
} from "../../../components/app/AppScreenUI";
import { AUTH_COLORS } from "../../../lib/authScreenTheme";
import ChangePasswordModal from "../../../components/ChangePasswordModal";
import EditPatientProfileModal from "../../../components/EditPatientProfileModal";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../lib/api";
import { buildBackendAssetUrl } from "../../../lib/backend";

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

  // This is the base URL where your backend serves images.
  // YOU MUST CONFIRM THIS from your backend's `server.js` or `app.js` file.
  // It's often where you see a line like `app.use(express.static('public'))`.
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

      const response = await apiClient.patch(
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
        console.log(response.data);
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
            // The root layout will handle the redirection automatically.
          } catch {
            Alert.alert("Error", "Could not log out. Please try again");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const handleEmailPress = () =>
    Linking.openURL("mailto:support@healthconnect.com?subject=Support Request");
  const handlePhonePress = () => Linking.openURL("tel:+264811234567");
  const handleAmbulancePress = () => Linking.openURL("tel:956");
  const handleHelpSupportPress = () => {
    helpSupportSheetRef.current?.expand();
  };
  const handleAboutHealthConnectPress = () => {
    aboutHealthConnectSheetRef.current?.expand();
  };

  // Required by Google Play, which needs an in-app route to delete the account
  // and its data. Deactivation does not satisfy that — it removes nothing.
  const performAccountDeletion = async () => {
    setIsLoading(true);
    try {
      await apiClient.delete("/app/auth/delete-account");
      Alert.alert(
        "Account Deleted",
        "Your account and personal details have been deleted. Consultation and payment records are kept only as long as the law requires.",
        [{ text: "OK", onPress: async () => await logout() }],
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to delete account",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account, your personal details and your uploaded documents. It cannot be undone.\n\nYour consultation and payment records are kept only for as long as the law requires.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          // Second confirmation: this is irreversible and sits directly below
          // a similarly worded, recoverable action.
          onPress: () =>
            Alert.alert(
              "Are you absolutely sure?",
              "Your account cannot be recovered afterwards.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete my account",
                  style: "destructive",
                  onPress: performAccountDeletion,
                },
              ],
            ),
        },
      ],
    );
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
            setIsLoading(true);
            try {
              const response = await apiClient.patch(
                `/app/auth/deactivate-account/${user?.userId}`,
              );

              if (response.data.status) {
                Alert.alert(
                  "Account Deactivated",
                  "Your account has been deactivated successfully.",
                  [
                    {
                      text: "OK",
                      onPress: async () => {
                        await logout();
                      },
                    },
                  ],
                );
              }
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

  return (
    <AppScreenShell>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={appScreenStyles.scrollContent}
      >
        <View style={appScreenStyles.profileHero}>
          <View style={appScreenStyles.heroOrbLarge} pointerEvents="none" />
          {selectedImage ? (
            <Image
              source={{ uri: selectedImage.uri }}
              style={appScreenStyles.profileAvatar}
            />
          ) : user?.profileImage ? (
            <Image
              source={{
                uri:
                  buildBackendAssetUrl("images", user.profileImage) ||
                  undefined,
              }}
              style={appScreenStyles.profileAvatar}
            />
          ) : (
            <View style={appScreenStyles.profileAvatarPlaceholder}>
              <Feather name="user" size={48} color={AUTH_COLORS.green} />
            </View>
          )}
          <Text style={appScreenStyles.profileName}>
            {user?.fullname || "Patient Name"}
          </Text>
          <Text style={appScreenStyles.profileEmail}>
            {user?.email || "patient@email.com"}
          </Text>
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={isLoading || isUploading}
            style={[appScreenStyles.uploadPhotoBtn, { opacity: isLoading || isUploading ? 0.6 : 1 }]}
          >
            {isUploading ? (
              <View className="flex-row items-center">
                <ActivityIndicator
                  size="small"
                  color={AUTH_COLORS.green}
                  style={{ marginRight: 8 }}
                />
                <Text style={appScreenStyles.uploadPhotoText}>Uploading…</Text>
              </View>
            ) : (
              <Text style={appScreenStyles.uploadPhotoText}>Upload photo</Text>
            )}
          </TouchableOpacity>
        </View>

        <AppMenuSection title="Account">
          <AppMenuItem
            icon="edit-3"
            label="Edit Profile"
            onPress={() => setEditProfileVisible(true)}
          />
          <AppMenuDivider />
          <AppMenuItem
            icon="lock"
            label="Change Password"
            onPress={() => setChangePasswordVisible(true)}
          />
        </AppMenuSection>

        <AppMenuSection title="Support">
          <AppMenuItem
            icon="help-circle"
            label="Help & Support"
            onPress={handleHelpSupportPress}
          />
          <AppMenuDivider />
          <AppMenuItem
            icon="info"
            label="About HealthConnect"
            onPress={handleAboutHealthConnectPress}
          />
        </AppMenuSection>

        <AppMenuSection title="Danger zone">
          <AppMenuItem
            icon="alert-circle"
            label="Deactivate Account"
            onPress={handleDeactivateAccount}
            isDestructive
          />
          <AppMenuDivider />
          <AppMenuItem
            icon="trash-2"
            label="Delete Account"
            onPress={handleDeleteAccount}
            isDestructive
          />
          <AppMenuDivider />
          <AppMenuItem
            icon="log-out"
            label="Log Out"
            onPress={handleLogout}
            isDestructive
          />
        </AppMenuSection>

        {isLoading && (
          <View className="absolute inset-0 bg-black/20 justify-center items-center">
            <View
              className="rounded-2xl p-6"
              style={{ backgroundColor: AUTH_COLORS.white, borderWidth: 2, borderColor: AUTH_COLORS.inputBorder }}
            >
              <ActivityIndicator size="large" color={AUTH_COLORS.green} />
              <Text className="mt-3 font-semibold" style={{ color: AUTH_COLORS.textDark }}>
                Logging out...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditPatientProfileModal
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
        {...appBottomSheetAppearance}
      >
        <BottomSheetScrollView
          style={appBottomSheetScrollPadding}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <AppBottomSheetHeader
            title="Help & Support"
            subtitle="Get in touch with us"
          />

          <TouchableOpacity
            onPress={handleEmailPress}
            style={appBottomSheetStyles.contactCard}
            activeOpacity={0.7}
          >
            <View style={appBottomSheetStyles.contactIconContainer}>
              <Feather name="mail" size={32} color={AUTH_COLORS.green} />
            </View>
            <Text style={appBottomSheetStyles.contactTitle}>Contact Support</Text>
            <Text style={appBottomSheetStyles.contactText}>support@healthconnect.com</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePhonePress}
            style={appBottomSheetStyles.contactCard}
            activeOpacity={0.7}
          >
            <View style={appBottomSheetStyles.contactIconContainer}>
              <Feather name="phone" size={32} color={AUTH_COLORS.green} />
            </View>
            <Text style={appBottomSheetStyles.contactTitle}>Call Us</Text>
            <Text style={appBottomSheetStyles.contactText}>+264 81 811 1703</Text>
          </TouchableOpacity>

          {/* Ambulance Emergency Section */}
          <View style={appBottomSheetStyles.ambulanceCard}>
            <Image
              source={require("../../../assets/images/eme.png")}
              style={appBottomSheetStyles.ambulanceImage}
              resizeMode="contain"
            />
            <Text style={appBottomSheetStyles.ambulanceTitle}>
              Do you require an ambulance?
            </Text>
            <Text style={appBottomSheetStyles.ambulanceDescription}>
              For immediate medical emergencies, please contact our partner MR
              24/7 directly. They are available 24 hours a day to provide rapid
              emergency response.
            </Text>
            <TouchableOpacity
              onPress={handleAmbulancePress}
              style={appBottomSheetStyles.ambulanceButton}
              activeOpacity={0.7}
            >
              <Feather name="phone" size={20} color="#FFFFFF" />
              <Text style={appBottomSheetStyles.ambulanceButtonText}>
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
        {...appBottomSheetAppearance}
      >
        <BottomSheetScrollView
          style={appBottomSheetScrollPadding}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <AppBottomSheetHeader
            title="About HealthConnect"
            subtitle="Your trusted healthcare companion"
          />

          {/* Functionality Section */}
          <View style={appBottomSheetStyles.sectionContainer}>
            <View style={appBottomSheetStyles.sectionHeader}>
              <Feather name="activity" size={24} color={AUTH_COLORS.green} />
              <Text style={appBottomSheetStyles.sectionTitle}>Functionality</Text>
            </View>
            <Text style={appBottomSheetStyles.sectionText}>
              HealthConnect is a comprehensive healthcare platform designed to
              connect patients with healthcare providers seamlessly. Our
              platform offers:
            </Text>
            <View style={appBottomSheetStyles.bulletList}>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Easy appointment booking and management
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Secure payment processing for consultations
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  24/7 emergency services integration
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Issue reporting and support ticket system
                </Text>
              </View>
            </View>
          </View>

          {/* Privacy Policy Section */}
          <View style={appBottomSheetStyles.sectionContainer}>
            <View style={appBottomSheetStyles.sectionHeader}>
              <Feather name="shield" size={24} color={AUTH_COLORS.green} />
              <Text style={appBottomSheetStyles.sectionTitle}>Privacy Policy</Text>
            </View>
            <Text style={appBottomSheetStyles.sectionText}>
              Your privacy and data security are our top priorities. We are
              committed to protecting your personal health information:
            </Text>
            <View style={appBottomSheetStyles.bulletList}>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  We comply with healthcare data protection regulations
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Your information is only shared with authorized healthcare
                  providers
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  We never sell or share your data with third parties for
                  marketing purposes
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  You have full control over your data and can request deletion
                  at any time
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Regular security audits and updates ensure your data remains
                  protected
                </Text>
              </View>
            </View>
          </View>

          {/* User Rights Section */}
          <View style={appBottomSheetStyles.sectionContainer}>
            <View style={appBottomSheetStyles.sectionHeader}>
              <Feather name="user-check" size={24} color={AUTH_COLORS.green} />
              <Text style={appBottomSheetStyles.sectionTitle}>Your Rights</Text>
            </View>
            <Text style={appBottomSheetStyles.sectionText}>
              As a HealthConnect user, you have the following rights and
              responsibilities:
            </Text>
            <View style={appBottomSheetStyles.bulletList}>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Right to Correction:</Text> You
                  can request corrections to inaccurate information
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Right to Deletion:</Text> You
                  can request account deactivation and data deletion
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Right to Privacy:</Text> Your
                  health information is confidential and protected
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Right to Support:</Text> Access
                  to 24/7 customer support and issue reporting
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Your Responsibility:</Text> Keep
                  your account credentials secure and provide accurate
                  information
                </Text>
              </View>
            </View>
          </View>

          <View style={appBottomSheetStyles.footerContainer}>
            <Text style={appBottomSheetStyles.footerText}>
              For more information, contact our support team or visit our
              website.
            </Text>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </AppScreenShell>
  );
}
