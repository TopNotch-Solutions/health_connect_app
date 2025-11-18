import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Extend global type
declare global {
    var acceptTermsCallback: ((accepted: boolean) => void) | undefined;
}

export default function TermsAndConditionsScreen() {
    const router = useRouter();
    const [accepted, setAccepted] = useState(false);

    const handleAccept = () => {
        if (accepted) {
            // Navigate back and pass the accepted state
            router.back();
            // Use a small delay to ensure navigation completes
            setTimeout(() => {
                if (global.acceptTermsCallback) {
                    global.acceptTermsCallback(true);
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
                    <Text className="text-xl font-bold text-red-900 mb-2">Absolute Patient Waiver and Release of Liability</Text>
                    <Text className="text-sm text-red-800 leading-6">
                        By clicking "Accept" and using the Health_Connect platform, you (the "User") confirm and irrevocably agree to the following legally binding terms. Your acceptance constitutes a complete and absolute waiver of your right to sue the platform.
                    </Text>
                </View>

                {/* Section 1 */}
                <View className="mb-6">
                    <View className="flex-row items-start mb-3">
                        <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
                            <Text className="text-white font-bold">1</Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-900 flex-1">Technology Platform Status (Not a Healthcare Provider)</Text>
                    </View>
                    <Text className="text-base text-gray-700 leading-6 ml-11">
                        You acknowledge and agree that Kopano-Vertex Trading cc (trading as Health_Connect) is exclusively a technology service provider. The platform provides a logistical connection between you and independent healthcare practitioners. Under no circumstances is Health_Connect, its owners, directors, or employees a provider of medical care, diagnosis, advice, or treatment.
                    </Text>
                </View>

                {/* Section 2 */}
                <View className="mb-6">
                    <View className="flex-row items-start mb-3">
                        <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
                            <Text className="text-white font-bold">2</Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-900 flex-1">Absolute Assumption of Risk and Release of Claims</Text>
                    </View>
                    <Text className="text-base text-gray-700 leading-6 ml-11 mb-3">
                        You understand and agree that the entire responsibility and liability for the clinical services, advice, and outcomes rests solely and exclusively with the independent healthcare provider you select.
                    </Text>
                    <View className="ml-11 bg-gray-50 p-4 rounded-xl mb-3">
                        <Text className="text-sm font-bold text-gray-900 mb-2">Irrevocable Waiver:</Text>
                        <Text className="text-sm text-gray-700 leading-5">
                            You hereby irrevocably and absolutely release, waive, and forever discharge Kopano-Vertex Trading cc, its affiliates, directors, owners, and employees from any and all claims, demands, liabilities, suits, actions, and causes of action whatsoever, whether in law or equity, which may arise from or relate to the medical care, advice, diagnosis, treatment, or judgment provided by any independent healthcare professional connected through the platform.
                        </Text>
                    </View>
                    <View className="ml-11 bg-gray-50 p-4 rounded-xl">
                        <Text className="text-sm font-bold text-gray-900 mb-2">No Recourse Against Platform:</Text>
                        <Text className="text-sm text-gray-700 leading-5">
                            You acknowledge that your sole and exclusive recourse for any claim of malpractice, negligence, misdiagnosis, or professional error is directly against the independent healthcare provider and not against Health_Connect.
                        </Text>
                    </View>
                </View>

                {/* Section 3 */}
                <View className="mb-6">
                    <View className="flex-row items-start mb-3">
                        <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
                            <Text className="text-white font-bold">3</Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-900 flex-1">Independent Contractor Status of Providers</Text>
                    </View>
                    <Text className="text-base text-gray-700 leading-6 ml-11">
                        You acknowledge and agree that the healthcare practitioners on this platform are independent contractors and are not employees, agents, partners, or representatives of Health_Connect.
                    </Text>
                </View>

                {/* Section 4 */}
                <View className="mb-6">
                    <View className="flex-row items-start mb-3">
                        <View className="w-8 h-8 rounded-full bg-red-500 items-center justify-center mr-3">
                            <Text className="text-white font-bold">4</Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-900 flex-1">Emergency Services Exclusion</Text>
                    </View>
                    <Text className="text-base text-gray-700 leading-6 ml-11">
                        You understand that this platform is NOT a substitute for emergency medical care. You warrant that you will not use this platform for any medical emergency, and you accept full liability for any harm resulting from attempting to use this service in an emergency.
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
