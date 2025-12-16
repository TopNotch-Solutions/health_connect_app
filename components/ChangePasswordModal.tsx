import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_HEIGHT = SCREEN_HEIGHT * 0.8;

interface ChangePasswordModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [showPasswords, setShowPasswords] = useState({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
    });
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const handleChangePassword = async () => {
        // Clear previous errors
        setErrors({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        });

        let hasError = false;
        const newErrors = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        };

        // Validate fields
        if (!passwords.currentPassword.trim()) {
            newErrors.currentPassword = 'Current password is required';
            hasError = true;
        }
        if (!passwords.newPassword.trim()) {
            newErrors.newPassword = 'New password is required';
            hasError = true;
        }
        if (!passwords.confirmPassword.trim()) {
            newErrors.confirmPassword = 'Please confirm your new password';
            hasError = true;
        }

        if (hasError) {
            setErrors(newErrors);
            return;
        }

        if (passwords.newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters long';
            hasError = true;
        }

        if (passwords.newPassword !== passwords.confirmPassword) {
            newErrors.confirmPassword = 'New passwords do not match';
            hasError = true;
        }

        if (passwords.currentPassword === passwords.newPassword) {
            newErrors.newPassword = 'New password must be different from current password';
            hasError = true;
        }

        if (hasError) {
            setErrors(newErrors);
            return;
        }

        setIsLoading(true);
        try {
            await apiClient.patch(
                `/app/auth/change-password/${user?.userId}`,
                {
                    currentPassword: passwords.currentPassword,
                    newPassword: passwords.newPassword,
                }
            );

            Alert.alert('Success', 'Password changed successfully');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
            onClose();
        } catch (error: any) {
            Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to change password'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => {
                setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
                onClose();
            }}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => {
                        setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        onClose();
                    }}
                    style={styles.overlay}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View style={[styles.bottomSheet, { height: MAX_HEIGHT }]}>
                            {/* Drag Handle */}
                            <View style={styles.dragHandle} />

                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.headerTitle}>Change Password</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                        onClose();
                                    }}
                                    style={styles.closeButton}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="x" size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.scrollView}
                                contentContainerStyle={styles.scrollContent}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                {/* Current Password */}
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Current Password</Text>
                                    <View style={[styles.inputWrapper, errors.currentPassword && styles.inputWrapperError]}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter current password"
                                            placeholderTextColor="#9CA3AF"
                                            secureTextEntry={!showPasswords.currentPassword}
                                            value={passwords.currentPassword}
                                            onChangeText={(text) => {
                                                setPasswords({ ...passwords, currentPassword: text });
                                                if (errors.currentPassword) {
                                                    setErrors({ ...errors, currentPassword: '' });
                                                }
                                            }}
                                            editable={!isLoading}
                                        />
                                        <TouchableOpacity
                                            onPress={() => setShowPasswords({ ...showPasswords, currentPassword: !showPasswords.currentPassword })}
                                            style={styles.eyeButton}
                                            activeOpacity={0.7}
                                        >
                                            <Feather
                                                name={showPasswords.currentPassword ? 'eye' : 'eye-off'}
                                                size={20}
                                                color={errors.currentPassword ? '#EF4444' : '#6B7280'}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    {errors.currentPassword ? (
                                        <Text style={styles.errorText}>{errors.currentPassword}</Text>
                                    ) : null}
                                </View>

                                {/* New Password */}
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>New Password</Text>
                                    <View style={[styles.inputWrapper, errors.newPassword && styles.inputWrapperError]}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter new password"
                                            placeholderTextColor="#9CA3AF"
                                            secureTextEntry={!showPasswords.newPassword}
                                            value={passwords.newPassword}
                                            onChangeText={(text) => {
                                                setPasswords({ ...passwords, newPassword: text });
                                                if (errors.newPassword) {
                                                    setErrors({ ...errors, newPassword: '' });
                                                }
                                            }}
                                            editable={!isLoading}
                                        />
                                        <TouchableOpacity
                                            onPress={() => setShowPasswords({ ...showPasswords, newPassword: !showPasswords.newPassword })}
                                            style={styles.eyeButton}
                                            activeOpacity={0.7}
                                        >
                                            <Feather
                                                name={showPasswords.newPassword ? 'eye' : 'eye-off'}
                                                size={20}
                                                color={errors.newPassword ? '#EF4444' : '#6B7280'}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    {errors.newPassword ? (
                                        <Text style={styles.errorText}>{errors.newPassword}</Text>
                                    ) : null}
                                </View>

                                {/* Confirm Password */}
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Confirm Password</Text>
                                    <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputWrapperError]}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Confirm new password"
                                            placeholderTextColor="#9CA3AF"
                                            secureTextEntry={!showPasswords.confirmPassword}
                                            value={passwords.confirmPassword}
                                            onChangeText={(text) => {
                                                setPasswords({ ...passwords, confirmPassword: text });
                                                if (errors.confirmPassword) {
                                                    setErrors({ ...errors, confirmPassword: '' });
                                                }
                                            }}
                                            editable={!isLoading}
                                        />
                                        <TouchableOpacity
                                            onPress={() => setShowPasswords({ ...showPasswords, confirmPassword: !showPasswords.confirmPassword })}
                                            style={styles.eyeButton}
                                            activeOpacity={0.7}
                                        >
                                            <Feather
                                                name={showPasswords.confirmPassword ? 'eye' : 'eye-off'}
                                                size={20}
                                                color={errors.confirmPassword ? '#EF4444' : '#6B7280'}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    {errors.confirmPassword ? (
                                        <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                                    ) : null}
                                </View>

                                {/* Password Requirements */}
                                <View style={styles.requirementsContainer}>
                                    <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                                    <Text style={styles.requirementsText}>• At least 8 characters long</Text>
                                    <Text style={styles.requirementsText}>• Must be different from current password</Text>
                                </View>

                                {/* Change Password Button */}
                                <TouchableOpacity
                                    onPress={handleChangePassword}
                                    disabled={isLoading}
                                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                                    activeOpacity={0.8}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Feather name="lock" size={20} color="#FFFFFF" />
                                            <Text style={styles.primaryButtonText}>Change Password</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {/* Cancel Button */}
                                <TouchableOpacity
                                    onPress={() => {
                                        setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                        onClose();
                                    }}
                                    disabled={isLoading}
                                    style={styles.cancelButton}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 0,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#D1D5DB',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 8,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 32,
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
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
    },
    inputWrapperError: {
        borderColor: '#EF4444',
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
        marginLeft: 4,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
    },
    eyeButton: {
        padding: 8,
    },
    requirementsContainer: {
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    requirementsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E40AF',
        marginBottom: 8,
    },
    requirementsText: {
        fontSize: 12,
        color: '#1E3A8A',
        marginBottom: 4,
    },
    primaryButton: {
        backgroundColor: '#10B981',
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 8,
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
});
