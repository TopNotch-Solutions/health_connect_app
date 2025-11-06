import { useRef } from "react";
import { View, TextInput } from "react-native";

export default function OtpInput({value, setValue, length = 7}: {value: string; setValue: (v: string)=>void; length?: number}){
    const refs = Array.from({length}, () => useRef<TextInput>(null));
    const vals = value.padEnd(length, ' ').split('').slice(0,length);

    return (
        <View className="flex-row gap-2 w-full justify-center">
            {vals.map((ch,idx)=>(
                <TextInput
                    key={idx}
                    ref={refs[idx]}
                    value={ch.trim()}
                    keyboardType="number-pad"
                    maxLength={1}
                    onChangeText={(t) => {
                        const chars = value.split('');
                        chars[idx] = t.replace(/\D/g, '').slice(-1);
                        const next = chars.join('');
                        setValue(next);
                        if (t && idx < length - 1) refs[idx + 1].current?.focus();
                    }}
                    className="w-12 h-12 text-center border rounded-xl border-neutral-300 text-lg"
                />
            ))}
        </View>
    )
}