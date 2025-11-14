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
    <TouchableOpacity onPress={onPress} className="items-center bg-white p-4 rounded-2xl flex-1 border border-gray-200">
        <Feather name={icon} size={24} color="#007BFF" />
        <Text className="text-primary font-semibold mt-2">{label}</Text>
    </TouchableOpacity>
);

const TransactionRow = ({ item }: { item: Transaction }) => {
    const isDeposit = item.type === 'deposit';
    return (
        <View className="flex-row items-center justify-between bg-white p-4 rounded-xl mb-3 border border-gray-100">
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
    const { user, login } = useAuth(); // Assume login updates user, or create a dedicated updateUser function
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- Bottom Sheet (Modal) Refs and State ---
    const addMoneySheetRef = useRef<BottomSheet>(null);
    const sendMoneySheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['25%', '60%'], []);

    // --- Form States for Modals ---
    const [addMoneyForm, setAddMoneyForm] = useState({ amount: '', cardNumber: '', expiryDate: '', cvv: '' });
    const [sendMoneyForm, setSendMoneyForm] = useState({ amount: '', walletID: '' });

    const fetchTransactions = useCallback(async () => {
        if (!user?._id) return;
        try {
            setIsLoading(true);
            const response = await apiClient.get(`/transactions/all/${user._id}`);
            setTransactions(response.data.data || []);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to fetch transactions.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

     useFocusEffect(
    useCallback(() => {
      // Define the async function inside the callback
      const fetchTransactions = async () => {
        if (!user?._id) {
          // If there's no user, stop loading and clear any old data
          setIsLoading(false);
          setTransactions([]);
          return;
        }
        
        try {
          setIsLoading(true);
          const response = await apiClient.get(`/transactions/all/${user._id}`);
          setTransactions(response.data.data || []);
        } catch (error) {
          console.error(error);
          Alert.alert("Error", "Failed to fetch transactions.");
        } finally {
          setIsLoading(false);
        }
      };

      // Call the async function
      fetchTransactions();

    }, [user]) // Re-run the effect if the user object changes
  );

    const handleAddMoney = async () => {
        // TODO: Add form validation
        console.log("Adding money:", addMoneyForm);
        // Call the fundOwnWallet API endpoint
        // On success, close sheet, refetch transactions, and maybe update user context
        addMoneySheetRef.current?.close();
    };

    const handleSendMoney = async () => {
        // TODO: Add form validation
        console.log("Sending money:", sendMoneyForm);
        // Call the wallet2Wallet API endpoint
        // On success, close sheet, refetch transactions, and update user context
        sendMoneySheetRef.current?.close();
    };

    return (
        <View className="flex-1">
            <SafeAreaView className="flex-1">
                {isLoading ? (
                    <ActivityIndicator size="large" className="mt-10"/>
                ) : (
                    <FlatList
                        data={transactions}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => <TransactionRow item={item} />}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                        ListHeaderComponent={
                            <>
                                {/* Balance Card */}
                                <View className="bg-primary p-6 rounded-2xl mb-6 items-center">
                                    <Text className="text-white text-lg opacity-80">Your Balance</Text>
                                    <Text className="text-white text-4xl font-bold mt-1">
                                        N$ {user?.balance?.toFixed(2) || '0.00'}
                                    </Text>
                                </View>

                                {/* Action Buttons */}
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

            {/* --- Add Money Bottom Sheet --- */}
            <BottomSheet ref={addMoneySheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose>
                <BottomSheetView style={{ padding: 24 }}>
                    <Text className="text-2xl font-bold text-text-main mb-4">Add Money to Wallet</Text>
                    <TextInput onChangeText={v => setAddMoneyForm(p => ({ ...p, amount: v }))} placeholder="Amount (N$)" className="bg-gray-100 p-4 rounded-xl mb-3" keyboardType="numeric"/>
                    <TextInput onChangeText={v => setAddMoneyForm(p => ({ ...p, cardNumber: v }))} placeholder="Card Number" className="bg-gray-100 p-4 rounded-xl mb-3" keyboardType="numeric"/>
                    <TextInput onChangeText={v => setAddMoneyForm(p => ({ ...p, expiryDate: v }))} placeholder="Expiry (MM/YY)" className="bg-gray-100 p-4 rounded-xl mb-3"/>
                    <TextInput onChangeText={v => setAddMoneyForm(p => ({ ...p, cvv: v }))} placeholder="CVV" className="bg-gray-100 p-4 rounded-xl mb-4" keyboardType="numeric" secureTextEntry/>
                    <TouchableOpacity onPress={handleAddMoney} className="bg-primary p-4 rounded-xl">
                        <Text className="text-white font-semibold text-center text-lg">Confirm Deposit</Text>
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>

            {/* --- Send Money Bottom Sheet --- */}
            <BottomSheet ref={sendMoneySheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose>
                <BottomSheetView style={{ padding: 24 }}>
                    <Text className="text-2xl font-bold text-text-main mb-4">Send Money</Text>
                    <TextInput onChangeText={v => setSendMoneyForm(p => ({ ...p, walletID: v }))} placeholder="Recipient's Wallet ID" className="bg-gray-100 p-4 rounded-xl mb-3" />
                    <TextInput onChangeText={v => setSendMoneyForm(p => ({ ...p, amount: v }))} placeholder="Amount (N$)" className="bg-gray-100 p-4 rounded-xl mb-4" keyboardType="numeric"/>
                    <TouchableOpacity onPress={handleSendMoney} className="bg-primary p-4 rounded-xl">
                        <Text className="text-white font-semibold text-center text-lg">Send Money</Text>
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>
        </View>
    );
}