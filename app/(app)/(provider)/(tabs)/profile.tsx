import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { appBottomSheetStyles } from "../../../../components/app/AppBottomSheetUI";
import {
  ProfileFeatureShell,
  ProfileSectionRail,
} from "../../../../components/ProfileFeatureShell";
import {
  AppMenuDivider,
  AppMenuItem,
  AppMenuSection,
  AppScreenShell,
  appScreenStyles,
  AUTH_COLORS,
} from "../../../../components/app/AppScreenUI";
import ChangePasswordModal from "../../../../components/ChangePasswordModal";
import EditProviderProfileModal from "../../../../components/EditProviderProfileModal";
import EditPostalAddressModal from "../../../../components/(patient)/EditPostalAddressModal";
import EditBankDetailsModal from "../../../../components/(provider)/EditBankDetailsModal";
import EditDocumentPreviewOverlay, {
  type EditDocumentPreview,
} from "../../../../components/EditDocumentPreviewOverlay";
import { useAuth } from "../../../../context/AuthContext";
import apiClient from "../../../../lib/api";
import {
  buildBackendAssetUrl,
  withAccessTokenQuery,
} from "../../../../lib/backend";
import { showAlertDialog } from "@/components/AlertDialog";

type IdDocumentSide = "idDocumentFront" | "idDocumentBack";
type PdfDocumentType =
  | "finalQualification"
  | "HPCNAQualification"
  | "dispensingCertificateLicence";
type IdPreviewSource = { uri: string } | null;
type PdfPreviewSource = {
  uri: string;
  name?: string;
} | null;

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [editProfileVisible, setEditProfileVisible] = React.useState(false);
  const [editPostalAddressVisible, setEditPostalAddressVisible] =
    React.useState(false);
  const [editBankDetailsVisible, setEditBankDetailsVisible] =
    React.useState(false);
  const [changePasswordVisible, setChangePasswordVisible] =
    React.useState(false);
  const [helpSupportVisible, setHelpSupportVisible] = React.useState(false);
  const [aboutVisible, setAboutVisible] = React.useState(false);
  const [editDocumentsVisible, setEditDocumentsVisible] =
    React.useState(false);
  const [selectedImage, setSelectedImage] =
    React.useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadingDocument, setUploadingDocument] = React.useState<
    string | null
  >(null);
  const [idFrontPreview, setIdFrontPreview] =
    React.useState<IdPreviewSource>(null);
  const [idBackPreview, setIdBackPreview] =
    React.useState<IdPreviewSource>(null);
  const [primaryQualPreview, setPrimaryQualPreview] =
    React.useState<PdfPreviewSource>(null);
  const [hpcnaQualPreview, setHpcnaQualPreview] =
    React.useState<PdfPreviewSource>(null);
  const [prescribingPreview, setPrescribingPreview] =
    React.useState<PdfPreviewSource>(null);
  const [documentPreview, setDocumentPreview] =
    React.useState<EditDocumentPreview | null>(null);

  const resolveIdPreview = React.useCallback(
    async (filename?: string | null): Promise<IdPreviewSource> => {
      const base = buildBackendAssetUrl("images", filename);
      if (!base) return null;
      return { uri: await withAccessTokenQuery(base) };
    },
    [],
  );

  const resolvePdfPreview = React.useCallback(
    async (filename?: string | null): Promise<PdfPreviewSource> => {
      const base = buildBackendAssetUrl("images", filename);
      if (!base || !filename) return null;
      return { uri: base, name: filename };
    },
    [],
  );

  const loadIdDocumentPreviews = React.useCallback(
    async (frontFilename?: string | null, backFilename?: string | null) => {
      const [front, back] = await Promise.all([
        resolveIdPreview(frontFilename ?? user?.idDocumentFront),
        resolveIdPreview(backFilename ?? user?.idDocumentBack),
      ]);
      setIdFrontPreview(front);
      setIdBackPreview(back);
    },
    [user?.idDocumentFront, user?.idDocumentBack, resolveIdPreview],
  );

  const loadPdfDocumentPreviews = React.useCallback(
    async (filenames?: {
      finalQualification?: string | null;
      HPCNAQualification?: string | null;
      dispensingCertificateLicence?: string | null;
    }) => {
      const [primary, hpcna, prescribing] = await Promise.all([
        resolvePdfPreview(
          filenames?.finalQualification ?? user?.finalQualification,
        ),
        resolvePdfPreview(
          filenames?.HPCNAQualification ?? user?.HPCNAQualification,
        ),
        resolvePdfPreview(
          filenames?.dispensingCertificateLicence ??
            user?.dispensingCertificateLicence,
        ),
      ]);
      setPrimaryQualPreview(primary);
      setHpcnaQualPreview(hpcna);
      setPrescribingPreview(prescribing);
    },
    [
      user?.finalQualification,
      user?.HPCNAQualification,
      user?.dispensingCertificateLicence,
      resolvePdfPreview,
    ],
  );

  // When the sheet opens, pull existing document filenames from the server and show previews.
  React.useEffect(() => {
    if (!editDocumentsVisible) return;

    let cancelled = false;

    (async () => {
      let frontFilename: string | null | undefined = user?.idDocumentFront;
      let backFilename: string | null | undefined = user?.idDocumentBack;
      let primaryFilename: string | null | undefined = user?.finalQualification;
      let hpcnaFilename: string | null | undefined = user?.HPCNAQualification;
      let prescribingFilename: string | null | undefined =
        user?.dispensingCertificateLicence;

      try {
        const response = await apiClient.get("/app/auth/user-details");
        const remote = response.data?.user;
        if (remote && !cancelled) {
          frontFilename = remote.idDocumentFront ?? null;
          backFilename = remote.idDocumentBack ?? null;
          primaryFilename = remote.finalQualification ?? null;
          hpcnaFilename = remote.HPCNAQualification ?? null;
          prescribingFilename = remote.dispensingCertificateLicence ?? null;
          await updateUser({
            idDocumentFront: frontFilename || undefined,
            idDocumentBack: backFilename || undefined,
            finalQualification: primaryFilename || undefined,
            HPCNAQualification: hpcnaFilename || undefined,
            dispensingCertificateLicence: prescribingFilename || undefined,
            isDocumentVerified: remote.isDocumentVerified,
          });
        }
      } catch (error) {
        console.warn("Could not refresh documents from server:", error);
      }

      if (!cancelled) {
        await Promise.all([
          loadIdDocumentPreviews(frontFilename, backFilename),
          loadPdfDocumentPreviews({
            finalQualification: primaryFilename,
            HPCNAQualification: hpcnaFilename,
            dispensingCertificateLicence: prescribingFilename,
          }),
        ]);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only re-run when the sheet opens — not when user/preview helpers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDocumentsVisible]);

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
    showAlertDialog(
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
            showAlertDialog(
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
    showAlertDialog(
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
    showAlertDialog("Log Out", "Are you sure you want to log out?", [
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
  const handleHelpSupportPress = () => setHelpSupportVisible(true);
  const handleAboutHealthConnectPress = () => setAboutVisible(true);
  const handleEditDocumentsPress = () => setEditDocumentsVisible(true);

  const pickIdDocument = async (documentType: IdDocumentSide) => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlertDialog(
          "Permission Denied",
          "We need gallery permissions to select an image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        await uploadIdDocument(documentType, result.assets[0]);
      }
    } catch (error) {
      showAlertDialog("Error", "Failed to pick document. Please try again.");
      console.error("ID document picker error:", error);
    }
  };

  const uploadIdDocument = async (
    documentType: IdDocumentSide,
    image: ImagePicker.ImagePickerAsset,
  ) => {
    if (!user?.userId) {
      showAlertDialog("Error", "User not found. Please try again.");
      return;
    }

    const localPreview = { uri: image.uri };
    if (documentType === "idDocumentFront") {
      setIdFrontPreview(localPreview);
    } else {
      setIdBackPreview(localPreview);
    }

    setUploadingDocument(documentType);
    try {
      const formData = new FormData();
      formData.append(documentType, {
        uri: image.uri,
        name: image.fileName || `${documentType}-${Date.now()}.jpg`,
        type: image.mimeType || "image/jpeg",
      } as any);

      const endpoint =
        documentType === "idDocumentFront"
          ? "/app/auth/update-id-front"
          : "/app/auth/update-id-back";

      const response = await apiClient.patch(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const savedFilename =
        documentType === "idDocumentFront"
          ? response.data?.idDocumentFront
          : response.data?.idDocumentBack;

      await updateUser({
        ...(savedFilename ? { [documentType]: savedFilename } : {}),
        isDocumentVerified: false,
      });

      if (savedFilename) {
        const authenticated = await resolveIdPreview(savedFilename);
        if (documentType === "idDocumentFront") {
          setIdFrontPreview(authenticated ?? localPreview);
        } else {
          setIdBackPreview(authenticated ?? localPreview);
        }
      }

      showAlertDialog(
        "Success",
        "ID document updated. It will be reviewed by an administrator.",
      );
    } catch (error: any) {
      await loadIdDocumentPreviews();
      showAlertDialog(
        "Error",
        error.response?.data?.message ||
          "Failed to upload ID document. Please try again.",
      );
      console.error("ID document upload error:", error);
    } finally {
      setUploadingDocument(null);
    }
  };

  const setPdfPreviewForType = (
    documentType: PdfDocumentType,
    preview: PdfPreviewSource,
  ) => {
    if (documentType === "finalQualification") {
      setPrimaryQualPreview(preview);
    } else if (documentType === "HPCNAQualification") {
      setHpcnaQualPreview(preview);
    } else {
      setPrescribingPreview(preview);
    }
  };

  const pickDocument = async (documentType: PdfDocumentType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadDocument(documentType, result.assets[0]);
      }
    } catch (error: any) {
      showAlertDialog("Error", "Failed to pick document. Please try again.");
      console.error("Document picker error:", error);
    }
  };

  const handleUploadDocument = async (
    documentType: PdfDocumentType,
    document: DocumentPicker.DocumentPickerAsset,
  ) => {
    if (!user?.userId) {
      showAlertDialog("Error", "User not found. Please try again.");
      return;
    }

    const mimeType = document.mimeType || "";
    const fileName = document.name || "";
    const isPdfType =
      mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

    if (!isPdfType) {
      showAlertDialog(
        "Invalid File Type",
        "This document must be a PDF file. Please select a PDF file.",
      );
      return;
    }

    const localPreview: PdfPreviewSource = {
      uri: document.uri,
      name: document.name || `${documentType}.pdf`,
    };
    setPdfPreviewForType(documentType, localPreview);

    setUploadingDocument(documentType);
    try {
      const formData = new FormData();
      const fieldName = documentType;

      formData.append(fieldName, {
        uri: document.uri,
        name: document.name || `${documentType}-${Date.now()}.pdf`,
        type: document.mimeType || "application/pdf",
      } as any);

      let endpoint = "";
      switch (documentType) {
        case "finalQualification":
          endpoint = "/app/auth/update-primary-qualification";
          break;
        case "HPCNAQualification":
          endpoint = "/app/auth/update-annual-qualification";
          break;
        case "dispensingCertificateLicence":
          endpoint = "/app/auth/update-prescribing-certificate";
          break;
      }

      const response = await apiClient.patch(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Prefer filename from response when available; otherwise refresh from server.
      let savedFilename: string | null | undefined =
        documentType === "dispensingCertificateLicence"
          ? response.data?.dispensingCertificateLicence
          : documentType === "finalQualification"
            ? response.data?.finalQualification
            : response.data?.HPCNAQualification;

      if (!savedFilename) {
        try {
          const details = await apiClient.get("/app/auth/user-details");
          const remote = details.data?.user;
          if (remote) {
            savedFilename = remote[documentType] ?? null;
            await updateUser({
              finalQualification: remote.finalQualification || undefined,
              HPCNAQualification: remote.HPCNAQualification || undefined,
              dispensingCertificateLicence:
                remote.dispensingCertificateLicence || undefined,
              isDocumentVerified: false,
            });
          }
        } catch {
          await updateUser({ isDocumentVerified: false });
        }
      } else {
        await updateUser({
          [documentType]: savedFilename,
          isDocumentVerified: false,
        });
      }

      if (savedFilename) {
        const authenticated = await resolvePdfPreview(savedFilename);
        setPdfPreviewForType(documentType, authenticated ?? localPreview);
      }

      showAlertDialog(
        "Success",
        "Document updated. It will be reviewed by an administrator.",
      );
    } catch (error: any) {
      await loadPdfDocumentPreviews();
      showAlertDialog(
        "Error",
        error.response?.data?.message ||
          "Failed to upload document. Please try again.",
      );
      console.error("Upload error:", error);
    } finally {
      setUploadingDocument(null);
    }
  };

  const openDocumentPreview = (
    url: string | null | undefined,
    title: string,
    fileType: "image" | "pdf",
  ) => {
    if (!url) return;
    setDocumentPreview({ url, title, fileType });
  };

  return (
    <AppScreenShell>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={appScreenStyles.scrollContent}
      >
        <View style={appScreenStyles.profileHero}>
          {selectedImage ? (
            <Image
              source={{ uri: selectedImage.uri }}
              style={appScreenStyles.profileAvatar}
              resizeMode="cover"
            />
          ) : user?.profileImage ? (
            <Image
              source={{
                uri:
                  buildBackendAssetUrl("images", user.profileImage) ||
                  undefined,
              }}
              style={appScreenStyles.profileAvatar}
              resizeMode="cover"
            />
          ) : (
            <View style={appScreenStyles.profileAvatarPlaceholder}>
              <Feather name="user" size={48} color={AUTH_COLORS.green} />
            </View>
          )}
          <View style={appScreenStyles.profileHeroContent}>
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
        </View>

        <AppMenuSection title="Account">
          <AppMenuItem
            icon="edit-3"
            label="Edit Profile"
            onPress={() => setEditProfileVisible(true)}
          />
          <AppMenuDivider />
          <AppMenuItem
            icon="mail"
            label="Postal Address"
            onPress={() => setEditPostalAddressVisible(true)}
          />
          <AppMenuDivider />
          <AppMenuItem
            icon="credit-card"
            label="Bank Details"
            onPress={() => setEditBankDetailsVisible(true)}
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

      <EditPostalAddressModal
        visible={editPostalAddressVisible}
        onClose={() => setEditPostalAddressVisible(false)}
      />

      <EditBankDetailsModal
        visible={editBankDetailsVisible}
        onClose={() => setEditBankDetailsVisible(false)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
      />

      <ProfileFeatureShell
        visible={helpSupportVisible}
        onClose={() => setHelpSupportVisible(false)}
        kicker="Get assistance"
        title="Help & support"
        subtitle="Get in touch with us"
      >
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

        <View style={appBottomSheetStyles.ambulanceCard}>
          <Image
            source={require("../../../../assets/images/eme.png")}
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
      </ProfileFeatureShell>

      <ProfileFeatureShell
        visible={aboutVisible}
        onClose={() => setAboutVisible(false)}
        kicker="Our platform"
        title="About HealthConnect"
        subtitle="Your trusted healthcare platform"
      >
        <View style={appBottomSheetStyles.sectionContainer}>
          <ProfileSectionRail title="Functionality" />
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

        <View style={appBottomSheetStyles.sectionContainer}>
          <ProfileSectionRail title="Privacy" />
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

        <View style={appBottomSheetStyles.sectionContainer}>
          <ProfileSectionRail title="Rights" />
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
      </ProfileFeatureShell>

      <ProfileFeatureShell
        visible={editDocumentsVisible}
        onClose={() => {
          if (documentPreview) {
            setDocumentPreview(null);
            return;
          }
          setEditDocumentsVisible(false);
        }}
        kicker="Compliance"
        title="Edit documents"
        subtitle="Update your ID and professional documents"
        overlay={
          <EditDocumentPreviewOverlay
            preview={documentPreview}
            onClose={() => setDocumentPreview(null)}
          />
        }
      >
        {user?.isDocumentVerified === false &&
          (user?.idDocumentFront || user?.idDocumentBack) && (
            <View
              style={{
                backgroundColor: "#FEF2F2",
                borderWidth: 1,
                borderColor: "#FECACA",
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: "#DC2626",
                  fontSize: 13,
                  lineHeight: 18,
                  fontWeight: "600",
                }}
              >
                Your documents are pending administrator review. Updating them
                will restart verification.
              </Text>
            </View>
          )}

        {(
          [
            {
              side: "idDocumentFront" as const,
              title: "National ID (Front)",
              preview: idFrontPreview,
              hasStored: Boolean(user?.idDocumentFront),
            },
            {
              side: "idDocumentBack" as const,
              title: "National ID (Back)",
              preview: idBackPreview,
              hasStored: Boolean(user?.idDocumentBack),
            },
          ]
        ).map(({ side, title, preview, hasStored }) => {
          const isSideUploading = uploadingDocument === side;
          return (
            <View
              key={side}
              style={[
                appBottomSheetStyles.documentCard,
                isSideUploading && appBottomSheetStyles.documentCardUploading,
              ]}
            >
              <Text style={appBottomSheetStyles.documentTitle}>{title}</Text>
              <Text
                style={[
                  appBottomSheetStyles.documentSubtitle,
                  { marginBottom: 12 },
                ]}
              >
                {hasStored || preview
                  ? "Tap replace to upload a new image"
                  : "No document uploaded yet"}
              </Text>

              {preview ? (
                <TouchableOpacity
                  onPress={() =>
                    openDocumentPreview(preview.uri, title, "image")
                  }
                  activeOpacity={0.85}
                >
                  <Image
                    source={preview}
                    style={{
                      width: "100%",
                      height: 180,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: AUTH_COLORS.inputBorder,
                      backgroundColor: AUTH_COLORS.bg,
                      marginBottom: 4,
                    }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      marginBottom: 12,
                      color: AUTH_COLORS.green,
                      fontWeight: "600",
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    Tap to preview
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={{
                    width: "100%",
                    height: 140,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: AUTH_COLORS.inputBorder,
                    backgroundColor: AUTH_COLORS.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Feather
                    name="image"
                    size={28}
                    color={AUTH_COLORS.textMuted}
                  />
                  <Text
                    style={{
                      marginTop: 8,
                      color: AUTH_COLORS.textMuted,
                      fontSize: 13,
                    }}
                  >
                    Preview will appear here
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => pickIdDocument(side)}
                disabled={uploadingDocument !== null}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: AUTH_COLORS.greenSoft,
                  borderWidth: 1,
                  borderColor: AUTH_COLORS.inputBorder,
                  borderRadius: 12,
                  paddingVertical: 12,
                  opacity: uploadingDocument !== null ? 0.6 : 1,
                }}
                activeOpacity={0.7}
              >
                {isSideUploading ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={AUTH_COLORS.green}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={{
                        color: AUTH_COLORS.green,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      Uploading…
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather
                      name={preview ? "refresh-cw" : "upload"}
                      size={18}
                      color={AUTH_COLORS.green}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={{
                        color: AUTH_COLORS.green,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {preview ? "Replace image" : "Upload image"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {(
          [
            {
              type: "finalQualification" as const,
              title: "Primary Qualification",
              subtitle: "Degree or diploma certificate (PDF only)",
              icon: "award" as const,
              preview: primaryQualPreview,
              hasStored: Boolean(user?.finalQualification),
            },
            {
              type: "HPCNAQualification" as const,
              title: "Annual Qualification (HPCNA)",
              subtitle: "HPCNA practicing certificate (PDF only)",
              icon: "calendar" as const,
              preview: hpcnaQualPreview,
              hasStored: Boolean(user?.HPCNAQualification),
            },
            ...(user?.role?.toLowerCase() === "nurse"
              ? [
                  {
                    type: "dispensingCertificateLicence" as const,
                    title: "Prescribing Certificate",
                    subtitle: "Dispensing licence (PDF only)",
                    icon: "file-text" as const,
                    preview: prescribingPreview,
                    hasStored: Boolean(user?.dispensingCertificateLicence),
                  },
                ]
              : []),
          ]
        ).map(({ type, title, subtitle, icon, preview, hasStored }) => {
          const isSideUploading = uploadingDocument === type;
          return (
            <View
              key={type}
              style={[
                appBottomSheetStyles.documentCard,
                isSideUploading && appBottomSheetStyles.documentCardUploading,
              ]}
            >
              <Text style={appBottomSheetStyles.documentTitle}>{title}</Text>
              <Text
                style={[
                  appBottomSheetStyles.documentSubtitle,
                  { marginBottom: 12 },
                ]}
              >
                {hasStored || preview
                  ? "Tap replace to upload a new PDF"
                  : subtitle}
              </Text>

              {preview ? (
                <TouchableOpacity
                  onPress={() =>
                    openDocumentPreview(preview.uri, title, "pdf")
                  }
                  activeOpacity={0.7}
                  style={{
                    width: "100%",
                    minHeight: 140,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: AUTH_COLORS.inputBorder,
                    backgroundColor: AUTH_COLORS.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 20,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      backgroundColor: AUTH_COLORS.greenSoft,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    <Feather name={icon} size={26} color={AUTH_COLORS.green} />
                  </View>
                  <Text
                    style={{
                      color: AUTH_COLORS.textDark,
                      fontWeight: "700",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                    numberOfLines={2}
                  >
                    {preview.name || "PDF uploaded"}
                  </Text>
                  <Text
                    style={{
                      marginTop: 6,
                      color: AUTH_COLORS.green,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    Tap to preview
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={{
                    width: "100%",
                    height: 140,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: AUTH_COLORS.inputBorder,
                    backgroundColor: AUTH_COLORS.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Feather
                    name="file-text"
                    size={28}
                    color={AUTH_COLORS.textMuted}
                  />
                  <Text
                    style={{
                      marginTop: 8,
                      color: AUTH_COLORS.textMuted,
                      fontSize: 13,
                    }}
                  >
                    Preview will appear here
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => pickDocument(type)}
                disabled={uploadingDocument !== null}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: AUTH_COLORS.greenSoft,
                  borderWidth: 1,
                  borderColor: AUTH_COLORS.inputBorder,
                  borderRadius: 12,
                  paddingVertical: 12,
                  opacity: uploadingDocument !== null ? 0.6 : 1,
                }}
                activeOpacity={0.7}
              >
                {isSideUploading ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={AUTH_COLORS.green}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={{
                        color: AUTH_COLORS.green,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      Uploading…
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather
                      name={preview ? "refresh-cw" : "upload"}
                      size={18}
                      color={AUTH_COLORS.green}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={{
                        color: AUTH_COLORS.green,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {preview ? "Replace PDF" : "Upload PDF"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ProfileFeatureShell>
    </AppScreenShell>
  );
}
