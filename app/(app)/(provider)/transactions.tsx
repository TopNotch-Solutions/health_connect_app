import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
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
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

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
            const response = await apiClient.get(`/app/transaction/transaction-history/${user.userId}?page=${page}&limit=10`);
            console.log("Transactions Response:", response.data);
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

    useFocusEffect(
      useCallback(() => {
        fetchTransactions(false, 1);
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
