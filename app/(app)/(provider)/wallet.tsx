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
    const isEarning = item.type === 'earning';
    const isPositive = isDeposit || isEarning;
    const isFundedToOthers = isDeposit && item.walletID && userWalletID && item.walletID !== userWalletID;
    
    // Determine the transaction label
    let label = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    if (isDeposit && isFundedToOthers) {
        label = 'Funded Wallet';
    } else if (isDeposit && !isFundedToOthers) {
        label = 'Deposit';
    } else if (isEarning) {
        label = 'Earning';
    }
    
    return (
        <View className="flex-row items-center justify-between bg-white p-4 rounded-xl mb-3 border border-gray-100 shadow-sm">
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className={`w-10 h-10 rounded-full items-center justify-center ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Feather name={isPositive ? "arrow-down-left" : "arrow-up-right"} size={20} color={isPositive ? "#28A745" : "#EF4444"} />
                </View>
                <View>
                    <Text className="text-base font-bold text-text-main">{label}</Text>
                    <Text className="text-sm text-gray-500">{new Date(item.time).toLocaleString()}</Text>
                </View>
            </View>
            <Text className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                {isPositive ? '+' : '-'}N$ {item.amount.toFixed(2)}
            </Text>
        </View>
    );
};

export default function TransactionsScreen() {
    const { user, updateUser } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addMoneySheetRef = useRef<BottomSheet>(null);
    const fundOthersSheetRef = useRef<BottomSheet>(null);
    const withdrawSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%'], []);

    const [addMoneyForm, setAddMoneyForm] = useState({ amount: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
    const [fundOthersForm, setFundOthersForm] = useState({ amount: '', walletID: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
    const [withdrawForm, setWithdrawForm] = useState({ amount: '' });

    const fetchTransactions = useCallback(async () => {
        if (!user?.userId) {
            setTransactions([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/app/transaction/transaction-history/${user.userId}`);
            setTransactions(response.data.data || []);
        } catch (error: any) {
            console.error("Fetch Transactions Error:", error.message);
            Alert.alert("Error", "Failed to fetch transactions.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // --- THIS IS THE CORRECTED useFocusEffect HOOK ---
    useFocusEffect(
      useCallback(() => {
        fetchTransactions();
      }, [fetchTransactions])
    );
    // ---------------------------------------------

    // --- FULLY IMPLEMENTED handleAddMoney ---
    const handleAddMoney = async () => {
        if (!addMoneyForm.amount || !addMoneyForm.cardNumber || !addMoneyForm.expiryDate || !addMoneyForm.cvv || !addMoneyForm.cardHolder) {
            return Alert.alert("Missing Fields", "Please fill in all card details.");
        }
        setIsSubmitting(true);
        try {
            const response = await apiClient.post(`/app/transaction/fund-wallet/${user?.userId}`, addMoneyForm);
            Alert.alert("Success", response.data.message);
            if (response.data.user) {
                updateUser(response.data.user);
            }
            fetchTransactions();
            addMoneySheetRef.current?.close();
            setAddMoneyForm({ amount: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
        } catch (error: any) {
            Alert.alert("Deposit Failed", error.response?.data?.message || "An error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- FULLY IMPLEMENTED handleSendMoney (Fund Someone's Wallet with Card) ---
    const handleFundOthers = async () => {
        if (!fundOthersForm.amount || !fundOthersForm.walletID || !fundOthersForm.cardNumber || !fundOthersForm.expiryDate || !fundOthersForm.cvv || !fundOthersForm.cardHolder) {
            return Alert.alert("Missing Fields", "Please fill in all card details and wallet ID.");
        }
        setIsSubmitting(true);
        try {
            const response = await apiClient.post(`/app/transaction/fund-other-wallet/${user?.userId}`, fundOthersForm);
            Alert.alert("Success", response.data.message);
            fetchTransactions();
            fundOthersSheetRef.current?.close();
            setFundOthersForm({ amount: '', walletID: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
        } catch (error: any) {
            Alert.alert("Transfer Failed", error.response?.data?.message || "An error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- FULLY IMPLEMENTED handleWithdraw ---
    const handleWithdraw = async () => {
        if (!withdrawForm.amount) {
            return Alert.alert("Missing Fields", "Please enter an amount to withdraw.");
        }
        setIsSubmitting(true);
        try {
            const response = await apiClient.post(`/app/transaction/withdraw-wallet-funds/${user?.userId}`, withdrawForm);
            Alert.alert("Success", response.data.message);
            if (response.data.user) {
                updateUser(response.data.user);
            }
            fetchTransactions();
            withdrawSheetRef.current?.close();
            setWithdrawForm({ amount: '' });
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
                        onRefresh={fetchTransactions}
                        refreshing={isLoading}
                        ListHeaderComponent={
                            <>
                                <View className="p-6 mb-6 border border-green-600 rounded-2xl">
                                    <View className="mb-6">
                                        <Text className="text-gray-600 text-lg">Your Balance</Text>
                                        <Text className="text-gray-900 text-4xl font-bold mt-1">
                                            N$ {user?.balance?.toFixed(2) || '0.00'}
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
                snapPoints={snapPoints}
                enablePanDownToClose
                backgroundStyle={{ backgroundColor: '#FFFFFF', borderRadius: 24 }}
                handleIndicatorStyle={{ backgroundColor: '#9CA3AF', width: 40 }}
            >
                <BottomSheetView style={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 0 }}>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-2xl font-bold text-text-main">Add Money to Wallet</Text>
                        <TouchableOpacity onPress={() => addMoneySheetRef.current?.close()}>
                            <Feather name="x" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>
                    <TextInput value={addMoneyForm.amount} onChangeText={v => setAddMoneyForm(p => ({ ...p, amount: v }))} placeholder="Amount (N$)" className="bg-white p-4 rounded-2xl mb-3 border border-gray-200" keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    <TextInput value={addMoneyForm.cardHolder} onChangeText={v => setAddMoneyForm(p => ({ ...p, cardHolder: v }))} placeholder="Cardholder Name" className="bg-white p-4 rounded-2xl mb-3 border border-gray-200" placeholderTextColor="#9CA3AF"/>
                    <TextInput value={addMoneyForm.cardNumber} onChangeText={v => setAddMoneyForm(p => ({ ...p, cardNumber: v }))} placeholder="Card Number" className="bg-white p-4 rounded-2xl mb-3 border border-gray-200" keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    <View className="flex-row" style={{ gap: 12 }}>
                        <TextInput value={addMoneyForm.expiryDate} onChangeText={v => setAddMoneyForm(p => ({ ...p, expiryDate: formatExpiryDate(v) }))} placeholder="MM/YY" className="bg-white p-4 rounded-2xl mb-4 flex-1 border border-gray-200" maxLength={5} placeholderTextColor="#9CA3AF"/>
                        <TextInput value={addMoneyForm.cvv} onChangeText={v => setAddMoneyForm(p => ({ ...p, cvv: v }))} placeholder="CVV" className="bg-white p-4 rounded-2xl mb-4 flex-1 border border-gray-200" keyboardType="numeric" secureTextEntry placeholderTextColor="#9CA3AF"/>
                    </View>
                    <TouchableOpacity onPress={handleAddMoney} disabled={isSubmitting} className={`bg-green-600 p-4 rounded-xl ${isSubmitting && 'opacity-50'}`}>
                        {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-center text-lg">Confirm Deposit</Text>}
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>

            <BottomSheet
                ref={fundOthersSheetRef}
                index={-1}
                snapPoints={snapPoints}
                enablePanDownToClose
                backgroundStyle={{ backgroundColor: '#FFFFFF', borderRadius: 24 }}
                handleIndicatorStyle={{ backgroundColor: '#9CA3AF', width: 40 }}
            >
                <BottomSheetView style={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 0 }}>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-2xl font-bold text-text-main">Send Funds</Text>
                        <TouchableOpacity onPress={() => fundOthersSheetRef.current?.close()}>
                            <Feather name="x" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>
                    <TextInput value={fundOthersForm.walletID} onChangeText={v => setFundOthersForm(p => ({ ...p, walletID: v }))} placeholder="Recipient's Wallet ID" className="bg-white p-4 rounded-2xl mb-3 border border-gray-200 text-gray-700" placeholderTextColor="#9CA3AF" />
                    <TextInput value={fundOthersForm.amount} onChangeText={v => setFundOthersForm(p => ({ ...p, amount: v }))} placeholder="Amount (N$)" className="bg-white p-4 rounded-2xl mb-3 border border-gray-200" keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    <TextInput value={fundOthersForm.cardHolder} onChangeText={v => setFundOthersForm(p => ({ ...p, cardHolder: v }))} placeholder="Cardholder Name" className="bg-white p-4 rounded-2xl mb-3 border border-gray-200" placeholderTextColor="#9CA3AF"/>
                    <TextInput value={fundOthersForm.cardNumber} onChangeText={v => setFundOthersForm(p => ({ ...p, cardNumber: v }))} placeholder="Card Number" className="bg-white p-4 rounded-2xl mb-3 border border-gray-200" keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    <View className="flex-row" style={{ gap: 12 }}>
                        <TextInput value={fundOthersForm.expiryDate} onChangeText={v => setFundOthersForm(p => ({ ...p, expiryDate: formatExpiryDate(v) }))} placeholder="MM/YY" className="bg-white p-4 rounded-2xl mb-4 flex-1 border border-gray-200" maxLength={5} placeholderTextColor="#9CA3AF"/>
                        <TextInput value={fundOthersForm.cvv} onChangeText={v => setFundOthersForm(p => ({ ...p, cvv: v }))} placeholder="CVV" className="bg-white p-4 rounded-2xl mb-4 flex-1 border border-gray-200" keyboardType="numeric" secureTextEntry placeholderTextColor="#9CA3AF"/>
                    </View>
                    <TouchableOpacity onPress={handleFundOthers} disabled={isSubmitting} className={`bg-green-600 p-4 rounded-xl ${isSubmitting && 'opacity-50'}`}>
                        {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-center text-lg">Send Money</Text>}
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>

            <BottomSheet
                ref={withdrawSheetRef}
                index={-1}
                snapPoints={snapPoints}
                enablePanDownToClose
                backgroundStyle={{ backgroundColor: '#FFFFFF', borderRadius: 24 }}
                handleIndicatorStyle={{ backgroundColor: '#9CA3AF', width: 40 }}
            >
                <BottomSheetView style={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 0 }}>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-2xl font-bold text-text-main">Withdraw to Card</Text>
                        <TouchableOpacity onPress={() => withdrawSheetRef.current?.close()}>
                            <Feather name="x" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>
                    <TextInput value={withdrawForm.amount} onChangeText={v => setWithdrawForm(p => ({ ...p, amount: v }))} placeholder="Amount to Withdraw (N$)" className="bg-white p-4 rounded-2xl mb-4 border border-gray-200" keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    <TouchableOpacity onPress={handleWithdraw} disabled={isSubmitting} className={`bg-green-600 p-4 rounded-xl ${isSubmitting && 'opacity-50'}`}>
                        {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-center text-lg">Confirm Withdrawal</Text>}
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>
        </View>
    );
}