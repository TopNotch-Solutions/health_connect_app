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
            return { 
                color: '#10B981', 
                bgColor: '#D1FAE5', 
                gradientStart: '#10B981', 
                gradientEnd: '#059669',
                icon: 'check-circle' 
            };
        case 'cancelled':
            return { 
                color: '#EF4444', 
                bgColor: '#FEE2E2', 
                gradientStart: '#EF4444', 
                gradientEnd: '#DC2626',
                icon: 'x-circle' 
            };
        case 'pending':
        case 'searching':
            return { 
                color: '#F59E0B', 
                bgColor: '#FEF3C7', 
                gradientStart: '#F59E0B', 
                gradientEnd: '#D97706',
                icon: 'clock' 
            };
        case 'accepted':
        case 'en_route':
        case 'arrived':
            return { 
                color: '#3B82F6', 
                bgColor: '#DBEAFE', 
                gradientStart: '#3B82F6', 
                gradientEnd: '#2563EB',
                icon: 'navigation' 
            };
        default:
            return { 
                color: '#6B7280', 
                bgColor: '#F3F4F6', 
                gradientStart: '#6B7280', 
                gradientEnd: '#4B5563',
                icon: 'info' 
            };
        }
    };

    const statusConfig = getStatusConfig(item.status);
    const statusText = item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' ');

    return (
        <View 
            className="w-[48%] mb-4 rounded-2xl overflow-hidden"
            style={{
                height: 150,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
            }}
        >
            {/* Background with gradient-like effect */}
            <View 
                style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backgroundColor: statusConfig.gradientStart,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {/* Decorative pattern overlay */}
                <View 
                    style={{
                        position: 'absolute',
                        top: -20,
                        right: -20,
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                />
                <View 
                    style={{
                        position: 'absolute',
                        bottom: -30,
                        left: -30,
                        width: 100,
                        height: 100,
                        borderRadius: 50,
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    }}
                />
                
                {/* Large icon in center */}
                <View 
                    style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Feather 
                        name={statusConfig.icon as any} 
                        size={32} 
                        color="#FFFFFF" 
                    />
                </View>
            </View>
            
            {/* Blurred overlay at the bottom with content */}
            <View
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                }}
            >
                <Text 
                    style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#FFFFFF',
                        textShadowColor: 'rgba(0, 0, 0, 0.75)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 3,
                        marginBottom: 6,
                    }}
                    numberOfLines={1}
                >
                    {item.ailment}
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Feather name={statusConfig.icon as any} size={12} color="#FFFFFF" />
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: '#FFFFFF',
                            marginLeft: 4,
                            textShadowColor: 'rgba(0, 0, 0, 0.75)',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 3,
                        }}
                    >
                        {statusText}
                    </Text>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="calendar" size={11} color="#E5E7EB" />
                    <Text 
                        style={{ 
                            fontSize: 10, 
                            color: '#E5E7EB', 
                            marginLeft: 4,
                            textShadowColor: 'rgba(0, 0, 0, 0.75)',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 3,
                        }}
                    >
                        {item.date}
                    </Text>
                </View>
            </View>
        </View>
    );
};

export default HistoryCard;