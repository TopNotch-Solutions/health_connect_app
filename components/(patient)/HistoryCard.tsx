import { Feather } from "@expo/vector-icons";
import { View, Text } from "react-native";


export interface HistoryItem {
    _id: string;
    ailment: string;
    status: string;
    date: string;
}

const HistoryCard = ({ item }: { item: HistoryItem }) => {
    const getStatusConfig = (status: string) => {
    switch (status) {
        case 'completed':
            return { color: '#10B981', bgColor: '#D1FAE5', icon: 'check-circle' };
        case 'cancelled':
            return { color: '#EF4444', bgColor: '#FEE2E2', icon: 'x-circle' };
        case 'pending':
        case 'searching':
            return { color: '#F59E0B', bgColor: '#FEF3C7', icon: 'clock' };
        case 'accepted':
        case 'en_route':
        case 'arrived':
            return { color: '#3B82F6', bgColor: '#DBEAFE', icon: 'navigation' };
        default:
            return { color: '#6B7280', bgColor: '#F3F4F6', icon: 'info' };
        }
    };

    const statusConfig = getStatusConfig(item.status);
    const statusText = item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' ');

    return (
        <View 
            className="w-[48%] bg-white rounded-2xl mb-4 overflow-hidden"
            style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 3,
                borderWidth: 1,
                borderColor: '#E5E7EB',
            }}
        >
        <View style={{ padding: 12 }}>
            <Text 
                className="text-sm font-bold text-gray-800 mb-2" 
                numberOfLines={2}
                style={{ minHeight: 40 }}
            >
                {item.ailment}
            </Text>
        
            <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                marginBottom: 8,
                backgroundColor: statusConfig.bgColor,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                alignSelf: 'flex-start',
            }}>
                <Feather name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                <Text
                    style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: statusConfig.color,
                    marginLeft: 4,
                    }}
                >
                    {statusText}
                </Text>
            </View>
        
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Feather name="calendar" size={12} color="#9CA3AF" />
                <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 4 }}>
                    {item.date}
                </Text>
            </View>
        </View>
    </View>
    );
};

export default HistoryCard;