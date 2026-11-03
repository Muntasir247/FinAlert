import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setErrorMsg(error.message || 'Failed to sign in. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-green-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 20,
          justifyContent: 'space-between',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center py-6">
          <View className="h-6" />

          {/* Branding Block */}
          <View className="items-center mb-8">
            <View className="w-[80px] h-[80px] rounded-[40px] bg-light-green items-center justify-center mb-3 shadow-sm">
              <Image
                source={require('../../assets/images/logo.png')}
                className="w-12 h-12"
                resizeMode="contain"
              />
            </View>
            {/* Title token: text-[20px] leading-[22px] font-bold */}
            <Text className="text-[20px] leading-[22px] font-bold text-light-bg-text">
              FinAlert
            </Text>
            {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
            <Text className="text-[13px] leading-[15px] font-normal text-light-bg-shade mt-1">
              Smart Finance for Smart Families
            </Text>
          </View>

          {/* Segment/Tab Control */}
          <View className="flex-row border-b border-light-green mb-6 h-12">
            <View className="flex-1 border-b-2 border-main-theme justify-center items-center pb-2">
              {/* Subtitle token: text-[16px] font-medium */}
              <Text className="text-[16px] font-medium text-main-theme">
                Login
              </Text>
            </View>
            <TouchableOpacity
              className="flex-1 justify-center items-center pb-2"
              onPress={() => router.push('/(auth)/signup')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel="Go to Sign Up tab"
              style={{ minHeight: 48 }}
            >
              {/* Subtitle token: text-[16px] font-medium */}
              <Text className="text-[16px] font-medium text-light-bg-shade">
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View className="gap-y-4">
            {errorMsg && (
              <View className="p-3 bg-red-50 border border-red-200 rounded-xl">
                {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                <Text className="text-[13px] leading-[15px] font-normal text-red-600">
                  {errorMsg}
                </Text>
              </View>
            )}

            {/* Email Field */}
            <View className="gap-y-1.5">
              {/* Subtext token: text-[14px] font-normal */}
              <Text className="text-[14px] font-normal text-light-bg-text">
                Email Address
              </Text>
              <View className="flex-row items-center bg-white border border-light-green rounded-xl px-4 h-[52px]">
                <TextInput
                  className="flex-1 text-[14px] font-normal text-light-bg-text h-full"
                  placeholder="Enter your email"
                  placeholderTextColor="#A0ADB6"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                  accessibilityLabel="Email input"
                />
              </View>
            </View>

            {/* Password Field */}
            <View className="gap-y-1.5">
              {/* Subtext token: text-[14px] font-normal */}
              <Text className="text-[14px] font-normal text-light-bg-text">
                Password
              </Text>
              <View className="flex-row items-center bg-white border border-light-green rounded-xl px-4 h-[52px]">
                <TextInput
                  className="flex-1 text-[14px] font-normal text-light-bg-text h-full"
                  placeholder="Enter your password"
                  placeholderTextColor="#A0ADB6"
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                  accessibilityLabel="Password input"
                />
                <TouchableOpacity
                  onPress={() => setPasswordVisible(!passwordVisible)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Ionicons
                    name={passwordVisible ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password Link */}
            <View className="items-end -mt-1">
              <TouchableOpacity
                onPress={() => router.push('/(auth)/forgot-password')}
                disabled={loading}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel="Forgot Password"
                style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }}
              >
                {/* Subtext token: text-[14px] font-normal */}
                <Text className="text-[14px] font-normal text-alt-accent">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <View className="mt-2 rounded-[26px] overflow-hidden h-[52px]">
              <LinearGradient
                colors={loading ? ['#9AE1C9', '#82D2B4'] : ['#02C78E', '#0FB384']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="flex-1"
              >
                <TouchableOpacity
                  className="flex-1 justify-center items-center"
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel="Submit Login"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    /* Subtitle token: text-[16px] font-medium */
                    <Text className="text-[16px] font-medium text-white">
                      Login
                    </Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="flex-row justify-center items-center flex-wrap pt-4 border-t border-light-green h-12">
          {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
          <Text className="text-[13px] leading-[15px] font-normal text-light-bg-shade">
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/signup')}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Navigate to signup screen"
            style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            {/* Subtitle token: text-[16px] font-medium */}
            <Text className="text-[16px] font-medium text-alt-accent">
              Create Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
