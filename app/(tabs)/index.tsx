import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-green-white" edges={['top']}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-bold text-light-bg-text">Home</Text>
        <Text className="text-light-bg-shade mt-2">Dashboard coming soon</Text>
      </View>
    </SafeAreaView>
  );
}