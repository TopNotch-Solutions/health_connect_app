import * as ImagePicker from 'expo-image-picker';
import { View, Text, Image, TouchableOpacity } from 'react-native';

export default function ImagePickerField({label, image, setImage}:{label: string; image?: ImagePicker.ImagePickerAsset | null; setImage: (f: ImagePicker.ImagePickerAsset | null)=> void}){
    const pick = async() => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchImageLibraryAsync({mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8});
        if (!res.canceled) setImage(res.assets[0]);
    }
    return(
        <View className='gap-2'>
            <Text className='text-sm text-neutral-700'>{label}</Text>
            {image ? (
                <Image source={{uri: image.uri}} className='w-full h-40 rounded-xl'/>
            ) : (
                <TouchableOpacity onPress={pick} className='border border-dashed rounded-xl p-6 items-center justify-center border-neutral-300'>
                    <Text className='text-neutral-600'>Tap to choose image</Text>
                </TouchableOpacity>
            )}
        </View>
    )
}