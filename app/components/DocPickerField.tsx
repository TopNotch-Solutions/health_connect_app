import * as DocumentPicker from 'expo-document-picker'
import { View, Text, TouchableOpacity } from 'react-native'

export default function DocPickerField({ label, file, setFile, accept = ['application/pdf','image/jpeg','image/png','image/webp'] }:
    { label: string; file?: DocumentPicker.DocumentPickerAsset | null; setFile: (f: DocumentPicker.DocumentPickerAsset | null) => void; accept?: string[] }) {
    const pick = async () => {
        const res = await DocumentPicker.getDocumentAsync({ type: accept });
        if (res.canceled) return;
        setFile(res.assets[0]);
    };
    return (
        <View className="gap-2">
            <Text className="text-sm text-neutral-700">{label}</Text>
            <TouchableOpacity onPress={pick} className="border border-dashed rounded-xl p-4 items-center justify-center border-neutral-300">
                <Text className="text-neutral-600">{file ? file.name : 'Tap to choose file'}</Text>
            </TouchableOpacity>
        </View>
    );
}