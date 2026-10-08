import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { iosPasswordToggleButtonStyle, withIosMultilineTextInputStyle, withIosStandalonePasswordTextInputStyle, withIosStandaloneTextInputStyle } from "../../../lib/iosInputStyles";
import { AppTextInput as TextInput } from "../../../components/AppTextInput";
import { ActivityIndicator, Alert, Image, Linking, Modal, Platform, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { PickerField } from "../../../components/PickerField";
import RegistrationFeatureShell, {
  ProfileSectionRail,
  RegistrationStepActions,
  profileFeatureStyles,
} from "../../../components/RegistrationFeatureShell";
import TermsConditionsModal from "../../../components/TermsConditionsModal";
import { AUTH_COLORS, authScreenStyles } from "../../../lib/authScreenTheme";
import { namibianRegions } from "../../../constants/locations";
import apiClient from "../../../lib/api";
import { ensureForegroundLocationPermission } from "../../../lib/locationPermission";

const PHARMACIST_STEP_META = [
  {
    title: "Account",
    subtitle: "Create your login and verify your identity.",
  },
  {
    title: "Documents",
    subtitle: "Upload your photo and qualification certificates.",
  },
  {
    title: "Professional",
    subtitle: "Tell patients about your practice and expertise.",
  },
  {
    title: "Pharmacy",
    subtitle: "Complete the pharmacy-specific registration details.",
  },
  {
    title: "Review",
    subtitle: "Confirm your details before submitting.",
  },
] as const;

const STANDARD_PROVIDER_STEP_META = [
  {
    title: "Account",
    subtitle: "Create your login and verify your identity.",
  },
  {
    title: "Documents",
    subtitle: "Upload your photo and qualification certificates.",
  },
  {
    title: "Professional",
    subtitle: "Tell patients about your practice and expertise.",
  },
  {
    title: "Review",
    subtitle: "Confirm your details before submitting.",
  },
] as const;

const regStyles = StyleSheet.create({
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
    marginTop: 10,
  },
  readOnlyValue: {
    fontSize: 16,
    color: AUTH_COLORS.textDark,
    paddingVertical: 8,
  },
  dateText: {
    fontSize: 16,
    color: AUTH_COLORS.textDark,
  },
  locationBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  locationText: {
    fontSize: 15,
    fontWeight: "600",
    color: AUTH_COLORS.textDark,
  },
  termsBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  termsBoxError: {
    borderColor: "#EF4444",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: AUTH_COLORS.green,
    borderColor: AUTH_COLORS.green,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textDark,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: AUTH_COLORS.greenSoft,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentItemActive: {
    backgroundColor: AUTH_COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
  },
  segmentTextActive: {
    color: AUTH_COLORS.textDark,
    fontWeight: "700",
  },
  iosPickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iosPickerBackdrop: {
    flex: 1,
  },
  iosPickerSheet: {
    backgroundColor: AUTH_COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderBottomWidth: 0,
  },
  iosPickerToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AUTH_COLORS.inputBorder,
  },
  iosPickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  iosPickerCancel: {
    fontSize: 16,
    color: AUTH_COLORS.textMuted,
    fontWeight: "600",
  },
  iosPickerDone: {
    fontSize: 16,
    color: AUTH_COLORS.green,
    fontWeight: "700",
  },
  iosPicker: {
    height: 216,
    alignSelf: "stretch",
  },
});

const fieldInputStyle = (hasError: boolean) =>
  withIosStandaloneTextInputStyle([
    profileFeatureStyles.input,
    hasError ? regStyles.inputError : undefined,
  ]);

const fieldMultilineStyle = (hasError: boolean) =>
  withIosMultilineTextInputStyle([
    profileFeatureStyles.input,
    { minHeight: 96 },
    hasError ? regStyles.inputError : undefined,
  ]);

const FieldBlock = ({
  label,
  error,
  last = false,
  children,
}: {
  label: string;
  error?: string;
  last?: boolean;
  children: React.ReactNode;
}) => (
  <View
    style={[
      profileFeatureStyles.fieldBlock,
      last ? profileFeatureStyles.fieldBlockLast : null,
    ]}
  >
    <Text style={profileFeatureStyles.label}>{label}</Text>
    {children}
    {error ? <Text style={regStyles.errorText}>{error}</Text> : null}
  </View>
);

// --- Type Definitions ---
type PickedImage = ImagePicker.ImagePickerAsset | null;
type DocFile = DocumentPicker.DocumentPickerAsset | null;
type Step = 1 | 2 | 3 | 4 | 5;

interface Specialization {
  _id: string;
  title: string;
  role: string;
  description?: string;
}

// --- Helper Functions for File Handling ---
const getExt = (file?: PickedImage | DocFile | null) => {
  const name = (file as any)?.name || (file as any)?.fileName || "";
  const match = /\.[A-Za-z0-9]+$/.exec(name);
  return match ? match[0].replace(".", "").toUpperCase() : "";
};

const isImageAsset = (file?: PickedImage | DocFile | null) => {
  if (!file) return false;
  const mime = (file as any)?.mimeType || (file as any)?.type || "";
  const name = (file as any)?.name || (file as any)?.fileName || "";
  return (
    (typeof mime === "string" && mime.startsWith("image/")) ||
    /\.(png|jpe?g|gif|bmp|webp|heic)$/i.test(name)
  );
};

const openFile = async (file?: PickedImage | DocFile | null) => {
  try {
    const uri = (file as any)?.uri;
    if (!uri) return;
    await Linking.openURL(uri);
  } catch {
    Alert.alert("Cannot open file", "Please try again or re-upload the file.");
  }
};

// --- Password validation helper ---
function validatePassword(password: string): {
  valid: boolean;
  message: string;
} {
  if (!password) {
    return { valid: false, message: "Password is required." };
  }

  const minLength = 8;
  const uppercase = /[A-Z]/;
  const lowercase = /[a-z]/;
  const number = /[0-9]/;
  const specialChar = /[!@#$%^&*(),.?":{}|<>]/;

  if (password.length < minLength) {
    return {
      valid: false,
      message: `Password must be at least ${minLength} characters long.`,
    };
  }

  if (!uppercase.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter.",
    };
  }

  if (!lowercase.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one lowercase letter.",
    };
  }

  if (!number.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number.",
    };
  }

  if (!specialChar.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one special character.",
    };
  }

  return { valid: true, message: "Password is strong." };
}

// --- Reusable UI Components ---
const UploadBox = ({
  label,
  file,
  onPick,
  icon,
  error,
  isImage = false,
}: {
  label: string;
  file: PickedImage | DocFile;
  onPick: () => void;
  icon: React.ComponentProps<typeof Feather>["name"];
  error?: string;
  isImage?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPick}
    activeOpacity={0.85}
    className={`border rounded-xl items-center justify-center h-32 flex-1 overflow-hidden ${
      error ? "border-red-400" : "border-[#BBF7D0]"
    }`}
    style={{ backgroundColor: "rgba(187, 247, 208, 0.35)" }}
  >
    {file ? (
      <>
        {isImage && (file as PickedImage)?.uri ? (
          <Image
            source={{ uri: (file as PickedImage)!.uri }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="items-center justify-center p-2 w-full h-full">
            <Feather name="check-circle" size={32} color={AUTH_COLORS.green} />
            <Text
              className="text-secondary font-semibold mt-2 text-center"
              numberOfLines={2}
            >
              {(file as any)?.name ||
                (file as any)?.fileName ||
                "Selected file"}
            </Text>
          </View>
        )}
      </>
    ) : (
      <View className="items-center justify-center w-full h-full">
        <Feather name={icon} size={32} color={AUTH_COLORS.textMuted} />
        <Text className="text-[#14532D] font-semibold mt-2 text-center">
          {label}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

const ReviewRow = ({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) => (
  <View className="mb-3">
    <Text className="text-sm text-[#4B5563]">{label}</Text>
    <Text className="text-base text-[#14532D] font-semibold">
      {String(value ?? "Not provided")}
    </Text>
  </View>
);

// --- Document Row Component for Review ---
const DocRow = ({
  label,
  file,
  showOpen = false,
}: {
  label: string;
  file?: PickedImage | DocFile | null;
  showOpen?: boolean;
}) => {
  const image = isImageAsset(file);
  return (
    <View className="flex-row items-center py-3">
      {/* Left: thumbnail or file icon */}
      {file ? (
        image ? (
          <Image
            source={{ uri: (file as any)?.uri }}
            className="w-12 h-12 rounded-lg mr-3"
            resizeMode="cover"
          />
        ) : (
          <View className="w-12 h-12 rounded-lg mr-3 border border-[#BBF7D0] items-center justify-center overflow-hidden" style={{ backgroundColor: "rgba(187, 247, 208, 0.35)" }}>
            <Feather name="file-text" size={20} color={AUTH_COLORS.textMuted} />
            <Text className="text-[9px] mt-0.5 text-[#4B5563]">
              {getExt(file) || "FILE"}
            </Text>
          </View>
        )
      ) : (
        <View className="w-12 h-12 rounded-lg mr-3 border border-[#BBF7D0] items-center justify-center" style={{ backgroundColor: "rgba(187, 247, 208, 0.35)" }}>
          <Feather name="upload" size={18} color={AUTH_COLORS.textMuted} />
        </View>
      )}

      {/* Middle: labels */}
      <View className="flex-1">
        <Text className="text-[#14532D] font-medium">{label}</Text>
        <Text className="text-[#4B5563] text-xs" numberOfLines={1}>
          {file
            ? (file as any)?.name ||
              (file as any)?.fileName ||
              (file as any)?.uri
            : "Not uploaded"}
        </Text>
      </View>

      {/* Right: action */}
      {showOpen && file ? (
        <TouchableOpacity onPress={() => openFile(file)}>
          <Text className="text-[#16A34A] font-semibold">Open</Text>
        </TouchableOpacity>
      ) : file ? (
        <Feather name="check-circle" size={20} color={AUTH_COLORS.green} />
      ) : (
        <Text className="text-gray-400 text-xs">—</Text>
      )}
    </View>
  );
};

export default function ProviderRegistrationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const providerType = String(params?.providerType ?? "").toLowerCase();
  const isPharmacist = providerType === "pharmacist";
  const totalSteps = isPharmacist ? 5 : 4;
  const reviewStep = totalSteps;
  const providerStepMeta = isPharmacist
    ? PHARMACIST_STEP_META
    : STANDARD_PROVIDER_STEP_META;
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isDetectingPharmacyLocation, setIsDetectingPharmacyLocation] =
    useState(false);
  const [expirationDate, setExpirationDate] = useState<Date>(new Date());
  const iosExpiryBeforeEdit = useRef<Date | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // Specializations from API
  const [allSpecializations, setAllSpecializations] = useState<
    Specialization[]
  >([]);
  const [filteredSpecializations, setFilteredSpecializations] = useState<
    Specialization[]
  >([]);
  const [loadingSpecializations, setLoadingSpecializations] = useState(true);

  // --- State Management for Form Data ---
  const [accountInfo, setAccountInfo] = useState({
    fullname: "",
    email: "",
    cellphoneNumber: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
    nationalId: "",
    gender: "",
  });

  const [showTermsModal, setShowTermsModal] = useState(false);

  const [documents, setDocuments] = useState({
    profileImage: null as PickedImage,
    idDocumentFront: null as DocFile,
    idDocumentBack: null as DocFile,
    // NOTE: For pharmacists this is the Bachelor certificate (backend expects `finalQualification`)
    finalQualification: null as DocFile,
    HPCNAQualification: null as DocFile,
    dispensingCertificateLicence: null as DocFile,
    // Pharmacist-specific documents (match backend upload.fields names)
    trainingCertificate: null as DocFile,
    NQAEvaluation: null as DocFile,
  });

  const [qualificationOrigin, setQualificationOrigin] = useState<
    "namibia" | "foreign"
  >("namibia");

  const [professionalDetails, setProfessionalDetails] = useState({
    governingCouncil: "Health Professionals Council of Namibia",
    hpcnaNumber: "",
    bio: "",
    specializations: [] as string[],
    yearsOfExperience: "",
    operationalZone: "",
    address: "",
  });

  const [pharmacyDetails, setPharmacyDetails] = useState({
    registeredTradingName: "",
    companyRegistrationNo: "",
    businessEmail: "",
    pharmacyCouncilNo: "",
    practiceNumber: "",
    gpsLatitude: "",
    gpsLongitude: "",
    gpsAddress: "",
    settlementCellNumber: "",
    hpcnaLicenseExpiryAcknowledged: false,
  });

  const [docErrors, setDocErrors] = useState<{
    profileImage?: string;
    finalQualification?: string;
    HPCNAQualification?: string;
    idDocumentFront?: string;
    idDocumentBack?: string;
    trainingCertificate?: string;
    NQAEvaluation?: string;
  }>({});

  const [accountErrors, setAccountErrors] = useState<{
    fullname?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    nationalId?: string;
    gender?: string;
    terms?: string;
  }>({});

  const [profErrors, setProfErrors] = useState<{
    specializations?: string;
    hpcnaNumber?: string;
    yearsOfExperience?: string;
    operationalZone?: string;
    bio?: string;
    address?: string;
  }>({});

  const [pharmacyErrors, setPharmacyErrors] = useState<{
    registeredTradingName?: string;
    businessEmail?: string;
    pharmacyCouncilNo?: string;
    practiceNumber?: string;
    hpcnaLicenseExpiryAcknowledged?: string;
  }>({});

  // Pre-fill phone number from previous screen
  useEffect(() => {
    if (params.cellphoneNumber && typeof params.cellphoneNumber === "string") {
      setAccountInfo((prev) => ({
        ...prev,
        cellphoneNumber: params.cellphoneNumber as string,
      }));
    }
  }, [params.cellphoneNumber]);

  // Auto-hide disclaimer after 30 seconds
  useEffect(() => {
    if (showDisclaimer) {
      const timer = setTimeout(() => {
        setShowDisclaimer(false);
      }, 30000); // 30 seconds

      return () => clearTimeout(timer);
    }
  }, [showDisclaimer]);

  // Set up callback for terms and conditions acceptance
  useEffect(() => {
    global.acceptProviderTermsCallback = (accepted: boolean) => {
      setAccountInfo((p) => ({ ...p, agreeToTerms: accepted }));
    };

    return () => {
      delete global.acceptProviderTermsCallback;
    };
  }, []);

  // Fetch specializations from API
  useEffect(() => {
    const fetchSpecializations = async () => {
      try {
        setLoadingSpecializations(true);
        const response = await apiClient.get(
          "/app/specialization/all-specializations",
        );

        // backend: res.status(200).json({ specializations })
        const list = response?.data?.specializations;
        if (Array.isArray(list)) {
          setAllSpecializations(list as Specialization[]);
        } else {
          setAllSpecializations([]);
        }
      } catch (error) {
        console.error("Error fetching specializations:", error);
        Alert.alert(
          "Error",
          "Failed to load specializations. Please try again.",
        );
        setAllSpecializations([]);
      } finally {
        setLoadingSpecializations(false);
      }
    };

    fetchSpecializations();
  }, []);

  // Filter specializations based on provider type
  useEffect(() => {
    if (!allSpecializations.length) {
      setFilteredSpecializations([]);
      return;
    }

    if (!params.providerType) {
      setFilteredSpecializations(allSpecializations);
      return;
    }

    const providerType = String(params.providerType).toLowerCase();

    const filtered = allSpecializations.filter(
      (spec) =>
        typeof spec.role === "string" &&
        spec.role.toLowerCase() === providerType,
    );

    setFilteredSpecializations(filtered);
  }, [allSpecializations, params.providerType]);

  // --- Picker Handlers ---
  const pickImage = async (field: keyof typeof documents) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert(
        "Permission Denied",
        "We need camera roll permissions to select an image.",
      );
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      setDocuments((prev) => ({ ...prev, [field]: result.assets[0] }));
      // Clear error for this field when image is selected
      if (field === "profileImage" && docErrors.profileImage) {
        setDocErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.profileImage;
          return newErrors;
        });
      }
    }
  };

  const pickDocument = async (field: keyof typeof documents) => {
    // For ID documents, use ImagePicker instead of DocumentPicker
    if (field === "idDocumentFront" || field === "idDocumentBack") {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        return Alert.alert(
          "Permission Denied",
          "We need camera roll permissions to select an image.",
        );
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled) {
        setDocuments((prev) => ({ ...prev, [field]: result.assets[0] as any }));
        // Clear error for this field when document is selected
        if (field === "idDocumentFront" && docErrors.idDocumentFront) {
          setDocErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.idDocumentFront;
            return newErrors;
          });
        }
        if (field === "idDocumentBack" && docErrors.idDocumentBack) {
          setDocErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.idDocumentBack;
            return newErrors;
          });
        }
      }
    } else {
      // For final qualification, HPCNA qualification, and dispensing license, use DocumentPicker with PDF only
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length) {
        setDocuments((prev) => ({ ...prev, [field]: result.assets[0] as any }));
        // Clear error for this field when document is selected
        if (field === "finalQualification" && docErrors.finalQualification) {
          setDocErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.finalQualification;
            return newErrors;
          });
        }
        if (field === "HPCNAQualification" && docErrors.HPCNAQualification) {
          setDocErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.HPCNAQualification;
            return newErrors;
          });
        }
      }
    }
  };

  // --- date change ---
  const onExpirationDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event?.type === "dismissed") return;
    if (selectedDate) {
      setExpirationDate(selectedDate);
    }
  };

  const openExpirationPicker = () => {
    iosExpiryBeforeEdit.current = expirationDate;
    setShowDatePicker(true);
  };

  const confirmIosExpirationDate = () => setShowDatePicker(false);

  const cancelIosExpirationDate = () => {
    if (iosExpiryBeforeEdit.current) {
      setExpirationDate(iosExpiryBeforeEdit.current);
    }
    setShowDatePicker(false);
  };

  // --- specialization toggle ---
  const toggleSpecialization = (specTitle: string) => {
    setProfessionalDetails((prev) => {
      const already = prev.specializations.includes(specTitle);
      return {
        ...prev,
        specializations: already
          ? prev.specializations.filter((s) => s !== specTitle)
          : [...prev.specializations, specTitle],
      };
    });
    // Clear error when user selects a specialization
    if (profErrors.specializations) {
      setProfErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.specializations;
        return newErrors;
      });
    }
  };

  const setPharmacyDetail = (
    key: keyof typeof pharmacyDetails,
    value: string | boolean,
  ) => {
    setPharmacyDetails((prev) => ({ ...prev, [key]: value }));
    setPharmacyErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const detectPharmacyLocation = async () => {
    try {
      setIsDetectingPharmacyLocation(true);
      const { granted } = await ensureForegroundLocationPermission({
        requestIfNeeded: true,
      });
      if (!granted) {
        Alert.alert(
          "Permission needed",
          "Location permission is required to detect your pharmacy location.",
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;
      let gpsAddress = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        gpsAddress = [geo?.name, geo?.street, geo?.city, geo?.region]
          .filter(Boolean)
          .join(", ") || gpsAddress;
      } catch {
        // Coordinates are enough for dispatch even if reverse-geocoding fails.
      }

      setPharmacyDetails((prev) => ({
        ...prev,
        gpsLatitude: latitude.toFixed(6),
        gpsLongitude: longitude.toFixed(6),
        gpsAddress,
      }));
    } catch (error) {
      Alert.alert("Location Error", "Could not detect your location.");
    } finally {
      setIsDetectingPharmacyLocation(false);
    }
  };

  // --- Navigation Logic ---
  const handleNext = () => {
    // Step 1: basic account info + strong password rules + ID documents
    if (step === 1) {
      const newErrors: {
        [key: string]: string;
      } = {};

      if (!accountInfo.fullname) newErrors.fullname = "Full name is required";
      if (!accountInfo.email) newErrors.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountInfo.email))
        newErrors.email = "Please enter a valid email address";
      if (!accountInfo.password) newErrors.password = "Password is required";
      else {
        const check = validatePassword(accountInfo.password);
        if (!check.valid) newErrors.password = check.message;
      }
      if (!accountInfo.confirmPassword)
        newErrors.confirmPassword = "Please confirm your password";
      else if (accountInfo.password !== accountInfo.confirmPassword)
        newErrors.confirmPassword = "Passwords do not match";
      if (!accountInfo.nationalId.trim())
        newErrors.nationalId = "National ID is required";
      else if (!/^\d{11}$/.test(accountInfo.nationalId))
        newErrors.nationalId =
          "National ID must be exactly 11 numeric characters";
      if (!accountInfo.gender) newErrors.gender = "Please select your gender";
      if (!documents.idDocumentFront)
        newErrors.idDocumentFront = "Please upload the front of your ID";
      if (!documents.idDocumentBack)
        newErrors.idDocumentBack = "Please upload the back of your ID";
      if (!accountInfo.agreeToTerms)
        newErrors.terms =
          "You must read and accept the Terms and Conditions to continue";

      if (Object.keys(newErrors).length > 0) {
        // Set account errors
        const accountErrors: { [key: string]: string } = {};
        if (newErrors.fullname) accountErrors.fullname = newErrors.fullname;
        if (newErrors.email) accountErrors.email = newErrors.email;
        if (newErrors.password) accountErrors.password = newErrors.password;
        if (newErrors.confirmPassword)
          accountErrors.confirmPassword = newErrors.confirmPassword;
        if (newErrors.nationalId)
          accountErrors.nationalId = newErrors.nationalId;
        if (newErrors.gender) accountErrors.gender = newErrors.gender;
        if (newErrors.terms) accountErrors.terms = newErrors.terms;

        // Set document errors
        const newDocErrors: {
          profileImage?: string;
          finalQualification?: string;
          HPCNAQualification?: string;
          idDocumentFront?: string;
          idDocumentBack?: string;
        } = {};
        if (newErrors.idDocumentFront)
          newDocErrors.idDocumentFront = newErrors.idDocumentFront;
        if (newErrors.idDocumentBack)
          newDocErrors.idDocumentBack = newErrors.idDocumentBack;

        setDocErrors(newDocErrors);
        setAccountErrors(accountErrors);
        return;
      }
    }

    // Step 2: validate required documents before allowing Next
    if (step === 2) {
      const newDocErrors: {
        profileImage?: string;
        finalQualification?: string;
        HPCNAQualification?: string;
        trainingCertificate?: string;
        NQAEvaluation?: string;
      } = {};

      if (!documents.profileImage) {
        newDocErrors.profileImage = "Profile photo is required.";
      }
      if (isPharmacist) {
        if (!documents.finalQualification) {
          newDocErrors.finalQualification = "Bachelor certificate is required.";
        }
        if (!documents.trainingCertificate) {
          newDocErrors.trainingCertificate =
            "Practicing training certificate is required.";
        }
        if (!documents.HPCNAQualification) {
          newDocErrors.HPCNAQualification = "HPCNA certificate is required.";
        }
        if (qualificationOrigin === "foreign" && !documents.NQAEvaluation) {
          newDocErrors.NQAEvaluation =
            "NQA evaluation is required for foreign qualifications.";
        }
      } else {
        if (!documents.finalQualification) {
          newDocErrors.finalQualification =
            "Final qualification document is required.";
        }
        if (!documents.HPCNAQualification) {
          newDocErrors.HPCNAQualification =
            "HPCNA practicing certificate is required.";
        }
      }

      setDocErrors(newDocErrors);

      if (Object.keys(newDocErrors).length > 0) {
        // Do not advance if there are errors
        return;
      }
    } else if (step === 3) {
      // Validate professional details on step 3 before allowing Next
      const newProfErrors: {
        specializations?: string;
        hpcnaNumber?: string;
        yearsOfExperience?: string;
        operationalZone?: string;
        bio?: string;
        address?: string;
      } = {};

      if (!professionalDetails.specializations.length) {
        newProfErrors.specializations =
          "Please select at least one specialization.";
      }
      if (!professionalDetails.hpcnaNumber.trim()) {
        newProfErrors.hpcnaNumber = "HPCNA Registration Number is required.";
      }
      if (!professionalDetails.yearsOfExperience.trim()) {
        newProfErrors.yearsOfExperience = "Years of experience is required.";
      }
      if (!professionalDetails.address.trim()) {
        newProfErrors.address = "Practice address is required.";
      }
      if (!professionalDetails.operationalZone.trim()) {
        newProfErrors.operationalZone = "Operational zone is required.";
      }
      if (!professionalDetails.bio.trim()) {
        newProfErrors.bio = "Professional bio is required.";
      }

      setProfErrors(newProfErrors);

      if (Object.keys(newProfErrors).length > 0) {
        return;
      }
    } else if (isPharmacist && step === 4) {
      const newPharmacyErrors: {
        registeredTradingName?: string;
        businessEmail?: string;
        pharmacyCouncilNo?: string;
        practiceNumber?: string;
        hpcnaLicenseExpiryAcknowledged?: string;
      } = {};

      if (!pharmacyDetails.registeredTradingName.trim()) {
        newPharmacyErrors.registeredTradingName =
          "Registered trading name is required.";
      }
      if (
        pharmacyDetails.businessEmail.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          pharmacyDetails.businessEmail.trim(),
        )
      ) {
        newPharmacyErrors.businessEmail =
          "Please enter a valid business email address.";
      }
      if (!pharmacyDetails.pharmacyCouncilNo.trim()) {
        newPharmacyErrors.pharmacyCouncilNo =
          "Pharmacy Council number is required.";
      }
      if (!pharmacyDetails.practiceNumber.trim()) {
        newPharmacyErrors.practiceNumber = "Practice number is required.";
      }
      if (!pharmacyDetails.hpcnaLicenseExpiryAcknowledged) {
        newPharmacyErrors.hpcnaLicenseExpiryAcknowledged =
          "You must acknowledge pharmacy liability and certificate validity.";
      }

      setPharmacyErrors(newPharmacyErrors);

      if (Object.keys(newPharmacyErrors).length > 0) {
        return;
      }
    } else {
      // Clear errors when leaving validation steps
      if (Object.keys(docErrors).length) setDocErrors({});
      if (Object.keys(profErrors).length) setProfErrors({});
      if (Object.keys(pharmacyErrors).length) setPharmacyErrors({});
    }

    setStep((prev) => Math.min(prev + 1, totalSteps) as Step);
  };
  const handleBack = () => {
    setAccountErrors({});
    setDocErrors({});
    setProfErrors({});
    setPharmacyErrors({});
    setStep((prev) => Math.max(prev - 1, 1) as Step);
  };

  // --- helpers for submission ---
  const normalizeCell = (raw: string) => {
    const digits = String(raw).replace(/\D/g, "");
    if (digits.startsWith("264") && digits.length === 12) return digits;
    if (digits.startsWith("0") && digits.length === 10)
      return "264" + digits.slice(1);
    if (/^8[15]\d{7}$/.test(digits)) return "264" + digits;
    return digits;
  };

  const buildFormData = () => {
    const fd = new FormData();
    const role =
      typeof params?.providerType === "string"
        ? String(params.providerType).toLowerCase()
        : "doctor";

    console.log("📝 Building FormData with role:", role);

    // text fields
    const pairs: Array<[string, string]> = [
      ["fullname", accountInfo.fullname],
      ["cellphoneNumber", normalizeCell(accountInfo.cellphoneNumber)],
      ["email", accountInfo.email],
      ["password", accountInfo.password],
      ["role", role],
      ["nationalId", accountInfo.nationalId || ""],
      ["gender", accountInfo.gender || ""],
      ["address", professionalDetails.address || ""],
      ["governingCouncil", professionalDetails.governingCouncil],
      ["hpcnaNumber", professionalDetails.hpcnaNumber],
      ["bio", professionalDetails.bio],
      ["hpcnaExpiryDate", expirationDate.toISOString()],
      ["yearsOfExperience", professionalDetails.yearsOfExperience || ""],
      ["operationalZone", professionalDetails.operationalZone || ""],
      // Send JSON, not a comma-joined string: multipart/form-data has no
      // array type, and a joined string was being stored as ONE
      // specialization entry, which never matched an ailment category.
      [
        "specializations",
        JSON.stringify(professionalDetails.specializations),
      ],
    ];

    if (isPharmacist) {
      pairs.push(
        ["registeredTradingName", pharmacyDetails.registeredTradingName],
        ["companyRegistrationNo", pharmacyDetails.companyRegistrationNo],
        ["businessEmail", pharmacyDetails.businessEmail],
        ["pharmacyCouncilNo", pharmacyDetails.pharmacyCouncilNo],
        ["practiceNumber", pharmacyDetails.practiceNumber],
        ["gpsLatitude", pharmacyDetails.gpsLatitude],
        ["gpsLongitude", pharmacyDetails.gpsLongitude],
        ["settlementCellNumber", pharmacyDetails.settlementCellNumber],
        [
          "hpcnaLicenseExpiryAcknowledged",
          pharmacyDetails.hpcnaLicenseExpiryAcknowledged ? "true" : "false",
        ],
      );
    }

    pairs.forEach(([k, v]) => {
      if (v) {
        try {
          fd.append(k, v);
          console.log(`✅ Added field: ${k}`);
        } catch (err) {
          console.error(`❌ Error appending field ${k}:`, err);
        }
      }
    });

    // files
    const toFile = (asset: any, fallback: string) => {
      if (!asset) return null;
      try {
        const uri = asset.uri;
        const name =
          asset.name ||
          asset.fileName ||
          fallback +
            (uri && uri.includes(".")
              ? uri.slice(uri.lastIndexOf("."))
              : ".jpg");
        const type =
          asset.mimeType ||
          asset.type ||
          (name.endsWith(".png")
            ? "image/png"
            : name.endsWith(".pdf")
              ? "application/pdf"
              : "image/jpeg");
        console.log(
          `📄 File ${fallback}: name=${name}, type=${type}, uri=${uri}`,
        );
        return { uri, name, type } as any;
      } catch (err) {
        console.error(`❌ Error processing file ${fallback}:`, err);
        return null;
      }
    };

    const files: Array<[any, string]> = [
      [documents.profileImage, "profileImage"],
      [documents.idDocumentFront, "idDocumentFront"],
      [documents.idDocumentBack, "idDocumentBack"],
      [documents.finalQualification, "finalQualification"],
      [documents.HPCNAQualification, "HPCNAQualification"],
      [documents.dispensingCertificateLicence, "dispensingCertificateLicence"],
      // Pharmacist files (backend upload.fields keys)
      [documents.trainingCertificate, "trainingCertificate"],
      [documents.NQAEvaluation, "NQAEvaluation"],
    ];

    files.forEach(([f, key]) => {
      try {
        const file = toFile(f, key);
        if (file) {
          fd.append(key, file);
          console.log(`✅ Added file: ${key}`);
        } else {
          console.log(`⚠️ Skipped file: ${key} (not provided)`);
        }
      } catch (err) {
        console.error(`❌ Error appending file ${key}:`, err);
      }
    });

    console.log("✅ FormData building complete");
    return fd;
  };

  // --- Final Submission ---
  const handleSubmit = async () => {
    // Basic validations
    const missing: string[] = [];
    if (!accountInfo.fullname) missing.push("Full Name");
    if (!accountInfo.email) missing.push("Email");
    if (!accountInfo.cellphoneNumber) missing.push("Cellphone");
    if (!accountInfo.password) missing.push("Password");
    if (!accountInfo.confirmPassword) missing.push("Confirm Password");
    if (
      accountInfo.password &&
      accountInfo.confirmPassword &&
      accountInfo.password !== accountInfo.confirmPassword
    ) {
      Alert.alert(
        "Password Mismatch",
        "Password and Confirm Password do not match",
      );
      return;
    }
    if (!accountInfo.nationalId) missing.push("National ID Number");
    if (!accountInfo.gender) missing.push("Gender");
    if (!professionalDetails.hpcnaNumber)
      missing.push("HPCNA Registration Number");
    if (!professionalDetails.yearsOfExperience)
      missing.push("Years of Experience");
    if (!professionalDetails.address) missing.push("Practice Address");
    if (!professionalDetails.operationalZone) missing.push("Operational Zone");
    if (!documents.idDocumentFront) missing.push("ID Front");
    if (!documents.idDocumentBack) missing.push("ID Back");
    if (!documents.profileImage) missing.push("Photo");
    if (isPharmacist) {
      if (!documents.finalQualification) missing.push("Bachelor Certificate");
      if (!documents.trainingCertificate)
        missing.push("Practicing Training Certificate");
      if (!documents.HPCNAQualification) missing.push("HPCNA Certificate");
      if (qualificationOrigin === "foreign" && !documents.NQAEvaluation)
        missing.push("NQA Evaluation");
      if (!pharmacyDetails.registeredTradingName.trim())
        missing.push("Registered Trading Name");
      if (!pharmacyDetails.pharmacyCouncilNo.trim())
        missing.push("Pharmacy Council No.");
      if (!pharmacyDetails.practiceNumber.trim())
        missing.push("Practice Number");
      if (!pharmacyDetails.hpcnaLicenseExpiryAcknowledged)
        missing.push("HPCNA liability acknowledgement");
    } else {
      if (!documents.finalQualification) missing.push("Final Qualification");
      if (!documents.HPCNAQualification)
        missing.push("HPCNA Practicing Certificate");
    }
    // Dispensing certification is optional, do NOT treat as missing

    if (missing.length) {
      Alert.alert("Missing info", "Please provide:\n• " + missing.join("\n• "));
      return;
    }

    setIsLoading(true);
    try {
      console.log("🔄 Building form data...");
      const formData = buildFormData();

      console.log("📤 Submitting registration...");
      const res = await apiClient.post(
        "/app/auth/register-health-provider",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      console.log("✅ Registration response:", res.status);

      if (res && (res.status === 201 || res.status === 200)) {
        // Reset navigation stack and redirect to sign-in
        // Using replace prevents going back to registration page
        router.replace("/(root)/sign-in");
      } else {
        const errorMsg = res?.data?.message ?? "Unable to register.";
        console.error("❌ Registration error:", errorMsg);
        Alert.alert("Error", errorMsg);
      }
    } catch (e: any) {
      console.error("❌ Exception during registration:", {
        message: e?.message,
        code: e?.code,
        status: e?.response?.status,
        responseData: JSON.stringify(e?.response?.data),
        config: e?.config?.url,
        requestError: e?.request
          ? "Request sent but no response"
          : "No request sent",
      });

      // Try to extract error message from various possible locations
      let errorMsg =
        "Upload failed. Please check your internet connection and try again.";

      if (e?.response?.data?.message) {
        errorMsg = e.response.data.message;
      } else if (e?.response?.data?.error) {
        errorMsg = e.response.data.error;
      } else if (e?.message) {
        errorMsg = e.message;
      } else if (e?.response?.statusText) {
        errorMsg = `Server error: ${e.response.statusText}`;
      }

      Alert.alert("Registration Error", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const stepMeta = providerStepMeta[step - 1] ?? providerStepMeta[0];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return (
    <>
      <RegistrationFeatureShell
        step={step}
        totalSteps={totalSteps}
        title={stepMeta.title}
        subtitle={stepMeta.subtitle}
        onBack={() => (step > 1 ? handleBack() : router.back())}
        footer={
          <RegistrationStepActions
            step={step}
            totalSteps={totalSteps}
            onBack={handleBack}
            onNext={handleNext}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            nextDisabled={step === 1 && !accountInfo.agreeToTerms}
            backDisabled={isLoading}
            submitLabel="Submit"
          />
        }
      >
        {/* Step 1: Account Information */}
        {step === 1 && (
          <View>
            <ProfileSectionRail title="Account information" />

            {showDisclaimer && (
              <View style={authScreenStyles.disclaimerBox}>
                <View className="flex-row items-start">
                  <Feather
                    name="shield"
                    size={20}
                    color={AUTH_COLORS.green}
                    style={{ marginRight: 12, marginTop: 2 }}
                  />
                  <View className="flex-1">
                    <Text style={authScreenStyles.disclaimerTitle}>
                      Data Privacy Assurance
                    </Text>
                    <Text style={authScreenStyles.disclaimerBody}>
                      Your personal information is treated with the utmost
                      confidentiality. We do not share, sell, or distribute
                      your data to any third parties. Your privacy and data
                      security are our top priorities.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <FieldBlock label="Full name" error={accountErrors.fullname}>
              <TextInput
                style={fieldInputStyle(!!accountErrors.fullname)}
                value={accountInfo.fullname}
                onChangeText={(t) => {
                  setAccountInfo((p) => ({ ...p, fullname: t }));
                  if (accountErrors.fullname) {
                    setAccountErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.fullname;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Enter your full name"
                placeholderTextColor={AUTH_COLORS.placeholder}
              />
            </FieldBlock>

            <FieldBlock label="Email" error={accountErrors.email}>
              <TextInput
                style={fieldInputStyle(!!accountErrors.email)}
                value={accountInfo.email}
                onChangeText={(t) => {
                  setAccountInfo((p) => ({ ...p, email: t }));
                  if (accountErrors.email) {
                    setAccountErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.email;
                      return newErrors;
                    });
                  }
                }}
                placeholder="youremail@example.com"
                placeholderTextColor={AUTH_COLORS.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </FieldBlock>

            <FieldBlock label="Password" error={accountErrors.password}>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={withIosStandalonePasswordTextInputStyle([
                    profileFeatureStyles.input,
                    accountErrors.password ? regStyles.inputError : undefined,
                  ])}
                  value={accountInfo.password}
                  onChangeText={(t) => {
                    setAccountInfo((p) => ({ ...p, password: t }));
                    if (accountErrors.password) {
                      setAccountErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.password;
                        return newErrors;
                      });
                    }
                  }}
                  placeholder="Create a strong password"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={iosPasswordToggleButtonStyle}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Feather
                    name={showPassword ? "eye" : "eye-off"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </FieldBlock>

            <FieldBlock
              label="Confirm password"
              error={accountErrors.confirmPassword}
            >
              <View style={{ position: "relative" }}>
                <TextInput
                  style={withIosStandalonePasswordTextInputStyle([
                    profileFeatureStyles.input,
                    accountErrors.confirmPassword
                      ? regStyles.inputError
                      : undefined,
                  ])}
                  value={accountInfo.confirmPassword}
                  onChangeText={(t) => {
                    setAccountInfo((p) => ({ ...p, confirmPassword: t }));
                    if (accountErrors.confirmPassword) {
                      setAccountErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.confirmPassword;
                        return newErrors;
                      });
                    }
                  }}
                  placeholder="Confirm your password"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={iosPasswordToggleButtonStyle}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  <Feather
                    name={showConfirmPassword ? "eye" : "eye-off"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </FieldBlock>

            <FieldBlock label="National ID number" error={accountErrors.nationalId}>
              <TextInput
                style={fieldInputStyle(!!accountErrors.nationalId)}
                value={accountInfo.nationalId}
                onChangeText={(t) => {
                  const numericOnly = t.replace(/[^0-9]/g, "");
                  if (numericOnly.length <= 11) {
                    setAccountInfo((p) => ({
                      ...p,
                      nationalId: numericOnly,
                    }));
                  }
                  if (accountErrors.nationalId) {
                    setAccountErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.nationalId;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Enter your 11-digit National ID"
                placeholderTextColor={AUTH_COLORS.placeholder}
                keyboardType="numeric"
                maxLength={11}
              />
            </FieldBlock>

            <FieldBlock label="Gender" error={accountErrors.gender}>
              <View style={regStyles.segment}>
                {["Male", "Female"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      regStyles.segmentItem,
                      accountInfo.gender === g && regStyles.segmentItemActive,
                    ]}
                    onPress={() => {
                      setAccountInfo((p) => ({
                        ...p,
                        gender: g,
                      }));
                      if (accountErrors.gender) {
                        setAccountErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.gender;
                          return newErrors;
                        });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        regStyles.segmentText,
                        accountInfo.gender === g && regStyles.segmentTextActive,
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FieldBlock>

            <FieldBlock label="National ID documents">
              <View className="flex-row" style={{ gap: 16 }}>
                <View className="flex-1">
                  <UploadBox
                    label="Upload ID (Front)"
                    file={documents.idDocumentFront}
                    onPick={() => pickDocument("idDocumentFront")}
                    icon="camera"
                    error={docErrors.idDocumentFront}
                    isImage={true}
                  />
                </View>
                <View className="flex-1">
                  <UploadBox
                    label="Upload ID (Back)"
                    file={documents.idDocumentBack}
                    onPick={() => pickDocument("idDocumentBack")}
                    icon="camera"
                    error={docErrors.idDocumentBack}
                    isImage={true}
                  />
                </View>
              </View>
              {docErrors.idDocumentFront ? (
                <Text style={regStyles.errorText}>
                  {docErrors.idDocumentFront}
                </Text>
              ) : null}
              {docErrors.idDocumentBack ? (
                <Text style={regStyles.errorText}>
                  {docErrors.idDocumentBack}
                </Text>
              ) : null}
              <Text style={regStyles.hintText}>
                Upload clear photos of the front and back of your ID (JPG or
                PNG)
              </Text>
            </FieldBlock>

            {/* Terms and Conditions Checkbox */}
            <TouchableOpacity
              onPress={() => {
                if (accountInfo.agreeToTerms) {
                  setAccountInfo((p) => ({ ...p, agreeToTerms: false }));
                } else {
                  setShowTermsModal(true);
                }
                if (accountErrors.terms) {
                  setAccountErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.terms;
                    return newErrors;
                  });
                }
              }}
              style={[
                regStyles.termsBox,
                accountErrors.terms ? regStyles.termsBoxError : null,
              ]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  regStyles.checkbox,
                  accountInfo.agreeToTerms ? regStyles.checkboxChecked : null,
                ]}
              >
                {accountInfo.agreeToTerms ? (
                  <Feather name="check" size={16} color="white" />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={regStyles.termsText}>
                  {accountInfo.agreeToTerms
                    ? "You have agreed to the Terms and Conditions and Privacy Policy (tap to revoke)"
                    : "Tap to read and agree to the Terms and Conditions and Privacy Policy"}
                </Text>
              </View>
            </TouchableOpacity>
            {accountErrors.terms ? (
              <Text style={regStyles.errorText}>{accountErrors.terms}</Text>
            ) : null}
          </View>
        )}

        {/* Step 2: Documents & Qualifications */}
        {step === 2 && (
          <View>
            <ProfileSectionRail title="Documents & qualifications" />

            <FieldBlock label="Profile picture" error={docErrors.profileImage}>
              <UploadBox
                label="Profile Picture"
                file={documents.profileImage}
                onPick={() => pickImage("profileImage")}
                icon="camera"
                error={docErrors.profileImage}
                isImage={true}
              />
            </FieldBlock>

            {isPharmacist ? (
              <>
                <FieldBlock
                  label="Bachelor certificate"
                  error={docErrors.finalQualification}
                >
                  <UploadBox
                    label="Upload Bachelor Certificate"
                    file={documents.finalQualification}
                    onPick={() => pickDocument("finalQualification")}
                    icon="award"
                    error={docErrors.finalQualification}
                  />
                </FieldBlock>

                <FieldBlock
                  label="Practicing training certificate"
                  error={docErrors.trainingCertificate}
                >
                  <UploadBox
                    label="Upload Practicing Training Certificate"
                    file={documents.trainingCertificate}
                    onPick={() => pickDocument("trainingCertificate")}
                    icon="file-text"
                    error={docErrors.trainingCertificate}
                  />
                </FieldBlock>

                <FieldBlock label="Qualification origin">
                  <View style={regStyles.segment}>
                    {[
                      { label: "Namibian", value: "namibia" },
                      { label: "Foreign", value: "foreign" },
                    ].map((o) => (
                      <TouchableOpacity
                        key={o.value}
                        style={[
                          regStyles.segmentItem,
                          qualificationOrigin === (o.value as any) &&
                            regStyles.segmentItemActive,
                        ]}
                        onPress={() => {
                          setQualificationOrigin(o.value as any);
                          if (docErrors.NQAEvaluation) {
                            setDocErrors((prev) => {
                              const next = { ...prev };
                              delete next.NQAEvaluation;
                              return next;
                            });
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            regStyles.segmentText,
                            qualificationOrigin === (o.value as any) &&
                              regStyles.segmentTextActive,
                          ]}
                        >
                          {o.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </FieldBlock>

                {qualificationOrigin === "foreign" && (
                  <FieldBlock
                    label="NQA evaluation"
                    error={docErrors.NQAEvaluation}
                  >
                    <UploadBox
                      label="Upload NQA Evaluation"
                      file={documents.NQAEvaluation}
                      onPick={() => pickDocument("NQAEvaluation")}
                      icon="file-text"
                      error={docErrors.NQAEvaluation}
                    />
                  </FieldBlock>
                )}
              </>
            ) : (
              <FieldBlock
                label="Final qualification"
                error={docErrors.finalQualification}
              >
                <UploadBox
                  label="Upload Final Qualification (e.g. Degree/Diploma)"
                  file={documents.finalQualification}
                  onPick={() => pickDocument("finalQualification")}
                  icon="award"
                  error={docErrors.finalQualification}
                />
              </FieldBlock>
            )}

            <FieldBlock
              label={isPharmacist ? "HPCNA certificate" : "HPCNA practicing certificate"}
              error={docErrors.HPCNAQualification}
              last={params?.providerType !== "nurse"}
            >
              <UploadBox
                label={
                  isPharmacist
                    ? "Upload HPCNA Certificate"
                    : "Upload HPCNA Practicing Certificate"
                }
                file={documents.HPCNAQualification}
                onPick={() => pickDocument("HPCNAQualification")}
                icon="calendar"
                error={docErrors.HPCNAQualification}
              />
            </FieldBlock>

            {params?.providerType === "nurse" && (
              <FieldBlock label="Dispensing licence (optional)" last>
                <UploadBox
                  label="Upload Dispensing Licence (Optional)"
                  file={documents.dispensingCertificateLicence}
                  onPick={() => pickDocument("dispensingCertificateLicence")}
                  icon="file-text"
                />
              </FieldBlock>
            )}
          </View>
        )}

        {/* Step 3: Professional Details */}
        {step === 3 && (
          <View>
            <ProfileSectionRail title="Professional details" />

            <FieldBlock label="Medical council">
              <Text style={regStyles.readOnlyValue}>
                {professionalDetails.governingCouncil}
              </Text>
            </FieldBlock>

            {/* Specializations - Dynamic from API */}
            <FieldBlock label="Specializations" error={profErrors.specializations}>
              <TextInput
                style={fieldInputStyle(!!profErrors.specializations)}
                value={professionalDetails.specializations.join(", ")}
                editable={false}
                placeholder="Select specialization(s) below"
                placeholderTextColor={AUTH_COLORS.placeholder}
              />

              <View style={{ marginTop: 12 }}>
                {loadingSpecializations ? (
                  <View className="py-4">
                    <ActivityIndicator size="small" color="#007BFF" />
                    <Text className="text-center text-[#4B5563] mt-2">
                      Loading specializations...
                    </Text>
                  </View>
                ) : filteredSpecializations.length > 0 ? (
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {filteredSpecializations.map((spec) => {
                      const selected =
                        professionalDetails.specializations.includes(
                          spec.title,
                        );
                      return (
                        <TouchableOpacity
                          key={spec._id}
                          onPress={() => toggleSpecialization(spec.title)}
                        >
                          <View
                            className={`px-3 py-1 rounded-full ${
                              selected ? "bg-[#16A34A]" : "bg-[#BBF7D0]"
                            }`}
                          >
                            <Text
                              className={`${
                                selected ? "text-white" : "text-[#14532D]"
                              } font-semibold`}
                            >
                              {spec.title}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: "rgba(187, 247, 208, 0.35)" }}
                  >
                    <Text className="text-[#4B5563] text-center">
                      No specializations available for{" "}
                      {params.providerType || "this provider type"}
                    </Text>
                  </View>
                )}
              </View>
            </FieldBlock>

            <FieldBlock
              label="HPCNA registration number"
              error={profErrors.hpcnaNumber}
            >
              <TextInput
                style={fieldInputStyle(!!profErrors.hpcnaNumber)}
                value={professionalDetails.hpcnaNumber}
                onChangeText={(t) => {
                  setProfessionalDetails((p) => ({ ...p, hpcnaNumber: t }));
                  if (profErrors.hpcnaNumber) {
                    setProfErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.hpcnaNumber;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Enter your HPCNA registration number"
                placeholderTextColor={AUTH_COLORS.placeholder}
              />
            </FieldBlock>

            <FieldBlock
              label="Years of experience"
              error={profErrors.yearsOfExperience}
            >
              <TextInput
                style={fieldInputStyle(!!profErrors.yearsOfExperience)}
                value={professionalDetails.yearsOfExperience}
                onChangeText={(t) => {
                  setProfessionalDetails((p) => ({
                    ...p,
                    yearsOfExperience: t,
                  }));
                  if (profErrors.yearsOfExperience) {
                    setProfErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.yearsOfExperience;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Enter years of experience"
                placeholderTextColor={AUTH_COLORS.placeholder}
                keyboardType="number-pad"
              />
            </FieldBlock>

            {/* Practice Address */}
            <FieldBlock label="Practice address" error={profErrors.address}>
              <TextInput
                style={fieldMultilineStyle(!!profErrors.address)}
                value={professionalDetails.address}
                onChangeText={(t) => {
                  setProfessionalDetails((p) => ({ ...p, address: t }));
                  if (profErrors.address) {
                    setProfErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.address;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Street and number, area, town (e.g. 123 Independence Ave, Windhoek)"
                placeholderTextColor={AUTH_COLORS.placeholder}
                multiline
                textAlignVertical="top"
              />
            </FieldBlock>

            <FieldBlock
              label="Operational zone"
              error={profErrors.operationalZone}
            >
              <PickerField
                value={professionalDetails.operationalZone}
                onValueChange={(v) => {
                  setProfessionalDetails((p) => ({
                    ...p,
                    operationalZone: String(v || ""),
                  }));
                  if (profErrors.operationalZone) {
                    setProfErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.operationalZone;
                      return newErrors;
                    });
                  }
                }}
                items={namibianRegions}
                placeholder="Select region…"
                error={!!profErrors.operationalZone}
              />
            </FieldBlock>

            {/* Date of Expiration */}
            <FieldBlock label="HPCNA expiry date">
              <TouchableOpacity
                onPress={openExpirationPicker}
                style={fieldInputStyle(false) as StyleProp<ViewStyle>}
                activeOpacity={0.7}
              >
                <Text style={regStyles.dateText}>
                  {expirationDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              {showDatePicker && Platform.OS === "android" ? (
                <DateTimePicker
                  value={expirationDate}
                  mode="date"
                  display="default"
                  onChange={onExpirationDateChange}
                  minimumDate={todayStart}
                />
              ) : null}
            </FieldBlock>

            {showDatePicker && Platform.OS === "ios" ? (
              <Modal
                transparent
                animationType="slide"
                visible={showDatePicker}
                onRequestClose={cancelIosExpirationDate}
              >
                <View style={regStyles.iosPickerOverlay}>
                  <TouchableOpacity
                    style={regStyles.iosPickerBackdrop}
                    activeOpacity={1}
                    onPress={cancelIosExpirationDate}
                  />
                  <View style={regStyles.iosPickerSheet}>
                    <View style={regStyles.iosPickerToolbar}>
                      <TouchableOpacity
                        onPress={cancelIosExpirationDate}
                        hitSlop={12}
                      >
                        <Text style={regStyles.iosPickerCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={regStyles.iosPickerTitle}>
                        HPCNA expiry date
                      </Text>
                      <TouchableOpacity
                        onPress={confirmIosExpirationDate}
                        hitSlop={12}
                      >
                        <Text style={regStyles.iosPickerDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={expirationDate}
                      mode="date"
                      display="spinner"
                      themeVariant="light"
                      onChange={onExpirationDateChange}
                      minimumDate={todayStart}
                      style={regStyles.iosPicker}
                    />
                  </View>
                </View>
              </Modal>
            ) : null}

            {/* Bio */}
            <FieldBlock label="Professional bio" error={profErrors.bio} last>
              <TextInput
                style={fieldMultilineStyle(!!profErrors.bio)}
                value={professionalDetails.bio}
                onChangeText={(t) => {
                  setProfessionalDetails((p) => ({ ...p, bio: t }));
                  if (profErrors.bio) {
                    setProfErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.bio;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Tell us about your professional experience and expertise"
                placeholderTextColor={AUTH_COLORS.placeholder}
                multiline
                textAlignVertical="top"
              />
            </FieldBlock>
          </View>
        )}

        {/* Step 4: Pharmacy Details */}
        {isPharmacist && step === 4 && (
          <View>
            <ProfileSectionRail title="Pharmacy details" />

            <FieldBlock
              label="Registered trading name"
              error={pharmacyErrors.registeredTradingName}
            >
              <TextInput
                style={fieldInputStyle(!!pharmacyErrors.registeredTradingName)}
                value={pharmacyDetails.registeredTradingName}
                onChangeText={(t) =>
                  setPharmacyDetail("registeredTradingName", t)
                }
                placeholder="Name on storefront or BIPA documents"
                placeholderTextColor={AUTH_COLORS.placeholder}
              />
            </FieldBlock>

            <FieldBlock label="Company registration no. / BIPA">
              <TextInput
                style={fieldInputStyle(false)}
                value={pharmacyDetails.companyRegistrationNo}
                onChangeText={(t) =>
                  setPharmacyDetail("companyRegistrationNo", t)
                }
                placeholder="e.g. CC/20XX/XXXX"
                placeholderTextColor={AUTH_COLORS.placeholder}
                autoCapitalize="characters"
              />
            </FieldBlock>

            <FieldBlock label="Business email" error={pharmacyErrors.businessEmail}>
              <TextInput
                style={fieldInputStyle(!!pharmacyErrors.businessEmail)}
                value={pharmacyDetails.businessEmail}
                onChangeText={(t) => setPharmacyDetail("businessEmail", t)}
                placeholder="Official pharmacy email"
                placeholderTextColor={AUTH_COLORS.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </FieldBlock>

            <FieldBlock
              label="Pharmacy council no."
              error={pharmacyErrors.pharmacyCouncilNo}
            >
              <TextInput
                style={fieldInputStyle(!!pharmacyErrors.pharmacyCouncilNo)}
                value={pharmacyDetails.pharmacyCouncilNo}
                onChangeText={(t) => setPharmacyDetail("pharmacyCouncilNo", t)}
                placeholder="Premises registration with Pharmacy Council"
                placeholderTextColor={AUTH_COLORS.placeholder}
              />
            </FieldBlock>

            <FieldBlock
              label="Practice number"
              error={pharmacyErrors.practiceNumber}
            >
              <TextInput
                style={fieldInputStyle(!!pharmacyErrors.practiceNumber)}
                value={pharmacyDetails.practiceNumber}
                onChangeText={(t) => setPharmacyDetail("practiceNumber", t)}
                placeholder="Required for medical aid and billing"
                placeholderTextColor={AUTH_COLORS.placeholder}
              />
            </FieldBlock>

            <FieldBlock label="Pharmacy location">
              <View style={regStyles.locationBox}>
                <Text style={regStyles.locationText}>
                  {pharmacyDetails.gpsAddress || "No location detected yet"}
                </Text>
                {!!pharmacyDetails.gpsLatitude &&
                  !!pharmacyDetails.gpsLongitude && (
                    <Text style={regStyles.hintText}>
                      {pharmacyDetails.gpsLatitude},{" "}
                      {pharmacyDetails.gpsLongitude}
                    </Text>
                  )}
              </View>
              <TouchableOpacity
                onPress={detectPharmacyLocation}
                disabled={isDetectingPharmacyLocation}
                style={[
                  profileFeatureStyles.primaryButton,
                  {
                    marginTop: 12,
                    opacity: isDetectingPharmacyLocation ? 0.7 : 1,
                  },
                ]}
                activeOpacity={0.85}
              >
                {isDetectingPharmacyLocation ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="navigation" size={18} color="#FFFFFF" />
                )}
                <Text style={profileFeatureStyles.primaryButtonText}>
                  {isDetectingPharmacyLocation
                    ? "Detecting Location..."
                    : "Detect My Location"}
                </Text>
              </TouchableOpacity>
            </FieldBlock>

            <FieldBlock label="Settlement cell number">
              <TextInput
                style={fieldInputStyle(false)}
                value={pharmacyDetails.settlementCellNumber}
                onChangeText={(t) =>
                  setPharmacyDetail("settlementCellNumber", t)
                }
                placeholder="For prepaid software credit payouts"
                placeholderTextColor={AUTH_COLORS.placeholder}
                keyboardType="phone-pad"
              />
            </FieldBlock>

            <TouchableOpacity
              onPress={() =>
                setPharmacyDetail(
                  "hpcnaLicenseExpiryAcknowledged",
                  !pharmacyDetails.hpcnaLicenseExpiryAcknowledged,
                )
              }
              style={[
                regStyles.termsBox,
                pharmacyErrors.hpcnaLicenseExpiryAcknowledged
                  ? regStyles.termsBoxError
                  : null,
              ]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  regStyles.checkbox,
                  pharmacyDetails.hpcnaLicenseExpiryAcknowledged
                    ? regStyles.checkboxChecked
                    : null,
                ]}
              >
                {pharmacyDetails.hpcnaLicenseExpiryAcknowledged ? (
                  <Feather name="check" size={16} color="#FFFFFF" />
                ) : null}
              </View>
              <Text style={[regStyles.termsText, { flex: 1 }]}>
                I acknowledge my liability under HPCNA and confirm that my
                pharmacy registration information and certificate are valid
                and up to date.
              </Text>
            </TouchableOpacity>
            {pharmacyErrors.hpcnaLicenseExpiryAcknowledged ? (
              <Text style={regStyles.errorText}>
                {pharmacyErrors.hpcnaLicenseExpiryAcknowledged}
              </Text>
            ) : null}
          </View>
        )}

        {/* Review & Submit */}
        {step === reviewStep && (
          <View>
            <ProfileSectionRail title="Review & submit" />

            {/* Single container card */}
            <View className="w-full bg-white p-5 rounded-xl border border-[#BBF7D0]">
              <ReviewRow label="Full Name" value={accountInfo.fullname} />
              <ReviewRow label="Email" value={accountInfo.email} />
              <ReviewRow label="Mobile" value={accountInfo.cellphoneNumber} />
              <ReviewRow label="National ID" value={accountInfo.nationalId} />
              <ReviewRow label="Gender" value={accountInfo.gender} />

              <View
                className="h-px my-3"
                style={{ backgroundColor: AUTH_COLORS.inputBorder }}
              />

              <ReviewRow
                label="Medical Council"
                value={professionalDetails.governingCouncil}
              />
              <ReviewRow
                label="HPCNA Registration Number"
                value={professionalDetails.hpcnaNumber}
              />
              <ReviewRow
                label="Date of Expiration"
                value={expirationDate.toLocaleDateString()}
              />
              <ReviewRow
                label="Years of Experience"
                value={professionalDetails.yearsOfExperience}
              />
              <ReviewRow
                label="Operational Zone"
                value={professionalDetails.operationalZone}
              />

              {isPharmacist && (
                <>
                  <View
                    className="h-px my-3"
                    style={{ backgroundColor: AUTH_COLORS.inputBorder }}
                  />
                  <ReviewRow
                    label="Registered Trading Name"
                    value={pharmacyDetails.registeredTradingName}
                  />
                  <ReviewRow
                    label="Company Registration No. / BIPA"
                    value={pharmacyDetails.companyRegistrationNo}
                  />
                  <ReviewRow
                    label="Business Email"
                    value={pharmacyDetails.businessEmail}
                  />
                  <ReviewRow
                    label="Pharmacy Council No."
                    value={pharmacyDetails.pharmacyCouncilNo}
                  />
                  <ReviewRow
                    label="Practice Number"
                    value={pharmacyDetails.practiceNumber}
                  />
                  <ReviewRow
                    label="Pharmacy Location"
                    value={
                      pharmacyDetails.gpsAddress ||
                      (pharmacyDetails.gpsLatitude &&
                      pharmacyDetails.gpsLongitude
                        ? `${pharmacyDetails.gpsLatitude}, ${pharmacyDetails.gpsLongitude}`
                        : undefined)
                    }
                  />
                  <ReviewRow
                    label="Settlement Cell Number"
                    value={pharmacyDetails.settlementCellNumber}
                  />
                  <ReviewRow
                    label="HPCNA Acknowledgement"
                    value={
                      pharmacyDetails.hpcnaLicenseExpiryAcknowledged
                        ? "Accepted"
                        : "Not accepted"
                    }
                  />
                </>
              )}

              {/* Specializations on review */}
              <View className="mb-3 mt-3">
                <Text className="text-sm text-[#4B5563]">Specializations</Text>
                <View
                  className="flex-row flex-wrap mt-1"
                  style={{ gap: 6 }}
                >
                  {professionalDetails.specializations.length > 0 ? (
                    professionalDetails.specializations.map((spec) => (
                      <View
                        key={spec}
                        className="bg-primary rounded-full px-3 py-1"
                      >
                        <Text className="text-white font-semibold">{spec}</Text>
                      </View>
                    ))
                  ) : (
                    <Text className="text-base text-[#14532D] font-semibold">
                      Not provided
                    </Text>
                  )}
                </View>
              </View>

              {/* Divider before files */}
              <View
                className="h-px my-4"
                style={{ backgroundColor: AUTH_COLORS.inputBorder }}
              />

              {/* Stacked file previews */}
              <Text className="text-lg font-semibold text-[#14532D] mb-2">
                Uploaded Files
              </Text>
              <DocRow
                label="Profile Photo"
                file={documents.profileImage}
                showOpen={false}
              />
              <DocRow
                label="ID (Front)"
                file={documents.idDocumentFront}
                showOpen={false}
              />
              <DocRow
                label="ID (Back)"
                file={documents.idDocumentBack}
                showOpen={false}
              />
              {!isPharmacist ? (
                <>
                  <DocRow
                    label="Final Qualification"
                    file={documents.finalQualification}
                    showOpen={false}
                  />
                  <DocRow
                    label="HPCNA Practicing Certificate"
                    file={documents.HPCNAQualification}
                    showOpen={false}
                  />
                </>
              ) : (
                <>
                  <DocRow
                    label="Bachelor Certificate"
                    file={documents.finalQualification}
                    showOpen={false}
                  />
                  <DocRow
                    label="Practicing Training Certificate"
                    file={documents.trainingCertificate}
                    showOpen={false}
                  />
                  <DocRow
                    label="HPCNA Certificate"
                    file={documents.HPCNAQualification}
                    showOpen={false}
                  />
                  {qualificationOrigin === "foreign" && (
                    <DocRow
                      label="NQA Evaluation"
                      file={documents.NQAEvaluation}
                      showOpen={false}
                    />
                  )}
                </>
              )}
              {params?.providerType === "nurse" && (
                <DocRow
                  label="Dispensing Certification Licence"
                  file={documents.dispensingCertificateLicence}
                  showOpen={false}
                />
              )}
            </View>
          </View>
        )}
      </RegistrationFeatureShell>

      <TermsConditionsModal
        visible={showTermsModal}
        audience="provider"
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setAccountInfo((p) => ({ ...p, agreeToTerms: true }));
          setShowTermsModal(false);
        }}
      />
    </>
  );
}
