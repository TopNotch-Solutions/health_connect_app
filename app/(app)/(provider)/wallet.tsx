import { Feather } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
}

// --- Reusable Components ---
const ActionButton = ({ icon, label, onPress }: { icon: any; label: string; onPress: () => void; }) => (
    <TouchableOpacity onPress={onPress} className="items-center bg-white p-4 rounded-2xl flex-1 border border-gray-200 shadow-sm">
        <Feather name={icon} size={24} color="#007BFF" />
        <Text className="text-primary font-semibold mt-2">{label}</Text>
    </TouchableOpacity>
);

const TransactionRow = ({ item }: { item: Transaction }) => {
    const isDeposit = item.type === 'deposit';
    return (
        <View className="flex-row items-center justify-between bg-white p-4 rounded-xl mb-3 border border-gray-100 shadow-sm">
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className={`w-10 h-10 rounded-full items-center justify-center ${isDeposit ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Feather name={isDeposit ? "arrow-down-left" : "arrow-up-right"} size={20} color={isDeposit ? "#28A745" : "#EF4444"} />
                </View>
                <View>
                    <Text className="text-base font-bold text-text-main capitalize">{item.type}</Text>
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addMoneySheetRef = useRef<BottomSheet>(null);
    const sendMoneySheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%'], []);

    const [addMoneyForm, setAddMoneyForm] = useState({ amount: '', cardNumber: '', expiryDate: '', cvv: '', cardHolder: '' });
    const [sendMoneyForm, setSendMoneyForm] = useState({ amount: '', walletID: '' });

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

    // --- FULLY IMPLEMENTED handleSendMoney ---
    const handleSendMoney = async () => {
        if (!sendMoneyForm.amount || !sendMoneyForm.walletID) {
            return Alert.alert("Missing Fields", "Please provide a Wallet ID and amount.");
        }
        setIsSubmitting(true);
        try {
            const response = await apiClient.post(`/app/transaction/wallet-wallet-transfer/${user?.userId}`, sendMoneyForm);
            Alert.alert("Success", response.data.message);
            if (response.data.user) {
                updateUser(response.data.user);
            }
            fetchTransactions();
            sendMoneySheetRef.current?.close();
            setSendMoneyForm({ amount: '', walletID: '' });
        } catch (error: any) {
            Alert.alert("Transfer Failed", error.response?.data?.message || "An error occurred.");
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
                        renderItem={({ item }) => <TransactionRow item={item} />}
                        contentContainerStyle={{ padding: 16 }}
                        onRefresh={fetchTransactions}
                        refreshing={isLoading}
                        ListHeaderComponent={
                            <>
                                <View className="bg-primary p-6 rounded-2xl mb-6 items-center shadow-md">
                                    <Text className="text-white text-lg opacity-80">Your Balance</Text>
                                    <Text className="text-white text-4xl font-bold mt-1">N$ {user?.balance?.toFixed(2) || '0.00'}</Text>
                                </View>
                                <View className="flex-row mb-6" style={{ gap: 16 }}>
                                    <ActionButton icon="plus-circle" label="Add Money" onPress={() => addMoneySheetRef.current?.expand()} />
                                    <ActionButton icon="send" label="Send Money" onPress={() => sendMoneySheetRef.current?.expand()} />
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

            <BottomSheet ref={addMoneySheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose backgroundStyle={{ backgroundColor: '#F9FAFB' }}>
                <BottomSheetView className="p-6">
                    <Text className="text-2xl font-bold text-text-main mb-4">Add Money to Wallet</Text>
                    <TextInput value={addMoneyForm.amount} onChangeText={v => setAddMoneyForm(p => ({ ...p, amount: v }))} placeholder="Amount (N$)" className="bg-white p-4 rounded-xl mb-3 border border-gray-200" keyboardType="numeric"/>
                    <TextInput value={addMoneyForm.cardHolder} onChangeText={v => setAddMoneyForm(p => ({ ...p, cardHolder: v }))} placeholder="Cardholder Name" className="bg-white p-4 rounded-xl mb-3 border border-gray-200"/>
                    <TextInput value={addMoneyForm.cardNumber} onChangeText={v => setAddMoneyForm(p => ({ ...p, cardNumber: v }))} placeholder="Card Number" className="bg-white p-4 rounded-xl mb-3 border border-gray-200" keyboardType="numeric"/>
                    <View className="flex-row" style={{ gap: 12 }}>
                        <TextInput value={addMoneyForm.expiryDate} onChangeText={v => setAddMoneyForm(p => ({ ...p, expiryDate: v }))} placeholder="Expiry (MM/YY)" className="bg-white p-4 rounded-xl mb-4 flex-1 border border-gray-200"/>
                        <TextInput value={addMoneyForm.cvv} onChangeText={v => setAddMoneyForm(p => ({ ...p, cvv: v }))} placeholder="CVV" className="bg-white p-4 rounded-xl mb-4 flex-1 border border-gray-200" keyboardType="numeric" secureTextEntry/>
                    </View>
                    <TouchableOpacity onPress={handleAddMoney} disabled={isSubmitting} className={`bg-primary p-4 rounded-xl ${isSubmitting && 'opacity-50'}`}>
                        {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-center text-lg">Confirm Deposit</Text>}
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>

            <BottomSheet ref={sendMoneySheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose backgroundStyle={{ backgroundColor: '#F9FAFB' }}>
                <BottomSheetView className="p-6">
                    <Text className="text-2xl font-bold text-text-main mb-4">Send Money (Wallet-to-Wallet)</Text>
                    <TextInput value={sendMoneyForm.walletID} onChangeText={v => setSendMoneyForm(p => ({ ...p, walletID: v }))} placeholder="Recipient's Wallet ID" className="bg-white p-4 rounded-xl mb-3 border border-gray-200" />
                    <TextInput value={sendMoneyForm.amount} onChangeText={v => setSendMoneyForm(p => ({ ...p, amount: v }))} placeholder="Amount (N$)" className="bg-white p-4 rounded-xl mb-4 border border-gray-200" keyboardType="numeric"/>
                    <TouchableOpacity onPress={handleSendMoney} disabled={isSubmitting} className={`bg-primary p-4 rounded-xl ${isSubmitting && 'opacity-50'}`}>
                        {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-center text-lg">Send Money</Text>}
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>
        </View>
    );
}