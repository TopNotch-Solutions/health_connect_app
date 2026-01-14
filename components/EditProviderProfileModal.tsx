import { Feather } from '@expo/vector-icons';
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { namibianRegions } from '../constants/locations';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';

interface EditProviderProfileModalProps {
    visible: boolean;
    onClose: () => void;
}

interface Specialization {
    _id: string;
    title: string;
    role: string;
    description?: string;
}

export default function EditProviderProfileModal({ visible, onClose }: EditProviderProfileModalProps) {
    const { user, updateUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    // Specializations from API
    const [allSpecializations, setAllSpecializations] = useState<Specialization[]>([]);
    const [filteredSpecializations, setFilteredSpecializations] = useState<Specialization[]>([]);
    const [loadingSpecializations, setLoadingSpecializations] = useState(true);
    
    const [formData, setFormData] = useState({
        fullname: user?.fullname || '',
        email: user?.email || '',
        cellphoneNumber: user?.cellphoneNumber || '',
        gender: user?.gender || 'Male',
        address: user?.address || '',
        hpcnaNumber: user?.hpcnaNumber || '',
        hpcnaExpiryDate: user?.hpcnaExpiryDate || '',
        specializations: user?.specializations || [],
        yearsOfExperience: user?.yearsOfExperience?.toString() || '',
        operationalZone: user?.operationalZone || '',
        governingCouncil: user?.governingCouncil || 'Health Professionals Council of Namibia',
        bio: user?.bio || '',
    });

    const [expirationDate, setExpirationDate] = useState<Date>(() => {
        if (user?.hpcnaExpiryDate) {
            return new Date(user.hpcnaExpiryDate);
        }
        return new Date();
    });

    // Fetch specializations from API
    useEffect(() => {
        const fetchSpecializations = async () => {
            try {
                setLoadingSpecializations(true);
                const response = await apiClient.get('/app/specialization/all-specializations');
                const list = response?.data?.specializations;
                if (Array.isArray(list)) {
                    setAllSpecializations(list as Specialization[]);
                } else {
                    setAllSpecializations([]);
                }
            } catch (error) {
                console.error('Error fetching specializations:', error);
                setAllSpecializations([]);
            } finally {
                setLoadingSpecializations(false);
            }
        };

        if (visible) {
            fetchSpecializations();
        }
    }, [visible]);

    // Filter specializations based on user role
    useEffect(() => {
        if (!allSpecializations.length || !user?.role) {
            setFilteredSpecializations([]);
            return;
        }

        const userRole = user.role.toLowerCase();
        const filtered = allSpecializations.filter(
            (spec) =>
                typeof spec.role === 'string' &&
                spec.role.toLowerCase() === userRole
        );

        setFilteredSpecializations(filtered);
    }, [allSpecializations, user?.role]);

    useEffect(() => {
        if (visible && user) {
            setFormData({
                fullname: user.fullname || '',
                email: user.email || '',
                cellphoneNumber: user.cellphoneNumber || '',
                gender: user.gender || 'Male',
                address: user.address || '',
                hpcnaNumber: user.hpcnaNumber || '',
                hpcnaExpiryDate: user.hpcnaExpiryDate || '',
                specializations: user.specializations || [],
                yearsOfExperience: user.yearsOfExperience?.toString() || '',
                operationalZone: user.operationalZone || '',
                governingCouncil: user.governingCouncil || 'Health Professionals Council of Namibia',
                bio: user.bio || '',
            });
            
            if (user.hpcnaExpiryDate) {
                setExpirationDate(new Date(user.hpcnaExpiryDate));
            }
        }
    }, [visible, user]);

    const hasChanges = (): boolean => {
        if (!user) return true;
        
        const userSpecializations = user.specializations || [];
        const formSpecializations = formData.specializations;
        
        const specializationsChanged = 
            userSpecializations.length !== formSpecializations.length ||
            !userSpecializations.every((spec) => formSpecializations.includes(spec));
        
        return (
            formData.fullname !== (user.fullname || '') ||
            formData.email !== (user.email || '') ||
            formData.cellphoneNumber !== (user.cellphoneNumber || '') ||
            formData.gender !== (user.gender || 'Male') ||
            formData.address !== (user.address || '') ||
            formData.hpcnaNumber !== (user.hpcnaNumber || '') ||
            formData.hpcnaExpiryDate !== (user.hpcnaExpiryDate || '') ||
            specializationsChanged ||
            formData.yearsOfExperience !== (user.yearsOfExperience?.toString() || '') ||
            formData.operationalZone !== (user.operationalZone || '') ||
            formData.governingCouncil !== (user.governingCouncil || '') ||
            formData.bio !== (user.bio || '')
        );
    };

    const toggleSpecialization = (specTitle: string) => {
        setFormData((prev) => {
            const already = prev.specializations.includes(specTitle);
            return {
                ...prev,
                specializations: already
                    ? prev.specializations.filter((s) => s !== specTitle)
                    : [...prev.specializations, specTitle],
            };
        });
    };

    const onExpirationDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setExpirationDate(selectedDate);
            setFormData((prev) => ({
                ...prev,
                hpcnaExpiryDate: selectedDate.toISOString(),
            }));
        }
    };

    const handleSave = async () => {
        if (!hasChanges()) {
            Alert.alert('No Changes', 'No changes have been made to your profile.');
            return;
        }

        // Validate required fields
        if (!formData.fullname.trim()) {
            Alert.alert('Error', 'Full name is required');
            return;
        }
        if (!formData.email.trim()) {
            Alert.alert('Error', 'Email is required');
            return;
        }
        if (!formData.cellphoneNumber.trim()) {
            Alert.alert('Error', 'Cellphone number is required');
            return;
        }
        if (!formData.specializations.length) {
            Alert.alert('Error', 'Please select at least one specialization');
            return;
        }
        if (!formData.hpcnaNumber.trim()) {
            Alert.alert('Error', 'HPCNA number is required');
            return;
        }
        if (!formData.yearsOfExperience.trim()) {
            Alert.alert('Error', 'Years of experience is required');
            return;
        }
        if (!formData.operationalZone.trim()) {
            Alert.alert('Error', 'Operational zone is required');
            return;
        }
        if (!formData.bio.trim()) {
            Alert.alert('Error', 'Professional bio is required');
            return;
        }

        setIsLoading(true);
        try {
            await apiClient.put(
                '/app/auth/update-health-provider-details/',
                {
                    fullname: formData.fullname,
                    email: formData.email,
                    cellphoneNumber: formData.cellphoneNumber,
                    gender: formData.gender,
                    address: formData.address,
                    hpcnaNumber: formData.hpcnaNumber,
                    hpcnaExpiryDate: expirationDate.toISOString(),
                    specializations: formData.specializations,
                    yearsOfExperience: parseInt(formData.yearsOfExperience),
                    operationalZone: formData.operationalZone,
                    governingCouncil: formData.governingCouncil,
                    bio: formData.bio,
                }
            );

            await updateUser({
                fullname: formData.fullname,
                email: formData.email,
                cellphoneNumber: formData.cellphoneNumber,
                gender: formData.gender as 'Male' | 'Female' | 'Other',
                address: formData.address,
                hpcnaNumber: formData.hpcnaNumber,
                hpcnaExpiryDate: expirationDate.toISOString(),
                specializations: formData.specializations,
                yearsOfExperience: parseInt(formData.yearsOfExperience),
                operationalZone: formData.operationalZone,
                governingCouncil: formData.governingCouncil,
                bio: formData.bio,
            });

            Alert.alert('Success', 'Profile updated successfully');
            onClose();
        } catch (error: any) {
            Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to update profile'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View className="flex-1 bg-gray-50">
                {/* Header */}
                <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-4 flex-row items-center justify-between">
                    <Text className="text-xl font-bold text-gray-900">Edit Profile</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Feather name="x" size={24} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1 px-4 pt-6">
                    {/* Basic Information Section */}
                    <View className="mb-6">
                        <Text className="text-lg font-bold text-gray-900 mb-4">Basic Information</Text>
                        
                        {/* Full Name */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Full Name</Text>
                            <TextInput
                                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                                placeholder="Enter full name"
                                value={formData.fullname}
                                onChangeText={(text) => setFormData({ ...formData, fullname: text })}
                                editable={!isLoading}
                            />
                        </View>

                        {/* Email */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Email</Text>
                            <TextInput
                                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                                placeholder="Enter email"
                                value={formData.email}
                                onChangeText={(text) => setFormData({ ...formData, email: text })}
                                keyboardType="email-address"
                                editable={!isLoading}
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Cellphone Number */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Cellphone Number</Text>
                            <TextInput
                                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                                placeholder="Enter cellphone number"
                                value={formData.cellphoneNumber}
                                onChangeText={(text) => setFormData({ ...formData, cellphoneNumber: text })}
                                keyboardType="phone-pad"
                                editable={!isLoading}
                            />
                        </View>

                        {/* Gender */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Gender</Text>
                            <View className="flex-row gap-3">
                                {['Male', 'Female'].map((option) => (
                                    <TouchableOpacity
                                        key={option}
                                        onPress={() => setFormData({ ...formData, gender: option as 'Male' | 'Female' })}
                                        disabled={isLoading}
                                        className={`flex-1 py-3 rounded-lg border-2 items-center ${
                                            formData.gender === option
                                                ? 'bg-blue-50 border-blue-500'
                                                : 'bg-white border-gray-300'
                                        }`}
                                    >
                                        <Text className={formData.gender === option ? 'text-blue-600 font-semibold' : 'text-gray-700'}>
                                            {option}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Address */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Address</Text>
                            <TextInput
                                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                                placeholder="Enter address"
                                value={formData.address}
                                onChangeText={(text) => setFormData({ ...formData, address: text })}
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    {/* Professional Details Section */}
                    <View className="mb-6">
                        <Text className="text-lg font-bold text-gray-900 mb-4">Professional Details</Text>

                        {/* Medical Council */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Medical Council</Text>
                            <View className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-3">
                                <Text className="text-gray-700">{formData.governingCouncil}</Text>
                            </View>
                        </View>

                        {/* Specializations */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Specializations</Text>
                            <TextInput
                                value={formData.specializations.join(', ')}
                                editable={false}
                                placeholder="Select specialization(s) below"
                                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 mb-2"
                            />
                            
                            {loadingSpecializations ? (
                                <View className="py-4">
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                    <Text className="text-center text-gray-500 mt-2 text-sm">
                                        Loading specializations...
                                    </Text>
                                </View>
                            ) : filteredSpecializations.length > 0 ? (
                                <View className="flex-row flex-wrap gap-2">
                                    {filteredSpecializations.map((spec) => {
                                        const selected = formData.specializations.includes(spec.title);
                                        return (
                                            <TouchableOpacity
                                                key={spec._id}
                                                onPress={() => toggleSpecialization(spec.title)}
                                                disabled={isLoading}
                                            >
                                                <View
                                                    className={`px-4 py-2 rounded-full ${
                                                        selected ? 'bg-blue-600' : 'bg-gray-200'
                                                    }`}
                                                >
                                                    <Text
                                                        className={`${
                                                            selected ? 'text-white' : 'text-gray-700'
                                                        } font-semibold`}
                                                    >
                                                        {spec.title}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View className="bg-gray-100 p-4 rounded-lg">
                                    <Text className="text-gray-600 text-center text-sm">
                                        No specializations available for {user?.role || 'this role'}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* HPCNA Number */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">HPCNA Registration Number</Text>
                            <TextInput
                                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                                placeholder="Enter HPCNA number"
                                value={formData.hpcnaNumber}
                                onChangeText={(text) => setFormData({ ...formData, hpcnaNumber: text })}
                                editable={!isLoading}
                            />
                        </View>

                        {/* HPCNA Expiry Date */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">HPCNA Expiry Date</Text>
                            <TouchableOpacity
                                onPress={() => setShowDatePicker(true)}
                                disabled={isLoading}
                                className="bg-white border border-gray-300 rounded-lg px-4 py-3"
                            >
                                <Text className="text-gray-900">
                                    {expirationDate.toLocaleDateString()}
                                </Text>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={expirationDate}
                                    mode="date"
                                    display="default"
                                    onChange={onExpirationDateChange}
                                />
                            )}
                        </View>

                        {/* Years of Experience */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Years of Experience</Text>
                            <TextInput
                                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                                placeholder="Enter years"
                                value={formData.yearsOfExperience}
                                onChangeText={(text) => setFormData({ ...formData, yearsOfExperience: text })}
                                keyboardType="number-pad"
                                editable={!isLoading}
                            />
                        </View>

                        {/* Operational Zone */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Operational Zone</Text>
                            <View
                                className="bg-white border border-gray-300 rounded-lg px-3"
                                style={{ height: 56, justifyContent: 'center' }}
                            >
                                <RNPickerSelect
                                    onValueChange={(v) =>
                                        setFormData((p) => ({
                                            ...p,
                                            operationalZone: String(v || ''),
                                        }))
                                    }
                                    value={formData.operationalZone}
                                    items={namibianRegions}
                                    placeholder={{ label: 'Select region…', value: '' }}
                                    disabled={isLoading}
                                    Icon={() => null}
                                    useNativeAndroidPickerStyle={false}
                                    style={{
                                        inputAndroid: { fontSize: 16, color: '#111' },
                                        inputIOS: { fontSize: 16, color: '#111' },
                                        placeholder: { color: '#9CA3AF' },
                                    }}
                                />
                            </View>
                        </View>

                        {/* Bio */}
                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">Professional Bio</Text>
                            <TextInput
                                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                                placeholder="Tell us about your professional experience and expertise"
                                value={formData.bio}
                                onChangeText={(text) => setFormData({ ...formData, bio: text })}
                                multiline
                                numberOfLines={5}
                                editable={!isLoading}
                                textAlignVertical="top"
                                style={{ height: 120 }}
                            />
                        </View>
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={isLoading}
                        className="bg-blue-600 py-4 rounded-lg mb-8 flex-row items-center justify-center"
                        style={{
                            shadowColor: '#3B82F6',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 6,
                        }}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Feather name="check" size={20} color="white" />
                                <Text className="text-white font-semibold ml-2 text-base">Save Changes</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
}