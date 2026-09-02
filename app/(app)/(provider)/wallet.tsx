import { Feather } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { iosInputIconSize, withIosInputContainerStyle, withIosMultilineTextInputStyle, withIosOtpTextInputStyle, withIosStandaloneTextInputStyle, withIosTextInputStyle } from "../../../lib/iosInputStyles";
import { AppTextInput as TextInput } from "../../../components/AppTextInput";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Alert, FlatList, Keyboard, Platform, Text, TouchableOpacity, View } from "react-native";
import {
  AppHeroCard,
  AppScreenShell,
  appScreenStyles,
  getGreeting,
  getGreetingEmoji,
  AUTH_COLORS,
} from "../../../components/app/AppScreenUI";
import {
  AppBottomSheetCloseHeader,
  appBottomSheetAppearance,
  appBottomSheetScrollPadding,
  appBottomSheetStyles,
} from "../../../components/app/AppBottomSheetUI";
import WebView from "react-native-webview";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../lib/api";

// --- Type Definitions ---
interface Transaction {
  _id: string;
  amount: number;
  type: "deposit" | "transfer" | "withdrawal" | "payment" | "earning";
  status: string;
  time: string;
  walletID?: string;
}
interface PackageItem {
  _id: string;
  provider: string;
  amount: number;
  consultations: number;
}

interface DPOSession {
  reference: string;
  payRequestId: string;
  checksum: string;
  packageId: string;
  packageConsultations: number;
  packageAmount: number;
}

// Merchant credentials live on the server (see backend utils/dpoPayment.js).
// Only these two public URLs are needed in the app: one to post the hosted
// payment form to, one to recognise when the user comes back.
const DPO_CONFIG = {
  REDIRECT_URL: "https://secure.paygate.co.za/payweb3/process.trans",
  RETURN_URL: "https://kopanovertex.com",
} as const;

// --- Reusable Components ---
const ActionButton = ({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className="items-center bg-green-600 p-4 rounded-2xl flex-1 border border-green-600 shadow-sm"
  >
    <Feather name={icon} size={24} color="#FFFFFF" />
    <Text className="text-white font-semibold mt-2">{label}</Text>
  </TouchableOpacity>
);

const formatExpiryDate = (value: string) => {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length > 4) return cleaned.slice(0, 4);
  if (cleaned.length > 2) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return cleaned;
};

const TransactionRow = ({
  item,
  userWalletID,
}: {
  item: Transaction;
  userWalletID?: string;
}) => {
  const isDeposit = item.type === "deposit";
  const isEarning = item.type === "earning";
  const isPositive = isDeposit || isEarning;
  const isFundedToOthers =
    isDeposit &&
    item.walletID &&
    userWalletID &&
    item.walletID !== userWalletID;

  // Determine the transaction label
  let label = item.type.charAt(0).toUpperCase() + item.type.slice(1);
  if (isDeposit && isFundedToOthers) {
    label = "Funded Wallet";
  } else if (isDeposit && !isFundedToOthers) {
    label = "Deposit";
  } else if (isEarning) {
    label = "Earning";
  }

  return (
    <View className="flex-row items-center justify-between bg-white p-4 rounded-xl mb-3 border border-gray-100 shadow-sm">
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View
          className={`w-10 h-10 rounded-full items-center justify-center ${isPositive ? "bg-green-100" : "bg-red-100"}`}
        >
          <Feather
            name={isPositive ? "arrow-down-left" : "arrow-up-right"}
            size={20}
            color={isPositive ? "#28A745" : "#EF4444"}
          />
        </View>
        <View>
          <Text className="text-base font-bold text-text-main">{label}</Text>
          <Text className="text-sm text-gray-500">
            {new Date(item.time).toLocaleString()}
          </Text>
        </View>
      </View>
      <Text
        className={`text-lg font-bold ${isPositive ? "text-green-600" : "text-red-500"}`}
      >
        {isPositive ? "+" : "-"}N$ {item.amount.toFixed(2)}
      </Text>
    </View>
  );
};

export default function TransactionsScreen() {
  const { user, updateUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isLoadingRef = useRef(false);
  const hasTriggeredRedirect = useRef(false);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [isFetchingPackages, setIsFetchingPackages] = useState(false);
  const [dpoSession, setDpoSession] = useState<DPOSession | null>(null);

  const dpoHtmlContent = dpoSession
    ? `
    <html>
    <body onload="document.forms[0].submit();">
      <form
        id="dpoForm"
        action="${DPO_CONFIG.REDIRECT_URL}"
        method="POST">
        <input type="hidden" name="PAY_REQUEST_ID" value="${dpoSession.payRequestId}" />
        <input type="hidden" name="CHECKSUM" value="${dpoSession.checksum}" />
      </form>
    </body>
    </html>
  `
    : "";

  // Bottom sheets
  const addMoneySheetRef = useRef<BottomSheet>(null); // package selection
  const fundOthersSheetRef = useRef<BottomSheet>(null);
  const withdrawSheetRef = useRef<BottomSheet>(null);
  // Snap points with extra space for keyboard
  const addMoneySnapPoints = useMemo(() => ["90%"], []);
  const fundOthersSnapPoints = useMemo(() => ["90%"], []);
  const withdrawSnapPoints = useMemo(() => ["50%"], []);

  const [fundOthersForm, setFundOthersForm] = useState({
    amount: "",
    walletID: "",
  });
  const [withdrawForm, setWithdrawForm] = useState({ amount: "" });
  const [fundOthersErrors, setFundOthersErrors] = useState<{
    amount?: string;
    walletID?: string;
  }>({});
  const [withdrawErrors, setWithdrawErrors] = useState<{ amount?: string }>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isDocumentVerified = !!user?.isDocumentVerified;
  const consultationsLeft = Number(user?.consultations || 0);
  const hasActivePackage = consultationsLeft > 0;

  // Listen to keyboard show/hide events
  React.useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      },
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);
  const fetchPackages = useCallback(async () => {
    if (!user?.role) return;

    setIsFetchingPackages(true);
    try {
      const response = await apiClient.get(
        `/app/packages/all/${user.role.toLowerCase()}`,
      );
      console.log("Packages Response:", response.data);
      if (response.data?.status === "SUCCESS") {
        setPackages(response.data.data || []);
      }
    } catch (error) {
      console.error("Fetch Packages Error:", error);
    } finally {
      setIsFetchingPackages(false);
    }
  }, [user?.role]);

  const fetchTransactions = useCallback(
    async (isRefresh = false, page = 1) => {
      if (!user?.userId) {
        setTransactions([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
        setCurrentPage(1);
      } else if (page === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        console.log(
          `Fetching transactions for userId: ${user.userId}, page: ${page}`,
        );
        const response = await apiClient.get(
          `/app/transaction/transaction-history/?page=${page}&limit=10`,
        );
        // console.log("Transactions Response:", response.data);
        const newTransactions = response.data.data || [];
        const pagination = response.data.pagination || {};

        console.log("Pagination data:", pagination);

        if (isRefresh || page === 1) {
          // Replace transactions on refresh or first page
          setTransactions(newTransactions);
        } else {
          // Append transactions for pagination
          setTransactions((prev) => [...prev, ...newTransactions]);
        }

        // Use pagination data from API response
        const hasNext = pagination.hasNextPage === true;
        const currentPageNum = pagination.currentPage || page;
        const totalPagesNum = pagination.totalPages || 1;
        console.log(
          "Setting hasMore:",
          hasNext,
          "currentPage:",
          currentPageNum,
          "totalPages:",
          totalPagesNum,
          "newTransactions count:",
          newTransactions.length,
        );
        setHasMore(hasNext);
        setCurrentPage(currentPageNum);
        setTotalPages(totalPagesNum);

        // If no transactions returned and we're not on page 1, there are no more pages
        if (newTransactions.length === 0 && page > 1) {
          setHasMore(false);
        }
      } catch (error: any) {
        console.error("Fetch Transactions Error:", {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        });
        // Don't show alert on initial load, just set empty transactions
        if (page === 1) {
          setTransactions([]);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [user?.userId],
  );

  // Load more transactions for pagination (manual trigger)
  const loadMoreTransactions = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      const nextPage = currentPage + 1;
      console.log("Loading more transactions, page:", nextPage);
      fetchTransactions(false, nextPage);
    }
  }, [isLoadingMore, hasMore, currentPage, fetchTransactions]);

  // Helper function to fetch and update user details
  const fetchAndUpdateUserDetails = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const userResponse = await apiClient.get("/app/auth/user-details/");
      console.log("User Details Response:", userResponse.data);
      if (userResponse.data?.status && userResponse.data?.user) {
        console.log("Updating user details:", userResponse.data.user);
        updateUser(userResponse.data.user);
        const backendUser = userResponse.data.user;

        // Ensure consultations is refreshed from backend response
        await updateUser({
          consultations:
            typeof backendUser.consultations === "number"
              ? backendUser.consultations
              : user?.consultations,
        });
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  }, [user?.userId, updateUser]);

  // --- Load data when screen/component mounts ---
  useEffect(() => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;

    const loadData = async () => {
      try {
        await fetchAndUpdateUserDetails();
        await fetchTransactions(false, 1);
        await fetchPackages();
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadData();
  }, [fetchAndUpdateUserDetails, fetchTransactions, fetchPackages]);

  const markPackagePurchased = useCallback(
    async (session: DPOSession) => {
      const payload = {
        packageId: session.packageId,
        payRequestId: session.payRequestId,
        reference: session.reference,
      };

      const response = await apiClient.post(
        "/app/transaction/purchase-package",
        payload,
      );

      if (!(response.status >= 200 && response.status < 300)) {
        throw new Error(
          response.data?.message || "Payment finalization failed.",
        );
      }

      addMoneySheetRef.current?.close();

      await fetchAndUpdateUserDetails();
      await fetchTransactions(true, 1);

      Alert.alert(
        "Success",
        response.data?.message || "Package successfully purchased.",
      );
    },
    [
      addMoneySheetRef,
      fetchAndUpdateUserDetails,
      fetchTransactions,
      updateUser,
      user?.consultations,
    ],
  );

  const verifyDpoPaymentAndFinalize = useCallback(
    async (session: DPOSession) => {
      setIsSubmitting(true);
      try {
        // The server verifies the payment with PayGate itself before granting
        // anything, so there is nothing useful to check here first — doing so
        // would only risk dropping a payment that actually succeeded.
        await markPackagePurchased(session);
      } catch (error: any) {
        Alert.alert(
          "Payment Failed",
          error?.response?.data?.message ||
            error?.message ||
            "Could not confirm payment.",
        );
      } finally {
        setDpoSession(null);
        setIsSubmitting(false);
      }
    },
    [markPackagePurchased],
  );

  const initiatePackagePayment = async (pkg: PackageItem) => {
    if (!isDocumentVerified) {
      Alert.alert(
        "Verification Required",
        "Your documents must be verified by admin before purchasing a package.",
      );
      return;
    }

    if (hasActivePackage) {
      Alert.alert(
        "Active Package Found",
        "You already have an active package. Please use all consultations before buying another package.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // The server opens the payment with PayGate — it holds the merchant
      // credentials and derives the amount from the package itself, so the
      // app never sees either.
      const response = await apiClient.post(
        "/app/transaction/initiate-package-payment",
        { packageId: pkg._id },
      );

      const { reference, payRequestId, checksum } = response.data || {};

      if (!reference || !payRequestId || !checksum) {
        Alert.alert("DPO Error", "Failed to initiate payment.");
        return;
      }

      const session: DPOSession = {
        reference,
        payRequestId,
        checksum,
        packageId: pkg._id,
        packageConsultations: pkg.consultations || 0,
        packageAmount: Number(pkg.amount) || 0,
      };
      setDpoSession(session);
      hasTriggeredRedirect.current = false;
    } catch (error: any) {
      Alert.alert(
        "DPO Payment Failed",
        error?.response?.data?.message || "An error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- handleSendMoney (Fund Someone's Wallet) ---
  // Card details are deliberately not collected here. Raw card data must never
  // touch this app or our backend — it belongs on the DPO hosted page.
  const handleFundOthers = async () => {
    const errors: {
      amount?: string;
      walletID?: string;
    } = {};
    if (!fundOthersForm.walletID) errors.walletID = "Wallet ID is required";
    if (!fundOthersForm.amount) errors.amount = "Amount is required";

    if (Object.keys(errors).length > 0) {
      setFundOthersErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post(
        "/app/transaction/fund-other-wallet",
        fundOthersForm,
      );

      if (response.status >= 200 && response.status < 300) {
        // Close sheet and clear fields immediately
        fundOthersSheetRef.current?.close();
        setFundOthersForm({
          amount: "",
          walletID: "",
        });
        setFundOthersErrors({});

        await fetchTransactions(true, 1);

        Alert.alert("Success", response.data.message);
      } else {
        Alert.alert(
          "Transfer Failed",
          response.data?.message || "An error occurred.",
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Transfer Failed",
        error.response?.data?.message || "An error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- FULLY IMPLEMENTED handleWithdraw ---
  const handleWithdraw = async () => {
    const errors: { amount?: string } = {};
    if (!withdrawForm.amount) errors.amount = "Amount is required";

    if (Object.keys(errors).length > 0) {
      setWithdrawErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post(
        "/app/transaction/withdraw-wallet-funds/",
        withdrawForm,
      );

      if (response.status >= 200 && response.status < 300) {
        // Close sheet and clear fields immediately
        withdrawSheetRef.current?.close();
        setWithdrawForm({ amount: "" });
        setWithdrawErrors({});

        // Fetch updated user details and refresh transactions
        await fetchAndUpdateUserDetails();
        await fetchTransactions(true, 1);

        Alert.alert("Success", response.data.message);
      } else {
        Alert.alert(
          "Withdrawal Failed",
          response.data?.message || "An error occurred.",
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Withdrawal Failed",
        error.response?.data?.message || "An error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <AppScreenShell>
        {isLoading ? (
          <ActivityIndicator size="large" color={AUTH_COLORS.green} style={{ marginTop: 80 }} />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TransactionRow item={item} userWalletID={user?.walletID} />
            )}
            contentContainerStyle={appScreenStyles.scrollContent}
            onRefresh={() => fetchTransactions(true, 1)}
            refreshing={isRefreshing}
            removeClippedSubviews={false}
            ListFooterComponent={
              transactions.length > 0 ? (
                <View className="py-8 items-center">
                  <View className="flex-row items-center justify-center mb-4">
                    <View className="h-px bg-gray-200 flex-1" />
                    <View className="px-4">
                      <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Page {currentPage} of {totalPages}
                      </Text>
                    </View>
                    <View className="h-px bg-gray-200 flex-1" />
                  </View>
                  {hasMore && (
                    <TouchableOpacity
                      onPress={loadMoreTransactions}
                      disabled={isLoadingMore}
                      className={`bg-green-600 px-8 py-3.5 rounded-2xl flex-row items-center justify-center shadow-lg ${isLoadingMore ? "opacity-60" : ""}`}
                      style={{
                        shadowColor: "#16A34A",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 6,
                      }}
                    >
                      {isLoadingMore ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color="white"
                            style={{ marginRight: 8 }}
                          />
                          <Text className="text-white font-semibold text-base">
                            Loading...
                          </Text>
                        </>
                      ) : (
                        <>
                          <Feather
                            name="chevron-down"
                            size={20}
                            color="#FFFFFF"
                            style={{ marginRight: 6 }}
                          />
                          <Text className="text-white font-semibold text-base">
                            Load More
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {!hasMore && totalPages > 1 && (
                    <View className="flex-row items-center mt-2">
                      <Feather
                        name="check-circle"
                        size={16}
                        color="#9CA3AF"
                        style={{ marginRight: 6 }}
                      />
                      <Text className="text-sm text-gray-400 font-medium">
                        All transactions loaded
                      </Text>
                    </View>
                  )}
                </View>
              ) : null
            }
            ListHeaderComponent={
              <>
                <AppHeroCard
                  eyebrow={`${getGreeting()} ${getGreetingEmoji()}`}
                  name="Account"
                  tagline="Manage consultations and packages"
                  stats={[
                    {
                      icon: "briefcase",
                      label: `${user?.consultations || 0} consultations`,
                    },
                  ]}
                />
                {!isDocumentVerified ? (
                  <View className="mb-6 mx-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                    <Text className="text-sm font-semibold text-amber-800">
                      Disclaimer
                    </Text>
                    <Text className="mt-1 text-sm text-amber-700">
                      Your account is currently under review. Package selection
                      will be available once verification is complete
                    </Text>
                  </View>
                ) : (
                  <View className="mb-6 px-5" style={{ gap: 12 }}>
                    {hasActivePackage ? (
                      <View
                        className="rounded-2xl p-4"
                        style={{
                          borderWidth: 2,
                          borderColor: AUTH_COLORS.inputBorder,
                          backgroundColor: AUTH_COLORS.greenSoft,
                        }}
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: AUTH_COLORS.textDark }}
                        >
                          Active package in use
                        </Text>
                        <Text
                          className="mt-1 text-sm"
                          style={{ color: AUTH_COLORS.textMuted }}
                        >
                          You still have {consultationsLeft} consultation
                          {consultationsLeft > 1 ? "s" : ""}. You can select a
                          new package when your consultations reach 0.
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row" style={{ gap: 16 }}>
                        <ActionButton
                          icon="plus-circle"
                          label="Select package"
                          onPress={() => addMoneySheetRef.current?.expand()}
                        />
                      </View>
                    )}
                  </View>
                )}
                <Text
                  className="text-xl font-bold mb-4 px-5"
                  style={{ color: AUTH_COLORS.textDark }}
                >
                  Recent activity
                </Text>
              </>
            }
            ListEmptyComponent={
              <View className="items-center mt-10 px-5">
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: AUTH_COLORS.greenSoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Feather name="folder" size={32} color={AUTH_COLORS.green} />
                </View>
                <Text className="text-lg" style={{ color: AUTH_COLORS.textMuted }}>
                  No transactions yet.
                </Text>
              </View>
            }
          />
        )}
    </AppScreenShell>
      {dpoSession ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#FFFFFF",
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            onPress={() => setDpoSession(null)}
            style={{ position: "absolute", right: 12, top: 40, zIndex: 10000 }}
          >
            <Feather name="x-circle" size={32} color="#111827" />
          </TouchableOpacity>

          <WebView
            originWhitelist={["*"]}
            source={{ html: dpoHtmlContent }}
            javaScriptEnabled
            domStorageEnabled
            onNavigationStateChange={(navState: any) => {
              const returnHost = DPO_CONFIG.RETURN_URL.replace(
                /^https?:\/\//,
                "",
              );
              if (
                navState.url.includes(returnHost) &&
                !hasTriggeredRedirect.current
              ) {
                hasTriggeredRedirect.current = true;
                verifyDpoPaymentAndFinalize(dpoSession);
              }
            }}
          />
        </View>
      ) : null}
      {/* Bottom sheet 1: Package selection */}
      <BottomSheet
        ref={addMoneySheetRef}
        index={-1}
        snapPoints={addMoneySnapPoints}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        {...appBottomSheetAppearance}
      >
        <BottomSheetScrollView
          style={appBottomSheetScrollPadding}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppBottomSheetCloseHeader
            title="Select Package"
            onClose={() => addMoneySheetRef.current?.close()}
          />

          {!isDocumentVerified ? (
            <View style={appBottomSheetStyles.warningBanner}>
              <Text style={appBottomSheetStyles.warningBannerTitle}>
                Production disclaimer
              </Text>
              <Text style={appBottomSheetStyles.warningBannerBody}>
                Document verification is required before selecting packages.
              </Text>
            </View>
          ) : hasActivePackage ? (
            <View style={appBottomSheetStyles.noticeBanner}>
              <Text style={appBottomSheetStyles.noticeBannerTitle}>
                Active package in use
              </Text>
              <Text style={appBottomSheetStyles.noticeBannerBody}>
                You have {consultationsLeft} consultation
                {consultationsLeft > 1 ? "s" : ""} remaining. You can buy a
                new package once your consultations are 0.
              </Text>
            </View>
          ) : isFetchingPackages ? (
            <View style={appBottomSheetStyles.loadingWrap}>
              <ActivityIndicator size="large" color={AUTH_COLORS.green} />
              <Text style={appBottomSheetStyles.loadingLabel}>
                Loading packages...
              </Text>
            </View>
          ) : packages.length === 0 ? (
            <Text style={appBottomSheetStyles.emptyStateText}>
              No packages available.
            </Text>
          ) : (
            <View style={{ marginTop: 4 }}>
              {packages.map((pkg, index) => {
                const isBestValue = index === 1;
                return (
                  <TouchableOpacity
                    key={pkg._id}
                    activeOpacity={0.9}
                    style={appBottomSheetStyles.packageCard}
                    onPress={() => initiatePackagePayment(pkg)}
                  >
                    <View style={appBottomSheetStyles.packageCardInner}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <View>
                          <Text style={appBottomSheetStyles.packageMeta}>
                            {pkg.consultations} Consultation
                            {pkg.consultations > 1 ? "s" : ""}
                          </Text>
                          <Text style={appBottomSheetStyles.packagePrice}>
                            N$ {pkg.amount}
                          </Text>
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          {isBestValue && (
                            <View style={appBottomSheetStyles.packageBadge}>
                              <Text style={appBottomSheetStyles.packageBadgeText}>
                                Most Popular
                              </Text>
                            </View>
                          )}
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: AUTH_COLORS.greenSoft,
                              borderWidth: 1,
                              borderColor: AUTH_COLORS.inputBorder,
                            }}
                          >
                            <Feather
                              name="plus-circle"
                              size={22}
                              color={AUTH_COLORS.green}
                            />
                          </View>
                        </View>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 8,
                        }}
                      >
                        <Text style={appBottomSheetStyles.packageHint}>
                          Ideal for{" "}
                          <Text style={{ fontWeight: "700" }}>
                            {pkg.consultations} session
                            {pkg.consultations > 1 ? "s" : ""}
                          </Text>
                        </Text>
                        <Text
                          style={[
                            appBottomSheetStyles.packageHint,
                            { fontWeight: "600" },
                          ]}
                        >
                          Tap to continue
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* <BottomSheet
        ref={addMoneySheetRef}
        index={-1}
        snapPoints={addMoneySnapPoints}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={{ backgroundColor: "#FFFFFF", borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: "#9CA3AF", width: 40 }}
      >
        {!selectedPackage ? (
          <>
            <Text className="text-xl font-bold mb-4">Select a Package</Text>

            {isFetchingPackages ? (
              <ActivityIndicator />
            ) : (
              packages.map((pkg) => (
                <TouchableOpacity
                  key={pkg._id}
                  onPress={() => {
                    setSelectedPackage(pkg);
                    setAddMoneyForm((prev) => ({
                      ...prev,
                      amount: String(pkg.amount),
                    }));
                  }}
                  className="border border-gray-200 p-4 rounded-xl mb-3"
                >
                  <Text className="font-bold text-lg">N$ {pkg.amount}</Text>
                  <Text className="text-gray-600">
                    {pkg.consultations} Consultations
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <BottomSheetScrollView
            style={{ paddingTop: 24, paddingHorizontal: 24 }}
            contentContainerStyle={{
              paddingBottom: Math.max(24, keyboardHeight + 20),
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold mb-2">Selected Package</Text>

              <View className="bg-gray-100 p-4 rounded-xl mb-4">
                <Text className="font-bold">N$ {selectedPackage.amount}</Text>
                <Text>{selectedPackage.consultations} Consultations</Text>
              </View>
              <Text className="text-2xl font-bold text-text-main">
                Purchase
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setAddMoneyErrors({});
                  setAddMoneyForm({
                    amount: "",
                    cardNumber: "",
                    expiryDate: "",
                    cvv: "",
                    cardHolder: "",
                  });
                  addMoneySheetRef.current?.close();
                }}
              >
                <Feather name="x" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">
              Amount
            </Text>
            <TextInput
              style={withIosStandaloneTextInputStyle()}
              value={addMoneyForm.amount}
              onChangeText={(v) => {
                setAddMoneyForm((p) => ({ ...p, amount: v }));
                setAddMoneyErrors((e) => ({ ...e, amount: undefined }));
              }}
              placeholder="Amount (N$)"
              className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.amount ? "border-red-500" : "border-gray-200"}`}
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />
            {addMoneyErrors.amount && (
              <Text className="text-xs text-red-500 mb-2">
                {addMoneyErrors.amount}
              </Text>
            )}
            <Text className="text-sm font-semibold text-gray-700 mb-1.5 mt-2">
              Cardholder Name
            </Text>
            <TextInput
              style={withIosStandaloneTextInputStyle()}
              value={addMoneyForm.cardHolder}
              onChangeText={(v) => {
                setAddMoneyForm((p) => ({ ...p, cardHolder: v }));
                setAddMoneyErrors((e) => ({ ...e, cardHolder: undefined }));
              }}
              placeholder="Cardholder Name"
              className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.cardHolder ? "border-red-500" : "border-gray-200"}`}
              placeholderTextColor="#9CA3AF"
            />
            {addMoneyErrors.cardHolder && (
              <Text className="text-xs text-red-500 mb-2">
                {addMoneyErrors.cardHolder}
              </Text>
            )}
            <Text className="text-sm font-semibold text-gray-700 mb-1.5 mt-2">
              Card Number
            </Text>
            <TextInput
              style={withIosStandaloneTextInputStyle()}
              value={addMoneyForm.cardNumber}
              onChangeText={(v) => {
                setAddMoneyForm((p) => ({ ...p, cardNumber: v }));
                setAddMoneyErrors((e) => ({ ...e, cardNumber: undefined }));
              }}
              placeholder="Card Number"
              className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.cardNumber ? "border-red-500" : "border-gray-200"}`}
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />
            {addMoneyErrors.cardNumber && (
              <Text className="text-xs text-red-500 mb-2">
                {addMoneyErrors.cardNumber}
              </Text>
            )}
            <View className="flex-row mt-2" style={{ gap: 12 }}>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-700 mb-1.5">
                  Expiry Date
                </Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle()}
                  value={addMoneyForm.expiryDate}
                  onChangeText={(v) => {
                    setAddMoneyForm((p) => ({
                      ...p,
                      expiryDate: formatExpiryDate(v),
                    }));
                    setAddMoneyErrors((e) => ({ ...e, expiryDate: undefined }));
                  }}
                  placeholder="MM/YY"
                  className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.expiryDate ? "border-red-500" : "border-gray-200"}`}
                  maxLength={5}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-700 mb-1.5">
                  CVV
                </Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle()}
                  value={addMoneyForm.cvv}
                  onChangeText={(v) => {
                    setAddMoneyForm((p) => ({ ...p, cvv: v }));
                    setAddMoneyErrors((e) => ({ ...e, cvv: undefined }));
                  }}
                  placeholder="CVV"
                  className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.cvv ? "border-red-500" : "border-gray-200"}`}
                  keyboardType="numeric"
                  secureTextEntry
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
            {(addMoneyErrors.expiryDate || addMoneyErrors.cvv) && (
              <View className="flex-row justify-between mb-2">
                <View className="flex-1 pr-1">
                  {addMoneyErrors.expiryDate && (
                    <Text className="text-xs text-red-500">
                      {addMoneyErrors.expiryDate}
                    </Text>
                  )}
                </View>
                <View className="flex-1 pl-1">
                  {addMoneyErrors.cvv && (
                    <Text className="text-xs text-red-500 text-right">
                      {addMoneyErrors.cvv}
                    </Text>
                  )}
                </View>
              </View>
            )}
            <TouchableOpacity
              onPress={handleAddMoney}
              disabled={isSubmitting}
              className={`bg-green-600 p-4 rounded-xl mb-4 ${isSubmitting && "opacity-50"}`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-center text-lg">
                  Confirm Deposit
                </Text>
              )}
            </TouchableOpacity>
            <View style={{ height: Math.max(100, keyboardHeight + 50) }} />
          </BottomSheetScrollView>
        )}
      </BottomSheet> */}

      <BottomSheet
        ref={fundOthersSheetRef}
        index={-1}
        snapPoints={fundOthersSnapPoints}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        {...appBottomSheetAppearance}
      >
        <BottomSheetScrollView
          style={appBottomSheetScrollPadding}
          contentContainerStyle={{
            paddingBottom: Math.max(24, keyboardHeight + 20),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <AppBottomSheetCloseHeader
            title="Send Funds"
            onClose={() => {
              setFundOthersErrors({});
              setFundOthersForm({
                amount: "",
                walletID: "",
              });
              fundOthersSheetRef.current?.close();
            }}
          />
          <Text style={appBottomSheetStyles.inputLabel}>
            Recipient's Wallet ID
          </Text>
          <TextInput
            style={[
              withIosStandaloneTextInputStyle(),
              appBottomSheetStyles.input,
              fundOthersErrors.walletID && appBottomSheetStyles.inputError,
            ]}
            value={fundOthersForm.walletID}
            onChangeText={(v) => {
              setFundOthersForm((p) => ({ ...p, walletID: v }));
              setFundOthersErrors((e) => ({ ...e, walletID: undefined }));
            }}
            placeholder="Recipient's Wallet ID"
            placeholderTextColor={AUTH_COLORS.textMuted}
          />
          {fundOthersErrors.walletID && (
            <Text style={appBottomSheetStyles.fieldError}>
              {fundOthersErrors.walletID}
            </Text>
          )}
          <Text style={appBottomSheetStyles.inputLabel}>Amount</Text>
          <TextInput
            style={[
              withIosStandaloneTextInputStyle(),
              appBottomSheetStyles.input,
              fundOthersErrors.amount && appBottomSheetStyles.inputError,
            ]}
            value={fundOthersForm.amount}
            onChangeText={(v) => {
              setFundOthersForm((p) => ({ ...p, amount: v }));
              setFundOthersErrors((e) => ({ ...e, amount: undefined }));
            }}
            placeholder="Amount (N$)"
            keyboardType="numeric"
            placeholderTextColor={AUTH_COLORS.textMuted}
          />
          {fundOthersErrors.amount && (
            <Text style={appBottomSheetStyles.fieldError}>
              {fundOthersErrors.amount}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleFundOthers}
            disabled={isSubmitting}
            style={[
              appBottomSheetStyles.primaryCta,
              isSubmitting && { opacity: 0.5 },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={AUTH_COLORS.white} />
            ) : (
              <Text style={appBottomSheetStyles.primaryCtaText}>Send Money</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: Math.max(100, keyboardHeight + 50) }} />
        </BottomSheetScrollView>
      </BottomSheet>

      <BottomSheet
        ref={withdrawSheetRef}
        index={-1}
        snapPoints={withdrawSnapPoints}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        {...appBottomSheetAppearance}
      >
        <BottomSheetScrollView
          style={appBottomSheetScrollPadding}
          contentContainerStyle={{
            paddingBottom: Math.max(24, keyboardHeight + 20),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <AppBottomSheetCloseHeader
            title="Withdraw to Card"
            onClose={() => {
              setWithdrawErrors({});
              setWithdrawForm({ amount: "" });
              withdrawSheetRef.current?.close();
            }}
          />
          <Text style={appBottomSheetStyles.inputLabel}>Amount</Text>
          <TextInput
            style={[
              withIosStandaloneTextInputStyle(),
              appBottomSheetStyles.input,
              withdrawErrors.amount && appBottomSheetStyles.inputError,
            ]}
            value={withdrawForm.amount}
            onChangeText={(v) => {
              setWithdrawForm((p) => ({ ...p, amount: v }));
              setWithdrawErrors((e) => ({ ...e, amount: undefined }));
            }}
            placeholder="Amount to Withdraw (N$)"
            keyboardType="numeric"
            placeholderTextColor={AUTH_COLORS.textMuted}
          />
          {withdrawErrors.amount && (
            <Text style={appBottomSheetStyles.fieldError}>
              {withdrawErrors.amount}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleWithdraw}
            disabled={isSubmitting}
            style={[
              appBottomSheetStyles.primaryCta,
              isSubmitting && { opacity: 0.5 },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={AUTH_COLORS.white} />
            ) : (
              <Text style={appBottomSheetStyles.primaryCtaText}>
                Confirm Withdrawal
              </Text>
            )}
          </TouchableOpacity>
          <View style={{ height: Math.max(100, keyboardHeight + 50) }} />
        </BottomSheetScrollView>
      </BottomSheet>
    </>
  );
}