import { HeaderBackButton, iosCustomTopBarStyle } from '../components/HeaderBackButton';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AppEmptyState,
  AppFilterChips,
  AppLoadingCard,
  AppScreenShell,
  appScreenStyles,
  AUTH_COLORS,
} from '../components/app/AppScreenUI';
import { SCREEN_EDGES_TOP } from "../components/ScreenLayout";
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';
import { handleNotificationOpen } from '../lib/notificationNavigation';

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

const NotificationCard = ({ item, onPress, onDelete }: { item: Notification; onPress?: () => void; onDelete?: () => void }) => {
  const config = getNotificationConfig(item.type);
  const isUnread = item.status === 'sent' || item.status === 'delivered' || item.status === 'pending';
  const priority = item.priority || 'medium';
  const accent =
    priority === 'urgent'
      ? '#DC2626'
      : priority === 'high'
        ? '#D97706'
        : isUnread
          ? AUTH_COLORS.green
          : '#D1D5DB';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.card,
        isUnread ? styles.cardUnread : styles.cardRead,
        { borderLeftColor: accent },
      ]}
    >
      <View style={styles.cardContent}>
        <View style={styles.iconContainer}>
          {config.iconLib === 'feather' ? (
            <Feather
              name={config.icon as any}
              size={18}
              color={isUnread ? AUTH_COLORS.greenDark : AUTH_COLORS.textMuted}
            />
          ) : (
            <MaterialCommunityIcons
              name={config.icon as any}
              size={18}
              color={isUnread ? AUTH_COLORS.greenDark : AUTH_COLORS.textMuted}
            />
          )}
        </View>

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, isUnread && styles.titleBold]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {isUnread ? <View style={styles.unreadDot} /> : null}
          </View>

          <Text style={styles.message} numberOfLines={3}>
            {item.message}
          </Text>

          <View style={styles.footer}>
            <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
            <View style={styles.footerRight}>
              {priority === 'urgent' ? (
                <Text style={styles.urgentText}>Urgent</Text>
              ) : null}
              {priority === 'high' ? (
                <Text style={styles.highText}>High</Text>
              ) : null}
              {onDelete ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  style={styles.deleteButton}
                  activeOpacity={0.7}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={15} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>
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
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // FIXED: Fetch notifications with pagination
    const fetchNotifications = useCallback(async (isRefresh = false, page = 1) => {
        if (!user?.userId) {
            setNotifications([]);
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
            // Backend extracts userId from JWT token
            const response = await apiClient.get(`/app/notification/all-user-notification?page=${page}&limit=10`);
            const newNotifications = response.data.data || [];
            const pagination = response.data.pagination || {};

            if (isRefresh || page === 1) {
                // Replace notifications on refresh or first page
                setNotifications(newNotifications);
            } else {
                // Append notifications for pagination
                setNotifications(prev => [...prev, ...newNotifications]);
            }
            
            // Use pagination data from API response
            const hasNext = pagination.hasNextPage === true;
            const currentPageNum = pagination.currentPage || page;
            const totalPagesNum = pagination.totalPages || 1;
            setHasMore(hasNext);
            setCurrentPage(currentPageNum);
            setTotalPages(totalPagesNum);
            
            // If no notifications returned and we're not on page 1, there are no more pages
            if (newNotifications.length === 0 && page > 1) {
                setHasMore(false);
            }
        } catch (error: any) {
            console.error("Fetch Notifications Error:", {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url,
            });
            // Don't show alert on initial load, just set empty notifications
            if (page === 1) {
                setNotifications([]);
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    }, [user?.userId]);

    // FIXED: Fetch unread count from dedicated endpoint
    const fetchUnreadCount = useCallback(async () => {
        if (!user?.userId) return;
        try {
            const response = await apiClient.get('/app/notification/unread-count');
            setUnreadCount(response.data.data?.unReadCount || 0);
        } catch (error: any) {
            console.error("Fetch Unread Count Error:", error.message);
        }
    }, [user]);

    // FIXED: Mark ALL notifications as read (backend behavior)
    const markAllAsRead = useCallback(async () => {
        if (!user?.userId) return;
        try {
            // Backend marks all user notifications as read
            await apiClient.patch('/app/notification/mark-as-read');
            setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as NotificationStatus })));
            setUnreadCount(0);
        } catch (error: any) {
            console.error("Mark as read error:", error.message);
        }
    }, [user]);

    // FIXED: Delete individual notification
    const deleteNotification = useCallback(async (notificationId: string) => {
        try {
            await apiClient.delete(`/app/notification/delete-notification/${notificationId}`);
            
            // Remove deleted notification from state
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
            
            // Refresh unread count
            fetchUnreadCount();
        } catch (error: any) {
            console.error("Delete notification error:", error.message);
            console.error("Error details:", error.response?.data);
        }
    }, [fetchUnreadCount]);

    // Load more notifications for pagination (manual trigger)
    const loadMoreNotifications = useCallback(() => {
        if (!isLoadingMore && hasMore) {
            const nextPage = currentPage + 1;
            fetchNotifications(false, nextPage);
        }
    }, [isLoadingMore, hasMore, currentPage, fetchNotifications]);

    useFocusEffect(
        useCallback(() => {
            fetchNotifications(false, 1);
            fetchUnreadCount();
        }, [fetchNotifications, fetchUnreadCount])
    );

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') {
            return n.status === 'sent' || n.status === 'delivered' || n.status === 'pending';
        }
        return true;
    });

    return (
        <AppScreenShell edges={SCREEN_EDGES_TOP}>
            {/* Header */}
            <View style={[styles.header, iosCustomTopBarStyle]}>
                <HeaderBackButton color={AUTH_COLORS.textDark} size={24} />
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

            <AppFilterChips
                filters={[
                    { key: 'all', label: 'All' },
                    { key: 'unread', label: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread' },
                ]}
                active={filter}
                onChange={(key) => setFilter(key as 'all' | 'unread')}
            />

            {/* Notifications List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <AppLoadingCard message="Loading notifications…" />
                </View>
            ) : (
                <FlatList
                    data={filteredNotifications}
                    keyExtractor={item => item._id}
                    renderItem={({ item }) => (
                        <NotificationCard
                            item={item}
                            onPress={() => {
                                handleNotificationOpen({
                                    data: {
                                        type: item.type,
                                        ...(item.data && typeof item.data === 'object'
                                            ? item.data
                                            : {}),
                                    },
                                    isAuthenticated: !!user?.userId,
                                    userRole: user?.role,
                                    router,
                                });
                            }}
                            onDelete={() => deleteNotification(item._id)}
                        />
                    )}
                    contentContainerStyle={[
                      appScreenStyles.scrollContent,
                      styles.listContent,
                    ]}
                    ListEmptyComponent={
                        <AppEmptyState
                            icon="bell-off"
                            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            body={
                                filter === 'unread'
                                    ? "You're all caught up!"
                                    : "You'll see notifications here when you receive them."
                            }
                        />
                    }
                    ListFooterComponent={
                        filteredNotifications.length > 0 ? (
                            <View style={styles.paginationContainer}>
                                <View style={styles.paginationDivider}>
                                    <View style={styles.paginationLine} />
                                    <View style={styles.paginationTextContainer}>
                                        <Text style={styles.paginationText}>
                                            Page {currentPage} of {totalPages}
                                        </Text>
                                    </View>
                                    <View style={styles.paginationLine} />
                                </View>
                                {hasMore && (
                                    <TouchableOpacity
                                        onPress={loadMoreNotifications}
                                        disabled={isLoadingMore}
                                        style={[
                                            styles.loadMoreButton,
                                            isLoadingMore && styles.loadMoreButtonDisabled,
                                        ]}
                                        activeOpacity={0.7}
                                    >
                                        {isLoadingMore ? (
                                            <>
                                                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                                                <Text style={styles.loadMoreButtonText}>Loading...</Text>
                                            </>
                                        ) : (
                                            <>
                                                <Feather name="chevron-down" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                                                <Text style={styles.loadMoreButtonText}>Load More</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                                {!hasMore && totalPages > 1 && (
                                    <View style={styles.allLoadedContainer}>
                                        <Feather name="check-circle" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                                        <Text style={styles.allLoadedText}>All notifications loaded</Text>
                                    </View>
                                )}
                            </View>
                        ) : undefined
                    }
                    onRefresh={() => fetchNotifications(true, 1)}
                    refreshing={isRefreshing}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={false}
                />
            )}
        </AppScreenShell>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Platform.OS === 'ios' ? 12 : 20,
        paddingVertical: 12,
        backgroundColor: 'transparent',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: AUTH_COLORS.textDark,
        flex: 1,
        marginLeft: Platform.OS === 'ios' ? 4 : 8,
    },
    markAllButton: {
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    markAllText: {
        fontSize: 13,
        fontWeight: '600',
        color: AUTH_COLORS.greenDark,
    },
    listContent: {
        paddingTop: 8,
        paddingHorizontal: 0,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: AUTH_COLORS.white,
        borderRadius: 12,
        marginBottom: 10,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderLeftWidth: 3,
    },
    cardUnread: {
        backgroundColor: '#FFFFFF',
        borderColor: '#D1D5DB',
    },
    cardRead: {
        backgroundColor: '#F9FAFB',
        borderColor: '#E5E7EB',
    },
    cardContent: {
        flexDirection: 'row',
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    textContainer: {
        flex: 1,
        minWidth: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 4,
        gap: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1,
        lineHeight: 20,
    },
    titleBold: {
        fontWeight: '700',
        color: AUTH_COLORS.textDark,
    },
    unreadDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: AUTH_COLORS.green,
        marginTop: 6,
    },
    message: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 19,
        marginBottom: 10,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E7EB',
    },
    footerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    time: {
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    deleteButton: {
        padding: 2,
    },
    urgentText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#DC2626',
        letterSpacing: 0.2,
    },
    highText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#D97706',
        letterSpacing: 0.2,
    },
    paginationContainer: {
        paddingVertical: 24,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    paginationDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        width: '100%',
    },
    paginationLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#D1D5DB',
    },
    paginationTextContainer: {
        paddingHorizontal: 12,
    },
    paginationText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    loadMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: AUTH_COLORS.greenDark,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
    },
    loadMoreButtonDisabled: {
        opacity: 0.6,
    },
    loadMoreButtonText: {
        color: AUTH_COLORS.white,
        fontSize: 14,
        fontWeight: '600',
    },
    allLoadedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    allLoadedText: {
        fontSize: 13,
        color: '#9CA3AF',
        fontWeight: '500',
    },
});