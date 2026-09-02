import { Feather } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef } from "react";
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
  AUTH_COLORS,
} from "../../../components/app/AppScreenUI";
import ChangePasswordModal from "../../../components/ChangePasswordModal";
import EditProviderProfileModal from "../../../components/EditProviderProfileModal";
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
  const editDocumentsSheetRef = useRef<BottomSheet>(null);
  const editDocumentsSnapPoints = useMemo(() => ["85%"], []);
  const [uploadingDocument, setUploadingDocument] = React.useState<
    string | null
  >(null);

  const fetchLatestUserDetails = useCallback(async () => {
    try {
      const response = await apiClient.get("/app/auth/user-details/");
      if (response.data?.status && response.data?.user) {
        await updateUser(response.data.user);
      }
    } catch (error) {
      console.error("Error refreshing provider profile details:", error);
    }
  }, [updateUser]);

  useFocusEffect(
    useCallback(() => {
      // Only fetch latest user details when no modal is open
      if (!editProfileVisible) {
        fetchLatestUserDetails();
      }
    }, [fetchLatestUserDetails, editProfileVisible]),
  );

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

  // Required by Google Play, which needs an in-app route to delete the account
  // and its data. Deactivation does not satisfy that — it removes nothing.
  const performAccountDeletion = async () => {
    setIsLoading(true);
    try {
      await apiClient.delete("/app/auth/delete-account");
      Alert.alert(
        "Account Deleted",
        "Your account, personal details and uploaded documents have been deleted. Consultation and payment records are kept only as long as the law requires.",
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
      "This permanently deletes your account, your personal details and your uploaded documents, including your identity documents and professional certificates. It cannot be undone.\n\nYour consultation and payment records are kept only for as long as the law requires.",
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
              "Your account cannot be recovered afterwards, and you will need to re-submit your credentials for verification if you return.",
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
  const handleEditDocumentsPress = () => {
    editDocumentsSheetRef.current?.expand();
  };

  const pickDocument = async (documentType: string) => {
    try {
      // ID documents should be images only, others should be PDF only
      const allowedTypes =
        documentType === "idDocumentFront" || documentType === "idDocumentBack"
          ? ["image/*"]
          : ["application/pdf"];

      const result = await DocumentPicker.getDocumentAsync({
        type: allowedTypes,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadDocument(documentType, result.assets[0]);
      }
    } catch (error: any) {
      Alert.alert("Error", "Failed to pick document. Please try again.");
      console.error("Document picker error:", error);
    }
  };

  const handleUploadDocument = async (
    documentType: string,
    document: DocumentPicker.DocumentPickerAsset,
  ) => {
    if (!user?.userId) {
      Alert.alert("Error", "User not found. Please try again.");
      return;
    }

    // Validate file type before uploading
    const mimeType = document.mimeType || "";
    const fileName = document.name || "";
    const isImageType =
      mimeType.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);
    const isPdfType =
      mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

    // ID documents must be images
    if (
      documentType === "idDocumentFront" ||
      documentType === "idDocumentBack"
    ) {
      if (!isImageType) {
        Alert.alert(
          "Invalid File Type",
          "ID documents must be image files (JPG, PNG, etc.). Please select an image file.",
        );
        return;
      }
    } else {
      // Other documents must be PDFs
      if (!isPdfType) {
        Alert.alert(
          "Invalid File Type",
          "This document must be a PDF file. Please select a PDF file.",
        );
        return;
      }
    }

    setUploadingDocument(documentType);
    try {
      const formData = new FormData();
      const fieldName =
        documentType === "idDocumentFront"
          ? "idDocumentFront"
          : documentType === "idDocumentBack"
            ? "idDocumentBack"
            : documentType === "finalQualification"
              ? "finalQualification"
              : documentType === "HPCNAQualification"
                ? "HPCNAQualification"
                : "dispensingCertificateLicence";

      // Determine file extension and MIME type based on document type
      const isImage =
        documentType === "idDocumentFront" || documentType === "idDocumentBack";
      const defaultExtension = isImage ? "jpg" : "pdf";
      const defaultMimeType = isImage ? "image/jpeg" : "application/pdf";

      formData.append(fieldName, {
        uri: document.uri,
        name:
          document.name || `${documentType}-${Date.now()}.${defaultExtension}`,
        type: document.mimeType || defaultMimeType,
      } as any);

      let endpoint = "";
      switch (documentType) {
        case "idDocumentFront":
          endpoint = "/app/auth/update-id-front";
          break;
        case "idDocumentBack":
          endpoint = "/app/auth/update-id-back";
          break;
        case "finalQualification":
          endpoint = "/app/auth/update-primary-qualification";
          break;
        case "HPCNAQualification":
          endpoint = "/app/auth/update-annual-qualification";
          break;
        case "dispensingCertificateLicence":
          endpoint = "/app/auth/update-prescribing-certificate";
          break;
        default:
          Alert.alert("Error", "Invalid document type.");
          return;
      }

      const response = await apiClient.patch(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      Alert.alert("Success", "Document updated successfully!");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          "Failed to upload document. Please try again.",
      );
      console.error("Upload error:", error);
    } finally {
      setUploadingDocument(null);
    }
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
            {user?.fullname || "Provider Name"}
          </Text>
          <Text style={appScreenStyles.profileEmail}>
            {user?.email || "provider@email.com"}
          </Text>
          {user?.role ? (
            <View style={appScreenStyles.roleBadge}>
              <Text style={appScreenStyles.roleBadgeText}>{user.role}</Text>
            </View>
          ) : null}
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
            icon="file-text"
            label="Edit Documents"
            onPress={handleEditDocumentsPress}
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
            subtitle="Your trusted healthcare platform"
          />

          {/* Functionality Section */}
          <View style={appBottomSheetStyles.sectionContainer}>
            <View style={appBottomSheetStyles.sectionHeader}>
              <Feather name="activity" size={24} color={AUTH_COLORS.green} />
              <Text style={appBottomSheetStyles.sectionTitle}>Functionality</Text>
            </View>
            <Text style={appBottomSheetStyles.sectionText}>
              HealthConnect is a comprehensive healthcare platform designed to
              connect healthcare providers with patients seamlessly. Our
              platform offers:
            </Text>
            <View style={appBottomSheetStyles.bulletList}>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Secure payment processing and billing management
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Professional profile and practice information management
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
              committed to protecting patient and provider information:
            </Text>
            <View style={appBottomSheetStyles.bulletList}>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Patient information is only accessible to authorized
                  healthcare providers
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  We never sell or share patient data with third parties for
                  marketing purposes
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Providers have full control over their practice information
                  and can update it at any time
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  Regular security audits and updates ensure data remains
                  protected
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  All communications are encrypted end-to-end for maximum
                  security
                </Text>
              </View>
            </View>
          </View>

          {/* User Rights Section */}
          <View style={appBottomSheetStyles.sectionContainer}>
            <View style={appBottomSheetStyles.sectionHeader}>
              <Feather name="user-check" size={24} color={AUTH_COLORS.green} />
              <Text style={appBottomSheetStyles.sectionTitle}>
                Provider Rights & Responsibilities
              </Text>
            </View>
            <Text style={appBottomSheetStyles.sectionText}>
              As a HealthConnect healthcare provider, you have the following
              rights and responsibilities:
            </Text>
            <View style={appBottomSheetStyles.bulletList}>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Right to Access:</Text> Full
                  access to your practice profile
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Right to Control:</Text> Manage
                  your availability, and practice information
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Right to Privacy:</Text> Your
                  professional information is protected and confidential
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Right to Support:</Text> Access
                  to 24/7 technical support and issue reporting
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Your Responsibility:</Text>{" "}
                  Maintain accurate practice information and comply with medical
                  regulations
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Patient Confidentiality:</Text>{" "}
                  Protect patient privacy and maintain confidentiality of all
                  medical information
                </Text>
              </View>
              <View style={appBottomSheetStyles.bulletItem}>
                <Text style={appBottomSheetStyles.bullet}>•</Text>
                <Text style={appBottomSheetStyles.bulletText}>
                  <Text style={appBottomSheetStyles.boldText}>Professional Standards:</Text>{" "}
                  Adhere to professional medical standards and ethical
                  guidelines
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

      {/* Edit Documents Bottom Sheet */}
      <BottomSheet
        ref={editDocumentsSheetRef}
        index={-1}
        snapPoints={editDocumentsSnapPoints}
        enablePanDownToClose
        {...appBottomSheetAppearance}
      >
        <BottomSheetScrollView
          style={appBottomSheetScrollPadding}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <AppBottomSheetHeader
            title="Edit Documents"
            subtitle="Update your professional documents"
          />

          {/* ID Front */}
          <TouchableOpacity
            onPress={() => pickDocument("idDocumentFront")}
            disabled={uploadingDocument !== null}
            style={[
              appBottomSheetStyles.documentCard,
              uploadingDocument === "idDocumentFront" &&
                appBottomSheetStyles.documentCardUploading,
            ]}
            activeOpacity={0.7}
          >
            <View style={appBottomSheetStyles.documentCardContent}>
              <View style={appBottomSheetStyles.documentIconContainer}>
                <Feather name="file-text" size={24} color={AUTH_COLORS.green} />
              </View>
              <View style={appBottomSheetStyles.documentTextContainer}>
                <Text style={appBottomSheetStyles.documentTitle}>National ID (Front)</Text>
                <Text style={appBottomSheetStyles.documentSubtitle}>
                  Update your ID front document (Image only)
                </Text>
              </View>
              {uploadingDocument === "idDocumentFront" ? (
                <ActivityIndicator size="small" color={AUTH_COLORS.green} />
              ) : (
                <Feather name="chevron-right" size={20} color={AUTH_COLORS.textMuted} />
              )}
            </View>
          </TouchableOpacity>

          {/* ID Back */}
          <TouchableOpacity
            onPress={() => pickDocument("idDocumentBack")}
            disabled={uploadingDocument !== null}
            style={[
              appBottomSheetStyles.documentCard,
              uploadingDocument === "idDocumentBack" &&
                appBottomSheetStyles.documentCardUploading,
            ]}
            activeOpacity={0.7}
          >
            <View style={appBottomSheetStyles.documentCardContent}>
              <View style={appBottomSheetStyles.documentIconContainer}>
                <Feather name="file-text" size={24} color={AUTH_COLORS.green} />
              </View>
              <View style={appBottomSheetStyles.documentTextContainer}>
                <Text style={appBottomSheetStyles.documentTitle}>National ID (Back)</Text>
                <Text style={appBottomSheetStyles.documentSubtitle}>
                  Update your ID back document (Image only)
                </Text>
              </View>
              {uploadingDocument === "idDocumentBack" ? (
                <ActivityIndicator size="small" color={AUTH_COLORS.green} />
              ) : (
                <Feather name="chevron-right" size={20} color={AUTH_COLORS.textMuted} />
              )}
            </View>
          </TouchableOpacity>

          {/* Primary Qualification */}
          <TouchableOpacity
            onPress={() => pickDocument("finalQualification")}
            disabled={uploadingDocument !== null}
            style={[
              appBottomSheetStyles.documentCard,
              uploadingDocument === "finalQualification" &&
                appBottomSheetStyles.documentCardUploading,
            ]}
            activeOpacity={0.7}
          >
            <View style={appBottomSheetStyles.documentCardContent}>
              <View style={appBottomSheetStyles.documentIconContainer}>
                <Feather name="award" size={24} color={AUTH_COLORS.green} />
              </View>
              <View style={appBottomSheetStyles.documentTextContainer}>
                <Text style={appBottomSheetStyles.documentTitle}>Primary Qualification</Text>
                <Text style={appBottomSheetStyles.documentSubtitle}>
                  Update your degree or diploma certificate (PDF only)
                </Text>
              </View>
              {uploadingDocument === "finalQualification" ? (
                <ActivityIndicator size="small" color={AUTH_COLORS.green} />
              ) : (
                <Feather name="chevron-right" size={20} color={AUTH_COLORS.textMuted} />
              )}
            </View>
          </TouchableOpacity>

          {/* Annual Qualification (HPCNA) */}
          <TouchableOpacity
            onPress={() => pickDocument("HPCNAQualification")}
            disabled={uploadingDocument !== null}
            style={[
              appBottomSheetStyles.documentCard,
              uploadingDocument === "HPCNAQualification" &&
                appBottomSheetStyles.documentCardUploading,
            ]}
            activeOpacity={0.7}
          >
            <View style={appBottomSheetStyles.documentCardContent}>
              <View style={appBottomSheetStyles.documentIconContainer}>
                <Feather name="calendar" size={24} color={AUTH_COLORS.green} />
              </View>
              <View style={appBottomSheetStyles.documentTextContainer}>
                <Text style={appBottomSheetStyles.documentTitle}>
                  Annual Qualification (HPCNA)
                </Text>
                <Text style={appBottomSheetStyles.documentSubtitle}>
                  Update your HPCNA practicing certificate (PDF only)
                </Text>
              </View>
              {uploadingDocument === "HPCNAQualification" ? (
                <ActivityIndicator size="small" color={AUTH_COLORS.green} />
              ) : (
                <Feather name="chevron-right" size={20} color={AUTH_COLORS.textMuted} />
              )}
            </View>
          </TouchableOpacity>

          {/* Prescribing Certificate (Nurse only) */}
          {user?.role?.toLowerCase() === "nurse" && (
            <TouchableOpacity
              onPress={() => pickDocument("dispensingCertificateLicence")}
              disabled={uploadingDocument !== null}
              style={[
                appBottomSheetStyles.documentCard,
                uploadingDocument === "dispensingCertificateLicence" &&
                  appBottomSheetStyles.documentCardUploading,
              ]}
              activeOpacity={0.7}
            >
              <View style={appBottomSheetStyles.documentCardContent}>
                <View style={appBottomSheetStyles.documentIconContainer}>
                  <Feather name="file-text" size={24} color={AUTH_COLORS.green} />
                </View>
                <View style={appBottomSheetStyles.documentTextContainer}>
                  <Text style={appBottomSheetStyles.documentTitle}>
                    Prescribing Certificate
                  </Text>
                  <Text style={appBottomSheetStyles.documentSubtitle}>
                    Update your dispensing licence (PDF only)
                  </Text>
                </View>
                {uploadingDocument === "dispensingCertificateLicence" ? (
                  <ActivityIndicator size="small" color={AUTH_COLORS.green} />
                ) : (
                  <Feather name="chevron-right" size={20} color={AUTH_COLORS.textMuted} />
                )}
              </View>
            </TouchableOpacity>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </AppScreenShell>
  );
}
