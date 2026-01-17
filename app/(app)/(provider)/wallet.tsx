import { Feather } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Clipboard, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/api';

// --- Type Definitions ---
interface Transaction {
    _id: string;
    amount: number;
    type: 'deposit' | 'transfer' | 'withdrawal' | 'payment';
    status: string;
    time: string;
    walletID?: string;
}

// --- Reusable Components ---
const ActionButton = ({ icon, label, onPress }: { icon: any; label: string; onPress: () => void; }) => (
    <TouchableOpacity onPress={onPress} className="items-center bg-green-600 p-4 rounded-2xl flex-1 border border-green-600 shadow-sm">
        <Feather name={icon} size={24} color="#FFFFFF" />
        <Text className="text-white font-semibold mt-2">{label}</Text>
    </TouchableOpacity>
);

// Format expiry date to MM/YY format
const formatExpiryDate = (value: string) => {
    // Remove non-digits
    const cleaned = value.replace(/\D/g, '');
    
    // Limit to 4 digits
    if (cleaned.length > 4) {
        return cleaned.slice(0, 4);
    }
    
    // Add slash after 2 digits (but only if there are more digits after)
    if (cleaned.length > 2) {
        return cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    
    return cleaned;
};

const TransactionRow = ({ item, userWalletID }: { item: Transaction; userWalletID?: string }) => {
    const isDeposit = item.type === 'deposit';
    const isFundedToOthers = isDeposit && item.walletID && userWalletID && item.walletID !== userWalletID;
    
    // Determine the transaction label
    let label = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    if (isDeposit && isFundedToOthers) {
        label = 'Funded Wallet';
    } else if (isDeposit && !isFundedToOthers) {
        label = 'Deposit';
    }
    
    return (
        <View className="flex-row items-center justify-between bg-white p-4 rounded-xl mb-3 border border-gray-100 shadow-sm">
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className={`w-10 h-10 rounded-full items-center justify-center ${isDeposit ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Feather name={isDeposit ? "arrow-down-left" : "arrow-up-right"} size={20} color={isDeposit ? "#28A745" : "#EF4444"} />
                </View>
                <View>
                    <Text className="text-base font-bold text-text-main">{label}</Text>
                    <Text className="text-sm text-gray-500">{new Date(item.time).toLocaleString()}</Text>
                </View>
            </View>
            <Text className={`text-lg font-bold ${isDeposit ? 'text-secondary' : 'text-red-500'}`}>
                {isDeposit ? '+' : '-'}N$ {item.amount.toFixed(2)}
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

    const addMoneySheetRef = useRef<BottomSheet>(null);
    const fundOthersSheetRef = useRef<BottomSheet>(null);
    const withdrawSheetRef = useRef<BottomSheet>(null);
    // Snap points sized to fit content - no wasted space
    const addMoneySnapPoints = useMemo(() => [500], []);
    const fundOthersSnapPoints = useMemo(() => [550], []);
    const withdrawSnapPoints = useMemo(() => [280], []);

    const [addMoneyForm, setAddMoneyForm] = useState({ amount: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
    const [fundOthersForm, setFundOthersForm] = useState({ amount: '', walletID: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
    const [withdrawForm, setWithdrawForm] = useState({ amount: '' });
    const [addMoneyErrors, setAddMoneyErrors] = useState<{ amount?: string; cardNumber?: string; expiryDate?: string; cvv?: string; cardHolder?: string }>({});
    const [fundOthersErrors, setFundOthersErrors] = useState<{ amount?: string; walletID?: string; cardNumber?: string; expiryDate?: string; cvv?: string; cardHolder?: string }>({});
    const [withdrawErrors, setWithdrawErrors] = useState<{ amount?: string }>({});

    const fetchTransactions = useCallback(async (isRefresh = false, page = 1) => {
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
            console.log(`Fetching transactions for userId: ${user.userId}, page: ${page}`);
            const response = await apiClient.get('/app/transaction/transaction-history/?page=${page}&limit=10');
            // console.log("Transactions Response:", response.data);
            const newTransactions = response.data.data || [];
            const pagination = response.data.pagination || {};
            
            console.log("Pagination data:", pagination);
            
            if (isRefresh || page === 1) {
                // Replace transactions on refresh or first page
                setTransactions(newTransactions);
            } else {
                // Append transactions for pagination
                setTransactions(prev => [...prev, ...newTransactions]);
            }
            
            // Use pagination data from API response
            const hasNext = pagination.hasNextPage === true;
            const currentPageNum = pagination.currentPage || page;
            const totalPagesNum = pagination.totalPages || 1;
            console.log("Setting hasMore:", hasNext, "currentPage:", currentPageNum, "totalPages:", totalPagesNum, "newTransactions count:", newTransactions.length);
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
    }, [user?.userId]);

    // Load more transactions for pagination (manual trigger)
    const loadMoreTransactions = useCallback(() => {
        if (!isLoadingMore && hasMore) {
            const nextPage = currentPage + 1;
            console.log('Loading more transactions, page:', nextPage);
            fetchTransactions(false, nextPage);
        }
    }, [isLoadingMore, hasMore, currentPage, fetchTransactions]);

    // --- THIS IS THE CORRECTED useFocusEffect HOOK ---
    useFocusEffect(
      useCallback(() => {
        fetchTransactions(false, 1);
      }, [fetchTransactions])
    );
    // ---------------------------------------------

    // Helper function to fetch and update user details
    const fetchAndUpdateUserDetails = useCallback(async () => {
        if (!user?.userId) return;
        try {
            const userResponse = await apiClient.get('/app/auth/user-details/');
            console.log("User Details Response:", userResponse.data);
            if (userResponse.data?.status && userResponse.data?.user) {
                updateUser(userResponse.data.user);
            }
        } catch (error) {
            console.error("Error fetching user details:", error);
        }
    }, [user?.userId, updateUser]);

    // --- FULLY IMPLEMENTED handleAddMoney ---
    const handleAddMoney = async () => {
        const errors: { amount?: string; cardNumber?: string; expiryDate?: string; cvv?: string; cardHolder?: string } = {};
        if (!addMoneyForm.amount) errors.amount = 'Amount is required';
        if (!addMoneyForm.cardHolder) errors.cardHolder = 'Cardholder name is required';
        if (!addMoneyForm.cardNumber) errors.cardNumber = 'Card number is required';
        if (!addMoneyForm.expiryDate) errors.expiryDate = 'Expiry date is required';
        if (!addMoneyForm.cvv) errors.cvv = 'CVV is required';

        if (Object.keys(errors).length > 0) {
            setAddMoneyErrors(errors);
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiClient.post('/app/transaction/fund-wallet/', addMoneyForm);

            // Treat any 2xx as success
            if (response.status >= 200 && response.status < 300) {
                // Close sheet and clear fields immediately
                addMoneySheetRef.current?.close();
                setAddMoneyForm({ amount: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
                setAddMoneyErrors({});

                // Fetch updated user details and refresh transactions
                await fetchAndUpdateUserDetails();
                await fetchTransactions(true, 1);

                Alert.alert("Success", response.data.message);
            } else {
                Alert.alert("Deposit Failed", response.data?.message || "An error occurred.");
            }
        } catch (error: any) {
            Alert.alert("Deposit Failed", error.response?.data?.message || "An error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- FULLY IMPLEMENTED handleSendMoney (Fund Someone's Wallet with Card) ---
    const handleFundOthers = async () => {
        const errors: { amount?: string; walletID?: string; cardNumber?: string; expiryDate?: string; cvv?: string; cardHolder?: string } = {};
        if (!fundOthersForm.walletID) errors.walletID = 'Wallet ID is required';
        if (!fundOthersForm.amount) errors.amount = 'Amount is required';
        if (!fundOthersForm.cardHolder) errors.cardHolder = 'Cardholder name is required';
        if (!fundOthersForm.cardNumber) errors.cardNumber = 'Card number is required';
        if (!fundOthersForm.expiryDate) errors.expiryDate = 'Expiry date is required';
        if (!fundOthersForm.cvv) errors.cvv = 'CVV is required';

        if (Object.keys(errors).length > 0) {
            setFundOthersErrors(errors);
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiClient.post('/app/transaction/fund-other-wallet', fundOthersForm);

            if (response.status >= 200 && response.status < 300) {
                // Close sheet and clear fields immediately
                fundOthersSheetRef.current?.close();
                setFundOthersForm({ amount: '', walletID: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
                setFundOthersErrors({});

                // Only refresh transactions (sending from card doesn't affect user balance)
                await fetchTransactions(true, 1);

                Alert.alert("Success", response.data.message);
            } else {
                Alert.alert("Transfer Failed", response.data?.message || "An error occurred.");
            }
        } catch (error: any) {
            Alert.alert("Transfer Failed", error.response?.data?.message || "An error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- FULLY IMPLEMENTED handleWithdraw ---
    const handleWithdraw = async () => {
        const errors: { amount?: string } = {};
        if (!withdrawForm.amount) errors.amount = 'Amount is required';

        if (Object.keys(errors).length > 0) {
            setWithdrawErrors(errors);
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiClient.post('/app/transaction/withdraw-wallet-funds/', withdrawForm);

            if (response.status >= 200 && response.status < 300) {
                // Close sheet and clear fields immediately
                withdrawSheetRef.current?.close();
                setWithdrawForm({ amount: '' });
                setWithdrawErrors({});

                // Fetch updated user details and refresh transactions
                await fetchAndUpdateUserDetails();
                await fetchTransactions(true, 1);

                Alert.alert("Success", response.data.message);
            } else {
                Alert.alert("Withdrawal Failed", response.data?.message || "An error occurred.");
            }
        } catch (error: any) {
            Alert.alert("Withdrawal Failed", error.response?.data?.message || "An error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View className="flex-1">
            <SafeAreaView className="flex-1" edges={['bottom', 'left', 'right']}>
                {isLoading ? ( <ActivityIndicator size="large" className="mt-20"/> ) : (
                    <FlatList
                        data={transactions}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => <TransactionRow item={item} userWalletID={user?.walletID} />}
                        contentContainerStyle={{ padding: 16 }}
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
                                            className={`bg-green-600 px-8 py-3.5 rounded-2xl flex-row items-center justify-center shadow-lg ${isLoadingMore ? 'opacity-60' : ''}`}
                                            style={{
                                                shadowColor: '#16A34A',
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 8,
                                                elevation: 6,
                                            }}
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                                                    <Text className="text-white font-semibold text-base">Loading...</Text>
                                                </>
                                            ) : (
                                                <>
                                                    <Feather name="chevron-down" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                                                    <Text className="text-white font-semibold text-base">Load More</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    {!hasMore && totalPages > 1 && (
                                        <View className="flex-row items-center mt-2">
                                            <Feather name="check-circle" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                                            <Text className="text-sm text-gray-400 font-medium">All transactions loaded</Text>
                                        </View>
                                    )}
                                </View>
                            ) : null
                        }
                        ListHeaderComponent={
                            <>
                                <View className="p-6 mb-6 border-2 border-green-600 rounded-2xl">
                                    <View className="mb-6">
                                        <Text className="text-gray-600 text-lg">Your Balance</Text>
                                        <Text className="text-gray-900 text-4xl font-bold mt-1">
                                            N$ {user?.balance?.toFixed(2)}
                                        </Text>
                                    </View>
                                    {user?.walletID && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                try {
                                                    Clipboard.setString(user.walletID!);
                                                    Alert.alert("Copied", "Wallet ID copied to clipboard!");
                                                } catch {
                                                    Alert.alert("Error", "Failed to copy wallet ID");
                                                }
                                            }}
                                        >
                                            <Text className="text-gray-600 text-sm font-semibold mb-2">Your Wallet ID</Text>
                                            <Text className="text-gray-900 text-base font-bold break-words">{user.walletID}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View className="flex-row mb-6" style={{ gap: 16 }}>
                                    <ActionButton icon="plus-circle" label="Fund Wallet" onPress={() => addMoneySheetRef.current?.expand()} />
                                    <ActionButton icon="send" label="Send Funds" onPress={() => fundOthersSheetRef.current?.expand()} />
                                </View>
                                <View className="flex-row mb-6" style={{ gap: 16 }}>
                                    <ActionButton icon="arrow-up-right" label="Withdraw" onPress={() => withdrawSheetRef.current?.expand()} />
                                </View>
                                <Text className="text-xl font-bold text-text-main mb-4">Recent Activity</Text>
                            </>
                        }
                        ListEmptyComponent={
                            <View className="items-center mt-10">
                                <Feather name="folder" size={48} color="#CBD5E1"/>
                                <Text className="text-lg text-gray-500 mt-4">No transactions yet.</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

            <BottomSheet
                ref={addMoneySheetRef}
                index={-1}
                snapPoints={addMoneySnapPoints}
                enablePanDownToClose
                backgroundStyle={{ backgroundColor: '#FFFFFF', borderRadius: 24 }}
                handleIndicatorStyle={{ backgroundColor: '#9CA3AF', width: 40 }}
            >
                <BottomSheetView style={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 0 }}>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-2xl font-bold text-text-main">Add Money to Wallet</Text>
                        <TouchableOpacity onPress={() => {
                            setAddMoneyErrors({});
                            setAddMoneyForm({ amount: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
                            addMoneySheetRef.current?.close();
                        }}>
                            <Feather name="x" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-sm font-semibold text-gray-700 mb-1.5">Amount</Text>
                    <TextInput
                        value={addMoneyForm.amount}
                        onChangeText={v => {
                            setAddMoneyForm(p => ({ ...p, amount: v }));
                            setAddMoneyErrors(e => ({ ...e, amount: undefined }));
                        }}
                        placeholder="Amount (N$)"
                        className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.amount ? 'border-red-500' : 'border-gray-200'}`}
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                    />
                    {addMoneyErrors.amount && (
                        <Text className="text-xs text-red-500 mb-2">{addMoneyErrors.amount}</Text>
                    )}
                    <Text className="text-sm font-semibold text-gray-700 mb-1.5 mt-2">Cardholder Name</Text>
                    <TextInput
                        value={addMoneyForm.cardHolder}
                        onChangeText={v => {
                            setAddMoneyForm(p => ({ ...p, cardHolder: v }));
                            setAddMoneyErrors(e => ({ ...e, cardHolder: undefined }));
                        }}
                        placeholder="Cardholder Name"
                        className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.cardHolder ? 'border-red-500' : 'border-gray-200'}`}
                        placeholderTextColor="#9CA3AF"
                    />
                    {addMoneyErrors.cardHolder && (
                        <Text className="text-xs text-red-500 mb-2">{addMoneyErrors.cardHolder}</Text>
                    )}
                    <Text className="text-sm font-semibold text-gray-700 mb-1.5 mt-2">Card Number</Text>
                    <TextInput
                        value={addMoneyForm.cardNumber}
                        onChangeText={v => {
                            setAddMoneyForm(p => ({ ...p, cardNumber: v }));
                            setAddMoneyErrors(e => ({ ...e, cardNumber: undefined }));
                        }}
                        placeholder="Card Number"
                        className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.cardNumber ? 'border-red-500' : 'border-gray-200'}`}
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                    />
                    {addMoneyErrors.cardNumber && (
                        <Text className="text-xs text-red-500 mb-2">{addMoneyErrors.cardNumber}</Text>
                    )}
                    <View className="flex-row mt-2" style={{ gap: 12 }}>
                        <View className="flex-1">
                            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Expiry Date</Text>
                            <TextInput
                                value={addMoneyForm.expiryDate}
                                onChangeText={v => {
                                    setAddMoneyForm(p => ({ ...p, expiryDate: formatExpiryDate(v) }));
                                    setAddMoneyErrors(e => ({ ...e, expiryDate: undefined }));
                                }}
                                placeholder="MM/YY"
                                className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.expiryDate ? 'border-red-500' : 'border-gray-200'}`}
                                maxLength={5}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-semibold text-gray-700 mb-1.5">CVV</Text>
                            <TextInput
                                value={addMoneyForm.cvv}
                                onChangeText={v => {
                                    setAddMoneyForm(p => ({ ...p, cvv: v }));
                                    setAddMoneyErrors(e => ({ ...e, cvv: undefined }));
                                }}
                                placeholder="CVV"
                                className={`bg-white p-4 rounded-2xl mb-1 border ${addMoneyErrors.cvv ? 'border-red-500' : 'border-gray-200'}`}
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
                                    <Text className="text-xs text-red-500">{addMoneyErrors.expiryDate}</Text>
                                )}
                            </View>
                            <View className="flex-1 pl-1">
                                {addMoneyErrors.cvv && (
                                    <Text className="text-xs text-red-500 text-right">{addMoneyErrors.cvv}</Text>
                                )}
                            </View>
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={handleAddMoney}
                        disabled={isSubmitting}
                        className={`bg-green-600 p-4 rounded-xl mb-4 ${isSubmitting && 'opacity-50'}`}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-semibold text-center text-lg">Confirm Deposit</Text>
                        )}
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>

            <BottomSheet
                ref={fundOthersSheetRef}
                index={-1}
                snapPoints={fundOthersSnapPoints}
                enablePanDownToClose
                backgroundStyle={{ backgroundColor: '#FFFFFF', borderRadius: 24 }}
                handleIndicatorStyle={{ backgroundColor: '#9CA3AF', width: 40 }}
            >
                <BottomSheetView style={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 0 }}>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-2xl font-bold text-text-main">Send Funds</Text>
                        <TouchableOpacity onPress={() => {
                            setFundOthersErrors({});
                            setFundOthersForm({ amount: '', walletID: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
                            fundOthersSheetRef.current?.close();
                        }}>
                            <Feather name="x" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-sm font-semibold text-gray-700 mb-1.5">Recipient's Wallet ID</Text>
                    <TextInput
                        value={fundOthersForm.walletID}
                        onChangeText={v => {
                            setFundOthersForm(p => ({ ...p, walletID: v }));
                            setFundOthersErrors(e => ({ ...e, walletID: undefined }));
                        }}
                        placeholder="Recipient's Wallet ID"
                        className={`bg-white p-4 rounded-2xl mb-1 border ${fundOthersErrors.walletID ? 'border-red-500' : 'border-gray-200'}`}
                        placeholderTextColor="#9CA3AF"
                    />
                    {fundOthersErrors.walletID && (
                        <Text className="text-xs text-red-500 mb-2">{fundOthersErrors.walletID}</Text>
                    )}
                    <Text className="text-sm font-semibold text-gray-700 mb-1.5 mt-2">Amount</Text>
                    <TextInput
                        value={fundOthersForm.amount}
                        onChangeText={v => {
                            setFundOthersForm(p => ({ ...p, amount: v }));
                            setFundOthersErrors(e => ({ ...e, amount: undefined }));
                        }}
                        placeholder="Amount (N$)"
                        className={`bg-white p-4 rounded-2xl mb-1 border ${fundOthersErrors.amount ? 'border-red-500' : 'border-gray-200'}`}
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                    />
                    {fundOthersErrors.amount && (
                        <Text className="text-xs text-red-500 mb-2">{fundOthersErrors.amount}</Text>
                    )}
                    <Text className="text-sm font-semibold text-gray-700 mb-1.5 mt-2">Cardholder Name</Text>
                    <TextInput
                        value={fundOthersForm.cardHolder}
                        onChangeText={v => {
                            setFundOthersForm(p => ({ ...p, cardHolder: v }));
                            setFundOthersErrors(e => ({ ...e, cardHolder: undefined }));
                        }}
                        placeholder="Cardholder Name"
                        className={`bg-white p-4 rounded-2xl mb-1 border ${fundOthersErrors.cardHolder ? 'border-red-500' : 'border-gray-200'}`}
                        placeholderTextColor="#9CA3AF"
                    />
                    {fundOthersErrors.cardHolder && (
                        <Text className="text-xs text-red-500 mb-2">{fundOthersErrors.cardHolder}</Text>
                    )}
                    <Text className="text-sm font-semibold text-gray-700 mb-1.5 mt-2">Card Number</Text>
                    <TextInput
                        value={fundOthersForm.cardNumber}
                        onChangeText={v => {
                            setFundOthersForm(p => ({ ...p, cardNumber: v }));
                            setFundOthersErrors(e => ({ ...e, cardNumber: undefined }));
                        }}
                        placeholder="Card Number"
                        className={`bg-white p-4 rounded-2xl mb-1 border ${fundOthersErrors.cardNumber ? 'border-red-500' : 'border-gray-200'}`}
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                    />
                    {fundOthersErrors.cardNumber && (
                        <Text className="text-xs text-red-500 mb-2">{fundOthersErrors.cardNumber}</Text>
                    )}
                    <View className="flex-row mt-2" style={{ gap: 12 }}>
                        <View className="flex-1">
                            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Expiry Date</Text>
                            <TextInput
                                value={fundOthersForm.expiryDate}
                                onChangeText={v => {
                                    setFundOthersForm(p => ({ ...p, expiryDate: formatExpiryDate(v) }));
                                    setFundOthersErrors(e => ({ ...e, expiryDate: undefined }));
                                }}
                                placeholder="MM/YY"
                                className={`bg-white p-4 rounded-2xl mb-1 border ${fundOthersErrors.expiryDate ? 'border-red-500' : 'border-gray-200'}`}
                                maxLength={5}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-semibold text-gray-700 mb-1.5">CVV</Text>
                            <TextInput
                                value={fundOthersForm.cvv}
                                onChangeText={v => {
                                    setFundOthersForm(p => ({ ...p, cvv: v }));
                                    setFundOthersErrors(e => ({ ...e, cvv: undefined }));
                                }}
                                placeholder="CVV"
                                className={`bg-white p-4 rounded-2xl mb-1 border ${fundOthersErrors.cvv ? 'border-red-500' : 'border-gray-200'}`}
                                keyboardType="numeric"
                                secureTextEntry
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                    </View>
                    {(fundOthersErrors.expiryDate || fundOthersErrors.cvv) && (
                        <View className="flex-row justify-between mb-2">
                            <View className="flex-1 pr-1">
                                {fundOthersErrors.expiryDate && (
                                    <Text className="text-xs text-red-500">{fundOthersErrors.expiryDate}</Text>
                                )}
                            </View>
                            <View className="flex-1 pl-1">
                                {fundOthersErrors.cvv && (
                                    <Text className="text-xs text-red-500 text-right">{fundOthersErrors.cvv}</Text>
                                )}
                            </View>
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={handleFundOthers}
                        disabled={isSubmitting}
                        className={`bg-green-600 p-4 rounded-xl mb-4 ${isSubmitting && 'opacity-50'}`}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-semibold text-center text-lg">Send Money</Text>
                        )}
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>

            <BottomSheet
                ref={withdrawSheetRef}
                index={-1}
                snapPoints={withdrawSnapPoints}
                enablePanDownToClose
                backgroundStyle={{ backgroundColor: '#FFFFFF', borderRadius: 24 }}
                handleIndicatorStyle={{ backgroundColor: '#9CA3AF', width: 40 }}
            >
                <BottomSheetView style={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 0 }}>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-2xl font-bold text-text-main">Withdraw to Card</Text>
                        <TouchableOpacity onPress={() => {
                            setWithdrawErrors({});
                            setWithdrawForm({ amount: '' });
                            withdrawSheetRef.current?.close();
                        }}>
                            <Feather name="x" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-sm font-semibold text-gray-700 mb-1.5">Amount</Text>
                    <TextInput
                        value={withdrawForm.amount}
                        onChangeText={v => {
                            setWithdrawForm(p => ({ ...p, amount: v }));
                            setWithdrawErrors(e => ({ ...e, amount: undefined }));
                        }}
                        placeholder="Amount to Withdraw (N$)"
                        className={`bg-white p-4 rounded-2xl mb-1 border ${withdrawErrors.amount ? 'border-red-500' : 'border-gray-200'}`}
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                    />
                    {withdrawErrors.amount && (
                        <Text className="text-xs text-red-500 mb-3">{withdrawErrors.amount}</Text>
                    )}
                    <TouchableOpacity
                        onPress={handleWithdraw}
                        disabled={isSubmitting}
                        className={`bg-green-600 p-4 rounded-xl mb-4 ${isSubmitting && 'opacity-50'}`}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-semibold text-center text-lg">Confirm Withdrawal</Text>
                        )}
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>
        </View>
    );
}