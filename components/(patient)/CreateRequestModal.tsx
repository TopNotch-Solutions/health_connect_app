import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import MapView, { Marker } from "react-native-maps";
import { mapProviderProps } from "../../lib/map";
import apiClient from "../../lib/api";
import { AUTH_COLORS } from "../../lib/authScreenTheme";
import { buildBackendAssetUrl } from "../../lib/backend";
import socketService from "../../lib/socket";
import {
  getCurrentLocationWithAddress,
  reverseGeocode,
} from "../../lib/geocoding";
import {
  withIosMultilineTextInputStyle,
  withIosStandaloneTextInputStyle,
} from "../../lib/iosInputStyles";
import { PrescriptionFile } from "../../lib/prescription";
import { PickerField } from "../PickerField";
import { logViewMountDebug } from "../../lib/viewErrorLogger";
import {
  AppBottomSheetCloseHeader,
  appBottomSheetStyles,
  appModalBottomSheetStyles,
} from "../app/AppBottomSheetUI";
import { AppTextInput as TextInput } from "../AppTextInput";
import { KEYBOARD_AWARE_EXTRA_SCROLL } from "../ScreenLayout";
import PostalAddressConfirmModal from "./PostalAddressConfirmModal";
import { PostalAddressPayload } from "../../lib/postalAddress";
import { useAuth } from "../../context/AuthContext";
import { getUserFacingErrorMessage } from "../../lib/userFacingError";
import { resolveMedicalAidIcdPricing } from "../../lib/medicalAidIcdPricing";
import { AlertDialogHost, showAlertDialog } from "../AlertDialog";

export type PaymentMethod = "wallet" | "cash" | "medical_aid";

export type MedicalAidDetailsPayload = {
  medicalAidId: string;
  medicalAidTitle?: string;
  /** Medical aid number shown as MAF on the claim form header */
  membershipNumber: string;
  mainMemberName: string;
  /** Main member ID shown on the claim form */
  mainMemberId: string;
  residentialAddress: string;
  postalAddress?: PostalAddressPayload;
};

interface CreateRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (requestData: {
    ailmentCategory: string;
    ailmentCategoryId?: string;
    consultationMode: "house_visit" | "video_consultation";
    symptoms: string;
    paymentMethod: PaymentMethod;
    consultationCost: number;
    street: string;
    locality: string;
    region: string;
    preferredTime?: string;
    coordinates?: { latitude: number; longitude: number };
    prescriptionFile?: PrescriptionFile;
    medicalAidDetails?: MedicalAidDetailsPayload;
  }) => Promise<void>;
  selectedAilment?: any;
}

export default function CreateRequestModal({
  visible,
  onClose,
  onSubmit,
  selectedAilment = null,
}: CreateRequestModalProps) {
  const { user } = useAuth();
  const ailmentTitle = selectedAilment?.title || selectedAilment || "";
  const ailmentCategoryId = selectedAilment?._id;
  const supportsTeleconsultation = Boolean(
    selectedAilment?.supportsTeleconsultation,
  );
  const normalizeProviderLabel = (value?: string | null) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const isPharmacyRequest =
    normalizeProviderLabel(selectedAilment?.provider) === "pharmacist";

  const [ailmentCategory, setAilmentCategory] = useState(ailmentTitle);
  const [consultationMode, setConsultationMode] = useState<
    "house_visit" | "video_consultation"
  >("house_visit");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [street, setStreet] = useState("");
  const [locality, setLocality] = useState("");
  const [region, setRegion] = useState("");
  const [medicalAids, setMedicalAids] = useState<
    { id: string; title: string; image?: string | null }[]
  >([]);
  const [selectedMedicalAidId, setSelectedMedicalAidId] = useState("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [mainMemberName, setMainMemberName] = useState("");
  const [mainMemberId, setMainMemberId] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [isLoadingMedicalAids, setIsLoadingMedicalAids] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const hasIcd10 = Boolean(
    selectedAilment?.hasIcd10 ||
    (Array.isArray(selectedAilment?.icd10Codes) &&
      selectedAilment.icd10Codes.length > 0),
  );
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [markerCoord, setMarkerCoord] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showMap, setShowMap] = useState(false);

  const [prescriptionFile, setPrescriptionFile] =
    useState<PrescriptionFile | null>(null);
  const [showPostalAddressModal, setShowPostalAddressModal] = useState(false);
  /** Keeps request sheet closed after postal confirm while the confirm Alert is up */
  const [keepRequestSheetClosed, setKeepRequestSheetClosed] = useState(false);
  const [pendingMedicalAidDetails, setPendingMedicalAidDetails] =
    useState<MedicalAidDetailsPayload | null>(null);

  const medicalAidIcdPricing = resolveMedicalAidIcdPricing(
    selectedAilment?.icd10Codes,
  );
  const ailmentCost =
    consultationMode === "video_consultation"
      ? Number(selectedAilment?.teleconsultationCost ?? NaN)
      : Number(selectedAilment?.physicalconsultationCost ?? NaN);
  // Medical aid: first ICD price + second ICD price when two codes exist.
  // Cash/other methods use the ailment consultation cost.
  const selectedCost =
    paymentMethod === "medical_aid"
      ? Number(medicalAidIcdPricing?.consultationCost ?? NaN)
      : ailmentCost;

  // Load location when modal opens
  useEffect(() => {
    if (visible) {
      logViewMountDebug("CreateRequestModal", "modal opened", {
        showMap,
        mapRegion,
        markerCoord,
      });
      loadLocationAndAddress();
    }
  }, [visible]);

  // Update ailment category when selectedAilment changes
  useEffect(() => {
    if (selectedAilment) {
      const title = selectedAilment?.title || selectedAilment || "";
      setAilmentCategory(title);
    }
  }, [selectedAilment]);

  useEffect(() => {
    if (
      !supportsTeleconsultation &&
      consultationMode === "video_consultation"
    ) {
      setConsultationMode("house_visit");
    }
  }, [consultationMode, supportsTeleconsultation]);
  useEffect(() => {
    if (visible) {
      setPrescriptionFile(null);
      setLocationError(null);
      setPaymentMethod("cash");
      setSelectedMedicalAidId("");
      setMembershipNumber("");
      setMainMemberName("");
      setMainMemberId("");
      setResidentialAddress("");
      setShowPostalAddressModal(false);
      setKeepRequestSheetClosed(false);
      setPendingMedicalAidDetails(null);
    }
  }, [visible, selectedAilment]);

  useEffect(() => {
    if (!hasIcd10 && paymentMethod === "medical_aid") {
      setPaymentMethod("cash");
    }
  }, [hasIcd10, paymentMethod]);

  useEffect(() => {
    if (!visible || !hasIcd10) return;

    let cancelled = false;
    const loadMedicalAids = async () => {
      setIsLoadingMedicalAids(true);
      try {
        const response = await apiClient.get("/app/medical-aid/all");
        const raw = Array.isArray(response.data)
          ? response.data
          : (response.data?.data ?? []);
        if (cancelled) return;
        setMedicalAids(
          raw.map((item: any) => ({
            id: String(item._id || item.id),
            title: item.title || "",
            image: item.image || null,
          })),
        );
      } catch (error) {
        console.error("Failed to load medical aids:", error);
        if (!cancelled) {
          setMedicalAids([]);
        }
      } finally {
        if (!cancelled) setIsLoadingMedicalAids(false);
      }
    };

    loadMedicalAids();

    const handleCatalogUpdated = (payload?: { type?: string }) => {
      if (
        !payload?.type ||
        payload.type === "medical_aid" ||
        payload.type === "catalog"
      ) {
        loadMedicalAids();
      }
    };
    socketService.on("catalogUpdated", handleCatalogUpdated);

    return () => {
      cancelled = true;
      socketService.off("catalogUpdated", handleCatalogUpdated);
    };
  }, [visible, hasIcd10]);

  useEffect(() => {
    if (paymentMethod !== "medical_aid") return;
    if (residentialAddress.trim()) return;
    const composed = [street, locality, region]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
    if (composed) {
      setResidentialAddress(composed);
    }
  }, [paymentMethod, street, locality, region, residentialAddress]);

  const loadLocationAndAddress = async () => {
    setIsLoadingLocation(true);
    setLocationError(null);
    setMarkerCoord(null);
    setMapRegion(null);
    setShowMap(false);
    try {
      const { latitude, longitude, address } =
        await getCurrentLocationWithAddress();

      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      setMarkerCoord({ latitude, longitude });
      setShowMap(true);

      setStreet(address.route || "Patient Location");
      setLocality(address.locality || "Current City");
      setRegion(address.administrative_area_level_1 || "Current Region");
    } catch (error: any) {
      console.error("Error loading location:", error);
      setShowMap(false);
      setMarkerCoord(null);
      setStreet("");
      setLocality("");
      setRegion("");
      setLocationError(
        error.message ||
          "We could not detect your location. Enable location services and try again.",
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const isLocationReady = Boolean(markerCoord) && !isLoadingLocation;
  const canSubmit =
    isLocationReady &&
    !isLoading &&
    !locationError &&
    ailmentCategory.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    // Validation
    if (!ailmentCategory.trim()) {
      showAlertDialog("Required", "Please select or enter an ailment category");
      return;
    }

    if (!street.trim()) {
      showAlertDialog("Required", "Please confirm your street address");
      return;
    }

    if (!locality.trim()) {
      showAlertDialog("Required", "Please confirm your city/locality");
      return;
    }

    if (!region.trim()) {
      showAlertDialog("Required", "Please confirm your region/province");
      return;
    }

    if (paymentMethod === "medical_aid") {
      if (isNaN(selectedCost) || selectedCost <= 0) {
        showAlertDialog(
          "Invalid Cost",
          "This ailment does not have a valid ICD-10 consultation price configured.",
        );
        return;
      }
    } else if (isNaN(selectedCost) || selectedCost <= 0) {
      showAlertDialog(
        "Invalid Cost",
        "This ailment does not have a valid consultation cost configured.",
      );
      return;
    }

    // Ensure we have coordinates before submitting
    if (!markerCoord) {
      showAlertDialog(
        "Location Required",
        "Please wait for your location to be detected or try again.",
      );
      return;
    }

    if (isPharmacyRequest && !prescriptionFile) {
      showAlertDialog(
        "Prescription Required",
        "Please upload a prescription image or PDF before submitting a pharmacy request.",
      );
      return;
    }

    let medicalAidDetails: MedicalAidDetailsPayload | undefined;
    if (paymentMethod === "medical_aid") {
      if (!selectedMedicalAidId) {
        showAlertDialog("Required", "Please select a medical aid.");
        return;
      }
      if (!membershipNumber.trim()) {
        showAlertDialog("Required", "Please enter the medical aid number.");
        return;
      }
      if (!mainMemberName.trim()) {
        showAlertDialog("Required", "Please enter the main member name.");
        return;
      }
      if (!mainMemberId.trim()) {
        showAlertDialog("Required", "Please enter the main member ID.");
        return;
      }
      if (!residentialAddress.trim()) {
        showAlertDialog(
          "Required",
          "Please enter the patient residential address.",
        );
        return;
      }

      const selectedAid = medicalAids.find(
        (aid) => aid.id === selectedMedicalAidId,
      );
      // NAMAF / ICD-10 are snapshotted server-side from the portal ICD-10 record.
      medicalAidDetails = {
        medicalAidId: selectedMedicalAidId,
        medicalAidTitle: selectedAid?.title,
        membershipNumber: membershipNumber.trim(),
        mainMemberName: mainMemberName.trim(),
        mainMemberId: mainMemberId.trim(),
        residentialAddress: residentialAddress.trim(),
      };

      // Close request modal first, then open postal address modal
      // (Android needs a beat between Modal dismiss + present).
      setPendingMedicalAidDetails(medicalAidDetails);
      setKeepRequestSheetClosed(true);
      setTimeout(() => setShowPostalAddressModal(true), 280);
      return;
    }

    confirmAndSubmit(undefined);
  };

  const reopenRequestSheet = () => {
    setShowPostalAddressModal(false);
    setKeepRequestSheetClosed(false);
    setPendingMedicalAidDetails(null);
  };

  const confirmAndSubmit = (
    medicalAidDetails?: MedicalAidDetailsPayload,
    options?: { sheetHidden?: boolean },
  ) => {
    // Capture now ? async submit finishes after later re-renders.
    const sheetHidden = options?.sheetHidden ?? keepRequestSheetClosed;

    showAlertDialog(
      "Confirm Request",
      `Submit a ${consultationMode === "video_consultation" ? "video consultation" : "house visit"} request for N$${selectedCost.toFixed(2)}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            // Bring the request form back if they backed out of final confirm
            setShowPostalAddressModal(false);
            setPendingMedicalAidDetails(null);
            setKeepRequestSheetClosed(false);
          },
        },
        {
          text: "Submit",
          onPress: async () => {
            setIsLoading(true);
            try {
              await onSubmit({
                ailmentCategory: ailmentCategory.trim(),
                ailmentCategoryId: ailmentCategoryId,
                consultationMode,
                symptoms: "",
                paymentMethod,
                consultationCost: selectedCost,
                street: street.trim(),
                locality: locality.trim(),
                region: region.trim(),
                preferredTime: undefined,
                coordinates: markerCoord || undefined,
                prescriptionFile: prescriptionFile || undefined,
                medicalAidDetails,
              });

              // Don't reset form or close modal - let the parent handle navigation
              // The parent will navigate to waiting room, so we just need to close the modal
              setShowPostalAddressModal(false);
              setPendingMedicalAidDetails(null);
              setKeepRequestSheetClosed(false);
              onClose();
            } catch (error: any) {
              // Keep postal / request sheets stable until the error dialog is
              // dismissed ? reopening immediately covers the custom dialog.
              showAlertDialog(
                "Error",
                getUserFacingErrorMessage(error, "Failed to create request"),
                [
                  {
                    text: "OK",
                    onPress: () => {
                      setShowPostalAddressModal(false);
                      setPendingMedicalAidDetails(null);
                      if (sheetHidden) setKeepRequestSheetClosed(false);
                    },
                  },
                ],
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handlePostalAddressConfirmed = (postalAddress: PostalAddressPayload) => {
    if (!pendingMedicalAidDetails) return;
    const details: MedicalAidDetailsPayload = {
      ...pendingMedicalAidDetails,
      postalAddress,
    };
    // Keep the postal Modal open so its embedded AlertDialogHost can show
    // Confirm Request. Closing postal first races iOS Modal dismiss and the
    // confirm dialog never appears.
    setKeepRequestSheetClosed(true);
    confirmAndSubmit(details, { sheetHidden: true });
  };

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });

    // Reverse geocode new location
    const address = await reverseGeocode(latitude, longitude);
    setStreet(address.route || "Patient Location");
    setLocality(address.locality || "Current City");
    setRegion(address.administrative_area_level_1 || "Current Region");
  };

  const pickPrescriptionImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlertDialog(
        "Permission needed",
        "Please allow access to your photo library to upload a prescription.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });

    const asset = result.canceled ? null : (result.assets?.[0] ?? null);
    if (!asset) return;

    setPrescriptionFile({
      uri: asset.uri,
      name: asset.fileName || `prescription_${Date.now()}.jpg`,
      mimeType: asset.mimeType || "image/jpeg",
    });
  };

  const pickPrescriptionPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });

    const asset = result.canceled ? null : (result.assets?.[0] ?? null);
    if (!asset) return;

    const documentAsset = asset as DocumentPicker.DocumentPickerAsset & {
      fileCopyUri?: string | null;
    };

    setPrescriptionFile({
      uri: documentAsset.fileCopyUri || documentAsset.uri,
      name: asset.name || `prescription_${Date.now()}.pdf`,
      mimeType: "application/pdf",
    });
  };

  const paymentOptions = [
    { value: "cash", label: "Cash", icon: "dollar-sign" },
    { value: "wallet", label: "Wallet", icon: "credit-card" },
    {
      value: "medical_aid",
      label: "Medical Aid",
      icon: "shield",
    },
  ];
  const visiblePaymentOptions = paymentOptions.filter((option) => {
    if (option.value === "cash") return true;
    if (option.value === "medical_aid") return hasIcd10;
    return false;
  });

  const showRequestModal =
    visible && !showPostalAddressModal && !keepRequestSheetClosed;

  const selectedAidPreview = medicalAids.find(
    (aid) => aid.id === selectedMedicalAidId,
  );
  const selectedAidImageUri = selectedAidPreview?.image
    ? buildBackendAssetUrl("images", selectedAidPreview.image)
    : null;

  return (
    <>
    <Modal
      visible={showRequestModal}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={appModalBottomSheetStyles.overlay}>
          <View
            style={[
              appModalBottomSheetStyles.sheet,
              appModalBottomSheetStyles.sheetTall,
              localStyles.sheet,
            ]}
          >
            <View style={appModalBottomSheetStyles.handle} />

            <View style={localStyles.headerWrap}>
              <AppBottomSheetCloseHeader
                title="Request care"
                onClose={onClose}
              />
              <Text style={localStyles.headerSub}>
                {ailmentCategory
                  ? `${ailmentCategory} · nearby providers`
                  : "Send to nearby providers"}
              </Text>
            </View>

            <KeyboardAwareScrollView
              style={localStyles.scrollBody}
              contentContainerStyle={localStyles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              enableOnAndroid
              enableAutomaticScroll
              extraScrollHeight={KEYBOARD_AWARE_EXTRA_SCROLL}
              extraHeight={120}
            >
              <View style={localStyles.section}>
                <Text style={localStyles.label}>Ailment</Text>
                <TextInput
                  style={[
                    withIosStandaloneTextInputStyle(),
                    localStyles.inputBase,
                    localStyles.inputReadonly,
                  ]}
                  placeholder="e.g., Flu, Cold & Cough"
                  value={ailmentCategory}
                  onChangeText={setAilmentCategory}
                  editable={false}
                />
              </View>

              <View style={localStyles.section}>
                <Text style={localStyles.label}>How should we visit?</Text>
                <View style={localStyles.segmentRow}>
                  <TouchableOpacity
                    onPress={() => setConsultationMode("house_visit")}
                    disabled={isLoading}
                    style={[
                      localStyles.segment,
                      consultationMode === "house_visit" &&
                        localStyles.segmentActive,
                    ]}
                    activeOpacity={0.88}
                  >
                    <Feather
                      name="home"
                      size={16}
                      color={
                        consultationMode === "house_visit"
                          ? AUTH_COLORS.white
                          : AUTH_COLORS.textMuted
                      }
                    />
                    <Text
                      style={[
                        localStyles.segmentText,
                        consultationMode === "house_visit" &&
                          localStyles.segmentTextActive,
                      ]}
                    >
                      House visit
                    </Text>
                  </TouchableOpacity>
                  {supportsTeleconsultation && (
                    <TouchableOpacity
                      onPress={() => setConsultationMode("video_consultation")}
                      disabled={isLoading}
                      style={[
                        localStyles.segment,
                        consultationMode === "video_consultation" &&
                          localStyles.segmentActive,
                      ]}
                      activeOpacity={0.88}
                    >
                      <Feather
                        name="video"
                        size={16}
                        color={
                          consultationMode === "video_consultation"
                            ? AUTH_COLORS.white
                            : AUTH_COLORS.textMuted
                        }
                      />
                      <Text
                        style={[
                          localStyles.segmentText,
                          consultationMode === "video_consultation" &&
                            localStyles.segmentTextActive,
                        ]}
                      >
                        Video
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={localStyles.hint}>
                  {!supportsTeleconsultation
                    ? "This ailment needs an in-person house visit."
                    : consultationMode === "house_visit"
                      ? "Best for examinations and procedures at your place."
                      : "Best for follow-ups when you have a stable connection."}
                </Text>
              </View>

              <View style={localStyles.section}>
                <View style={localStyles.rowBetween}>
                  <Text style={localStyles.label}>Your location</Text>
                  <TouchableOpacity
                    onPress={() => setShowMap(!showMap)}
                    disabled={isLoading || isLoadingLocation || !markerCoord}
                    style={localStyles.textLinkBtn}
                    activeOpacity={0.85}
                  >
                    <Text style={localStyles.textLink}>
                      {showMap ? "Hide map" : "Show map"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isLoadingLocation ? (
                  <View style={localStyles.statusPanel}>
                    <ActivityIndicator color={AUTH_COLORS.green} />
                    <Text style={localStyles.statusTitle}>
                      Finding your address?
                    </Text>
                    <Text style={localStyles.statusBody}>
                      Submit unlocks once your location is ready.
                    </Text>
                  </View>
                ) : locationError ? (
                  <View style={localStyles.statusPanel}>
                    <Feather
                      name="map-pin"
                      size={22}
                      color={AUTH_COLORS.error}
                    />
                    <Text style={localStyles.statusTitle}>
                      Location unavailable
                    </Text>
                    <Text style={localStyles.statusBody}>{locationError}</Text>
                    <TouchableOpacity
                      onPress={loadLocationAndAddress}
                      disabled={isLoading}
                      style={localStyles.secondaryBtn}
                      activeOpacity={0.88}
                    >
                      <Text style={localStyles.secondaryBtnText}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                ) : showMap && mapRegion && markerCoord ? (
                  <View style={localStyles.mapWrap}>
                    <MapView
                      {...mapProviderProps}
                      region={mapRegion}
                      style={localStyles.map}
                      onLayout={(event) => {
                        logViewMountDebug(
                          "CreateRequestModal",
                          "MapView layout",
                          {
                            layout: event.nativeEvent.layout,
                            mapRegion,
                            markerCoord,
                          },
                        );
                      }}
                      onMapReady={() => {
                        logViewMountDebug(
                          "CreateRequestModal",
                          "MapView ready",
                          {
                            mapRegion,
                            markerCoord,
                          },
                        );
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                    >
                      <Marker coordinate={markerCoord} />
                    </MapView>
                  </View>
                ) : isLocationReady ? (
                  <View style={localStyles.locationReadyRow}>
                    <Feather
                      name="check"
                      size={14}
                      color={AUTH_COLORS.green}
                    />
                    <Text style={localStyles.locationReadyText}>
                      Address detected from your current location
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={localStyles.section}>
                <Text style={localStyles.label}>Street</Text>
                <TextInput
                  style={[
                    withIosStandaloneTextInputStyle(),
                    localStyles.inputBase,
                    localStyles.inputReadonly,
                  ]}
                  placeholder="Street address"
                  value={street}
                  onChangeText={setStreet}
                  editable={false}
                />
              </View>

              <View style={localStyles.section}>
                <Text style={localStyles.label}>City / locality</Text>
                <TextInput
                  style={[
                    withIosStandaloneTextInputStyle(),
                    localStyles.inputBase,
                    localStyles.inputReadonly,
                  ]}
                  placeholder="City"
                  value={locality}
                  onChangeText={setLocality}
                  editable={false}
                />
              </View>

              <View style={localStyles.section}>
                <Text style={localStyles.label}>Region</Text>
                <TextInput
                  style={[
                    withIosStandaloneTextInputStyle(),
                    localStyles.inputBase,
                    localStyles.inputReadonly,
                  ]}
                  placeholder="Region"
                  value={region}
                  onChangeText={setRegion}
                  editable={false}
                />
              </View>

              <View style={localStyles.priceBlock}>
                <Text style={localStyles.priceLabel}>Consultation cost</Text>
                <Text style={localStyles.priceValue}>
                  N${isNaN(selectedCost) ? "0.00" : selectedCost.toFixed(2)}
                </Text>
              </View>

              {isPharmacyRequest && (
                <View style={localStyles.section}>
                  <Text style={localStyles.label}>Prescription</Text>
                  <Text style={localStyles.hint}>
                    Upload a clear photo or PDF before submitting.
                  </Text>

                  {prescriptionFile ? (
                    <View style={localStyles.fileRow}>
                      <Feather
                        name={
                          prescriptionFile.mimeType === "application/pdf"
                            ? "file-text"
                            : "image"
                        }
                        size={16}
                        color={AUTH_COLORS.green}
                      />
                      <Text style={localStyles.fileName} numberOfLines={1}>
                        {prescriptionFile.name}
                      </Text>
                      <Feather
                        name="check"
                        size={14}
                        color={AUTH_COLORS.green}
                      />
                    </View>
                  ) : null}

                  <View style={localStyles.segmentRow}>
                    <TouchableOpacity
                      onPress={pickPrescriptionImage}
                      disabled={isLoading}
                      style={localStyles.uploadBtn}
                      activeOpacity={0.88}
                    >
                      <Feather
                        name="image"
                        size={15}
                        color={AUTH_COLORS.textDark}
                      />
                      <Text style={localStyles.uploadBtnText}>
                        {prescriptionFile ? "Replace image" : "Image"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickPrescriptionPdf}
                      disabled={isLoading}
                      style={localStyles.uploadBtn}
                      activeOpacity={0.88}
                    >
                      <Feather
                        name="file-text"
                        size={15}
                        color={AUTH_COLORS.textDark}
                      />
                      <Text style={localStyles.uploadBtnText}>
                        {prescriptionFile ? "Replace PDF" : "PDF"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={localStyles.section}>
                <Text style={localStyles.label}>Payment</Text>
                <View style={localStyles.paymentList}>
                  {visiblePaymentOptions.map((option) => {
                    const selected = paymentMethod === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() =>
                          setPaymentMethod(option.value as PaymentMethod)
                        }
                        disabled={isLoading}
                        style={[
                          localStyles.paymentRow,
                          selected && localStyles.paymentRowActive,
                        ]}
                        activeOpacity={0.88}
                      >
                        <View
                          style={[
                            localStyles.paymentIcon,
                            selected && localStyles.paymentIconActive,
                          ]}
                        >
                          <Feather
                            name={option.icon as any}
                            size={16}
                            color={
                              selected
                                ? AUTH_COLORS.white
                                : AUTH_COLORS.textMuted
                            }
                          />
                        </View>
                        <Text
                          style={[
                            localStyles.paymentLabel,
                            selected && localStyles.paymentLabelActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                        <View
                          style={[
                            localStyles.radio,
                            selected && localStyles.radioActive,
                          ]}
                        >
                          {selected ? (
                            <View style={localStyles.radioDot} />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {consultationMode === "video_consultation" &&
                  paymentMethod === "cash" && (
                    <Text style={localStyles.hint}>
                      After a provider accepts, you&apos;ll get their number and
                      payment steps before the call unlocks.
                    </Text>
                  )}
              </View>

              {paymentMethod === "medical_aid" && (
                <View style={localStyles.section}>
                  <Text style={localStyles.label}>Medical aid</Text>
                  <Text style={localStyles.hint}>
                    Details first, then postal address, then confirm cost.
                  </Text>

                  {isLoadingMedicalAids ? (
                    <View style={localStyles.inlineLoader}>
                      <ActivityIndicator color={AUTH_COLORS.green} />
                    </View>
                  ) : medicalAids.length === 0 ? (
                    <Text style={localStyles.hint}>
                      No medical aids available.
                    </Text>
                  ) : (
                    <View style={localStyles.aidRow}>
                      {selectedAidImageUri ? (
                        <Image
                          source={{ uri: selectedAidImageUri }}
                          style={localStyles.aidThumb}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={localStyles.aidThumbPlaceholder}>
                          <Feather
                            name="shield"
                            size={18}
                            color={AUTH_COLORS.textMuted}
                          />
                        </View>
                      )}
                      <View style={localStyles.aidPicker}>
                        <PickerField
                          value={selectedMedicalAidId || null}
                          onValueChange={(value) =>
                            setSelectedMedicalAidId(value || "")
                          }
                          placeholder="Select medical aid"
                          items={medicalAids.map((aid) => ({
                            label: aid.title,
                            value: aid.id,
                          }))}
                          disabled={isLoading}
                        />
                      </View>
                    </View>
                  )}

                  <Text style={[localStyles.label, localStyles.labelSpaced]}>
                    Medical aid number
                  </Text>
                  <TextInput
                    style={[
                      withIosStandaloneTextInputStyle(),
                      localStyles.inputBase,
                      localStyles.inputEditable,
                    ]}
                    placeholder="Enter medical aid number"
                    value={membershipNumber}
                    onChangeText={setMembershipNumber}
                    editable={!isLoading}
                    autoCapitalize="characters"
                  />

                  <Text style={[localStyles.label, localStyles.labelSpaced]}>
                    Main member name
                  </Text>
                  <TextInput
                    style={[
                      withIosStandaloneTextInputStyle(),
                      localStyles.inputBase,
                      localStyles.inputEditable,
                    ]}
                    placeholder="Enter main member name"
                    value={mainMemberName}
                    onChangeText={setMainMemberName}
                    editable={!isLoading}
                  />

                  <Text style={[localStyles.label, localStyles.labelSpaced]}>
                    Main member ID
                  </Text>
                  <TextInput
                    style={[
                      withIosStandaloneTextInputStyle(),
                      localStyles.inputBase,
                      localStyles.inputEditable,
                    ]}
                    placeholder="Enter main member ID"
                    value={mainMemberId}
                    onChangeText={setMainMemberId}
                    editable={!isLoading}
                    autoCapitalize="characters"
                  />

                  <Text style={[localStyles.label, localStyles.labelSpaced]}>
                    Patient residential address
                  </Text>
                  <TextInput
                    style={[
                      withIosMultilineTextInputStyle(),
                      localStyles.inputBase,
                      localStyles.inputEditable,
                      localStyles.inputMultiline,
                    ]}
                    placeholder="Enter residential address"
                    value={residentialAddress}
                    onChangeText={setResidentialAddress}
                    editable={!isLoading}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  <Text style={localStyles.hint}>
                    Next you&apos;ll confirm your Namibian postal address for
                    the claim.
                  </Text>
                </View>
              )}

              <View style={localStyles.footerNote}>
                <Feather
                  name="info"
                  size={15}
                  color={AUTH_COLORS.green}
                  style={localStyles.footerNoteIcon}
                />
                <Text style={localStyles.footerNoteText}>
                  Nearby providers only see your location after they accept.
                  Requests expire in 3 hours if nobody takes them.
                </Text>
              </View>
            </KeyboardAwareScrollView>

            <View style={[appModalBottomSheetStyles.footer, localStyles.footer]}>
              {isLoadingLocation ? (
                <Text style={localStyles.footerHint}>
                  Detecting location ? submit stays locked for now.
                </Text>
              ) : locationError ? (
                <Text style={[localStyles.footerHint, localStyles.footerHintError]}>
                  Fix location above to continue.
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={[
                  localStyles.submitBtn,
                  !canSubmit && localStyles.submitBtnDisabled,
                ]}
                activeOpacity={0.88}
              >
                {isLoading ? (
                  <ActivityIndicator color={AUTH_COLORS.white} />
                ) : isLoadingLocation ? (
                  <>
                    <ActivityIndicator color={AUTH_COLORS.white} size="small" />
                    <Text style={localStyles.submitBtnText}>
                      Getting location?
                    </Text>
                  </>
                ) : locationError || !markerCoord ? (
                  <Text
                    style={[
                      localStyles.submitBtnText,
                      localStyles.submitBtnTextMuted,
                    ]}
                  >
                    Waiting for location
                  </Text>
                ) : (
                  <Text style={localStyles.submitBtnText}>Submit request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <AlertDialogHost active={showRequestModal} embedded />
    </Modal>

    {/* When the sheet is hidden for confirm/submit, host alerts in a Modal so
        they are not lost behind native screens or a closed sheet. */}
    <AlertDialogHost
      active={visible && !showRequestModal && !showPostalAddressModal}
    />

    <PostalAddressConfirmModal
      visible={visible && showPostalAddressModal}
      onClose={reopenRequestSheet}
      defaultAddressee={mainMemberName.trim() || user?.fullname || ""}
      onConfirmed={handlePostalAddressConfirmed}
    />
    </>
  );
}

const localStyles = StyleSheet.create({
  sheet: {
    backgroundColor: AUTH_COLORS.bg,
  },
  headerWrap: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
  },
  headerSub: {
    marginTop: -10,
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  section: {
    marginBottom: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: AUTH_COLORS.textDark,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  labelSpaced: {
    marginTop: 16,
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: AUTH_COLORS.textMuted,
  },
  inputBase: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingLeft: 18,
    paddingVertical: 14,
    minHeight: 54,
    fontSize: 16,
    lineHeight: 22,
  },
  inputReadonly: {
    backgroundColor: "#F0FDF4",
    borderColor: AUTH_COLORS.inputBorder,
    color: AUTH_COLORS.textDark,
  },
  inputEditable: {
    backgroundColor: AUTH_COLORS.white,
    borderColor: AUTH_COLORS.inputBorder,
    color: AUTH_COLORS.textDark,
    shadowColor: "#14532D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  inputMultiline: {
    minHeight: 104,
    paddingTop: 14,
    paddingBottom: 14,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  segmentActive: {
    backgroundColor: AUTH_COLORS.green,
    borderColor: AUTH_COLORS.green,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
  },
  segmentTextActive: {
    color: AUTH_COLORS.white,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  textLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  textLink: {
    fontSize: 13,
    fontWeight: "700",
    color: AUTH_COLORS.green,
  },
  statusPanel: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 140,
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    textAlign: "center",
  },
  statusBody: {
    fontSize: 13,
    lineHeight: 19,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
  },
  secondaryBtn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: AUTH_COLORS.green,
  },
  secondaryBtnText: {
    color: AUTH_COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
  mapWrap: {
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  map: {
    flex: 1,
    width: "100%",
    minHeight: 200,
  },
  locationReadyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  locationReadyText: {
    flex: 1,
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
  },
  priceBlock: {
    marginBottom: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.5,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: AUTH_COLORS.textDark,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  paymentList: {
    gap: 8,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  paymentRowActive: {
    borderColor: AUTH_COLORS.green,
    backgroundColor: "rgba(22, 163, 74, 0.06)",
  },
  paymentIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  paymentIconActive: {
    backgroundColor: AUTH_COLORS.green,
  },
  paymentLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
  },
  paymentLabelActive: {
    color: AUTH_COLORS.textDark,
    fontWeight: "700",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: AUTH_COLORS.green,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AUTH_COLORS.green,
  },
  aidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aidThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  aidThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  aidPicker: {
    flex: 1,
  },
  inlineLoader: {
    paddingVertical: 12,
    alignItems: "center",
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  footerNoteIcon: {
    marginTop: 1,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: AUTH_COLORS.textMuted,
  },
  footer: {
    gap: 8,
  },
  footerHint: {
    fontSize: 13,
    textAlign: "center",
    color: AUTH_COLORS.textMuted,
    marginBottom: 4,
  },
  footerHintError: {
    color: AUTH_COLORS.error,
  },
  submitBtn: {
    backgroundColor: AUTH_COLORS.green,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },
  submitBtnText: {
    color: AUTH_COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },
  submitBtnTextMuted: {
    color: AUTH_COLORS.textMuted,
  },
});
