import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from "../context/AuthContext";
import apiClient from "../lib/api";
import socketService from "../lib/socket";

interface Transaction {
  _id: string;
  amount: number;
  type: "deposit" | "withdrawal" | "earning" | "transfer";
  status: "completed" | "pending" | "failed";
  referrence?: string;
  time: string;
  createdAt: string;
}

export default function Wallet() {
  const { user, updateUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(user?.balance || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch transactions from API
  const fetchTransactions = useCallback(async () => {
    try {
      if (!user?.userId) return;
      
      const response = await apiClient.get(`/transactions/${user.userId}`);
      const transactionData = response.data.transactions || [];
      setTransactions(transactionData.sort((a: Transaction, b: Transaction) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.userId]);

  // Initialize socket listeners and fetch data
  useEffect(() => {
    fetchTransactions();

    if (!user?.userId) return;

    // Listen for real-time transaction updates
    socketService.on("transaction:new", (transaction: Transaction) => {
      console.log('New transaction received:', transaction);
      setTransactions(prev => [transaction, ...prev]);
      // Update user balance
      if (transaction.status === "completed") {
        setBalance(prev => prev + transaction.amount);
        updateUser({ balance: balance + transaction.amount });
      }
    });

    // Listen for transaction status updates
    socketService.on("transaction:updated", (transaction: Transaction) => {
      console.log('Transaction updated:', transaction);
      setTransactions(prev =>
        prev.map(t => (t._id === transaction._id ? transaction : t))
      );
      // Update balance if transaction is now completed
      if (transaction.status === "completed") {
        setBalance(prev => prev + transaction.amount);
        updateUser({ balance: balance + transaction.amount });
      }
    });

    // Listen for balance updates
    socketService.on("wallet:balance:updated", (data: { newBalance: number }) => {
      console.log('Balance updated:', data.newBalance);
      setBalance(data.newBalance);
      updateUser({ balance: data.newBalance });
    });

    return () => {
      socketService.off("transaction:new");
      socketService.off("transaction:updated");
      socketService.off("wallet:balance:updated");
    };
  }, [user?.userId, fetchTransactions, updateUser, balance]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchTransactions();
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "deposit":
        return "text-green-600";
      case "withdrawal":
        return "text-red-600";
      case "earning":
        return "text-blue-600";
      case "transfer":
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "deposit":
        return "Deposit";
      case "withdrawal":
        return "Withdrawal";
      case "earning":
        return "Earning";
      case "transfer":
        return "Transfer";
      default:
        return type;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100";
      case "pending":
        return "bg-yellow-100";
      case "failed":
        return "bg-red-100";
      default:
        return "bg-gray-100";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-700";
      case "pending":
        return "text-yellow-700";
      case "failed":
        return "text-red-700";
      default:
        return "text-gray-700";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
    }
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
      <View className="flex-1">
        <Text className={`text-base font-semibold ${getTransactionTypeColor(item.type)}`}>
          {getTransactionTypeLabel(item.type)}
        </Text>
        <Text className="text-sm text-gray-500 mt-1">
          {formatDate(item.createdAt)}
        </Text>
        {item.referrence && (
          <Text className="text-xs text-gray-400 mt-1">Ref: {item.referrence}</Text>
        )}
      </View>
      <View className="items-end ml-4">
        <Text className={`text-base font-bold ${getTransactionTypeColor(item.type)}`}>
          {item.type === "withdrawal" || item.type === "transfer" ? "-" : "+"}P{item.amount.toFixed(2)}
        </Text>
        <View className={`${getStatusBadgeColor(item.status)} rounded-full px-3 py-1 mt-1`}>
          <Text className={`text-xs font-semibold capitalize ${getStatusTextColor(item.status)}`}>
            {item.status}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={150}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={["#16a34a"]}
          />
        }
      >
        {/* Header */}
        <View className="bg-white p-6 border-b border-gray-200">
          <Text className="text-2xl font-bold text-gray-900">Wallet</Text>
          
          {/* Balance Card */}
          <View className="mt-6 bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6">
            <Text className="text-white text-sm font-medium">Current Balance</Text>
            <Text className="text-white text-4xl font-bold mt-2">
              P{balance.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Transactions List */}
        <View className="flex-1 mt-2">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#16a34a" />
              <Text className="text-gray-600 mt-2">Loading transactions...</Text>
            </View>
          ) : transactions.length > 0 ? (
            <>
              <Text className="px-6 py-4 text-gray-600 font-semibold">
                Transaction History
              </Text>
              <FlatList
                data={transactions}
                renderItem={renderTransactionItem}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            </>
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-xl font-semibold text-gray-700">No transactions yet</Text>
              <Text className="text-gray-500 text-center mt-2">
                Your wallet transactions will appear here once you make your first transaction.
              </Text>
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
