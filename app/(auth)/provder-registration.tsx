// In app/(providerAuth)/register.tsx

import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Type Definitions ---
type PickedImage = ImagePicker.ImagePickerAsset | null;
type DocFile = DocumentPicker.DocumentPickerAsset | null;
type Step = 1 | 2 | 3 | 4;

// --- A new, reusable component for the square Upload Boxes ---
const UploadBox = ({ label, file, onPick, icon }: { label: string; file: PickedImage | DocFile; onPick: () => void; icon: any; }) => (
    <TouchableOpacity onPress={onPick} className="bg-gray-100 border border-gray-200 rounded-xl items-center justify-center h-32 flex-1">
        {file ? (
            <View className="items-center justify-center p-2">
                 <Feather name="check-circle" size={32} color="#28A745" />
                 <Text className="text-secondary font-semibold mt-2 text-center" numberOfLines={2}>{file.name}</Text>
            </View>
        ) : (
            <View className="items-center justify-center">
                <Feather name={icon} size={32} color="#6C757D" />
                <Text className="text-text-main font-semibold mt-2 text-center">{label}</Text>
            </View>
        )}
    </TouchableOpacity>
);


export default function ProviderRegistrationScreen() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false); // State for the checkbox

    // --- State Management for Form Data ---
    const [accountInfo, setAccountInfo] = useState({ fullname: '', email: '', password: '', cellphoneNumber: '+264' });
    const [documents, setDocuments] = useState({
        profileImage: null as PickedImage,
        idDocumentFront: null as DocFile,
        idDocumentBack: null as DocFile,
        primaryQualification: null as DocFile,
        annualQualification: null as DocFile,
    });
    const [professionalDetails, setProfessionalDetails] = useState({
        governingCouncil: 'Health Professionals Council of Namibia',
        hpcnaNumber: '',
        bio: '',
        specializationsCsv: '',
    });

    const pickImage = async (field: keyof typeof documents) => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 1 });
        if (!result.canceled) {
            setDocuments(prev => ({ ...prev, [field]: result.assets[0] }));
        }
    };
    const pickDocument = async (field: keyof typeof documents) => {
        const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
        if (!result.canceled) {
            setDocuments(prev => ({ ...prev, [field]: result.assets[0] }));
        }
    };
    
    // --- UPDATED Navigation Logic with Validation ---
    const handleNext = () => {
        if (step === 1) {
            if (!accountInfo.fullname || !accountInfo.email || !accountInfo.password) {
                return Alert.alert("Missing Information", "Please fill in your Full Name, Email, and Password.");
            }
            if (!agreeToTerms) {
                return Alert.alert("Agreement Required", "You must agree to the Subscriber Agreement to continue.");
            }
        }
        setStep(prev => Math.min(prev + 1, 4) as Step);
    };

    const handleBack = () => setStep(prev => Math.max(prev - 1, 1) as Step);
    const handleSubmit = async () => { /* ... existing code ... */ };

    return (
        <SafeAreaView className="flex-1 bg-background-light">
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                <View className="p-6">
                    {/* Progress Bar */}
                    <View className="flex-row items-center mb-8">
                        <Text className="text-lg font-semibold text-text-main mr-4">Step {step} of 4</Text>
                        <View className="flex-1 h-2 bg-gray-200 rounded-full">
                            <View style={{ width: `${(step / 4) * 100}%` }} className="h-2 bg-primary rounded-full" />
                        </View>
                    </View>

                    {/* --- STEP 1: REVAMPED Account Information --- */}
                   {step === 1 && (
    <View>
        <Text className="text-2xl font-bold text-text-main mb-6">Account Information</Text>
        
        <Text className="text-base text-text-main mb-2 font-semibold">Full Name</Text>
        <TextInput 
            value={accountInfo.fullname} 
            onChangeText={t => setAccountInfo(p => ({ ...p, fullname: t }))} 
            className="bg-white p-4 rounded-xl mb-4 border border-gray-200" 
            placeholder="Dr. John Doe" 
        />
        
        <Text className="text-base text-text-main mb-2 font-semibold">Email</Text>
        <TextInput 
            value={accountInfo.email} 
            onChangeText={t => setAccountInfo(p => ({ ...p, email: t }))} 
            className="bg-white p-4 rounded-xl mb-4 border border-gray-200" 
            placeholder="youremail@example.com" 
            autoCapitalize='none' 
            keyboardType='email-address'
        />
        
        <Text className="text-base text-text-main mb-2 font-semibold">Mobile</Text>
        {/* We make this field non-editable and pre-fill it with the verified number */}
        <View className="bg-gray-100 p-4 rounded-xl mb-4 border border-gray-200">
             <Text className="text-base text-gray-500">{accountInfo.cellphoneNumber}</Text>
        </View>
        
        <Text className="text-base text-text-main mb-2 font-semibold">Password</Text>
        <TextInput 
            value={accountInfo.password} 
            onChangeText={t => setAccountInfo(p => ({ ...p, password: t }))} 
            className="bg-white p-4 rounded-xl mb-6 border border-gray-200" 
            placeholder="Create a secure password" 
            secureTextEntry
        />

        {/* The file uploads are removed from this step to match the screenshot */}
    </View>
)}
                    
                    {/* --- STEP 2: UPDATED Documents & Qualifications (Now shows the remaining uploads) --- */}
                    {step === 2 && (
                        <View>
                             <Text className="text-2xl font-bold text-text-main mb-6">Documents & Qualifications</Text>
                             <UploadBox label="Upload Identification (Back)" file={documents.idDocumentBack} onPick={() => pickDocument('idDocumentBack')} icon="file-text" />
                             <UploadBox label="Upload Primary Qualification" file={documents.primaryQualification} onPick={() => pickDocument('primaryQualification')} icon="award" />
                             <UploadBox label="Upload Annual Practicing Certificate" file={documents.annualQualification} onPick={() => pickDocument('annualQualification')} icon="calendar" />
                        </View>
                    )}
                    
                    {/* Step 2: Documents & Qualifications */}
                  
                    {/* Step 3: Professional Details */}
                    {step === 3 && (
                        <View>
                            <Text className="text-2xl font-bold text-text-main mb-6">Professional Details</Text>
                            <Text className="text-base text-text-main mb-2 font-semibold">Medical Council</Text>
                            <View className="bg-gray-100 p-4 rounded-xl mb-4 border border-gray-200"><Text className="text-gray-500">{professionalDetails.governingCouncil}</Text></View>
                            
                            <Text className="text-base text-text-main mb-2 font-semibold">HPCNA Registration Number</Text>
                            <TextInput value={professionalDetails.hpcnaNumber} onChangeText={t => setProfessionalDetails(p => ({ ...p, hpcnaNumber: t }))} className="bg-white p-4 rounded-xl mb-4 border border-gray-200" placeholder="e.g., T12345"/>
                            
                            <Text className="text-base text-text-main mb-2 font-semibold">Professional Bio</Text>
                            <TextInput value={professionalDetails.bio} onChangeText={t => setProfessionalDetails(p => ({ ...p, bio: t }))} className="bg-white p-4 rounded-xl mb-4 border border-gray-200 h-24" placeholder="A brief summary of your expertise..." multiline textAlignVertical="top"/>
                            
                            <Text className="text-base text-text-main mb-2 font-semibold">Specializations</Text>
                            <TextInput value={professionalDetails.specializationsCsv} onChangeText={t => setProfessionalDetails(p => ({ ...p, specializationsCsv: t }))} className="bg-white p-4 rounded-xl mb-4 border border-gray-200" placeholder="Internal Medicine, Cardiology (comma-separated)"/>
                        </View>
                    )}

                    {/* Step 4: Review & Submit */}
                    {step === 4 && (
                        <View className="items-center">
                            <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4"><Feather name="check" size={32} color="#28A745" /></View>
                            <Text className="text-2xl font-bold text-text-main mb-2">Review & Submit</Text>
                            <Text className="text-base text-gray-500 text-center mb-8">Please review your information before submitting for verification.</Text>
                            {/* Display summary of info here */}
                            <View className="w-full bg-white p-4 rounded-xl">
                                <Text className="font-bold text-text-main">{accountInfo.fullname}</Text>
                                <Text className="text-gray-600">{accountInfo.email}</Text>
                                <Text className="text-gray-600">{accountInfo.cellphoneNumber}</Text>
                                <View className="h-px bg-gray-200 my-3" />
                                <Text className="font-bold text-text-main">HPCNA Number</Text>
                                <Text className="text-gray-600">{professionalDetails.hpcnaNumber}</Text>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Sticky Next/Back/Submit Button */}
            <View className="absolute bottom-0 left-0 right-0 p-6 bg-background-light border-t border-t-gray-200">
                <View className="flex-row">
                    {step > 1 && (
                        <TouchableOpacity onPress={handleBack} className="bg-gray-200 p-4 rounded-xl flex-1 mr-2">
                            <Text className="text-center text-lg font-semibold text-text-main">Back</Text>
                        </TouchableOpacity>
                    )}
                    {step < 4 ? (
                        <TouchableOpacity onPress={handleNext} className="bg-primary p-4 rounded-xl flex-1">
                            <Text className="text-white text-center text-lg font-semibold">Next</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={handleSubmit} disabled={isLoading} className={`bg-secondary p-4 rounded-xl flex-1 ${isLoading && 'opacity-50'}`}>
                            {isLoading ? <ActivityIndicator color="white" /> : <Text className="text-white text-center text-lg font-semibold">Submit for Review</Text>}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}