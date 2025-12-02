import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/api';

// --- Type Definitions ---
interface Transaction {
    _id: string;
    amount: number;
    type: 'deposit' | 'transfer' | 'withdrawal' | 'payment' | 'earning';
    status: string;
    time: string;
    walletID?: string;
}

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

export default function TransactionsHistoryScreen() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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

    useFocusEffect(
      useCallback(() => {
        fetchTransactions();
      }, [fetchTransactions])
    );

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom', 'left', 'right']}>
            {/* Transactions List */}
            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#10B981" />
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => <TransactionRow item={item} userWalletID={user?.walletID} />}
                    contentContainerStyle={{ padding: 16 }}
                    onRefresh={fetchTransactions}
                    refreshing={isLoading}
                    ListEmptyComponent={
                        <View className="items-center mt-10">
                            <Feather name="folder" size={48} color="#CBD5E1"/>
                            <Text className="text-lg text-gray-500 mt-4">No transactions yet.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
