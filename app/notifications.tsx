import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';

// --- Type Definition ---
type NotificationType =
  | 'welcome' | 'reminder' | 'alert' | 'promotion'
  | 'issue_reported' | 'issue_updated' | 'issue_resolved'
  | 'consultation_requested' | 'consultation_accepted' | 'consultation_rejected'
  | 'consultation_en_route' | 'consultation_arrived' | 'consultation_started'
  | 'consultation_completed' | 'consultation_cancelled'
  | 'location_updated' | 'location_changed' | 'location_pinned' | 'provider_nearby'
  | 'payment_required' | 'payment_completed' | 'payment_failed' | 'refund_processed'
  | 'rating_received' | 'rating_requested'
  | 'app_update' | 'maintenance_scheduled' | 'emergency_alert'
  | 'new_request_available' | 'request_expired' | 'schedule_reminder'
  | 'provider_assigned' | 'consultation_reminder' | 'follow_up_reminder'
  | 'qualification_expired' | 'qualification_expiring_soon';

type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  status: NotificationStatus;
  priority?: NotificationPriority;
  createdAt: string;
  readAt?: string;
}

// --- Notification Type Configuration ---
const getNotificationConfig = (type: NotificationType) => {
  const configs: Record<NotificationType, { icon: string; iconLib: 'feather' | 'material'; color: string; bgColor: string }> = {
    // General
    welcome: { icon: 'user-plus', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    reminder: { icon: 'clock', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    alert: { icon: 'alert-circle', iconLib: 'feather', color: '#F59E0B', bgColor: '#FEF3C7' },
    promotion: { icon: 'tag', iconLib: 'feather', color: '#8B5CF6', bgColor: '#EDE9FE' },
    
    // Issue related
    issue_reported: { icon: 'file-text', iconLib: 'feather', color: '#EF4444', bgColor: '#FEE2E2' },
    issue_updated: { icon: 'edit', iconLib: 'feather', color: '#F59E0B', bgColor: '#FEF3C7' },
    issue_resolved: { icon: 'check-circle', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    
    // Consultation related
    consultation_requested: { icon: 'calendar', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    consultation_accepted: { icon: 'check-circle', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    consultation_rejected: { icon: 'x-circle', iconLib: 'feather', color: '#EF4444', bgColor: '#FEE2E2' },
    consultation_en_route: { icon: 'navigation', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    consultation_arrived: { icon: 'map-pin', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    consultation_started: { icon: 'play-circle', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    consultation_completed: { icon: 'check-circle', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    consultation_cancelled: { icon: 'x-circle', iconLib: 'feather', color: '#EF4444', bgColor: '#FEE2E2' },
    
    // Location related
    location_updated: { icon: 'map-pin', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    location_changed: { icon: 'navigation', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    location_pinned: { icon: 'map-pin', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    provider_nearby: { icon: 'users', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    
    // Payment related
    payment_required: { icon: 'credit-card', iconLib: 'feather', color: '#F59E0B', bgColor: '#FEF3C7' },
    payment_completed: { icon: 'check-circle', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    payment_failed: { icon: 'x-circle', iconLib: 'feather', color: '#EF4444', bgColor: '#FEE2E2' },
    refund_processed: { icon: 'refresh-cw', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    
    // Rating related
    rating_received: { icon: 'star', iconLib: 'feather', color: '#F59E0B', bgColor: '#FEF3C7' },
    rating_requested: { icon: 'star', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    
    // System related
    app_update: { icon: 'download', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    maintenance_scheduled: { icon: 'tool', iconLib: 'feather', color: '#F59E0B', bgColor: '#FEF3C7' },
    emergency_alert: { icon: 'alert-triangle', iconLib: 'feather', color: '#EF4444', bgColor: '#FEE2E2' },
    
    // Provider specific
    new_request_available: { icon: 'bell', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    request_expired: { icon: 'clock', iconLib: 'feather', color: '#6B7280', bgColor: '#F3F4F6' },
    schedule_reminder: { icon: 'calendar', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    
    // Patient specific
    provider_assigned: { icon: 'user-check', iconLib: 'feather', color: '#10B981', bgColor: '#D1FAE5' },
    consultation_reminder: { icon: 'bell', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    follow_up_reminder: { icon: 'repeat', iconLib: 'feather', color: '#3B82F6', bgColor: '#DBEAFE' },
    
    // Document related
    qualification_expired: { icon: 'file-x', iconLib: 'feather', color: '#EF4444', bgColor: '#FEE2E2' },
    qualification_expiring_soon: { icon: 'alert-circle', iconLib: 'feather', color: '#F59E0B', bgColor: '#FEF3C7' },
  };
  
  return configs[type] || { icon: 'bell', iconLib: 'feather', color: '#6B7280', bgColor: '#F3F4F6' };
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

const NotificationCard = ({ item, onPress }: { item: Notification; onPress?: () => void }) => {
  const config = getNotificationConfig(item.type);
  const isUnread = item.status === 'sent' || item.status === 'delivered' || item.status === 'pending';
  const priority = item.priority || 'medium';
  
  const getPriorityBorder = () => {
    if (priority === 'urgent') return '#EF4444';
    if (priority === 'high') return '#F59E0B';
    return 'transparent';
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: isUnread ? config.bgColor : '#FFFFFF',
          borderLeftWidth: priority === 'urgent' || priority === 'high' ? 4 : 0,
          borderLeftColor: getPriorityBorder(),
        },
      ]}
    >
      <View style={styles.cardContent}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: config.bgColor },
          ]}
        >
          {config.iconLib === 'feather' ? (
            <Feather name={config.icon as any} size={22} color={config.color} />
          ) : (
            <MaterialCommunityIcons name={config.icon as any} size={22} color={config.color} />
          )}
        </View>
        
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isUnread && styles.titleBold]}>
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          
          <Text style={styles.message}>
            {item.message}
          </Text>
          
          <View style={styles.footer}>
            <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
            {priority === 'urgent' && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>Urgent</Text>
              </View>
            )}
            {priority === 'high' && (
              <View style={styles.highBadge}>
                <Text style={styles.highText}>High</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function NotificationsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const fetchNotifications = useCallback(async () => {
        if (!user?.userId) return;
        setIsLoading(true);
        try {
            console.log(`Fetching notifications for userId: ${user.userId}`);
            const response = await apiClient.get(`/app/notification/all-user-notification/${user.userId}`);
            console.log("Notifications Response:", response.data);
            setNotifications(response.data.data || []);
        } catch (error: any) {
            console.error("Fetch Notifications Error:", {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url,
            });
            setNotifications([]);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const markAllAsRead = useCallback(async () => {
        if (!user?.userId) return;
        try {
            await apiClient.patch(`/app/notification/mark-as-read/${user.userId}`);
            setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as NotificationStatus })));
        } catch (error: any) {
            console.error("Mark as read error:", error.message);
        }
    }, [user]);

    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            await apiClient.patch(`/app/notification/mark-as-read/${notificationId}`);
            setNotifications(prev =>
                prev.map(n => n._id === notificationId ? { ...n, status: 'read' as NotificationStatus } : n)
            );
        } catch (error: any) {
            console.error("Mark as read error:", error.message);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [fetchNotifications])
    );

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') {
            return n.status === 'sent' || n.status === 'delivered' || n.status === 'pending';
        }
        return true;
    });

    const unreadCount = notifications.filter(
        n => n.status === 'sent' || n.status === 'delivered' || n.status === 'pending'
    ).length;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 && (
                    <TouchableOpacity
                        onPress={markAllAsRead}
                        style={styles.markAllButton}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.markAllText}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
                    onPress={() => setFilter('all')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                        All
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
                    onPress={() => setFilter('unread')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
                        Unread
                    </Text>
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Notifications List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10B981" />
                </View>
            ) : (
                <FlatList
                    data={filteredNotifications}
                    keyExtractor={item => item._id}
                    renderItem={({ item }) => (
                        <NotificationCard
                            item={item}
                            onPress={() => {
                                if (item.status !== 'read') {
                                    markAsRead(item._id);
                                }
                            }}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Feather name="bell-off" size={64} color="#CBD5E1" />
                            <Text style={styles.emptyTitle}>
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </Text>
                            <Text style={styles.emptyText}>
                                {filter === 'unread'
                                    ? 'You\'re all caught up!'
                                    : 'You\'ll see notifications here when you receive them.'}
                            </Text>
                        </View>
                    }
                    onRefresh={fetchNotifications}
                    refreshing={isLoading}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
        marginLeft: 8,
    },
    markAllButton: {
        padding: 8,
    },
    markAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 12,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    filterTabActive: {
        backgroundColor: '#10B981',
    },
    filterText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterTextActive: {
        color: '#FFFFFF',
    },
    badge: {
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardContent: {
        flexDirection: 'row',
        padding: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    titleBold: {
        fontWeight: '700',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    message: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 8,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    time: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    urgentBadge: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    urgentText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#EF4444',
    },
    highBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    highText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#F59E0B',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginTop: 24,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
    },
});