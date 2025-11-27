import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';

interface EditProviderProfileModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function EditProviderProfileModal({ visible, onClose }: EditProviderProfileModalProps) {
    const { user, updateUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullname: user?.fullname || '',
        email: user?.email || '',
        cellphoneNumber: user?.cellphoneNumber || '',
        gender: user?.gender || 'Male',
        address: user?.address || '',
        hpcnaNumber: '',
        hpcnaExpiryDate: '',
        specializations: '',
        yearsOfExperience: '',
        operationalZone: '',
        governingCouncil: '',
        bio: '',
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

        setIsLoading(true);
        try {
            await apiClient.put(
                `/app/auth/update-health-provider-details/${user?.userId}`,
                {
                    fullname: formData.fullname,
                    email: formData.email,
                    cellphoneNumber: formData.cellphoneNumber,
                    gender: formData.gender,
                    address: formData.address,
                    hpcnaNumber: formData.hpcnaNumber || undefined,
                    hpcnaExpiryDate: formData.hpcnaExpiryDate || undefined,
                    specializations: formData.specializations ? formData.specializations.split(',') : undefined,
                    yearsOfExperience: formData.yearsOfExperience ? parseInt(formData.yearsOfExperience) : undefined,
                    operationalZone: formData.operationalZone || undefined,
                    governingCouncil: formData.governingCouncil || undefined,
                    bio: formData.bio || undefined,
                }
            );

            await updateUser({
                fullname: formData.fullname,
                email: formData.email,
                cellphoneNumber: formData.cellphoneNumber,
                gender: formData.gender,
                address: formData.address,
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

                    {/* HPCNA Number */}
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">HPCNA Number</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="Enter HPCNA number"
                            value={formData.hpcnaNumber}
                            onChangeText={(text) => setFormData({ ...formData, hpcnaNumber: text })}
                            editable={!isLoading}
                        />
                    </View>

                    {/* HPCNA Expiry Date */}
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">HPCNA Expiry Date</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="YYYY-MM-DD"
                            value={formData.hpcnaExpiryDate}
                            onChangeText={(text) => setFormData({ ...formData, hpcnaExpiryDate: text })}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Specializations */}
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Specializations (comma-separated)</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="e.g. Nurse, Doctor"
                            value={formData.specializations}
                            onChangeText={(text) => setFormData({ ...formData, specializations: text })}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Years of Experience */}
                    <View className="mb-5">
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
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Operational Zone</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="Enter operational zone"
                            value={formData.operationalZone}
                            onChangeText={(text) => setFormData({ ...formData, operationalZone: text })}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Governing Council */}
                    <View className="mb-5">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Governing Council</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="Enter governing council"
                            value={formData.governingCouncil}
                            onChangeText={(text) => setFormData({ ...formData, governingCouncil: text })}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Bio */}
                    <View className="mb-6">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Bio</Text>
                        <TextInput
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                            placeholder="Enter bio"
                            value={formData.bio}
                            onChangeText={(text) => setFormData({ ...formData, bio: text })}
                            multiline
                            numberOfLines={4}
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
