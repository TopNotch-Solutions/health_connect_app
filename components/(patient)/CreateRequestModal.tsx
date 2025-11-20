import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface CreateRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (requestData: {
    ailmentCategory: string;
    symptoms: string;
    urgencyLevel: 'low' | 'medium' | 'high';
    paymentMethod: 'wallet' | 'cash';
    estimatedCost: number;
  }) => Promise<void>;
  selectedAilment?: string;
}

export default function CreateRequestModal({
  visible,
  onClose,
  onSubmit,
  selectedAilment = '',
}: CreateRequestModalProps) {
  const [ailmentCategory, setAilmentCategory] = useState(selectedAilment);
  const [symptoms, setSymptoms] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash'>('wallet');
  const [estimatedCost, setEstimatedCost] = useState('200');
  const [isLoading, setIsLoading] = useState(false);

  // Update ailment category when selectedAilment changes
  useEffect(() => {
    if (selectedAilment) {
      setAilmentCategory(selectedAilment);
    }
  }, [selectedAilment]);

  const handleSubmit = async () => {
    // Validation
    if (!ailmentCategory.trim()) {
      Alert.alert('Required', 'Please select or enter an ailment category');
      return;
    }

    if (!symptoms.trim()) {
      Alert.alert('Required', 'Please describe your symptoms');
      return;
    }

    const cost = parseFloat(estimatedCost);
    if (isNaN(cost) || cost <= 0) {
      Alert.alert('Invalid Cost', 'Please enter a valid estimated cost');
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        ailmentCategory: ailmentCategory.trim(),
        symptoms: symptoms.trim(),
        urgencyLevel,
        paymentMethod,
        estimatedCost: cost,
      });
      
      // Reset form on success
      setAilmentCategory('');
      setSymptoms('');
      setUrgencyLevel('medium');
      setPaymentMethod('wallet');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create request');
    } finally {
      setIsLoading(false);
    }
  };

  const urgencyOptions = [
    { value: 'low', label: 'Low', color: 'bg-green-100', textColor: 'text-green-700' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100', textColor: 'text-yellow-700' },
    { value: 'high', label: 'High', color: 'bg-red-100', textColor: 'text-red-700' },
  ];

  const paymentOptions = [
    { value: 'wallet', label: 'Wallet', icon: 'credit-card' },
    { value: 'cash', label: 'Cash', icon: 'dollar-sign' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl flex-1" style={{ marginTop: '10%' }}>
            {/* Header */}
            <View className="flex-row items-center justify-between p-6 border-b border-gray-200">
              <Text className="text-2xl font-bold text-gray-900">Request Healthcare</Text>
              <TouchableOpacity onPress={onClose} disabled={isLoading}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
            {/* Ailment Category */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-900 mb-2">
                Ailment Category *
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-base"
                placeholder="e.g., Flu, Cold & Cough"
                value={ailmentCategory}
                onChangeText={setAilmentCategory}
                editable={!isLoading}
              />
            </View>

            {/* Symptoms */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-900 mb-2">
                Describe Your Symptoms *
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-base"
                placeholder="Please describe what you're experiencing..."
                value={symptoms}
                onChangeText={setSymptoms}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isLoading}
              />
            </View>

            {/* Urgency Level */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-900 mb-2">
                Urgency Level *
              </Text>
              <View className="flex-row gap-3">
                {urgencyOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setUrgencyLevel(option.value as any)}
                    disabled={isLoading}
                    className={`flex-1 p-4 rounded-lg border-2 ${
                      urgencyLevel === option.value
                        ? `${option.color} border-gray-400`
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        urgencyLevel === option.value ? option.textColor : 'text-gray-600'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Estimated Cost */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-900 mb-2">
                Estimated Cost (R) *
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-base"
                placeholder="e.g., 200"
                value={estimatedCost}
                onChangeText={setEstimatedCost}
                keyboardType="numeric"
                editable={!isLoading}
              />
            </View>

            {/* Payment Method */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-900 mb-2">
                Payment Method *
              </Text>
              <View className="flex-row gap-3">
                {paymentOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setPaymentMethod(option.value as any)}
                    disabled={isLoading}
                    className={`flex-1 flex-row items-center justify-center p-4 rounded-lg border-2 ${
                      paymentMethod === option.value
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <Feather
                      name={option.icon as any}
                      size={20}
                      color={paymentMethod === option.value ? '#3B82F6' : '#6B7280'}
                    />
                    <Text
                      className={`ml-2 font-semibold ${
                        paymentMethod === option.value ? 'text-blue-600' : 'text-gray-600'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Info Box */}
            <View className="bg-blue-50 rounded-lg p-4 mb-6">
              <View className="flex-row items-start">
                <Feather name="info" size={20} color="#3B82F6" />
                <View className="flex-1 ml-3">
                  <Text className="text-sm text-blue-900 font-semibold mb-1">
                    Request will be sent to nearby providers
                  </Text>
                  <Text className="text-sm text-blue-800">
                    Your location will be shared with the healthcare provider who accepts your
                    request. The request expires after 30 minutes if not accepted.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View className="p-6 border-t border-gray-200">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              className={`py-4 rounded-lg ${
                isLoading ? 'bg-blue-300' : 'bg-blue-600'
              }`}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white text-center text-lg font-semibold">
                  Submit Request
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
