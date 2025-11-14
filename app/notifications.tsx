import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router'; // Import useRouter
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext'; // Corrected path for root level
import apiClient from '../lib/api'; // Corrected path for root level

// --- Type Definition ---
interface Notification {
  _id: string;
  title: string;
  message: string;
  status: 'sent' | 'read';
  createdAt: string;
}

const NotificationCard = ({ item }: { item: Notification }) => (
    <View className={`p-4 rounded-xl mb-3 border ${item.status === 'sent' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
            <Feather name="bell" size={20} color={item.status === 'sent' ? '#007BFF' : '#6C757D'} />
            <View className="flex-1">
                <Text className="text-base font-bold text-text-main">{item.title}</Text>
                <Text className="text-sm text-gray-600 mt-1">{item.message}</Text>
                <Text className="text-xs text-gray-400 mt-2">{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
        </View>
    </View>
);

export default function NotificationsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        if (!user?.userId) return;
        setIsLoading(true);
        try {
            // NOTE: You need to confirm the API path for notifications from your backend router
            const response = await apiClient.get(`/notification/all/${user.userId}`);
            setNotifications(response.data.data || []);
        } catch (error: any) {
            Alert.alert("Error", "Could not fetch notifications.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const markAllAsRead = useCallback(async () => {
        if (!user?.userId || notifications.every(n => n.status === 'read')) return;
        try {
            // NOTE: You need to confirm the API path
            await apiClient.patch(`/notification/mark-as-read/${user.userId}`);
            setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
        } catch (error: any) {
            Alert.alert("Error", "Could not mark notifications as read.");
        }
    }, [user, notifications]);

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
            // When the user enters this screen, mark all as read after a delay
            const timer = setTimeout(() => {
                markAllAsRead();
            }, 2000);

            return () => clearTimeout(timer);
        }, [fetchNotifications, markAllAsRead])
    );
    
    return (
        // Use edges to avoid the top notch, since this is a root screen
        <SafeAreaView className="flex-1 bg-background-light" edges={['top', 'left', 'right']}>
            {isLoading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#007BFF" />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item._id}
                    renderItem={({ item }) => <NotificationCard item={item} />}
                    contentContainerStyle={{ padding: 16 }}
                    ListHeaderComponent={
                        <View className="flex-row justify-between items-center mb-4">
                            {/* Add a back button for navigation */}
                            <TouchableOpacity onPress={() => router.back()} className="p-2">
                                <Feather name="arrow-left" size={24} color="#6C757D" />
                            </TouchableOpacity>
                            <Text className="text-2xl font-bold text-text-main">Notifications</Text>
                            <TouchableOpacity onPress={markAllAsRead} className="p-2">
                                <Text className="font-semibold text-primary">Mark all as read</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    ListEmptyComponent={
                        <View className="items-center mt-20">
                            <Feather name="bell-off" size={48} color="#CBD5E1" />
                            <Text className="text-lg text-gray-500 mt-4">No notifications yet.</Text>
                        </View>
                    }
                    onRefresh={fetchNotifications}
                    refreshing={isLoading}
                />
            )}
        </SafeAreaView>
    );
}