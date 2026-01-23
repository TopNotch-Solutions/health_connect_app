import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/api';

// --- Type Definitions ---
type Tab = 'report' | 'tickets' | 'faq';
type IssueStatus = 'Open' | 'Closed' | 'In Progress';
interface Issue { 
  _id: string; 
  title: string; 
  description: string; 
  date: string; 
  status: IssueStatus;
}
interface Faq { _id: string; question: string; answer: string; }

// --- Predefined Data ---
const issueTypes = [
  { label: 'Report Malpractice of Health Provider', value: 'Report Malpractice of Health Provider' },
  { label: 'Login Problem', value: 'Login Problem' },
  { label: 'Payment Issue', value: 'Payment Issue' },
  { label: 'Bug or Glitch', value: 'Bug or Glitch' },
  { label: 'General Feedback', value: 'General Feedback' },
  { label: 'Other', value: 'Other' },
];

const tabs: { key: Tab, label: string }[] = [
    { key: 'report', label: 'Report' },
    { key: 'tickets', label: 'My Tickets' },
    { key: 'faq', label: 'FAQ' },
];

const pickerStyle = {
    inputIOS: {
        color: '#111827',
        fontSize: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        paddingRight: 30,
    },
    inputAndroid: {
        color: '#111827',
        fontSize: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingRight: 30,
    },
    iconContainer: {
        top: 16,
        right: 12,
    },
    placeholder: {
        color: '#9CA3AF',
    },
    modalViewMiddle: {
        backgroundColor: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    modalViewBottom: {
        backgroundColor: 'white',
    },
    chevronContainer: {
        display: 'none',
    },
};

export default function IssuesScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('report');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [issueTitle, setIssueTitle] = useState('');
    const [issueDescription, setIssueDescription] = useState('');
    const [issueImage, setIssueImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [myTickets, setMyTickets] = useState<Issue[]>([]);
    const [faqs, setFaqs] = useState<Faq[]>([]);
    const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
    const [errors, setErrors] = useState({
        issueTitle: '',
        issueDescription: '',
    });
    
    // Pagination state for tickets
    const [ticketsCurrentPage, setTicketsCurrentPage] = useState(1);
    const [ticketsTotalPages, setTicketsTotalPages] = useState(1);
    const [ticketsHasMore, setTicketsHasMore] = useState(true);
    const [ticketsIsLoadingMore, setTicketsIsLoadingMore] = useState(false);
    const [ticketsIsRefreshing, setTicketsIsRefreshing] = useState(false);
    
    // Pagination state for FAQs
    const [faqsCurrentPage, setFaqsCurrentPage] = useState(1);
    const [faqsTotalPages, setFaqsTotalPages] = useState(1);
    const [faqsHasMore, setFaqsHasMore] = useState(true);
    const [faqsIsLoadingMore, setFaqsIsLoadingMore] = useState(false);
    const [faqsIsRefreshing, setFaqsIsRefreshing] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
        if (!result.canceled) setIssueImage(result.assets[0]);
    };
  
    const handleSubmitIssue = async () => {
      if (!user?.userId) {
        Alert.alert("Authentication Error", "You must be logged in.");
        return;
      }

      // Clear previous errors
      setErrors({ issueTitle: '', issueDescription: '' });

      let hasError = false;
      const newErrors = { issueTitle: '', issueDescription: '' };

      if (!issueTitle || !issueTitle.trim()) {
        newErrors.issueTitle = 'Please select an issue type';
        hasError = true;
      }
      if (!issueDescription || !issueDescription.trim()) {
        newErrors.issueDescription = 'Please describe the issue in detail';
        hasError = true;
      }

      if (hasError) {
        setErrors(newErrors);
        return;
      }
      
      setIsSubmitting(true);
      const fd = new FormData();
      fd.append('title', issueTitle);
      fd.append('description', issueDescription);
      if (issueImage) {
        fd.append('issueImage', { uri: issueImage.uri, name: issueImage.fileName || 'issue.jpg', type: issueImage.mimeType || 'image/jpeg' } as any);
      }
  
      try {
        const CREATE_ISSUE_ENDPOINT = '/app/issue/create-issue/';
        const response = await apiClient.post(CREATE_ISSUE_ENDPOINT, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        Alert.alert('Success', response.data.message);
        setIssueTitle(''); setIssueDescription(''); setIssueImage(null);
        setErrors({ issueTitle: '', issueDescription: '' });
        setActiveTab('tickets');
      } catch (error: any) {
        Alert.alert('Submission Failed', error.response?.data?.message || 'An error occurred.');
      } finally {
        setIsSubmitting(false);
      }
    };
  
    const fetchMyTickets = useCallback(async (isRefresh = false, page = 1) => {
      if (!user?.userId) {
        setMyTickets([]);
        setIsLoading(false);
        setTicketsIsRefreshing(false);
        return;
      }
      
      if (isRefresh) {
        setTicketsIsRefreshing(true);
        setTicketsCurrentPage(1);
      } else if (page === 1) {
        setIsLoading(true);
      } else {
        setTicketsIsLoadingMore(true);
      }
      
      try {
        const GET_ISSUES_ENDPOINT = `/app/issue/all-issues/?page=${page}&limit=10`;
        const response = await apiClient.get(GET_ISSUES_ENDPOINT);
        const newTickets = response.data.data || [];
        const pagination = response.data.pagination || {};
        
        if (isRefresh || page === 1) {
          setMyTickets(newTickets);
        } else {
          setMyTickets(prev => [...prev, ...newTickets]);
        }
        
        const hasNext = pagination.hasNextPage === true;
        const currentPageNum = pagination.currentPage || page;
        const totalPagesNum = pagination.totalPages || 1;
        setTicketsHasMore(hasNext);
        setTicketsCurrentPage(currentPageNum);
        setTicketsTotalPages(totalPagesNum);
        
        if (newTickets.length === 0 && page > 1) {
          setTicketsHasMore(false);
        }
      } catch (error: any) {
        Alert.alert('Error', 'Could not fetch your tickets.');
        if (page === 1) {
          setMyTickets([]);
        }
      } finally {
        setIsLoading(false);
        setTicketsIsRefreshing(false);
        setTicketsIsLoadingMore(false);
      }
    }, [user?.userId]);

    const fetchFaqs = useCallback(async (isRefresh = false, page = 1) => {
        if (isRefresh) {
            setFaqsIsRefreshing(true);
            setFaqsCurrentPage(1);
        } else if (page === 1) {
            setIsLoading(true);
        } else {
            setFaqsIsLoadingMore(true);
        }
        
        try {
            console.log('Fetching FAQs from API...');
            const response = await apiClient.get(`/app/faq/all-faq?page=${page}&limit=10`);
            console.log('FAQs Response:', response.data);
            const newFaqs = response.data.faq || response.data.data || [];
            const pagination = response.data.pagination || {};
            
            if (isRefresh || page === 1) {
                setFaqs(newFaqs);
            } else {
                setFaqs(prev => [...prev, ...newFaqs]);
            }
            
            const hasNext = pagination.hasNextPage === true;
            const currentPageNum = pagination.currentPage || page;
            const totalPagesNum = pagination.totalPages || 1;
            setFaqsHasMore(hasNext);
            setFaqsCurrentPage(currentPageNum);
            setFaqsTotalPages(totalPagesNum);
            
            if (newFaqs.length === 0 && page > 1) {
                setFaqsHasMore(false);
            }
        } catch (error: any) {
            console.error('Error fetching FAQs:', error.message);
            Alert.alert('Error', 'Could not load FAQs.');
            if (page === 1) {
                setFaqs([]);
            }
        } finally {
            setIsLoading(false);
            setFaqsIsRefreshing(false);
            setFaqsIsLoadingMore(false);
        }
    }, []);
  
    // Load more functions
    const loadMoreTickets = useCallback(() => {
        if (!ticketsIsLoadingMore && ticketsHasMore) {
            const nextPage = ticketsCurrentPage + 1;
            fetchMyTickets(false, nextPage);
        }
    }, [ticketsIsLoadingMore, ticketsHasMore, ticketsCurrentPage, fetchMyTickets]);

    const loadMoreFaqs = useCallback(() => {
        if (!faqsIsLoadingMore && faqsHasMore) {
            const nextPage = faqsCurrentPage + 1;
            fetchFaqs(false, nextPage);
        }
    }, [faqsIsLoadingMore, faqsHasMore, faqsCurrentPage, fetchFaqs]);

    useFocusEffect(useCallback(() => {
        if (activeTab === 'tickets') { fetchMyTickets(false, 1); }
        if (activeTab === 'faq') { fetchFaqs(false, 1); }
      }, [activeTab, fetchMyTickets, fetchFaqs])
    );

    // Helper function to get status styling
    const getStatusConfig = (status: IssueStatus) => {
        switch (status) {
            case 'Open':
                return {
                    backgroundColor: '#FEF3C7',
                    borderColor: '#F59E0B',
                    textColor: '#92400E',
                    icon: 'alert-circle' as const,
                    iconColor: '#F59E0B',
                };
            case 'In Progress':
                return {
                    backgroundColor: '#DBEAFE',
                    borderColor: '#3B82F6',
                    textColor: '#1E40AF',
                    icon: 'clock' as const,
                    iconColor: '#3B82F6',
                };
            case 'Closed':
                return {
                    backgroundColor: '#D1FAE5',
                    borderColor: '#10B981',
                    textColor: '#065F46',
                    icon: 'check-circle' as const,
                    iconColor: '#10B981',
                };
            default:
                return {
                    backgroundColor: '#F3F4F6',
                    borderColor: '#9CA3AF',
                    textColor: '#374151',
                    icon: 'help-circle' as const,
                    iconColor: '#9CA3AF',
                };
        }
    };
  
    // --- THIS SECTION CONTAINS THE JSX FOR THE TABS THAT DON'T HAVE LISTS ---
    const renderScrollViewContent = () => {
        switch(activeTab) {
            case 'report':
                return (
                    <View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>What are you reporting?</Text>
                            <View style={[styles.pickerContainer, errors.issueTitle && styles.inputError]}>
                                <RNPickerSelect
                                    onValueChange={(value) => {
                                        setIssueTitle(value);
                                        if (errors.issueTitle) {
                                            setErrors({ ...errors, issueTitle: '' });
                                        }
                                    }}
                                    items={issueTypes}
                                    placeholder={{ label: "Select an issue type...", value: null }}
                                    value={issueTitle}
                                    style={pickerStyle as any}
                                    useNativeAndroidPickerStyle={false}
                                />
                                <View style={styles.pickerIcon}>
                                    <Feather name="chevron-down" size={20} color={errors.issueTitle ? '#EF4444' : '#10B981'} />
                                </View>
                            </View>
                            {errors.issueTitle ? (
                                <Text style={styles.errorText}>{errors.issueTitle}</Text>
                            ) : null}
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                value={issueDescription}
                                onChangeText={(text) => {
                                    setIssueDescription(text);
                                    if (errors.issueDescription) {
                                        setErrors({ ...errors, issueDescription: '' });
                                    }
                                }}
                                placeholder="Please describe the issue in detail..."
                                placeholderTextColor="#9CA3AF"
                                style={[styles.textArea, errors.issueDescription && styles.inputError]}
                                multiline
                                textAlignVertical="top"
                                numberOfLines={6}
                            />
                            {errors.issueDescription ? (
                                <Text style={styles.errorText}>{errors.issueDescription}</Text>
                            ) : null}
                        </View>

                        <TouchableOpacity
                            onPress={pickImage}
                            style={styles.imageButton}
                            activeOpacity={0.7}
                        >
                            <Feather
                                name={issueImage ? 'check-circle' : 'paperclip'}
                                size={20}
                                color={issueImage ? '#10B981' : '#6B7280'}
                            />
                            <Text style={[styles.imageButtonText, issueImage && styles.imageButtonTextSuccess]}>
                                {issueImage ? 'Image Attached' : 'Attach Screenshot (Optional)'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSubmitIssue}
                            disabled={isSubmitting}
                            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                            activeOpacity={0.8}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>Submit Issue</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                );
            default:
                return null;
        }
    }
    // --------------------------------------------------------------------------

    return (
      <SafeAreaView className="flex-1" edges={['bottom', 'left', 'right']}>
        {/* Static Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSubtitle}>Find answers or report an issue.</Text>
        </View>
  
        {/* Static Tab Selector */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
  
        {/* --- THIS IS THE CORRECTED LAYOUT LOGIC --- */}
        {activeTab === 'tickets' && (
            <FlatList
                data={myTickets}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                renderItem={({ item }) => {
                    const statusConfig = getStatusConfig(item.status || 'Open');
                    return (
                        <View style={[
                            styles.ticketCard,
                            {
                                borderLeftWidth: 4,
                                borderLeftColor: statusConfig.borderColor,
                                backgroundColor: '#FFFFFF',
                            }
                        ]}>
                            <View style={styles.ticketHeader}>
                                <View style={styles.ticketTitleContainer}>
                                    <Text style={styles.ticketTitle}>{item.title}</Text>
                                </View>
                                <View style={[
                                    styles.statusBadge,
                                    {
                                        backgroundColor: statusConfig.backgroundColor,
                                        borderColor: statusConfig.borderColor,
                                    }
                                ]}>
                                    <Feather 
                                        name={statusConfig.icon} 
                                        size={12} 
                                        color={statusConfig.iconColor} 
                                        style={{ marginRight: 4 }}
                                    />
                                    <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
                                        {item.status || 'Open'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.ticketDescription} numberOfLines={2}>
                                {item.description}
                            </Text>
                            <View style={styles.ticketFooter}>
                                <View style={styles.dateContainer}>
                                    <Feather name="calendar" size={12} color="#9CA3AF" />
                                    <Text style={styles.dateText}>
                                        {new Date(item.date).toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric', 
                                            year: 'numeric' 
                                        })}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={<View className="items-center mt-10"><Feather name="folder" size={48} color="#CBD5E1"/><Text className="text-lg text-gray-500 mt-4">You have not reported any issues.</Text></View>}
                ListFooterComponent={
                    myTickets.length > 0 ? (
                        <View style={styles.paginationContainer}>
                            <View style={styles.paginationDivider}>
                                <View style={styles.paginationLine} />
                                <View style={styles.paginationTextContainer}>
                                    <Text style={styles.paginationText}>
                                        Page {ticketsCurrentPage} of {ticketsTotalPages}
                                    </Text>
                                </View>
                                <View style={styles.paginationLine} />
                            </View>
                            {ticketsHasMore && (
                                <TouchableOpacity
                                    onPress={loadMoreTickets}
                                    disabled={ticketsIsLoadingMore}
                                    style={[
                                        styles.loadMoreButton,
                                        ticketsIsLoadingMore && styles.loadMoreButtonDisabled,
                                    ]}
                                    activeOpacity={0.7}
                                >
                                    {ticketsIsLoadingMore ? (
                                        <>
                                            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.loadMoreButtonText}>Loading...</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Feather name="chevron-down" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                                            <Text style={styles.loadMoreButtonText}>Load More</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                            {!ticketsHasMore && ticketsTotalPages > 1 && (
                                <View style={styles.allLoadedContainer}>
                                    <Feather name="check-circle" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                                    <Text style={styles.allLoadedText}>All tickets loaded</Text>
                                </View>
                            )}
                        </View>
                    ) : null
                }
                onRefresh={() => fetchMyTickets(true, 1)}
                refreshing={ticketsIsRefreshing}
                removeClippedSubviews={false}
            />
        )}

        {activeTab === 'faq' && (
            <FlatList
                data={faqs}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                renderItem={({ item }) => {
                    const isExpanded = expandedFaqId === item._id;
                    return (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                                setExpandedFaqId(isExpanded ? null : item._id);
                            }}
                            style={styles.faqCard}
                        >
                            <View style={styles.faqHeader}>
                                <View style={styles.faqContent}>
                                    <Text style={styles.faqQuestion}>{item.question}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        setExpandedFaqId(isExpanded ? null : item._id);
                                    }}
                                    style={styles.faqExpandButton}
                                >
                                    <Feather
                                        name={isExpanded ? "chevron-up" : "chevron-down"}
                                        size={20}
                                        color="#6B7280"
                                    />
                                </TouchableOpacity>
                            </View>
                            {isExpanded && (
                                <View style={styles.faqAnswerContainer}>
                                    <Text style={styles.faqAnswer}>{item.answer}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Feather name="help-circle" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No FAQs available.</Text>
                        <Text style={styles.emptySubtext}>Check back later for updates.</Text>
                    </View>
                }
                ListFooterComponent={
                    faqs.length > 0 ? (
                        <View style={styles.paginationContainer}>
                            <View style={styles.paginationDivider}>
                                <View style={styles.paginationLine} />
                                <View style={styles.paginationTextContainer}>
                                    <Text style={styles.paginationText}>
                                        Page {faqsCurrentPage} of {faqsTotalPages}
                                    </Text>
                                </View>
                                <View style={styles.paginationLine} />
                            </View>
                            {faqsHasMore && (
                                <TouchableOpacity
                                    onPress={loadMoreFaqs}
                                    disabled={faqsIsLoadingMore}
                                    style={[
                                        styles.loadMoreButton,
                                        faqsIsLoadingMore && styles.loadMoreButtonDisabled,
                                    ]}
                                    activeOpacity={0.7}
                                >
                                    {faqsIsLoadingMore ? (
                                        <>
                                            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.loadMoreButtonText}>Loading...</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Feather name="chevron-down" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                                            <Text style={styles.loadMoreButtonText}>Load More</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                            {!faqsHasMore && faqsTotalPages > 1 && (
                                <View style={styles.allLoadedContainer}>
                                    <Feather name="check-circle" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                                    <Text style={styles.allLoadedText}>All FAQs loaded</Text>
                                </View>
                            )}
                        </View>
                    ) : null
                }
                onRefresh={() => fetchFaqs(true, 1)}
                refreshing={faqsIsRefreshing}
                removeClippedSubviews={false}
            />
        )}

        {activeTab === 'report' && (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
                {renderScrollViewContent()}
            </ScrollView>
        )}
        {/* ------------------------------------------- */}
      </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#111827',
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 4,
    },
    tabContainer: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    tabScrollContent: {
        paddingRight: 24,
    },
    tabButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        marginRight: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#10B981',
    },
    tabButtonActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    tabButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    tabButtonTextActive: {
        color: '#FFFFFF',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    pickerContainer: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#10B981',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 56,
        justifyContent: 'center',
        position: 'relative',
    },
    pickerIcon: {
        position: 'absolute',
        right: 16,
        top: 18,
        pointerEvents: 'none',
    },
    inputError: {
        borderColor: '#EF4444',
    },
    textArea: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#10B981',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#111827',
        minHeight: 120,
        textAlignVertical: 'top',
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
        marginLeft: 4,
    },
    imageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#D1D5DB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    imageButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginLeft: 8,
    },
    imageButtonTextSuccess: {
        color: '#10B981',
    },
    submitButton: {
        backgroundColor: '#10B981',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    ticketCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    ticketTitleContainer: {
        flex: 1,
        marginRight: 8,
    },
    ticketTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        lineHeight: 22,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ticketDescription: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 12,
    },
    ticketFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginLeft: 6,
    },
    faqCard: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 0,
    },
    faqExpandButton: {
        padding: 4,
        marginLeft: 8,
    },
    faqIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    faqContent: {
        flex: 1,
    },
    faqQuestion: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        lineHeight: 24,
    },
    faqAnswerContainer: {
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#10B981',
        marginTop: 12,
    },
    faqAnswer: {
        fontSize: 15,
        color: '#4B5563',
        lineHeight: 22,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 8,
    },
    paginationContainer: {
        paddingVertical: 32,
        alignItems: 'center',
    },
    paginationDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        width: '100%',
    },
    paginationLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    paginationTextContainer: {
        paddingHorizontal: 16,
    },
    paginationText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    loadMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 16,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    loadMoreButtonDisabled: {
        opacity: 0.6,
    },
    loadMoreButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    allLoadedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    allLoadedText: {
        fontSize: 14,
        color: '#9CA3AF',
        fontWeight: '500',
    },
});