import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/api';

// --- Type Definitions ---
type Tab = 'report' | 'tickets' | 'faq' | 'contact';
interface Issue {
  _id: string;
  title: string;
  description: string;
  date: string;
}

// --- Predefined Data ---
const issueTypes = [
  { label: 'Login Problem', value: 'Login Problem' },
  { label: 'Payment Issue', value: 'Payment Issue' },
  { label: 'Bug or Glitch', value: 'Bug or Glitch' },
  { label: 'General Feedback', value: 'General Feedback' },
  { label: 'Other', value: 'Other' },
];
const faqs = [
    { q: 'How do I fund my wallet?', a: 'You can fund your wallet from the Transactions tab by tapping "Add Money".' },
    { q: 'How do I book a consultation?', a: 'From the Home screen, select an ailment category to open the booking form.' },
];
const tabs: { key: Tab, label: string }[] = [
    { key: 'report', label: 'Report' },
    { key: 'tickets', label: 'My Tickets' },
    { key: 'faq', label: 'FAQ' },
    { key: 'contact', label: 'Contact' },
];

export default function IssuesScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('report');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [issueTitle, setIssueTitle] = useState('');
    const [issueDescription, setIssueDescription] = useState('');
    const [issueImage, setIssueImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [myTickets, setMyTickets] = useState<Issue[]>([]);
  
    const pickImage = async () => { /* ... (no changes) ... */ };
  
    const handleSubmitIssue = async () => {
      if (!user?.userId) return Alert.alert("Authentication Error", "You must be logged in.");
      if (!issueTitle || !issueDescription) return Alert.alert('Missing Information', 'Please select a type and a description.');
      
      setIsSubmitting(true);
      const fd = new FormData();
      fd.append('title', issueTitle);
      fd.append('description', issueDescription);
      if (issueImage) {
        fd.append('issueImage', {
          uri: issueImage.uri, name: issueImage.fileName || 'issue.jpg', type: issueImage.mimeType || 'image/jpeg',
        } as any);
      }
  
      try {
        // --- THIS PATH IS NOW CORRECT (but matches the old one) ---
        const CREATE_ISSUE_ENDPOINT = `/app/issue/create-issue/${user.userId}`;
        const response = await apiClient.post(CREATE_ISSUE_ENDPOINT, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        Alert.alert('Success', response.data.message);
        setIssueTitle(''); setIssueDescription(''); setIssueImage(null);
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
        // --- THIS IS THE CORRECTED ENDPOINT FOR FETCHING TICKETS ---
        const GET_ISSUES_ENDPOINT = `/app/issue/all-issues/${user.userId}`;
        
        const response = await apiClient.get(GET_ISSUES_ENDPOINT);
        setMyTickets(response.data.data || []);
      } catch (error: any) {
        Alert.alert('Error', 'Could not fetch your tickets.');
        console.error("Fetch Tickets Error:", error);
      } finally {
        setIsLoading(false);
      }
    }, [user]);
  
    useFocusEffect(useCallback(() => { if (activeTab === 'tickets') fetchMyTickets(); }, [activeTab, fetchMyTickets]));
  
    const handleEmailPress = () => Linking.openURL('mailto:support@healthconnect.com?subject=Support Request');
    const handlePhonePress = () => Linking.openURL('tel:+264811234567');
    
    const renderReportTab = () => (
        <View>
            <Text className="text-base text-text-main mb-2 font-semibold">What are you reporting?</Text>
            <View className="bg-white border border-gray-200 rounded-xl px-3 mb-4" style={{ height: 56, justifyContent: "center" }}>
              <RNPickerSelect onValueChange={setIssueTitle} items={issueTypes} placeholder={{ label: "Select an issue type...", value: null }} Icon={() => <Feather name="chevron-down" size={24} color="gray" />}/>
            </View>
            <Text className="text-base text-text-main mb-2 font-semibold">Description</Text>
            <TextInput value={issueDescription} onChangeText={setIssueDescription} placeholder="Please describe the issue in detail..." className="bg-white p-4 rounded-xl h-32 border border-gray-200" multiline textAlignVertical="top"/>
            <TouchableOpacity onPress={pickImage} className="bg-gray-100 border border-dashed border-gray-400 rounded-xl p-4 flex-row items-center justify-center mt-4">
              <Feather name={issueImage ? 'check-circle' : 'paperclip'} size={20} color={issueImage ? '#28A745' : '#6C757D'} />
              <Text className={`ml-2 font-semibold ${issueImage ? 'text-secondary' : 'text-text-main'}`}>{issueImage ? 'Image Attached' : 'Attach Screenshot (Optional)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmitIssue} disabled={isSubmitting} className={`bg-primary p-4 rounded-xl mt-6 ${isSubmitting && 'opacity-50'}`}>
                {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-center text-lg">Submit Issue</Text>}
            </TouchableOpacity>
        </View>
    );

    const renderFaqTab = () => (
        <View>
            {faqs.map((faq, index) => (
                <View key={index} className="bg-white p-4 rounded-xl mb-3 border border-gray-200">
                    <Text className="text-base font-bold text-primary">{faq.q}</Text>
                    <Text className="text-base text-text-main mt-1">{faq.a}</Text>
                </View>
            ))}
        </View>
    );

    const renderContactTab = () => (
        <View>
            <TouchableOpacity onPress={handleEmailPress} className="bg-white p-6 rounded-xl border border-gray-200 items-center mb-4">
              <Feather name="mail" size={32} color="#007BFF" />
              <Text className="text-lg font-bold text-text-main mt-3">Contact Support</Text>
              <Text className="text-base text-gray-600 mt-1">support@healthconnect.com</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePhonePress} className="bg-white p-6 rounded-xl border border-gray-200 items-center">
              <Feather name="phone" size={32} color="#007BFF" />
              <Text className="text-lg font-bold text-text-main mt-3">Call Us</Text>
              <Text className="text-base text-gray-600 mt-1">+264 81 123 4567</Text>
            </TouchableOpacity>
        </View>
    );

    return (
      <SafeAreaView className="flex-1 bg-background-light" edges={['bottom', 'left', 'right']}>
        {/* Static Header */}
        <View className="p-6">
          <Text className="text-3xl font-bold text-text-main">Help & Support</Text>
          <Text className="text-base text-gray-500 mt-1">Find answers or report an issue.</Text>
        </View>
  
        {/* Static Tab Selector */}
        <View className="px-6 mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tabs.map(tab => (
              <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} className={`py-2 px-4 rounded-full mr-3 ${activeTab === tab.key ? 'bg-primary' : 'bg-white border border-primary/20'}`}>
                <Text className={`font-semibold ${activeTab === tab.key ? 'text-white' : 'text-primary'}`}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
  
        {/* Conditional Content */}
        {activeTab === 'tickets' ? (
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
            ListEmptyComponent={<Text className="text-center text-gray-500 mt-10">You have not reported any issues.</Text>}
            onRefresh={fetchMyTickets}
            refreshing={isLoading}
          />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
            {activeTab === 'report' && renderReportTab()}
            {activeTab === 'faq' && renderFaqTab()}
            {activeTab === 'contact' && renderContactTab()}
          </ScrollView>
        )}
      </SafeAreaView>
    );
}