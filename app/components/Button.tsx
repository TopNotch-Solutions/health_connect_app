import { TouchableOpacity, Text } from "react-native";

export default function Button({ title, onPress, disabled}: { title: string; onPress:() => void; disabled?:boolean}){
    return(
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            className={`rounded-xl p-4 ${disabled ? 'bg-neutral-300':'bg-blue-600'}`}
        >
            <Text className="text-white text-center font-medium">{title}</Text>
        </TouchableOpacity>
    );
}