import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

declare global {
    var acceptProviderTermsCallback: ((accepted: boolean) => void) | undefined;
}

export default function ProviderTermsConditionsScreen() {
    const router = useRouter();
    const [accepted, setAccepted] = useState(false);

    const handleAccept = () => {
        if (accepted) {
            router.back();
            setTimeout(() => {
                if (global.acceptProviderTermsCallback) {
                    global.acceptProviderTermsCallback(true);
                }
            }, 100);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />
            
            {/* Header */}
            <View className="p-6 border-b border-gray-200">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-3">
                        <Feather name="arrow-left" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">Terms & Conditions</Text>
                </View>
                <Text className="text-sm text-gray-600">Please read carefully before proceeding</Text>
            </View>

            <ScrollView className="flex-1 px-6 py-4">
                {/* Main Title */}
                <View className="bg-red-50 p-4 rounded-xl border-2 border-red-200 mb-6">
                    <Text className="text-xl font-bold text-red-900 mb-2">🩺 Absolute Provider Liability and Indemnification Agreement</Text>
                    <Text className="text-sm text-red-800 leading-6">
                        By clicking Accept and providing services through the Health_Connect platform, you (the Provider) confirm and irrevocably agree to the following legally binding terms.
                    </Text>
                </View>

                {/* Section 1 */}
                <View className="mb-6">
                    <View className="flex-row items-start mb-3">
                        <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
                            <Text className="text-white font-bold">1</Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-900 flex-1">Status and Sole Responsibility</Text>
                    </View>
                    <Text className="text-base text-gray-700 leading-6 ml-11">
                        You confirm that your engagement with Kopano-Vertex Trading cc (trading as Health_Connect) is strictly and exclusively that of an independent contractor. You acknowledge that you are not, and shall not be deemed, an employee, agent, partner, joint venturer, or representative of Health_Connect for any purpose whatsoever.
                    </Text>
                </View>

                {/* Section 2 */}
                <View className="mb-6">
                    <View className="flex-row items-start mb-3">
                        <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
                            <Text className="text-white font-bold">2</Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-900 flex-1">Absolute Clinical Liability</Text>
                    </View>
                    <Text className="text-base text-gray-700 leading-6 ml-11 mb-3">
                        You accept full, absolute, and unreserved personal and professional liability for any and all acts, omissions, negligence, error, or breach arising from the healthcare services you provide.
                    </Text>
                    <View className="ml-11 bg-gray-50 p-4 rounded-xl mb-3">
                        <Text className="text-sm font-bold text-gray-900 mb-2">Scope of Liability:</Text>
                        <Text className="text-sm text-gray-700 leading-5">
                            This absolute liability expressly includes, but is not limited to, all medical advice, clinical diagnoses, treatment plans, prescriptions, professional conduct, patient outcomes, and adherence to professional standards, as strictly governed by the Health Professions Councils of Namibia (HPCNA).
                        </Text>
                    </View>
                </View>

                {/* Section 3 */}
                <View className="mb-6">
                    <View className="flex-row items-start mb-3">
                        <View className="w-8 h-8 rounded-full bg-red-500 items-center justify-center mr-3">
                            <Text className="text-white font-bold">3</Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-900 flex-1">Duty to Defend and Maximum Indemnification</Text>
                    </View>
                    <Text className="text-base text-gray-700 leading-6 ml-11 mb-3">
                        You shall defend, indemnify, and hold completely harmless Kopano-Vertex Trading cc, its owners, directors, employees, successors, and assigns (the Indemnified Parties) against any and all losses, claims, demands, liabilities, lawsuits, judgments, fines, damages, expenses, and costs.
                    </Text>
                    <View className="ml-11 bg-gray-50 p-4 rounded-xl mb-3">
                        <Text className="text-sm font-bold text-gray-900 mb-2">Coverage Includes:</Text>
                        <Text className="text-sm text-gray-700 leading-5 mb-2">
                            • Your professional services or clinical decisions on or off the platform
                        </Text>
                        <Text className="text-sm text-gray-700 leading-5 mb-2">
                            • Any breach of your professional duties or this Agreement
                        </Text>
                        <Text className="text-sm text-gray-700 leading-5">
                            • Any claim brought by a patient or third party regarding your medical practice
                        </Text>
                    </View>
                </View>

                {/* Section 4 */}
                <View className="mb-6">
                    <View className="flex-row items-start mb-3">
                        <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
                            <Text className="text-white font-bold">4</Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-900 flex-1">Insurance Obligation</Text>
                    </View>
                    <Text className="text-base text-gray-700 leading-6 ml-11">
                        You confirm and warrant that you possess and shall maintain, at your sole expense, adequate and current professional liability insurance (malpractice insurance) required by the HPCNA, with coverage limits sufficient to cover your indemnification obligations under this Agreement.
                    </Text>
                </View>

                {/* Bottom spacing for checkbox */}
                <View className="h-32" />
            </ScrollView>

            {/* Fixed Bottom Section with Checkbox and Button */}
            <View className="p-6 bg-white border-t-2 border-gray-200">
                {/* Checkbox */}
                <TouchableOpacity 
                    onPress={() => setAccepted(!accepted)} 
                    className="flex-row items-start p-4 bg-gray-50 rounded-xl border-2 border-gray-200 mb-4"
                    activeOpacity={0.7}
                >
                    <View className={`w-6 h-6 rounded-md mr-3 items-center justify-center border-2 ${accepted ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}>
                        {accepted && <Feather name="check" size={16} color="white" />}
                    </View>
                    <View className="flex-1">
                        <Text className="text-gray-900 text-sm font-bold leading-5">
                            I have read, understood, and irrevocably accept all terms and conditions stated above.
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Accept Button */}
                <TouchableOpacity 
                    onPress={handleAccept} 
                    disabled={!accepted}
                    className={`p-4 rounded-xl ${accepted ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                    <Text className="text-white text-center text-lg font-bold">
                        Accept & Continue
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
