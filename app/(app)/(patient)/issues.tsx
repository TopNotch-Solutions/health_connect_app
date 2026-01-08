import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/api';

// --- Type Definitions ---
type Tab = 'report' | 'tickets' | 'faq' | 'contact';
interface Issue { _id: string; title: string; description: string; date: string; }
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
    { key: 'contact', label: 'Contact' },
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
    const [errors, setErrors] = useState({
        issueTitle: '',
        issueDescription: '',
    });

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
  
    const fetchMyTickets = useCallback(async () => {
      if (!user?.userId) return;
      setIsLoading(true);
      try {
        const GET_ISSUES_ENDPOINT = '/app/issue/all-issues/';
        const response = await apiClient.get(GET_ISSUES_ENDPOINT);
        setMyTickets(response.data.data || []);
      } catch (error: any) {
        Alert.alert('Error', 'Could not fetch your tickets.');
      } finally {
        setIsLoading(false);
      }
    }, [user]);

    const fetchFaqs = useCallback(async () => {
        setIsLoading(true);
        try {
            console.log('Fetching FAQs from API...');
            const response = await apiClient.get('/app/faq/all-faq');
            console.log('FAQs Response:', response.data);
            setFaqs(response.data.faq || response.data.data || []);
            console.log('FAQs set to state:', response.data.faq || response.data.data || []);
        } catch (error: any) {
            console.error('Error fetching FAQs:', error.message);
            Alert.alert('Error', 'Could not load FAQs.');
        } finally {
            setIsLoading(false);
        }
    }, []);
  
    useFocusEffect(useCallback(() => {
        if (activeTab === 'tickets') { fetchMyTickets(); }
        if (activeTab === 'faq') { fetchFaqs(); }
      }, [activeTab, fetchMyTickets, fetchFaqs])
    );
  
    const handleEmailPress = () => Linking.openURL('mailto:support@healthconnect.com?subject=Support Request');
    const handlePhonePress = () => Linking.openURL('tel:+264811234567');
    
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
            case 'contact':
                return (
                    <View>
                        <TouchableOpacity
                            onPress={handleEmailPress}
                            style={styles.contactCard}
                            activeOpacity={0.7}
                        >
                            <View style={styles.contactIconContainer}>
                                <Feather name="mail" size={32} color="#10B981" />
                            </View>
                            <Text style={styles.contactTitle}>Contact Support</Text>
                            <Text style={styles.contactText}>support@healthconnect.com</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handlePhonePress}
                            style={styles.contactCard}
                            activeOpacity={0.7}
                        >
                            <View style={styles.contactIconContainer}>
                                <Feather name="phone" size={32} color="#10B981" />
                            </View>
                            <Text style={styles.contactTitle}>Call Us</Text>
                            <Text style={styles.contactText}>+264 81 123 4567</Text>
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
                renderItem={({ item }) => (
                    <View className="bg-white p-4 rounded-xl mb-3 border border-gray-200">
                        <Text className="text-base font-bold text-text-main">{item.title}</Text>
                        <Text className="text-sm text-gray-600 my-1" numberOfLines={2}>{item.description}</Text>
                        <Text className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString()}</Text>
                    </View>
                )}
                ListEmptyComponent={<View className="items-center mt-10"><Feather name="folder" size={48} color="#CBD5E1"/><Text className="text-lg text-gray-500 mt-4">You have not reported any issues.</Text></View>}
                onRefresh={fetchMyTickets}
                refreshing={isLoading}
            />
        )}

        {activeTab === 'faq' && (
            <FlatList
                data={faqs}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                renderItem={({ item }) => (
                    <View className="bg-white p-4 rounded-xl mb-3 border border-gray-200">
                        <Text className="text-base font-bold text-primary">{item.question}</Text>
                        <Text className="text-base text-text-main mt-1">{item.answer}</Text>
                    </View>
                )}
                ListEmptyComponent={<View className="items-center mt-10"><Feather name="help-circle" size={48} color="#CBD5E1"/><Text className="text-lg text-gray-500 mt-4">No FAQs available.</Text></View>}
                onRefresh={fetchFaqs}
                refreshing={isLoading}
            />
        )}

        {(activeTab === 'report' || activeTab === 'contact') && (
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
    contactCard: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    contactIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    contactTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    contactText: {
        fontSize: 16,
        color: '#6B7280',
    },
});