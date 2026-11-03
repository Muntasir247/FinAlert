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

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const { error } = await signUp(email.trim(), password, fullName.trim());
      if (error) {
        setErrorMsg(error.message || 'Failed to register. Please check your inputs.');
      } else {
        setSuccessMsg('Account created successfully! Checking credentials...');
        // The root auth guard will auto-navigate to tabs once the session updates.
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
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-2 pb-6">
          {/* Branding Block */}
          <View className="items-center mb-6">
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
            <TouchableOpacity
              className="flex-1 justify-center items-center pb-2"
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel="Go to Login tab"
              style={{ minHeight: 48 }}
            >
              {/* Subtitle token: text-[16px] font-medium */}
              <Text className="text-[16px] font-medium text-light-bg-shade">
                Login
              </Text>
            </TouchableOpacity>
            <View className="flex-1 border-b-2 border-main-theme justify-center items-center pb-2">
              {/* Subtitle token: text-[16px] font-medium */}
              <Text className="text-[16px] font-medium text-main-theme">
                Sign Up
              </Text>
            </View>
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

            {successMsg && (
              <View className="p-3 bg-green-50 border border-green-200 rounded-xl">
                {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                <Text className="text-[13px] leading-[15px] font-normal text-green-600">
                  {successMsg}
                </Text>
              </View>
            )}

            {/* Full Name Field */}
            <View className="gap-y-1.5">
              {/* Subtext token: text-[14px] font-normal */}
              <Text className="text-[14px] font-normal text-light-bg-text">
                Full Name
              </Text>
              <View className="flex-row items-center bg-white border border-light-green rounded-xl px-4 h-[52px]">
                <TextInput
                  className="flex-1 text-[14px] font-normal text-light-bg-text h-full"
                  placeholder="Enter your full name"
                  placeholderTextColor="#A0ADB6"
                  autoCapitalize="words"
                  autoCorrect={false}
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!loading}
                  accessibilityLabel="Full name input"
                />
              </View>
            </View>

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
                  placeholder="Create a password"
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

            {/* Submit Button */}
            <View className="mt-4 rounded-[26px] overflow-hidden h-[52px]">
              <LinearGradient
                colors={loading ? ['#9AE1C9', '#82D2B4'] : ['#02C78E', '#0FB384']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="flex-1"
              >
                <TouchableOpacity
                  className="flex-1 justify-center items-center"
                  onPress={handleSignup}
                  disabled={loading}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel="Submit Signup"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    /* Subtitle token: text-[16px] font-medium */
                    <Text className="text-[16px] font-medium text-white">
                      Sign Up
                    </Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="flex-row justify-center items-center flex-wrap mt-auto pt-4 border-t border-light-green min-h-[48px]">
          {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
          <Text className="text-[13px] leading-[15px] font-normal text-light-bg-shade">
            Already have an account?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Navigate to login screen"
            style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            {/* Subtitle token: text-[16px] font-medium */}
            <Text className="text-[16px] font-medium text-alt-accent">
              Login
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
