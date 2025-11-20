import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';

interface EditPatientProfileModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function EditPatientProfileModal({ visible, onClose }: EditPatientProfileModalProps) {
    const { user, updateUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullname: user?.fullname || '',
        email: user?.email || '',
        cellphoneNumber: user?.cellphoneNumber || '',
        dateOfBirth: user?.dateOfBirth || '',
        gender: user?.gender || 'Male',
        address: user?.address || '',
        town: user?.town || '',
        region: user?.region || '',
    });

    const handleSave = async () => {
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
        if (!formData.dateOfBirth.trim()) {
            Alert.alert('Error', 'Date of birth is required');
            return;
        }
        if (!formData.address.trim()) {
            Alert.alert('Error', 'Address is required');
            return;
        }
        if (!formData.town.trim()) {
            Alert.alert('Error', 'Town is required');
            return;
        }
        if (!formData.region.trim()) {
            Alert.alert('Error', 'Region is required');
            return;
        }

        setIsLoading(true);
        try {
            await apiClient.put(
                `/app/auth/update-patient-details/${user?.userId}`,
                {
                    fullname: formData.fullname,
                    email: formData.email,
                    cellphoneNumber: formData.cellphoneNumber,
                    dateOfBirth: formData.dateOfBirth,
                    gender: formData.gender,
                    address: formData.address,
                    town: formData.town,
                    region: formData.region,
                    nationalId: '',
                }
            );

            await updateUser({
                fullname: formData.fullname,
                email: formData.email,
                cellphoneNumber: formData.cellphoneNumber,
                dateOfBirth: formData.dateOfBirth,
                gender: formData.gender,
                address: formData.address,
                town: formData.town,
                region: formData.region,
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
                <View className="bg-white border-b border-gray-200 pt-4 pb-4 px-4 flex-row items-center justify-between">
                    <Text className="text-xl font-bold text-gray-900">Edit Profile</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Feather name="x" size={24} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1 px-4 pt-6">
                    {/* Full Name */}
                    <View className="mb-5">
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
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Email</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="Enter email"
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            keyboardType="email-address"
                            editable={!isLoading}
                        />
                    </View>

                    {/* Cellphone Number */}
                    <View className="mb-5">
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

                    {/* Date of Birth */}
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Date of Birth (YYYY-MM-DD)</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="YYYY-MM-DD"
                            value={formData.dateOfBirth}
                            onChangeText={(text) => setFormData({ ...formData, dateOfBirth: text })}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Gender */}
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Gender</Text>
                        <View className="flex-row gap-4">
                            {['Male', 'Female', 'Other'].map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    onPress={() => setFormData({ ...formData, gender: option as any })}
                                    disabled={isLoading}
                                    className={`flex-1 py-3 rounded-lg border-2 items-center ${
                                        formData.gender === option
                                            ? 'bg-blue-100 border-blue-500'
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
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Address</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="Enter address"
                            value={formData.address}
                            onChangeText={(text) => setFormData({ ...formData, address: text })}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Town */}
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Town</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="Enter town"
                            value={formData.town}
                            onChangeText={(text) => setFormData({ ...formData, town: text })}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Region */}
                    <View className="mb-6">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Region</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="Enter region"
                            value={formData.region}
                            onChangeText={(text) => setFormData({ ...formData, region: text })}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={isLoading}
                        className="bg-blue-600 py-3 rounded-lg mb-8 flex-row items-center justify-center"
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Feather name="check" size={20} color="white" />
                                <Text className="text-white font-semibold ml-2">Save Changes</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
}
