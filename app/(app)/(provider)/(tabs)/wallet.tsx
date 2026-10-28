import { Feather } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { iosInputIconSize, withIosInputContainerStyle, withIosMultilineTextInputStyle, withIosOtpTextInputStyle, withIosStandaloneTextInputStyle, withIosTextInputStyle } from "../../../../lib/iosInputStyles";
import { AppTextInput as TextInput } from "../../../../components/AppTextInput";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  AppScreenShell,
  appScreenStyles,
  AUTH_COLORS,
} from "../../../../components/app/AppScreenUI";
import {
  AppBottomSheetCloseHeader,
  appBottomSheetAppearance,
  appBottomSheetScrollPadding,
  appBottomSheetStyles,
} from "../../../../components/app/AppBottomSheetUI";
import WebView from "react-native-webview";
import { useAuth } from "../../../../context/AuthContext";
import apiClient from "../../../../lib/api";

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
    style={styles.actionButton}
    activeOpacity={0.85}
  >
    <Feather name={icon} size={18} color={AUTH_COLORS.white} />
    <Text style={styles.actionButtonText}>{label}</Text>
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

  let label = item.type.charAt(0).toUpperCase() + item.type.slice(1);
  if (isDeposit && isFundedToOthers) {
    label = "Funded Wallet";
  } else if (isDeposit && !isFundedToOthers) {
    label = "Deposit";
  } else if (isEarning) {
    label = "Consultation completed";
  }

  return (
    <View style={styles.activityCard}>
      <View style={styles.activityMain}>
        <View style={styles.activityIcon}>
          <Feather
            name={isPositive ? "arrow-down-left" : "arrow-up-right"}
            size={16}
            color={isPositive ? AUTH_COLORS.greenDark : "#6B7280"}
          />
        </View>
        <View style={styles.activityText}>
          <Text style={styles.activityLabel} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.activityTime}>
            {new Date(item.time).toLocaleString()}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.activityAmount,
          isPositive ? styles.activityAmountPositive : styles.activityAmountNegative,
        ]}
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
        const response = await apiClient.get(
          `/app/transaction/transaction-history/?page=${page}&limit=10`,
        );
        const newTransactions = response.data.data || [];
        const pagination = response.data.pagination || {};

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
        if (error.response?.status === 429) {
          Alert.alert(
            "Please wait",
            "Too many requests right now. Pull to refresh in a moment.",
          );
        }
        // Don't clear existing rows on a rate-limit / transient failure
        if (page === 1 && error.response?.status !== 429) {
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
      fetchTransactions(false, nextPage);
    }
  }, [isLoadingMore, hasMore, currentPage, fetchTransactions]);

  // Helper function to fetch and update user details
  const fetchAndUpdateUserDetails = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const userResponse = await apiClient.get("/app/auth/user-details/");
      if (userResponse.data?.status && userResponse.data?.user) {
        const backendUser = userResponse.data.user;
        await updateUser({
          ...backendUser,
          consultations:
            typeof backendUser.consultations === "number"
              ? backendUser.consultations
              : user?.consultations,
        });
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  }, [user?.userId, user?.consultations, updateUser]);

  const lastTransactionsFetchRef = useRef(0);

  // --- Load data once when the signed-in user is available ---
  useEffect(() => {
    if (!user?.userId) return;
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;

    const loadData = async () => {
      try {
        await fetchAndUpdateUserDetails();
        await fetchTransactions(false, 1);
        lastTransactionsFetchRef.current = Date.now();
        await fetchPackages();
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadData();
    // Intentionally only when userId changes ? unstable callback deps caused a
    // request loop that exhausted the API rate limit (HTTP 429).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  // Refresh recent activity when Account tab is focused (e.g. after completing
  // a consultation on the Requests tab). Skip if we just loaded moments ago.
  useFocusEffect(
    useCallback(() => {
      if (!user?.userId) return;
      const now = Date.now();
      if (now - lastTransactionsFetchRef.current < 4000) return;
      lastTransactionsFetchRef.current = now;
      fetchTransactions(true, 1);
    }, [user?.userId, fetchTransactions]),
  );

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
        // anything, so there is nothing useful to check here first ? doing so
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
      // The server opens the payment with PayGate ? it holds the merchant
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
  // touch this app or our backend ? it belongs on the DPO hosted page.
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
            contentContainerStyle={[
              appScreenStyles.scrollContent,
              styles.listContent,
            ]}
            onRefresh={() => fetchTransactions(true, 1)}
            refreshing={isRefreshing}
            removeClippedSubviews={false}
            ListFooterComponent={
              transactions.length > 0 ? (
                <View style={styles.paginationWrap}>
                  <View style={styles.paginationDivider}>
                    <View style={styles.paginationLine} />
                    <Text style={styles.paginationText}>
                      Page {currentPage} of {totalPages}
                    </Text>
                    <View style={styles.paginationLine} />
                  </View>
                  {hasMore ? (
                    <TouchableOpacity
                      onPress={loadMoreTransactions}
                      disabled={isLoadingMore}
                      style={[
                        styles.loadMoreButton,
                        isLoadingMore && styles.loadMoreButtonDisabled,
                      ]}
                      activeOpacity={0.85}
                    >
                      {isLoadingMore ? (
                        <ActivityIndicator
                          size="small"
                          color={AUTH_COLORS.white}
                        />
                      ) : (
                        <Feather
                          name="chevron-down"
                          size={16}
                          color={AUTH_COLORS.white}
                        />
                      )}
                      <Text style={styles.loadMoreButtonText}>
                        {isLoadingMore ? "Loading..." : "Load More"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {!hasMore && totalPages > 1 ? (
                    <Text style={styles.allLoadedText}>
                      All transactions loaded
                    </Text>
                  ) : null}
                </View>
              ) : undefined
            }
            ListHeaderComponent={
              <>
                <View style={styles.pageHeader}>
                  <Text style={styles.pageTitle}>Account</Text>
                  <Text style={styles.pageSubtitle}>
                    Manage consultations and packages
                  </Text>
                  <View style={styles.consultationsMeta}>
                    <Feather
                      name="briefcase"
                      size={14}
                      color={AUTH_COLORS.greenDark}
                    />
                    <Text style={styles.consultationsMetaText}>
                      {user?.consultations || 0} consultations
                    </Text>
                  </View>
                </View>

                {!isDocumentVerified ? (
                  <View style={styles.noticeCard}>
                    <Text style={styles.noticeTitle}>Disclaimer</Text>
                    <Text style={styles.noticeBody}>
                      Your account is currently under review. Package selection
                      will be available once verification is complete.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.sectionBlock}>
                    {hasActivePackage ? (
                      <View style={styles.activePackageCard}>
                        <View style={styles.activePackageHeader}>
                          <View style={styles.activePackageIcon}>
                            <Feather
                              name="package"
                              size={16}
                              color={AUTH_COLORS.greenDark}
                            />
                          </View>
                          <Text style={styles.activePackageTitle}>
                            Active package in use
                          </Text>
                        </View>
                        <Text style={styles.activePackageBody}>
                          You still have {consultationsLeft} consultation
                          {consultationsLeft > 1 ? "s" : ""}. You can select a
                          new package when your consultations reach 0.
                        </Text>
                        <View style={styles.activePackageStat}>
                          <Text style={styles.activePackageStatValue}>
                            {consultationsLeft}
                          </Text>
                          <Text style={styles.activePackageStatLabel}>
                            remaining
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <ActionButton
                        icon="plus-circle"
                        label="Select package"
                        onPress={() => addMoneySheetRef.current?.expand()}
                      />
                    )}
                  </View>
                )}

                <View style={styles.activityHeader}>
                  <Text style={styles.activityHeaderTitle}>Recent activity</Text>
                  <Text style={styles.activityHeaderSubtitle}>
                    Latest deposits and consultation earnings
                  </Text>
                </View>
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <Feather name="inbox" size={22} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptyBody}>
                  Activity will appear here after deposits and completed
                  consultations.
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
      ) : undefined}
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
          <BottomSheetTextInput
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
          <BottomSheetTextInput
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
          <BottomSheetTextInput
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

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pageHeader: {
    marginBottom: 16,
    paddingTop: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 10,
  },
  consultationsMeta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  consultationsMetaText: {
    fontSize: 12,
    fontWeight: "600",
    color: AUTH_COLORS.greenDark,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  noticeCard: {
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
    padding: 14,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "#B45309",
  },
  activePackageCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderLeftWidth: 3,
    borderLeftColor: AUTH_COLORS.green,
    backgroundColor: AUTH_COLORS.white,
    padding: 14,
  },
  activePackageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  activePackageIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  activePackageTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  activePackageBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
    marginBottom: 12,
  },
  activePackageStat: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  activePackageStatValue: {
    fontSize: 22,
    fontWeight: "700",
    color: AUTH_COLORS.greenDark,
  },
  activePackageStatLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: AUTH_COLORS.greenDark,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: AUTH_COLORS.white,
    fontSize: 15,
    fontWeight: "600",
  },
  activityHeader: {
    marginBottom: 12,
  },
  activityHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 2,
  },
  activityHeaderSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  activityMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  activityText: {
    flex: 1,
    minWidth: 0,
  },
  activityLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
  activityAmountPositive: {
    color: AUTH_COLORS.greenDark,
  },
  activityAmountNegative: {
    color: "#4B5563",
  },
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 12,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "#9CA3AF",
    textAlign: "center",
  },
  paginationWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
  paginationDivider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 14,
    gap: 10,
  },
  paginationLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D1D5DB",
  },
  paginationText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: AUTH_COLORS.greenDark,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  loadMoreButtonDisabled: {
    opacity: 0.6,
  },
  loadMoreButtonText: {
    color: AUTH_COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  allLoadedText: {
    marginTop: 8,
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
});