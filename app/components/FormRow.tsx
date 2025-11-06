import { View, Text, TextInput, TextInputProps } from "react-native";

export default function FormRow({label, error, ...props}: TextInputProps & {label: string; error?: string}){
    return(
        <View className="w-full gap-2">
            <Text className="text-sm text-neutral-700">{label}</Text>
            <TextInput
                {...props}
                className={`border rounded-xl p-3 ${error ? 'border-red-500':'border-neutral-300'}`}
            />
            {error ? <Text className="text-red-600 text-xs">{error}</Text> : null}
        </View>
    )
}
